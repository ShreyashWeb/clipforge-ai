import React from 'react';
import { Composition } from 'remotion';
import { MainVideoComposition } from './Composition.jsx';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ClipForgeVideo"
        component={MainVideoComposition}
        durationInFrames={30 * 30} // Default 30 seconds at 30 fps
        fps={30}
        width={1080}
        height={1920}
        calculateMetadata={({ props }) => {
          const fps = 30;
          const scenes = props.scenes || [];
          const voiceTracks = props.voiceTracks || [];

          let totalSeconds = 0;
          scenes.forEach((scene, index) => {
            const voice = voiceTracks[index] || {};
            const duration = Number(voice.durationSeconds || scene.duration || 4);
            totalSeconds += duration;
          });

          const durationInFrames = Math.max(fps * 3, Math.round((totalSeconds || 15) * fps));
          return {
            durationInFrames,
            fps,
            width: 1080,
            height: 1920,
          };
        }}
        defaultProps={{
          scenes: [],
          voiceTracks: [],
          backgroundMusicUrl: '',
          brandWatermark: 'CLIPFORGE AI',
        }}
      />
    </>
  );
};
