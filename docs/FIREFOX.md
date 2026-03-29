# Arcana — Firefox Source Code Review

This document is provided for Mozilla Add-on reviewers to reproduce the extension build from source.

## Environment Requirements

- **Operating System**: Windows 10/11, macOS, or Linux
- **Node.js**: v20.0.0 or higher ([download](https://nodejs.org/))
- **npm**: Included with Node.js (no separate install needed)

## Build Tools Used

| Tool | Purpose |
|------|---------|
| **TypeScript (tsc)** | Type-safe source code compiled to JavaScript |
| **React (JSX/TSX)** | UI components for badges and filter overlay |
| **Vite** | Build tool and module bundler |
| **CRXJS** (`@crxjs/vite-plugin`) | Vite plugin for browser extension manifest handling |
| **Tailwind CSS** | Utility-first CSS framework for component styling |

## Build Instructions

1. **Extract** the source archive into a new directory.

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the extension**:
   ```bash
   npm run build
   ```

4. **Output**: The finalized extension files will be in the `dist/` directory. The `dist/manifest.json` is the extension entry point.

## Data Collection

This extension does **not** collect, store, or transmit any user data. All processing happens locally within the browser. The `data_collection_permissions` field in the manifest is set to `"none"`.

## Source Overview

All application source code is in the `src/` directory:

- `src/content/isolated.tsx` — Runs in the isolated content script world. Handles DOM injection of float/pattern badges and the filtering/deep-scan UI logic.
- `src/content/main.ts` — Runs in the main page world to access Steam's internal JavaScript variables (`g_rgListingInfo`, `g_rgAssets`). Handles data extraction and the deep-scan fetch loop.
- `src/components/ListingBadge.tsx` — React component rendering the float/pattern badge.
- `src/components/PatternFilter.tsx` — React component for the filter input, filter toggle, and deep scan button.
- `src/index.css` — Styles injected into the Steam page for badges, highlights, and filtering.

No remote code is loaded or executed at runtime.
