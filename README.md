# Arcana

A browser extension for CS2 that displays **Float Values** and **Pattern Templates** directly on Steam Community Market listings. Includes powerful filtering and an autonomous deep-scan engine to find specific patterns across thousands of listings.

## Features

- **Inline Badges** — Float wear values and pattern template IDs are injected directly into each market listing row.
- **Pattern Highlighting** — Enter comma-separated pattern IDs to visually highlight matching listings with a red outline.
- **Instant Filter** — Toggle a filter to instantly hide all non-matching listings on the current page.
- **Deep Scan** — Autonomously fetches *all* pages of listings from Steam's API, extracts only the rows matching your patterns, and injects them into the page. Non-matches are discarded in memory to keep your browser fast.

## Browser Support

| Browser | Status |
|---------|--------|
| Chrome / Edge / Brave | ✅ Load unpacked from `dist/` |
| Firefox (142+) | ✅ Load via `about:debugging` or install signed `.xpi` |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or higher (includes npm)

### Install & Build

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

The compiled extension will be in the `dist/` directory.

### Load in Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

### Load in Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist/manifest.json`

### Package for Firefox Signing

```bash
npm run pack
```

This builds the extension and creates a `packages/arcana-1.0.0.zip` ready for upload to the [Mozilla Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/).

## Project Structure

```
src/
├── components/
│   ├── ListingBadge.tsx    # Float/Pattern badge UI
│   └── PatternFilter.tsx   # Filter input + Deep Scan controls
├── content/
│   ├── isolated.tsx        # Isolated world: DOM injection, badge rendering, filtering
│   └── main.ts             # Main world: Steam data extraction, deep scan fetcher
└── index.css               # Injected styles (highlights, badge layout, filter rules)
```

## Tech Stack

- **TypeScript** + **React** for UI components
- **Vite** + **CRXJS** for extension bundling
- **Tailwind CSS** for component styling

## License

This project is private and not publicly licensed.
