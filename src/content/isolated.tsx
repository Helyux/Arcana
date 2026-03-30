import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ListingBadge } from '../components/ListingBadge';
import { PatternFilter } from '../components/PatternFilter';
import { parseMarketUrl, lookupPatterns, type PatternGroup } from '../services/patternDb';
import '../index.css';

const marketData = new Map<string, { wear: string; pattern: string }>();
let highlightPatterns: string[] = [];
let patternFilterActive = false;
const itemId = window.location.pathname.split('/').pop() || 'global';
const badgeRoots = new Map<string, Root>();

// Remote pattern data
let remoteGroups: PatternGroup[] | null = null;
let remoteDefaultString = '';
let userHasEdited = false;
let isInitialized = false;

// Ranking data: pattern string → rank number
let rankingMap = new Map<string, number>();

function toggleBodyFilterClass() {
  if (patternFilterActive) {
    document.body.classList.add('arcana-filtering-active');
  } else {
    document.body.classList.remove('arcana-filtering-active');
  }
}

// Build a lookup: pattern ID (string) → { name, icon } for matched badges
function buildPatternGroupMap(): Map<string, { name: string; icon: string }> {
  const map = new Map<string, { name: string; icon: string }>();
  if (!remoteGroups) return map;
  for (const group of remoteGroups) {
    for (const pid of group.pattern) {
      map.set(String(pid), { name: group.name, icon: group.icon });
    }
  }
  return map;
}

let patternGroupMap = new Map<string, { name: string; icon: string }>();

// Initialize: load remote patterns + user state
async function initRemotePatterns() {
  const parsed = parseMarketUrl(window.location.href);
  if (!parsed) return;

  const groups = await lookupPatterns(parsed.skin, parsed.weapon);
  if (groups && groups.length > 0) {
    remoteGroups = groups;
    remoteDefaultString = groups.flatMap(g => g.pattern).join(', ');
    patternGroupMap = buildPatternGroupMap();
  }
}

// Build ranking map from stored string (one pattern per line)
function buildRankingMap(rankingStr: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!rankingStr) return map;
  const lines = rankingStr.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const pattern = lines[i].trim();
    if (pattern) {
      map.set(pattern, i + 1); // rank is 1-based
    }
  }
  return map;
}

// Load user state from storage, then apply patterns
function initUserState() {
  chrome.storage.local.get(['arcana_filters', 'arcana_filter_active', 'arcana_user_edited', 'arcana_rankings'], (result: {
    arcana_filters?: Record<string, string>;
    arcana_filter_active?: Record<string, boolean>;
    arcana_user_edited?: Record<string, boolean>;
    arcana_rankings?: Record<string, string>;
  }) => {
    const filters = result.arcana_filters || {};
    const activeStates = result.arcana_filter_active || {};
    const editedStates = result.arcana_user_edited || {};
    const rankings = result.arcana_rankings || {};

    patternFilterActive = !!activeStates[itemId];
    toggleBodyFilterClass();

    userHasEdited = !!editedStates[itemId];

    if (userHasEdited && filters[itemId]) {
      // User has custom patterns — use those
      highlightPatterns = filters[itemId].split(',').map((p: string) => p.trim()).filter(Boolean);
    } else if (!userHasEdited && remoteDefaultString) {
      // No user edits — use remote defaults
      highlightPatterns = remoteDefaultString.split(',').map((p: string) => p.trim()).filter(Boolean);
    } else if (filters[itemId]) {
      highlightPatterns = filters[itemId].split(',').map((p: string) => p.trim()).filter(Boolean);
    }

    // Load rankings
    if (rankings[itemId]) {
      rankingMap = buildRankingMap(rankings[itemId]);
    }

    processListings(true);
    isInitialized = true;
    injectFilter();
  });
}

// Listen for real-time pattern updates from the filter component
window.addEventListener('ArcanaPatternUpdate', (e: Event) => {
  const customEvent = e as CustomEvent;
  const { patterns, userEdited } = customEvent.detail;
  userHasEdited = userEdited;

  if (userEdited) {
    highlightPatterns = (patterns as string).split(',').map((p: string) => p.trim()).filter(Boolean);
  } else if (remoteDefaultString) {
    highlightPatterns = remoteDefaultString.split(',').map((p: string) => p.trim()).filter(Boolean);
  } else {
    highlightPatterns = (patterns as string).split(',').map((p: string) => p.trim()).filter(Boolean);
  }
  processListings(true);
});

// Listen for ranking updates from the filter component
window.addEventListener('ArcanaRankingUpdate', (e: Event) => {
  const customEvent = e as CustomEvent;
  const { ranking } = customEvent.detail;
  rankingMap = buildRankingMap(ranking || '');
  processListings(true);
});

// Store original DOM order for sort reset
let originalRowOrder: string[] | null = null;

function captureOriginalOrder(container: Element) {
  if (originalRowOrder) return;
  const rows = container.querySelectorAll('.market_listing_row');
  originalRowOrder = Array.from(rows).map(r => r.id);
}

function restoreOriginalOrder(container: Element) {
  if (!originalRowOrder) return;
  for (const id of originalRowOrder) {
    const row = container.querySelector(`#${CSS.escape(id)}`);
    if (row) container.appendChild(row);
  }
}

// Listen for "Order by Float" button (3-state: none/asc/desc)
window.addEventListener('ArcanaOrderByFloat', (e: Event) => {
  const container = document.querySelector('#searchResultsRows');
  if (!container) return;
  const direction = (e as CustomEvent).detail?.direction || 'none';

  if (direction === 'none') {
    restoreOriginalOrder(container);
    return;
  }

  captureOriginalOrder(container);
  const rows = Array.from(container.querySelectorAll('.market_listing_row')) as HTMLElement[];

  rows.sort((a, b) => {
    const idA = a.id.split('_').pop() || '';
    const idB = b.id.split('_').pop() || '';
    const dataA = marketData.get(idA);
    const dataB = marketData.get(idB);
    const floatA = dataA ? parseFloat(dataA.wear) : Infinity;
    const floatB = dataB ? parseFloat(dataB.wear) : Infinity;
    return direction === 'asc' ? floatA - floatB : floatB - floatA;
  });

  for (const row of rows) {
    container.appendChild(row);
  }
});

// Listen for "Order by Rank" button (3-state: none/asc/desc)
window.addEventListener('ArcanaOrderByRank', (e: Event) => {
  const container = document.querySelector('#searchResultsRows');
  if (!container) return;
  const direction = (e as CustomEvent).detail?.direction || 'none';

  if (direction === 'none') {
    restoreOriginalOrder(container);
    return;
  }

  captureOriginalOrder(container);
  const rows = Array.from(container.querySelectorAll('.market_listing_row')) as HTMLElement[];

  rows.sort((a, b) => {
    const idA = a.id.split('_').pop() || '';
    const idB = b.id.split('_').pop() || '';
    const dataA = marketData.get(idA);
    const dataB = marketData.get(idB);
    const rankA = dataA ? (rankingMap.get(dataA.pattern) ?? Infinity) : Infinity;
    const rankB = dataB ? (rankingMap.get(dataB.pattern) ?? Infinity) : Infinity;
    return direction === 'asc' ? rankA - rankB : rankB - rankA;
  });

  for (const row of rows) {
    container.appendChild(row);
  }
});

// Listen for storage changes from other tabs/extension
chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }) => {
  let needsUpdate = false;

  if (changes.arcana_filters) {
    const filters = (changes.arcana_filters.newValue as Record<string, string>) || {};
    const editedStates: Record<string, boolean> = {};
    chrome.storage.local.get(['arcana_user_edited'], (result) => {
      Object.assign(editedStates, result.arcana_user_edited || {});
    });
    
    if (editedStates[itemId] || userHasEdited) {
      const itemFilters = filters[itemId];
      highlightPatterns = (itemFilters || '').split(',').map((p: string) => p.trim()).filter(Boolean);
    }
    needsUpdate = true;
  }

  if (changes.arcana_filter_active) {
    const activeStates = (changes.arcana_filter_active.newValue as Record<string, boolean>) || {};
    patternFilterActive = !!activeStates[itemId];
    toggleBodyFilterClass();
    needsUpdate = true;
  }

  if (changes.arcana_user_edited) {
    const editedStates = (changes.arcana_user_edited.newValue as Record<string, boolean>) || {};
    userHasEdited = !!editedStates[itemId];

    if (!userHasEdited && remoteDefaultString) {
      highlightPatterns = remoteDefaultString.split(',').map((p: string) => p.trim()).filter(Boolean);
    }
    needsUpdate = true;
  }

  if (changes.arcana_rankings) {
    const rankings = (changes.arcana_rankings.newValue as Record<string, string>) || {};
    rankingMap = buildRankingMap(rankings[itemId] || '');
    needsUpdate = true;
  }

  if (needsUpdate) {
    processListings(true);
  }
});

function processListings(forceRender = false) {
  const rows = document.querySelectorAll('.market_listing_row');
  rows.forEach(row => {
    const idParts = row.id.split('_');
    const listingId = idParts[idParts.length - 1];

    if (!listingId) return;

    const data = marketData.get(listingId);
    if (!data) {
      row.removeAttribute('data-extra-info-processed');
      return;
    }

    const isProcessed = row.getAttribute('data-extra-info-processed') === 'true';
    const hasContainer = row.querySelector('.steam-extra-info-root');

    if (forceRender || !isProcessed || !hasContainer) {
      applyHighlight(row, data);
      renderBadge(row, data, listingId);
      row.setAttribute('data-extra-info-processed', 'true');
    }
  });
}

function applyHighlight(row: Element, data: { pattern: string }) {
  if (data && highlightPatterns.includes(data.pattern)) {
    row.classList.add('arcana-match-highlight');
  } else {
    row.classList.remove('arcana-match-highlight');
  }
}

let filterRoot: Root | null = null;

function injectFilter() {
  if (!isInitialized) return;
  const target = document.querySelector('#market_buyorder_info') || document.querySelector('.market_listing_filter');
  if (!target || document.querySelector('.arcana-filter-root')) return;

  const rootContainer = document.createElement('div');
  rootContainer.className = 'arcana-filter-root';
  target.parentElement?.insertBefore(rootContainer, target);

  const groupsForFilter = remoteGroups?.map(g => ({
    name: g.name,
    icon: g.icon,
    patterns: g.pattern,
  })) || [];

  filterRoot = createRoot(rootContainer);
  filterRoot.render(
    <React.StrictMode>
      <PatternFilter
        itemId={itemId}
        defaultPatterns={remoteDefaultString}
        defaultGroups={groupsForFilter}
        hasRemoteDefaults={!!(remoteGroups && remoteGroups.length > 0)}
      />
    </React.StrictMode>
  );
}

function renderBadge(row: Element, data: { wear: string, pattern: string }, listingId: string) {
  if (!data) return;

  const nameBlock = row.querySelector('.market_listing_item_name_block');
  if (!nameBlock) return;

  let rootContainer = row.querySelector('.steam-extra-info-root');
  if (!rootContainer) {
    rootContainer = document.createElement('div');
    rootContainer.className = 'steam-extra-info-root';

    const detailsBlock = row.querySelector('.market_listing_row_details');
    
    if (detailsBlock && detailsBlock.parentElement === nameBlock) {
      nameBlock.insertBefore(rootContainer, detailsBlock);
    } else {
      const firstExtra = row.querySelector('.sticker_info, .keychain_info');
      if (firstExtra && firstExtra.parentElement === nameBlock) {
        nameBlock.insertBefore(rootContainer, firstExtra);
      } else {
        nameBlock.appendChild(rootContainer);
      }
    }
  }

  const isMatched = highlightPatterns.includes(data.pattern);
  const matchInfo = isMatched ? (patternGroupMap.get(data.pattern) || null) : null;
  const rank = rankingMap.get(data.pattern) ?? null;

  let root = badgeRoots.get(listingId);
  if (!root || !document.body.contains(rootContainer)) {
    root = createRoot(rootContainer);
    badgeRoots.set(listingId, root);
  }

  root.render(
    <React.StrictMode>
      <ListingBadge wear={data.wear} pattern={data.pattern} isMatched={isMatched} matchInfo={matchInfo} rank={rank} />
    </React.StrictMode>
  );
}

// Reset when a major DOM change occurs
const observer = new MutationObserver(() => {
  badgeRoots.clear();
});

const searchResults = document.querySelector('#searchResultsRows');
if (searchResults) {
  observer.observe(searchResults, { childList: true });
}

// Listen for data from the main world
window.addEventListener('SteamMarketDataLoaded', (event: Event) => {
  const customEvent = event as CustomEvent;
  const newItems = customEvent.detail;
  let hasChanges = false;

  for (const listingId in newItems) {
    if (!marketData.has(listingId) || marketData.get(listingId)?.wear !== newItems[listingId].wear) {
      marketData.set(listingId, newItems[listingId]);
      hasChanges = true;
    }
  }

  if (hasChanges) {
    processListings(false);
  }
});

// Listen for deep scan chunks
window.addEventListener('SteamMarketDeepScanChunk', (event: Event) => {
  const customEvent = event as CustomEvent;
  const { results_html, chunkData } = customEvent.detail;
  
  if (!highlightPatterns || highlightPatterns.length === 0) return;

  const doc = new DOMParser().parseFromString(results_html, 'text/html');
  const tempDiv = doc.body;

  const searchResultsRows = document.querySelector('#searchResultsRows');
  if (!searchResultsRows) return;

  let hasNewMatches = false;

  for (const listingId in chunkData) {
    const data = chunkData[listingId];
    if (highlightPatterns.includes(data.pattern)) {
      const row = tempDiv.querySelector(`#listing_${listingId}`);
      if (row) {
        if (!document.querySelector(`#listing_${listingId}`)) {
           searchResultsRows.appendChild(row);
           marketData.set(listingId, data);
           hasNewMatches = true;
        }
      }
    }
  }

  if (hasNewMatches) {
    processListings(true);
  }
});

// Bootstrap: load remote patterns first, then user state
initRemotePatterns().then(() => {
  initUserState();
  
  // Start periodic check ONLY after initialization
  setInterval(() => {
    processListings(false);
    if (!document.querySelector('.arcana-filter-root')) {
      injectFilter();
    }
  }, 1000);
});
