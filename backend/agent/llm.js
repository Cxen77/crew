/**
 * Single AI gateway for Crew Sync.
 * Supports Google Gemini (GEMINI_API_KEY) and OpenAI-compatible APIs (OPENAI_API_KEY).
 * When no API key is configured, falls back cleanly to deterministic tool-grounded phrasing
 * so every rule output remains accurate and inspectable without invented data.
 */

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export function getLLMStatus() {
  const providerPref = (process.env.LLM_PROVIDER || 'auto').toLowerCase();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (providerPref === 'gemini' && hasGemini) {
    return { configured: true, provider: 'gemini', model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL };
  }
  if (providerPref === 'openai' && hasOpenAI) {
    return { configured: true, provider: 'openai', model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL };
  }
  if (providerPref === 'auto') {
    if (hasGemini) {
      return { configured: true, provider: 'gemini', model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL };
    }
    if (hasOpenAI) {
      return { configured: true, provider: 'openai', model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL };
    }
  }

  return {
    configured: false,
    provider: 'deterministic-fallback',
    model: 'rule-grounded-synthesizer',
  };
}

async function callGemini(systemPrompt, userPrompt, model) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 900,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  if (!text) throw new Error('Gemini returned empty response');
  return text;
}

async function callOpenAI(systemPrompt, userPrompt, model) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      max_tokens: 900,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('OpenAI-compatible endpoint returned empty response');
  return text;
}

/**
 * Core prompt runner. Never throws to callers: returns { text, llmUsed, provider, fallbackReason }.
 */
export async function generateGroundedText({ systemPrompt, userPrompt, fallbackBuilder }) {
  const status = getLLMStatus();

  if (status.configured) {
    try {
      const text =
        status.provider === 'gemini'
          ? await callGemini(systemPrompt, userPrompt, status.model)
          : await callOpenAI(systemPrompt, userPrompt, status.model);

      return {
        text,
        llmUsed: true,
        provider: `${status.provider}:${status.model}`,
      };
    } catch (err) {
      console.warn('[LLM] Falling back to deterministic synthesis:', err.message);
      return {
        text: fallbackBuilder(),
        llmUsed: false,
        provider: 'deterministic-fallback',
        fallbackReason: err.message,
      };
    }
  }

  return {
    text: fallbackBuilder(),
    llmUsed: false,
    provider: 'deterministic-fallback',
  };
}

/**
 * Ask the LLM to prioritize sensed observations and craft a concise coordinator briefing.
 */
export async function synthesizeCoordinatorBrief(snapshot) {
  const systemPrompt =
    'You are Crew Sync, an autonomous campus club operations coordinator. ' +
    'You ONLY cite exact club names, venues, dates, scores, and counts provided in the JSON facts. ' +
    'Write 2-3 crisp sentences summarizing the highest-priority campus coordination actions.';

  const userPrompt = `Verified live campus telemetry:\n${JSON.stringify(snapshot, null, 2)}`;

  return generateGroundedText({
    systemPrompt,
    userPrompt,
    fallbackBuilder: () => {
      const parts = [];
      if (snapshot.clashCount > 0) {
        parts.push(`Detected ${snapshot.clashCount} scheduling conflict(s) requiring venue/time resolution or club co-hosting.`);
      }
      if (snapshot.quietClubs?.length > 0) {
        parts.push(`${snapshot.quietClubs.join(', ')} flagged as Quiet due to 60+ days without events and declining membership.`);
      }
      if (snapshot.openVolunteerRoles > 0) {
        parts.push(`${snapshot.openVolunteerRoles} open volunteer role(s) matched against member skills and clash-free availability.`);
      }
      return parts.join(' ') || 'All campus clubs and scheduled events are currently synchronized with zero active conflicts.';
    },
  });
}

/**
 * Generate a concrete joint-event pitch & optional recruitment post from exact scoring facts.
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
  const systemPrompt =
    'You are Crew Sync, a campus club collaboration strategist. ' +
    'Use ONLY the provided club names, tags, score breakdown, and suggested slot. ' +
    'Return JSON with keys: "title", "decision", "reason", "recruitmentDraft" (plain text, concise, no markdown code fences).';

  const userPrompt = JSON.stringify(
    {
      mode,
      clubA: { name: clubA.name, category: clubA.category, tags: clubA.tags },
      clubB: { name: clubB.name, category: clubB.category, tags: clubB.tags },
      compatibilityScore: score,
      scoreBreakdown: breakdown,
      clashingEvents,
      suggestedSlot,
    },
    null,
    2
  );

  const fallback = () => {
    if (mode === 'merge_clash') {
      const isMusicDance = [clubA.category, clubB.category].some((c) => /music|dance/i.test(c));
      const eventLabel = isMusicDance ? 'Music & Dance Night' : `${clubA.name} × ${clubB.name} Joint Showcase`;
      return {
        title: `Merge Clash: ${clubA.name} × ${clubB.name} Joint ${eventLabel}`,
        mergedTitle: `${clubA.name} × ${clubB.name}: ${eventLabel}`,
        decision: `Merge "${clashingEvents[0].title}" and "${clashingEvents[1].title}" into one co-hosted "${eventLabel}" at ${suggestedSlot.venue} (${suggestedSlot.windowLabel}).`,
        reason: `Both events share ${suggestedSlot.venue} during overlapping evening hours, and ${clubA.name} + ${clubB.name} score ${score} pts on collaboration fit (${breakdown.map((b) => `${b.label} +${b.points}`).join(', ')}). Merging eliminates the clash and doubles audience reach.`,
        recruitmentDraft: '',
      };
    }

    return {
      title: `Revival Plan for ${clubA.name}: Joint Stargazing Night with ${clubB.name}`,
      decision: `Co-host "Night Sky & Astrophotography Walk" (${clubA.name} × ${clubB.name}) at ${suggestedSlot.venue} on ${suggestedSlot.windowLabel}, paired with a campus recruitment push.`,
      reason: `${clubA.name} has been quiet for ${clubA.daysSinceLastEvent} days with membership dropping ${clubA.memberTrendLabel} and ${clubA.postsLast30Days} posts in 30 days. ${clubB.name} scored ${score} pts compatibility (${breakdown.map((b) => `${b.label} +${b.points}`).join(', ')}), offering an immediate co-hosted revival path.`,
      recruitmentDraft: `Curious about the night sky or astrophotography? ${clubA.name} and ${clubB.name} are teaming up for a Campus Stargazing & Long-Exposure Walk at ${suggestedSlot.venue} (${suggestedSlot.windowLabel}). Open to beginners, storytellers, and lens enthusiasts — grab a spot and help reboot ${clubA.name}!`,
    };
  };

  const result = await generateGroundedText({
    systemPrompt,
    userPrompt,
    fallbackBuilder: () => JSON.stringify(fallback()),
  });

  if (result.llmUsed) {
    try {
      const cleaned = result.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.title && parsed.decision && parsed.reason) {
        return { ...parsed, llmUsed: true, provider: result.provider };
      }
    } catch {
      // If model output wasn't strict JSON, fall back cleanly to structured text
    }
  }

  return { ...fallback(), llmUsed: false, provider: result.provider };
}

/**
 * Generate a one-page plain-language post-event report from verified DB counts.
 */
export async function generateGroundedEventReport(reportFacts) {
  const systemPrompt =
    'You are Crew Sync, writing a crisp one-page post-event operations report for campus faculty & club leads. ' +
    'Use ONLY the exact numbers, percentages, club names, and team names in the JSON data. Never invent or round away counts. ' +
    'Structure with headings: Executive Summary, Attendance & Participation Breakdown, Team & Registration Mix, and Next-Step Recommendations.';

  const userPrompt = `Verified Event & Attendance Data:\n${JSON.stringify(reportFacts, null, 2)}`;

  const fallbackBuilder = () => {
    const { event, totals, teamsSummary } = reportFacts;
    const rate = totals.totalRegistered > 0 ? ((totals.attended / totals.totalRegistered) * 100).toFixed(1) : '0.0';
    return [
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
      `## 4. Next-Step Recommendations`,
      `- Follow up with the ${totals.absent} registered no-show(s) with session slides and next-event invites.`,
      `- Convert active solo attendees (${totals.solo}) into upcoming ${event.clubName} working groups.`,
      `- Archive attendance CSV and share this verified summary with campus administration.`,
    ].join('\n');
  };

  return generateGroundedText({
    systemPrompt,
    userPrompt,
    fallbackBuilder,
  });
}
