import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { NeonButton } from './NeonButton.jsx';

const visualStylePresets = [
  '⚡ Cyberpunk HUD & Neon Glow',
  '🎬 Cinematic 35mm Photography',
  '🔬 Technical Vector Diagram & Flowchart',
  '🌌 Photorealistic 3D Octane Render',
];

/**
 * Displays storyboard scenes as an interactive 3D perspective card carousel with inline editing.
 *
 * @param {{
 *   scenes: Array<{sceneNo?: number, scene?: number, imageUrl: string, narration: string, visualPrompt?: string, duration?: number, supported?: boolean}>,
 *   onApprove?: (scene: object) => void,
 *   onRegenerate?: (scene: object, visualPrompt?: string) => void,
 *   onUpdateScene?: (updatedScene: object, index: number) => void
 * }} props
 * @returns {import('react').ReactNode}
 */
export function StoryboardCarousel({ scenes = [], onApprove, onRegenerate, onUpdateScene }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editNarration, setEditNarration] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(visualStylePresets[0]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  if (!scenes || scenes.length === 0) return null;

  const selectedScene = scenes[selectedIndex] || scenes[0];
  const select = (index) => {
    const newIdx = (index + scenes.length) % scenes.length;
    setSelectedIndex(newIdx);
    setIsEditing(false);
  };
  const move = (direction) => select(selectedIndex + direction);
  const currentSceneNum = selectedScene.sceneNo || selectedScene.scene || selectedIndex + 1;

  const handleStartEdit = () => {
    setEditNarration(selectedScene.narration || '');
    setEditPrompt(selectedScene.visualPrompt || `High-tech visual representation for: ${selectedScene.narration}`);
    setCustomImageUrl(selectedScene.imageUrl || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const updated = {
      ...selectedScene,
      narration: editNarration,
      visualPrompt: editPrompt,
      imageUrl: customImageUrl || selectedScene.imageUrl,
    };
    onUpdateScene?.(updated, selectedIndex);
    setIsEditing(false);
  };

  const handleTriggerRegen = async () => {
    setIsRegenerating(true);
    const combinedPrompt = `${editPrompt || selectedScene.visualPrompt || selectedScene.narration}, style: ${selectedStyle}`;
    try {
      if (onRegenerate) {
        await onRegenerate({ ...selectedScene, visualPrompt: combinedPrompt }, combinedPrompt);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* 3D Perspective Carousel Stage */}
      <div className="relative flex h-80 w-full items-center justify-center overflow-hidden [perspective:1200px]">
        <div className="relative flex h-full w-full items-center justify-center [transform-style:preserve-3d]">
          {scenes.map((scene, index) => {
            const offset = index - selectedIndex;
            const isSelected = offset === 0;
            const isVisible = Math.abs(offset) <= 2;
            const sceneNum = scene.sceneNo || scene.scene || index + 1;

            if (!isVisible) return null;

            const translateX = offset * 220;
            const translateZ = -Math.abs(offset) * 140;
            const rotateY = offset * -25;
            const scale = isSelected ? 1 : 0.82;
            const opacity = isSelected ? 1 : 0.55;
            const zIndex = 30 - Math.abs(offset) * 10;

            return (
              <motion.div
                key={sceneNum}
                animate={{
                  x: translateX,
                  z: translateZ,
                  rotateY: rotateY,
                  scale: scale,
                  opacity: opacity,
                }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                onClick={() => select(index)}
                style={{ zIndex }}
                className={`absolute aspect-[9/16] h-72 cursor-pointer overflow-hidden rounded-2xl border transition-shadow duration-300 ${
                  isSelected
                    ? 'border-neon-cyan/90 shadow-[0_0_32px_rgba(50,230,255,0.35)] ring-2 ring-neon-cyan/40'
                    : 'border-white/10 shadow-xl hover:border-white/30'
                }`}
              >
                <img
                  alt={`Scene ${sceneNum}`}
                  className="h-full w-full object-cover"
                  src={scene.imageUrl}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="rounded-md bg-black/60 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-md">
                    Scene {sceneNum}
                  </span>
                  {scene.duration && (
                    <span className="text-[0.65rem] text-slate-300">
                      {scene.duration}s
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Carousel Arrow Controls */}
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-40 flex -translate-y-1/2 justify-between">
          <button
            aria-label="Previous scene"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-lg text-white backdrop-blur-md transition hover:border-neon-cyan hover:bg-black/90 hover:text-neon-cyan hover:shadow-[0_0_16px_rgba(50,230,255,0.4)]"
            onClick={() => move(-1)}
            type="button"
          >
            ←
          </button>
          <button
            aria-label="Next scene"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-lg text-white backdrop-blur-md transition hover:border-neon-cyan hover:bg-black/90 hover:text-neon-cyan hover:shadow-[0_0_16px_rgba(50,230,255,0.4)]"
            onClick={() => move(1)}
            type="button"
          >
            →
          </button>
        </div>
      </div>

      {/* Selected Scene Details, Editor & Action Card */}
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl"
          exit={{ opacity: 0, y: 6 }}
          initial={{ opacity: 0, y: -6 }}
          key={currentSceneNum}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-white">Scene {currentSceneNum}</h3>
              {selectedScene.duration && (
                <span className="text-xs text-muted">{selectedScene.duration} seconds</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  selectedScene.supported === false
                    ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
                    : 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200'
                }`}
              >
                {selectedScene.supported === false ? '● Unsupported' : '✓ Grounding Verified'}
              </span>
              <button
                type="button"
                onClick={isEditing ? () => setIsEditing(false) : handleStartEdit}
                className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-neon-cyan hover:text-neon-cyan"
              >
                {isEditing ? '✕ Cancel Edit' : '✏️ Edit Scene & Prompt'}
              </button>
            </div>
          </div>

          {!isEditing ? (
            <>
              <p className="mb-5 text-sm leading-6 text-slate-300">{selectedScene.narration}</p>
              {selectedScene.visualPrompt && (
                <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-slate-400">
                  <span className="font-bold text-neon-cyan uppercase tracking-wider block mb-1">Visual Prompt</span>
                  {selectedScene.visualPrompt}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <NeonButton onClick={() => onApprove?.(selectedScene)}>✓ Approve Scene</NeonButton>
                <NeonButton onClick={handleTriggerRegen} tone="red" disabled={isRegenerating}>
                  {isRegenerating ? 'Regenerating Image...' : '↺ Regenerate Visual'}
                </NeonButton>
              </div>
            </>
          ) : (
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neon-cyan mb-1.5">
                  Narration Text (Speech Script)
                </label>
                <textarea
                  value={editNarration}
                  onChange={(e) => setEditNarration(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/20 bg-black/60 p-3 text-sm text-white placeholder-slate-500 outline-none focus:border-neon-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neon-cyan mb-1.5">
                  Visual Generation Prompt (Flux / SDXL)
                </label>
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/60 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-neon-cyan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Art & Camera Style Preset
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {visualStylePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setSelectedStyle(preset)}
                      className={`rounded-lg border p-2.5 text-left text-xs transition ${
                        selectedStyle === preset
                          ? 'border-neon-cyan bg-neon-cyan/20 text-white'
                          : 'border-white/10 bg-black/30 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Direct Image URL (Optional override)
                </label>
                <input
                  type="text"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-neon-cyan"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <NeonButton onClick={handleSaveEdit}>💾 Save Changes</NeonButton>
                <NeonButton onClick={handleTriggerRegen} tone="red" disabled={isRegenerating}>
                  {isRegenerating ? 'Regenerating...' : '↺ Regenerate Image with Preset'}
                </NeonButton>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
