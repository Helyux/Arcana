import React, { useEffect, useState } from 'react';

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
}

export const PatternFilter: React.FC<Props> = ({ itemId, defaultPatterns, defaultGroups, hasRemoteDefaults }) => {
  const [patterns, setPatterns] = useState<string>('');
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [userEdited, setUserEdited] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ active: boolean, current: number, total: number }>({ active: false, current: 0, total: 0 });

  // The effective patterns: user's input takes priority, otherwise remote defaults
  const effectivePatterns = userEdited ? patterns : (defaultPatterns || patterns);

  useEffect(() => {
    chrome.storage.local.get(['arcana_filters', 'arcana_filter_active', 'arcana_user_edited'], (result) => {
      const filters = (result.arcana_filters as Record<string, string>) || {};
      const activeStates = (result.arcana_filter_active as Record<string, boolean>) || {};
      const editedStates = (result.arcana_user_edited as Record<string, boolean>) || {};

      if (filters[itemId]) {
        setPatterns(filters[itemId]);
      }
      if (activeStates[itemId]) {
        setIsFilterActive(activeStates[itemId]);
      }
      if (editedStates[itemId]) {
        setUserEdited(true);
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
    window.addEventListener('ArcanaScanProgress', onProgress);
    return () => window.removeEventListener('ArcanaScanProgress', onProgress);
  }, [itemId]);

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

  const showingDefaults = hasRemoteDefaults && !userEdited;

  return (
    <div className="arcana-filter-container bg-black/60 border-2 border-purple-500/20 rounded-xl p-4 my-6 backdrop-blur-2xl flex flex-col gap-3 shadow-2xl transition-all duration-500 hover:border-purple-500/40">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[11px] uppercase tracking-[0.2em] font-black text-purple-400">ARCANA FILTER</span>
        </div>
        {showingDefaults && (
          <span className="text-[10px] text-purple-400/60 font-medium flex items-center gap-1">
            <span>🔮</span>
            <span>cs2pattern defaults</span>
          </span>
        )}
      </div>

      {/* Group pills when showing defaults */}
      {showingDefaults && defaultGroups && defaultGroups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {defaultGroups.map((group) => (
            <span key={group.name} className="arcana-group-pill text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1" style={{ opacity: 0.8 }}>
              <span>{group.icon}</span>
              <span>{group.name.replace(/_/g, ' ')}</span>
              <span className="opacity-50 ml-0.5">({group.patterns.length})</span>
            </span>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={userEdited ? patterns : ''}
            onChange={handleChange}
            placeholder={showingDefaults ? effectivePatterns : 'Enter patterns (e.g. 589, 12, 999)...'}
            className={`w-full bg-white/5 border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all shadow-inner ${showingDefaults ? 'border-purple-500/20 placeholder:text-purple-300/30' : 'border-white/10 placeholder:text-white/20'
              }`}
          />
        </div>
        {userEdited && hasRemoteDefaults && (
          <button
            onClick={handleReset}
            className="px-2 py-2 rounded-lg text-white/40 hover:text-purple-400 hover:bg-white/5 transition-all text-xs font-bold"
            title="Reset to cs2pattern defaults"
          >
            ✕
          </button>
        )}
        <div className="flex gap-2">
          <button
            onClick={toggleFilter}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 ${isFilterActive
                ? 'bg-purple-500/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80'
              }`}
          >
            {isFilterActive ? 'Filtering' : 'Filter'}
          </button>

          <button
            onClick={toggleDeepScan}
            className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 whitespace-nowrap ${scanProgress.active
                ? 'bg-blue-500/90 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] border border-blue-400'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80'
              }`}
          >
            {scanProgress.active
              ? `STOP (${scanProgress.current}/${scanProgress.total || '?'})`
              : 'DEEP SCAN'}
          </button>
        </div>
      </div>
    </div>
  );
};
