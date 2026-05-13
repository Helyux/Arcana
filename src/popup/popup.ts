import { refreshDatabase, getLastUpdated, getSupportedSkins, type SupportedSkin } from '../services/patternDb';

const lastUpdatedEl = document.getElementById('lastUpdated')!;
const refreshBtn = document.getElementById('refreshBtn')!;
const refreshIcon = document.getElementById('refreshIcon')!;
const refreshText = document.getElementById('refreshText')!;
const versionEl = document.getElementById('version')!;
const pollingIntervalInput = document.getElementById('pollingInterval') as HTMLInputElement;
const skinSearchInput = document.getElementById('skinSearch') as HTMLInputElement;
const skinListContainer = document.getElementById('skinList')!;

function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Never';
  
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

async function updateStatus() {
  const timestamp = await getLastUpdated();
  lastUpdatedEl.textContent = formatTimeAgo(timestamp);
  await populateSkins();
}



function getMarketUrl(skin: string, weapon: string): string {
  const query = encodeURIComponent(`${weapon} ${skin}`);
  return `https://steamcommunity.com/market/search?appid=730&q=${query}`;
}

let allSkins: SupportedSkin[] = [];

function capitalize(s: string): string {
  return s.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

async function populateSkins() {
  allSkins = await getSupportedSkins();
  renderSkins(allSkins);
}

function renderSkins(skins: SupportedSkin[]) {
  skinListContainer.innerHTML = '';
  
  if (skins.length === 0) {
    skinListContainer.innerHTML = '<p class="no-results">No skins found.</p>';
    return;
  }

  skins.forEach(s => {
    const skinDiv = document.createElement('div');
    skinDiv.className = 'skin-item';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'skin-name';
    nameSpan.textContent = capitalize(s.skin);
    skinDiv.appendChild(nameSpan);

    const weaponsDiv = document.createElement('div');
    weaponsDiv.className = 'skin-weapons';
    
    s.weapons.forEach(w => {
      const link = document.createElement('a');
      link.href = getMarketUrl(s.skin, w);
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'weapon-link';
      link.title = `View ${capitalize(w)} | ${capitalize(s.skin)} on Steam Market`;
      link.textContent = w.toUpperCase();
      weaponsDiv.appendChild(link);
    });
    
    skinDiv.appendChild(weaponsDiv);
    skinListContainer.appendChild(skinDiv);
  });
}

skinSearchInput.addEventListener('input', () => {
  const query = skinSearchInput.value.toLowerCase().trim();
  const filtered = allSkins.filter(s => 
    s.skin.toLowerCase().includes(query) || 
    s.weapons.some(w => w.toLowerCase().includes(query))
  );
  renderSkins(filtered);
});

async function handleRefresh() {
  refreshBtn.classList.add('loading');
  refreshIcon.classList.add('spinning');
  refreshText.textContent = 'Updating...';

  try {
    await refreshDatabase();
    await updateStatus();
    refreshText.textContent = 'Updated!';
    setTimeout(() => {
      refreshText.textContent = 'Update Now';
    }, 2000);
  } catch {
    refreshText.textContent = 'Failed';
    setTimeout(() => {
      refreshText.textContent = 'Update Now';
    }, 2000);
  } finally {
    refreshBtn.classList.remove('loading');
    refreshIcon.classList.remove('spinning');
  }
}

// Initialize
const manifest = chrome.runtime.getManifest();
versionEl.textContent = `v${manifest.version}`;
refreshBtn.addEventListener('click', handleRefresh);

// Load and save polling interval
chrome.storage.local.get(['arcana_polling_interval'], (result) => {
  if (result.arcana_polling_interval) {
    pollingIntervalInput.value = result.arcana_polling_interval.toString();
  }
});

pollingIntervalInput.addEventListener('change', () => {
  const val = parseInt(pollingIntervalInput.value, 10);
  if (!isNaN(val) && val >= 5) {
    chrome.storage.local.set({ arcana_polling_interval: val });
  } else {
    pollingIntervalInput.value = "15";
    chrome.storage.local.set({ arcana_polling_interval: 15 });
  }
});

updateStatus();
