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
    expect(job.inputs).toEqual([]);
    expect(job.hooks).toEqual([]);
    expect(job.sources).toEqual([]);
    expect(job.storyboard).toEqual([]);
    expect(job.approvals).toEqual([]);
    expect(job.trace).toEqual([]);
    expect(Job.schema.options.timestamps).toBe(true);
  });

  it('supports inputs with text, voice, and image modalities', () => {
    const job = new Job({
      userId: 'user-1',
      topic: 'Multimodal AI',
      inputs: [
        { type: 'text', ref: 'user prompt text' },
        { type: 'voice', ref: 'tg_file_id_12345' },
        { type: 'image', ref: 'https://example.com/ref.png' },
      ],
    });

    expect(job.inputs).toHaveLength(3);
    expect(job.inputs[0].type).toBe('text');
    expect(job.inputs[1].type).toBe('voice');
    expect(job.inputs[2].type).toBe('image');
  });

  it('rejects invalid input types', async () => {
    const job = new Job({
      userId: 'user-1',
      topic: 'Invalid Input Type',
      inputs: [{ type: 'video_file', ref: 'invalid' }],
    });

    await expect(job.validate()).rejects.toThrow();
  });

  it('supports execution trace records with timings and status', () => {
    const at = new Date();
    const job = new Job({
      userId: 'user-1',
      topic: 'Tracing Pipeline',
      trace: [
        { step: 'TAVILY_RESEARCH', tool: 'tavily', ms: 420, ok: true, at },
        { step: 'SCRIPT_DRAFT', tool: 'llm', ms: 1250, ok: true, at },
      ],
    });

    expect(job.trace).toHaveLength(2);
    expect(job.trace[0].step).toBe('TAVILY_RESEARCH');
    expect(job.trace[0].ms).toBe(420);
    expect(job.trace[1].ok).toBe(true);
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
    expect(job.approvals[0].decision).toBe('approved');
    expect(job.approvals[0].at).toEqual(at);
  });

  it('supports angle and script scenes schema', () => {
    const job = new Job({
      userId: 'user-1',
      topic: 'Quantum Computing',
      angle: 'Decoherence resilience in topological qubits',
      script: [
        {
          scene: 1,
          narration: 'Quantum computers lose coherence quickly.',
          visualPrompt: 'Cryogenic quantum processor with glowing wires',
          sourceIds: [1],
          supported: true,
        },
      ],
    });

    expect(job.angle).toBe('Decoherence resilience in topological qubits');
    expect(job.script).toHaveLength(1);
    expect(job.script[0].scene).toBe(1);
    expect(job.script[0].supported).toBe(true);
  });

  it('exports a mongoose model', () => {
    expect(mongoose.models.Job).toBe(Job);
  });
});
