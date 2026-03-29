import { refreshDatabase, getLastUpdated } from '../services/patternDb';

const lastUpdatedEl = document.getElementById('lastUpdated')!;
const refreshBtn = document.getElementById('refreshBtn')!;
const refreshIcon = document.getElementById('refreshIcon')!;
const refreshText = document.getElementById('refreshText')!;
const versionEl = document.getElementById('version')!;

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
}

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
updateStatus();
