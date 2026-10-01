const statusStyles = {
  INTERVIEW: 'border-violet-400/40 bg-violet-400/10 text-violet-200',
  ANGLE_APPROVAL: 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan',
  STORYBOARD_APPROVAL: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  RENDER: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  FINAL_APPROVAL: 'border-orange-300/40 bg-orange-300/10 text-orange-200',
  PUBLISHED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  FAILED: 'border-neon-red/40 bg-neon-red/10 text-neon-red',
  REJECTED: 'border-slate-400/40 bg-slate-400/10 text-slate-200',
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] ${
        statusStyles[status] || statusStyles.REJECTED
      }`}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}
