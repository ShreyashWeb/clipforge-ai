import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    githubId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    displayName: { type: String, default: null },
    email: { type: String, default: null },
    telegramUserId: { type: String, unique: true, sparse: true, default: null },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
