import { useEffect, useRef } from 'react';

const PARTICLE_COUNT = 55;
const COLORS = [
  'rgba(50, 230, 255, ', // Cyan
  'rgba(255, 54, 94, ',  // Neon Crimson/Red
  'rgba(168, 85, 247, ', // Purple
  'rgba(56, 189, 248, ', // Sky Blue
];

/**
 * Ultra-lightweight, high-performance ambient background particles
 * with interactive touch and pointer deflection physics.
 */
export function AmbientParticles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Touch & Pointer interaction state
    const pointer = {
      x: -1000,
      y: -1000,
      radius: 120,
      isActive: false,
    };

    // Sparks created on touch/tap
    const sparks = [];

    // Initialize ambient particles
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      baseRadius: Math.random() * 1.8 + 0.8,
      radius: Math.random() * 1.8 + 0.8,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      colorBase: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.25 + 0.1,
      baseAlpha: Math.random() * 0.25 + 0.1,
    }));

    // Resize Handler
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    // Pointer & Touch Events
    const handlePointerMove = (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.isActive = true;
    };

    const handlePointerLeave = () => {
      pointer.x = -1000;
      pointer.y = -1000;
      pointer.isActive = false;
    };

    const handleTouchStart = (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        pointer.x = touch.clientX;
        pointer.y = touch.clientY;
        pointer.isActive = true;

        // Create 6 subtle micro-sparks radiating on touch
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
          const speed = Math.random() * 2 + 1;
          sparks.push({
            x: touch.clientX,
            y: touch.clientY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: Math.random() * 1.5 + 0.8,
            alpha: 0.8,
            colorBase: COLORS[Math.floor(Math.random() * COLORS.length)],
          });
        }
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        pointer.x = touch.clientX;
        pointer.y = touch.clientY;
        pointer.isActive = true;
      }
    };

    const handleTouchEnd = () => {
      pointer.x = -1000;
      pointer.y = -1000;
      pointer.isActive = false;
    };

    // Event Listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Render Animation Loop
    let lastTime = performance.now();
    const render = (time) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw connecting neural filaments between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);

          if (dist < 90) {
            const lineAlpha = (1 - dist / 90) * 0.08;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(50, 230, 255, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // 2. Update & Draw Particles with Touch Deflection Physics
      for (const p of particles) {
        // Natural ambient drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen boundaries smoothly
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        // Interactive Touch/Pointer magnetic deflection
        if (pointer.isActive) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy);

          if (dist < pointer.radius && dist > 0) {
            const force = (1 - dist / pointer.radius) * 1.5;
            const angle = Math.atan2(dy, dx);
            p.x += Math.cos(angle) * force * 2.5;
            p.y += Math.sin(angle) * force * 2.5;
            p.radius = p.baseRadius * 1.35;
            p.alpha = Math.min(0.7, p.baseAlpha * 2.5);
          } else {
            p.radius += (p.baseRadius - p.radius) * 0.08;
            p.alpha += (p.baseAlpha - p.alpha) * 0.08;
          }
        } else {
          p.radius += (p.baseRadius - p.radius) * 0.08;
          p.alpha += (p.baseAlpha - p.alpha) * 0.08;
        }

        // Draw particle with subtle glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.colorBase}${p.alpha})`;
        ctx.shadowColor = `${p.colorBase}0.6)`;
        ctx.shadowBlur = 6;
        ctx.fill();
      }

      // 3. Update & Draw Touch Sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= delta * 1.2;

        if (s.alpha <= 0) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${s.colorBase}${s.alpha})`;
        ctx.shadowColor = `${s.colorBase}0.8)`;
        ctx.shadowBlur = 8;
        ctx.fill();
      }

      ctx.shadowBlur = 0; // Reset shadow for next frame
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[-1] opacity-75"
    />
  );
}

export default AmbientParticles;
