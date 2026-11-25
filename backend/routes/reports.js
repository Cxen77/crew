import express from 'express';
import asyncHandler from 'express-async-handler';
import Event from '../models/Event.js';
import DecisionLog from '../models/DecisionLog.js';
import { buildParticipantReportData, generateEventReport } from '../agent/report.js';

const router = express.Router();

// GET /api/reports/events — list events available for reporting (completed first)
router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const events = await Event.find({ status: { $in: ['completed', 'scheduled'] } })
      .populate('clubId', 'name category')
      .sort({ status: 1, startAt: -1 })
      .lean();
    res.json(events);
  })
);

// GET /api/reports/:eventId — verified participant & attendance summary
router.get(
  '/:eventId',
  asyncHandler(async (req, res) => {
    const data = await buildParticipantReportData(req.params.eventId);
    res.json(data);
  })
);

// POST /api/reports/:eventId/generate — generate grounded AI report + log decision entry
router.post(
  '/:eventId/generate',
  asyncHandler(async (req, res) => {
    const result = await generateEventReport(req.params.eventId);

    await DecisionLog.create({
      proposalKey: `report:${req.params.eventId}:${Date.now()}`,
      agentModule: 'report',
      title: `Post-Event Report Generated: ${result.event.title}`,
      whatItSaw: result.totals,
      decision: `Compiled verified event report from ${result.totals.totalRegistered} registration(s) and ${result.totals.attended} attendance record(s) (${result.totals.attendanceRate}% turnout).`,
      reason: `All totals computed directly from database participant rows (${result.totals.preTeamParticipants} pre-team, ${result.totals.autoTeamParticipants} auto-team, ${result.totals.solo} solo) before narrative synthesis.`,
      scoreBreakdown: [
        { label: 'Total Registered', points: result.totals.totalRegistered },
        { label: 'Verified Attended', points: `${result.totals.attended} (${result.totals.attendanceRate}%)` },
        { label: 'Teams / Solo', points: `${result.totals.teams} teams / ${result.totals.solo} solo` },
      ],
      status: 'approved',
      llmUsed: result.llmUsed,
      decidedBy: 'Campus Coordinator',
      decidedAt: new Date(),
      executionNote: `Report generated via ${result.provider}.`,
    });

    res.json(result);
  })
);

// GET /api/reports/:eventId/csv — export verified participant attendance CSV
router.get(
  '/:eventId/csv',
  asyncHandler(async (req, res) => {
    const data = await buildParticipantReportData(req.params.eventId);
    const header = ['Name', 'Email', 'Department', 'Year', 'Registration Type', 'Team', 'Attended', 'Check-in Time'];
    const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const lines = [
      header.join(','),
      ...data.participants.map((p) =>
        [
          escapeCsv(p.participantName),
          escapeCsv(p.participantEmail),
          escapeCsv(p.department),
          escapeCsv(p.year),
          escapeCsv(p.registrationType),
          escapeCsv(p.teamName || 'Solo'),
          escapeCsv(p.attended ? 'Yes' : 'No'),
          escapeCsv(p.attendedAt ? new Date(p.attendedAt).toISOString() : ''),
        ].join(',')
      ),
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${data.event.title.replace(/[^a-z0-9]/gi, '_')}_attendance.csv"`);
    res.send(lines.join('\n'));
  })
);

export default router;
