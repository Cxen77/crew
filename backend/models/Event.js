import mongoose from 'mongoose';

const eventOpenRoleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    requiredSkills: [{ type: String, lowercase: true, trim: true }],
    vacancies: { type: Number, default: 1, min: 1 },
    filledCount: { type: Number, default: 0 },
    assignedVolunteerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' }],
    isOpen: { type: Boolean, default: true },
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    collaboratingClubIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }],
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    venue: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: [
        'Hackathon',
        'Workshop',
        'Seminar',
        'Concert',
        'Performance',
        'Meetup',
        'Tournament',
        'Stargazing',
        'Wellness',
        'Showcase',
      ],
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'merged'],
      default: 'scheduled',
    },
    mergedIntoEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    expectedAttendance: { type: Number, default: 40 },
    openRoles: [eventOpenRoleSchema],
    generatedReport: { type: String, default: '' },
    reportGeneratedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

eventSchema.index({ startAt: 1, endAt: 1 });
eventSchema.index({ venue: 1 });
eventSchema.index({ clubId: 1 });
eventSchema.index({ status: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
