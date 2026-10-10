import { useEffect, useRef, useState } from 'react';
import { NeonButton } from './NeonButton.jsx';

const voicePersonas = [
  { id: 'cyber', name: '⚡ Cyber Tech', rate: 1.15, pitch: 1.1, voiceFilter: ['Google', 'David', 'Alex', 'Natural'] },
  { id: 'studio-male', name: '🎙️ Studio Male', rate: 1.0, pitch: 1.0, voiceFilter: ['David', 'George', 'Guy', 'Natural'] },
  { id: 'studio-female', name: '👩‍💼 Studio Female', rate: 1.0, pitch: 1.05, voiceFilter: ['Samantha', 'Zira', 'Jenny', 'Natural'] },
  { id: 'cinematic', name: '🎬 Cinematic Deep', rate: 0.9, pitch: 0.85, voiceFilter: ['Daniel', 'Oliver', 'Natural'] },
];

/**
 * Ultra-responsive native interactive video player engine.
 * Supports synchronized Web Speech API narration, Web Audio synthesizer ambiance,
 * dynamic karaoke captions, interactive scene timeline, aspect ratio toggling,
 * fullscreen theater mode, voice personas, and script export.
 */
export function InteractiveVideoPlayer({
  topic = 'AI Short Video',
  scenes = [],
  aspectRatio = 'vertical', // 'vertical' (9:16) or 'cinematic' (16:9)
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [sceneProgress, setSceneProgress] = useState(0); // 0 to 100
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedPersona, setSelectedPersona] = useState(voicePersonas[0]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  const cleanTopicName = (topic || 'AI Short Video').trim();
  const safeScenes = scenes.length > 0 ? scenes : [
    {
      sceneNo: 1,
      narration: `${cleanTopicName}: Discover the breakthrough that is transforming the future.`,
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`cinematic 8k 9:16 vertical shot, ${cleanTopicName} introduction, high tech futuristic laboratory, dramatic neon lighting`)}?width=1080&height=1920&nologo=true`,
      duration: 4,
    },
    {
      sceneNo: 2,
      narration: `Connecting evidence with verified source code and real-time execution for ${cleanTopicName}.`,
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`detailed close up, ${cleanTopicName} core technology mechanism, holographic user interface, glowing data streams, 8k vertical`)}?width=1080&height=1920&nologo=true`,
      duration: 4,
    },
    {
      sceneNo: 3,
      narration: `From concept to execution in milliseconds. Welcome to the next generation of ${cleanTopicName}.`,
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(`futuristic cityscape with ${cleanTopicName} technology in action, cinematic 8k vertical 9:16`)}?width=1080&height=1920&nologo=true`,
      duration: 4,
    },
  ];

  const currentScene = safeScenes[currentSceneIndex] || safeScenes[0];

  // Play ambient audio chime using Web Audio API
  const playBeep = () => {
    if (isMuted || volume === 0) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440 + currentSceneIndex * 80, ctx.currentTime);
      gain.gain.setValueAtTime(0.04 * volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // AudioContext not allowed before user interaction
    }
  };

  // Speak narration with Web Speech API for voice synthesis
  const speakNarration = (text) => {
    if (isMuted || volume === 0 || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = selectedPersona.rate * playbackSpeed;
    utterance.pitch = selectedPersona.pitch;
    utterance.volume = volume;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((v) =>
      v.lang.startsWith('en') && selectedPersona.voiceFilter.some((name) => v.name.includes(name)),
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) utterance.voice = preferredVoice;
    window.speechSynthesis.speak(utterance);
    playBeep();
  };

  const playScene = (index) => {
    setCurrentSceneIndex(index);
    setSceneProgress(0);

    const scene = safeScenes[index];
    if (scene) {
      speakNarration(scene.narration);
    }

    const duration = ((scene?.duration || 4) * 1000) / playbackSpeed;
    const startTime = Date.now();

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setSceneProgress(pct);
    }, 40);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index + 1 < safeScenes.length) {
        playScene(index + 1);
      } else {
        setIsPlaying(false);
        setSceneProgress(100);
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      }
    }, duration);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      setIsPlaying(true);
      if (currentSceneIndex >= safeScenes.length - 1 && sceneProgress >= 100) {
        playScene(0);
      } else {
        playScene(currentSceneIndex);
      }
    }
  };

  const handleRestart = () => {
    setIsPlaying(true);
    playScene(0);
  };

  const handleSelectScene = (index) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setCurrentSceneIndex(index);
    setSceneProgress(0);
    if (isPlaying) {
      playScene(index);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Split narration into highlighted words for dynamic synchronized captions
  const words = (currentScene.narration || '').split(' ');
  const activeWordIndex = Math.min(
    words.length - 1,
    Math.floor((sceneProgress / 100) * words.length),
  );

  const exportMarkdown = () => {
    let md = `# ClipForge AI: ${topic}\n\n`;
    safeScenes.forEach((s, idx) => {
      md += `### Scene ${idx + 1} (${s.duration || 4}s)\n`;
      md += `**Narration:** "${s.narration}"\n`;
      if (s.visualPrompt) md += `**Visual Prompt:** ${s.visualPrompt}\n`;
      md += `**Visual Image:** ${s.imageUrl}\n\n`;
    });
    return md;
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(exportMarkdown());
    setCopyFeedback('Copied script markdown to clipboard!');
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  const handleDownloadJSON = () => {
    const data = {
      topic,
      scenes: safeScenes,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipforge-${topic.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div ref={containerRef} className={`flex flex-col items-center w-full ${isFullscreen ? 'bg-black p-6 min-h-screen justify-center' : ''}`}>
      {/* Video Viewport Stage */}
      <div
        className={`relative overflow-hidden rounded-2xl border-2 border-neon-cyan/50 bg-black shadow-[0_0_50px_rgba(50,230,255,0.2)] transition-all duration-300 ${
          isFullscreen
            ? 'h-[85vh] aspect-[9/16]'
            : aspectRatio === 'vertical'
              ? 'aspect-[9/16] w-full max-w-[340px]'
              : 'aspect-video w-full max-w-2xl'
        }`}
      >
        {/* Animated Background Visual with Ken Burns Pan/Zoom */}
        <div
          key={currentSceneIndex}
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[4000ms] ease-out"
          style={{
            backgroundImage: `url(${currentScene.imageUrl})`,
            transform: isPlaying ? 'scale(1.12) translate(-2%, -2%)' : 'scale(1.0)',
          }}
        />

        {/* Ambient Dark Gradients & Cyber Scanlines Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

        {/* Top Video HUD */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 items-center justify-center">
              <span className={`h-2 w-2 rounded-full ${isPlaying ? 'animate-ping bg-neon-red' : 'bg-neon-cyan'}`} />
            </span>
            <span className="rounded-md bg-black/60 px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-widest text-neon-cyan backdrop-blur-md border border-neon-cyan/30">
              Scene {currentSceneIndex + 1}/{safeScenes.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaybackSpeed((s) => (s === 1 ? 1.25 : s === 1.25 ? 1.5 : 1))}
              className="rounded-md bg-black/60 px-2 py-0.5 text-[0.65rem] font-mono font-bold text-slate-300 backdrop-blur-md transition hover:bg-black/80 hover:text-neon-cyan"
              type="button"
              title="Playback speed"
            >
              {playbackSpeed}x
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="rounded-full bg-black/60 p-1.5 text-xs text-white backdrop-blur-md transition hover:bg-black/80"
              type="button"
              title={isMuted ? 'Unmute voice narration' : 'Mute voice narration'}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={toggleFullscreen}
              className="rounded-full bg-black/60 p-1.5 text-xs text-white backdrop-blur-md transition hover:bg-black/80"
              type="button"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Theater Mode'}
            >
              {isFullscreen ? '↙️' : '⛶'}
            </button>
          </div>
        </div>

        {/* Center Big Play Overlay when Paused */}
        {!isPlaying && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
            <button
              onClick={handleTogglePlay}
              className="group flex h-20 w-20 items-center justify-center rounded-full border-2 border-neon-cyan bg-black/80 text-3xl text-neon-cyan shadow-[0_0_35px_rgba(50,230,255,0.5)] transition-all duration-200 hover:scale-110 hover:bg-neon-cyan hover:text-black"
              type="button"
            >
              ▶
            </button>
            <span className="mt-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
              Click to Watch AI Video
            </span>
          </div>
        )}

        {/* Sound Waveform Equalizer when Playing */}
        {isPlaying && !isMuted && (
          <div className="absolute right-4 top-14 z-20 flex items-end gap-1">
            {[0.4, 0.9, 0.6, 1, 0.7, 0.3].map((height, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-neon-cyan shadow-[0_0_8px_#32e6ff]"
                style={{
                  height: `${height * 20}px`,
                  animation: `pulse 0.6s infinite alternate ${i * 0.15}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Dynamic TikTok / Reels Animated Captions */}
        <div className="absolute inset-x-3 bottom-14 z-20 text-center">
          <div className="inline-block rounded-xl bg-black/80 px-4 py-2.5 shadow-2xl backdrop-blur-md border border-white/10">
            <p className="text-sm font-black leading-snug tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
              {words.map((word, index) => (
                <span
                  key={index}
                  className={`inline-block px-0.5 transition-colors duration-150 ${
                    index === activeWordIndex
                      ? 'scale-110 font-black text-amber-300 drop-shadow-[0_0_12px_#fde047]'
                      : index < activeWordIndex
                        ? 'text-white'
                        : 'text-slate-400'
                  }`}
                >
                  {word}{' '}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Bottom Multi-Segment Story Progress Bars */}
        <div className="absolute inset-x-3 bottom-3 z-20 flex gap-1.5">
          {safeScenes.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectScene(i)}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20 transition hover:bg-white/40 cursor-pointer"
            >
              <div
                className="h-full bg-neon-cyan shadow-[0_0_8px_#32e6ff] transition-all duration-75"
                style={{
                  width:
                    i < currentSceneIndex
                      ? '100%'
                      : i === currentSceneIndex
                        ? `${sceneProgress}%`
                        : '0%',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Voice Persona & Audio Settings */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 max-w-xl">
        <span className="text-xs font-bold text-neon-cyan uppercase tracking-wider mr-1">Voice Persona:</span>
        {voicePersonas.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => setSelectedPersona(persona)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              selectedPersona.id === persona.id
                ? 'border border-neon-cyan bg-neon-cyan/20 text-white shadow-[0_0_10px_rgba(50,230,255,0.25)]'
                : 'border border-white/10 bg-black/40 text-slate-400 hover:text-white'
            }`}
          >
            {persona.name}
          </button>
        ))}
      </div>

      {/* Interactive Scene Navigation Strip */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {safeScenes.map((scene, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelectScene(idx)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              currentSceneIndex === idx
                ? 'border border-neon-cyan bg-neon-cyan/20 text-neon-cyan shadow-[0_0_12px_rgba(50,230,255,0.3)]'
                : 'border border-white/10 bg-white/[0.03] text-slate-400 hover:text-white'
            }`}
          >
            Scene {idx + 1}
          </button>
        ))}
      </div>

      {/* Control Bar Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <NeonButton onClick={handleTogglePlay} className="px-6 py-2.5">
          {isPlaying ? '⏸ Pause' : '▶ Play Video'}
        </NeonButton>
        <NeonButton onClick={handleRestart} tone="red" className="px-5 py-2.5">
          ↺ Restart
        </NeonButton>
        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          className="rounded-xl border border-white/20 bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan"
        >
          📥 Export Script / Storyboard
        </button>
      </div>

      {/* Export Script Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-lg rounded-2xl border border-neon-cyan/50 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-white">Export Script & Storyboard</h3>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-300">
                Download or copy the full storyboard scenes, narration lines, and visual prompts for "{topic}".
              </p>

              <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-xs text-slate-300">
                <pre className="whitespace-pre-wrap">{exportMarkdown()}</pre>
              </div>

              {copyFeedback && (
                <p className="text-xs font-bold text-emerald-400">{copyFeedback}</p>
              )}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="rounded-xl border border-neon-cyan/50 bg-neon-cyan/15 px-4 py-2 text-xs font-bold text-neon-cyan hover:bg-neon-cyan hover:text-black transition"
                >
                  📋 Copy Markdown
                </button>
                <NeonButton onClick={handleDownloadJSON}>
                  💾 Download JSON
                </NeonButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
