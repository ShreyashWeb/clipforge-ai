import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { SafeCanvas } from './SafeCanvas.jsx';
import { NeonButton } from './NeonButton.jsx';

function SceneCard({ scene, index, selectedIndex, onSelect }) {
  const texture = useTexture(scene.imageUrl);
  const offset = index - selectedIndex;
  const visible = Math.abs(offset) <= 2;
  const targetX = offset * 2.15;
  const targetY = Math.abs(offset) * 0.22;
  const targetRotation = offset * -0.2;

  return (
    <motion.group
      animate={{
        position: [targetX, -targetY, Math.abs(offset) * -0.35],
        rotation: [0, targetRotation, 0],
        scale: offset === 0 ? 1 : 0.78,
      }}
      initial={false}
      transition={{ type: 'spring', stiffness: 100, damping: 16 }}
      visible={visible}
      onClick={() => onSelect(index)}
    >
      <mesh>
        <planeGeometry args={[2, 3.15]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </motion.group>
  );
}

function CarouselScene({ scenes, selectedIndex, onSelect }) {
  return (
    <>
      <ambientLight intensity={1} />
      {scenes.map((scene, index) => (
        <SceneCard
          index={index}
          key={scene.sceneNo}
          onSelect={onSelect}
          scene={scene}
          selectedIndex={selectedIndex}
        />
      ))}
    </>
  );
}

function CarouselFallback({ scenes, selectedIndex, onSelect }) {
  return (
    <div className="flex snap-x gap-4 overflow-x-auto pb-4">
      {scenes.map((scene, index) => (
        <button
          className={`w-40 shrink-0 snap-center overflow-hidden rounded-xl border text-left ${
            index === selectedIndex ? 'border-neon-cyan' : 'border-white/10'
          }`}
          key={scene.sceneNo}
          onClick={() => onSelect(index)}
          type="button"
        >
          <img alt={`Scene ${scene.sceneNo}`} className="aspect-[2/3] w-full object-cover" src={scene.imageUrl} />
          <span className="block p-2 text-xs text-slate-300">Scene {scene.sceneNo}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Displays storyboard scenes as an interactive 3D card carousel with a 2D fallback.
 *
 * @param {{ scenes: Array<{sceneNo: number, imageUrl: string, narration: string, supported?: boolean}>, onApprove?: (scene: object) => void, onRegenerate?: (scene: object) => void }} props
 * @returns {import('react').ReactNode}
 */
export function StoryboardCarousel({ scenes = [], onApprove, onRegenerate }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedScene = scenes[selectedIndex];
  const select = (index) => setSelectedIndex((index + scenes.length) % scenes.length);
  const move = (direction) => select(selectedIndex + direction);

  const fallback = useMemo(
    () => <CarouselFallback onSelect={select} scenes={scenes} selectedIndex={selectedIndex} />,
    [scenes, selectedIndex],
  );

  if (!scenes.length) return null;

  return (
    <section className="space-y-5">
      <div className="relative h-[22rem] overflow-hidden">
        <SafeCanvas
          camera={{ position: [0, 0, 8], fov: 38 }}
          fallback={fallback}
        >
          <CarouselScene onSelect={select} scenes={scenes} selectedIndex={selectedIndex} />
        </SafeCanvas>
        <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
          <button
            aria-label="Previous scene"
            className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-2 text-white"
            onClick={() => move(-1)}
            type="button"
          >←</button>
          <button
            aria-label="Next scene"
            className="pointer-events-auto rounded-full border border-white/20 bg-black/50 px-3 py-2 text-white"
            onClick={() => move(1)}
            type="button"
          >→</button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl"
          exit={{ opacity: 0, y: 6 }}
          initial={{ opacity: 0, y: -6 }}
          key={selectedScene.sceneNo}
        >
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="font-semibold text-white">Scene {selectedScene.sceneNo}</h3>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs ${
                selectedScene.supported === false
                  ? 'border-amber-300/40 bg-amber-300/10 text-amber-200'
                  : 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200'
              }`}
            >
              {selectedScene.supported === false ? 'Unsupported' : 'Supported'}
            </span>
          </div>
          <p className="mb-5 text-sm leading-6 text-slate-300">{selectedScene.narration}</p>
          <div className="flex gap-3">
            <NeonButton onClick={() => onApprove?.(selectedScene)}>Approve</NeonButton>
            <NeonButton onClick={() => onRegenerate?.(selectedScene)} tone="red">Regenerate</NeonButton>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
