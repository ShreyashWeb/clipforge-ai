import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { Job } from '../src/models/Job.js';

describe('Job model', () => {
  it('defines the required workflow fields and defaults', () => {
    const job = new Job({
      userId: 'telegram-user-1',
      topic: 'How batteries work',
      sourceType: 'topic',
    });

    expect(job.status).toBe('INTERVIEW');
    expect(job.hooks).toEqual([]);
    expect(job.sources).toEqual([]);
    expect(job.storyboard).toEqual([]);
    expect(job.approvals).toEqual([]);
    expect(Job.schema.options.timestamps).toBe(true);
  });

  it('rejects unsupported source types', async () => {
    const job = new Job({
      userId: 'user-1',
      topic: 'A topic',
      sourceType: 'web',
    });

    await expect(job.validate()).rejects.toThrow(/sourceType/);
  });

  it('supports approval records', () => {
    const at = new Date();
    const job = new Job({
      userId: 'user-1',
      topic: 'A topic',
      sourceType: 'github',
      approvals: [{ gate: 'ANGLE_APPROVAL', decision: 'approved', at }],
    });

    expect(job.approvals[0].gate).toBe('ANGLE_APPROVAL');
    expect(job.approvals[0].at).toEqual(at);
  });

  it('exports a mongoose model', () => {
    expect(mongoose.models.Job).toBe(Job);
  });
});
