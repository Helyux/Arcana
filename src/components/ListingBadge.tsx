import React from 'react';

interface MatchInfo {
  name: string;
  icon: string;
}

interface Props {
  wear: string;
  pattern: string;
  isMatched?: boolean;
  matchInfo?: MatchInfo | null;
  rank?: number | null;
}

const formatFloat = (wear: string) => {
  const float = parseFloat(wear);
  if (isNaN(float)) return wear;
  return float.toFixed(6);
};

const getFloatColor = (wear: string): string | undefined => {
  const float = parseFloat(wear);
  if (isNaN(float)) return undefined;
  if (float < 0.001) return '#4ade80';  // green
  if (float < 0.01) return '#60a5fa';   // blue
  if (float > 0.06) return '#f87171';   // red
  return undefined;
};

const formatGroupName = (name: string) => {
  return name.replace(/_/g, ' ').toUpperCase();
};

// Color mapping for pattern group tags
const groupColors: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  gem_blue:    { bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.4)',  glow: 'rgba(59,130,246,0.25)' },
  gem_gold:    { bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.4)',  glow: 'rgba(245,158,11,0.25)' },
  gem_purple:  { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc', border: 'rgba(168,85,247,0.4)',  glow: 'rgba(168,85,247,0.25)' },
  gem_red:     { bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.4)',   glow: 'rgba(239,68,68,0.25)' },
  gem_green:   { bg: 'rgba(34,197,94,0.15)',   text: '#4ade80', border: 'rgba(34,197,94,0.4)',   glow: 'rgba(34,197,94,0.25)' },
  gem_pink:    { bg: 'rgba(236,72,153,0.15)',  text: '#f472b6', border: 'rgba(236,72,153,0.4)',  glow: 'rgba(236,72,153,0.25)' },
  gem_orange:  { bg: 'rgba(249,115,22,0.15)',  text: '#fb923c', border: 'rgba(249,115,22,0.4)',  glow: 'rgba(249,115,22,0.25)' },
  gem_black:   { bg: 'rgba(120,120,140,0.15)', text: '#a1a1b5', border: 'rgba(120,120,140,0.4)', glow: 'rgba(120,120,140,0.25)' },
  gem_white:   { bg: 'rgba(255,255,255,0.12)', text: '#e2e2ec', border: 'rgba(255,255,255,0.3)', glow: 'rgba(255,255,255,0.15)' },
  gem_diamond: { bg: 'rgba(147,197,253,0.15)', text: '#93c5fd', border: 'rgba(147,197,253,0.4)', glow: 'rgba(147,197,253,0.25)' },
  fire_and_ice:{ bg: 'rgba(99,102,241,0.15)',  text: '#a5b4fc', border: 'rgba(99,102,241,0.4)',  glow: 'rgba(99,102,241,0.25)' },
  blaze:       { bg: 'rgba(249,115,22,0.15)',  text: '#fb923c', border: 'rgba(249,115,22,0.4)',  glow: 'rgba(249,115,22,0.25)' },
  fade:        { bg: 'rgba(168,85,247,0.15)',  text: '#c084fc', border: 'rgba(168,85,247,0.4)',  glow: 'rgba(168,85,247,0.25)' },
};

const defaultColor = { bg: 'rgba(239,68,68,0.15)', text: '#f87171', border: 'rgba(239,68,68,0.4)', glow: 'rgba(239,68,68,0.25)' };

export const ListingBadge: React.FC<Props> = ({ wear, pattern, isMatched, matchInfo, rank }) => {
  const neutralStyle = "bg-black/30 text-white/90 border-white/20 hover:bg-black/50 hover:text-white h-6";

  const colors = matchInfo ? (groupColors[matchInfo.name] || defaultColor) : defaultColor;

  const patternStyle = isMatched
    ? `h-6`
    : neutralStyle;

  const patternInlineStyle = isMatched ? {
    background: colors.bg,
    color: colors.text,
    borderColor: colors.border,
    boxShadow: `0 0 10px ${colors.glow}`,
    borderWidth: '1px',
    borderStyle: 'solid',
  } : undefined;

  return (
    <div className="arcana-badge-container flex flex-wrap items-center gap-2 mt-2 select-none pointer-events-none font-sans">
      {wear && (
        <div
          className={`px-2 flex items-center rounded border backdrop-blur-md transition-all duration-300 text-[11px] font-bold tracking-tight shadow-lg ${neutralStyle}`}
          style={getFloatColor(wear) ? { color: getFloatColor(wear), borderColor: getFloatColor(wear) + '66' } : undefined}
        >
          <span className="opacity-50 mr-1.5 text-[10px] uppercase font-black" style={getFloatColor(wear) ? { color: getFloatColor(wear), opacity: 0.6 } : undefined}>FLOAT</span>
          {formatFloat(wear)}
        </div>
      )}
      {pattern && (
        <div
          className={`px-2 flex items-center rounded backdrop-blur-md transition-all duration-300 text-[11px] font-bold tracking-tight shadow-lg ${patternStyle}`}
          style={patternInlineStyle}
        >
          <span className={`mr-1.5 text-[10px] uppercase font-black`} style={isMatched ? { color: colors.text, opacity: 0.6 } : { opacity: 0.5 }}>PATTERN</span>
          {pattern}
        </div>
      )}
      {isMatched && matchInfo && (
        <div
          className="px-2 h-6 flex items-center rounded backdrop-blur-md transition-all duration-300 text-[11px] font-bold tracking-tight shadow-lg"
          style={{
            background: colors.bg,
            color: colors.text,
            borderColor: colors.border,
            borderWidth: '1px',
            borderStyle: 'solid',
            boxShadow: `0 0 10px ${colors.glow}`,
          }}
        >
          <span className="mr-1">{matchInfo.icon}</span>
          <span className="text-[10px] uppercase font-black tracking-wider">{formatGroupName(matchInfo.name)}</span>
        </div>
      )}
      {rank != null && (
        <div
          className={`px-2 h-6 flex items-center rounded border backdrop-blur-md transition-all duration-300 text-[11px] font-bold tracking-tight shadow-lg ${rank <= 30 ? '' : neutralStyle}`}
          style={rank <= 30
            ? { color: '#facc15', borderColor: 'rgba(250,204,21,0.4)', background: 'rgba(0,0,0,0.3)' }
            : undefined
          }
        >
          <span className="opacity-50 mr-1.5 text-[10px] uppercase font-black" style={rank <= 30 ? { color: '#facc15', opacity: 0.6 } : undefined}>RANK</span>
          #{rank}
        </div>
      )}
    </div>
  );
};
