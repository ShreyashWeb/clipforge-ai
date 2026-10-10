import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NeonButton } from '../components/NeonButton.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { HeroScene } from '../components/HeroScene.jsx';
import { GlassCard } from '../components/GlassCard.jsx';
import { InteractiveVideoPlayer } from '../components/InteractiveVideoPlayer.jsx';

const featuredDemoVideo = {
  topic: 'YOLOv11 Real-Time Computer Vision',
  scenes: [
    {
      sceneNo: 1,
      narration: 'YOLOv11 delivers real-time computer vision at over 150 frames per second on edge devices.',
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1280&q=80',
      duration: 4,
    },
    {
      sceneNo: 2,
      narration: 'With optimized depthwise separable convolutions, it achieves 22 percent higher mean average precision.',
      imageUrl: 'https://images.unsplash.com/photo-1507146153580-69a1fe6d8aa1?auto=format&fit=crop&w=1280&q=80',
      duration: 4,
    },
    {
      sceneNo: 3,
      narration: 'From autonomous robotics to drone navigation, high-speed perception is now accessible everywhere.',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',
      duration: 4,
    },
  ],
};

export function Landing() {
  const navigate = useNavigate();
  const [topicInput, setTopicInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStartInterview = (e) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    navigate(`/create?topic=${encodeURIComponent(topicInput.trim())}`);
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="hero-section relative isolate overflow-hidden">
        <HeroScene intensity={0.8} />
        <div className="relative z-10 mx-auto max-w-7xl px-5 py-16 md:px-10 md:py-24">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-neon-cyan shadow-[0_0_20px_rgba(50,230,255,0.2)]">
              ⚡ Autonomous AI Video Creation Pipeline
            </span>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Turn any technical idea into an <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-cyan via-blue-400 to-neon-red">AI Short Video</span>.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300 sm:text-lg">
              ClipForge AI conducts an interactive creative interview, researches verified sources, crafts source-grounded scripts, generates visual storyboards, and renders viral short videos with synchronized voiceover.
            </p>

            {/* Direct Instant AI Interview & Creation Bar */}
            <div className="mt-8">
              <form onSubmit={handleStartInterview} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="Enter any topic..."
                  className="w-full rounded-xl border border-white/20 bg-black/60 px-5 py-3.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-neon-cyan focus:shadow-[0_0_20px_rgba(50,230,255,0.3)]"
                />
                <NeonButton type="submit" disabled={!topicInput.trim()} className="whitespace-nowrap py-3.5 px-6 font-bold">
                  Start AI Interview →
                </NeonButton>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Ready-to-Play Video Theater */}
      <section className="mx-auto max-w-7xl px-5 md:px-10">
        <GlassCard className="border-neon-cyan/40 p-8 shadow-[0_0_50px_rgba(50,230,255,0.15)]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="rounded-full bg-neon-cyan/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-neon-cyan border border-neon-cyan/30">
                📺 Live Video Player Showcase
              </span>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {featuredDemoVideo.topic}
              </h2>
              <p className="text-xs text-muted">
                Generated with source grounding, neural voice narration, and dynamic TikTok-style captions.
              </p>
            </div>
            <Link to="/create">
              <NeonButton>⚡ Create Your Custom Video Now →</NeonButton>
            </Link>
          </div>

          <div className="flex justify-center">
            <InteractiveVideoPlayer
              topic={featuredDemoVideo.topic}
              scenes={featuredDemoVideo.scenes}
              aspectRatio="vertical"
            />
          </div>
        </GlassCard>
      </section>

      {/* 3-Step Creation Workflow */}
      <section className="mx-auto max-w-7xl px-5 md:px-10">
        <SectionTitle eyebrow="How ClipForge AI Works">
          From Concept to Final Video in 3 Steps
        </SectionTitle>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Interactive AI Interview',
              desc: 'Select your target audience, choose your storytelling tone, and pick from AI-crafted viral hooks.',
            },
            {
              step: '02',
              title: 'Source Research & Storyboard',
              desc: 'Tavily retrieves verified citations; Groq drafts the script; Flux generates visual scenes.',
            },
            {
              step: '03',
              title: 'Voiceover & Video Render',
              desc: 'ElevenLabs synthesizes realistic speech and Creatomate composites the video with animated captions.',
            },
          ].map((card) => (
            <GlassCard key={card.step} className="p-6 transition hover:border-neon-cyan/50 hover:shadow-[0_0_30px_rgba(50,230,255,0.15)]">
              <span className="font-mono text-2xl font-black text-neon-cyan">{card.step}</span>
              <h3 className="mt-3 text-lg font-bold text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{card.desc}</p>
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  );
}
