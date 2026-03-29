// This script runs in the MAIN world to access Steam's internal variables
(function() {
  interface SteamAsset {
    descriptions?: Array<{ value: string; color?: string }>;
    asset_properties?: Array<{
      propertyid?: number;
      id?: number;
      int_value?: number;
      float_value?: number;
    }>;
  }

  interface SteamListing {
    asset?: {
      id: string;
      appid: number;
      contextid: string;
    };
  }

  let lastListingKeys = "";
  let hasForced100 = false;
  let isDeepScanning = false;
  let stopDeepScanRequested = false;

  window.addEventListener('ArcanaStartDeepScan', () => {
    if (isDeepScanning) return;
    stopDeepScanRequested = false;
    startDeepScan();
  });

  window.addEventListener('ArcanaStopDeepScan', () => {
    stopDeepScanRequested = true;
  });

  async function startDeepScan() {
    isDeepScanning = true;
    console.log("[Arcana] Starting Deep Scan...");
    
    // @ts-expect-error: Steam internal variable
    let start = window.g_oSearchResults?.m_iStart || 0;
    // @ts-expect-error: Steam internal variable
    const totalCount = window.g_oSearchResults?.m_cTotalCount || 0;
    start += 100;

    // @ts-expect-error: Steam internal variable
    const query = window.g_oSearchResults?.m_strQuery || '';
    // @ts-expect-error: Steam internal variable
    const currency = typeof window.g_rgWalletInfo !== 'undefined' ? window.g_rgWalletInfo.wallet_currency : 1;
    // @ts-expect-error: Steam internal variable
    const country = typeof window.g_strCountryCode !== 'undefined' ? window.g_strCountryCode : 'US';
    // @ts-expect-error: Steam internal variable
    const language = typeof window.g_strLanguage !== 'undefined' ? window.g_strLanguage : 'english';
    
    while (start < totalCount) {
      if (stopDeepScanRequested) break;

      window.dispatchEvent(new CustomEvent('ArcanaScanProgress', {
        detail: { active: true, current: start, total: totalCount }
      }));

      try {
        const url = `${window.location.pathname}/render/?query=${encodeURIComponent(query)}&start=${start}&count=100&country=${country}&language=${language}&currency=${currency}`;
        
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 429) console.warn("[Arcana] Hit rate limit! Pausing scan.");
          break;
        }
        const json = await res.json();
        
        if (json && json.success) {
          // @ts-expect-error: Steam internal variable
          if (json.assets && window.g_rgAssets) {
            for (const appid in json.assets) {
              // @ts-expect-error: Steam internal variable
              if (!window.g_rgAssets[appid]) window.g_rgAssets[appid] = {};
              for (const contextid in json.assets[appid]) {
                // @ts-expect-error: Steam internal variable
                if (!window.g_rgAssets[appid][contextid]) window.g_rgAssets[appid][contextid] = {};
                // @ts-expect-error: Steam internal variable
                Object.assign(window.g_rgAssets[appid][contextid], json.assets[appid][contextid]);
              }
            }
          }
          
          // @ts-expect-error: Steam internal variable
          if (json.listinginfo && window.g_rgListingInfo) {
            // @ts-expect-error: Steam internal variable
            Object.assign(window.g_rgListingInfo, json.listinginfo);
          }

          const chunkData = parseMarketData(json.listinginfo, json.assets);
          window.dispatchEvent(new CustomEvent('SteamMarketDeepScanChunk', {
            detail: {
              results_html: json.results_html,
              chunkData: chunkData
            }
          }));
          
          extractData();
        }
      } catch (e) {
        console.error("[Arcana] Deep scan fetch error:", e);
      }

      start += 100;
      await new Promise(r => setTimeout(r, 1000));
    }

    isDeepScanning = false;
    window.dispatchEvent(new CustomEvent('ArcanaScanProgress', {
      detail: { active: false, current: 0, total: totalCount }
    }));
    console.log("[Arcana] Deep Scan Finished.");
  }

  function force100Listings() {
    if (hasForced100) return;
    
    // @ts-expect-error: Steam internal variable
    const searchResults = window.g_oSearchResults;
    if (searchResults && searchResults.m_cPageSize < 100) {
      console.log("[Arcana] Forcing 100 listings...");
      searchResults.m_cPageSize = 100;
      searchResults.GoToPage(0, true);
      hasForced100 = true;
    } else if (searchResults && searchResults.m_cPageSize >= 100) {
      hasForced100 = true; // Already 100 or more
    }
  }

  function parseMarketData(listingInfo: Record<string, SteamListing>, assets: Record<string, Record<string, Record<string, SteamAsset>>>) {
    const marketData: Record<string, { wear: string; pattern: string }> = {};

    for (const listingId in listingInfo) {
      const info = listingInfo[listingId];
      if (!info?.asset) continue;

      const { id: assetId, appid, contextid } = info.asset;
      const asset = assets?.[appid]?.[contextid]?.[assetId];
      if (!asset) continue;

      let wear = "";
      let pattern = "";

      // 1. Try asset_properties (More reliable/Universal)
      if (asset.asset_properties) {
        for (const prop of asset.asset_properties) {
          if (prop.propertyid === 1 || prop.id === 1) { // Pattern
            pattern = prop.int_value?.toString() || "";
          } else if (prop.propertyid === 2 || prop.id === 2) { // Wear
            wear = prop.float_value?.toString() || "";
          }
        }
      }

      // 2. Fallback to descriptions (Language dependent)
      if (!wear || !pattern) {
        const descriptions = asset.descriptions || [];
        for (const desc of descriptions) {
          const val = desc.value || "";
          if (val.includes("Wear Rating:") || val.includes("Abnutzungsgrad:")) {
            wear = val.split(":")[1]?.trim() || "";
          } else if (val.includes("Pattern Template:") || val.includes("Mustervorlage:")) {
            pattern = val.split(":")[1]?.trim() || "";
          }
        }
      }

      if (wear || pattern) {
        marketData[listingId] = { wear, pattern };
      }
    }
    return marketData;
  }

  function extractData() {
    try {
      // Also check for 100 listings here
      force100Listings();

      // @ts-expect-error: Steam internal variable
      const assets = window.g_rgAssets;
      // @ts-expect-error: Steam internal variable
      const listingInfo = window.g_rgListingInfo;

      if (!assets || !listingInfo) return;

      const keys = Object.keys(listingInfo);
      if (keys.length === 0) return;
      
      const currentKeys = keys.join(',');
      // Only dispatch if something changed
      if (currentKeys === lastListingKeys) return;
      lastListingKeys = currentKeys;

      const marketData = parseMarketData(listingInfo, assets);

      // Dispatch to the isolated world
      window.dispatchEvent(new CustomEvent('SteamMarketDataLoaded', {
        detail: marketData
      }));
    } catch {
      // Silent fail to avoid breaking Steam
    }
  }

  // Poll instead of patching XHR to avoid Prototype.js conflicts
  setInterval(extractData, 1000);
  extractData();
})();
