import { Canvas } from '@react-three/fiber';
import { Component, Suspense, useEffect, useState } from 'react';

let isWebGLSupported = null;

function supportsWebGL() {
  if (isWebGLSupported !== null) return isWebGLSupported;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    isWebGLSupported = Boolean(gl);
    if (gl) {
      const ext = gl.getExtension?.('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
    return isWebGLSupported;
  } catch {
    isWebGLSupported = false;
    return false;
  }
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function VisibilityAwareCanvas({ children, onCreated, ...props }) {
  const [hidden, setHidden] = useState(
    typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );

  useEffect(() => {
    const handleVisibilityChange = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.5]}
      frameloop={hidden ? 'never' : 'always'}
      gl={{
        antialias: true,
        powerPreference: 'default',
        preserveDrawingBuffer: false,
      }}
      onCreated={(state) => {
        state.gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
        }, false);
        onCreated?.(state);
      }}
      {...props}
    >
      {children}
    </Canvas>
  );
}

/**
 * Renders a fault-tolerant React Three Fiber canvas.
 *
 * @param {{ children?: import('react').ReactNode, fallback?: import('react').ReactNode, onCreated?: (state: any) => void, onError?: () => void }} props
 * @returns {import('react').ReactNode}
 */
export function SafeCanvas({ children, fallback = null, onCreated, onError, ...props }) {
  if (!supportsWebGL() || prefersReducedMotion()) return fallback;

  return (
    <CanvasErrorBoundary fallback={fallback} onError={onError}>
      <Suspense fallback={fallback}>
        <VisibilityAwareCanvas onCreated={onCreated} {...props}>
          {children}
        </VisibilityAwareCanvas>
      </Suspense>
    </CanvasErrorBoundary>
  );
}
