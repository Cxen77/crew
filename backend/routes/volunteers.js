import express from 'express';
import asyncHandler from 'express-async-handler';
import Volunteer from '../models/Volunteer.js';
import Event from '../models/Event.js';
import { matchVolunteersForEvents } from '../agent/match.js';

const router = express.Router();

// GET /api/volunteers — list volunteers + live ranked role matches across open event roles
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [volunteers, events] = await Promise.all([
      Volunteer.find({})
        .populate('clubIds', 'name')
        .populate('assignedEventIds', 'title startAt endAt venue')
        .sort({ name: 1 })
        .lean(),
      Event.find({ status: 'scheduled' }).populate('clubId', 'name').lean(),
    ]);

    const roleMatches = matchVolunteersForEvents(events, volunteers);
    res.json({ volunteers, roleMatches });
  })
);

export default router;
