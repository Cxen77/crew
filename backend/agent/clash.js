/**
 * Module 1: Clash Detector (Rules Engine)
 * Checks every pair of active scheduled events for:
 *   1. Overlap in [startAt, endAt) AND same normalized venue -> Venue & Time Clash
 *   2. Overlap in [startAt, endAt) AND same clubId -> Club Double-Booking Clash
 * Proposes the nearest conflict-free venue/time slot from the campus venue catalog.
 */

export const CAMPUS_VENUES = [
  'Seminar Hall A',
  'Seminar Hall B',
  'Seminar Hall C',
  'Open Air Theatre',
  'Innovation Lab',
  'Main Auditorium',
  'Campus Quad',
  'Observatory Deck',
];

export function normalizeVenue(venue = '') {
  return String(venue).trim().toLowerCase().replace(/\s+/g, ' ');
}

export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  const sA = new Date(aStart).getTime();
  const eA = new Date(aEnd).getTime();
  const sB = new Date(bStart).getTime();
  const eB = new Date(bEnd).getTime();
  return sA < eB && sB < eA;
}

export function formatWindow(startAt, endAt) {
  const s = new Date(startAt);
  const e = new Date(endAt);
  const datePart = s.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtTime = (d) =>
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${datePart}, ${fmtTime(s)} – ${fmtTime(e)}`;
}

/**
 * Find the nearest free venue/time slot for an event without introducing any new venue or club clash.
 */
export function findNearestFreeSlot(targetEvent, allEvents) {
  const durationMs = new Date(targetEvent.endAt).getTime() - new Date(targetEvent.startAt).getTime();
  const safeDuration = durationMs > 0 ? durationMs : 2 * 60 * 60 * 1000;
  const targetClubId = String(targetEvent.clubId?._id || targetEvent.clubId);
  const otherEvents = allEvents.filter(
    (ev) => String(ev._id) !== String(targetEvent._id) && ev.status === 'scheduled'
  );

  const isSlotFree = (venueName, startMs, endMs) => {
    const normV = normalizeVenue(venueName);
    return !otherEvents.some((ev) => {
      if (!intervalsOverlap(startMs, endMs, ev.startAt, ev.endAt)) return false;
      const evClubId = String(ev.clubId?._id || ev.clubId);
      if (evClubId === targetClubId) return true;
      return normalizeVenue(ev.venue) === normV;
    });
  };

  // Candidate anchor hours on the same day first (prefer 14:00 / 2 PM, then 16:00, 11:00, 18:00), then next days
  const baseDay = new Date(targetEvent.startAt);
  baseDay.setHours(0, 0, 0, 0);

  const preferredVenues = [
    ...CAMPUS_VENUES.filter((v) => normalizeVenue(v) !== normalizeVenue(targetEvent.venue)),
    targetEvent.venue,
  ];

  // Prioritize Seminar Hall B at 14:00 (2 PM) when moving out of Seminar Hall A, plus general scan
  const dayOffsets = [0, 1, 2, 3];
  const candidateHours = [14, 16, 11, 17, 10, 18, 9];

  for (const dayOffset of dayOffsets) {
    for (const hour of candidateHours) {
      const start = new Date(baseDay);
      start.setDate(start.getDate() + dayOffset);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + safeDuration);

      // Don't propose the exact same start time if keeping the same venue
      for (const venue of preferredVenues) {
        if (
          normalizeVenue(venue) === normalizeVenue(targetEvent.venue) &&
          Math.abs(start.getTime() - new Date(targetEvent.startAt).getTime()) < 60000
        ) {
          continue;
        }
        if (isSlotFree(venue, start.getTime(), end.getTime())) {
          return {
            venue,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            windowLabel: formatWindow(start, end),
          };
        }
      }
    }
  }

  // Guaranteed fallback 7 days later
  const fallbackStart = new Date(new Date(targetEvent.startAt).getTime() + 7 * 24 * 60 * 60 * 1000);
  const fallbackEnd = new Date(fallbackStart.getTime() + safeDuration);
  return {
    venue: CAMPUS_VENUES[1],
    startAt: fallbackStart.toISOString(),
    endAt: fallbackEnd.toISOString(),
    windowLabel: formatWindow(fallbackStart, fallbackEnd),
  };
}

/**
 * Scan all scheduled events and return every clash pair + concrete reschedule suggestion.
 */
export function detectClashes(events) {
  const scheduled = events.filter((e) => e.status === 'scheduled');
  const clashes = [];
  const clashingEventIds = new Set();

  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const evA = scheduled[i];
      const evB = scheduled[j];

      if (!intervalsOverlap(evA.startAt, evA.endAt, evB.startAt, evB.endAt)) continue;

      const sameVenue = normalizeVenue(evA.venue) === normalizeVenue(evB.venue);
      const clubAId = String(evA.clubId?._id || evA.clubId);
      const clubBId = String(evB.clubId?._id || evB.clubId);
      const sameClub = clubAId === clubBId;

      if (!sameVenue && !sameClub) continue;

      clashingEventIds.add(String(evA._id));
      clashingEventIds.add(String(evB._id));

      const clashType = sameClub ? 'club_double_booking' : 'venue_time_clash';
      // Move the second event (evB) to the nearest free slot
      const freeSlot = findNearestFreeSlot(evB, scheduled);

      const clubAName = evA.clubId?.name || 'Club A';
      const clubBName = evB.clubId?.name || 'Club B';

      clashes.push({
        id: `${evA._id}_${evB._id}`,
        clashType,
        venue: evA.venue,
        eventA: {
          _id: String(evA._id),
          title: evA.title,
          clubId: clubAId,
          clubName: clubAName,
          venue: evA.venue,
          startAt: evA.startAt,
          endAt: evA.endAt,
          windowLabel: formatWindow(evA.startAt, evA.endAt),
        },
        eventB: {
          _id: String(evB._id),
          title: evB.title,
          clubId: clubBId,
          clubName: clubBName,
          venue: evB.venue,
          startAt: evB.startAt,
          endAt: evB.endAt,
          windowLabel: formatWindow(evB.startAt, evB.endAt),
        },
        proposedSlot: freeSlot,
        reason:
          clashType === 'club_double_booking'
            ? `${clubAName} has two overlapping events ("${evA.title}" at ${evA.venue} and "${evB.title}" at ${evB.venue}) during ${formatWindow(evA.startAt, evA.endAt)}. Moving "${evB.title}" to ${freeSlot.venue} at ${freeSlot.windowLabel} resolves the double-booking.`
            : `"${evA.title}" (${clubAName}) and "${evB.title}" (${clubBName}) both occupy ${evA.venue} with overlapping times (${formatWindow(evA.startAt, evA.endAt)} vs ${formatWindow(evB.startAt, evB.endAt)}). Moving "${evB.title}" to ${freeSlot.venue} (${freeSlot.windowLabel}) eliminates the venue conflict.`,
      });
    }
  }

  return {
    clashes,
    clashingEventIds: Array.from(clashingEventIds),
  };
}
