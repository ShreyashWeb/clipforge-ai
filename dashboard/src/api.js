const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

async function mockData() {
  const [{ mockJobs }] = await Promise.all([import('./mock/jobs.js')]);
  return mockJobs;
}

export async function getJobs(status) {
  if (demoMode) return { jobs: await mockData() };
  return request(`/api/jobs${status ? `?status=${encodeURIComponent(status)}` : ''}`);
}

export async function getJob(id) {
  if (demoMode) {
    const jobs = await mockData();
    const job = jobs.find((item) => item._id === id);
    if (!job) throw new Error('Job was not found');
    return { job: { ...job } };
  }
  return request(`/api/jobs/${encodeURIComponent(id)}`);
}

export async function getStats() {
  if (demoMode) {
    const jobs = await mockData();
    const published = jobs.filter((job) => job.status === 'PUBLISHED');
    return {
      jobsCount: jobs.length,
      averageTimePerVideo: published.length ? 3600000 : 0,
      estimatedCostSaved: jobs.reduce((total, job) => total + (job.costEstimate || 0), 0),
    };
  }
  return request('/api/stats');
}

export async function createJob(topic) {
  if (demoMode) {
    const jobs = await mockData();
    const cleanTopic = (topic || 'Autonomous AI Video Pipeline').trim();
    const randomSeed = Math.floor(Math.random() * 900000) + 100000;

    const prompt1 = `cinematic 8k 9:16 vertical render, ${cleanTopic} opening visual, high tech futuristic laboratory, dramatic neon lighting`;
    const prompt2 = `detailed close up, ${cleanTopic} core technology mechanism, holographic user interface, glowing data streams, 8k vertical`;
    const prompt3 = `visualizing ${cleanTopic} real-time benchmarks and performance metrics, cybernetic architecture, 8k vertical`;

    const newJob = {
      _id: `demo-${Date.now()}`,
      userId: 'demo-user',
      topic: cleanTopic,
      sourceType: 'topic',
      status: 'INTERVIEW',
      selectedAngle: `Decentralized architecture and real-time execution for ${cleanTopic}`,
      hooks: [
        `How does ${cleanTopic} achieve 10x performance gains?`,
        `The architectural breakthrough behind ${cleanTopic} explained.`,
        `Why ${cleanTopic} is transforming modern engineering right now.`,
      ],
      interviewAnswers: {
        targetAudience: 'Developers & AI Engineers',
        tone: 'Fast-paced, insightful, and technical',
        visualStyle: 'Cyberpunk HUD & coordinate overlays',
      },
      sources: [
        { id: 1, title: `${cleanTopic}: Technical Whitepaper and Architecture Review`, url: 'https://arxiv.org/' },
        { id: 2, title: `High Performance Benchmarks for ${cleanTopic}`, url: 'https://github.com/' },
      ],
      script: [
        { line: 1, text: `Here is the real breakdown of ${cleanTopic} in under 60 seconds.`, sourceIds: [1], supported: true },
        { line: 2, text: `By eliminating traditional overhead, ${cleanTopic} achieves unprecedented execution velocity.`, sourceIds: [1, 2], supported: true },
        { line: 3, text: `Direct benchmarks confirm a massive leap in efficiency and throughput.`, sourceIds: [2], supported: true },
      ],
      storyboard: [
        { sceneNo: 1, visualPrompt: prompt1, imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt1)}?width=1080&height=1920&nologo=true&seed=${randomSeed}`, narration: `Here is the real breakdown of ${cleanTopic} in under 60 seconds.`, duration: 4, supported: true },
        { sceneNo: 2, visualPrompt: prompt2, imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt2)}?width=1080&height=1920&nologo=true&seed=${randomSeed + 1}`, narration: `By eliminating traditional overhead, ${cleanTopic} achieves unprecedented execution velocity.`, duration: 5, supported: true },
        { sceneNo: 3, visualPrompt: prompt3, imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt3)}?width=1080&height=1920&nologo=true&seed=${randomSeed + 2}`, narration: `Direct benchmarks confirm a massive leap in efficiency and throughput.`, duration: 4, supported: true },
      ],
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      costEstimate: 0.12,
      approvals: [],
    };
    jobs.unshift(newJob);
    return { job: newJob };
  }
  return request('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({ topic, sourceType: 'topic' }),
  });
}

export async function decideJob(id, decision, gate) {
  if (demoMode) {
    const jobs = await mockData();
    const job = jobs.find((item) => item._id === id);
    if (!job) throw new Error('Job was not found');

    const isApprove = decision === 'approve' || decision === 'approved';

    if (isApprove) {
      const stageProgression = {
        INTERVIEW: 'ANGLE_APPROVAL',
        ANGLE_APPROVAL: 'STORYBOARD_APPROVAL',
        SCRIPT: 'STORYBOARD_APPROVAL',
        STORYBOARD_APPROVAL: 'FINAL_APPROVAL',
        RENDER: 'FINAL_APPROVAL',
        FINAL_APPROVAL: 'PUBLISHED',
      };
      const currentGate = gate || job.status;
      const nextStatus = stageProgression[currentGate] || 'PUBLISHED';
      job.status = nextStatus;
      job.approvals = job.approvals || [];
      job.approvals.push({ gate: currentGate, decision: 'approved', at: new Date().toISOString() });
      if (!job.videoUrl) {
        job.videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
      }
    } else {
      job.status = 'REJECTED';
      job.approvals = job.approvals || [];
      job.approvals.push({ gate: gate || job.status, decision: 'rejected', at: new Date().toISOString() });
    }
    return { job: { ...job } };
  }
  return request(`/api/jobs/${encodeURIComponent(id)}/${decision}`, {
    method: 'POST',
    body: JSON.stringify({ gate }),
  });
}

export async function instantGenerateVideo(id) {
  if (demoMode) {
    const jobs = await mockData();
    const job = jobs.find((item) => item._id === id);
    if (!job) throw new Error('Job was not found');
    job.status = 'PUBLISHED';
    job.videoUrl = job.videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    job.approvals = [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date().toISOString() },
      { gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date().toISOString() },
      { gate: 'FINAL_APPROVAL', decision: 'approved', at: new Date().toISOString() },
    ];
    return { job: { ...job } };
  }
  return decideJob(id, 'approve', 'FINAL_APPROVAL');
}

export async function retryJob(id) {
  if (demoMode) {
    const jobs = await mockData();
    const job = jobs.find((item) => item._id === id);
    if (!job) throw new Error('Job was not found');
    job.status = 'STORYBOARD_APPROVAL';
    return { job: { ...job } };
  }
  return request(`/api/jobs/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  });
}

export async function generateTopicHooks(topic, tone, audience) {
  const cleanTopic = (topic || '').trim();
  if (!cleanTopic) return null;

  const apiKey = import.meta.env.VITE_LLM_API_KEY;
  const endpoint = import.meta.env.VITE_LLM_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
  const model = import.meta.env.VITE_LLM_MODEL || 'openai/gpt-oss-120b';

  // 1. Direct live Groq LLM query for instant real-time AI hooks
  if (apiKey && endpoint) {
    try {
      const prompt = `Generate exactly 3 viral, high-retention video opening hooks for a 30-45 second video about: "${cleanTopic}".
Target Audience: ${audience || 'General'}
Narrative Tone: ${tone || 'Fast-Paced'}

Rules:
- Hooks must be strictly specific to "${cleanTopic}".
- Never use generic boilerplate or introductory fluff like "In this video" or "Welcome back".
- Return ONLY valid JSON with this exact format:
{"hooks":["...","...","..."]}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawContent = data.choices?.[0]?.message?.content || data.output_text;
        const parsed = JSON.parse(rawContent.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim());
        if (Array.isArray(parsed.hooks) && parsed.hooks.length >= 3) {
          return parsed.hooks.slice(0, 3);
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Backend /api/hooks fallback
  try {
    const res = await request('/api/hooks', {
      method: 'POST',
      body: JSON.stringify({ topic: cleanTopic, tone, audience }),
    });
    if (Array.isArray(res.hooks) && res.hooks.length > 0) {
      return res.hooks;
    }
  } catch {
    // fallback gracefully
  }

  return null;
}

