const PATTERN_URL = 'https://raw.githubusercontent.com/Helyux/cs2pattern/refs/heads/master/cs2pattern/pattern.json';
const ICONS_URL = 'https://raw.githubusercontent.com/Helyux/cs2pattern/refs/heads/master/cs2pattern/icons.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PatternGroup {
  name: string;
  icon: string;
  ordered: boolean;
  pattern: number[];
}

interface RawPatternGroup {
  name: string;
  ordered: boolean;
  pattern: number[];
}

type PatternDb = Record<string, Record<string, RawPatternGroup[]>>;
type IconsDb = Record<string, string>;

let cachedPatternDb: PatternDb | null = null;
let cachedIconsDb: IconsDb | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function loadFromStorage(): Promise<{ patternDb: PatternDb | null; iconsDb: IconsDb | null; lastUpdated: number }> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['arcana_pattern_db', 'arcana_icons_db', 'arcana_db_last_updated'], (result) => {
      resolve({
        patternDb: (result.arcana_pattern_db as PatternDb) || null,
        iconsDb: (result.arcana_icons_db as IconsDb) || null,
        lastUpdated: (result.arcana_db_last_updated as number) || 0,
      });
    });
  });
}

async function saveToStorage(patternDb: PatternDb, iconsDb: IconsDb): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      arcana_pattern_db: patternDb,
      arcana_icons_db: iconsDb,
      arcana_db_last_updated: Date.now(),
    }, resolve);
  });
}

export async function refreshDatabase(): Promise<void> {
  const [patternDb, iconsDb] = await Promise.all([
    fetchJson<PatternDb>(PATTERN_URL),
    fetchJson<IconsDb>(ICONS_URL),
  ]);
  cachedPatternDb = patternDb;
  cachedIconsDb = iconsDb;
  await saveToStorage(patternDb, iconsDb);
}

async function ensureLoaded(): Promise<void> {
  if (cachedPatternDb && cachedIconsDb) return;

  const stored = await loadFromStorage();
  const isStale = Date.now() - stored.lastUpdated > CACHE_TTL_MS;

  if (stored.patternDb && stored.iconsDb && !isStale) {
    cachedPatternDb = stored.patternDb;
    cachedIconsDb = stored.iconsDb;
    return;
  }

  // Fetch fresh data
  try {
    await refreshDatabase();
  } catch {
    // If fetch fails but we have stale cache, use it
    if (stored.patternDb && stored.iconsDb) {
      cachedPatternDb = stored.patternDb;
      cachedIconsDb = stored.iconsDb;
    }
  }
}

export function getIcon(groupName: string): string {
  return cachedIconsDb?.[groupName] || '';
}

export async function lookupPatterns(skinName: string, weaponName: string): Promise<PatternGroup[] | null> {
  await ensureLoaded();
  if (!cachedPatternDb) return null;

  const skinKey = skinName.toLowerCase().trim();
  const weaponKey = weaponName.toLowerCase().trim();

  const skinEntry = cachedPatternDb[skinKey];
  if (!skinEntry) return null;

  const groups = skinEntry[weaponKey];
  if (!groups || groups.length === 0) return null;

  return groups.map((g) => ({
    name: g.name,
    icon: getIcon(g.name),
    ordered: g.ordered,
    pattern: g.pattern,
  }));
}

export async function getAllPatternIds(skinName: string, weaponName: string): Promise<string> {
  const groups = await lookupPatterns(skinName, weaponName);
  if (!groups) return '';

  const allIds = groups.flatMap((g) => g.pattern);
  return allIds.join(', ');
}

export async function getGithubLink(skin: string, weapon: string): Promise<string> {
  const baseUrl = 'https://github.com/Helyux/cs2pattern/blob/master/cs2pattern/pattern.json';
  try {
    const res = await fetch(PATTERN_URL);
    if (!res.ok) return baseUrl;
    const text = await res.text();
    const lines = text.split('\n');

    const skinKey = `"${skin.toLowerCase().trim()}":`;
    const weaponKey = `"${weapon.toLowerCase().trim()}":`;

    let skinLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(skinKey)) {
        skinLine = i + 1;
        break;
      }
    }

    if (skinLine === -1) return baseUrl;

    let weaponLine = -1;
    for (let i = skinLine; i < lines.length; i++) {
      // If we hit another skin (2-space indent), stop
      // Match something like   "abyss": {
      if (lines[i].match(/^ {2}"[^"]+": \{/)) break;

      if (lines[i].includes(weaponKey)) {
        weaponLine = i + 1;
        break;
      }
    }

    return `${baseUrl}#L${weaponLine !== -1 ? weaponLine : skinLine}`;
  } catch {
    return baseUrl;
  }
}

export interface SupportedSkin {
  skin: string;
  weapons: string[];
}

export async function getSupportedSkins(): Promise<SupportedSkin[]> {
  await ensureLoaded();
  const db = cachedPatternDb;
  if (!db) return [];

  const skins = Object.keys(db).sort();
  return skins.map(skin => ({
    skin,
    weapons: Object.keys(db[skin]).sort()
  }));
}

export async function getLastUpdated(): Promise<number> {
  const stored = await loadFromStorage();
  return stored.lastUpdated;
}

/**
 * Parse a Steam Market URL to extract weapon and skin names.
 * Example: /market/listings/730/Desert%20Eagle%20%7C%20Heat%20Treated%20%28Minimal%20Wear%29
 * Returns: { weapon: "desert eagle", skin: "heat treated" } or null
 */
export function parseMarketUrl(url: string): { weapon: string; skin: string } | null {
  try {
    const pathname = new URL(url).pathname;
    const encoded = pathname.split('/').pop();
    if (!encoded) return null;

    const decoded = decodeURIComponent(encoded);
    // Format: "Weapon Name | Skin Name (Wear)"
    const pipeIndex = decoded.indexOf('|');
    if (pipeIndex === -1) return null;

    const weapon = decoded.substring(0, pipeIndex).trim().toLowerCase();
    const afterPipe = decoded.substring(pipeIndex + 1).trim();

    // Remove wear condition in parentheses, e.g. "(Minimal Wear)"
    const parenIndex = afterPipe.lastIndexOf('(');
    const skin = (parenIndex !== -1 ? afterPipe.substring(0, parenIndex) : afterPipe).trim().toLowerCase();

    if (!weapon || !skin) return null;
    return { weapon, skin };
  } catch {
    return null;
  }
}
