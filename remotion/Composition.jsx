import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * Ken Burns image effect component that applies subtle zoom and pan.
 */
function KenBurnsScene({ scene, sceneDurationFrames, index }) {
  const frame = useCurrentFrame();

  // Alternate pan direction based on scene index for visual variety
  const zoomIn = index % 2 === 0;
  const startScale = zoomIn ? 1.0 : 1.18;
  const endScale = zoomIn ? 1.18 : 1.0;
  const startPanX = zoomIn ? -15 : 15;
  const endPanX = zoomIn ? 15 : -15;

  const scale = interpolate(frame, [0, sceneDurationFrames], [startScale, endScale], {
    extrapolateRight: 'clamp',
  });
  const panX = interpolate(frame, [0, sceneDurationFrames], [startPanX, endPanX], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={scene.imageUrl || scene.imagePath}
        alt={`Scene ${scene.sceneNo || index + 1}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate3d(${panX}px, 0, 0)`,
          filter: 'brightness(0.92) contrast(1.05)',
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Word-level animated caption overlay with active word highlight.
 */
function AnimatedCaptions({ wordTimestamps = [], sceneStartOffsetSeconds = 0 }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps + sceneStartOffsetSeconds;

  if (!wordTimestamps.length) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 180,
        left: 48,
        right: 48,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '10px 14px',
        backgroundColor: 'rgba(5, 7, 15, 0.78)',
        backdropFilter: 'blur(16px)',
        padding: '28px 36px',
        borderRadius: 24,
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
      }}
    >
      {wordTimestamps.map((item, index) => {
        const isActive = currentTime >= item.start && currentTime <= item.end;
        const isPast = currentTime > item.end;

        return (
          <span
            key={`${item.word}-${index}`}
            style={{
              fontSize: 46,
              fontWeight: 900,
              letterSpacing: '-0.5px',
              color: isActive ? '#38bdf8' : isPast ? '#f8fafc' : 'rgba(255, 255, 255, 0.45)',
              transform: isActive ? 'scale(1.12)' : 'scale(1.0)',
              textShadow: isActive
                ? '0 0 20px rgba(56, 189, 248, 0.8), 0 2px 4px rgba(0,0,0,0.8)'
                : '0 2px 4px rgba(0,0,0,0.8)',
              transition: 'all 0.1s ease',
              display: 'inline-block',
            }}
          >
            {item.word}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Vertical 9:16 Remotion Video Composition.
 *
 * Combines:
 * 1. Scene image visuals with Ken Burns motion
 * 2. Per-scene voice narration audio
 * 3. Word-level animated captions
 * 4. Ducked background music (0.12 volume)
 *
 * @param {{
 *   scenes?: Array<{
 *     sceneNo: number,
 *     imageUrl: string,
 *     imagePath?: string,
 *     narration: string,
 *     duration?: number,
 *     audioUrl?: string,
 *     wordTimestamps?: Array<{word: string, start: number, end: number}>
 *   }>,
 *   voiceTracks?: Array<{
 *     audioUrl: string,
 *     durationSeconds: number,
 *     wordTimestamps: Array<{word: string, start: number, end: number}>
 *   }>,
 *   backgroundMusicUrl?: string,
 *   brandWatermark?: string
 * }} props
 */
export const MainVideoComposition = ({
  scenes = [],
  voiceTracks = [],
  backgroundMusicUrl = '',
  brandWatermark = 'CLIPFORGE AI',
}) => {
  const { fps } = useVideoConfig();

  let accumulatedFrames = 0;
  let accumulatedSeconds = 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#05070f',
        width: 1080,
        height: 1920,
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Background Ducked Music */}
      {backgroundMusicUrl ? (
        <Audio src={backgroundMusicUrl} volume={0.12} loop />
      ) : null}

      {/* Render Scenes Sequentially */}
      {scenes.map((scene, index) => {
        const voice = voiceTracks[index] || {};
        const sceneDurationSeconds = Number(voice.durationSeconds || scene.duration || 4);
        const sceneDurationFrames = Math.max(1, Math.round(sceneDurationSeconds * fps));
        const fromFrame = accumulatedFrames;
        const fromSeconds = accumulatedSeconds;

        accumulatedFrames += sceneDurationFrames;
        accumulatedSeconds += sceneDurationSeconds;

        const wordTimestamps = voice.wordTimestamps || scene.wordTimestamps || [];
        const audioSrc = voice.audioUrl || scene.audioUrl;

        return (
          <Sequence
            key={`scene-${scene.sceneNo || index}`}
            from={fromFrame}
            durationInFrames={sceneDurationFrames}
          >
            {/* Visual with Ken Burns pan/zoom */}
            <KenBurnsScene
              scene={scene}
              sceneDurationFrames={sceneDurationFrames}
              index={index}
            />

            {/* Narration Audio */}
            {audioSrc ? (
              <Audio src={audioSrc} volume={1.0} />
            ) : null}

            {/* Word-level captions */}
            <AnimatedCaptions
              wordTimestamps={wordTimestamps}
              sceneStartOffsetSeconds={fromSeconds}
            />
          </Sequence>
        );
      })}

      {/* Top Brand Watermark Header */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          backgroundColor: 'rgba(5, 7, 15, 0.65)',
          padding: '12px 24px',
          borderRadius: 40,
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#38bdf8',
            boxShadow: '0 0 10px #38bdf8',
          }}
        />
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '2px',
            color: '#f8fafc',
          }}
        >
          {brandWatermark}
        </span>
      </div>
    </AbsoluteFill>
  );
};
