# Enhance inspection credibility with deterministic math and image preprocessing

## Goal
Make every inspection result more credible by tightening the deterministic mathematical checks and by cleaning up label photographs before they reach OCR. No new API keys, no predictive AI, and no external FastAPI backend are required.

## API keys
- **No new key is needed.** OCR already uses the managed `LOVABLE_API_KEY` through the Lovable AI Gateway.
- Image preprocessing will run in the browser using the Canvas API, so it needs no key.
- Mathematical validation is local code, so it needs no key.

## 1. Stricter mathematical validation

### Measurement rigour
- Record the **instrument resolution** (smallest division) and **instrument ID** for every manual numeral-height and quantity measurement.
- Compute and display **measurement uncertainty** as ±resolution/2 for each manual entry, and use it to soften/harden the pass/fail boundary.
- Require the officer to choose a measurement source (calibrated gauge, weighing scale, reference card, visual estimate) and store it with the record.

### Quantity parsing improvements
- Extend `parseQuantity` to handle:
  - Count units (`pcs`, `pieces`, `units`, `n`, `x`).
  - Compound quantities (`500 g + 50 g free`, `2 x 1 L`).
  - Ranges and approximate values (`~1 kg`, `approx 250 ml`).
  - Indian numbering in MRP (`₹1,25,000`, `Rs. 2500/-`).
- Add a `unitConsistency` check that flags a mismatch between the declared unit and the weighed unit.

### Tolerance and band lookup
- Replace the hard-coded `toleranceFor` and `bandForQuantity` tables with lookups against the stored `lm_limits` rows where possible, falling back to the statutory tables only when a limit row is missing.
- Add a `toleranceBand` explanation to every measurement finding so the officer sees the exact legal basis.

### Cross-face confidence weighting
- When the same declaration appears on multiple faces with conflicting values, flag the conflict for review instead of silently picking the highest-confidence value.
- Require a minimum number of readable text regions per face before allowing a field to be marked detected.

## 2. Image preprocessing (browser-side)

Create a new `src/lib/image-preprocess.ts` module that runs entirely in the browser before an image is sent to `readFace`.

### Preprocessing operations
- **EXIF orientation correction** so photographs taken on mobile devices are upright.
- **Auto-crop / perspective correction** using four user-placed corner points (fallback to no correction if the user skips it).
- **Contrast and brightness normalization** to reduce glare and faded-print problems.
- **Histogram equalization** for low-contrast labels.
- **Resize to an OCR-friendly resolution** (between 1024 and 2048 px on the long edge) to balance quality and token cost.
- **Grayscale option** toggle for monochrome labels.

### UI changes on the inspection page
- Add a small "Enhance image" toggle per face slot.
- Show a side-by-side thumbnail of original vs. preprocessed image before running OCR.
- Always store the **original** photograph as evidence; send only the **preprocessed** image to OCR.

### Why no OpenCV / FastAPI
- OpenCV native binaries cannot run in the Cloudflare Worker server runtime.
- A FastAPI service would add an external dependency, hosting cost, and latency.
- The Canvas API and WebGL are sufficient for the preprocessing listed above and keep everything inside the existing TanStack Start app.

## 3. Files to change
- `src/lib/compliance.ts` — stricter math helpers, uncertainty, expanded quantity parser, tolerance lookup.
- `src/lib/image-preprocess.ts` — new browser-side preprocessing module.
- `src/routes/index.tsx` — preprocessing toggle, instrument fields, measurement source selector.
- `src/lib/catalog.ts` / `src/lib/offline.ts` — carry new measurement metadata through sync.
- Database migration — add `instrument_id`, `resolution_mm`, `resolution_g`, and `measurement_source` columns to `lm_inspections` if they are to be persisted.

## 4. Acceptance criteria
- Manual measurements show an uncertainty range.
- Quantity parser handles counts, compounds, ranges, and Indian MRP formats.
- Tolerance and numeral-height bands reference stored legal limits.
- Conflicting declarations across faces are flagged.
- Preprocessed images can be toggled and previewed per face.
- Original photographs remain stored as evidence.
- Typecheck passes and inspection flow works in the browser without new API keys.
