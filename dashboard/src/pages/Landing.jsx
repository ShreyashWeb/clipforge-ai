import { Link } from 'react-router-dom';
import { NeonButton } from '../components/NeonButton.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { HeroScene } from '../components/HeroScene.jsx';

export function Landing() {
  return (
    <section className="hero-section relative isolate overflow-hidden">
      <HeroScene intensity={0.8} />
      <div className="relative z-10 mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-32">
        <div className="max-w-2xl">
          <SectionTitle eyebrow="Research to short-form video">
            Turn one idea into a source-grounded story.
          </SectionTitle>
          <p className="mb-8 text-lg leading-8 text-muted">
            ClipForge AI researches your topic, guides the creative decisions, and turns the approved story into a ready-to-publish video.
          </p>
          <Link to="/jobs"><NeonButton>Start a video</NeonButton></Link>
        </div>
      </div>
    </section>
  );
}
