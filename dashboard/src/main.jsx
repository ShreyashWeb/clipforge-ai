import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { TopNav } from './components/TopNav.jsx';
import { Landing } from './pages/Landing.jsx';
import { Jobs } from './pages/Jobs.jsx';
import { JobDetail } from './pages/JobDetail.jsx';
import { PageTransition } from './components/PageTransition.jsx';

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
      <TopNav />
        <PageTransition>
          <Routes>
            <Route path="/" element={<Landing />} />
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
