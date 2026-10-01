import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { decideJob, getJob } from '../api.js';
import { AsyncState } from '../components/AsyncState.jsx';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { PipelineVisualizer } from '../components/PipelineVisualizer.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { StoryboardCarousel } from '../components/StoryboardCarousel.jsx';

const activeStatuses = new Set(['INTERVIEW', 'ANGLE_APPROVAL', 'SCRIPT', 'STORYBOARD_APPROVAL', 'RENDER', 'FINAL_APPROVAL']);

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Unknown time';
}

export function JobDetail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, error: '', job: null });
  const [actionError, setActionError] = useState('');

  const loadJob = useCallback(async () => {
    const { job } = await getJob(id);
    setState({ loading: false, error: '', job });
  }, [id]);

  useEffect(() => {
    loadJob().catch((error) => setState({ loading: false, error: error.message, job: null }));
  }, [loadJob]);

  useEffect(() => {
    if (!state.job || !activeStatuses.has(state.job.status)) return undefined;
    const timer = setInterval(() => {
      loadJob().catch((error) => setActionError(error.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [loadJob, state.job]);

  const approveGate = useMemo(
    () => (['ANGLE_APPROVAL', 'STORYBOARD_APPROVAL', 'FINAL_APPROVAL'].includes(state.job?.status)
      ? state.job.status
      : null),
    [state.job],
  );

  async function handleDecision(decision) {
    if (!approveGate) return;
    setActionError('');
    try {
      const response = await decideJob(id, decision, approveGate);
      setState({ loading: false, error: '', job: response.job || response });
    } catch (error) {
      setActionError(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-10">
      <Link className="inline-block text-sm text-neon-cyan" to="/jobs">← Back to jobs</Link>
      <AsyncState loading={state.loading} error={state.error}>
        {state.job && (
          <>
            <SectionTitle
              eyebrow="Job detail"
              action={<StatusBadge status={state.job.status} />}
            >
              {state.job.topic}
            </SectionTitle>

            <GlassCard className="p-4 md:p-6">
              <PipelineVisualizer
                currentStage={state.job.status}
                failedStage={state.job.status === 'FAILED' ? state.job.status : ''}
              />
            </GlassCard>

            {approveGate && (
              <GlassCard className="flex flex-wrap items-center gap-3 p-5">
                <span className="mr-auto text-sm text-muted">Decision required for {approveGate.replaceAll('_', ' ')}</span>
                <NeonButton onClick={() => handleDecision('approve')}>Approve</NeonButton>
                <NeonButton onClick={() => handleDecision('reject')} tone="red">Reject</NeonButton>
                {actionError && <p className="basis-full text-sm text-neon-red">{actionError}</p>}
              </GlassCard>
            )}

            <GlassCard className="p-6">
              <SectionTitle eyebrow="Workflow">Approval timeline</SectionTitle>
              <ol className="space-y-4">
                {state.job.approvals?.map((approval, index) => (
                  <li className="flex items-center gap-4 text-sm" key={`${approval.gate}-${index}`}>
                    <span className={approval.decision === 'approved' ? 'text-neon-cyan' : 'text-neon-red'}>●</span>
                    <span className="font-medium text-white">{approval.gate.replaceAll('_', ' ')}</span>
                    <span className="text-muted">{approval.decision}</span>
                    <time className="ml-auto text-xs text-muted">{formatDate(approval.at)}</time>
                  </li>
                ))}
              </ol>
            </GlassCard>

            <GlassCard className="overflow-hidden p-0">
              <div className="p-6 pb-3"><SectionTitle eyebrow="Source grounding">Script</SectionTitle></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-y border-white/10 text-xs uppercase tracking-widest text-muted">
                    <tr><th className="px-6 py-3">Line</th><th className="px-6 py-3">Narration</th><th className="px-6 py-3">Sources</th><th className="px-6 py-3">Support</th></tr>
                  </thead>
                  <tbody>
                    {(state.job.script?.scenes || state.job.script || []).map((line, index) => (
                      <tr className="border-b border-white/5 align-top" key={line.sceneNo || line.line || index}>
                        <td className="px-6 py-4 text-muted">{line.sceneNo || line.line || index + 1}</td>
                        <td className="min-w-72 px-6 py-4 text-slate-300">{line.narration || line.text}</td>
                        <td className="min-w-48 px-6 py-4">
                          {(line.sourceIds || []).map((sourceId) => {
                            const source = state.job.sources?.find((item, sourceIndex) => String(item.id || sourceIndex + 1) === String(sourceId));
                            return source ? <a className="mb-1 block text-neon-cyan hover:underline" href={source.url} key={sourceId}>{source.title}</a> : null;
                          })}
                        </td>
                        <td className={`px-6 py-4 font-semibold ${line.supported === false ? 'text-amber-300' : 'text-emerald-300'}`}>
                          {line.supported === false ? 'Unsupported' : 'Supported'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {state.job.storyboard?.length > 0 && (
              <GlassCard className="p-6">
                <SectionTitle eyebrow="Visual plan">Storyboard</SectionTitle>
                <StoryboardCarousel scenes={state.job.storyboard} />
              </GlassCard>
            )}

            {state.job.videoUrl && (
              <GlassCard className="p-6">
                <SectionTitle eyebrow="Final cut">Video</SectionTitle>
                <video className="mb-5 aspect-video w-full rounded-xl bg-black" controls src={state.job.videoUrl} />
                <a download className="inline-flex rounded-lg border border-neon-cyan/60 px-4 py-2 text-sm font-semibold text-neon-cyan" href={state.job.videoUrl}>Download video</a>
              </GlassCard>
            )}
          </>
        )}
      </AsyncState>
    </section>
  );
}
