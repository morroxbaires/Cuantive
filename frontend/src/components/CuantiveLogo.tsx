import { cn } from '@/lib/utils';

interface CuantiveLogoProps {
  /** Show only the icon mark (no text) */
  iconOnly?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Dark background variant (logo text in white/light blue as per brand) */
  dark?: boolean;
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: 'text-base',  sub: 'text-[7px]',  gap: 'gap-1.5' },
  md: { icon: 32, text: 'text-xl',    sub: 'text-[9px]',  gap: 'gap-2'   },
  lg: { icon: 44, text: 'text-2xl',   sub: 'text-[11px]', gap: 'gap-2.5' },
  xl: { icon: 64, text: 'text-[2rem]',sub: 'text-sm',     gap: 'gap-3.5' },
};

/** SVG mark — the stylised Q from the Cuantive identity */
function QMark({ width }: { width: number }) {
  const h = width;
  return (
    <svg width={width} height={h} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="cuantive-qg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#1A5AAD" />
          <stop offset="55%"  stopColor="#2B7DCC" />
          <stop offset="100%" stopColor="#5BBDE4" />
        </linearGradient>
        {/* Slightly lighter version for inner highlight */}
        <linearGradient id="cuantive-qg2" x1="20" y1="20" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#3B99E0" />
          <stop offset="100%" stopColor="#7DD3F8" />
        </linearGradient>
      </defs>

      {/*
        The Q ring:
        - Large arc from ~top (12 o'clock) going counter-clockwise, stopping at ~5 o'clock
        - Gap at bottom-right (~60°)
        Center: (32,32), outer radius: 25, stroke: 9
        Arc start angle: 315° (top-right quadrant, 10 o'clock)
        Arc end: 135° (bottom-right quadrant, 5 o'clock) — clockwise big arc
      */}
      <path
        d="
          M 32 7
          A 25 25 0 1 0 53.7 43.5
        "
        stroke="url(#cuantive-qg)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      {/*
        The small arc (inner lighter highlight, top part of ring)
        A tiny arc on the top-right to simulate the 'incomplete ring' look
      */}
      <path
        d="M 49 11 A 25 25 0 0 1 53.7 18"
        stroke="url(#cuantive-qg2)"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />

      {/*
        The tail / slash of the Q:
        Two parallel diagonal strokes from center-right going to bottom-right
        Matches the logo's diagonal slash element
      */}
      <line
        x1="46" y1="43"
        x2="59" y2="58"
        stroke="url(#cuantive-qg)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* Short top parallel stroke */}
      <line
        x1="40" y1="49"
        x2="47.5" y2="57"
        stroke="url(#cuantive-qg2)"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.65"
      />
    </svg>
  );
}

export function CuantiveLogo({
  iconOnly = false,
  size = 'md',
  dark = false,
  className,
}: CuantiveLogoProps) {
  const { icon, text, sub, gap } = sizes[size];

  if (iconOnly) {
    return <QMark width={icon} />;
  }

  return (
    <div className={cn('flex items-center', gap, className)} aria-label="Cuantive — Operational Intelligence">
      <QMark width={icon} />
      <div className="flex flex-col leading-none">
        <span className={cn('font-extrabold tracking-tight', text)}>
          <span style={{ color: dark ? '#60A5FA' : '#2563EB' }}>CUAN</span>
          <span style={{ color: dark ? '#FFFFFF' : '#0F172A' }}>TIVE</span>
        </span>
        {size !== 'sm' && (
          <span
            className={cn('font-medium tracking-widest uppercase', sub)}
            style={{ color: dark ? '#94A3B8' : '#64748B', letterSpacing: '0.14em' }}
          >
            Operational Intelligence
          </span>
        )}
      </div>
    </div>
  );
}
