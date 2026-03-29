import React, { useEffect, useState } from 'react';

interface Props {
  itemId: string;
}

export const PatternFilter: React.FC<Props> = ({ itemId }) => {
  const [patterns, setPatterns] = useState<string>('');
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<{ active: boolean, current: number, total: number }>({ active: false, current: 0, total: 0 });

  useEffect(() => {
    chrome.storage.local.get(['arcana_filters', 'arcana_filter_active'], (result) => {
      const filters = (result.arcana_filters as Record<string, string>) || {};
      if (filters[itemId]) setPatterns(filters[itemId]);

      const activeStates = (result.arcana_filter_active as Record<string, boolean>) || {};
      if (activeStates[itemId]) setIsFilterActive(activeStates[itemId]);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPatterns(val);
    
    chrome.storage.local.get(['arcana_filters'], (result) => {
      const filters = (result.arcana_filters as Record<string, string>) || {};
      filters[itemId] = val;
      chrome.storage.local.set({ arcana_filters: filters });
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
      // Automatically engage the filter to hide non-matches from view
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

  return (
    <div className="arcana-filter-container bg-black/60 border-2 border-purple-500/20 rounded-xl p-4 my-6 backdrop-blur-2xl flex items-center gap-6 shadow-2xl transition-all duration-500 hover:border-purple-500/40">
      <div className="flex flex-col gap-1 min-w-[160px]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[11px] uppercase tracking-[0.2em] font-black text-purple-400">ARCANA FILTER</span>
        </div>
        <span className="text-[10px] text-white/40 font-medium">Highlight matching patterns</span>
      </div>
      <input
        type="text"
        value={patterns}
        onChange={handleChange}
        placeholder="Enter patterns (e.g. 589, 12, 999)..."
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all shadow-inner"
      />
      <div className="flex gap-2">
        <button 
          onClick={toggleFilter}
          className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 ${
            isFilterActive 
              ? 'bg-purple-500/90 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-400' 
              : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80'
          }`}
        >
          {isFilterActive ? 'Filtering' : 'Filter'}
        </button>

        <button 
          onClick={toggleDeepScan}
          className={`px-4 py-2 rounded-lg font-bold tracking-wider text-[11px] uppercase transition-all duration-300 whitespace-nowrap ${
            scanProgress.active 
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
  );
};
