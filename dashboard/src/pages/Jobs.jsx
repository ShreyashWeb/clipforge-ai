import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getJobs, getStats } from '../api.js';
import { AsyncState } from '../components/AsyncState.jsx';
import { GlassCard } from '../components/GlassCard.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { JobsSkeleton } from '../components/Skeleton.jsx';
import { motion } from 'framer-motion';

export function Jobs() {
  const [state, setState] = useState({ loading: true, error: '', jobs: [], stats: null });

  useEffect(() => {
    Promise.all([getJobs(), getStats()])
      .then(([jobs, stats]) => setState({ loading: false, error: '', jobs: jobs.jobs, stats }))
      .catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-5 py-10 md:px-10">
      <SectionTitle eyebrow="Production queue">Your jobs</SectionTitle>
      <AsyncState loading={state.loading} error={state.error} skeleton={<JobsSkeleton />}>
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            ['Jobs', state.stats?.jobsCount],
            ['Avg. video time', `${Math.round((state.stats?.averageTimePerVideo || 0) / 60000)}m`],
            ['Cost saved', `$${(state.stats?.estimatedCostSaved || 0).toFixed(2)}`],
          ].map(([label, value], index) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 12 }}
              transition={{ delay: 0.05 * label.length, duration: 0.35 }}
              key={label}
            >
            <GlassCard className="p-5">
              <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
            </GlassCard>
            </motion.div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {state.jobs.map((job) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 16 }}
              transition={{ delay: 0.08 * index, duration: 0.35 }}
              key={job._id}
            >
            <Link to={`/jobs/${job._id}`}>
              <GlassCard className="h-full p-5 transition duration-300 hover:-translate-y-1 hover:border-neon-cyan/40 hover:shadow-[0_0_28px_rgba(50,230,255,0.12)]">
                <StatusBadge status={job.status} />
                <h2 className="mt-4 font-semibold text-white">{job.topic}</h2>
                <p className="mt-3 text-sm text-muted">{job.storyboard.length} scenes · {job.sources.length} sources</p>
              </GlassCard>
            </Link>
            </motion.div>
          ))}
        </div>
      </AsyncState>
    </section>
  );
}
