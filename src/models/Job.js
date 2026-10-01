import mongoose from 'mongoose';

const approvalSchema = new mongoose.Schema(
  {
    gate: {
      type: String,
      required: true,
    },
    decision: {
      type: String,
      required: true,
    },
    at: {
      type: Date,
      required: true,
    },
  },
  { _id: false },
);

const jobSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    sourceType: {
      type: String,
      enum: ['topic', 'github'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'INTERVIEW',
        'ANGLE_APPROVAL',
        'SCRIPT',
        'STORYBOARD_APPROVAL',
        'RENDER',
        'FINAL_APPROVAL',
        'PUBLISHED',
        'REJECTED',
        'FAILED',
      ],
      default: 'INTERVIEW',
      required: true,
    },
    interviewAnswers: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    selectedAngle: {
      type: String,
      default: null,
    },
    hooks: {
      type: [String],
      default: [],
    },
    sources: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    script: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    storyboard: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    audioUrl: {
      type: String,
      default: null,
    },
    videoUrl: {
      type: String,
      default: null,
    },
    costEstimate: {
      type: Number,
      default: 0,
      min: 0,
    },
    approvals: {
      type: [approvalSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
