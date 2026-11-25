/**
 * Module 2: Club Health & Dead-Club Detector (Rules Engine)
 * Computes deterministic health score (0-100) per club using:
 *   - daysSinceLastEvent
 *   - memberTrend (latest vs earliest in memberCountHistory)
 *   - postsLast30Days
 * Flags Quiet when: no event in >= 60 days AND members falling.
 */

export function evaluateClubHealth(clubs, events = [], referenceDate = new Date()) {
  const nowMs = new Date(referenceDate).getTime();

  return clubs.map((club) => {
    // Determine latest completed or scheduled past event, or fallback to club.lastEventDate
    const clubEvents = events.filter(
      (ev) => String(ev.clubId?._id || ev.clubId) === String(club._id) && new Date(ev.startAt).getTime() <= nowMs
    );
    const latestFromEvents = clubEvents.reduce((latest, ev) => {
      const t = new Date(ev.startAt).getTime();
      return t > latest ? t : latest;
    }, 0);

    const lastEventMs = Math.max(
      latestFromEvents,
      club.lastEventDate ? new Date(club.lastEventDate).getTime() : 0
    );

    const daysSinceLastEvent =
      lastEventMs > 0 ? Math.max(0, Math.round((nowMs - lastEventMs) / (1000 * 60 * 60 * 24))) : 90;

    // Member trend from history
    const history = club.memberCountHistory || [];
    const startCount = history.length > 0 ? history[0].count : club.memberCount || 20;
    const endCount = history.length > 0 ? history[history.length - 1].count : club.memberCount || 20;
    const memberDelta = endCount - startCount;
    const memberTrendPct = startCount > 0 ? Number(((memberDelta / startCount) * 100).toFixed(1)) : 0;
    const membersFalling = memberDelta < 0;

    const posts = Number(club.postsLast30Days ?? 0);

    // Deterministic scoring out of 100
    let score = 100;
    if (daysSinceLastEvent >= 60) score -= 45;
    else if (daysSinceLastEvent >= 30) score -= 20;
    else if (daysSinceLastEvent >= 14) score -= 8;

    if (memberDelta < 0) {
      const dropPenalty = Math.min(35, Math.abs(memberTrendPct) * 0.6);
      score -= Math.round(dropPenalty);
    }

    if (posts === 0) score -= 20;
    else if (posts < 3) score -= 10;

    score = Math.max(0, Math.min(100, Math.round(score)));

    const isQuiet = daysSinceLastEvent >= 60 && membersFalling;
    const status = isQuiet ? 'quiet' : score < 65 ? 'watch' : 'healthy';

    return {
      clubId: String(club._id),
      clubName: club.name,
      category: club.category,
      tags: club.tags || [],
      daysSinceLastEvent,
      startMemberCount: startCount,
      currentMemberCount: endCount,
      memberDelta,
      memberTrendPct,
      memberTrendLabel: `${startCount} → ${endCount} (${memberTrendPct > 0 ? '+' : ''}${memberTrendPct}%)`,
      postsLast30Days: posts,
      healthScore: score,
      isQuiet,
      status,
      reason: isQuiet
        ? `${club.name} is flagged Quiet: last event was ${daysSinceLastEvent} days ago (≥ 60d threshold), membership dropped ${startCount} → ${endCount} (${memberTrendPct}%), and ${posts} posts in the last 30 days.`
        : `${club.name} health score ${score}/100: last event ${daysSinceLastEvent}d ago, membership ${startCount} → ${endCount}, ${posts} posts in 30d.`,
    };
  });
}
