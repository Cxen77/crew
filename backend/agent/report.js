import Event from '../models/Event.js';
import EventParticipant from '../models/EventParticipant.js';
import { formatWindow } from './clash.js';
import { generateGroundedEventReport } from './llm.js';

/**
 * Module 5: Report Generator
 * Aggregates real EventParticipant registration & attendance rows (never invented by LLM),
 * then passes verified counts to llm.js for plain-language narrative formatting.
 */

export async function buildParticipantReportData(eventId) {
  const event = await Event.findById(eventId).populate('clubId', 'name category').lean();
  if (!event) {
    const err = new Error('Event not found');
    err.statusCode = 404;
    throw err;
  }

  const rows = await EventParticipant.find({ eventId }).sort({ registrationType: 1, participantName: 1 }).lean();

  const totalRegistered = rows.length;
  const attended = rows.filter((r) => r.attended).length;
  const absent = totalRegistered - attended;
  const solo = rows.filter((r) => r.registrationType === 'solo').length;
  const preTeamParticipants = rows.filter((r) => r.registrationType === 'pre').length;
  const autoTeamParticipants = rows.filter((r) => r.registrationType === 'auto').length;

  const teamMap = new Map();
  for (const row of rows) {
    if (row.registrationType === 'solo' || !row.teamName) continue;
    const existing = teamMap.get(row.teamName) || {
      teamName: row.teamName,
      type: row.registrationType,
      size: 0,
      attended: 0,
    };
    existing.size += 1;
    if (row.attended) existing.attended += 1;
    teamMap.set(row.teamName, existing);
  }

  const teamsSummary = Array.from(teamMap.values());
  const attendanceRate = totalRegistered > 0 ? Number(((attended / totalRegistered) * 100).toFixed(1)) : 0;

  return {
    event: {
      _id: String(event._id),
      title: event.title,
      description: event.description,
      clubName: event.clubId?.name || 'Campus Club',
      category: event.category,
      venue: event.venue,
      dateLabel: formatWindow(event.startAt, event.endAt),
      status: event.status,
      generatedReport: event.generatedReport || '',
      reportGeneratedAt: event.reportGeneratedAt || null,
    },
    totals: {
      totalRegistered,
      attended,
      absent,
      attendanceRate,
      solo,
      preTeamParticipants,
      autoTeamParticipants,
      teams: teamsSummary.length,
    },
    teamsSummary,
    participants: rows,
  };
}

export async function generateEventReport(eventId) {
  const data = await buildParticipantReportData(eventId);
  const llmResult = await generateGroundedEventReport({
    event: data.event,
    totals: data.totals,
    teamsSummary: data.teamsSummary,
  });

  await Event.findByIdAndUpdate(eventId, {
    generatedReport: llmResult.text,
    reportGeneratedAt: new Date(),
  });

  return {
    ...data,
    reportMarkdown: llmResult.text,
    llmUsed: llmResult.llmUsed,
    provider: llmResult.provider,
    generatedAt: new Date().toISOString(),
  };
}
