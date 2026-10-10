import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SafeCanvas } from './SafeCanvas.jsx';

const particleCount = 2600;

// Curated smooth color transitions
const COLOR_PALETTES = [
  // 1. Cyberpunk Neon: Cyan -> Electric Crimson
  { start: new THREE.Color('#32e6ff'), end: new THREE.Color('#ff365e') },
  // 2. Solar Horizon: Amber Gold -> Emerald Green
  { start: new THREE.Color('#f59e0b'), end: new THREE.Color('#10b981') },
  // 3. Deep Astral: Ultraviolet Purple -> Rose Fuchsia
  { start: new THREE.Color('#a855f7'), end: new THREE.Color('#ec4899') },
  // 4. Hyperdrive: Deep Sky Blue -> Pure Icy White
  { start: new THREE.Color('#38bdf8'), end: new THREE.Color('#ffffff') },
];

/**
 * Pure, Minimalist, Ultra-Smooth Harmonic Particle Waveform Orb.
 * - Removed inner core and outer rings for clean elegance.
 * - Silky smooth cursor inertia and continuous color morphing.
 * - Gentle fluid ripple dynamics on click.
 */
function SmoothWaveformOrb({ intensity, paletteIndex, setPaletteIndex }) {
  const pointsRef = useRef();
  const groupRef = useRef();
  const shockwaveRef = useRef({ time: 0, active: false });
  const spinVelocityRef = useRef(0);
  const hoverScaleRef = useRef(1.0);

  // Active morphing colors buffer
  const currentColors = useRef(null);

  // Generate Base Golden-Spiral Fibonacci Spherical Coordinates
  const { basePositions, phiTheta } = useMemo(() => {
    const base = new Float32Array(particleCount * 3);
    const angles = [];
    for (let index = 0; index < particleCount; index += 1) {
      const phi = Math.acos(1 - (2 * (index + 0.5)) / particleCount);
      const theta = Math.PI * (1 + Math.sqrt(5)) * index;
      const radius = 1.95;

      base[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      base[index * 3 + 1] = radius * Math.cos(phi);
      base[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      angles.push({ phi, theta, radius });
    }
    return { basePositions: base, phiTheta: angles };
  }, []);

  // Initialize colors buffer
  const initialColors = useMemo(() => {
    const values = new Float32Array(particleCount * 3);
    const { start, end } = COLOR_PALETTES[0];
    const tempColor = new THREE.Color();

    for (let index = 0; index < particleCount; index += 1) {
      const ratio = index / particleCount;
      tempColor.lerpColors(start, end, ratio);
      values[index * 3] = tempColor.r;
      values[index * 3 + 1] = tempColor.g;
      values[index * 3 + 2] = tempColor.b;
    }
    currentColors.current = new Float32Array(values);
    return values;
  }, []);

  // Click Handler: Smooth ripple wave, silky color shift, gentle spin boost
  const handlePointerDown = (e) => {
    e.stopPropagation();
    shockwaveRef.current = { time: 0, active: true };
    spinVelocityRef.current = 6.0;
    setPaletteIndex((prev) => (prev + 1) % COLOR_PALETTES.length);
  };

  const handlePointerOver = () => {
    hoverScaleRef.current = 1.05;
  };

  const handlePointerOut = () => {
    hoverScaleRef.current = 1.0;
  };

  useFrame((state, delta) => {
    if (!pointsRef.current || !groupRef.current) return;
    const time = state.clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.attributes.position;
    const colorAttr = pointsRef.current.geometry.attributes.color;
    const posArr = posAttr.array;
    const colArr = colorAttr.array;

    // 1. Silky Smooth Mouse Tracking with Low-Pass Inertia
    const targetRotY = (state.pointer.x * Math.PI) / 5;
    const targetRotX = (-state.pointer.y * Math.PI) / 7;

    if (spinVelocityRef.current > 0.02) {
      groupRef.current.rotation.y += spinVelocityRef.current * delta;
      spinVelocityRef.current = THREE.MathUtils.lerp(spinVelocityRef.current, 0, delta * 2.8);
    } else {
      // Natural serene rotation combined with cursor follow
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotY + time * 0.12,
        delta * 2.2,
      );
    }
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotX,
      delta * 2.2,
    );

    // 2. Smooth Shockwave Expansion
    if (shockwaveRef.current.active) {
      shockwaveRef.current.time += delta * 2.5;
      if (shockwaveRef.current.time > 2.5) {
        shockwaveRef.current.active = false;
      }
    }

    const shockTime = shockwaveRef.current.time;
    const isShockActive = shockwaveRef.current.active;

    // 3. Liquid-Smooth Surface Harmonic Wave Physics
    for (let i = 0; i < particleCount; i++) {
      const { phi, theta, radius } = phiTheta[i];
      const i3 = i * 3;

      // Gentle, organic harmonic frequencies (lowered for calm, fluid flow)
      const harmonicWave =
        Math.sin(theta * 3 + time * 1.5) * 0.055 * intensity +
        Math.cos(phi * 2.5 - time * 1.1) * 0.045 * intensity +
        Math.sin(theta * 2 + phi * 2 + time * 1.8) * 0.025;

      // Smooth gaussian bell-curve ripple
      let rippleDisplacement = 0;
      if (isShockActive) {
        const rippleDistance = shockTime * 1.2;
        const diff = Math.abs(radius - rippleDistance);
        if (diff < 0.5) {
          rippleDisplacement = Math.exp(-Math.pow(diff / 0.2, 2)) * 0.22 * Math.max(0, 1 - shockTime / 2.5);
        }
      }

      const totalRadius = radius + harmonicWave + rippleDisplacement;

      posArr[i3] = totalRadius * Math.sin(phi) * Math.cos(theta);
      posArr[i3 + 1] = totalRadius * Math.cos(phi);
      posArr[i3 + 2] = totalRadius * Math.sin(phi) * Math.sin(theta);
    }

    posAttr.needsUpdate = true;

    // 4. Continuous Silky Color Morphing
    const { start: targetStart, end: targetEnd } = COLOR_PALETTES[paletteIndex];
    const tempTargetColor = new THREE.Color();
    const colorMorphSpeed = delta * 3.2;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const ratio = i / particleCount;
      tempTargetColor.lerpColors(targetStart, targetEnd, ratio);

      colArr[i3] = THREE.MathUtils.lerp(colArr[i3], tempTargetColor.r, colorMorphSpeed);
      colArr[i3 + 1] = THREE.MathUtils.lerp(colArr[i3 + 1], tempTargetColor.g, colorMorphSpeed);
      colArr[i3 + 2] = THREE.MathUtils.lerp(colArr[i3 + 2], tempTargetColor.b, colorMorphSpeed);
    }

    colorAttr.needsUpdate = true;

    // 5. Breathing Scale & Hover Damping
    const currentScale = groupRef.current.scale.x;
    const targetScale = hoverScaleRef.current * (1 + Math.sin(time * 1.6) * 0.025 * intensity);
    groupRef.current.scale.setScalar(THREE.MathUtils.lerp(currentScale, targetScale, delta * 4));
  });

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      cursor="pointer"
    >
      {/* Pure, Clean Waveform Particle Orb */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[basePositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[initialColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.038 + intensity * 0.014}
          vertexColors
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

function CssFallback() {
  return <div aria-hidden="true" className="hero-orb-fallback" />;
}

/**
 * Clean, Pure, Ultra-Smooth Harmonic Waveform Orb.
 *
 * @param {{ intensity?: number }} props
 * @returns {import('react').ReactNode}
 */
export function HeroScene({ intensity = 0.8 }) {
  const safeIntensity = Math.max(0, Math.min(1.2, intensity));
  const [fallback, setFallback] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);

  return (
    <div className={`hero-scene ${fallback ? 'hero-scene-fallback' : ''}`}>
      <SafeCanvas
        camera={{ position: [0, 0, 6.2], fov: 45 }}
        fallback={<CssFallback />}
        onCreated={() => setFallback(false)}
        onError={() => setFallback(true)}
      >
        <ambientLight intensity={0.4} />
        <SmoothWaveformOrb
          intensity={safeIntensity}
          paletteIndex={paletteIndex}
          setPaletteIndex={setPaletteIndex}
        />
      </SafeCanvas>
    </div>
  );
}

export default HeroScene;
