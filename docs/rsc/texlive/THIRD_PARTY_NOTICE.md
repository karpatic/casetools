# Browser pdfTeX Third-Party Notice

CaseTools vendors a bounded Phase 1 subset of browser pdfTeX assets copied
from TeXBrain commit `57b6a32b4d33cf94deb0b1c9260bb991df86cb86`.
The TeXBrain source repository is MIT licensed, copyright (c) 2026 Braian
PLAKU.

Included runtime assets:

- `docs/rsc/swiftlatex/PdfTeXEngine.js`
- `docs/rsc/swiftlatex/swiftlatexpdftex.js`
- `docs/rsc/swiftlatex/swiftlatexpdftex.wasm`

TeXBrain's `THIRD_PARTY_LICENSES` and the engine asset headers identify the
SwiftLaTeX pdfTeX engine files as copyright (C) 2019 Elliott Wen and licensed
under `EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0`.

TeXBrain is MIT licensed and attributes the SwiftLaTeX engine at:
https://github.com/nickkow/nickkow-engine-js

Included TeX Live assets:

- `docs/rsc/texlive/pdftex/10/swiftlatexpdftex.fmt`
- the explicit files listed in `docs/rsc/texlive/casetools-pdftex-manifest.json`

These TeX Live package, font, format, and map files retain their upstream
license notices in their file headers where present. CaseTools does not vendor
the full TeX Live tree; files outside the explicit manifest are not bundled.
