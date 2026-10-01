export function GlassCard({ children, className = '', ...props }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-[0_0_32px_rgba(50,230,255,0.04)] backdrop-blur-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
