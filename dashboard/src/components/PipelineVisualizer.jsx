import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SafeCanvas } from './SafeCanvas.jsx';

const stages = ['Research', 'Interview', 'Angle Approval', 'Storyboard', 'Voice', 'Render', 'Publish'];

function stageState(index, currentStage, failedStage) {
  if (failedStage === stages[index]) return 'failed';
  if (index < stages.indexOf(currentStage)) return 'complete';
  if (stages[index] === currentStage) return 'active';
  return 'future';
}

function Node({ index, state }) {
  const ref = useRef();
  const color = state === 'failed' ? '#ff365e' : '#32e6ff';
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const pulse = state === 'active' ? 1 + Math.sin(clock.getElapsedTime() * 4) * 0.14 : 1;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <group ref={ref} position={[(index - 3) * 1.65, 0, 0]}>
      <mesh>
        <sphereGeometry args={[state === 'active' ? 0.16 : 0.12, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={state === 'future' ? 0.25 : 1}
        />
      </mesh>
      <pointLight color={color} intensity={state === 'future' ? 0.1 : 1.5} distance={1.5} />
      <Html center distanceFactor={8}>
        <span className={`pipeline-label pipeline-label-${state}`}>{stages[index]}</span>
      </Html>
    </group>
  );
}

function PipelineLines({ currentStage }) {
  const completed = Math.max(0, stages.indexOf(currentStage));
  const pulses = useMemo(
    () => Array.from({ length: Math.min(completed, 6) }, (_, index) => index),
    [completed],
  );

  return (
    <>
      {Array.from({ length: 6 }, (_, index) => {
        const isComplete = index < completed;
        return (
          <mesh key={`line-${index}`} position={[(index - 2.5) * 1.65, 0, 0]}>
            <boxGeometry args={[1.53, 0.018, 0.018]} />
            <meshBasicMaterial color="#32e6ff" transparent opacity={isComplete ? 0.7 : 0.12} />
          </mesh>
        );
      })}
      {pulses.map((index) => (
        <LightPulse key={`pulse-${index}`} index={index} />
      ))}
    </>
  );
}

function LightPulse({ index }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    const progress = (clock.getElapsedTime() * 0.32 + index * 0.2) % 1;
    if (ref.current) ref.current.position.x = (index - 3 + progress) * 1.65;
  });
  return (
    <mesh ref={ref} position={[(index - 3) * 1.65, 0, 0]}>
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}

function PipelineFallback({ currentStage, failedStage }) {
  return (
    <div className="flex w-full min-w-[680px] items-start justify-between gap-2">
      {stages.map((stage, index) => {
        const state = stageState(index, currentStage, failedStage);
        return (
          <div className="flex min-w-20 flex-1 flex-col items-center gap-3" key={stage}>
            <div className="flex w-full items-center">
              {index > 0 && (
                <div className={`h-0.5 flex-1 ${index <= stages.indexOf(currentStage) ? 'bg-neon-cyan' : 'bg-white/10'}`} />
              )}
              <motion.div
                animate={state === 'active' ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                className={`h-4 w-4 rounded-full ${
                  state === 'failed' ? 'bg-neon-red shadow-[0_0_16px_#ff365e]' :
                    state === 'future' ? 'bg-white/20' : 'bg-neon-cyan shadow-[0_0_16px_#32e6ff]'
                }`}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              {index < stages.length - 1 && (
                <div className={`h-0.5 flex-1 ${index < stages.indexOf(currentStage) ? 'bg-neon-cyan' : 'bg-white/10'}`} />
              )}
            </div>
            <span className="text-center text-[0.65rem] text-slate-300">{stage}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Displays the production pipeline with a fault-tolerant 2D fallback.
 *
 * @param {{ currentStage?: string, failedStage?: string }} props
 * @returns {import('react').ReactNode}
 */
export function PipelineVisualizer({ currentStage = 'Research', failedStage = '' }) {
  const fallback = <PipelineFallback currentStage={currentStage} failedStage={failedStage} />;
  return (
    <div className="w-full overflow-x-auto">
      <div className="h-44 min-w-[680px]">
        <SafeCanvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          fallback={fallback}
        >
          <PipelineLines currentStage={currentStage} />
          {stages.map((_, index) => (
            <Node
              index={index}
              key={stages[index]}
              state={stageState(index, currentStage, failedStage)}
            />
          ))}
        </SafeCanvas>
      </div>
    </div>
  );
}
