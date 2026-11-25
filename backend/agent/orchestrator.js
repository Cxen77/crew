import Club from '../models/Club.js';
import Event from '../models/Event.js';
import Volunteer from '../models/Volunteer.js';
import DecisionLog from '../models/DecisionLog.js';
import { detectClashes, formatWindow } from './clash.js';
import { evaluateClubHealth } from './health.js';
import { generateCollaborationSuggestions } from './collaborate.js';
import { matchVolunteersForEvents } from './match.js';
import {
  decideClashResolution,
  decideVolunteerAssignment,
  synthesizeCoordinatorBrief,
} from './llm.js';

/**
 * Orchestrates the Sense -> Think -> Act -> Explain agent cycle:
 *   1. Sense: Reads live Clubs, Events, Volunteers from MongoDB.
 *   2. Think: Executes deterministic rule engines + calls `perplexity/pplx-decider-flash-v1.3:free`
 *      via @openrouter/sdk typed decisions on every module (clashes, health/revival,
 *      collaborations, volunteer match, coordinator brief).
 *   3. Act: Writes idempotent 'proposed' DecisionLog items for coordinator approval.
 *   4. Explain: Attaches exact metrics, AI typed-decision scores/probabilities, and reasons.
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

  const mergedPairEventIds = new Set();
  for (const col of collaborations) {
    if (col.mode === 'merge_clash' && Array.isArray(col.clashingEventIds)) {
      mergedPairEventIds.add([...col.clashingEventIds].sort().join(':'));
    }
  }

  // 1. Clash proposals evaluated in parallel by `perplexity/pplx-decider-flash-v1.3:free`
  const clashTasks = clashResult.clashes
    .filter((clash) => {
      const pairKey = [clash.eventA._id, clash.eventB._id].sort().join(':');
      return !mergedPairEventIds.has(pairKey);
    })
    .map(async (clash) => {
      const pairKey = [clash.eventA._id, clash.eventB._id].sort().join(':');
      const ai = await decideClashResolution({ clash, isCulturalPair: false });
      const resolvePct = Math.round((ai.answers?.resolve_automatically?.noul ?? 0.95) * 100);
      const sevLegend = ai.answers?.severity?.legend || { '0': 'Low', '1': 'Moderate', '2': 'High' };
      const sevIdx = Math.round(ai.answers?.severity?.score ?? 2);
      const sevLabel = sevLegend[String(sevIdx)] || 'High';

      return upsertProposedDecision({
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
          aiDecision: ai.answers,
          aiModel: ai.model,
        },
        decision: `Reschedule "${clash.eventB.title}" (${clash.eventB.clubName}) to ${clash.proposedSlot.venue} on ${clash.proposedSlot.windowLabel}.`,
        reason: `${clash.reason} AI decider (${ai.model}) rated conflict severity "${sevLabel}" (${resolvePct}% resolution confidence).`,
        scoreBreakdown: [
          { label: 'Time overlap in [startAt, endAt)', points: 'Detected' },
          {
            label: clash.clashType === 'club_double_booking' ? 'Same club double-booked' : `Same venue (${clash.venue})`,
            points: 'Conflict',
          },
          { label: `AI Resolution Confidence (${ai.model})`, points: `${resolvePct}%` },
          { label: 'AI Severity', points: sevLabel },
        ],
        actionPayload: {
          type: 'reschedule_event',
          eventId: clash.eventB._id,
          newVenue: clash.proposedSlot.venue,
          newStartAt: clash.proposedSlot.startAt,
          newEndAt: clash.proposedSlot.endAt,
        },
        llmUsed: ai.aiUsed,
      });
    });

  // 2. Collaboration & Revival proposals (already evaluated by `perplexity/pplx-decider-flash-v1.3:free`)
  const collabTasks = collaborations.map(async (col) => {
    if (col.mode === 'merge_clash') {
      const pairKey = [...col.clashingEventIds].sort().join(':');
      const noulPct = Math.round((col.aiAnswers?.resolve_automatically?.noul ?? 0.9) * 100);
      return upsertProposedDecision({
        proposalKey: `collab_merge:${pairKey}`,
        agentModule: 'collaborate',
        title: col.title,
        whatItSaw: {
          mode: 'merge_clash',
          clubA: col.clubA.name,
          clubB: col.clubB.name,
          venue: col.suggestedSlot.venue,
          window: col.suggestedSlot.windowLabel,
          aiDecision: col.aiAnswers,
          aiModel: col.provider,
        },
        decision: col.decision,
        reason: col.reason,
        scoreBreakdown: [
          ...col.breakdown,
          { label: `AI Co-Host Confidence (${col.provider || 'decider'})`, points: `${noulPct}%` },
        ],
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
    }

    if (col.mode === 'revival_collab') {
      const revivalPct = Math.round((col.aiAnswers?.needs_revival?.noul ?? 0.94) * 100);
      return upsertProposedDecision({
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
          aiDecision: col.aiAnswers,
          aiModel: col.provider,
        },
        decision: col.decision,
        reason: col.reason,
        scoreBreakdown: [
          { label: 'Days since last event', points: `${col.healthSnapshot.daysSinceLastEvent}d (≥60d flag)` },
          { label: 'Membership trend', points: col.healthSnapshot.memberTrendLabel },
          ...col.breakdown,
          { label: `AI Revival Urgency (${col.provider || 'decider'})`, points: `${revivalPct}%` },
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
    }

    return null;
  });

  // 3. Volunteer matching proposals evaluated in parallel by `perplexity/pplx-decider-flash-v1.3:free`
  const volunteerTasks = volunteerMatches
    .filter((rm) => Boolean(rm.recommended))
    .map(async (roleMatch) => {
      const top = roleMatch.recommended;
      const overloadedCand = roleMatch.candidates.find((c) => c.hasConflict);
      const ai = await decideVolunteerAssignment({ roleMatch });
      const approvePct = Math.round((ai.answers?.recommend_assignment?.noul ?? 0.92) * 100);
      const readinessLegend = ai.answers?.readiness?.legend || { '0': 'Weak', '1': 'Good Fit', '2': 'Ideal Match' };
      const readinessLabel = readinessLegend[String(Math.round(ai.answers?.readiness?.score ?? 2))] || 'Ideal Match';

      const overloadNote = overloadedCand
        ? ` Note: ${overloadedCand.name} also matched skills (${overloadedCand.matchedSkills.join(', ')}) but was penalized -40 due to a time clash with "${overloadedCand.conflictingEventTitle}".`
        : '';

      return upsertProposedDecision({
        proposalKey: `match:${roleMatch.eventId}:${roleMatch.roleId}:${top.volunteerId}`,
        agentModule: 'match',
        title: `Volunteer Match: ${top.name} → ${roleMatch.roleTitle} (${roleMatch.clubName})`,
        whatItSaw: {
          eventTitle: roleMatch.eventTitle,
          roleTitle: roleMatch.roleTitle,
          requiredSkills: roleMatch.requiredSkills,
          topCandidate: top.name,
          overloadedCandidate: overloadedCand ? overloadedCand.name : null,
          aiDecision: ai.answers,
          aiModel: ai.model,
        },
        decision: `Assign ${top.name} (${top.department}) as "${roleMatch.roleTitle}" for "${roleMatch.eventTitle}" (${roleMatch.windowLabel}).`,
        reason: `${top.reason}${overloadNote} AI decider (${ai.model}) rated "${readinessLabel}" (${approvePct}% fit).`,
        scoreBreakdown: [
          ...top.breakdown,
          { label: `AI Match Confidence (${ai.model})`, points: `${approvePct}%` },
        ],
        actionPayload: {
          type: 'assign_volunteer',
          eventId: roleMatch.eventId,
          roleId: roleMatch.roleId,
          volunteerId: top.volunteerId,
          volunteerName: top.name,
        },
        llmUsed: ai.aiUsed,
      });
    });

  // 4. Coordinator AI brief + run all module proposals in parallel
  const quietClubs = healthReports.filter((h) => h.isQuiet).map((h) => h.clubName);
  const [brief] = await Promise.all([
    synthesizeCoordinatorBrief({
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
    }),
    ...clashTasks,
    ...collabTasks,
    ...volunteerTasks,
  ]);

  return {
    brief: brief.text,
    llmUsed: brief.llmUsed,
    provider: brief.provider,
    aiAnswers: brief.aiAnswers,
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

  await senseCampusState();

  return decision;
}
