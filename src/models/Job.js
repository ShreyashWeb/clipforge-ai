import mongoose from 'mongoose';

const inputSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['text', 'voice', 'image'],
      required: true,
    },
    ref: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

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
      default: Date.now,
    },
  },
  { _id: false },
);

const traceSchema = new mongoose.Schema(
  {
    step: {
      type: String,
      required: true,
    },
    tool: {
      type: String,
      default: null,
    },
    ms: {
      type: Number,
      default: 0,
    },
    ok: {
      type: Boolean,
      default: true,
    },
    at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const scriptSceneSchema = new mongoose.Schema(
  {
    scene: {
      type: Number,
    },
    sceneNo: {
      type: Number,
    },
    narration: {
      type: String,
    },
    text: {
      type: String,
    },
    visualPrompt: {
      type: String,
    },
    sourceIds: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    supported: {
      type: Boolean,
      default: true,
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
    inputs: {
      type: [inputSchema],
      default: [],
    },
    sourceType: {
      type: String,
      enum: ['topic', 'github'],
      default: 'topic',
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
        'DELIVERED',
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
    angle: {
      type: String,
      default: null,
    },
    selectedAngle: {
      type: String,
      default: null,
    },
    hooks: {
      type: [String],
      default: [],
    },
    githubSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
    audio: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
    trace: {
      type: [traceSchema],
      default: [],
    },
    pipeline: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
