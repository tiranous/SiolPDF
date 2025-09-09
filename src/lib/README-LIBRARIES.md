# Required Libraries (MV3-Compatible)

This folder contains external libraries required for PDF Editor Pro functionality.

## PDF.js (Mozilla) - ES Module Version
- **pdf.mjs** - Main PDF.js library (~850KB)  
- **pdf.worker.mjs** - PDF.js web worker (~1.8MB)
- **Download**: https://mozilla.github.io/pdf.js/getting_started/
- **License**: Apache 2.0

### Installation
1. Go to PDF.js releases: https://github.com/mozilla/pdf.js/releases
2. Download latest version
3. Extract files:
   - Copy `pdf.mjs` to `src/lib/pdf.mjs`
   - Copy `pdf.worker.mjs` to `src/lib/pdf.worker.mjs`

## pdf-lib - PDF Manipulation
- **pdf-lib.min.js** - PDF manipulation library (~250KB)
- **Download**: https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js  
- **License**: MIT

### Installation
1. Download from: https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js
2. Save as: `src/lib/pdf-lib.min.js`

## MV3 Compatibility Notes

### ES Module Imports
The extension uses ES module imports for PDF.js:
```javascript
import * as pdfjsLib from "../../lib/pdf.mjs";
```

### Worker Configuration
Worker path is set using chrome.runtime.getURL:
```javascript
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("src/lib/pdf.worker.mjs");
```

### CSP Compliance
- All libraries are loaded as external files
- No inline scripts or `eval()` usage
- WASM support enabled via `'wasm-unsafe-eval'` in CSP

## Testing Without Libraries
The provided placeholders contain mock implementations for basic testing.
For production use, actual libraries are required.

## File Sizes (after download)
- pdf.mjs: ~850KB
- pdf.worker.mjs: ~1.8MB  
- pdf-lib.min.js: ~250KB
- **Total**: ~2.9MB additional
