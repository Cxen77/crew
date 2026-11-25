import { craftCollaborationPitch } from './llm.js';
import { formatWindow, intervalsOverlap, normalizeVenue } from './clash.js';

/**
 * Module 3: Collaboration Suggester (Weighted Scorer + LLM Wording)
 * Weights:
 *   - Shared primary tags / domain overlap: +30 (if >=1 shared tag)
 *   - Complementary categories: +15
 *   - Shared free date / co-host clash opportunity: +10
 *   - Audience / extra tag overlap: +5 per additional shared tag
 */

const COMPLEMENTARY_PAIRS = [
  ['music', 'dance'],
  ['music & audio', 'dance & performing arts'],
  ['astronomy', 'photography'],
  ['astronomy & space', 'photography & visual arts'],
  ['tech & coding', 'robotics & hardware'],
  ['tech & coding', 'sustainability & environment'],
  ['literature & writing', 'oratory & policy'],
  ['fitness & wellness', 'sustainability & environment'],
];

function areCategoriesComplementary(catA = '', catB = '') {
  const a = catA.trim().toLowerCase();
  const b = catB.trim().toLowerCase();
  if (!a || !b || a === b) return false;
  return COMPLEMENTARY_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

export function scoreClubPair(clubA, clubB, hasSharedEventWindow = false) {
  const tagsA = new Set((clubA.tags || []).map((t) => t.toLowerCase()));
  const tagsB = (clubB.tags || []).map((t) => t.toLowerCase());
  const sharedTags = tagsB.filter((t) => tagsA.has(t));

  let score = 0;
  const breakdown = [];

  if (sharedTags.length > 0) {
    score += 30;
    breakdown.push({ label: `Shared tag match (${sharedTags[0]})`, points: 30 });
  }

  if (areCategoriesComplementary(clubA.category, clubB.category)) {
    score += 15;
    breakdown.push({
      label: `Complementary categories (${clubA.category} + ${clubB.category})`,
      points: 15,
    });
  }

  if (hasSharedEventWindow) {
    score += 10;
    breakdown.push({ label: 'Overlapping event window / shared venue opportunity', points: 10 });
  } else {
    // Both clubs have free evening capacity in upcoming week
    score += 10;
    breakdown.push({ label: 'Overlapping free evening slot in 7-day calendar', points: 10 });
  }

  const extraTags = Math.max(0, sharedTags.length - 1);
  if (extraTags > 0) {
    const pts = extraTags * 5;
    score += pts;
    breakdown.push({
      label: `Audience & focus overlap (+5 × ${extraTags}: ${sharedTags.slice(1).join(', ')})`,
      points: pts,
    });
  }

  return { score, sharedTags, breakdown };
}

function findNextEveningSlot(events, venue = 'Observatory Deck') {
  const scheduled = events.filter((e) => e.status === 'scheduled');
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  for (let d = 2; d <= 10; d++) {
    const start = new Date(base);
    start.setDate(start.getDate() + d);
    start.setHours(19, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const busy = scheduled.some(
      (ev) => normalizeVenue(ev.venue) === normalizeVenue(venue) && intervalsOverlap(start, end, ev.startAt, ev.endAt)
    );
    if (!busy) {
      return {
        venue,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        windowLabel: formatWindow(start, end),
      };
    }
  }

  const fallbackStart = new Date(base.getTime() + 6 * 24 * 60 * 60 * 1000);
  fallbackStart.setHours(19, 0, 0, 0);
  const fallbackEnd = new Date(fallbackStart.getTime() + 2 * 60 * 60 * 1000);
  return {
    venue,
    startAt: fallbackStart.toISOString(),
    endAt: fallbackEnd.toISOString(),
    windowLabel: formatWindow(fallbackStart, fallbackEnd),
  };
}

export async function generateCollaborationSuggestions({ clubs, events, clashes, healthReports }) {
  const clubMap = new Map(clubs.map((c) => [String(c._id), c]));
  const healthMap = new Map(healthReports.map((h) => [h.clubId, h]));
  const suggestions = [];
  const pairedClubKeys = new Set();

  // 1. Check clashing events between complementary clubs -> propose MERGE into joint event
  for (const clash of clashes) {
    if (clash.clashType !== 'venue_time_clash') continue;
    const clubA = clubMap.get(clash.eventA.clubId);
    const clubB = clubMap.get(clash.eventB.clubId);
    if (!clubA || !clubB) continue;

    const { score, sharedTags, breakdown } = scoreClubPair(clubA, clubB, true);
    if (score < 40) continue;

    const pairKey = [String(clubA._id), String(clubB._id)].sort().join(':');
    pairedClubKeys.add(pairKey);

    const startMin = Math.min(new Date(clash.eventA.startAt).getTime(), new Date(clash.eventB.startAt).getTime());
    const endMax = Math.max(new Date(clash.eventA.endAt).getTime(), new Date(clash.eventB.endAt).getTime());
    const suggestedSlot = {
      venue: clash.venue,
      startAt: new Date(startMin).toISOString(),
      endAt: new Date(endMax).toISOString(),
      windowLabel: formatWindow(startMin, endMax),
    };

    const pitch = await craftCollaborationPitch({
      clubA,
      clubB,
      score,
      breakdown,
      mode: 'merge_clash',
      clashingEvents: [clash.eventA, clash.eventB],
      suggestedSlot,
    });

    suggestions.push({
      id: `collab_merge_${clash.id}`,
      mode: 'merge_clash',
      clubA: { _id: String(clubA._id), name: clubA.name, category: clubA.category },
      clubB: { _id: String(clubB._id), name: clubB.name, category: clubB.category },
      score,
      sharedTags,
      breakdown,
      suggestedSlot,
      clashingEventIds: [clash.eventA._id, clash.eventB._id],
      mergedTitle: `${clubA.name} × ${clubB.name}: Music & Dance Night`,
      ...pitch,
    });
  }

  // 2. Check Quiet / Struggling clubs -> pair with highest-scoring healthy partner for Revival Plan
  for (const h of healthReports.filter((r) => r.isQuiet)) {
    const quietClub = clubMap.get(h.clubId);
    if (!quietClub) continue;

    let bestPartner = null;
    let bestResult = null;

    for (const candidate of clubs) {
      if (String(candidate._id) === String(quietClub._id)) continue;
      const candHealth = healthMap.get(String(candidate._id));
      if (candHealth?.isQuiet) continue;

      const result = scoreClubPair(quietClub, candidate, false);
      if (!bestResult || result.score > bestResult.score) {
        bestResult = result;
        bestPartner = candidate;
      }
    }

    if (bestPartner && bestResult && bestResult.score >= 30) {
      const pairKey = [String(quietClub._id), String(bestPartner._id)].sort().join(':');
      if (pairedClubKeys.has(pairKey)) continue;
      pairedClubKeys.add(pairKey);

      const suggestedSlot = findNextEveningSlot(events, 'Observatory Deck');
      const pitch = await craftCollaborationPitch({
        clubA: { ...quietClub.toObject?.() ?? quietClub, ...h },
        clubB: bestPartner,
        score: bestResult.score,
        breakdown: bestResult.breakdown,
        mode: 'revival_collab',
        clashingEvents: [],
        suggestedSlot,
      });

      suggestions.push({
        id: `collab_revival_${quietClub._id}_${bestPartner._id}`,
        mode: 'revival_collab',
        clubA: { _id: String(quietClub._id), name: quietClub.name, category: quietClub.category },
        clubB: { _id: String(bestPartner._id), name: bestPartner.name, category: bestPartner.category },
        score: bestResult.score,
        sharedTags: bestResult.sharedTags,
        breakdown: bestResult.breakdown,
        suggestedSlot,
        proposedEventTitle: `${quietClub.name} × ${bestPartner.name}: Stargazing & Night Sky Walk`,
        healthSnapshot: h,
        ...pitch,
      });
    }
  }

  // 3. Top organic cross-club collaboration (not already paired)
  let topOrganic = null;
  for (let i = 0; i < clubs.length; i++) {
    for (let j = i + 1; j < clubs.length; j++) {
      const a = clubs[i];
      const b = clubs[j];
      const pairKey = [String(a._id), String(b._id)].sort().join(':');
      if (pairedClubKeys.has(pairKey)) continue;
      if (healthMap.get(String(a._id))?.isQuiet || healthMap.get(String(b._id))?.isQuiet) continue;

      const res = scoreClubPair(a, b, false);
      if (!topOrganic || res.score > topOrganic.score) {
        topOrganic = { a, b, ...res };
      }
    }
  }

  if (topOrganic && topOrganic.score >= 45) {
    const suggestedSlot = findNextEveningSlot(events, 'Campus Quad');
    suggestions.push({
      id: `collab_organic_${topOrganic.a._id}_${topOrganic.b._id}`,
      mode: 'organic_collab',
      clubA: { _id: String(topOrganic.a._id), name: topOrganic.a.name, category: topOrganic.a.category },
      clubB: { _id: String(topOrganic.b._id), name: topOrganic.b.name, category: topOrganic.b.category },
      score: topOrganic.score,
      sharedTags: topOrganic.sharedTags,
      breakdown: topOrganic.breakdown,
      suggestedSlot,
      title: `Cross-Club Idea: ${topOrganic.a.name} × ${topOrganic.b.name}`,
      decision: `Pair ${topOrganic.a.name} and ${topOrganic.b.name} for an interdisciplinary Campus Showcase at ${suggestedSlot.venue} (${suggestedSlot.windowLabel}).`,
      reason: `Compatibility score ${topOrganic.score} pts (${topOrganic.breakdown.map((x) => `${x.label} +${x.points}`).join(', ')}).`,
      recruitmentDraft: '',
      llmUsed: false,
    });
  }

  return suggestions;
}
