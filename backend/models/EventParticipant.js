import mongoose from 'mongoose';

const eventParticipantSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participantName: { type: String, required: true },
    participantEmail: { type: String, required: true },
    department: { type: String, default: 'Engineering' },
    year: { type: String, default: '2nd Year' },
    registrationType: {
      type: String,
      enum: ['solo', 'pre', 'auto'],
      default: 'solo',
    },
    teamName: { type: String, default: null },
    attended: { type: Boolean, default: false },
    attendedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

eventParticipantSchema.index({ eventId: 1 });
eventParticipantSchema.index({ eventId: 1, attended: 1 });

const EventParticipant = mongoose.model('EventParticipant', eventParticipantSchema);

export default EventParticipant;
