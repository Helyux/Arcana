import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ListingBadge } from '../components/ListingBadge';
import { PatternFilter } from '../components/PatternFilter';
import '../index.css';

const marketData = new Map<string, { wear: string; pattern: string }>();
let highlightPatterns: string[] = [];
let patternFilterActive = false;
const itemId = window.location.pathname.split('/').pop() || 'global';
const badgeRoots = new Map<string, Root>();

function toggleBodyFilterClass() {
  if (patternFilterActive) {
    document.body.classList.add('arcana-filtering-active');
  } else {
    document.body.classList.remove('arcana-filtering-active');
  }
}

// Load patterns specific to this page
chrome.storage.local.get(['arcana_filters', 'arcana_filter_active'], (result: { arcana_filters?: Record<string, string>, arcana_filter_active?: Record<string, boolean> }) => {
  const filters = result.arcana_filters || {};
  const itemFilters = filters[itemId];
  
  const activeStates = result.arcana_filter_active || {};
  patternFilterActive = !!activeStates[itemId];
  toggleBodyFilterClass();

  if (itemFilters) {
    highlightPatterns = itemFilters.split(',').map((p: string) => p.trim()).filter(Boolean);
  }
  processListings(true);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }) => {
  let needsUpdate = false;

  if (changes.arcana_filters) {
    const filters = (changes.arcana_filters.newValue as Record<string, string>) || {};
    const itemFilters = filters[itemId];
    highlightPatterns = (itemFilters || '').split(',').map((p: string) => p.trim()).filter(Boolean);
    needsUpdate = true;
  }

  if (changes.arcana_filter_active) {
    const activeStates = (changes.arcana_filter_active.newValue as Record<string, boolean>) || {};
    patternFilterActive = !!activeStates[itemId];
    toggleBodyFilterClass();
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

    // Re-render only if forced (e.g. pattern filters updated), 
    // or if not previously processed, or if Steam's internal DOM updates destroyed the container.
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

function injectFilter() {
  const target = document.querySelector('#market_buyorder_info') || document.querySelector('.market_listing_filter');
  if (!target || document.querySelector('.arcana-filter-root')) return;

  const rootContainer = document.createElement('div');
  rootContainer.className = 'arcana-filter-root';
  target.parentElement?.insertBefore(rootContainer, target);

  createRoot(rootContainer).render(
    <React.StrictMode>
      <PatternFilter itemId={itemId} />
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

    // Position: Below Name, Above Stickers/Charms
    // Steam sometimes nests stickers inside .market_listing_row_details. 
    // We must inject as a sibling to that block to ensure strict vertical CSS stacking.
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

  let root = badgeRoots.get(listingId);
  if (!root || !document.body.contains(rootContainer)) {
    root = createRoot(rootContainer);
    badgeRoots.set(listingId, root);
  }

  root.render(
    <React.StrictMode>
      <ListingBadge wear={data.wear} pattern={data.pattern} isMatched={isMatched} />
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
  
  // If no patterns are active, we do not want to violently dump thousands of items
  // into the DOM. We only pluck explicitly requested patterns.
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
        // Prevent duplicate appending if the user runs the scan multiple times
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

// Periodic check
setInterval(() => {
  processListings(false);
  injectFilter();
}, 1000);

processListings(false);
injectFilter();
