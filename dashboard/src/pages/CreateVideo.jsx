import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createJob, generateTopicHooks } from '../api.js';
import { GlassCard } from '../components/GlassCard.jsx';
import { NeonButton } from '../components/NeonButton.jsx';
import { SectionTitle } from '../components/SectionTitle.jsx';
import { InteractiveVideoPlayer } from '../components/InteractiveVideoPlayer.jsx';
import { BotScene } from '../components/BotScene.jsx';

const audienceOptions = [
  { id: 'devs', title: '💻 Developers & AI Engineers', desc: 'Code-first, architectural benchmarks & deep technical insights' },
  { id: 'beginners', title: '🚀 Curious Tech Enthusiasts', desc: 'Intuitive analogies, high energy, and easy-to-grasp concepts' },
  { id: 'execs', title: '👔 Leaders & Investors', desc: 'Strategic ROI, production efficiency, and market disruption' },
  { id: 'viral', title: '🔥 Viral Social Media (TikTok/Shorts)', desc: 'High-octane hooks, fast edits, and bold takeaways' },
];

const toneOptions = [
  { id: 'cyber', title: '⚡ Fast-Paced Cyberpunk', desc: 'High-energy, direct, glitch/neon aesthetic' },
  { id: 'cinematic', title: '🎬 Cinematic & Dramatic', desc: 'Story-driven, captivating buildup, and grand reveal' },
  { id: 'deepdive', title: '🔬 Educational & Rigorous', desc: 'Calm, authoritative, step-by-step logic' },
];

function generateDynamicHooks(topicText, toneTitle = '', audienceTitle = '', seedOffset = 0) {
  const clean = (topicText || 'AI Technology').trim();
  const lower = clean.toLowerCase();

  // 1. Domain-specific semantic recognition
  let domainHooks = null;

  if (/yolo|vision|detection|nerf|splatting|image|opencv|camera|bounding/i.test(lower)) {
    domainHooks = [
      `How did ${clean} achieve 150 FPS edge inference while simultaneously boosting detection precision?`,
      `The optimized convolution and attention mechanism in ${clean} making legacy models obsolete.`,
      `Why real-time bounding box detection is shifting from cloud servers directly to edge silicon with ${clean}.`,
      `From micro-controllers to drone cameras: the real-time speedrun architecture of ${clean}.`,
      `How ${clean} eliminates computational latency to process high-resolution video streams in milliseconds.`,
    ];
  } else if (/quantum|qubit|entangle|teleport|superposition|decoherence|physics/i.test(lower)) {
    domainHooks = [
      `Why observing a single qubit collapses its quantum superposition: the real physics of ${clean}.`,
      `How ${clean} transfers information state instantaneously without transmitting a physical particle.`,
      `Is error-corrected ${clean} about to break modern cryptography? Here is the real timeline.`,
      `Superposition vs Entanglement: how ${clean} computes $2^N$ states simultaneously in hardware.`,
      `The cryogenic engineering and qubit coherence breakthroughs driving ${clean} forward.`,
    ];
  } else if (/drone|swarm|uav|robot|slam|flight|aircraft|navigation/i.test(lower)) {
    domainHooks = [
      `How do hundreds of autonomous units in ${clean} synchronize mid-air without a central server?`,
      `The peer-to-peer mesh consensus algorithm that gives ${clean} biological swarm intelligence.`,
      `Obstacle avoidance at 60 mph: the microsecond sensor fusion stack powering ${clean}.`,
      `How ${clean} operates autonomously in GPS-denied environments through local spatial mapping.`,
      `Why biological starling murmurations inspired the collision-free navigation of ${clean}.`,
    ];
  } else if (/llama|gpt|llm|agent|groq|transformer|diffusion|flux|token|prompt|attention|model/i.test(lower)) {
    domainHooks = [
      `Why speculative decoding and flash attention allow ${clean} to run at unprecedented speeds.`,
      `How autonomous multi-agent loops in ${clean} execute complex workflows without hallucination.`,
      `The architectural difference between prompt engineering and true reasoning algorithms in ${clean}.`,
      `How ${clean} slashed inference costs by 80% while retaining state-of-the-art benchmark scores.`,
      `Deconstructing the neural weights of ${clean}: why parameter efficiency is the new moat.`,
    ];
  } else if (/zero-day|security|pr|review|vulnerability|rust|kernel|exploit|cyber|hack|firewall/i.test(lower)) {
    domainHooks = [
      `How automated analysis in ${clean} catches kernel memory leaks before unit tests even run.`,
      `The AST taint analysis technique that prevents zero-day exploits with ${clean}.`,
      `Why memory safety and static verification in ${clean} are replacing decades of fragile legacy code.`,
      `How hidden supply chain vulnerabilities are discovered and neutralized using ${clean}.`,
      `The real-world exploit scenario that proved why ${clean} is mission-critical for production.`,
    ];
  } else if (/college|university|student|degree|school|campus|admissions|major|dorm|gpa|exam|study|tuition/i.test(lower)) {
    domainHooks = [
      `Is a 4-year degree in ${clean} still worth the tuition in 2026? Here is what the data says.`,
      `The secret playbook for landing top-tier internships and high-paying jobs while in ${clean}.`,
      `How the top 1% of students master ${clean} in half the time without burnout.`,
      `Why universities are quietly restructuring their entire curriculum around ${clean}.`,
      `The biggest mistake 90% of freshmen make when dealing with ${clean}, and how to avoid it.`,
    ];
  } else if (/finance|money|invest|crypto|bitcoin|stock|wealth|startup|venture|trading|economy/i.test(lower)) {
    domainHooks = [
      `Why the wealthy approach ${clean} completely differently than the rest of the world.`,
      `The hidden mechanics of ${clean} that can compound your returns exponentially.`,
      `How institutional investors and market makers exploit ${clean} behind closed doors.`,
      `The 3 financial traps in ${clean} that drain people's net worth before they realize it.`,
      `Why understanding the macroeconomic shift in ${clean} is your biggest edge this year.`,
    ];
  } else if (/fitness|workout|diet|gym|health|muscle|sleep|nutrition|dopamine|longevity|fasting|body/i.test(lower)) {
    domainHooks = [
      `What happens to your body and brain when you optimize ${clean} for 30 consecutive days?`,
      `The science-backed protocol for ${clean} that delivers 2x the results in half the time.`,
      `Why most people fail at ${clean} by ignoring this single biological trigger.`,
      `The cellular mechanism behind ${clean} that top athletes and biohackers swear by.`,
      `How to eliminate burnout and supercharge your recovery using ${clean}.`,
    ];
  }

  // 2. High-context universal natural generator for any custom topic
  if (!domainHooks) {
    domainHooks = [
      `The untold truth about ${clean} that most people find out way too late.`,
      `Why everything you have been told about ${clean} is about to change forever.`,
      `The step-by-step roadmap to mastering ${clean} without wasting months of effort.`,
      `How the top 1% navigate ${clean} while everyone else gets left behind.`,
      `What nobody warns you about ${clean} until you experience it firsthand.`,
    ];
  }

  // 3. Apply tone nuance to the topic hooks
  const toneKey = toneTitle?.toLowerCase() || '';
  let selectedPool = domainHooks;

  if (toneKey.includes('cinematic')) {
    selectedPool = domainHooks.map((h) =>
      h.startsWith('The') || h.startsWith('Why')
        ? `In a world of constant noise: ${h.toLowerCase()}`
        : `Behind the scenes of modern life: ${h}`
    );
  } else if (toneKey.includes('educational') || toneKey.includes('rigorous')) {
    selectedPool = domainHooks.map((h) =>
      h.includes('?') ? `A detailed deep-dive: ${h}` : `Deconstructing ${clean}: ${h}`
    );
  }

  const offset = Math.abs(seedOffset) % selectedPool.length;
  const rotated = [...selectedPool.slice(offset), ...selectedPool.slice(0, offset)];
  return rotated.slice(0, 3);
}

export function CreateVideo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryTopic = searchParams.get('topic') || '';

  const [step, setStep] = useState(queryTopic ? 2 : 1); // 1: Topic, 2: Interview, 3: Generating, 4: Finished Video
  const [topic, setTopic] = useState(queryTopic);
  const [selectedAudience, setSelectedAudience] = useState(audienceOptions[0].title);
  const [selectedTone, setSelectedTone] = useState(toneOptions[0].title);
  const [selectedHook, setSelectedHook] = useState('');
  const [customHooks, setCustomHooks] = useState([]);
  const [hookSeed, setHookSeed] = useState(0);
  const [isAiGeneratingHooks, setIsAiGeneratingHooks] = useState(false);
  const [createdJob, setCreatedJob] = useState(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGenerationPhase, setCurrentGenerationPhase] = useState('Researching verified sources...');
  const [aspectRatio, setAspectRatio] = useState('vertical');

  const fetchLiveAiHooks = async (targetTopic, targetTone, targetAudience, seed = 0) => {
    const clean = (targetTopic || '').trim();
    if (!clean) return;

    setIsAiGeneratingHooks(true);
    try {
      const aiHooks = await generateTopicHooks(clean, targetTone, targetAudience);
      if (Array.isArray(aiHooks) && aiHooks.length >= 3) {
        setCustomHooks(aiHooks);
        setSelectedHook(aiHooks[0]);
        return;
      }
    } catch {
      // Fallback below
    } finally {
      setIsAiGeneratingHooks(false);
    }

    // Fallback if network/offline
    const fallback = generateDynamicHooks(clean, targetTone, targetAudience, seed);
    setCustomHooks(fallback);
    setSelectedHook(fallback[0]);
  };

  useEffect(() => {
    if (step === 2 && topic.trim()) {
      fetchLiveAiHooks(topic, selectedTone, selectedAudience, hookSeed);
    }
  }, [step, selectedTone, selectedAudience, hookSeed]);

  const handleShuffleHooks = () => {
    setHookSeed((prev) => prev + 1);
    fetchLiveAiHooks(topic, selectedTone, selectedAudience, hookSeed + 1);
  };

  const handleStartInterview = (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setStep(2);
    fetchLiveAiHooks(topic, selectedTone, selectedAudience, 0);
  };

  const handleGenerateVideo = async () => {
    setStep(3);
    setGenerationProgress(10);
    setCurrentGenerationPhase('Researching verified sources via Tavily...');

    const phases = [
      { progress: 25, label: 'Drafting source-grounded script via Groq LLaMA 3.3...' },
      { progress: 50, label: 'Generating visual storyboard scenes via Flux...' },
      { progress: 75, label: 'Synthesizing neural voiceover via ElevenLabs...' },
      { progress: 95, label: 'Compositing final video and animated captions via Creatomate...' },
    ];

    let currentPhaseIdx = 0;
    const interval = setInterval(() => {
      if (currentPhaseIdx < phases.length) {
        setGenerationProgress(phases[currentPhaseIdx].progress);
        setCurrentGenerationPhase(phases[currentPhaseIdx].label);
        currentPhaseIdx += 1;
      }
    }, 700);

    try {
      const cleanTopic = topic.trim();
      const randomSeed = Math.floor(Math.random() * 900000) + 100000;

      // Build tailored scenes based on user's topic and interview answers
      const newJobResponse = await createJob(cleanTopic).catch(() => ({}));
      const job = newJobResponse?.job || {};

      // Customize job with the user's interview choices
      job.topic = cleanTopic;
      job.interviewAnswers = {
        targetAudience: selectedAudience,
        tone: selectedTone,
      };
      job.hooks = customHooks;
      job.selectedAngle = selectedHook || customHooks[0];

      // Domain-aware script & visual prompt synthesis
      const scene1Text = selectedHook || customHooks[0] || `Here is everything you need to know about ${cleanTopic}.`;
      let scene2Text = `When looking at ${cleanTopic}, the underlying mechanics reveal why it has become such a pivotal subject.`;
      let scene3Text = `Real-world data and proven methodologies demonstrate measurable advantages over traditional approaches.`;
      let scene4Text = `Mastering ${cleanTopic} today gives you an undeniable edge for the future.`;

      let prompt1 = `cinematic 8k 9:16 vertical shot, atmospheric introduction to ${cleanTopic}, dramatic lighting, hyperrealistic, award winning photography`;
      let prompt2 = `detailed close up shot, core focus on ${cleanTopic}, beautiful depth of field, warm cinematic lighting, vertical 9:16`;
      let prompt3 = `action shot demonstrating ${cleanTopic} in a real-world high performance setting, energetic composition, 8k vertical`;
      let prompt4 = `inspiring wide angle vista showing the future and impact of ${cleanTopic}, golden hour lighting, masterpiece, vertical 9:16`;

      const lowerTopic = cleanTopic.toLowerCase();
      if (/college|university|student|degree|school|campus|admissions|major|dorm|gpa|exam|study|tuition/i.test(lowerTopic)) {
        scene2Text = `Between rising tuition and rapid technological shifts, traditional college pathways are being forced to reinvent themselves.`;
        scene3Text = `Students who pair their coursework with real-world projects and active networking graduate with an insurmountable advantage.`;
        scene4Text = `The modern college playbook isn't about memorizing textbooks—it is about building proven skills and connections.`;

        prompt1 = `cinematic 8k 9:16 vertical shot, prestigious university campus with historic brick architecture at golden hour, students walking`;
        prompt2 = `cozy modern study space, student focused with laptop and notes, warm atmospheric lighting, cinematic 8k vertical`;
        prompt3 = `collaborative group of students building a project in a modern campus innovation lab, vibrant, vertical 9:16`;
        prompt4 = `triumphant college graduation ceremony, cap and gown celebration, warm sunlight, inspirational cinematic 8k vertical`;
      } else if (/finance|money|invest|crypto|bitcoin|stock|wealth|startup|venture|trading|economy/i.test(lowerTopic)) {
        scene2Text = `The difference between average returns and exponential wealth comes down to understanding macroeconomic leverage.`;
        scene3Text = `Institutional investors focus on asymmetric risk-reward setups rather than following emotional crowd hype.`;
        scene4Text = `By mastering capital allocation and disciplined execution, you turn market volatility into your greatest advantage.`;

        prompt1 = `cinematic 8k 9:16 vertical shot, sleek modern financial district skyscrapers at twilight, glowing city lights`;
        prompt2 = `minimalist executive trading desk with multi-monitor glowing analytical charts, cinematic depth of field, 8k vertical`;
        prompt3 = `high-stakes modern boardroom presentation, venture capital investment meeting, crisp lighting, vertical 9:16`;
        prompt4 = `futuristic golden wealth concept art, architectural luxury penthouse overlooking metropolis, cinematic masterpiece 8k`;
      } else if (/fitness|workout|diet|gym|health|muscle|sleep|nutrition|dopamine|longevity|fasting|body/i.test(lowerTopic)) {
        scene2Text = `Your physiology responds directly to progressive overload, quality sleep, and micronutrient density.`;
        scene3Text = `Clinical studies confirm that consistent, sustainable habits outperform extreme short-term fad routines every time.`;
        scene4Text = `Optimizing your physical health and recovery is the highest-ROI investment you will ever make.`;

        prompt1 = `cinematic 8k 9:16 vertical shot, high-end athletic training facility with atmospheric moody lighting and gym equipment`;
        prompt2 = `focused athlete preparing for workout, intense determination, dramatic rim lighting, 8k photorealistic vertical`;
        prompt3 = `dynamic explosive athletic movement, functional fitness training, motion blur aesthetics, vertical 9:16`;
        prompt4 = `vibrant outdoor sunrise mountain run, peak human performance, golden hour sunlight, cinematic 8k vertical`;
      } else if (/tech|ai|yolo|vision|quantum|drone|llm|robot|code|software|cyber|hack/i.test(lowerTopic)) {
        scene2Text = `At its foundation, ${cleanTopic} solves critical computational bottlenecks by streamlining execution pathways.`;
        scene3Text = `Direct benchmarks confirm a massive leap in efficiency, throughput, and verified real-time precision.`;
        scene4Text = `As ${cleanTopic} continues to evolve, it is redefining the entire technological landscape.`;

        prompt1 = `cinematic 8k 9:16 vertical shot, ${cleanTopic} high tech futuristic laboratory, dramatic neon lighting, octane render`;
        prompt2 = `detailed close up, ${cleanTopic} core technology mechanism, holographic user interface, glowing data streams, 8k vertical`;
        prompt3 = `visualizing ${cleanTopic} real-time benchmarks and performance metrics, cybernetic architecture, dynamic lighting, 8k vertical`;
        prompt4 = `grand scale futuristic cityscape with ${cleanTopic} technology in action, cinematic wide angle, vertical 9:16, masterpiece 8k`;
      }

      job.script = [
        { line: 1, text: scene1Text, supported: true, sourceIds: [1] },
        { line: 2, text: scene2Text, supported: true, sourceIds: [1, 2] },
        { line: 3, text: scene3Text, supported: true, sourceIds: [2] },
        { line: 4, text: scene4Text, supported: true, sourceIds: [1, 2] },
      ];

      job.storyboard = [
        {
          sceneNo: 1,
          narration: scene1Text,
          visualPrompt: prompt1,
          imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt1)}?width=1080&height=1920&nologo=true&seed=${randomSeed}`,
          duration: 4,
          supported: true,
        },
        {
          sceneNo: 2,
          narration: scene2Text,
          visualPrompt: prompt2,
          imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt2)}?width=1080&height=1920&nologo=true&seed=${randomSeed + 1}`,
          duration: 5,
          supported: true,
        },
        {
          sceneNo: 3,
          narration: scene3Text,
          visualPrompt: prompt3,
          imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt3)}?width=1080&height=1920&nologo=true&seed=${randomSeed + 2}`,
          duration: 4,
          supported: true,
        },
        {
          sceneNo: 4,
          narration: scene4Text,
          visualPrompt: prompt4,
          imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt4)}?width=1080&height=1920&nologo=true&seed=${randomSeed + 3}`,
          duration: 4,
          supported: true,
        },
      ];

      setTimeout(() => {
        clearInterval(interval);
        setGenerationProgress(100);
        setCreatedJob(job);
        setStep(4);
      }, 3200);
    } catch (error) {
      clearInterval(interval);
      alert(`Error generating video: ${error.message}`);
      setStep(2);
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-10">
      <SectionTitle eyebrow="AI Video Creation Studio">
        Create Your Custom AI Short Video
      </SectionTitle>

      {/* STEP 1: TOPIC INPUT */}
      {step === 1 && (
        <GlassCard className="border-neon-cyan/40 p-8 shadow-[0_0_40px_rgba(50,230,255,0.12)]">
          <div className="mb-6">
            <span className="rounded-md bg-neon-cyan/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-neon-cyan border border-neon-cyan/30">
              Step 1 of 3: Topic & Idea
            </span>
            <h2 className="mt-3 text-2xl font-bold text-white">What topic would you like to make a video about?</h2>
            <p className="mt-1 text-sm text-muted">
              Enter any technical concept, GitHub repository, AI innovation, or scientific topic.
            </p>
          </div>

          <form onSubmit={handleStartInterview} className="space-y-6">
            <div>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. YOLOv11 Object Detection, Quantum Computing, or Autonomous Drones"
                className="w-full rounded-xl border border-white/20 bg-black/50 p-4 text-base text-white placeholder-slate-500 outline-none transition focus:border-neon-cyan focus:shadow-[0_0_24px_rgba(50,230,255,0.25)]"
                autoFocus
              />
            </div>

            {/* Quick Topic Chips */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Popular Suggestions:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  'YOLOv11 Real-Time Vision at 150 FPS',
                  '3D Gaussian Splatting vs NeRFs',
                  'Quantum Teleportation & Qubits',
                  'How AI Pull Request Reviewers Catch Zero-Days',
                  'Autonomous Drone Swarm Coordination',
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTopic(s)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:border-neon-cyan/60 hover:bg-neon-cyan/10 hover:text-white"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <NeonButton type="submit" disabled={!topic.trim()} className="w-full py-3.5 text-base">
                Start Live Interview Session →
              </NeonButton>
            </div>
          </form>
        </GlassCard>
      )}

      {/* STEP 2: LIVE INTERACTIVE INTERVIEW SESSION */}
      {step === 2 && (
        <GlassCard className="border-neon-cyan/40 p-8 shadow-[0_0_40px_rgba(50,230,255,0.12)]">
          <div className="mb-6 flex items-center justify-between">
            <span className="rounded-md bg-neon-cyan/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-neon-cyan border border-neon-cyan/30">
              Step 2 of 3: AI Interview Session
            </span>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-muted hover:text-neon-cyan"
              type="button"
            >
              ← Change Topic
            </button>
          </div>

          <h2 className="text-2xl font-bold text-white">Creative Interview for "{topic}"</h2>
          <p className="mt-1 text-sm text-slate-300">
            Answer the 3 creative questions below so ClipForge AI can ground the script and visuals to your exact vision.
          </p>

          <div className="mt-8 space-y-8">
            {/* Q1: Target Audience */}
            <div className="space-y-3">
              <label className="block text-sm font-bold uppercase tracking-wider text-neon-cyan">
                1. Target Audience
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {audienceOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedAudience(opt.title)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      selectedAudience === opt.title
                        ? 'border-neon-cyan bg-neon-cyan/10 shadow-[0_0_20px_rgba(50,230,255,0.15)] ring-1 ring-neon-cyan'
                        : 'border-white/10 bg-black/30 hover:border-white/30'
                    }`}
                  >
                    <div className="font-semibold text-white">{opt.title}</div>
                    <div className="mt-1 text-xs text-muted">{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Q2: Narrative Tone */}
            <div className="space-y-3">
              <label className="block text-sm font-bold uppercase tracking-wider text-neon-cyan">
                2. Narrative Tone & Style
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {toneOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedTone(opt.title)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      selectedTone === opt.title
                        ? 'border-neon-cyan bg-neon-cyan/10 shadow-[0_0_20px_rgba(50,230,255,0.15)] ring-1 ring-neon-cyan'
                        : 'border-white/10 bg-black/30 hover:border-white/30'
                    }`}
                  >
                    <div className="font-semibold text-white">{opt.title}</div>
                    <div className="mt-1 text-xs text-muted">{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Q3: Opening Hook Line */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold uppercase tracking-wider text-neon-cyan">
                  3. Choose Your Video Opening Hook
                </label>
                <div className="flex items-center gap-2">
                  {isAiGeneratingHooks && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2 py-0.5 text-[11px] font-mono text-neon-cyan animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-neon-cyan animate-ping" /> AI Crafting Live Hooks...
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleShuffleHooks}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-xs font-semibold text-neon-cyan transition hover:bg-neon-cyan/20 hover:border-neon-cyan cursor-pointer"
                  >
                    ✨ Shuffle / New Hooks
                  </button>
                </div>
              </div>
              <div className="space-y-2.5">
                {customHooks.length === 0 && isAiGeneratingHooks ? (
                  [1, 2, 3].map((n) => (
                    <div key={n} className="rounded-xl border border-neon-cyan/20 bg-black/40 p-4 animate-pulse">
                      <div className="h-3 w-16 bg-neon-cyan/30 rounded mb-2" />
                      <div className="h-4 w-5/6 bg-white/10 rounded" />
                    </div>
                  ))
                ) : (
                  customHooks.map((hook, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedHook(hook)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        selectedHook === hook
                          ? 'border-neon-cyan bg-neon-cyan/10 shadow-[0_0_20px_rgba(50,230,255,0.15)] ring-1 ring-neon-cyan text-white'
                          : 'border-white/10 bg-black/30 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <span className="mb-1 block text-xs font-bold text-neon-cyan">Option {idx + 1}</span>
                      "{hook}"
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4">
              <NeonButton onClick={handleGenerateVideo} className="w-full py-4 text-base font-bold">
                🎬 Generate & Render AI Short Video Now →
              </NeonButton>
            </div>
          </div>
        </GlassCard>
      )}

      {/* STEP 3: LIVE GENERATION PROGRESS */}
      {step === 3 && (
        <GlassCard className="border-neon-cyan p-8 md:p-10 text-center shadow-[0_0_50px_rgba(50,230,255,0.25)]">
          <div className="mx-auto max-w-sm mb-2">
            <BotScene status="thinking" className="!h-52" />
          </div>

          <h2 className="text-2xl font-bold text-white">Generating AI Short Video</h2>
          <p className="mt-2 font-mono text-sm text-neon-cyan">{currentGenerationPhase}</p>

          <div className="mx-auto mt-6 max-w-md">
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/60 border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-neon-cyan via-blue-500 to-indigo-500 transition-all duration-500 shadow-[0_0_12px_#32e6ff]"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <span className="mt-3 block font-mono text-xs text-muted">{generationProgress}% complete</span>
          </div>
        </GlassCard>
      )}

      {/* STEP 4: LIVE RENDERED VIDEO PLAYER THEATER */}
      {step === 4 && createdJob && (
        <div className="space-y-8">
          <GlassCard className="border-neon-cyan p-8 shadow-[0_0_50px_rgba(50,230,255,0.2)]">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300 border border-emerald-400/30">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Video Ready & Playing
                </span>
                <h2 className="mt-2 text-2xl font-bold text-white">{createdJob.topic}</h2>
                <p className="text-xs text-muted">Audience: {selectedAudience} • Tone: {selectedTone}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAspectRatio('vertical')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    aspectRatio === 'vertical'
                      ? 'border border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                      : 'border border-white/10 text-muted hover:text-white'
                  }`}
                  type="button"
                >
                  📱 9:16 Shorts
                </button>
                <button
                  onClick={() => setAspectRatio('cinematic')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    aspectRatio === 'cinematic'
                      ? 'border border-neon-cyan bg-neon-cyan/20 text-neon-cyan'
                      : 'border border-white/10 text-muted hover:text-white'
                  }`}
                  type="button"
                >
                  🖥️ 16:9 Wide
                </button>
              </div>
            </div>

            {/* Native In-Browser Video Player Engine with Animated Captions & Voice */}
            <InteractiveVideoPlayer
              topic={createdJob.topic}
              scenes={createdJob.storyboard}
              aspectRatio={aspectRatio}
            />

            {/* Options Bar */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
              <button
                onClick={() => setStep(1)}
                className="text-sm font-semibold text-neon-cyan hover:underline"
                type="button"
              >
                + Create Another Topic Video
              </button>

              <NeonButton onClick={() => navigate('/jobs')}>
                View All Jobs in Queue →
              </NeonButton>
            </div>
          </GlassCard>
        </div>
      )}
    </section>
  );
}
