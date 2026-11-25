import express from 'express';
import asyncHandler from 'express-async-handler';
import Event from '../models/Event.js';
import { detectClashes, CAMPUS_VENUES } from '../agent/clash.js';
import { runAgentCycle } from '../agent/orchestrator.js';

const router = express.Router();

// GET /api/events/venues — list normalized campus venues
router.get('/venues', (req, res) => {
  res.json(CAMPUS_VENUES);
});

// GET /api/events — list all events + annotated clash flags
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, clubId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (clubId) filter.$or = [{ clubId }, { collaboratingClubIds: clubId }];

    const events = await Event.find(filter)
      .populate('clubId', 'name category tags isQuiet')
      .populate('collaboratingClubIds', 'name category')
      .populate('openRoles.assignedVolunteerIds', 'name email department')
      .sort({ startAt: 1 })
      .lean();

    const allScheduled = await Event.find({ status: 'scheduled' }).populate('clubId', 'name').lean();
    const { clashes, clashingEventIds } = detectClashes(allScheduled);
    const clashSet = new Set(clashingEventIds);

    const enriched = events.map((ev) => ({
      ...ev,
      hasClash: clashSet.has(String(ev._id)),
      clashDetails: clashes.filter(
        (c) => c.eventA._id === String(ev._id) || c.eventB._id === String(ev._id)
      ),
    }));

    res.json({
      events: enriched,
      clashes,
      clashingEventIds,
    });
  })
);

// POST /api/events — create a new event and re-run agent sensing
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title, description, clubId, startAt, endAt, venue, category, tags, openRoles } = req.body;
    if (!title || !clubId || !startAt || !endAt || !venue || !category) {
      res.status(400);
      throw new Error('Missing required fields: title, clubId, startAt, endAt, venue, category');
    }

    const created = await Event.create({
      title,
      description: description || `${title} campus session.`,
      clubId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      venue,
      category,
      tags: Array.isArray(tags) ? tags : [],
      openRoles: Array.isArray(openRoles) ? openRoles : [],
      status: 'scheduled',
    });

    await runAgentCycle();

    const populated = await Event.findById(created._id).populate('clubId', 'name category').lean();
    res.status(201).json(populated);
  })
);

export default router;
