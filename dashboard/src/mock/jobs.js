const image = (seed) =>
  `https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1280&q=80&sig=${seed}`;

const makeScenes = (topic, count, offset) =>
  Array.from({ length: count }, (_, index) => ({
    scene: index + 1,
    narration: `${topic}: scene ${index + 1} explains the key idea with a concrete example.`,
    imageUrl: image(offset + index),
    duration: 4 + (index % 3),
  }));

const makeScript = (topic, count, unsupportedIndex = -1) =>
  Array.from({ length: count }, (_, index) => ({
    line: index + 1,
    text: `${topic} - the most important takeaway is to connect evidence with action.`,
    supported: index !== unsupportedIndex,
  }));

const source = (title, url) => ({ title, url });

export const mockJobs = [
  {
    _id: 'demo-interview',
    userId: 'demo-user',
    topic: 'Why battery storage is changing renewable energy',
    status: 'INTERVIEW',
    sources: [source('IEA: Batteries and secure energy transitions', 'https://www.iea.org/reports/batteries-and-secure-energy-transitions')],
    script: makeScript('Battery storage', 4, 2),
    storyboard: makeScenes('Battery storage', 4, 10),
  },
  {
    _id: 'demo-storyboard',
    userId: 'demo-user',
    topic: 'How a pull request becomes a safer software release',
    status: 'STORYBOARD_APPROVAL',
    sources: [source('GitHub Docs: About pull requests', 'https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/about-pull-requests')],
    script: makeScript('Code review', 5, 3),
    storyboard: makeScenes('Code review', 5, 20),
  },
  {
    _id: 'demo-render',
    userId: 'demo-user',
    topic: 'The hidden logistics behind next-day delivery',
    status: 'RENDER',
    sources: [source('US Census Bureau: E-commerce statistics', 'https://www.census.gov/programs-surveys/e-stats.html')],
    script: makeScript('Delivery logistics', 6, 1),
    storyboard: makeScenes('Delivery logistics', 6, 30),
  },
  {
    _id: 'demo-published',
    userId: 'demo-user',
    topic: 'What makes coral reefs resilient',
    status: 'PUBLISHED',
    videoUrl: 'https://cdn.example.com/video/coral-reefs.mp4',
    sources: [source('NOAA Coral Reef Conservation Program', 'https://coralreef.noaa.gov/')],
    script: makeScript('Coral reef resilience', 4),
    storyboard: makeScenes('Coral reef resilience', 4, 40),
  },
  {
    _id: 'demo-failed',
    userId: 'demo-user',
    topic: 'Why urban trees cool streets',
    status: 'FAILED',
    sources: [source('EPA: Reducing urban heat islands', 'https://www.epa.gov/heatislands')],
    script: makeScript('Urban tree cooling', 5, 4),
    storyboard: makeScenes('Urban tree cooling', 5, 50),
  },
];
