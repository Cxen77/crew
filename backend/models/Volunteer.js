import mongoose from 'mongoose';

const availabilityWindowSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
  },
  { _id: false }
);

const volunteerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    department: { type: String, default: 'Computer Science' },
    year: { type: String, default: '3rd Year' },
    skills: [{ type: String, lowercase: true, trim: true }],
    preferredCategories: [{ type: String, trim: true }],
    availability: [availabilityWindowSchema],
    clubIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Club' }],
    assignedEventIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  },
  { timestamps: true }
);

volunteerSchema.index({ skills: 1 });
volunteerSchema.index({ assignedEventIds: 1 });

const Volunteer = mongoose.model('Volunteer', volunteerSchema);

export default Volunteer;
