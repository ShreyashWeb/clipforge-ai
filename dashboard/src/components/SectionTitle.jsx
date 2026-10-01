export function SectionTitle({ eyebrow, children, action }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-neon-cyan">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{children}</h2>
      </div>
      {action}
    </div>
  );
}
