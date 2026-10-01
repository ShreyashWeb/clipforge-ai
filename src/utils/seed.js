import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { connectDatabase } from './database.js';

const placeholderImage = (seed) =>
  `https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1280&q=80&sig=${seed}`;

const source = (title, url) => ({ title, url });

const scenes = (topic, count, offset) =>
  Array.from({ length: count }, (_, index) => ({
    scene: index + 1,
    narration: `${topic}: scene ${index + 1} explains the key idea with a concrete example.`,
    imageUrl: placeholderImage(offset + index),
    duration: 4 + (index % 3),
  }));

const script = (topic, count, unsupportedIndex = -1) =>
  Array.from({ length: count }, (_, index) => ({
    line: index + 1,
    text: `${topic} - the most important takeaway is to connect evidence with action.`,
    supported: index !== unsupportedIndex,
  }));

export const sampleJobs = [
  {
    userId: 'demo-user',
    topic: 'Why battery storage is changing renewable energy',
    sourceType: 'topic',
    status: 'INTERVIEW',
    interviewAnswers: { audience: 'curious beginners', tone: 'clear and optimistic' },
    hooks: ['The missing piece of clean energy is not sunlight - it is storage.'],
    sources: [
      source('International Energy Agency: Batteries and secure energy transitions', 'https://www.iea.org/reports/batteries-and-secure-energy-transitions'),
      source('US Department of Energy: Energy storage', 'https://www.energy.gov/oe/energy-storage'),
    ],
    script: script('Battery storage', 4, 2),
    storyboard: scenes('Battery storage', 4, 10),
    costEstimate: 0,
  },
  {
    userId: 'demo-user',
    topic: 'How a pull request becomes a safer software release',
    sourceType: 'github',
    status: 'STORYBOARD_APPROVAL',
    selectedAngle: 'The review checklist that catches bugs before users do',
    hooks: ['A pull request is more than a code diff - it is a safety net.'],
    sources: [
      source('GitHub Docs: About pull requests', 'https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/about-pull-requests'),
      source('Google Engineering Practices: Code review', 'https://google.github.io/eng-practices/review/'),
    ],
    script: script('Code review', 5, 3),
    storyboard: scenes('Code review', 5, 20),
    approvals: [{ gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-28') }],
    costEstimate: 1.8,
  },
  {
    userId: 'demo-user',
    topic: 'The hidden logistics behind next-day delivery',
    sourceType: 'topic',
    status: 'RENDER',
    selectedAngle: 'The warehouse decisions that make speed possible',
    hooks: ['Next-day delivery starts long before you click buy.'],
    sources: [
      source('MIT Center for Transportation and Logistics', 'https://ctl.mit.edu/'),
      source('US Census Bureau: E-commerce statistics', 'https://www.census.gov/programs-surveys/e-stats.html'),
    ],
    script: script('Delivery logistics', 6, 1),
    storyboard: scenes('Delivery logistics', 6, 30),
    audioUrl: 'https://cdn.example.com/audio/delivery-logistics.mp3',
    approvals: [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-26') },
      { gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date('2026-09-27') },
    ],
    costEstimate: 8.4,
  },
  {
    userId: 'demo-user',
    topic: 'What makes coral reefs resilient',
    sourceType: 'topic',
    status: 'PUBLISHED',
    selectedAngle: 'Resilience is a network effect under the sea',
    hooks: ['A coral reef is a city, a nursery, and a climate record at once.'],
    sources: [
      source('NOAA Coral Reef Conservation Program', 'https://coralreef.noaa.gov/'),
      source('Smithsonian Ocean: Coral reefs', 'https://ocean.si.edu/ecosystems/coral-reefs'),
    ],
    script: script('Coral reef resilience', 4),
    storyboard: scenes('Coral reef resilience', 4, 40),
    audioUrl: 'https://cdn.example.com/audio/coral-reefs.mp3',
    videoUrl: 'https://cdn.example.com/video/coral-reefs.mp4',
    approvals: [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-20') },
      { gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date('2026-09-21') },
      { gate: 'FINAL_APPROVAL', decision: 'approved', at: new Date('2026-09-22') },
    ],
    costEstimate: 14.2,
  },
  {
    userId: 'demo-user',
    topic: 'Why urban trees cool streets',
    sourceType: 'topic',
    status: 'FAILED',
    selectedAngle: 'Shade is only one part of the cooling effect',
    hooks: ['The best air conditioner on a city block may be rooted in the pavement.'],
    sources: [
      source('EPA: Reducing urban heat islands', 'https://www.epa.gov/heatislands'),
      source('US Forest Service: Urban forests', 'https://www.fs.usda.gov/managing-land/urban-forests'),
    ],
    script: script('Urban tree cooling', 5, 4),
    storyboard: scenes('Urban tree cooling', 5, 50),
    approvals: [{ gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-25') }],
    costEstimate: 3.1,
  },
];

/**
 * Replaces demo jobs in MongoDB with the sample dataset.
 *
 * @returns {Promise<void>}
 */
export async function seedJobs() {
  await connectDatabase();
  await Job.deleteMany({ userId: 'demo-user' });
  await Job.insertMany(sampleJobs);
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedJobs()
    .then(async () => {
      console.log(`Seeded ${sampleJobs.length} demo jobs`);
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      console.error(`Could not seed demo jobs: ${error.message}`);
      await mongoose.disconnect();
      process.exitCode = 1;
    });
}
