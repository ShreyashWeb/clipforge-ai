import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createJob, getJobs, getStats } from '../api.js';
import { AsyncState } from '../components/AsyncState.jsx';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { JobsSkeleton } from '../components/Skeleton.jsx';
import { motion } from 'framer-motion';

const filterTabs = [
  { id: 'all', label: 'All Jobs' },
  { id: 'needs_approval', label: '⏳ Needs Approval', statuses: ['ANGLE_APPROVAL', 'STORYBOARD_APPROVAL', 'FINAL_APPROVAL'] },
  { id: 'in_progress', label: '⚡ In Progress', statuses: ['INTERVIEW', 'SCRIPT', 'RENDER'] },
  { id: 'published', label: '✓ Published / Delivered', statuses: ['PUBLISHED'] },
  { id: 'failed', label: '✕ Failed / Rejected', statuses: ['FAILED', 'REJECTED'] },
];

export function Jobs() {
  const [state, setState] = useState({ loading: true, error: '', jobs: [], stats: null });
  const [newTopic, setNewTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getJobs(), getStats()])
      .then(([jobs, stats]) => setState({ loading: false, error: '', jobs: jobs.jobs, stats }))
      .catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }, []);

  async function handleStartInterview(e) {
    e.preventDefault();
    if (!newTopic.trim()) return;
    setIsCreating(true);
    try {
      const response = await createJob(newTopic.trim());
      const jobId = response.job?._id;
      if (jobId) {
        navigate(`/jobs/${jobId}`);
      }
    } catch (error) {
      alert(`Could not start interview: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  }

  const filteredJobs = state.jobs.filter((job) => {
    // 1. Filter by Tab
    if (activeTab !== 'all') {
      const selectedTabObj = filterTabs.find((t) => t.id === activeTab);
      if (selectedTabObj?.statuses && !selectedTabObj.statuses.includes(job.status)) {
        return false;
      }
    }
    // 2. Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const topicMatches = (job.topic || '').toLowerCase().includes(q);
      const angleMatches = (job.selectedAngle || '').toLowerCase().includes(q);
      return topicMatches || angleMatches;
    }
    return true;
  });

  const getTabCount = (tabId) => {
    if (tabId === 'all') return state.jobs.length;
    const tab = filterTabs.find((t) => t.id === tabId);
    if (!tab?.statuses) return 0;
    return state.jobs.filter((j) => tab.statuses.includes(j.status)).length;
  };

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-10">
      <SectionTitle eyebrow="Production Queue">AI Video Studio</SectionTitle>

      {/* Start New Video / Topic Interview Bar */}
      <GlassCard className="mb-8 border-neon-cyan/40 bg-gradient-to-r from-neon-cyan/[0.05] to-transparent p-5 shadow-[0_0_32px_rgba(50,230,255,0.08)]">
        <form onSubmit={handleStartInterview} className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label htmlFor="topic-input" className="mb-1 block text-xs font-bold uppercase tracking-wider text-neon-cyan">
              Start New Topic Interview
            </label>
            <input
              id="topic-input"
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              placeholder="e.g. YOLOv11 Real-Time Vision, Quantum Computing, or paste a GitHub repo URL..."
              className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-neon-cyan focus:shadow-[0_0_16px_rgba(50,230,255,0.2)]"
            />
          </div>
          <div className="sm:pt-5">
            <NeonButton type="submit" disabled={isCreating || !newTopic.trim()}>
              {isCreating ? 'Researching...' : 'Start Interview →'}
            </NeonButton>
          </div>
        </form>
      </GlassCard>

      <AsyncState loading={state.loading} error={state.error} skeleton={<JobsSkeleton />}>
        {/* KPI Stats Banner */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Active Jobs', value: state.stats?.jobsCount, tab: 'all' },
            { label: 'Avg. Production Time', value: `${Math.round((state.stats?.averageTimePerVideo || 0) / 60000)}m`, tab: 'published' },
            { label: 'Estimated Cost Saved', value: `$${(state.stats?.estimatedCostSaved || 0).toFixed(2)}`, tab: 'all' },
          ].map(({ label, value, tab }) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 12 }}
              transition={{ delay: 0.05 * label.length, duration: 0.35 }}
              key={label}
              onClick={() => setActiveTab(tab)}
              className="cursor-pointer"
            >
              <GlassCard className="p-5 transition hover:border-neon-cyan/50 hover:shadow-[0_0_20px_rgba(50,230,255,0.15)]">
                <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
                <p className="mt-3 text-2xl font-bold text-white">{value}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Filter Tabs & Search Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => {
              const count = getTabCount(tab.id);
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    isActive
                      ? 'border border-neon-cyan bg-neon-cyan/20 text-white shadow-[0_0_16px_rgba(50,230,255,0.25)]'
                      : 'border border-white/10 bg-black/40 text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`rounded-md px-1.5 py-0.2 text-[0.65rem] ${isActive ? 'bg-neon-cyan text-black' : 'bg-white/10 text-slate-300'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics..."
              className="w-full rounded-xl border border-white/15 bg-black/50 px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-neon-cyan"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <p className="text-base font-semibold text-slate-300">No jobs match your filter criteria.</p>
            <p className="mt-1 text-xs text-muted">Try changing your search term or switching filter tabs.</p>
            <button
              onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
              type="button"
              className="mt-4 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-2 text-xs font-bold text-neon-cyan hover:bg-neon-cyan hover:text-black transition"
            >
              Reset Filters
            </button>
          </GlassCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 16 }}
                transition={{ delay: 0.04 * Math.min(index, 8), duration: 0.3 }}
                key={job._id}
              >
                <Link to={`/jobs/${job._id}`}>
                  <GlassCard className="h-full p-5 transition duration-300 hover:-translate-y-1 hover:border-neon-cyan/50 hover:shadow-[0_0_28px_rgba(50,230,255,0.18)]">
                    <div className="flex items-center justify-between">
                      <StatusBadge status={job.status} />
                      {job.costEstimate > 0 && (
                        <span className="text-xs font-mono text-slate-400">${job.costEstimate.toFixed(2)}</span>
                      )}
                    </div>
                    <h2 className="mt-4 font-semibold text-white line-clamp-2">{job.topic}</h2>
                    {job.selectedAngle && (
                      <p className="mt-1.5 text-xs text-slate-400 line-clamp-1 italic">
                        "{job.selectedAngle}"
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[0.7rem] text-muted">
                      <span>{job.storyboard?.length || 0} scenes</span>
                      <span>{job.sources?.length || 0} citations</span>
                      <span className="text-neon-cyan font-semibold">Open Studio →</span>
                    </div>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </AsyncState>
    </section>
  );
}
