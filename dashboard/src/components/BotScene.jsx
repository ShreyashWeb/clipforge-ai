import React, { Component, Suspense, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SafeCanvas } from './SafeCanvas.jsx';

/**
 * 2D Fallback rendered when WebGL is unavailable or fails.
 */
export function Bot2DFallback({ status = 'idle', onClick }) {
  const isDelivered = status === 'delivered' || status === 'PUBLISHED';
  const isError = status === 'error' || status === 'FAILED';

  const glowColor = isError ? '#ef4444' : isDelivered ? '#10b981' : '#38bdf8';

  return (
    <div
      onClick={onClick}
      className="relative flex flex-col items-center justify-center p-6 select-none cursor-pointer transition-transform duration-300 hover:scale-105"
      style={{ minHeight: 280 }}
    >
      {/* 2D Robot SVG with glowing visor and pulsing ear lights */}
      <div className="relative animate-bounce" style={{ animationDuration: '3s' }}>
        <svg width="140" height="150" viewBox="0 0 140 150" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Ear Lights */}
          <circle cx="18" cy="45" r="10" fill="#0f172a" stroke={glowColor} strokeWidth="2.5" />
          <circle cx="18" cy="45" r="5" fill={glowColor} className="animate-pulse" />
          <circle cx="122" cy="45" r="10" fill="#0f172a" stroke={glowColor} strokeWidth="2.5" />
          <circle cx="122" cy="45" r="5" fill={glowColor} className="animate-pulse" />

          {/* Helmet Body */}
          <rect x="26" y="10" width="88" height="70" rx="35" fill="#090d16" stroke="#1e293b" strokeWidth="3" />
          
          {/* Glossy Visor */}
          <rect x="36" y="24" width="68" height="42" rx="21" fill="#020617" stroke={glowColor} strokeWidth="2" />
          
          {/* Smiling Face inside Visor */}
          {isError ? (
            // Dizzy/Error Eyes & Mouth
            <g stroke={glowColor} strokeWidth="2.5" strokeLinecap="round">
              <path d="M48 38L56 46M56 38L48 46" />
              <path d="M84 38L92 46M92 38L84 46" />
              <path d="M58 56Q70 50 82 56" fill="none" />
            </g>
          ) : isDelivered ? (
            // Joyful Happy Face
            <g stroke={glowColor} strokeWidth="2.5" strokeLinecap="round">
              <path d="M48 42Q52 36 56 42" fill="none" />
              <path d="M84 42Q88 36 92 42" fill="none" />
              <path d="M58 50Q70 62 82 50" fill="none" strokeWidth="3" />
            </g>
          ) : (
            // Friendly Smile Face
            <g stroke={glowColor} strokeWidth="2.5" strokeLinecap="round">
              <circle cx="52" cy="41" r="3" fill={glowColor} />
              <circle cx="88" cy="41" r="3" fill={glowColor} />
              <path d="M60 52Q70 60 80 52" fill="none" />
            </g>
          )}

          {/* Floating Torso */}
          <rect x="42" y="88" width="56" height="44" rx="20" fill="#0f172a" stroke="#1e293b" strokeWidth="3" />
          {/* Chest Reactor Core */}
          <circle cx="70" cy="110" r="7" fill={glowColor} className="animate-ping" style={{ animationDuration: '2s' }} />
          <circle cx="70" cy="110" r="5" fill="#ffffff" />

          {/* Floating Left & Right Hands */}
          <circle cx="20" cy="108" r="10" fill="#0f172a" stroke={glowColor} strokeWidth="2" />
          <circle cx="120" cy="108" r="10" fill="#0f172a" stroke={glowColor} strokeWidth="2" />
        </svg>

        {/* Ambient Ground Glow */}
        <div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-28 h-6 rounded-full blur-md opacity-40"
          style={{ backgroundColor: glowColor }}
        />
      </div>

      <div className="mt-4 text-center">
        <span
          className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border backdrop-blur-md"
          style={{
            borderColor: `${glowColor}40`,
            backgroundColor: `${glowColor}15`,
            color: glowColor,
          }}
        >
          {isError ? 'System Alert' : isDelivered ? 'Video Delivered! 🎉' : 'ClipForge Companion'}
        </span>
      </div>
    </div>
  );
}

/**
 * 3D Robot Visor with glowing digital smile.
 */
function VisorFace({ glowColor, status }) {
  const isDelivered = status === 'delivered' || status === 'PUBLISHED';
  const isError = status === 'error' || status === 'FAILED';

  return (
    <group position={[0, 0, 0.42]}>
      {/* Dark Curved Visor Glass */}
      <mesh>
        <sphereGeometry args={[0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshPhysicalMaterial
          color="#020617"
          roughness={0.08}
          metalness={0.9}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          reflectivity={0.9}
        />
      </mesh>

      {/* Left Smiling Eye */}
      <mesh position={[-0.14, 0.05, 0.36]} rotation={[0, -0.15, isError ? 0.3 : 0]}>
        {isError ? (
          <boxGeometry args={[0.06, 0.015, 0.01]} />
        ) : (
          <torusGeometry args={[0.04, 0.012, 16, 32, Math.PI]} />
        )}
        <meshBasicMaterial color={glowColor} />
      </mesh>

      {/* Right Smiling Eye */}
      <mesh position={[0.14, 0.05, 0.36]} rotation={[0, 0.15, isError ? -0.3 : 0]}>
        {isError ? (
          <boxGeometry args={[0.06, 0.015, 0.01]} />
        ) : (
          <torusGeometry args={[0.04, 0.012, 16, 32, Math.PI]} />
        )}
        <meshBasicMaterial color={glowColor} />
      </mesh>

      {/* Smile Arc Mouth */}
      <mesh position={[0, -0.07, 0.38]} rotation={[0, 0, isError ? Math.PI : 0]}>
        <torusGeometry args={[0.07, 0.014, 16, 32, isDelivered ? Math.PI : Math.PI * 0.8]} />
        <meshBasicMaterial color={glowColor} />
      </mesh>
    </group>
  );
}

/**
 * 3D Astronaut-style Robot Model inside Three Fiber.
 */
function AstronautRobot({ status = 'idle', onBotClick }) {
  const robotRef = useRef();
  const headRef = useRef();
  const leftHandRef = useRef();
  const rightHandRef = useRef();
  const spinVelocityRef = useRef(0);

  const isDelivered = status === 'delivered' || status === 'PUBLISHED';
  const isError = status === 'error' || status === 'FAILED';

  const glowColor = useMemo(() => {
    if (isError) return new THREE.Color('#ef4444');
    if (isDelivered) return new THREE.Color('#10b981');
    return new THREE.Color('#38bdf8');
  }, [isError, isDelivered]);

  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#090d16',
        roughness: 0.14,
        metalness: 0.85,
      }),
    [],
  );

  const accentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.25,
        metalness: 0.9,
      }),
    [],
  );

  const handlePointerDown = (e) => {
    e.stopPropagation();
    spinVelocityRef.current = 14;
    onBotClick?.();
  };

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    if (!robotRef.current) return;

    // 1. Spin on click
    if (spinVelocityRef.current > 0.01) {
      robotRef.current.rotation.y += spinVelocityRef.current * delta;
      spinVelocityRef.current = THREE.MathUtils.lerp(spinVelocityRef.current, 0, delta * 3.5);
    } else {
      // 2. Smooth Cursor Following
      const targetY = (state.pointer.x * Math.PI) / 5;
      const targetX = (-state.pointer.y * Math.PI) / 8;
      robotRef.current.rotation.y = THREE.MathUtils.lerp(robotRef.current.rotation.y, targetY, delta * 4);
      robotRef.current.rotation.x = THREE.MathUtils.lerp(robotRef.current.rotation.x, targetX, delta * 4);
    }

    // 3. Natural Idle Float
    const floatY = Math.sin(time * 2.2) * 0.06;
    robotRef.current.position.y = floatY;

    // 4. Shakes on Error
    if (isError && headRef.current) {
      headRef.current.rotation.z = Math.sin(time * 26) * 0.14;
      robotRef.current.position.x = Math.sin(time * 30) * 0.04;
    } else if (headRef.current) {
      headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, 0, delta * 5);
      robotRef.current.position.x = THREE.MathUtils.lerp(robotRef.current.position.x, 0, delta * 5);
    }

    // 5. Waves when Delivered
    if (rightHandRef.current) {
      if (isDelivered) {
        rightHandRef.current.position.y = 0.35 + Math.sin(time * 8) * 0.08;
        rightHandRef.current.position.x = 0.55 + Math.cos(time * 8) * 0.05;
        rightHandRef.current.rotation.z = -0.5 + Math.sin(time * 12) * 0.45;
      } else {
        rightHandRef.current.position.y = -0.05 + Math.sin(time * 2 + 1) * 0.04;
        rightHandRef.current.position.x = 0.48;
        rightHandRef.current.rotation.z = 0;
      }
    }

    // Left hand subtle bobbing
    if (leftHandRef.current) {
      leftHandRef.current.position.y = -0.05 + Math.sin(time * 2) * 0.04;
    }
  });

  return (
    <group ref={robotRef} onPointerDown={handlePointerDown} cursor="pointer" scale={1.2}>
      {/* HEAD & HELMET */}
      <group ref={headRef} position={[0, 0.4, 0]}>
        {/* Main Helmet Shell */}
        <mesh material={bodyMaterial}>
          <sphereGeometry args={[0.48, 32, 32]} />
        </mesh>

        {/* Visor & Digital Smiling Face */}
        <VisorFace glowColor={glowColor} status={status} />

        {/* Left Ear Glowing Disc Light */}
        <group position={[-0.48, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <mesh material={accentMaterial}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 24]} />
            <meshBasicMaterial color={glowColor} />
          </mesh>
          <pointLight color={glowColor} intensity={1.5} distance={1.2} />
        </group>

        {/* Right Ear Glowing Disc Light */}
        <group position={[0.48, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh material={accentMaterial}>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 24]} />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 24]} />
            <meshBasicMaterial color={glowColor} />
          </mesh>
          <pointLight color={glowColor} intensity={1.5} distance={1.2} />
        </group>
      </group>

      {/* TORSO & BACKPACK */}
      <group position={[0, -0.22, 0]}>
        {/* Sleek Rounded Torso */}
        <mesh material={bodyMaterial} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.26, 0.32, 0.48, 32]} />
        </mesh>

        {/* Chest Reactor Core */}
        <mesh position={[0, 0.06, 0.28]}>
          <sphereGeometry args={[0.06, 24, 24]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
        <pointLight position={[0, 0.06, 0.32]} color={glowColor} intensity={2.0} distance={1.5} />

        {/* Astronaut Backpack Thruster */}
        <mesh material={accentMaterial} position={[0, 0.02, -0.28]}>
          <boxGeometry args={[0.32, 0.36, 0.16]} />
        </mesh>
      </group>

      {/* FLOATING DETACHED LIMBS */}
      {/* Left Floating Hand */}
      <group ref={leftHandRef} position={[-0.48, -0.05, 0]}>
        <mesh material={bodyMaterial}>
          <sphereGeometry args={[0.1, 24, 24]} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <torusGeometry args={[0.08, 0.02, 16, 24]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
      </group>

      {/* Right Floating Hand (Waves on Delivered) */}
      <group ref={rightHandRef} position={[0.48, -0.05, 0]}>
        <mesh material={bodyMaterial}>
          <sphereGeometry args={[0.1, 24, 24]} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <torusGeometry args={[0.08, 0.02, 16, 24]} />
          <meshBasicMaterial color={glowColor} />
        </mesh>
      </group>

      {/* Bottom Levitation Aura Thruster */}
      <mesh position={[0, -0.58, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.12, 0.28, 32]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Interactive 3D Bot Scene with React Three Fiber.
 *
 * @param {{
 *   status?: 'idle' | 'delivered' | 'PUBLISHED' | 'error' | 'FAILED' | 'thinking',
 *   className?: string,
 *   onBotClick?: () => void
 * }} props
 */
export function BotScene({ status = 'idle', className = '', onBotClick }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <Bot2DFallback status={status} onClick={onBotClick} />;
  }

  return (
    <div className={`relative w-full h-72 md:h-80 select-none ${className}`}>
      <SafeCanvas
        camera={{ position: [0, 0, 3.2], fov: 45 }}
        fallback={<Bot2DFallback status={status} onClick={onBotClick} />}
        onError={() => setHasError(true)}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 3]} intensity={1.5} color="#ffffff" />
        <pointLight position={[-3, -2, 2]} intensity={0.6} color="#38bdf8" />
        <AstronautRobot status={status} onBotClick={onBotClick} />
      </SafeCanvas>
    </div>
  );
}

// React.lazy export helper for dynamic code-splitting
export const LazyBotScene = React.lazy(() =>
  Promise.resolve({
    default: BotScene,
  }),
);

export default BotScene;
