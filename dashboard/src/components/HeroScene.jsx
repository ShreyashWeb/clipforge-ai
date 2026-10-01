import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SafeCanvas } from './SafeCanvas.jsx';

const particleCount = 1800;

function WaveformOrb({ intensity }) {
  const points = useRef();
  const invalidate = useThree((state) => state.invalidate);
  const pointer = useRef({ x: 0, y: 0 });
  const positions = useMemo(() => {
    const values = new Float32Array(particleCount * 3);
    for (let index = 0; index < particleCount; index += 1) {
      const phi = Math.acos(1 - (2 * (index + 0.5)) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * index;
      const radius = 1.75 + Math.sin(theta * 3) * 0.08;
      values[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      values[index * 3 + 1] = radius * Math.cos(phi);
      values[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    return values;
  }, []);

  const colors = useMemo(() => {
    const values = new Float32Array(particleCount * 3);
    const red = new THREE.Color('#ff365e');
    const cyan = new THREE.Color('#32e6ff');
    const color = new THREE.Color();
    for (let index = 0; index < particleCount; index += 1) {
      color.lerpColors(red, cyan, index / particleCount);
      values[index * 3] = color.r;
      values[index * 3 + 1] = color.g;
      values[index * 3 + 2] = color.b;
    }
    return values;
  }, []);

  useFrame(({ clock, pointer: framePointer }) => {
    if (!points.current) return;
    const time = clock.getElapsedTime();
    const pulse = 1 + Math.sin(time * 2.2) * 0.045 * intensity;
    points.current.scale.setScalar(pulse);
    points.current.rotation.y += 0.0018;
    points.current.rotation.x = Math.sin(time * 0.25) * 0.08;
    pointer.current.x += (framePointer.x * 0.18 - pointer.current.x) * 0.04;
    pointer.current.y += (framePointer.y * 0.12 - pointer.current.y) * 0.04;
    points.current.position.x = pointer.current.x;
    points.current.position.y = pointer.current.y;
    invalidate();
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035 + intensity * 0.018}
        vertexColors
        transparent
        opacity={0.78}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function CssFallback() {
  return <div aria-hidden="true" className="hero-orb-fallback" />;
}

/**
 * Displays the animated hero orb with a safe CSS fallback.
 *
 * @param {{ intensity?: number }} props
 * @returns {import('react').ReactNode}
 */
export function HeroScene({ intensity = 0.7 }) {
  const safeIntensity = Math.max(0, Math.min(1, intensity));
  const [fallback, setFallback] = useState(false);

  return (
    <div className={`hero-scene ${fallback ? 'hero-scene-fallback' : ''}`}>
      <SafeCanvas
        camera={{ position: [0, 0, 6.5], fov: 45 }}
        fallback={<CssFallback />}
        onCreated={() => setFallback(false)}
        onError={() => setFallback(true)}
      >
        <ambientLight intensity={0.3} />
        <WaveformOrb intensity={safeIntensity} />
      </SafeCanvas>
    </div>
  );
}
