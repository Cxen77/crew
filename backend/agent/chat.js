import Club from '../models/Club.js';
import Event from '../models/Event.js';
import Volunteer from '../models/Volunteer.js';
import DecisionLog from '../models/DecisionLog.js';
import EventParticipant from '../models/EventParticipant.js';
import {
  CAMPUS_VENUES,
  detectClashes,
  findNearestFreeSlot,
  formatWindow,
  intervalsOverlap,
  normalizeVenue,
} from './clash.js';
import { evaluateClubHealth } from './health.js';
import { matchVolunteersForEvents } from './match.js';
import { runTypedDecision } from './llm.js';

const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAYS = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function parseDateFromQuery(text) {
  const lower = text.toLowerCase();
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  if (/\btoday\b/.test(lower)) return base;
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (/\bday after tomorrow\b/.test(lower)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 2);
    return d;
  }

  // ISO date YYYY-MM-DD
  const isoMatch = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  // "26 nov" or "26th november"
  const dmMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const month = MONTHS[dmMatch[2]];
    const d = new Date(base.getFullYear(), month, day);
    return d;
  }

  // "nov 26" or "november 26"
  const mdMatch = lower.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (mdMatch) {
    const month = MONTHS[mdMatch[1]];
    const day = Number(mdMatch[2]);
    return new Date(base.getFullYear(), month, day);
  }

  // Weekday names ("friday", "this thu")
  for (const [wName, wIdx] of Object.entries(WEEKDAYS)) {
    if (new RegExp(`\\b${wName}\\b`).test(lower)) {
      const d = new Date(base);
      const diff = (wIdx - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  return null;
}

function parseTimeFromQuery(text) {
  const lower = text.toLowerCase();

  // "10:30 am", "2 pm", "14:00"
  const ampmMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2] || 0);
    const mer = ampmMatch[3];
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    return { hour, minute, label: `${ampmMatch[1]}:${String(minute).padStart(2, '0')} ${mer.toUpperCase()}` };
  }

  const h24Match = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24Match) {
    const hour = Number(h24Match[1]);
    const minute = Number(h24Match[2]);
    return { hour, minute, label: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
  }

  if (/\bmorning\b/.test(lower)) return { hour: 10, minute: 0, label: '10:00 AM (morning)' };
  if (/\bafternoon\b/.test(lower)) return { hour: 14, minute: 0, label: '2:00 PM (afternoon)' };
  if (/\bevening\b/.test(lower)) return { hour: 18, minute: 0, label: '6:00 PM (evening)' };

  return null;
}

function parseVenueFromQuery(text) {
  const lower = text.toLowerCase();
  return CAMPUS_VENUES.find((v) => lower.includes(v.toLowerCase())) || null;
}

function sameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export async function answerCoordinatorQuestion(message) {
  const query = String(message || '').trim();
  if (!query) {
    return {
      reply: 'Ask me about event clashes on a specific day/time, club health, volunteer availability, or pending proposals.',
      intent: 'empty',
      confidence: 100,
      aiModel: 'local',
      facts: [],
    };
  }

  const [clubs, events, volunteers, decisions, participantCount] = await Promise.all([
    Club.find({}).lean(),
    Event.find({}).populate('clubId', 'name category').populate('collaboratingClubIds', 'name').lean(),
    Volunteer.find({}).populate('assignedEventIds', 'title startAt endAt venue').lean(),
    DecisionLog.find({}).sort({ createdAt: -1 }).lean(),
    EventParticipant.countDocuments({}),
  ]);

  const scheduled = events.filter((e) => e.status === 'scheduled');
  const clashResult = detectClashes(scheduled);
  const healthReports = evaluateClubHealth(clubs, events);
  const volunteerMatches = matchVolunteersForEvents(scheduled, volunteers);

  const parsedDate = parseDateFromQuery(query);
  const parsedTime = parseTimeFromQuery(query);
  const parsedVenue = parseVenueFromQuery(query);
  const mentionedClub = clubs.find((c) => query.toLowerCase().includes(c.name.toLowerCase()));
  const mentionedVolunteer = volunteers.find((v) => query.toLowerCase().includes(v.name.toLowerCase()));

  // Classify intent using perplexity/pplx-decider-flash-v1.3:free
  const aiIntent = await runTypedDecision({
    state: [
      `User question: "${query}"`,
      `Extracted entities: date=${parsedDate ? parsedDate.toDateString() : 'none'}, time=${parsedTime ? parsedTime.label : 'none'}, venue=${parsedVenue || 'none'}, club=${mentionedClub?.name || 'none'}, volunteer=${mentionedVolunteer?.name || 'none'}.`,
      `Campus telemetry: ${scheduled.length} scheduled events, ${clashResult.clashes.length} active clashes, ${healthReports.filter((h) => h.isQuiet).length} quiet club(s), ${volunteerMatches.length} open volunteer roles.`,
    ],
    questions: {
      intent: {
        type: 'choice',
        instructions: 'Which coordinator query intent best matches the user question?',
        criteria: {
          clash_check: 'Asking if there is an event clash, overlap, free slot, or venue conflict at a day/time or across campus',
          schedule_lookup: 'Asking what events are happening on a date, at a venue, or for a specific club',
          club_health: 'Asking about quiet, inactive, or declining clubs or club health scores',
          volunteer_match: 'Asking about volunteer availability, overload, or best person for a role',
          proposals_status: 'Asking about pending approvals, collaborations, or past event report/turnout',
        },
      },
    },
    fallbackAnswers: {
      intent: {
        type: 'choice',
        choice: /clash|conflict|overlap|free|book|available/i.test(query)
          ? 'clash_check'
          : /quiet|health|inactive|dying|reviv|astro/i.test(query)
          ? 'club_health'
          : /volunteer|photo|photographer|desk|assign|overload/i.test(query)
          ? 'volunteer_match'
          : /pending|proposal|collab|merge|report|ecohack|turnout/i.test(query)
          ? 'proposals_status'
          : 'schedule_lookup',
        confidence: 0.9,
      },
    },
  });

  // Deterministic override when user explicitly asks about clash/time/venue or a specific volunteer/quiet club
  let intent = aiIntent.answers?.intent?.choice || 'schedule_lookup';
  if (/clash|conflict|overlap|double.?book|free/i.test(query) && !mentionedVolunteer) {
    intent = 'clash_check';
  } else if (/quiet|dying|inactive|losing members|health/i.test(query)) {
    intent = 'club_health';
  } else if (mentionedVolunteer || /volunteer|photographer|registration desk|overload/i.test(query)) {
    intent = 'volunteer_match';
  } else if (parsedDate && !/clash|conflict/i.test(query) && !mentionedClub) {
    intent = 'schedule_lookup';
  }

  const confidence = Math.round((aiIntent.answers?.intent?.confidence ?? 0.9) * 100);
  const aiModel = aiIntent.model;

  // ── 1. CLASH CHECK (supports specific day, time, and/or venue!) ─────────────
  if (intent === 'clash_check') {
    if (parsedDate) {
      const dateStr = parsedDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      let slotStart = new Date(parsedDate);
      let slotEnd = new Date(parsedDate);

      if (parsedTime) {
        slotStart.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
        slotEnd = new Date(slotStart.getTime() + 2 * 60 * 60 * 1000);
      } else {
        slotStart.setHours(0, 0, 0, 0);
        slotEnd.setHours(23, 59, 59, 999);
      }

      const overlappingEvents = scheduled.filter((ev) => {
        if (!sameDay(ev.startAt, parsedDate)) return false;
        const timeMatch = parsedTime ? intervalsOverlap(slotStart, slotEnd, ev.startAt, ev.endAt) : true;
        const venueMatch = parsedVenue ? normalizeVenue(ev.venue) === normalizeVenue(parsedVenue) : true;
        return timeMatch && venueMatch;
      });

      const dayClashes = clashResult.clashes.filter(
        (c) =>
          sameDay(c.eventA.startAt, parsedDate) &&
          (!parsedVenue || normalizeVenue(c.venue) === normalizeVenue(parsedVenue)) &&
          (!parsedTime || intervalsOverlap(slotStart, slotEnd, c.eventA.startAt, c.eventA.endAt))
      );

      if (dayClashes.length > 0) {
        const lines = dayClashes.map(
          (c) =>
            `• ${c.eventA.clubName} ("${c.eventA.title}") vs ${c.eventB.clubName} ("${c.eventB.title}") at ${c.venue} (${c.eventA.windowLabel}). Suggested fix: move "${c.eventB.title}" to ${c.proposedSlot.venue} on ${c.proposedSlot.windowLabel}.`
        );
        return {
          intent,
          confidence,
          aiModel,
          reply: `Yes — I found ${dayClashes.length} active scheduling clash(es) on ${dateStr}${parsedTime ? ` around ${parsedTime.label}` : ''}${parsedVenue ? ` at ${parsedVenue}` : ''}:\n\n${lines.join('\n')}`,
          facts: overlappingEvents.map((e) => ({
            title: e.title,
            subtitle: `${e.clubId?.name || 'Club'} · ${e.venue}`,
            meta: formatWindow(e.startAt, e.endAt),
          })),
        };
      }

      if (overlappingEvents.length > 0) {
        const freeAlt = findNearestFreeSlot(
          {
            _id: 'probe',
            clubId: clubs[0]?._id,
            venue: parsedVenue || overlappingEvents[0].venue,
            startAt: slotStart,
            endAt: slotEnd,
          },
          scheduled
        );
        return {
          intent,
          confidence,
          aiModel,
          reply: `There is no existing multi-club clash right now, but ${overlappingEvents.length} event(s) already occupy ${parsedVenue || 'that window'} on ${dateStr}${parsedTime ? ` (${parsedTime.label})` : ''}. Scheduling another event there would create a clash — nearest conflict-free alternative: ${freeAlt.venue} on ${freeAlt.windowLabel}.`,
          facts: overlappingEvents.map((e) => ({
            title: e.title,
            subtitle: `${e.clubId?.name || 'Club'} · ${e.venue}`,
            meta: formatWindow(e.startAt, e.endAt),
          })),
        };
      }

      return {
        intent,
        confidence,
        aiModel,
        reply: `No clashes found! ${parsedVenue || 'All campus venues'} ${parsedTime ? `at ${parsedTime.label}` : ''} on ${dateStr} is completely free.`,
        facts: [],
      };
    }

    // General clash overview
    if (clashResult.clashes.length === 0) {
      return {
        intent,
        confidence,
        aiModel,
        reply: 'Zero scheduling clashes across all currently scheduled campus events.',
        facts: [],
      };
    }

    return {
      intent,
      confidence,
      aiModel,
      reply: `There are currently ${clashResult.clashes.length} active clashes across the shared calendar:\n\n${clashResult.clashes
        .map(
          (c, i) =>
            `${i + 1}. ${c.eventA.clubName} ("${c.eventA.title}") vs ${c.eventB.clubName} ("${c.eventB.title}") — ${c.venue}, ${c.eventA.windowLabel}.`
        )
        .join('\n')}\n\nYou can approve the fixes in the Agent Proposals tab.`,
      facts: clashResult.clashes.map((c) => ({
        title: `${c.eventA.clubName} vs ${c.eventB.clubName}`,
        subtitle: c.venue,
        meta: c.eventA.windowLabel,
      })),
    };
  }

  // ── 2. CLUB HEALTH / QUIET CLUBS ───────────────────────────────────────────
  if (intent === 'club_health') {
    if (mentionedClub) {
      const hr = healthReports.find((h) => h.clubId === String(mentionedClub._id));
      return {
        intent,
        confidence,
        aiModel,
        reply: hr
          ? `${hr.clubName} has a health score of ${hr.healthScore}/100 (${hr.isQuiet ? 'FLAGGED QUIET' : 'Healthy'}). Last event was ${hr.daysSinceLastEvent} days ago, membership trend is ${hr.memberTrendLabel}, and ${hr.postsLast30Days} posts in the last 30 days.`
          : `${mentionedClub.name} telemetry loaded.`,
        facts: hr
          ? [{ title: `${hr.clubName} (${hr.isQuiet ? 'Quiet' : 'Healthy'})`, subtitle: `Score: ${hr.healthScore}/100`, meta: hr.memberTrendLabel }]
          : [],
      };
    }

    const quiet = healthReports.filter((h) => h.isQuiet);
    if (quiet.length === 0) {
      return {
        intent,
        confidence,
        aiModel,
        reply: `All ${clubs.length} clubs are currently healthy with active events within the 60-day threshold.`,
        facts: [],
      };
    }

    return {
      intent,
      confidence,
      aiModel,
      reply: `${quiet.length} club(s) flagged Quiet: ${quiet
        .map((q) => `${q.clubName} (${q.healthScore}/100 — last event ${q.daysSinceLastEvent}d ago, members ${q.memberTrendLabel}, ${q.postsLast30Days} posts in 30d)`)
        .join('; ')}. A joint Stargazing Night revival plan with Shutterbug is ready in Agent Proposals.`,
      facts: quiet.map((q) => ({
        title: `${q.clubName} — Quiet`,
        subtitle: `Health ${q.healthScore}/100 · ${q.daysSinceLastEvent}d inactive`,
        meta: `Members ${q.memberTrendLabel}`,
      })),
    };
  }

  // ── 3. VOLUNTEER MATCH / AVAILABILITY ──────────────────────────────────────
  if (intent === 'volunteer_match') {
    if (mentionedVolunteer) {
      const assigned = (mentionedVolunteer.assignedEventIds || []).map((e) => e.title || 'Event');
      return {
        intent,
        confidence,
        aiModel,
        reply: `${mentionedVolunteer.name} (${mentionedVolunteer.department}, ${mentionedVolunteer.year}) has skills [${mentionedVolunteer.skills.join(', ')}]. ${
          assigned.length > 0
            ? `Currently assigned to: ${assigned.join(', ')} (note: overlapping events trigger a -40 overload penalty).`
            : 'Currently has zero conflicting assignments.'
        }`,
        facts: [
          {
            title: mentionedVolunteer.name,
            subtitle: mentionedVolunteer.skills.join(', '),
            meta: assigned.length > 0 ? `Assigned: ${assigned.join(', ')}` : 'Available',
          },
        ],
      };
    }

    if (volunteerMatches.length === 0) {
      return {
        intent,
        confidence,
        aiModel,
        reply: 'All open event volunteer roles are currently filled.',
        facts: [],
      };
    }

    return {
      intent,
      confidence,
      aiModel,
      reply: `There are ${volunteerMatches.length} open volunteer role(s):\n\n${volunteerMatches
        .map((rm) => {
          const top = rm.recommended;
          const overloaded = rm.candidates.find((c) => c.hasConflict);
          return `• ${rm.roleTitle} (${rm.eventTitle}): Best fit is ${top?.name || 'None'} (${top?.score || 0} pts).${
            overloaded ? ` Overloaded candidate caught: ${overloaded.name} (-40, assigned to "${overloaded.conflictingEventTitle}").` : ''
          }`;
        })
        .join('\n')}`,
      facts: volunteerMatches.map((rm) => ({
        title: `${rm.roleTitle} → ${rm.recommended?.name || 'Unmatched'}`,
        subtitle: rm.eventTitle,
        meta: `${rm.recommended?.score || 0} pts`,
      })),
    };
  }

  // ── 4. PROPOSALS / COLLABORATION / REPORTS STATUS ──────────────────────────
  if (intent === 'proposals_status') {
    const pending = decisions.filter((d) => d.status === 'proposed');
    const completedEvents = events.filter((e) => e.status === 'completed');
    return {
      intent,
      confidence,
      aiModel,
      reply: `There are ${pending.length} pending agent proposal(s) awaiting approval (${decisions.filter((d) => d.status === 'approved').length} approved, ${decisions.filter((d) => d.status === 'rejected').length} rejected), and ${completedEvents.length} completed event(s) with ${participantCount} verified participant row(s) ready for reporting.`,
      facts: pending.slice(0, 4).map((p) => ({
        title: p.title,
        subtitle: p.agentModule.toUpperCase(),
        meta: 'Pending approval',
      })),
    };
  }

  // ── 5. SCHEDULE LOOKUP (date / venue / club) ───────────────────────────────
  const matchedEvents = scheduled.filter((ev) => {
    if (parsedDate && !sameDay(ev.startAt, parsedDate)) return false;
    if (parsedVenue && normalizeVenue(ev.venue) !== normalizeVenue(parsedVenue)) return false;
    if (mentionedClub) {
      const cid = String(ev.clubId?._id || ev.clubId);
      const collabs = (ev.collaboratingClubIds || []).map((c) => String(c._id || c));
      if (cid !== String(mentionedClub._id) && !collabs.includes(String(mentionedClub._id))) return false;
    }
    if (parsedTime) {
      const probeStart = new Date(ev.startAt);
      probeStart.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
      const probeEnd = new Date(probeStart.getTime() + 60 * 60 * 1000);
      if (!intervalsOverlap(probeStart, probeEnd, ev.startAt, ev.endAt)) return false;
    }
    return true;
  });

  if (parsedDate || parsedVenue || mentionedClub || parsedTime) {
    if (matchedEvents.length === 0) {
      return {
        intent,
        confidence,
        aiModel,
        reply: `No scheduled events match your filter${parsedDate ? ` on ${parsedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` : ''}${parsedVenue ? ` at ${parsedVenue}` : ''}${mentionedClub ? ` for ${mentionedClub.name}` : ''}.`,
        facts: [],
      };
    }

    return {
      intent,
      confidence,
      aiModel,
      reply: `Found ${matchedEvents.length} scheduled event(s)${mentionedClub ? ` for ${mentionedClub.name}` : ''}${parsedDate ? ` on ${parsedDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}` : ''}${parsedVenue ? ` at ${parsedVenue}` : ''}:`,
      facts: matchedEvents.slice(0, 6).map((e) => ({
        title: e.title,
        subtitle: `${e.clubId?.name || 'Club'} · ${e.venue}`,
        meta: formatWindow(e.startAt, e.endAt),
      })),
    };
  }

  return {
    intent,
    confidence,
    aiModel,
    reply: `Campus overview: ${clubs.length} clubs, ${scheduled.length} scheduled events, ${clashResult.clashes.length} active clashes, ${healthReports.filter((h) => h.isQuiet).length} quiet club (${healthReports.find((h) => h.isQuiet)?.clubName || 'none'}), and ${volunteerMatches.length} open volunteer role(s). Try asking: "Is there any clash tomorrow at 10 AM in Seminar Hall A?"`,
    facts: [],
  };
}
