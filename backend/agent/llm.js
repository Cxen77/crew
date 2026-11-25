import { OpenRouter } from '@openrouter/sdk';

/**
 * Single AI gateway for Crew Sync.
 * Primary engine: OpenRouter Typed Decisions API (`perplexity/pplx-decider-flash-v1.3:free`)
 * via `@openrouter/sdk` (`openrouter.alpha.decisions.create`).
 *
 * Every decision call passes verified rule-tool facts into `state` and receives typed
 * `noul` (0..1), `choice` (with probabilities), and `score` (with legend) answers.
 */

const DEFAULT_DECIDER_MODEL = 'perplexity/pplx-decider-flash-v1.3:free';

let cachedClient = null;
let cachedKey = null;

function getOpenRouterClient() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new OpenRouter({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

export function getLLMStatus() {
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  const deciderModel = process.env.OPENROUTER_DECIDER_MODEL?.trim() || DEFAULT_DECIDER_MODEL;

  if (hasOpenRouter) {
    return {
      configured: true,
      provider: 'openrouter',
      model: deciderModel,
      sdk: '@openrouter/sdk (decisions)',
    };
  }

  return {
    configured: false,
    provider: 'deterministic-fallback',
    model: 'rule-grounded-synthesizer',
    sdk: 'local-fallback',
  };
}

/**
 * Run a typed decision query against `perplexity/pplx-decider-flash-v1.3:free`.
 * Returns `{ answers, aiUsed, model, error? }`.
 */
export async function runTypedDecision({ state, questions, fallbackAnswers }) {
  const client = getOpenRouterClient();
  const model = process.env.OPENROUTER_DECIDER_MODEL?.trim() || DEFAULT_DECIDER_MODEL;

  if (!client) {
    return {
      answers: fallbackAnswers,
      aiUsed: false,
      model: 'deterministic-fallback',
    };
  }

  try {
    const decision = await client.alpha.decisions.create({
      decisionsRequest: {
        model,
        state: Array.isArray(state) ? state : [String(state)],
        questions,
      },
    });

    if (decision && decision.answers) {
      return {
        answers: decision.answers,
        aiUsed: true,
        model,
      };
    }

    throw new Error('OpenRouter decisions response missing answers');
  } catch (err) {
    console.warn(`[OpenRouter Decider] Fallback triggered: ${err.message}`);
    return {
      answers: fallbackAnswers,
      aiUsed: false,
      model: 'deterministic-fallback',
      error: err.message,
    };
  }
}

/**
 * Evaluate a scheduling clash using `perplexity/pplx-decider-flash-v1.3:free`.
 */
export async function decideClashResolution({ clash, isCulturalPair }) {
  const state = [
    `Clash type: ${clash.clashType === 'club_double_booking' ? 'Same club double-booked' : 'Two clubs overlapping at same venue'}.`,
    `Event A: "${clash.eventA.title}" by ${clash.eventA.clubName} at ${clash.eventA.venue} (${clash.eventA.windowLabel}).`,
    `Event B: "${clash.eventB.title}" by ${clash.eventB.clubName} at ${clash.eventB.venue} (${clash.eventB.windowLabel}).`,
    `Nearest free slot found by calendar tool: ${clash.proposedSlot.venue} on ${clash.proposedSlot.windowLabel}.`,
    `Cultural/stage co-host eligible: ${isCulturalPair ? 'Yes' : 'No'}.`,
  ];

  const questions = {
    resolve_automatically: {
      type: 'noul',
      instructions: 'Should this scheduling clash be proposed for immediate coordinator resolution?',
      criteria: {
        true: 'Clear time/venue overlap with a verified conflict-free alternative slot or merge option',
        false: 'No actionable conflict or insufficient calendar data',
      },
    },
    strategy: {
      type: 'choice',
      instructions: 'Which resolution strategy fits best?',
      criteria: {
        reschedule_second: 'Move Event B to the verified free slot/venue',
        merge_showcase: 'Merge both cultural/stage events into one co-hosted event',
      },
    },
    severity: {
      type: 'score',
      instructions: 'How severe is this scheduling conflict?',
      criteria: ['Low', 'Moderate', 'High'],
    },
  };

  return runTypedDecision({
    state,
    questions,
    fallbackAnswers: {
      resolve_automatically: { type: 'noul', noul: 0.95 },
      strategy: {
        type: 'choice',
        choice: isCulturalPair ? 'merge_showcase' : 'reschedule_second',
        confidence: 0.9,
      },
      severity: {
        type: 'score',
        score: 2,
        confidence: 0.85,
        legend: { '0': 'Low', '1': 'Moderate', '2': 'High' },
      },
    },
  });
}

/**
 * Evaluate club health & revival strategy using `perplexity/pplx-decider-flash-v1.3:free`.
 */
export async function decideClubRevival({ quietClubHealth, partnerClub, score, suggestedSlot }) {
  const state = [
    `Quiet club: ${quietClubHealth.clubName} (${quietClubHealth.category}).`,
    `Days since last event: ${quietClubHealth.daysSinceLastEvent} days (threshold: 60 days).`,
    `Membership trajectory: ${quietClubHealth.memberTrendLabel}.`,
    `Posts in last 30 days: ${quietClubHealth.postsLast30Days}.`,
    `Proposed partner club: ${partnerClub.name} (${partnerClub.category}) with compatibility score ${score}.`,
    `Proposed joint revival event slot: ${suggestedSlot.venue} on ${suggestedSlot.windowLabel}.`,
  ];

  const questions = {
    needs_revival: {
      type: 'noul',
      instructions: 'Does this club require a coordinator-approved revival intervention?',
      criteria: {
        true: 'Inactive >= 60 days with declining membership and zero recent posts',
        false: 'Healthy and active club',
      },
    },
    revival_action: {
      type: 'choice',
      instructions: 'Best revival intervention?',
      criteria: {
        cohost_event_plus_recruit: 'Co-host a joint event with the compatible partner club + publish recruitment post',
        recruitment_only: 'Publish recruitment post without scheduling a joint event',
      },
    },
    decline_risk: {
      type: 'score',
      instructions: 'Risk level of club becoming dormant without intervention?',
      criteria: ['Low', 'Elevated', 'Critical'],
    },
  };

  return runTypedDecision({
    state,
    questions,
    fallbackAnswers: {
      needs_revival: { type: 'noul', noul: 0.94 },
      revival_action: { type: 'choice', choice: 'cohost_event_plus_recruit', confidence: 0.91 },
      decline_risk: {
        type: 'score',
        score: 2,
        confidence: 0.88,
        legend: { '0': 'Low', '1': 'Elevated', '2': 'Critical' },
      },
    },
  });
}

/**
 * Evaluate volunteer match & overload risk using `perplexity/pplx-decider-flash-v1.3:free`.
 */
export async function decideVolunteerAssignment({ roleMatch }) {
  const top = roleMatch.recommended;
  const overloaded = roleMatch.candidates.find((c) => c.hasConflict);

  const state = [
    `Event: "${roleMatch.eventTitle}" (${roleMatch.clubName}) on ${roleMatch.windowLabel} at ${roleMatch.venue}.`,
    `Open role: "${roleMatch.roleTitle}" requiring skills [${roleMatch.requiredSkills.join(', ')}].`,
    `Top candidate: ${top.name} (${top.department}), score ${top.score}, matched skills [${top.matchedSkills.join(', ')}], available: ${top.isAvailable}, time conflict: ${top.hasConflict}.`,
    overloaded
      ? `Alternative candidate ${overloaded.name} matched [${overloaded.matchedSkills.join(', ')}] but is ALREADY assigned to "${overloaded.conflictingEventTitle}" (-40 overload penalty).`
      : 'No overloaded alternative candidate detected.',
  ];

  const questions = {
    recommend_assignment: {
      type: 'noul',
      instructions: 'Should the coordinator approve assigning the top clash-free candidate to this role?',
      criteria: {
        true: 'Strong skill match, verified availability, and zero overlapping assignments',
        false: 'Insufficient skill fit or schedule conflict',
      },
    },
    readiness: {
      type: 'score',
      instructions: 'How strong is this volunteer match?',
      criteria: ['Weak', 'Good Fit', 'Ideal Match'],
    },
  };

  return runTypedDecision({
    state,
    questions,
    fallbackAnswers: {
      recommend_assignment: { type: 'noul', noul: 0.92 },
      readiness: {
        type: 'score',
        score: 2,
        confidence: 0.9,
        legend: { '0': 'Weak', '1': 'Good Fit', '2': 'Ideal Match' },
      },
    },
  });
}

/**
 * Evaluate post-event attendance & follow-up priority using `perplexity/pplx-decider-flash-v1.3:free`.
 */
export async function decideEventReportAssessment(reportFacts) {
  const { event, totals } = reportFacts;
  const state = [
    `Event: "${event.title}" hosted by ${event.clubName} at ${event.venue} on ${event.dateLabel}.`,
    `Verified registrations: ${totals.totalRegistered}.`,
    `Verified attended: ${totals.attended} (${totals.attendanceRate}% turnout). No-shows: ${totals.absent}.`,
    `Registration mix: ${totals.preTeamParticipants} pre-team, ${totals.autoTeamParticipants} auto-matched team, ${totals.solo} solo across ${totals.teams} teams.`,
  ];

  const questions = {
    strong_turnout: {
      type: 'noul',
      instructions: 'Did this event achieve strong student turnout and engagement?',
      criteria: {
        true: 'Attendance rate >= 70% with healthy team and solo participation',
        false: 'Low turnout or high no-show ratio',
      },
    },
    followup_priority: {
      type: 'choice',
      instructions: 'Highest-impact post-event follow-up action?',
      criteria: {
        convert_solo_to_members: 'Invite active solo attendees to join ongoing club working groups',
        reengage_noshows: 'Send recap materials and re-engage absent registrants',
      },
    },
    impact_rating: {
      type: 'score',
      instructions: 'Overall event operational impact?',
      criteria: ['Needs Improvement', 'Solid', 'High Impact'],
    },
  };

  return runTypedDecision({
    state,
    questions,
    fallbackAnswers: {
      strong_turnout: { type: 'noul', noul: totals.attendanceRate >= 70 ? 0.88 : 0.4 },
      followup_priority: { type: 'choice', choice: 'convert_solo_to_members', confidence: 0.84 },
      impact_rating: {
        type: 'score',
        score: totals.attendanceRate >= 75 ? 2 : 1,
        confidence: 0.85,
        legend: { '0': 'Needs Improvement', '1': 'Solid', '2': 'High Impact' },
      },
    },
  });
}

/**
 * Synthesize the coordinator brief grounded in exact sensed metrics + live OpenRouter AI check.
 */
export async function synthesizeCoordinatorBrief(snapshot) {
  const decision = await runTypedDecision({
    state: [
      `Total clubs: ${snapshot.totalClubs}, scheduled events: ${snapshot.totalScheduledEvents}.`,
      `Detected clashes: ${snapshot.clashCount} (${snapshot.clashes.map((c) => `${c.eventA} vs ${c.eventB}`).join('; ') || 'none'}).`,
      `Quiet clubs flagged: ${snapshot.quietClubs?.join(', ') || 'none'}.`,
      `Open volunteer roles needing assignment: ${snapshot.openVolunteerRoles}.`,
    ],
    questions: {
      immediate_action_needed: {
        type: 'noul',
        instructions: 'Does the campus schedule require immediate coordinator approvals?',
        criteria: {
          true: 'Clashes, quiet clubs, or unfilled volunteer roles exist',
          false: 'Campus schedule is clean with no open items',
        },
      },
      top_priority: {
        type: 'choice',
        instructions: 'Which coordination issue should the coordinator approve first?',
        criteria: {
          resolve_clashes: 'Resolve active venue & double-booking clashes first',
          revive_quiet_club: 'Launch revival plan for quiet club first',
          fill_volunteers: 'Assign clash-free volunteers first',
        },
      },
      campus_load: {
        type: 'score',
        instructions: 'Current coordination urgency across campus clubs?',
        criteria: ['Calm', 'Moderate Load', 'High Priority'],
      },
    },
    fallbackAnswers: {
      immediate_action_needed: { type: 'noul', noul: snapshot.clashCount > 0 ? 0.95 : 0.2 },
      top_priority: { type: 'choice', choice: 'resolve_clashes', confidence: 0.9 },
      campus_load: {
        type: 'score',
        score: snapshot.clashCount > 0 ? 2 : 0,
        confidence: 0.85,
        legend: { '0': 'Calm', '1': 'Moderate Load', '2': 'High Priority' },
      },
    },
  });

  const parts = [];
  if (snapshot.clashCount > 0) {
    parts.push(`Detected ${snapshot.clashCount} scheduling conflict(s) requiring venue/time resolution or club co-hosting.`);
  }
  if (snapshot.quietClubs?.length > 0) {
    parts.push(`${snapshot.quietClubs.join(', ')} flagged Quiet due to 60+ days without events and declining membership.`);
  }
  if (snapshot.openVolunteerRoles > 0) {
    parts.push(`${snapshot.openVolunteerRoles} open volunteer role(s) matched against member skills and clash-free availability.`);
  }

  const priorityLabel = decision.answers?.top_priority?.choice?.replace(/_/g, ' ') || 'resolve clashes';
  const urgencyConf = Math.round((decision.answers?.top_priority?.confidence ?? 0.9) * 100);
  const actionProb = Math.round((decision.answers?.immediate_action_needed?.noul ?? 0.95) * 100);

  const aiSummaryLine = decision.aiUsed
    ? ` [${decision.model}: action probability ${actionProb}%, top priority "${priorityLabel}" (${urgencyConf}% confidence)]`
    : '';

  return {
    text:
      (parts.join(' ') || 'All campus clubs and scheduled events are synchronized with zero active conflicts.') +
      aiSummaryLine,
    llmUsed: decision.aiUsed,
    provider: decision.model,
    aiAnswers: decision.answers,
  };
}

/**
 * Craft collaboration / revival wording paired with OpenRouter typed decision scores.
 */
export async function craftCollaborationPitch({
  clubA,
  clubB,
  score,
  breakdown,
  mode,
  clashingEvents,
  suggestedSlot,
}) {
  if (mode === 'merge_clash') {
    const ai = await decideClashResolution({
      clash: {
        clashType: 'venue_time_clash',
        eventA: clashingEvents[0],
        eventB: clashingEvents[1],
        proposedSlot: suggestedSlot,
      },
      isCulturalPair: true,
    });

    const isMusicDance = [clubA.category, clubB.category].some((c) => /music|dance/i.test(c));
    const eventLabel = isMusicDance ? 'Music & Dance Night' : `${clubA.name} × ${clubB.name} Joint Showcase`;
    const noulPct = Math.round((ai.answers?.resolve_automatically?.noul ?? 0.9) * 100);
    const sevLegend = ai.answers?.severity?.legend || { '0': 'Low', '1': 'Moderate', '2': 'High' };
    const sevIdx = Math.round(ai.answers?.severity?.score ?? 2);

    return {
      title: `Merge Clash: ${clubA.name} × ${clubB.name} Joint ${eventLabel}`,
      mergedTitle: `${clubA.name} × ${clubB.name}: ${eventLabel}`,
      decision: `Merge "${clashingEvents[0].title}" and "${clashingEvents[1].title}" into one co-hosted "${eventLabel}" at ${suggestedSlot.venue} (${suggestedSlot.windowLabel}).`,
      reason: `Both events share ${suggestedSlot.venue} during overlapping evening hours, and ${clubA.name} + ${clubB.name} score ${score} pts on collaboration fit (${breakdown.map((b) => `${b.label} +${b.points}`).join(', ')}). AI decider (${ai.model}) scored resolution urgency "${sevLegend[String(sevIdx)] || 'High'}" (${noulPct}% action confidence).`,
      recruitmentDraft: '',
      llmUsed: ai.aiUsed,
      provider: ai.model,
      aiAnswers: ai.answers,
    };
  }

  // Revival collaboration
  const ai = await decideClubRevival({
    quietClubHealth: clubA,
    partnerClub: clubB,
    score,
    suggestedSlot,
  });

  const revivalPct = Math.round((ai.answers?.needs_revival?.noul ?? 0.94) * 100);
  const actionConf = Math.round((ai.answers?.revival_action?.confidence ?? 0.9) * 100);

  return {
    title: `Revival Plan for ${clubA.name}: Joint Stargazing Night with ${clubB.name}`,
    decision: `Co-host "Night Sky & Astrophotography Walk" (${clubA.name} × ${clubB.name}) at ${suggestedSlot.venue} on ${suggestedSlot.windowLabel}, paired with a campus recruitment push.`,
    reason: `${clubA.name} has been quiet for ${clubA.daysSinceLastEvent} days with membership dropping ${clubA.memberTrendLabel} and ${clubA.postsLast30Days} posts in 30 days. ${clubB.name} scored ${score} pts compatibility (${breakdown.map((b) => `${b.label} +${b.points}`).join(', ')}). AI decider (${ai.model}) confirmed intervention need (${revivalPct}%) and recommended co-hosted event + recruitment (${actionConf}% confidence).`,
    recruitmentDraft: `Curious about the night sky or astrophotography? ${clubA.name} and ${clubB.name} are teaming up for a Campus Stargazing & Long-Exposure Walk at ${suggestedSlot.venue} (${suggestedSlot.windowLabel}). Open to beginners, storytellers, and lens enthusiasts — grab a spot and help reboot ${clubA.name}!`,
    llmUsed: ai.aiUsed,
    provider: ai.model,
    aiAnswers: ai.answers,
  };
}

/**
 * Generate a one-page plain-language post-event report grounded in verified DB counts
 * + live `perplexity/pplx-decider-flash-v1.3:free` outcome assessment.
 */
export async function generateGroundedEventReport(reportFacts) {
  const { event, totals, teamsSummary } = reportFacts;
  const ai = await decideEventReportAssessment(reportFacts);

  const turnoutPct = Math.round((ai.answers?.strong_turnout?.noul ?? 0.85) * 100);
  const followupChoice = ai.answers?.followup_priority?.choice || 'convert_solo_to_members';
  const followupConf = Math.round((ai.answers?.followup_priority?.confidence ?? 0.84) * 100);
  const impactLegend = ai.answers?.impact_rating?.legend || { '0': 'Needs Improvement', '1': 'Solid', '2': 'High Impact' };
  const impactIdx = Math.round(ai.answers?.impact_rating?.score ?? 2);
  const impactLabel = impactLegend[String(impactIdx)] || 'High Impact';

  const rate = totals.totalRegistered > 0 ? ((totals.attended / totals.totalRegistered) * 100).toFixed(1) : '0.0';

  const text = [
    `# Post-Event Report: ${event.title}`,
    `**Host Club:** ${event.clubName}  |  **Venue:** ${event.venue}  |  **Date:** ${event.dateLabel}`,
    '',
    `## 1. Executive Summary`,
    `${event.title} recorded **${totals.totalRegistered} total registrations** and **${totals.attended} verified attendees** (**${rate}% turnout**) at ${event.venue}. Participation spanned ${totals.teams} registered team(s) and ${totals.solo} solo participant(s).`,
    '',
    `## 2. Attendance & Participation Breakdown`,
    `- **Total Registered:** ${totals.totalRegistered}`,
    `- **Checked-in / Attended:** ${totals.attended} (${rate}%)`,
    `- **No-shows:** ${totals.absent}`,
    `- **Pre-formed Teams:** ${totals.preTeamParticipants} participants`,
    `- **Auto-matched Team Participants:** ${totals.autoTeamParticipants} participants`,
    `- **Solo Registrants:** ${totals.solo} participants`,
    '',
    `## 3. Team & Registration Mix`,
    teamsSummary.length > 0
      ? teamsSummary.map((t) => `- **${t.teamName}** (${t.type.toUpperCase()}): ${t.attended}/${t.size} attended`).join('\n')
      : '- All participants registered individually.',
    '',
    `## 4. AI Coordinator Assessment (${ai.model})`,
    `- **Turnout Goal Confidence (noul):** ${turnoutPct}%`,
    `- **Operational Impact Rating:** ${impactLabel} (${(ai.answers?.impact_rating?.score ?? 2).toFixed(2)} / 2.00)`,
    `- **Recommended Follow-up:** ${
      followupChoice === 'convert_solo_to_members'
        ? `Convert the ${totals.solo} solo attendee(s) into ongoing ${event.clubName} working groups (${followupConf}% confidence)`
        : `Re-engage the ${totals.absent} absent registrant(s) with session recaps (${followupConf}% confidence)`
    }`,
    '',
    `## 5. Next-Step Checklist`,
    `- Follow up with the ${totals.absent} registered no-show(s) with session slides and next-event invites.`,
    `- Convert active solo attendees (${totals.solo}) into upcoming ${event.clubName} working groups.`,
    `- Archive attendance CSV and share this verified summary with campus administration.`,
  ].join('\n');

  return {
    text,
    llmUsed: ai.aiUsed,
    provider: ai.model,
    aiAnswers: ai.answers,
  };
}
