import Club from '../models/Club.js';
import Event from '../models/Event.js';
import Volunteer from '../models/Volunteer.js';
import DecisionLog from '../models/DecisionLog.js';
import { detectClashes, formatWindow } from './clash.js';
import { evaluateClubHealth } from './health.js';
import { generateCollaborationSuggestions } from './collaborate.js';
import { matchVolunteersForEvents } from './match.js';
import { synthesizeCoordinatorBrief } from './llm.js';

/**
 * Orchestrates the Sense -> Think -> Act -> Explain agent cycle:
 *   1. Sense: Reads live Clubs, Events, Volunteers from MongoDB.
 *   2. Think: Executes deterministic rule engines + calls llm.js to synthesize priority brief & collaboration ideas.
 *   3. Act: Writes idempotent 'proposed' DecisionLog items for coordinator approval.
 *   4. Explain: Attaches exact metrics, score breakdowns, and plain-language reasons.
 */

async function upsertProposedDecision(doc) {
  const existing = await DecisionLog.findOne({
    proposalKey: doc.proposalKey,
    status: 'proposed',
  });
  if (existing) {
    existing.whatItSaw = doc.whatItSaw;
    existing.decision = doc.decision;
    existing.reason = doc.reason;
    existing.scoreBreakdown = doc.scoreBreakdown;
    existing.actionPayload = doc.actionPayload;
    existing.llmUsed = doc.llmUsed;
    await existing.save();
    return existing;
  }

  // Do not re-propose if coordinator already approved or rejected this exact proposalKey
  const resolved = await DecisionLog.findOne({
    proposalKey: doc.proposalKey,
    status: { $in: ['approved', 'rejected'] },
  });
  if (resolved) return null;

  return DecisionLog.create({ ...doc, status: 'proposed' });
}

export async function senseCampusState() {
  const [clubs, events, volunteers] = await Promise.all([
    Club.find({}).lean(),
    Event.find({}).populate('clubId', 'name category tags').populate('collaboratingClubIds', 'name').lean(),
    Volunteer.find({}).lean(),
  ]);

  const clashResult = detectClashes(events);
  const healthReports = evaluateClubHealth(clubs, events);
  const volunteerMatches = matchVolunteersForEvents(events, volunteers);

  // Sync computed health fields onto Club documents so views stay consistent
  await Promise.all(
    healthReports.map((hr) =>
      Club.findByIdAndUpdate(hr.clubId, {
        healthScore: hr.healthScore,
        isQuiet: hr.isQuiet,
      })
    )
  );

  return {
    clubs,
    events,
    volunteers,
    clashResult,
    healthReports,
    volunteerMatches,
  };
}

export async function runAgentCycle() {
  const sensed = await senseCampusState();
  const { clubs, events, clashResult, healthReports, volunteerMatches } = sensed;

  const collaborations = await generateCollaborationSuggestions({
    clubs,
    events,
    clashes: clashResult.clashes,
    healthReports,
  });

  // Track which clashing pair already has a merge collaboration proposal
  const mergedPairEventIds = new Set();
  for (const col of collaborations) {
    if (col.mode === 'merge_clash' && Array.isArray(col.clashingEventIds)) {
      mergedPairEventIds.add([...col.clashingEventIds].sort().join(':'));
    }
  }

  const createdOrUpdated = [];

  // 1. Clash proposals
  for (const clash of clashResult.clashes) {
    const pairKey = [clash.eventA._id, clash.eventB._id].sort().join(':');
    const isMergeCandidate = mergedPairEventIds.has(pairKey);

    // For Venue/Time clashes that are NOT primarily merged (or we offer reschedule as alternative,
    // while keeping Clash 1 as pure reschedule and Clash 2 as Merge Collaboration!)
    if (!isMergeCandidate) {
      const entry = await upsertProposedDecision({
        proposalKey: `clash:${pairKey}`,
        agentModule: 'clash',
        title:
          clash.clashType === 'club_double_booking'
            ? `Double-Booking: ${clash.eventA.clubName}`
            : `Venue Clash: ${clash.eventA.clubName} vs ${clash.eventB.clubName}`,
        whatItSaw: {
          clashType: clash.clashType,
          venue: clash.venue,
          eventA: clash.eventA,
          eventB: clash.eventB,
        },
        decision: `Reschedule "${clash.eventB.title}" (${clash.eventB.clubName}) to ${clash.proposedSlot.venue} on ${clash.proposedSlot.windowLabel}.`,
        reason: clash.reason,
        scoreBreakdown: [
          { label: 'Time overlap in [startAt, endAt)', points: 'Detected' },
          {
            label: clash.clashType === 'club_double_booking' ? 'Same club double-booked' : `Same venue (${clash.venue})`,
            points: 'Conflict',
          },
          { label: `Free slot verified (${clash.proposedSlot.venue})`, points: '0 conflicts' },
        ],
        actionPayload: {
          type: 'reschedule_event',
          eventId: clash.eventB._id,
          newVenue: clash.proposedSlot.venue,
          newStartAt: clash.proposedSlot.startAt,
          newEndAt: clash.proposedSlot.endAt,
        },
        llmUsed: false,
      });
      if (entry) createdOrUpdated.push(entry);
    }
  }

  // 2. Collaboration & Revival proposals (includes Merge Clash + Dying Club Revival)
  for (const col of collaborations) {
    if (col.mode === 'merge_clash') {
      const pairKey = [...col.clashingEventIds].sort().join(':');
      const entry = await upsertProposedDecision({
        proposalKey: `collab_merge:${pairKey}`,
        agentModule: 'collaborate',
        title: col.title,
        whatItSaw: {
          mode: 'merge_clash',
          clubA: col.clubA.name,
          clubB: col.clubB.name,
          venue: col.suggestedSlot.venue,
          window: col.suggestedSlot.windowLabel,
        },
        decision: col.decision,
        reason: col.reason,
        scoreBreakdown: col.breakdown,
        actionPayload: {
          type: 'merge_events',
          eventIds: col.clashingEventIds,
          newTitle: col.mergedTitle,
          clubIds: [col.clubA._id, col.clubB._id],
          venue: col.suggestedSlot.venue,
          startAt: col.suggestedSlot.startAt,
          endAt: col.suggestedSlot.endAt,
        },
        llmUsed: Boolean(col.llmUsed),
      });
      if (entry) createdOrUpdated.push(entry);
    } else if (col.mode === 'revival_collab') {
      const entry = await upsertProposedDecision({
        proposalKey: `revival:${col.clubA._id}:${col.clubB._id}`,
        agentModule: 'health',
        title: col.title,
        whatItSaw: {
          quietClub: col.clubA.name,
          daysSinceLastEvent: col.healthSnapshot.daysSinceLastEvent,
          memberTrend: col.healthSnapshot.memberTrendLabel,
          postsLast30Days: col.healthSnapshot.postsLast30Days,
          healthScore: col.healthSnapshot.healthScore,
          partnerClub: col.clubB.name,
        },
        decision: col.decision,
        reason: col.reason,
        scoreBreakdown: [
          { label: 'Days since last event', points: `${col.healthSnapshot.daysSinceLastEvent}d (≥60d flag)` },
          { label: 'Membership trend', points: col.healthSnapshot.memberTrendLabel },
          ...col.breakdown,
        ],
        actionPayload: {
          type: 'revival_plan',
          clubId: col.clubA._id,
          partnerClubId: col.clubB._id,
          proposedEventTitle: col.proposedEventTitle,
          venue: col.suggestedSlot.venue,
          startAt: col.suggestedSlot.startAt,
          endAt: col.suggestedSlot.endAt,
          recruitmentDraft: col.recruitmentDraft,
        },
        llmUsed: Boolean(col.llmUsed),
      });
      if (entry) createdOrUpdated.push(entry);
    }
  }

  // 3. Volunteer matching proposals
  for (const roleMatch of volunteerMatches) {
    if (!roleMatch.recommended) continue;
    const top = roleMatch.recommended;
    const overloadedCand = roleMatch.candidates.find((c) => c.hasConflict);

    const overloadNote = overloadedCand
      ? ` Note: ${overloadedCand.name} also matched skills (${overloadedCand.matchedSkills.join(', ')}) but was penalized -40 due to a time clash with "${overloadedCand.conflictingEventTitle}".`
      : '';

    const entry = await upsertProposedDecision({
      proposalKey: `match:${roleMatch.eventId}:${roleMatch.roleId}:${top.volunteerId}`,
      agentModule: 'match',
      title: `Volunteer Match: ${top.name} → ${roleMatch.roleTitle} (${roleMatch.clubName})`,
      whatItSaw: {
        eventTitle: roleMatch.eventTitle,
        roleTitle: roleMatch.roleTitle,
        requiredSkills: roleMatch.requiredSkills,
        topCandidate: top.name,
        overloadedCandidate: overloadedCand ? overloadedCand.name : null,
      },
      decision: `Assign ${top.name} (${top.department}) as "${roleMatch.roleTitle}" for "${roleMatch.eventTitle}" (${roleMatch.windowLabel}).`,
      reason: `${top.reason}${overloadNote}`,
      scoreBreakdown: top.breakdown,
      actionPayload: {
        type: 'assign_volunteer',
        eventId: roleMatch.eventId,
        roleId: roleMatch.roleId,
        volunteerId: top.volunteerId,
        volunteerName: top.name,
      },
      llmUsed: false,
    });
    if (entry) createdOrUpdated.push(entry);
  }

  // 4. Coordinator AI brief
  const quietClubs = healthReports.filter((h) => h.isQuiet).map((h) => h.clubName);
  const brief = await synthesizeCoordinatorBrief({
    totalClubs: clubs.length,
    totalScheduledEvents: events.filter((e) => e.status === 'scheduled').length,
    clashCount: clashResult.clashes.length,
    clashes: clashResult.clashes.map((c) => ({
      type: c.clashType,
      eventA: c.eventA.title,
      eventB: c.eventB.title,
      venue: c.venue,
    })),
    quietClubs,
    openVolunteerRoles: volunteerMatches.length,
  });

  return {
    brief: brief.text,
    llmUsed: brief.llmUsed,
    provider: brief.provider,
    summary: {
      clashCount: clashResult.clashes.length,
      quietClubCount: quietClubs.length,
      collaborationCount: collaborations.length,
      openVolunteerRoles: volunteerMatches.length,
      proposalsActive: await DecisionLog.countDocuments({ status: 'proposed' }),
    },
    clashes: clashResult.clashes,
    clashingEventIds: clashResult.clashingEventIds,
    healthReports,
    collaborations,
    volunteerMatches,
  };
}

/**
 * Human-in-the-loop Decision Executor:
 * Approving a proposal executes the real mutation in MongoDB and logs the audit entry.
 */
export async function executeDecision(decisionId, action, decidedBy = 'Campus Coordinator') {
  const decision = await DecisionLog.findById(decisionId);
  if (!decision) {
    const err = new Error('Decision proposal not found');
    err.statusCode = 404;
    throw err;
  }

  if (decision.status !== 'proposed') {
    return decision;
  }

  if (action === 'rejected') {
    decision.status = 'rejected';
    decision.decidedBy = decidedBy;
    decision.decidedAt = new Date();
    decision.executionNote = 'Rejected by coordinator; no schedule or roster changes applied.';
    await decision.save();
    return decision;
  }

  const payload = decision.actionPayload || {};
  let executionNote = 'Approved by coordinator.';

  if (payload.type === 'reschedule_event') {
    const updated = await Event.findByIdAndUpdate(
      payload.eventId,
      {
        venue: payload.newVenue,
        startAt: new Date(payload.newStartAt),
        endAt: new Date(payload.newEndAt),
      },
      { new: true }
    );
    if (updated) {
      executionNote = `Moved "${updated.title}" to ${updated.venue} (${formatWindow(updated.startAt, updated.endAt)}).`;
    }
  } else if (payload.type === 'merge_events') {
    const [evAId, evBId] = payload.eventIds || [];
    const evA = await Event.findById(evAId);
    const evB = await Event.findById(evBId);

    const mergedEvent = await Event.create({
      title: payload.newTitle || 'Joint Music & Dance Night',
      description: `Co-hosted showcase merging "${evA?.title || 'Concert'}" and "${evB?.title || 'Dance Showcase'}" into a single campus evening celebration.`,
      clubId: payload.clubIds[0],
      collaboratingClubIds: [payload.clubIds[1]],
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt),
      venue: payload.venue,
      category: 'Showcase',
      tags: ['music', 'dance', 'cultural', 'performing-arts', 'collaboration'],
      status: 'scheduled',
      expectedAttendance: (evA?.expectedAttendance || 80) + (evB?.expectedAttendance || 60),
    });

    await Event.updateMany(
      { _id: { $in: payload.eventIds } },
      { status: 'merged', mergedIntoEventId: mergedEvent._id }
    );

    executionNote = `Merged both events into "${mergedEvent.title}" at ${mergedEvent.venue} (${formatWindow(mergedEvent.startAt, mergedEvent.endAt)}).`;
  } else if (payload.type === 'revival_plan') {
    const revivalEvent = await Event.create({
      title: payload.proposedEventTitle,
      description: `Revival co-hosted stargazing & astrophotography night designed to reactivate club engagement and welcome new members.`,
      clubId: payload.clubId,
      collaboratingClubIds: [payload.partnerClubId],
      startAt: new Date(payload.startAt),
      endAt: new Date(payload.endAt),
      venue: payload.venue,
      category: 'Stargazing',
      tags: ['astronomy', 'photography', 'night-sky', 'outdoors'],
      status: 'scheduled',
      expectedAttendance: 55,
    });

    await Club.findByIdAndUpdate(payload.clubId, {
      recruitmentDraft: payload.recruitmentDraft || '',
      lastActivityAt: new Date(),
      teamStatus: 'active',
    });

    executionNote = `Scheduled revival event "${revivalEvent.title}" at ${revivalEvent.venue} and saved recruitment post draft.`;
  } else if (payload.type === 'assign_volunteer') {
    const event = await Event.findById(payload.eventId);
    const volunteer = await Volunteer.findById(payload.volunteerId);
    if (event && volunteer) {
      const role = event.openRoles.id(payload.roleId);
      if (role) {
        if (!role.assignedVolunteerIds.some((id) => String(id) === String(volunteer._id))) {
          role.assignedVolunteerIds.push(volunteer._id);
          role.filledCount = role.assignedVolunteerIds.length;
          role.isOpen = role.filledCount < role.vacancies;
        }
        await event.save();
      }
      if (!volunteer.assignedEventIds.some((id) => String(id) === String(event._id))) {
        volunteer.assignedEventIds.push(event._id);
        await volunteer.save();
      }
      executionNote = `Assigned ${volunteer.name} to "${role?.title || 'Volunteer'}" for "${event.title}".`;
    }
  }

  decision.status = 'approved';
  decision.decidedBy = decidedBy;
  decision.decidedAt = new Date();
  decision.executionNote = executionNote;
  await decision.save();

  // Re-sense campus state so any resolved clashes/health flags update immediately
  await senseCampusState();

  return decision;
}
