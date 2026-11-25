import mongoose from 'mongoose';

const decisionLogSchema = new mongoose.Schema(
  {
    proposalKey: { type: String, required: true, index: true },
    agentModule: {
      type: String,
      required: true,
      enum: ['clash', 'health', 'collaborate', 'match', 'report', 'coordinator'],
    },
    title: { type: String, required: true },
    whatItSaw: { type: mongoose.Schema.Types.Mixed, default: {} },
    decision: { type: String, required: true },
    reason: { type: String, required: true },
    scoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    actionPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ['proposed', 'approved', 'rejected'],
      default: 'proposed',
    },
    llmUsed: { type: Boolean, default: false },
    decidedBy: { type: String, default: null },
    decidedAt: { type: Date, default: null },
    executionNote: { type: String, default: '' },
  },
  { timestamps: true }
);

decisionLogSchema.index({ status: 1, createdAt: -1 });
decisionLogSchema.index({ agentModule: 1, status: 1 });

const DecisionLog = mongoose.model('DecisionLog', decisionLogSchema);

export default DecisionLog;
