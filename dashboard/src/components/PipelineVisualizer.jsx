import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

export const PIPELINE_NODES = [
  { id: 'RESEARCH', label: 'Research', icon: '🔍' },
  { id: 'INTERVIEW', label: 'Interview', icon: '📋' },
  { id: 'ANGLE_APPROVAL', label: 'Angle Approval', icon: '📐' },
  { id: 'STORYBOARD', label: 'Storyboard', icon: '🎨' },
  { id: 'VOICE', label: 'Voice', icon: '🎙️' },
  { id: 'RENDER', label: 'Render', icon: '⚡' },
  { id: 'DELIVERED', label: 'Delivered', icon: '🚀' },
];

const STAGE_MAPPING = {
  RESEARCH: 0,
  INTERVIEW: 1,
  ANGLE_APPROVAL: 2,
  SCRIPT: 3,
  STORYBOARD: 3,
  STORYBOARD_APPROVAL: 3,
  VOICE: 4,
  RENDER: 5,
  FINAL_APPROVAL: 5,
  DELIVERED: 6,
  PUBLISHED: 6,
};

const TRACE_STEP_MAPPING = {
  web_research: 0,
  ask_user: 1,
  interview: 1,
  request_approval: 2,
  write_script: 3,
  make_storyboard: 3,
  synthesize_voice: 4,
  voice: 4,
  render_video: 5,
  render: 5,
  deliver: 6,
  published: 6,
};

function normalizeStageIndex(stageInput) {
  if (typeof stageInput === 'number') return stageInput;
  if (!stageInput) return 0;
  const upper = String(stageInput).toUpperCase().replace(/\s+/g, '_');
  if (upper in STAGE_MAPPING) return STAGE_MAPPING[upper];
  return 0;
}

/**
 * Pure 2D lightweight fallback visualizer with the same props interface.
 *
 * @param {{
 *   stage?: string|number,
 *   currentStage?: string|number,
 *   failedStage?: string|number,
 *   className?: string
 * }} props
 */
export function PipelineVisualizer2DFallback({
  stage,
  currentStage,
  failedStage = '',
  className = '',
}) {
  const activeStage = stage ?? currentStage ?? 'RESEARCH';
  const currentIndex = normalizeStageIndex(activeStage);
  const failedIndex = failedStage ? normalizeStageIndex(failedStage) : -1;
  const isFailed = failedIndex >= 0;

  return (
    <div className={`w-full overflow-x-auto py-3 ${className}`}>
      <div className="flex w-full min-w-[680px] items-center justify-between gap-1 px-4">
        {PIPELINE_NODES.map((node, index) => {
          const isComplete = index < currentIndex;
          const isActive = index === currentIndex;
          const isNodeFailed = isFailed && (index === failedIndex || (failedIndex === 0 && index === 0));

          return (
            <div className="flex flex-1 flex-col items-center gap-2" key={node.id}>
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      index <= currentIndex ? 'bg-cyan-400/80' : 'bg-white/10'
                    }`}
                  />
                )}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isNodeFailed
                      ? 'border border-red-500 bg-red-950 text-red-400'
                      : isActive
                      ? 'border-2 border-cyan-400 bg-cyan-950 text-cyan-300 ring-2 ring-cyan-400/40'
                      : isComplete
                      ? 'border border-cyan-400/60 bg-cyan-950/60 text-cyan-400'
                      : 'border border-white/10 bg-slate-900 text-slate-500'
                  }`}
                >
                  {isComplete ? '✓' : index + 1}
                </div>
                {index < PIPELINE_NODES.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      index < currentIndex ? 'bg-cyan-400/80' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-center text-[0.7rem] font-medium leading-tight ${
                  isNodeFailed
                    ? 'text-red-400'
                    : isActive
                    ? 'font-bold text-cyan-300'
                    : isComplete
                    ? 'text-slate-200'
                    : 'text-slate-500'
                }`}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Production Pipeline Stage Visualizer.
 *
 * Features:
 * - Glowing nodes for: Research, Interview, Angle Approval, Storyboard, Voice, Render, Delivered
 * - Animated photon light pulses traveling along active & completed connecting links
 * - Real-time SSE /stream subscription to live job.trace events
 * - Error state visualization and 2D fallback
 *
 * @param {{
 *   stage?: string|number,
 *   currentStage?: string|number,
 *   failedStage?: string|number,
 *   jobId?: string,
 *   onLiveStageChange?: (newIndex: number, stageName: string) => void,
 *   className?: string
 * }} props
 */
export function PipelineVisualizer({
  stage,
  currentStage,
  failedStage = '',
  jobId,
  onLiveStageChange,
  className = '',
}) {
  const initialStage = stage ?? currentStage ?? 'RESEARCH';
  const [liveStageIndex, setLiveStageIndex] = useState(() => normalizeStageIndex(initialStage));
  const [liveTraceEvent, setLiveTraceEvent] = useState(null);

  // Sync with prop changes
  useEffect(() => {
    setLiveStageIndex(normalizeStageIndex(stage ?? currentStage));
  }, [stage, currentStage]);

  // Subscribe to real-time Server-Sent Events (SSE) from /api/jobs/:id/stream
  useEffect(() => {
    if (!jobId) return;

    const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    const streamUrl = `${apiUrl}/api/jobs/${encodeURIComponent(jobId)}/stream`;
    let eventSource;

    try {
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setLiveTraceEvent(payload);

          const stepKey = payload.step?.toLowerCase();
          if (stepKey && stepKey in TRACE_STEP_MAPPING) {
            const newIndex = TRACE_STEP_MAPPING[stepKey];
            setLiveStageIndex((prev) => {
              const updated = Math.max(prev, newIndex);
              onLiveStageChange?.(updated, PIPELINE_NODES[updated]?.id);
              return updated;
            });
          }
        } catch {
          // Ignored malformed event data
        }
      };

      eventSource.onerror = () => {
        // SSE closed or reconnecting
      };
    } catch {
      // EventSource failed or unsupported
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [jobId, onLiveStageChange]);

  const currentIndex = liveStageIndex;
  const failedIndex = failedStage ? normalizeStageIndex(failedStage) : -1;
  const isFailed = failedIndex >= 0;

  return (
    <div className={`w-full overflow-x-auto py-4 select-none ${className}`}>
      <div className="flex w-full min-w-[760px] items-center justify-between gap-1 px-4">
        {PIPELINE_NODES.map((node, index) => {
          const isComplete = index < currentIndex;
          const isActive = index === currentIndex;
          const isNodeFailed = isFailed && (index === failedIndex || (failedIndex === 0 && index === 0));

          return (
            <div className="flex flex-1 flex-col items-center gap-3" key={node.id}>
              <div className="relative flex w-full items-center">
                {/* Left Connector Segment */}
                {index > 0 && (
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    {index <= currentIndex && (
                      <div className="h-full w-full bg-gradient-to-r from-neon-cyan/80 to-neon-cyan shadow-[0_0_10px_#32e6ff]" />
                    )}
                    {/* Light Pulse traveling along the completed link */}
                    {index <= currentIndex && (
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{
                          duration: 1.8,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: index * 0.25,
                        }}
                        className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white to-transparent opacity-90 blur-[1px]"
                      />
                    )}
                  </div>
                )}

                {/* Glowing Stage Node */}
                <div className="relative flex items-center justify-center mx-1">
                  {/* Active Radar Ripple Aura */}
                  {isActive && !isNodeFailed && (
                    <motion.div
                      animate={{ scale: [1, 2.2, 1], opacity: [0.7, 0, 0.7] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute h-8 w-8 rounded-full bg-neon-cyan/30 shadow-[0_0_20px_#32e6ff]"
                    />
                  )}

                  {/* Failed Alert Aura */}
                  {isNodeFailed && (
                    <motion.div
                      animate={{ scale: [1, 2.2, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute h-8 w-8 rounded-full bg-neon-red/40 shadow-[0_0_20px_#ff365e]"
                    />
                  )}

                  {/* Core Node Disc */}
                  <motion.div
                    animate={isActive && !isNodeFailed ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-xs font-black transition-all duration-300 ${
                      isNodeFailed
                        ? 'border-2 border-neon-red bg-neon-red/20 text-neon-red shadow-[0_0_20px_#ff365e]'
                        : isActive
                        ? 'border-2 border-neon-cyan bg-neon-cyan/25 text-white shadow-[0_0_24px_#32e6ff] ring-2 ring-neon-cyan/50'
                        : isComplete
                        ? 'border border-neon-cyan/70 bg-neon-cyan/15 text-neon-cyan shadow-[0_0_12px_rgba(50,230,255,0.3)]'
                        : 'border border-white/10 bg-slate-900/80 text-slate-500'
                    }`}
                  >
                    {isComplete ? '✓' : index + 1}
                  </motion.div>
                </div>

                {/* Right Connector Segment */}
                {index < PIPELINE_NODES.length - 1 && (
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    {index < currentIndex && (
                      <div className="h-full w-full bg-gradient-to-r from-neon-cyan to-neon-cyan/80 shadow-[0_0_10px_#32e6ff]" />
                    )}
                    {/* Light Pulse traveling rightward */}
                    {index < currentIndex && (
                      <motion.div
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{
                          duration: 1.8,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: index * 0.25 + 0.15,
                        }}
                        className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-white to-transparent opacity-90 blur-[1px]"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Node Label & Subtext */}
              <div className="flex flex-col items-center">
                <span
                  className={`text-center text-[0.72rem] font-medium leading-tight transition-colors duration-300 ${
                    isNodeFailed
                      ? 'font-bold text-neon-red drop-shadow-[0_0_8px_#ff365e]'
                      : isActive
                      ? 'font-extrabold text-neon-cyan drop-shadow-[0_0_12px_rgba(50,230,255,0.6)]'
                      : isComplete
                      ? 'text-slate-200'
                      : 'text-slate-500'
                  }`}
                >
                  {node.label}
                </span>
                {isActive && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[0.6rem] font-bold text-neon-cyan tracking-wider uppercase">
                    <span className="h-1 w-1 rounded-full bg-neon-cyan animate-ping" />
                    Active
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PipelineVisualizer;
