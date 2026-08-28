# CaseTools Architecture

## Overview
CaseTools is a static, client-side web app (served from `docs/`) for managing “cases” and producing compiled evidence packets (cover + table of contents + exhibits) as PDFs.

There is intentionally no traditional build step: the browser loads JSX directly and transpiles it at runtime.

## Runtime & Delivery
- **Entry point**: `docs/index.html`
- **JSX transpilation**: `docs/rsc/bundless.sucrase.min.js` (runtime transpiler)
- **Module loading**: browser **import maps** in `docs/index.html` pull dependencies from CDNs.

## Key Libraries
- **React 17**: UI and local state
- **Bootstrap 5**: layout and component styling (no custom design system)
- **Tabulator**: evidence table rendering/editing
- **localForage**: persistence backed by IndexedDB
- **pdf-lib**: PDF composition and page-level manipulation
- **JSZip**: import/export a case as a `.zip`
- **marked**: markdown rendering (used by some flows)
- **tesseract.js**: OCR (used for text extraction/markup)

## Data Model & Persistence

### `cases` root object
The application keeps a single top-level `cases` object in React state, persisted to IndexedDB under the key `cases`.

High-level shape:
- `cases = { [caseName]: Case }`
- `Case` typically contains:
  - `basics`: cover/certificate/respondent/judge metadata
  - `evidence`: array of evidence metadata entries
  - `evidencePacket_N`: per-packet configuration

### Evidence file storage
Binary evidence files are stored separately in IndexedDB via localForage.

Common key pattern:
- `${caseName}_${sanitizeForKey(fileName)}`
- Optional markup variant: same key with `_markup.pdf`

This keeps the JSON `cases` object small and avoids storing large blobs in React state.

## React State & UI Flow

### App-level state
`docs/components/App.jsx` is the root orchestrator.
- `cases` is loaded once from localForage on startup.
- a `useEffect` persists `cases` back to localForage whenever it changes.
- `pickedCase` is mirrored into `localStorage` for quick reload selection.

### Evidence packets
`docs/components/evidence/packets.jsx` drives packet configuration and compilation.
- Packet configs live inside `cases[pickedCase][packetKey]`.
- The “editing buffer” is `newPacket` (form state) to allow partial edits before persisting.
- Compiled outputs are stored in localForage under `compiled_case_${pickedCase}_${packetKey}` as:
  - `{ certificatePdf: Blob, evidencePacketPdf: Blob }`

### Evidence PDF viewer
`docs/components/evidence/table.jsx` embeds `docs/pdfjs-case-viewer.html` instead of pointing an iframe directly at a PDF blob.
- The viewer wrapper loads Mozilla PDF.js, exposes annotation tools, and uses `postMessage` to receive PDF bytes from React.
- Its custom “Save to CaseTools” button calls PDF.js `saveDocument()` and posts annotated PDF bytes back to React.
- React overwrites the original evidence PDF key and removes the optional `_markup.pdf` sidecar so packet compilation uses the annotated PDF.

## Packet Compilation Pipeline
Compilation happens in `docs/utils/createPacket.js`.

1. **Metadata YAML** is derived from `basics` + packet config.
2. **Cover / Certificate / TOC PDFs** are produced by sending YAML + LaTeX templates to a hosted Pandoc service.
3. Each evidence PDF is loaded from IndexedDB, optionally using the `_markup.pdf` variant if present.
4. Evidence PDFs are **page-numbered** via `docs/utils/pdf/numberPages.js`.
5. Each exhibit is prefixed with a letter page from `docs/rsc/letters/`.
6. Everything is merged into the final packet PDF.

### Template PDF compiler mode
The hosted Pandoc service remains the default compiler and has not been removed. Browser pdfTeX is Phase 1 opt-in only through query keys `casetools-pdftex`, `casetoolsPdfTeX`, or `pdftex`, or through `localStorage["casetools.experimentalBrowserPdfTeX"]`, set to an enable value (`1`, `true`, `on`, `yes`, `browser`, `pdftex`, or `browser-pdftex`). A query value overrides localStorage, so `?casetools-pdftex=server` forces the Pandoc server for that load.

Browser pdfTeX vendors a bounded runtime rather than a full TeX Live tree: the three `docs/rsc/swiftlatex/` engine assets, `docs/rsc/texlive/pdftex/10/swiftlatexpdftex.fmt`, and the files explicitly listed in `docs/rsc/texlive/casetools-pdftex-manifest.json`. These assets are pinned to TeXBrain commit `57b6a32b4d33cf94deb0b1c9260bb991df86cb86`.

Development-only package fallback is a separate opt-in through query keys `casetools-pdftex-dev-packages`, `casetoolsPdfTeXDevPackages`, or `pdftexDevPackages`, or through `localStorage["casetools.experimentalBrowserPdfTeX.devPackageFallback"]`. It can fetch missing TeX files from the pinned static TeX Live mirror recorded in the manifest. Browser pdfTeX failures are surfaced through `window.__casetoolsLastBrowserPdfTeXError`, a `casetools:pdftex-fallback` event, and console diagnostics before falling back to the Pandoc server for the rest of the packet.

### Page sizing behavior
Merging is handled by `docs/utils/pdf/merge.js`.
- Default behavior: preserve original page dimensions.
- Optional behavior: “Fit all pages to the same dimensions” copies each page, resizes it to **US Letter** (8.5×11 inches), and scales page content plus annotation coordinates so saved PDF annotations are preserved.

## Folder Structure (What goes where)
- `docs/` — GitHub Pages site root
  - `index.html` — import map + runtime loader
  - `components/` — React UI
    - `case/` — case-level UI
    - `evidence/` — evidence table, upload, packets
  - `utils/` — pure functions and pipelines
    - `pdf/` — PDF operations (merge, OCR, numbering, etc.)
    - `gpt/` — LLM helpers used for sorting/titles
  - `rsc/` — static resources
    - `latex/` — LaTeX templates for Pandoc
    - `letters/` — exhibit letter pages

## Design Philosophy
- **Static-first**: runs as a static site; avoids server-side state.
- **Local persistence**: JSON config + blobs live in IndexedDB for durability.
- **Small, direct modules**: utilities are single-purpose and imported directly.
- **Minimal UI conventions**: Bootstrap is used for layout; components follow simple form + action button flows.
