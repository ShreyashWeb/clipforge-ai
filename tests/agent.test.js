import { describe, expect, it } from 'vitest';
import { runAgentLoop } from '../src/agent/agent.js';
import { MockLlmProvider } from '../src/services/llm.js';
import { Job } from '../src/models/Job.js';

describe('Agent tool-calling loop', () => {
  it('asks the user when interview is needed and pauses with WAITING_USER', async () => {
    const mockLlm = new MockLlmProvider({
      thought: 'User topic is new. I must ask about audience preference first.',
      tool: 'ask_user',
      args: { question: 'Who is the target audience for this video?' },
    });

    const job = new Job({
      userId: 'user-1',
      topic: 'Quantum Teleportation',
      status: 'INTERVIEW',
    });

    const result = await runAgentLoop(job, { llm: mockLlm });

    expect(result.status).toBe('WAITING_USER');
    expect(result.lastAction).toBe('ask_user');
    expect(result.message).toBe('Who is the target audience for this video?');
    expect(job.trace).toHaveLength(2); // 1 LLM decision + 1 tool execution
    expect(job.trace[1].step).toBe('ask_user');
  });

  it('blocks make_storyboard if ANGLE_APPROVAL gate is not approved', async () => {
    const mockLlm = new MockLlmProvider({
      thought: 'Let us generate images now.',
      tool: 'make_storyboard',
      args: {},
    });

    const job = new Job({
      userId: 'user-1',
      topic: 'Autonomous Swarms',
      status: 'INTERVIEW',
      approvals: [], // Not approved yet!
    });

    const result = await runAgentLoop(job, { llm: mockLlm });

    expect(result.status).toBe('WAITING_APPROVAL');
    expect(result.message).toContain('ANGLE_APPROVAL');
    expect(job.status).toBe('ANGLE_APPROVAL');
    expect(job.trace.some((t) => t.step === 'make_storyboard_blocked')).toBe(true);
  });

  it('executes web_research and write_script sequentially, then requests approval', async () => {
    const decisions = [
      { thought: 'Need sources.', tool: 'web_research', args: { query: 'YOLOv11' } },
      { thought: 'Sources ready, drafting script.', tool: 'write_script', args: {} },
      { thought: 'Script drafted, requesting approval.', tool: 'request_approval', args: { gate: 'ANGLE_APPROVAL' } },
    ];

    let decisionIndex = 0;
    const mockLlm = new MockLlmProvider(() => decisions[decisionIndex++]);

    const mockResearch = async () => [
      { id: 1, title: 'YOLOv11 Paper', url: 'https://arxiv.org', snippet: 'Fast object detection at 150 FPS.' },
    ];

    const mockScriptGen = async () => ({
      scenes: [
        { sceneNo: 1, narration: 'YOLOv11 detects 80 classes.', visualPrompt: 'Street detection overlay', sourceIds: ['1'], supported: true },
      ],
      unsupportedLines: [],
    });

    const job = new Job({
      userId: 'user-1',
      topic: 'YOLOv11',
      status: 'INTERVIEW',
    });

    const result = await runAgentLoop(job, {
      llm: mockLlm,
      research: mockResearch,
      scriptGen: mockScriptGen,
    });

    expect(result.status).toBe('WAITING_APPROVAL');
    expect(job.sources).toHaveLength(1);
    expect(job.script).toBeDefined();
    expect(job.status).toBe('ANGLE_APPROVAL');
    expect(result.stepsExecuted).toBe(3);
  });

  it('allows make_storyboard, synthesize_voice, and render_video when gates are approved', async () => {
    const decisions = [
      { thought: 'Storyboard approved, render video now.', tool: 'render_video', args: {} },
      { thought: 'Render done, deliver video.', tool: 'deliver', args: {} },
    ];

    let decisionIdx = 0;
    const mockLlm = new MockLlmProvider(() => decisions[decisionIdx++]);

    const mockRenderer = async () => ({
      videoUrl: 'https://cdn.clipforge.ai/videos/rendered.mp4',
    });

    const job = new Job({
      userId: 'user-1',
      topic: '3D Gaussian Splatting',
      status: 'STORYBOARD_APPROVAL',
      storyboard: [{ sceneNo: 1, imageUrl: 'https://img.png', narration: '3D splats in real-time.' }],
      approvals: [
        { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date() },
        { gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date() },
        { gate: 'FINAL_APPROVAL', decision: 'approved', at: new Date() },
      ],
    });

    const result = await runAgentLoop(job, {
      llm: mockLlm,
      renderer: mockRenderer,
    });

    expect(result.status).toBe('COMPLETED');
    expect(job.status).toBe('DELIVERED');
    expect(job.videoUrl).toBe('https://cdn.clipforge.ai/videos/rendered.mp4');
  });

  it('stops at maxSteps limit', async () => {
    const mockLlm = new MockLlmProvider({
      thought: 'Still doing claims verification...',
      tool: 'verify_claims',
      args: {},
    });

    const job = new Job({
      userId: 'user-1',
      topic: 'Infinite Verification',
      status: 'SCRIPT',
    });

    const result = await runAgentLoop(job, {
      llm: mockLlm,
      maxSteps: 5,
    });

    expect(result.status).toBe('MAX_STEPS_REACHED');
    expect(result.stepsExecuted).toBe(5);
  });
});
