import { JOB_STATUSES } from './stateMachine.js';

const demoSources = [
  {
    id: 'demo:research',
    title: 'ClipForge demo research brief',
    url: 'https://example.com/clipforge-demo-research',
    snippet: 'A pre-recorded source-grounded research result used for offline demonstrations.',
    publishedDate: '2026-01-01',
  },
];

const demoScenes = [
  {
    sceneNo: 1,
    narration: 'ClipForge turns researched evidence into a short, reviewable story.',
    visualPrompt: 'Neon research signals becoming a vertical video storyboard',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1080&q=80',
    supported: true,
  },
  {
    sceneNo: 2,
    narration: 'Every stage waits for approval before the next production step begins.',
    visualPrompt: 'A glowing approval gate in a cinematic production pipeline',
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1080&q=80',
    supported: true,
  },
];

/**
 * Replays the cached successful media path without calling paid providers.
 *
 * @param {object} job
 * @returns {Promise<object>}
 */
export async function replayDemoJob(job) {
  job.sources = job.sources?.length ? job.sources : demoSources;
  job.script = job.script || {
    durationSeconds: 34,
    scenes: demoScenes.map(({ sceneNo, narration, visualPrompt, supported }) => ({
      sceneNo,
      narration,
      visualPrompt,
      sourceIds: ['demo:research'],
      supported,
    })),
    unsupportedLines: [],
  };
  job.storyboard = job.storyboard?.length ? job.storyboard : demoScenes;
  job.audioUrl = job.audioUrl || 'https://cdn.example.com/clipforge-demo/narration.mp3';
  job.videoUrl = job.videoUrl || 'https://cdn.example.com/clipforge-demo/final-video.mp4';

  if (job.status === JOB_STATUSES.FAILED) {
    const lastApproval = [...(job.approvals || [])].reverse().find(
      (approval) => approval.decision === 'approved',
    );
    const resume = {
      ANGLE_APPROVAL: JOB_STATUSES.SCRIPT,
      STORYBOARD_APPROVAL: JOB_STATUSES.RENDER,
      FINAL_APPROVAL: JOB_STATUSES.PUBLISHED,
    }[lastApproval?.gate] || JOB_STATUSES.INTERVIEW;
    job.status = resume;
  }

  job.status = JOB_STATUSES.PUBLISHED;
  job.pipeline = {
    ...(job.pipeline || {}),
    research: { status: 'completed', source: 'demo-cache' },
    images: { status: 'completed', source: 'demo-cache' },
    audio: { status: 'completed', source: 'demo-cache' },
    render: { status: 'completed', source: 'demo-cache' },
  };
  await job.save();
  return job;
}
