import 'dotenv/config';
import mongoose from 'mongoose';
import { Job } from '../models/Job.js';
import { connectDatabase } from './database.js';

export const sampleJobs = [
  {
    userId: 'demo-user',
    topic: 'YOLOv11: How Real-Time Vision Detects 80 Objects at 150 FPS',
    sourceType: 'github',
    status: 'FINAL_APPROVAL',
    selectedAngle: 'From grid-based bounding boxes to end-to-end edge AI architectures',
    hooks: [
      'Your phone camera recognizes your face in milliseconds — here is the neural architecture making it possible.',
      'Single-pass detection changed computer vision forever: welcome to YOLOv11.',
    ],
    interviewAnswers: {
      targetAudience: 'Developers & AI Engineers',
      tone: 'Fast-paced, insightful, and technical',
      visualStyle: 'Cyberpunk HUD & bounding box overlays',
    },
    sources: [
      { id: 1, title: 'Ultralytics: YOLOv11 Architecture Deep Dive', url: 'https://docs.ultralytics.com/models/yolo11/' },
      { id: 2, title: 'CVPR 2024: Real-Time Object Detection Benchmarks', url: 'https://openaccess.thecvf.com/' },
      { id: 3, title: 'Edge AI Foundation: TensorRT & CoreML Quantization', url: 'https://www.edge-ai-vision.com/' },
    ],
    script: [
      { line: 1, text: 'Traditional object detection evaluated thousands of image crops sequentially, taking seconds per frame.', sourceIds: [1, 2], supported: true },
      { line: 2, text: 'YOLO revolutionized this by treating detection as a single regression problem across an entire unified grid.', sourceIds: [1], supported: true },
      { line: 3, text: 'YOLOv11 introduces depth-wise separable convolutions and C3k2 blocks, reducing parameter count by 22%.', sourceIds: [1, 2], supported: true },
      { line: 4, text: 'With INT8 quantization, it achieves 150+ frames per second directly on mobile chipsets and edge drones.', sourceIds: [3], supported: true },
      { line: 5, text: 'From autonomous robotics to medical imaging, real-time vision is now accessible on everyday hardware.', sourceIds: [1, 3], supported: true },
    ],
    storyboard: [
      {
        sceneNo: 1,
        imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1280&q=80',
        narration: 'Visualizing a high-density urban street through neon bounding boxes and class labels in real-time.',
        duration: 4,
        supported: true,
      },
      {
        sceneNo: 2,
        imageUrl: 'https://images.unsplash.com/photo-1507146153580-69a1fe6d8aa1?auto=format&fit=crop&w=1280&q=80',
        narration: 'Single-pass convolutional feature maps dividing the image grid into coordinate regression anchors.',
        duration: 5,
        supported: true,
      },
      {
        sceneNo: 3,
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',
        narration: 'Neural network architecture visualization highlighting C3k2 attention blocks and neck optimization.',
        duration: 4,
        supported: true,
      },
      {
        sceneNo: 4,
        imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1280&q=80',
        narration: 'Autonomous robotics vision system tracking obstacles and pedestrians at 150 FPS on edge hardware.',
        duration: 5,
        supported: true,
      },
      {
        sceneNo: 5,
        imageUrl: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=1280&q=80',
        narration: 'Final summary displaying performance comparison graphs, latency metrics, and open source repository.',
        duration: 4,
        supported: true,
      },
    ],
    audioUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/audio/sample.mp3',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    approvals: [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-28T10:15:00Z') },
      { gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date('2026-09-28T14:30:00Z') },
    ],
    costEstimate: 14.5,
  },
  {
    userId: 'demo-user',
    topic: 'Edge AI: Deploying YOLOv11 on 5-Watt Drones and Microcontrollers',
    sourceType: 'topic',
    status: 'STORYBOARD_APPROVAL',
    selectedAngle: 'Model pruning and INT8 post-training quantization for low-power robotics',
    hooks: [
      'How do search-and-rescue drones spot survivors without an internet connection?',
      'Running state-of-the-art computer vision under extreme thermal and battery constraints.',
    ],
    sources: [
      { id: 1, title: 'IEEE Transactions: Embedded Computer Vision', url: 'https://ieeexplore.ieee.org/' },
      { id: 2, title: 'TinyML Research: Neural Pruning for Microcontrollers', url: 'https://www.tinyml.org/' },
    ],
    script: [
      { line: 1, text: 'Drones in disaster zones cannot rely on cloud APIs with hundreds of milliseconds of latency.', sourceIds: [1], supported: true },
      { line: 2, text: 'Through INT8 quantization, 32-bit floating point weights are mapped into 8-bit integers without accuracy loss.', sourceIds: [1, 2], supported: true },
      { line: 3, text: 'Specialized NPU accelerators like Apple Neural Engine and Coral Edge TPU process inferences in under 6ms.', sourceIds: [2], supported: true },
      { line: 4, text: 'This allows autonomous micro-drones to navigate dense forests and navigate search grids locally.', sourceIds: [1], supported: true },
    ],
    storyboard: [
      {
        sceneNo: 1,
        imageUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1280&q=80',
        narration: 'Autonomous quadcopter drone flying through a dense mountain search terrain.',
        duration: 4,
        supported: true,
      },
      {
        sceneNo: 2,
        imageUrl: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&w=1280&q=80',
        narration: 'Macro view of silicon microchip with glowing circuit traces demonstrating low-power NPU processing.',
        duration: 4,
        supported: true,
      },
      {
        sceneNo: 3,
        imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1280&q=80',
        narration: 'Real-time telemetry and object detection feed highlighting survivor location coordinates.',
        duration: 5,
        supported: true,
      },
    ],
    approvals: [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-29T11:00:00Z') },
    ],
    costEstimate: 8.2,
  },
  {
    userId: 'demo-user',
    topic: '3D Gaussian Splatting: The End of Traditional Polygons?',
    sourceType: 'topic',
    status: 'RENDER',
    selectedAngle: 'Rasterizing millions of 3D Gaussians in real time vs ray marching NeRFs',
    hooks: ['Video games and VFX have used 3D polygons for 40 years — but that is about to change.'],
    sources: [
      { id: 1, title: 'SIGGRAPH 2023: 3D Gaussian Splatting for Real-Time Radiance Field Rendering', url: 'https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/' },
      { id: 2, title: 'NVIDIA Research: Radiance Field Reconstruction', url: 'https://research.nvidia.com/' },
    ],
    script: [
      { line: 1, text: 'Creating photorealistic 3D virtual worlds used to require manual 3D modeling or hours of ray marching.', sourceIds: [1], supported: true },
      { line: 2, text: 'Gaussian Splatting represents 3D space as millions of overlapping, semi-transparent ellipsoids.', sourceIds: [1, 2], supported: true },
      { line: 3, text: 'By rasterizing them directly with GPU compute shaders, it renders 4K scenes at over 200 FPS.', sourceIds: [1], supported: true },
    ],
    storyboard: [
      {
        sceneNo: 1,
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1280&q=80',
        narration: 'A point cloud of millions of glowing color particles consolidating into a photorealistic architectural room.',
        duration: 5,
        supported: true,
      },
      {
        sceneNo: 2,
        imageUrl: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1280&q=80',
        narration: 'Camera gliding through complex reflections and volumetric light scattering without polygons.',
        duration: 4,
        supported: true,
      },
    ],
    approvals: [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-27T09:00:00Z') },
      { gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date('2026-09-27T16:20:00Z') },
    ],
    costEstimate: 12.0,
  },
  {
    userId: 'demo-user',
    topic: 'How an AI Agent Catches Zero-Days Before PR Merge',
    sourceType: 'github',
    status: 'ANGLE_APPROVAL',
    selectedAngle: 'Semantic AST differential analysis vs basic regex security linters',
    hooks: ['One insecure line in a pull request took down millions of systems. Here is how AI fixes it.'],
    sources: [
      { id: 1, title: 'GitHub Security Lab: Automated Code Analysis', url: 'https://securitylab.github.com/' },
      { id: 2, title: 'Google Engineering Practices: Modern Code Reviews', url: 'https://google.github.io/eng-practices/' },
    ],
    script: [
      { line: 1, text: 'Human code reviewers catch logic bugs, but subtle memory leaks and race conditions slip through.', sourceIds: [2], supported: true },
      { line: 2, text: 'By compiling pull request diffs into Abstract Syntax Trees, AI agents reason about execution paths.', sourceIds: [1], supported: true },
    ],
    storyboard: [
      {
        sceneNo: 1,
        imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1280&q=80',
        narration: 'A dual-pane code diff highlighting a critical concurrency deadlock in green and red markers.',
        duration: 4,
        supported: true,
      },
    ],
    approvals: [],
    costEstimate: 3.5,
  },
  {
    userId: 'demo-user',
    topic: 'Bio-Acoustic AI: Listening to Coral Reef Recovery',
    sourceType: 'topic',
    status: 'PUBLISHED',
    selectedAngle: 'Underwater hydrophones and neural audio classifiers tracking reef biodiversity',
    hooks: ['A healthy coral reef is one of the loudest places on Earth.'],
    sources: [
      { id: 1, title: 'NOAA Coral Reef Conservation Program', url: 'https://coralreef.noaa.gov/' },
      { id: 2, title: 'Nature Communications: Acoustic Monitoring of Marine Ecosystems', url: 'https://www.nature.com/' },
    ],
    script: [
      { line: 1, text: 'Healthy coral reefs crackle with the sounds of snapping shrimp and courting fish.', sourceIds: [1], supported: true },
      { line: 2, text: 'Marine biologists deployed hydrophone arrays to record thousands of hours of ocean soundscapes.', sourceIds: [1, 2], supported: true },
      { line: 3, text: 'Trained audio AI models now identify reef recovery rates with 98% human-level accuracy.', sourceIds: [2], supported: true },
    ],
    storyboard: [
      {
        sceneNo: 1,
        imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1280&q=80',
        narration: 'Vibrant turquoise underwater reef teeming with tropical fish and sunlight rays.',
        duration: 4,
        supported: true,
      },
      {
        sceneNo: 2,
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1280&q=80',
        narration: 'Bio-acoustic spectrogram frequencies pulsing across a glowing cyber audio dashboard.',
        duration: 4,
        supported: true,
      },
    ],
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    approvals: [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-20T08:00:00Z') },
      { gate: 'STORYBOARD_APPROVAL', decision: 'approved', at: new Date('2026-09-21T12:00:00Z') },
      { gate: 'FINAL_APPROVAL', decision: 'approved', at: new Date('2026-09-22T15:00:00Z') },
    ],
    costEstimate: 16.8,
  },
  {
    userId: 'demo-user',
    topic: 'Topological Qubits: Solving Quantum Decoherence',
    sourceType: 'topic',
    status: 'INTERVIEW',
    selectedAngle: 'Using Majorana zero-modes to build hardware-level error-protected quantum computers',
    hooks: ['The biggest obstacle to quantum computing is noise. Topology might be the cure.'],
    sources: [
      { id: 1, title: 'Physical Review Letters: Majorana Fermions in Nanowires', url: 'https://journals.aps.org/prl/' },
      { id: 2, title: 'MIT Technology Review: Quantum Error Correction Milestones', url: 'https://www.technologyreview.com/' },
    ],
    script: [
      { line: 1, text: 'Current quantum computers lose their state within microseconds due to environmental thermal noise.', sourceIds: [1], supported: true },
      { line: 2, text: 'Topological qubits store quantum information non-locally across paired quasiparticles.', sourceIds: [1, 2], supported: true },
    ],
    storyboard: [
      {
        sceneNo: 1,
        imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1280&q=80',
        narration: 'Golden quantum dilution refrigerator chandelier hanging in a pristine cryogenic cleanroom.',
        duration: 5,
        supported: true,
      },
    ],
    approvals: [],
    costEstimate: 1.2,
  },
  {
    userId: 'demo-user',
    topic: 'Laser Ablation for Low Earth Orbit Space Debris Removal',
    sourceType: 'topic',
    status: 'FAILED',
    selectedAngle: 'Photon thrust vaporizing debris surfaces to safely lower orbit perigees',
    hooks: ['Over 30,000 pieces of lethal space junk threaten every satellite in orbit.'],
    sources: [
      { id: 1, title: 'NASA Orbital Debris Program Office', url: 'https://orbitaldebris.jsc.nasa.gov/' },
      { id: 2, title: 'ESA Clean Space Initiative', url: 'https://www.esa.int/' },
    ],
    script: [
      { line: 1, text: 'Space debris traveling at 17,500 miles per hour makes physical capture risky.', sourceIds: [1], supported: true },
      { line: 2, text: 'Ground-based pulsed lasers can exert radiation pressure to induce de-orbit decay.', sourceIds: [1, 2], supported: true },
    ],
    storyboard: [
      {
        sceneNo: 1,
        imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1280&q=80',
        narration: 'Glowing laser pulse tracking a tumbling defunct satellite against Earth orbital curvature.',
        duration: 4,
        supported: true,
      },
    ],
    approvals: [
      { gate: 'ANGLE_APPROVAL', decision: 'approved', at: new Date('2026-09-25T14:00:00Z') },
    ],
    costEstimate: 4.8,
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
