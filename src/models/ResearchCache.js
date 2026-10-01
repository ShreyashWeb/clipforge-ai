import mongoose from 'mongoose';

const researchCacheSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, unique: true, index: true },
    results: {
      type: [
        {
          _id: false,
          title: String,
          url: String,
          snippet: String,
          publishedDate: { type: String, default: null },
        },
      ],
      required: true,
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

export const ResearchCache =
  mongoose.models.ResearchCache || mongoose.model('ResearchCache', researchCacheSchema);
