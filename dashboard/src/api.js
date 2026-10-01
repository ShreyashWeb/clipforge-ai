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
    return { job };
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

export async function decideJob(id, decision, gate) {
  if (demoMode) return getJob(id);
  return request(`/api/jobs/${encodeURIComponent(id)}/${decision}`, {
    method: 'POST',
    body: JSON.stringify({ gate }),
  });
}
