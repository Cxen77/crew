import express from 'express';
import asyncHandler from 'express-async-handler';
import Club from '../models/Club.js';
import Event from '../models/Event.js';
import { evaluateClubHealth } from '../agent/health.js';

const router = express.Router();

// GET /api/clubs — list all clubs with live computed health metrics
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [clubs, events] = await Promise.all([Club.find({}).sort({ name: 1 }).lean(), Event.find({}).lean()]);
    const healthList = evaluateClubHealth(clubs, events);
    const healthById = new Map(healthList.map((h) => [h.clubId, h]));

    const enriched = clubs.map((c) => ({
      ...c,
      health: healthById.get(String(c._id)) || null,
    }));

    res.json(enriched);
  })
);

// GET /api/clubs/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const club = await Club.findById(req.params.id).lean();
    if (!club) {
      res.status(404);
      throw new Error('Club not found');
    }
    const events = await Event.find({ $or: [{ clubId: club._id }, { collaboratingClubIds: club._id }] })
      .sort({ startAt: 1 })
      .lean();
    const [health] = evaluateClubHealth([club], events);
    res.json({ ...club, health, events });
  })
);

export default router;
