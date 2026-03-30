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

  let livetickerInterval: number | null = null;
  let livetickerActive = false;
  let livetickerSeconds = 15;
  const seenListingIds = new Set<string>();
  const tickerMetadataCache = new Map<string, { info: any, asset: any }>();

  window.addEventListener('ArcanaStartDeepScan', () => {
    console.log("[Arcana] StartDeepScan event received");
    if (isDeepScanning) return;
    stopDeepScanRequested = false;
    startDeepScan();
  });

  window.addEventListener('ArcanaStopDeepScan', () => {
    console.log("[Arcana] StopDeepScan event received");
    stopDeepScanRequested = true;
  });

  window.addEventListener('ArcanaStartLiveticker', (e: any) => {
    console.log("[Arcana] StartLiveticker event received");
    livetickerSeconds = e.detail?.interval || 15;
    livetickerActive = true;
    
    // Prevent overlapping loops: clear any existing timer before starting
    if (livetickerInterval) {
      clearTimeout(livetickerInterval);
      livetickerInterval = null;
    }
    startLivetickerLoop();
  });

  window.addEventListener('ArcanaStopLiveticker', () => {
    console.log("[Arcana] StopLiveticker event received");
    livetickerActive = false;
    if (livetickerInterval) {
      clearTimeout(livetickerInterval);
      livetickerInterval = null;
    }
  });

  window.addEventListener('ArcanaUpdatePollingInterval', (e: any) => {
    livetickerSeconds = e.detail?.interval || 15;
  });

  window.addEventListener('ArcanaBuyListing', (e: any) => {
    const { listingId, appId, contextId, assetId } = e.detail;
    console.log("[Arcana] BuyMarketListing request:", { listingId, appId, contextId, assetId });
    
    // Inject metadata into Steam globals
    const meta = tickerMetadataCache.get(listingId);
    if (meta) {
      console.log("[Arcana] Patching Steam globals with ticker metadata...");
      // @ts-expect-error: Steam internal global
      if (!window.g_rgAssets) window.g_rgAssets = {};
      // @ts-expect-error: Steam internal global
      if (!window.g_rgAssets[appId]) window.g_rgAssets[appId] = {};
      // @ts-expect-error: Steam internal global
      if (!window.g_rgAssets[appId][contextId]) window.g_rgAssets[appId][contextId] = {};
      // @ts-expect-error: Steam internal global
      window.g_rgAssets[appId][contextId][assetId] = meta.asset;
      // @ts-expect-error: Steam internal global
      if (!window.g_rgListingInfo) window.g_rgListingInfo = {};
      // @ts-expect-error: Steam internal global
      window.g_rgListingInfo[listingId] = meta.info;
    } else {
      console.warn("[Arcana] Metadata not found in cache for listing:", listingId);
    }

    try {
      // DOM Proxy: Steam's BuyMarketListing expects a full table structure to clone.
      const elementId = `listing_${listingId}`;
      if (!document.getElementById(elementId)) {
        console.log("[Arcana] Creating ultra-fidelity DOM proxy for ticker item:", listingId);
        const proxy = document.createElement('div');
        proxy.style.display = 'none';
        proxy.className = 'market_listing_table_header'; // Grandmother node (up(1))
        proxy.innerHTML = `
          <div class="market_listing_table"> <!-- Mother node (up()) -->
            <div class="market_listing_header_row"></div> <!-- Sibling node (up().down()) -->
            <div id="${elementId}" class="market_listing_row">
              <div class="market_listing_item_img"></div> <!-- Needed for cloning -->
              <div class="market_listing_item_name"></div> <!-- Needed for cloning -->
              <div class="market_actionmenu_button"></div> <!-- Needed for cloning -->
            </div>
          </div>
        `;
        document.body.appendChild(proxy);
      }

      // @ts-expect-error: Steam internal function
      if (typeof window.BuyMarketListing !== 'undefined') {
        console.log("[Arcana] Invoking Steam BuyMarketListing...");
        // @ts-expect-error: Steam internal function
        window.BuyMarketListing('listing', listingId, appId, contextId, assetId);
      } else {
        throw new Error("BuyMarketListing not found");
      }
    } catch (err) {
      console.warn("[Arcana] BuyNow failed, using direct BuyItemDialog.Show fallback...", err);
      // @ts-expect-error: Steam internal object
      if (typeof window.BuyItemDialog !== 'undefined' && window.BuyItemDialog.Show) {
        // @ts-expect-error: Steam internal function
        window.BuyItemDialog.Show(listingId, appId, contextId, assetId);
      }
    }
  });

  async function startLivetickerLoop() {
    if (!livetickerActive) return;

    try {
      await pollMarketData();
    } catch (e) {
      console.error("[Arcana] Liveticker poll error:", e);
    }

    if (livetickerActive) {
      livetickerInterval = window.setTimeout(startLivetickerLoop, livetickerSeconds * 1000);
    }
  }

  async function pollMarketData() {
    // @ts-expect-error: Steam internal variable
    const query = window.g_oSearchResults?.m_strQuery || '';
    // @ts-expect-error: Steam internal variable
    const currency = typeof window.g_oSearchResults !== 'undefined' && window.g_oSearchResults.m_iCurrency ? window.g_oSearchResults.m_iCurrency : (typeof window.g_rgWalletInfo !== 'undefined' ? window.g_rgWalletInfo.wallet_currency : 1);
    
    // Detect the display symbol from the page's search results first, then fallback to wallet or $
    // @ts-expect-error: Steam internal variable
    const displaySymbol = (typeof window.g_oSearchResults !== 'undefined' && window.g_oSearchResults.m_strSymbol) ? window.g_oSearchResults.m_strSymbol : (typeof window.g_rgWalletInfo !== 'undefined' && window.g_rgWalletInfo.wallet_symbol ? window.g_rgWalletInfo.wallet_symbol : '$');

    console.log(`[Arcana] Polling config: currency=${currency}, displaySymbol=${displaySymbol}`);

    // @ts-expect-error: Steam internal variable
    const country = typeof window.g_strCountryCode !== 'undefined' ? window.g_strCountryCode : 'US';
    // @ts-expect-error: Steam internal variable
    const language = typeof window.g_strLanguage !== 'undefined' ? window.g_strLanguage : 'english';

    // norender=1 ensures we get clean raw JSON with reliable currency data (id 3 for EUR)
    // For specific item pages, sort_column=default & sort_dir=desc is the standard for "Date Listed (Newest First)"
    const url = `${window.location.pathname}/render/?norender=1&currency=${currency}&query=${encodeURIComponent(query)}&start=0&count=10&country=${country}&language=${language}&sort_column=default&sort_dir=desc`;
    
    console.log("[Arcana] Polling Market Data URL:", url);
    const res = await fetch(url);
    if (!res.ok) {
      console.error("[Arcana] Poll failed with status:", res.status);
      return;
    }
    const json = await res.json();
    console.log("[Arcana] Poll Response - Success:", json && json.success, "Listings:", json && json.listinginfo ? Object.keys(json.listinginfo).length : 0);

    if (json && json.success && json.listinginfo) {
      const newListings: any = {};
      const newItemsRaw = parseMarketData(json.listinginfo, json.assets);
      
      let discoveredCount = 0;

      for (const listingId in json.listinginfo) {
        if (!seenListingIds.has(listingId) && newItemsRaw[listingId]) {
          const info = json.listinginfo[listingId];
          const appId = info.asset?.appid;
          const contextId = info.asset?.contextid;
          const assetId = info.asset?.id;
          
          // Format price
          const price = info.converted_price || info.price || 0;
          const fee = info.converted_fee || info.fee || 0;
          const total = (price + fee) / 100;
          const cid = info.converted_currencyid || info.currencyid;
          
          // Debug raw price data
          console.log(`[Arcana] Raw pricing for ${listingId}: price=${info.price}, conv_price=${info.converted_price}, cid=${cid}, total=${total}`);

          // Steam's own formatting
          // @ts-expect-error: Steam internal helper
          let priceString = typeof window.v_currencyformat !== 'undefined' ? window.v_currencyformat(total * 100, cid) : `${total.toFixed(2)}`;
          
          // Clean up numeric currency ID suffix (e.g., "20.99 2001" -> "20.99")
          priceString = priceString.replace(/\s\d+$/, '').trim();

          // STRICT FORCE: recognize both 3 and 2003 as Euro
          const isEuro = (cid === 3 || cid === 2003);

          if (isEuro) {
            const symMap: Record<number, string> = { 1: '$', 2: '£', 3: '€', 4: 'CHF', 5: 'R$', 20: '¥', 34: 'CDN$', 2003: '€' };
            const forcedSymbol = symMap[cid] || '€';
            
            // Extract numeric part (handling cases where priceString might be "$ 18.09" or "18.09 $")
            let numericPart = priceString.replace(/[^\d.,]/g, '').trim();
            // Force comma for decimals
            numericPart = numericPart.replace('.', ',');
            priceString = `${numericPart} ${forcedSymbol}`;
            console.log(`[Arcana] Forced EUR formatting: ${priceString} (cid was ${cid})`);
          } else if (!/[^\d.,\s]/.test(priceString)) {
            // Fallback for other symbols if formatting is stripped
            const symMap: Record<number, string> = { 1: '$', 2: '£', 3: '€', 4: 'CHF', 5: 'R$', 20: '¥', 34: 'CDN$' };
            const forcedSymbol = symMap[cid] || displaySymbol;
            priceString = `${forcedSymbol} ${priceString}`;
          }

          console.log(`[Arcana] Final display price: ${priceString} (Listing: ${listingId})`);

          newListings[listingId] = {
            ...newItemsRaw[listingId],
            price: priceString,
            listingId: listingId,
            appId: appId,
            contextId: contextId,
            assetId: assetId
          };

          // Store raw info and asset for later BuyNow injection
          if (appId && contextId && assetId && json.assets?.[appId]?.[contextId]?.[assetId]) {
            tickerMetadataCache.set(listingId, {
              info: info,
              asset: json.assets[appId][contextId][assetId]
            });
          }

          seenListingIds.add(listingId);
          discoveredCount++;
        }
      }

      if (discoveredCount > 0) {
        window.dispatchEvent(new CustomEvent('ArcanaLivetickerNewListings', {
          detail: newListings
        }));
      }
    }
  }

  async function startDeepScan() {
    isDeepScanning = true;
    console.log("[Arcana] Starting Deep Scan...");
    
    // @ts-expect-error: Steam internal variable
    let start = window.g_oSearchResults?.m_iStart || 0;
    // @ts-expect-error: Steam internal variable
    const totalCount = window.g_oSearchResults?.m_cTotalCount || 0;
    console.log(`[Arcana] Scan status: start=${start}, total=${totalCount}`);
    
    if (totalCount === 0) {
      console.warn("[Arcana] No search results found to scan.");
      isDeepScanning = false;
      return;
    }
    
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

  // Initialize seen IDs from current page
  // @ts-expect-error: Steam internal variable
  if (window.g_rgListingInfo) {
    // @ts-expect-error: Steam internal variable
    Object.keys(window.g_rgListingInfo).forEach(id => seenListingIds.add(id));
  }

  // Poll instead of patching XHR to avoid Prototype.js conflicts
  setInterval(extractData, 1000);
  extractData();
})();
