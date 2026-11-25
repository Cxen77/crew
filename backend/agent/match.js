import { intervalsOverlap, formatWindow } from './clash.js';

/**
 * Module 4: Volunteer Matcher (Rules Score + Clash Overload Reuse)
 * Scores volunteers against event openRoles:
 *   +5 per matching skill
 *   +15 availability fit (volunteer has a window covering [startAt, endAt))
 *   -40 overload/clash penalty (volunteer is already assigned to another overlapping event)
 */

export function matchVolunteersForEvents(events, volunteers) {
  const scheduledEvents = events.filter((e) => e.status === 'scheduled');
  const eventById = new Map(scheduledEvents.map((e) => [String(e._id), e]));
  const roleMatches = [];

  for (const event of scheduledEvents) {
    const openRoles = (event.openRoles || []).filter((r) => r.isOpen && r.filledCount < r.vacancies);
    if (openRoles.length === 0) continue;

    for (const role of openRoles) {
      const reqSkills = new Set((role.requiredSkills || []).map((s) => s.toLowerCase().trim()));

      const candidates = volunteers
        .map((vol) => {
          const volSkills = (vol.skills || []).map((s) => s.toLowerCase().trim());
          const matchedSkills = volSkills.filter((s) => reqSkills.has(s));

          // Availability window fit
          const isAvailable = (vol.availability || []).some((win) => {
            const wStart = new Date(win.startAt).getTime();
            const wEnd = new Date(win.endAt).getTime();
            const evStart = new Date(event.startAt).getTime();
            const evEnd = new Date(event.endAt).getTime();
            return wStart <= evStart && wEnd >= evEnd;
          });

          // Reuse Module 1 overlap check for volunteer double-booking / overload
          const assignedIds = (vol.assignedEventIds || []).map((id) => String(id?._id || id));
          const alreadyAssignedHere = assignedIds.includes(String(event._id));
          const conflictingEvent = assignedIds
            .filter((id) => id !== String(event._id))
            .map((id) => eventById.get(id))
            .find((otherEv) => otherEv && intervalsOverlap(event.startAt, event.endAt, otherEv.startAt, otherEv.endAt));

          let score = 0;
          const breakdown = [];

          if (matchedSkills.length > 0) {
            const skillPts = matchedSkills.length * 5;
            score += skillPts;
            breakdown.push({
              label: `Skill match (+5 × ${matchedSkills.length}: ${matchedSkills.join(', ')})`,
              points: skillPts,
            });
          }

          if (isAvailable) {
            score += 15;
            breakdown.push({ label: 'Available during event window', points: 15 });
          } else {
            breakdown.push({ label: 'No matching availability window', points: 0 });
          }

          if (conflictingEvent) {
            score -= 40;
            breakdown.push({
              label: `Overload clash: assigned to "${conflictingEvent.title}"`,
              points: -40,
            });
          }

          if (alreadyAssignedHere) {
            score -= 50;
            breakdown.push({ label: 'Already assigned to this event', points: -50 });
          }

          const reason = conflictingEvent
            ? `${vol.name} matches ${matchedSkills.length}/${reqSkills.size} skills (${matchedSkills.join(', ')}) but is OVERLOADED (-40): already assigned to "${conflictingEvent.title}" (${formatWindow(conflictingEvent.startAt, conflictingEvent.endAt)}).`
            : `${vol.name} fits "${role.title}" with ${matchedSkills.length}/${reqSkills.size} matching skills (${matchedSkills.join(', ') || 'general'})${isAvailable ? ' and free availability' : ''}. Score: ${score}.`;

          return {
            volunteerId: String(vol._id),
            name: vol.name,
            email: vol.email,
            department: vol.department,
            year: vol.year,
            skills: vol.skills,
            matchedSkills,
            isAvailable,
            hasConflict: Boolean(conflictingEvent),
            conflictingEventTitle: conflictingEvent?.title || null,
            alreadyAssignedHere,
            score,
            breakdown,
            reason,
          };
        })
        .filter((c) => c.matchedSkills.length > 0 && !c.alreadyAssignedHere)
        .sort((a, b) => b.score - a.score);

      const recommended = candidates.find((c) => !c.hasConflict && c.score > 0) || candidates[0] || null;

      roleMatches.push({
        eventId: String(event._id),
        eventTitle: event.title,
        clubName: event.clubId?.name || 'Club',
        venue: event.venue,
        windowLabel: formatWindow(event.startAt, event.endAt),
        roleId: String(role._id),
        roleTitle: role.title,
        requiredSkills: role.requiredSkills,
        vacanciesRemaining: role.vacancies - role.filledCount,
        recommended,
        candidates: candidates.slice(0, 5),
      });
    }
  }

  return roleMatches;
}
