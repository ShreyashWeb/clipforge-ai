import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import './styles.css';

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
const mockJobsPromise = demoMode ? import('./mock/jobs.js') : Promise.resolve({ mockJobs: [] });

function App() {
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    mockJobsPromise.then(({ mockJobs }) => setJobs(mockJobs));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
      <h1 className="mb-6 text-3xl font-bold">ClipForge AI</h1>
      {demoMode ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <article className="rounded-xl bg-slate-900 p-5 shadow" key={job._id}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-cyan-400">{job.status}</p>
              <h2 className="mb-4 text-lg font-semibold">{job.topic}</h2>
              <p className="text-sm text-slate-400">
                {job.storyboard.length} scenes · {job.sources.length} sources · {job.script.length} script lines
              </p>
              {job.videoUrl && (
                <a className="mt-4 inline-block text-sm text-cyan-300 underline" href={job.videoUrl}>
                  Watch published video
                </a>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-slate-400">Connect the dashboard to the API to view your jobs.</p>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
