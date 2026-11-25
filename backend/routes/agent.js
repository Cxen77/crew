import express from 'express';
import asyncHandler from 'express-async-handler';
import DecisionLog from '../models/DecisionLog.js';
import { getLLMStatus } from '../agent/llm.js';
import { runAgentCycle, senseCampusState, executeDecision } from '../agent/orchestrator.js';
import { generateCollaborationSuggestions } from '../agent/collaborate.js';
import { seedDatabase } from '../seed/seedDemoData.js';

const router = express.Router();

// GET /api/agent/status — live sense snapshot + LLM status + active counts
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const sensed = await senseCampusState();
    const collaborations = await generateCollaborationSuggestions({
      clubs: sensed.clubs,
      events: sensed.events,
      clashes: sensed.clashResult.clashes,
      healthReports: sensed.healthReports,
    });

    const [proposedCount, approvedCount, rejectedCount] = await Promise.all([
      DecisionLog.countDocuments({ status: 'proposed' }),
      DecisionLog.countDocuments({ status: 'approved' }),
      DecisionLog.countDocuments({ status: 'rejected' }),
    ]);

    res.json({
      llm: getLLMStatus(),
      counts: {
        clubs: sensed.clubs.length,
        scheduledEvents: sensed.events.filter((e) => e.status === 'scheduled').length,
        completedEvents: sensed.events.filter((e) => e.status === 'completed').length,
        clashes: sensed.clashResult.clashes.length,
        quietClubs: sensed.healthReports.filter((h) => h.isQuiet).length,
        openVolunteerRoles: sensed.volunteerMatches.length,
        proposedDecisions: proposedCount,
        approvedDecisions: approvedCount,
        rejectedDecisions: rejectedCount,
      },
      clashes: sensed.clashResult.clashes,
      clashingEventIds: sensed.clashResult.clashingEventIds,
      healthReports: sensed.healthReports,
      collaborations,
      volunteerMatches: sensed.volunteerMatches,
    });
  })
);

// POST /api/agent/run — trigger full Sense -> Think -> Act -> Explain cycle
router.post(
  '/run',
  asyncHandler(async (req, res) => {
    const result = await runAgentCycle();
    res.json(result);
  })
);

// GET /api/agent/decisions — fetch full DecisionLog audit trail
router.get(
  '/decisions',
  asyncHandler(async (req, res) => {
    const { status, module } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (module && module !== 'all') filter.agentModule = module;

    const decisions = await DecisionLog.find(filter).sort({ createdAt: -1 }).lean();
    res.json(decisions);
  })
);

// POST /api/agent/decisions/:id/decide — coordinator Approve or Reject
router.post(
  '/decisions/:id/decide',
  asyncHandler(async (req, res) => {
    const { action, decidedBy } = req.body;
    if (!['approved', 'rejected'].includes(action)) {
      res.status(400);
      throw new Error('Action must be "approved" or "rejected"');
    }

    const updated = await executeDecision(req.params.id, action, decidedBy || 'Campus Coordinator');
    res.json(updated);
  })
);

// POST /api/agent/reset-demo — restore clean planted hackathon scenario
router.post(
  '/reset-demo',
  asyncHandler(async (req, res) => {
    const summary = await seedDatabase({ runAgent: true });
    res.json({ message: 'Demo scenario reset and agent synced.', summary });
  })
);

export default router;
