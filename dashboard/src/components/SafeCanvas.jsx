import { Canvas } from '@react-three/fiber';
import { Component, Suspense, lazy, useEffect, useState } from 'react';

const LazyCanvas = lazy(async () => ({
  default: Canvas,
}));

function supportsWebGL() {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl'),
    );
  } catch {
    return false;
  }

  function prefersReducedMotion() {
    return typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
}

class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function VisibilityAwareCanvas({ children, ...props }) {
  const [hidden, setHidden] = useState(
    typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );

  useEffect(() => {
    const handleVisibilityChange = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return (
    <LazyCanvas {...props} frameloop={hidden ? 'never' : 'demand'} dpr={[1, 1.5]}>
      {children}
    </LazyCanvas>
  );
}

/**
 * Renders a fault-tolerant React Three Fiber canvas.
 *
 * @param {{ children?: import('react').ReactNode, fallback?: import('react').ReactNode }} props
 * @returns {import('react').ReactNode}
 */
export function SafeCanvas({ children, fallback = null, ...props }) {
  if (!supportsWebGL() || prefersReducedMotion()) return fallback;

  return (
    <CanvasErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <VisibilityAwareCanvas {...props}>{children}</VisibilityAwareCanvas>
      </Suspense>
    </CanvasErrorBoundary>
  );
}
