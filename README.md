# <img src="public/icon.png" width="32" height="32"> Arcana

A browser extension for CS2 that displays **Float Values** and **Pattern Templates** directly on Steam Community Market listings. Includes powerful filtering and an autonomous deep-scan engine to find specific patterns across thousands of listings.

## Features

- **Inline Badges** — Float wear values and pattern template IDs are injected directly into each market listing row.
- **Pattern Highlighting** — Enter comma-separated pattern IDs to visually highlight matching listings with a red outline.
- **Instant Filter** — Toggle a filter to instantly hide all non-matching listings on the current page.
- **Deep Scan** — Autonomously fetches *all* pages of listings from Steam's API, extracts only the rows matching your patterns, and injects them into the page. Non-matches are discarded in memory to keep your browser fast.

---

[**Check the Roadmap**](docs/ROADMAP.md) for upcoming features and future planning!

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

### Firefox Desktop (Permanent Install)

To install the extension permanently in Firefox:

1. **Download** the signed version: [arcana-1.0.1.xpi](https://addons.mozilla.org/firefox/downloads/file/4744588/0dd5ddc0d798416e802f-1.0.1.xpi)
2. Open Firefox and go to `about:addons`
3. **Drag and drop** the downloaded `.xpi` file into the page to install.

Detailed build instructions for Mozilla reviewers can be found in [FIREFOX.md](docs/FIREFOX.md).

### Chrome / Edge / Brave

1. **Build** the project locally (see above).
2. Navigate to `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder

### Development (Temporary Firefox Load)

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist/manifest.json` (Note: This will disappear when Firefox restarts).

## Project Structure

```
├── configs/            # Build and development configurations (TS, ESLint)
├── docs/               # Project documentation (Roadmap, Firefox guide)
├── public/             # Static assets (icons)
├── src/
│   ├── components/     # React UI components
│   └── content/        # Content scripts (main world + isolated world)
├── manifest.json       # Extension manifest
├── package.json        # Dependencies and scripts
└── vite.config.ts      # Vite bundler configuration
```

## Tech Stack

- **TypeScript** + **React** for UI components
- **Vite** + **CRXJS** for extension bundling
- **Tailwind CSS** for component styling

## Contributing
Contributions are welcome! Open an issue or submit a pull request.

## License
GPLv3 License. See the LICENSE file for details.
