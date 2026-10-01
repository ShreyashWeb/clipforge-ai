import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import './styles.css';
import { TopNav } from './components/TopNav.jsx';
import { Landing } from './pages/Landing.jsx';
import { Jobs } from './pages/Jobs.jsx';
import { JobDetail } from './pages/JobDetail.jsx';

function App() {
  return (
    <HashRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetail />} />
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
