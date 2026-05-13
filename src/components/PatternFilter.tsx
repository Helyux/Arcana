import React, { useEffect, useState, useRef } from 'react';
import { ListingBadge } from './ListingBadge';
import { getGithubLink } from '../services/patternDb';

interface PatternGroupInfo {
  name: string;
  icon: string;
  patterns: number[];
}

interface Props {
  itemId: string;
  defaultPatterns?: string;
  defaultGroups?: PatternGroupInfo[];
  hasRemoteDefaults?: boolean;
  skinName?: string;
  weaponName?: string;
}

type SortState = 'none' | 'asc' | 'desc';

interface TickerEntry {
  listingId: string;
  wear: string;
  pattern: string;
  price: string;
  rank: number | null;
  matchInfo?: { name: string; icon: string } | null;
  addedAt: number;
  appId: string;
  contextId: string;
  assetId: string;
}

const nextSortState = (current: SortState): SortState => {
  if (current === 'none') return 'asc';
  if (current === 'asc') return 'desc';
  return 'none';
};

const sortLabel = (base: string, state: SortState): string => {
  if (state === 'asc') return `${base} ↑`;
  if (state === 'desc') return `${base} ↓`;
  return base;
};

export const PatternFilter: React.FC<Props> = ({ itemId, defaultPatterns, defaultGroups, hasRemoteDefaults, skinName, weaponName }) => {
  const [patterns, setPatterns] = useState<string>('');
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [userEdited, setUserEdited] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ active: boolean, current: number, total: number }>({ active: false, current: 0, total: 0 });
  const [rankingModalOpen, setRankingModalOpen] = useState<boolean>(false);
  const [rankingInput, setRankingInput] = useState<string>('');
  const [hasRanking, setHasRanking] = useState<boolean>(false);
  const [floatSort, setFloatSort] = useState<SortState>('none');
  const [rankSort, setRankSort] = useState<SortState>('none');
  const [rankingError, setRankingError] = useState<string>('');
  const [livetickerActive, setLivetickerActive] = useState<boolean>(false);
  const [tickerEntries, setTickerEntries] = useState<TickerEntry[]>([]);
  const [githubLink, setGithubLink] = useState<string>('https://github.com/Helyux/cs2pattern/blob/master/cs2pattern/pattern.json');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The effective patterns: user's input takes priority, otherwise remote defaults
  const effectivePatterns = userEdited ? patterns : (defaultPatterns || patterns);

  useEffect(() => {
    chrome.storage.local.get(['arcana_filters', 'arcana_filter_active', 'arcana_user_edited', 'arcana_rankings'], (result) => {
      const filters = (result.arcana_filters as Record<string, string>) || {};
      const activeStates = (result.arcana_filter_active as Record<string, boolean>) || {};
      const editedStates = (result.arcana_user_edited as Record<string, boolean>) || {};
      const rankings = (result.arcana_rankings as Record<string, string>) || {};

      if (filters[itemId]) {
        setPatterns(filters[itemId]);
      }
      if (activeStates[itemId]) {
        setIsFilterActive(activeStates[itemId]);
      }
      if (editedStates[itemId]) {
        setUserEdited(true);
      }
      if (rankings[itemId]) {
        setHasRanking(true);
        setRankingInput(rankings[itemId]);
      }
    });

    const onProgress = (e: Event) => {
      const customEvent = e as CustomEvent;
      setScanProgress({
        active: customEvent.detail.active,
        current: customEvent.detail.current,
        total: customEvent.detail.total
      });
    };

    const onNewTickerListings = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newListings = customEvent.detail;
      setTickerEntries(prev => {
        const newer = [...prev];
        for (const id in newListings) {
          if (!newer.find(te => te.listingId === id)) {
            newer.unshift(newListings[id]); // Newest at top
          }
        }
        return newer.slice(0, 50); // Keep max 50
      });
    };

    window.addEventListener('ArcanaScanProgress', onProgress);
    window.addEventListener('ArcanaTickerNewListings', onNewTickerListings);
    
    return () => {
      window.removeEventListener('ArcanaScanProgress', onProgress);
      window.removeEventListener('ArcanaTickerNewListings', onNewTickerListings);
    };
  }, [itemId]);

  // Clean up old entries periodically
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const expiryTime = 15 * 60 * 1000; // 15 minutes
      setTickerEntries(prev => prev.filter(te => (now - te.addedAt) < expiryTime));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Update GitHub link when item changes
  useEffect(() => {
    if (skinName && weaponName) {
      getGithubLink(skinName, weaponName).then(setGithubLink);
    }
  }, [skinName, weaponName]);

  // Dispatch pattern changes to the content script
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ArcanaPatternUpdate', {
      detail: { patterns: effectivePatterns, userEdited }
    }));
  }, [effectivePatterns, userEdited]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPatterns(val);
    setUserEdited(true);

    chrome.storage.local.get(['arcana_filters', 'arcana_user_edited'], (result) => {
      const filters = (result.arcana_filters as Record<string, string>) || {};
      const editedStates = (result.arcana_user_edited as Record<string, boolean>) || {};
      filters[itemId] = val;
      editedStates[itemId] = true;
      chrome.storage.local.set({ arcana_filters: filters, arcana_user_edited: editedStates });
    });
  };

  const handleReset = () => {
    setPatterns('');
    setUserEdited(false);

    chrome.storage.local.get(['arcana_filters', 'arcana_user_edited'], (result) => {
      const filters = (result.arcana_filters as Record<string, string>) || {};
      const editedStates = (result.arcana_user_edited as Record<string, boolean>) || {};
      delete filters[itemId];
      delete editedStates[itemId];
      chrome.storage.local.set({ arcana_filters: filters, arcana_user_edited: editedStates });
    });
  };

  const toggleFilter = () => {
    const newVal = !isFilterActive;
    setIsFilterActive(newVal);
    chrome.storage.local.get(['arcana_filter_active'], (result) => {
      const activeStates = (result.arcana_filter_active as Record<string, boolean>) || {};
      activeStates[itemId] = newVal;
      chrome.storage.local.set({ arcana_filter_active: activeStates });
    });
  };

  const toggleDeepScan = () => {
    if (scanProgress.active) {
      window.dispatchEvent(new CustomEvent('ArcanaStopDeepScan'));
      setScanProgress({ ...scanProgress, active: false });
    } else {
      window.dispatchEvent(new CustomEvent('ArcanaStartDeepScan'));
      setScanProgress({ active: true, current: 0, total: 0 });
      if (!isFilterActive) {
        setIsFilterActive(true);
        chrome.storage.local.get(['arcana_filter_active'], (result) => {
          const activeStates = (result.arcana_filter_active as Record<string, boolean>) || {};
          activeStates[itemId] = true;
          chrome.storage.local.set({ arcana_filter_active: activeStates });
        });
      }
    }
  };

  const handleGroupClick = (group: PatternGroupInfo) => {
    const groupPatterns = group.patterns.join(', ');
    const isSelected = userEdited && patterns === groupPatterns;

    if (isSelected) {
      handleReset();
      return;
    }

    setPatterns(groupPatterns);
    setUserEdited(true);

    chrome.storage.local.get(['arcana_filters', 'arcana_user_edited'], (result) => {
      const filters = (result.arcana_filters as Record<string, string>) || {};
      const editedStates = (result.arcana_user_edited as Record<string, boolean>) || {};
      filters[itemId] = groupPatterns;
      editedStates[itemId] = true;
      chrome.storage.local.set({ arcana_filters: filters, arcana_user_edited: editedStates });
    });
  };

  const handleSortFloat = () => {
    const next = nextSortState(floatSort);
    setFloatSort(next);
    // Reset rank sort when float sort changes
    if (next !== 'none') setRankSort('none');
    window.dispatchEvent(new CustomEvent('ArcanaOrderByFloat', { detail: { direction: next } }));
  };

  const handleSortRank = () => {
    if (!hasRanking) return;
    const next = nextSortState(rankSort);
    setRankSort(next);
    // Reset float sort when rank sort changes
    if (next !== 'none') setFloatSort('none');
    window.dispatchEvent(new CustomEvent('ArcanaOrderByRank', { detail: { direction: next } }));
  };

  const openRankingModal = () => {
    setRankingModalOpen(true);
    // Load existing ranking for this item
    chrome.storage.local.get(['arcana_rankings'], (result) => {
      const rankings = (result.arcana_rankings as Record<string, string>) || {};
      if (rankings[itemId]) {
        setRankingInput(rankings[itemId]);
      }
    });
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleRankingSave = () => {
    const trimmed = rankingInput.trim();
    if (trimmed) {
      const lines = trimmed.split('\n').filter(l => l.trim());
      if (lines.length !== 1000) {
        setRankingError(`Ranking must have exactly 1000 entries (currently ${lines.length})`);
        return;
      }
    }
    setRankingError('');
    chrome.storage.local.get(['arcana_rankings'], (result) => {
      const rankings = (result.arcana_rankings as Record<string, string>) || {};
      if (trimmed) {
        rankings[itemId] = trimmed;
        setHasRanking(true);
      } else {
        delete rankings[itemId];
        setHasRanking(false);
      }
      chrome.storage.local.set({ arcana_rankings: rankings });
    });
    setRankingModalOpen(false);
    // Notify content script to re-render with rankings
    window.dispatchEvent(new CustomEvent('ArcanaRankingUpdate', {
      detail: { ranking: trimmed }
    }));
  };

  const handleRankingClear = () => {
    setRankingInput('');
    setHasRanking(false);
    setRankSort('none');
    chrome.storage.local.get(['arcana_rankings'], (result) => {
      const rankings = (result.arcana_rankings as Record<string, string>) || {};
      delete rankings[itemId];
      chrome.storage.local.set({ arcana_rankings: rankings });
    });
    setRankingModalOpen(false);
    window.dispatchEvent(new CustomEvent('ArcanaRankingUpdate', {
      detail: { ranking: '' }
    }));
  };

  const toggleLiveticker = () => {
    const newState = !livetickerActive;
    setLivetickerActive(newState);
    if (newState) {
      chrome.storage.local.get(['arcana_polling_interval'], (res) => {
        const interval = res.arcana_polling_interval || 15;
        window.dispatchEvent(new CustomEvent('ArcanaStartLiveticker', {
          detail: { interval }
        }));
      });
    } else {
      window.dispatchEvent(new CustomEvent('ArcanaStopLiveticker'));
    }
  };

  const removeTickerEntry = (id: string) => {
    setTickerEntries(prev => prev.filter(te => te.listingId !== id));
  };

  const handleBuyNow = (entry: TickerEntry) => {
    window.dispatchEvent(new CustomEvent('ArcanaBuyListing', {
      detail: {
        listingId: entry.listingId,
        appId: entry.appId,
        contextId: entry.contextId,
        assetId: entry.assetId
      }
    }));
  };

  const formatTimeAgo = (ts: number) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 10) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ago`;
  };

  const isFullDefault = patterns === defaultPatterns;
  const isGroupDefault = defaultGroups?.some(g => patterns === g.patterns.join(', '));
  const showingDefaults = hasRemoteDefaults && (!userEdited || isFullDefault || isGroupDefault);

  // Button style helpers
  const btnInactive = 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80';
  const btnActive = (color: string) => {
    if (color === 'purple') return 'bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/40';
    return 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80';
  };
  const btnDisabled = 'bg-white/[0.02] text-white/20 border border-white/[0.05] cursor-not-allowed';

  // Inline styles for the modal overlay
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
  };

  const modalStyle: React.CSSProperties = {
    background: '#1a1a2e',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: '12px',
    padding: '20px',
    width: '320px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    boxShadow: '0 0 40px rgba(168,85,247,0.2)',
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#c084fc',
    margin: 0,
  };

  const modalDescStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: '1.4',
    margin: 0,
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '300px',
    maxHeight: '50vh',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(168,85,247,0.2)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    fontFamily: 'monospace',
    color: 'white',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    lineHeight: '1.5',
  };

  const modalBtnStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    cursor: 'pointer',
    border: '1px solid rgba(168,85,247,0.3)',
    background: 'rgba(168,85,247,0.15)',
    color: '#c084fc',
    transition: 'all 0.2s',
  };

  const lineCount = rankingInput.trim() ? rankingInput.trim().split('\n').length : 0;

  return (
    <>
      <div className="arcana-filter-container bg-black/60 border-2 border-purple-500/20 rounded-xl p-4 my-6 backdrop-blur-2xl flex flex-col gap-3 shadow-2xl transition-all duration-500 hover:border-purple-500/40">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[11px] uppercase tracking-[0.2em] font-black text-purple-400">ARCANA FILTER</span>
          </div>
          {showingDefaults && (
            <a 
              href={githubLink} 
              target="_blank" 
              rel="noopener" 
              className="text-[10px] text-purple-300 bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 no-underline hover:bg-purple-500/30 hover:border-purple-500/60 transition-all shadow-[0_0_10px_rgba(168,85,247,0.1)]"
            >
              <span>🔮</span>
              <span>cs2pattern defaults</span>
            </a>
          )}
        </div>

        {/* Group pills - now handles quick-select */}
        {defaultGroups && defaultGroups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {defaultGroups.map((group) => {
              const isSelected = userEdited && patterns === group.patterns.join(', ');
              return (
                <button
                  key={group.name}
                  onClick={() => handleGroupClick(group)}
                  title={isSelected ? "Click to reset to all patterns" : `Quick-select ${group.name.replace(/_/g, ' ')} patterns`}
                  className={`arcana-group-pill text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all cursor-pointer hover:bg-white/5 active:translate-y-0.5 ${isSelected ? 'bg-purple-500/20 border-purple-500/60 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'opacity-80 border-purple-500/20'
                    }`}
                  style={{ all: 'unset', padding: '2px 8px', border: '1px solid currentColor', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                >
                  <span>{group.icon}</span>
                  <span>{group.name.replace(/_/g, ' ')}</span>
                  <span className="opacity-50 ml-0.5">({group.patterns.length})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Input row - using strict inline styles to bypass any Steam CSS conflicts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '12px', alignItems: 'center', width: '100%' }}>
          <div style={{ position: 'relative', minWidth: 0 }}>
            <input
              type="text"
              value={userEdited ? patterns : ''}
              onChange={handleChange}
              placeholder={showingDefaults ? effectivePatterns : 'Enter patterns (e.g. 589, 12, 999)...'}
              style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', color: 'white', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={toggleFilter}
              className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 ${isFilterActive
                  ? 'bg-purple-500/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400'
                  : btnInactive
                }`}
            >
              {isFilterActive ? 'Filtering' : 'Filter'}
            </button>

            <button
              onClick={toggleDeepScan}
              className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 whitespace-nowrap ${scanProgress.active
                  ? 'bg-blue-500/90 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] border border-blue-400'
                  : btnInactive
                }`}
            >
              {scanProgress.active
                ? `STOP (${scanProgress.current}/${scanProgress.total || '?'})`
                : 'DEEP SCAN'}
            </button>
          </div>
        </div>

        {/* Tools row - sort and ranking buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleSortFloat}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 whitespace-nowrap ${floatSort !== 'none' ? btnActive('purple') : btnInactive}`}
            title="Sort listings by float value. Click to cycle: ascending → descending → off"
          >
            {sortLabel('SORT FLOAT', floatSort)}
          </button>

          <button
            onClick={handleSortRank}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 whitespace-nowrap ${!hasRanking ? btnDisabled : rankSort !== 'none' ? btnActive('purple') : btnInactive}`}
            title={hasRanking ? "Sort listings by rank. Click to cycle: ascending → descending → off" : "Set a ranking first to enable rank sorting"}
            disabled={!hasRanking}
          >
            {sortLabel('SORT RANK', rankSort)}
          </button>

          <button
            onClick={openRankingModal}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 whitespace-nowrap ${hasRanking
                ? 'bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)] border border-purple-500/40'
                : btnInactive
              }`}
            title="Input a ranking list for patterns"
          >
            {hasRanking ? 'RANKING ✓' : 'RANKING'}
          </button>

          <button
            onClick={toggleLiveticker}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 whitespace-nowrap ${livetickerActive
                ? 'bg-green-500/20 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.2)] border border-green-500/40'
                : btnInactive
              }`}
            title="Toggle background liveticker for new listings"
          >
            {livetickerActive ? 'LIVETICKER ●' : 'LIVETICKER'}
          </button>
        </div>

        {/* Liveticker Panel */}
        {tickerEntries.length > 0 && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '11px', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 900 }}>🔊 Live Ticker</h3>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>{tickerEntries.length} Items</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tickerEntries.map(entry => (
                <div key={entry.listingId} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(168,85,247,0.1)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  backdropFilter: 'blur(10px)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#4ade80' }}>{entry.price}</span>
                      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>Disc. {formatTimeAgo(entry.addedAt)}</span>
                    </div>
                    <button
                      onClick={() => removeTickerEntry(entry.listingId)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}
                    >×</button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <ListingBadge wear={entry.wear} pattern={entry.pattern} isMatched={!!entry.matchInfo} matchInfo={entry.matchInfo} rank={entry.rank} />
                    <button
                      onClick={() => handleBuyNow(entry)}
                      style={{ 
                        background: 'linear-gradient(to bottom, #75b022 5%, #588a1b 95%)',
                        border: 'none',
                        color: '#d2ef8c',
                        padding: '6px 14px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        flexShrink: 0
                      }}
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Ranking Modal */}
      {rankingModalOpen && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setRankingModalOpen(false); }}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <p style={modalTitleStyle}>📊 Input Ranking</p>
            <p style={modalDescStyle}>
              Enter one pattern per line (exactly 1000 required). Line number = rank.
              {lineCount > 0 && <span style={{ color: lineCount === 1000 ? '#4ade80' : '#f87171', fontWeight: 700 }}> ({lineCount}/1000)</span>}
            </p>
            <textarea
              ref={textareaRef}
              value={rankingInput}
              onChange={(e) => { setRankingInput(e.target.value); setRankingError(''); }}
              placeholder={'985\n390\n650\n382\n153\n...'}
              style={textareaStyle}
            />
            {rankingError && (
              <p style={{ fontSize: '11px', color: '#f87171', margin: 0, fontWeight: 600 }}>{rankingError}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleRankingClear}
                style={{ ...modalBtnStyle, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
              >
                Clear
              </button>
              <button
                onClick={() => setRankingModalOpen(false)}
                style={{ ...modalBtnStyle, background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRankingSave}
                style={{ ...modalBtnStyle, background: 'rgba(168,85,247,0.3)', borderColor: 'rgba(168,85,247,0.5)' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
