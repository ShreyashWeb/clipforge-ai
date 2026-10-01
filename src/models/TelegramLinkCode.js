import mongoose from 'mongoose';

const telegramLinkCodeSchema = new mongoose.Schema(
  {
    telegramUserId: { type: String, required: true, index: true },
    codeHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const TelegramLinkCode =
  mongoose.models.TelegramLinkCode ||
  mongoose.model('TelegramLinkCode', telegramLinkCodeSchema);
