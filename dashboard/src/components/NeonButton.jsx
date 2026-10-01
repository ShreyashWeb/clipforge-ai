import { forwardRef } from 'react';

export const NeonButton = forwardRef(function NeonButton(
  { children, tone = 'cyan', className = '', type = 'button', ...props },
  ref,
) {
  const toneClasses =
    tone === 'red'
      ? 'border-neon-red/60 text-neon-red shadow-[0_0_18px_rgba(255,54,94,0.18)] hover:bg-neon-red/10'
      : 'border-neon-cyan/60 text-neon-cyan shadow-[0_0_18px_rgba(50,230,255,0.18)] hover:bg-neon-cyan/10';

  return (
    <button
      ref={ref}
      type={type}
      className={`neon-button inline-flex items-center justify-center rounded-lg border bg-black/20 px-4 py-2 text-sm font-semibold tracking-wide transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
