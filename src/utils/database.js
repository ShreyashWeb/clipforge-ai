import mongoose from 'mongoose';

/**
 * Connects to MongoDB using the configured connection string.
 *
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  return mongoose.connect(uri);
}
