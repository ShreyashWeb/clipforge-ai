import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { TopNav } from './components/TopNav.jsx';
import { AmbientParticles } from './components/AmbientParticles.jsx';
import { Landing } from './pages/Landing.jsx';
import { Jobs } from './pages/Jobs.jsx';
import { JobDetail } from './pages/JobDetail.jsx';
import { CreateVideo } from './pages/CreateVideo.jsx';
import { PageTransition } from './components/PageTransition.jsx';

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <AmbientParticles />
        <TopNav />
        <PageTransition>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/create" element={<CreateVideo />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
          </Routes>
        </PageTransition>
      </HashRouter>
    </MotionConfig>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
