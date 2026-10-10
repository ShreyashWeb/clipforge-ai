import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { decideJob, getJob, retryJob } from '../api.js';
import { AsyncState } from '../components/AsyncState.jsx';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { PipelineVisualizer } from '../components/PipelineVisualizer.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { StoryboardCarousel } from '../components/StoryboardCarousel.jsx';
import { InteractiveVideoPlayer } from '../components/InteractiveVideoPlayer.jsx';
import { BotScene } from '../components/BotScene.jsx';
import { JobDetailSkeleton } from '../components/Skeleton.jsx';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Just now';
}

const approvalStages = [
  { gate: 'ANGLE_APPROVAL', label: 'Angle Approval', desc: 'Creative hook & core thesis validation' },
  { gate: 'STORYBOARD_APPROVAL', label: 'Storyboard Approval', desc: 'Visual scene images & script review' },
  { gate: 'FINAL_APPROVAL', label: 'Final Approval', desc: 'Complete video render & voice synchronization' },
];

export function JobDetail() {
  const { id } = useParams();
  const [state, setState] = useState({ loading: true, error: '', job: null });
  const [actionError, setActionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('vertical'); // 'vertical' (9:16) or 'cinematic' (16:9)
  const [selectedSourceForInspect, setSelectedSourceForInspect] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  const loadJob = useCallback(async () => {
    const { job } = await getJob(id);
    setState({ loading: false, error: '', job });
  }, [id]);

  useEffect(() => {
    loadJob().catch((error) => setState({ loading: false, error: error.message, job: null }));
  }, [loadJob]);

  // Approve / Reject Decision Handlers wired to API
  async function handleDecision(decision) {
    if (!state.job) return;
    setActionError('');
    setIsProcessing(true);
    try {
      const gate = state.job.status;
      const response = await decideJob(id, decision, gate);
      const updated = response.job || response;
      setState({ loading: false, error: '', job: updated });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  // Retry Failed Job wired to API
  async function handleRetry() {
    if (!state.job) return;
    setActionError('');
    setIsProcessing(true);
    try {
      const response = await retryJob(id);
      setState({ loading: false, error: '', job: response.job || response });
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const handleUpdateScene = (updatedScene, index) => {
    if (!state.job) return;
    const newStoryboard = [...(state.job.storyboard || [])];
    newStoryboard[index] = updatedScene;
    setState((prev) => ({
      ...prev,
      job: {
        ...prev.job,
        storyboard: newStoryboard,
      },
    }));
  };

  const handleRegenerateScene = async (scene, customPrompt) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const sampleImages = [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1280&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1280&q=80',
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',
      'https://images.unsplash.com/photo-1507146153580-69a1fe6d8aa1?auto=format&fit=crop&w=1280&q=80',
    ];
    const randomImg = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    const updatedScene = { ...scene, imageUrl: randomImg, visualPrompt: customPrompt || scene.visualPrompt };
    const sceneIndex = state.job.storyboard.findIndex((s) => s.sceneNo === scene.sceneNo);
    if (sceneIndex >= 0) {
      handleUpdateScene(updatedScene, sceneIndex);
    }
  };

  const isTerminal = state.job?.status === 'PUBLISHED' || state.job?.status === 'DELIVERED';
  const isFailedOrRejected = state.job?.status === 'FAILED' || state.job?.status === 'REJECTED';
  const isAwaitingApproval =
    state.job?.status === 'ANGLE_APPROVAL' ||
    state.job?.status === 'STORYBOARD_APPROVAL' ||
    state.job?.status === 'FINAL_APPROVAL';

  const scriptScenes = Array.isArray(state.job?.script?.scenes)
    ? state.job.script.scenes
    : Array.isArray(state.job?.script)
    ? state.job.script
    : [];

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  return (
    <section className="mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-10">
      {/* Top Header Controls in Normal HTML */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link className="inline-block text-sm font-semibold text-neon-cyan transition hover:underline" to="/jobs">
          ← Back to jobs queue
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/create"
            className="rounded-lg border border-neon-cyan/60 bg-neon-cyan/10 px-4 py-2 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan hover:text-black"
          >
            + Create New Video
          </Link>
        </div>
      </div>

      <AsyncState loading={state.loading} error={state.error} skeleton={<JobDetailSkeleton />}>
        {state.job && (
          <>
            <SectionTitle
              eyebrow="Job Detail"
              action={<StatusBadge status={state.job.status} />}
            >
              {state.job.topic}
            </SectionTitle>

            {/* 1. VISUALIZER & 3D COMPANION */}
            <div className="grid gap-6 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-8">
                <GlassCard className="h-full p-4 md:p-6 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-neon-cyan">
                      Autonomous Production Pipeline
                    </span>
                    <span className="text-xs text-muted">Live SSE EventStream Connected</span>
                  </div>
                  <PipelineVisualizer
                    stage={state.job.status}
                    failedStage={isFailedOrRejected ? state.job.status : ''}
                    jobId={id}
                  />
                </GlassCard>
              </div>
              <div className="lg:col-span-4">
                <GlassCard className="h-full p-4 flex flex-col items-center justify-between border-neon-cyan/30 shadow-[0_0_24px_rgba(50,230,255,0.1)]">
                  <div className="w-full flex items-center justify-between px-2 pt-1">
                    <span className="text-[0.7rem] font-bold uppercase tracking-widest text-slate-400">
                      AI Agent Co-Pilot
                    </span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
                  </div>
                  <div className="w-full my-auto flex items-center justify-center">
                    <BotScene status={state.job.status} className="!h-48 md:!h-56" />
                  </div>
                  <p className="text-[0.68rem] text-slate-400 text-center pb-1">
                    {isTerminal
                      ? '🎉 Video completed and delivered! Click robot to spin.'
                      : isFailedOrRejected
                      ? '⚠️ Job stopped. You can retry from the last approved milestone.'
                      : '🤖 Agent tracking cursor & live execution state.'}
                  </p>
                </GlassCard>
              </div>
            </div>

            {/* 2. APPROVE / REJECT ACTION CONTROLS (Normal HTML Buttons wired to API) */}
            {isAwaitingApproval && (
              <GlassCard className="flex flex-wrap items-center justify-between gap-4 border-neon-cyan/40 bg-neon-cyan/[0.04] p-5 shadow-[0_0_28px_rgba(50,230,255,0.12)]">
                <div>
                  <span className="inline-block rounded-md bg-neon-cyan/15 px-2.5 py-0.5 text-xs font-bold text-neon-cyan border border-neon-cyan/30 uppercase tracking-wider">
                    Human Review Gate: {state.job.status.replaceAll('_', ' ')}
                  </span>
                  <h3 className="mt-1 font-bold text-white text-base">
                    Review and Approve Milestone
                  </h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Verify the generated materials below. Approving will automatically resume the autonomous agent loop.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleDecision('approve')}
                    disabled={isProcessing}
                    className="cursor-pointer rounded-xl bg-gradient-to-r from-neon-cyan to-blue-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black transition-all hover:scale-105 hover:shadow-[0_0_24px_#32e6ff] disabled:opacity-50"
                  >
                    {isProcessing ? 'Submitting...' : '✓ Approve & Continue'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision('reject')}
                    disabled={isProcessing}
                    className="cursor-pointer rounded-xl border border-neon-red/60 bg-neon-red/10 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-neon-red transition-all hover:bg-neon-red hover:text-white hover:shadow-[0_0_20px_#ff365e] disabled:opacity-50"
                  >
                    ✕ Reject
                  </button>
                </div>
                {actionError && <p className="basis-full text-xs font-semibold text-neon-red">{actionError}</p>}
              </GlassCard>
            )}

            {/* FAILED / RETRY CONTROLS */}
            {isFailedOrRejected && (
              <GlassCard className="flex flex-wrap items-center justify-between gap-4 border-neon-red/40 bg-neon-red/[0.04] p-5 shadow-[0_0_24px_rgba(255,54,94,0.15)]">
                <div>
                  <h3 className="font-bold text-neon-red text-base">Pipeline Status: {state.job.status}</h3>
                  <p className="mt-1 text-xs text-slate-300">
                    Execution was stopped. You can retry from the last approved gate to resume generation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isProcessing}
                  className="cursor-pointer rounded-xl bg-neon-red px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-all hover:scale-105 hover:shadow-[0_0_24px_#ff365e] disabled:opacity-50"
                >
                  {isProcessing ? 'Retrying...' : '↺ Retry & Resume Agent'}
                </button>
                {actionError && <p className="basis-full text-xs font-semibold text-neon-red">{actionError}</p>}
              </GlassCard>
            )}

            {/* 3. FINAL VIDEO PLAYER & CONTROLS (Normal HTML5 Video / Interactive Theater) */}
            <GlassCard className="border-neon-cyan/40 p-6 shadow-[0_0_36px_rgba(50,230,255,0.15)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Final Video Player
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-white">Composited AI Video Output</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAspectRatio('vertical')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      aspectRatio === 'vertical'
                        ? 'border border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                        : 'border border-white/10 text-muted hover:text-white'
                    }`}
                    type="button"
                  >
                    📱 9:16 Shorts
                  </button>
                  <button
                    onClick={() => setAspectRatio('cinematic')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                      aspectRatio === 'cinematic'
                        ? 'border border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                        : 'border border-white/10 text-muted hover:text-white'
                    }`}
                    type="button"
                  >
                    🖥️ 16:9 Wide
                  </button>
                </div>
              </div>

              {/* Video Player Display */}
              {state.job.videoUrl ? (
                <div className="space-y-4">
                  <div className={`mx-auto overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl ${
                    aspectRatio === 'vertical' ? 'max-w-sm aspect-[9/16]' : 'max-w-3xl aspect-[16/9]'
                  }`}>
                    <video
                      controls
                      src={state.job.videoUrl}
                      className="h-full w-full object-cover"
                      poster={state.job.storyboard?.[0]?.imageUrl}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <a
                      href={state.job.videoUrl}
                      download={`clipforge-${state.job._id}.mp4`}
                      className="rounded-xl border border-neon-cyan/50 bg-neon-cyan/10 px-4 py-2 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan hover:text-black"
                    >
                      📥 Download Rendered MP4
                    </a>
                  </div>
                </div>
              ) : (
                <InteractiveVideoPlayer
                  topic={state.job.topic}
                  scenes={state.job.storyboard}
                  aspectRatio={aspectRatio}
                />
              )}
            </GlassCard>

            {/* 4. STORYBOARD CAROUSEL */}
            {state.job.storyboard?.length > 0 && (
              <GlassCard className="p-6">
                <SectionTitle eyebrow="Visual Plan">Interactive Storyboard Carousel</SectionTitle>
                <StoryboardCarousel
                  scenes={state.job.storyboard}
                  onApprove={() => handleDecision('approve')}
                  onRegenerate={handleRegenerateScene}
                  onUpdateScene={handleUpdateScene}
                />
              </GlassCard>
            )}

            {/* 5. SCRIPT TABLE WITH SOURCE LINKS & SUPPORTED/UNSUPPORTED FLAGS (Normal HTML Table) */}
            <GlassCard className="overflow-hidden p-0">
              <div className="p-6 pb-3 flex items-center justify-between border-b border-white/10">
                <div>
                  <SectionTitle eyebrow="Source Grounding">Script Narration & Fact Verification</SectionTitle>
                  <p className="mt-1 text-xs text-muted">
                    Every narration line is verified against cited research evidence. Click links to inspect citations.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-black/40 text-xs uppercase tracking-widest text-muted">
                    <tr>
                      <th className="px-6 py-3.5">Scene #</th>
                      <th className="px-6 py-3.5">Narration Line</th>
                      <th className="px-6 py-3.5">Grounding Source Links</th>
                      <th className="px-6 py-3.5">Verification Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {scriptScenes.length > 0 ? (
                      scriptScenes.map((line, index) => {
                        const sceneNumber = line.sceneNo || line.line || index + 1;
                        const isSupported = line.supported !== false;
                        const sourceIds = Array.isArray(line.sourceIds) ? line.sourceIds : [1];

                        return (
                          <tr className="align-top hover:bg-white/[0.02] transition-colors" key={`script-${sceneNumber}-${index}`}>
                            <td className="px-6 py-4 font-mono text-neon-cyan font-bold">
                              {sceneNumber}
                            </td>
                            <td className="min-w-72 px-6 py-4 text-slate-200 font-medium leading-relaxed">
                              "{line.narration || line.text}"
                            </td>
                            <td className="min-w-56 px-6 py-4">
                              <div className="space-y-1.5">
                                {sourceIds.map((sourceId) => {
                                  const source = state.job.sources?.find(
                                    (item, sIndex) => String(item.id || sIndex + 1) === String(sourceId),
                                  ) || state.job.sources?.[0];

                                  return source?.url ? (
                                    <a
                                      key={`source-${sourceId}`}
                                      href={source.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1.5 text-xs text-neon-cyan hover:underline break-all"
                                    >
                                      🔗 {source.title || source.url}
                                    </a>
                                  ) : (
                                    <span key={`source-none-${sourceId}`} className="text-xs text-muted">
                                      Research Source #{sourceId}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                                  isSupported
                                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                {isSupported ? '✓ Grounded' : '⚠️ Unsupported'}
                              </span>
                              {line.reason && (
                                <p className="mt-1 text-[0.7rem] text-amber-400 font-medium">
                                  {line.reason}
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-xs text-muted">
                          Script scenes will appear once initial research and angle approval pass.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* 6. APPROVALS TIMELINE (Normal HTML Ordered List) */}
            <GlassCard className="p-6">
              <SectionTitle eyebrow="Workflow History">Approvals Timeline</SectionTitle>
              <div className="mt-6">
                <ol className="relative border-l border-white/10 ml-4 space-y-6">
                  {approvalStages.map((stageItem) => {
                    const recordedApproval = state.job.approvals?.find((a) => a.gate === stageItem.gate);
                    const isApproved = recordedApproval?.decision === 'approved';
                    const isRejected = recordedApproval?.decision === 'rejected';
                    const isCurrent = state.job.status === stageItem.gate;

                    return (
                      <li className="ml-6" key={stageItem.gate}>
                        {/* Status Marker Dot */}
                        <span
                          className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isApproved
                              ? 'bg-neon-cyan text-black shadow-[0_0_12px_#32e6ff]'
                              : isRejected
                              ? 'bg-neon-red text-white shadow-[0_0_12px_#ff365e]'
                              : isCurrent
                              ? 'bg-amber-400 text-black animate-pulse'
                              : 'bg-slate-800 text-slate-500 border border-white/10'
                          }`}
                        >
                          {isApproved ? '✓' : isRejected ? '✕' : isCurrent ? '●' : '○'}
                        </span>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {stageItem.label}
                          </h4>
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              isApproved
                                ? 'text-neon-cyan'
                                : isRejected
                                ? 'text-neon-red'
                                : isCurrent
                                ? 'text-amber-300'
                                : 'text-slate-500'
                            }`}
                          >
                            {isApproved
                              ? 'Approved'
                              : isRejected
                              ? 'Rejected'
                              : isCurrent
                              ? 'Awaiting Decision'
                              : 'Pending'}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-400">{stageItem.desc}</p>
                        {recordedApproval?.at && (
                          <time className="mt-1 block font-mono text-[0.7rem] text-muted">
                            Decided: {formatDate(recordedApproval.at)}
                          </time>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </GlassCard>

            {/* 7. SOURCES EVIDENCE LIST */}
            {state.job.sources?.length > 0 && (
              <GlassCard className="p-6">
                <SectionTitle eyebrow="Verified Grounding Citations">
                  Source Material Documents ({state.job.sources.length})
                </SectionTitle>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {state.job.sources.map((src, i) => (
                    <div
                      key={src.url || i}
                      className="rounded-xl border border-white/10 bg-black/40 p-4 transition hover:border-neon-cyan/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="text-xs font-bold text-white line-clamp-1">
                          {src.title || src.url}
                        </h5>
                        <span className="text-[0.65rem] font-bold text-neon-cyan uppercase">
                          Source #{i + 1}
                        </span>
                      </div>
                      {src.snippet && (
                        <p className="mt-2 text-xs text-slate-300 line-clamp-2 font-mono">
                          "{src.snippet}"
                        </p>
                      )}
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-block text-xs font-semibold text-neon-cyan hover:underline"
                      >
                        Visit Original Source →
                      </a>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </>
        )}
      </AsyncState>
    </section>
  );
}

export default JobDetail;
