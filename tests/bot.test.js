import { describe, expect, it } from 'vitest';
import { createBot } from '../src/bot/bot.js';
import { Job } from '../src/models/Job.js';

describe('Telegram Bot Service', () => {
  it('instantiates the bot with provided token', () => {
    const bot = createBot({ token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' });
    expect(bot).toBeDefined();
  });

  it('throws an error if token is missing', () => {
    expect(() => createBot({ token: '' })).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('handles start command by creating job with text input and planning interview', async () => {
    const createdJobs = [];
    const mockModel = {
      create: async (data) => {
        const job = new Job(data);
        job.save = async () => job;
        createdJobs.push(job);
        return job;
      },
      findOne: async () => createdJobs[0] || null,
    };

    const mockLlm = {
      generate: async () => JSON.stringify({
        questions: [
          { key: 'audience', question: 'Who is the audience?' },
          { key: 'uniqueAngle', question: 'What is the angle?' },
          { key: 'tone', question: 'What is the tone?' },
        ],
        hooks: ['Hook 1', 'Hook 2'],
        angles: ['Angle 1', 'Angle 2', 'Angle 3'],
      }),
    };

    const mockResearch = async () => [
      { id: 1, title: 'Sample Source', url: 'https://example.com', snippet: 'Research snippet' },
    ];

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        result: {
          message_id: 100,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 987654, type: 'private' },
          text: 'ok',
        },
      }),
      text: async () => JSON.stringify({ ok: true, result: {} }),
    });

    const bot = createBot({
      token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      model: mockModel,
      llm: mockLlm,
      research: mockResearch,
      client: { fetch: mockFetch },
      botInfo: {
        id: 123456,
        is_bot: true,
        first_name: 'ClipForgeBot',
        username: 'clipforge_bot',
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
      },
    });

    // Trigger start command handler
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        from: { id: 987654, is_bot: false, first_name: 'Test' },
        chat: { id: 987654, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: '/start YOLOv11 Object Detection',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });

    expect(createdJobs).toHaveLength(1);
    expect(createdJobs[0].topic).toBe('YOLOv11 Object Detection');
    expect(createdJobs[0].inputs).toHaveLength(1);
    expect(createdJobs[0].inputs[0].type).toBe('text');
    expect(createdJobs[0].status).toBe('INTERVIEW');
  });
});
