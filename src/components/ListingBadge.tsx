import React from 'react';

interface Props {
  wear: string;
  pattern: string;
  isMatched?: boolean;
}

const formatFloat = (wear: string) => {
  const float = parseFloat(wear);
  if (isNaN(float)) return wear;
  return float.toFixed(6);
};

export const ListingBadge: React.FC<Props> = ({ wear, pattern, isMatched }) => {
  // Neutral styling
  const neutralStyle = "bg-black/30 text-white/90 border-white/20 hover:bg-black/50 hover:text-white h-6";

  // Highlighting the pattern in red if matched
  const patternStyle = isMatched
    ? "bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.3)] h-6"
    : neutralStyle;

  return (
    <div className="arcana-badge-container flex flex-wrap items-center gap-2 mt-2 select-none pointer-events-none font-sans">
      {wear && (
        <div className={`px-2 flex items-center rounded border backdrop-blur-md transition-all duration-300 text-[11px] font-bold tracking-tight shadow-lg ${neutralStyle}`}>
          <span className="opacity-50 mr-1.5 text-[10px] uppercase font-black">FLOAT</span>
          {formatFloat(wear)}
        </div>
      )}
      {pattern && (
        <div className={`px-2 flex items-center rounded border backdrop-blur-md transition-all duration-300 text-[11px] font-bold tracking-tight shadow-lg ${patternStyle}`}>
          <span className={`mr-1.5 text-[10px] uppercase font-black ${isMatched ? 'text-red-400/60' : 'opacity-50'}`}>PATTERN</span>
          {pattern}
        </div>
      )}
    </div>
  );
};
