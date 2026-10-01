import { Link, NavLink } from 'react-router-dom';

export function TopNav() {
  const linkClass = ({ isActive }) =>
    `text-sm transition-colors ${isActive ? 'text-neon-cyan' : 'text-slate-400 hover:text-white'}`;

  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
        <Link className="text-lg font-black tracking-tight text-white" to="/">
          ClipForge <span className="text-neon-red">AI</span>
        </Link>
        <div className="flex items-center gap-6">
          <NavLink className={linkClass} to="/">Home</NavLink>
          <NavLink className={linkClass} to="/jobs">Jobs</NavLink>
        </div>
      </nav>
    </header>
  );
}
