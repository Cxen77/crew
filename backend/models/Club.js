import mongoose from 'mongoose';

const openRoleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    requiredSkills: [{ type: String }],
    vacancies: { type: Number, default: 1, min: 1 },
    filledCount: { type: Number, default: 0 },
    isOpen: { type: Boolean, default: true },
  },
  { _id: true }
);

const memberEntrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: '' },
    role: { type: String, enum: ['owner', 'co-lead', 'member'], default: 'member' },
  },
  { _id: false }
);

const memberHistorySchema = new mongoose.Schema(
  {
    month: { type: String, required: true },
    count: { type: Number, required: true },
  },
  { _id: false }
);

const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    currentFocus: { type: String, default: '' },
    projectGoals: { type: String, default: '' },
    teamStatus: {
      type: String,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
    },
    members: [memberEntrySchema],
    memberCount: { type: Number, default: 0 },
    openRoles: [openRoleSchema],
    isLookingForMembers: { type: Boolean, default: false },

    // Activity & Health tracking
    lastActivityAt: { type: Date, default: Date.now },
    lastEventDate: { type: Date, default: null },
    memberCountHistory: [memberHistorySchema],
    postsLast30Days: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100 },
    isQuiet: { type: Boolean, default: false },
    recruitmentDraft: { type: String, default: '' },
  },
  { timestamps: true }
);

clubSchema.methods.syncLookingForMembers = function () {
  this.isLookingForMembers = this.openRoles.some((role) => role.isOpen && role.filledCount < role.vacancies);
};

clubSchema.index({ category: 1 });
clubSchema.index({ tags: 1 });
clubSchema.index({ isQuiet: 1 });

const Club = mongoose.model('Club', clubSchema);

export default Club;
