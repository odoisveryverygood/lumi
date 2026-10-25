# Flare: a conversation with the design, not just its shape

**User:** a maker modifying an existing keyboard who wants to retain the enclosure and USB port. The first study is the pinned Corne assembly. Existing exploration, general object creation, GLB import, manual part edits and circuit tools remain available.

The question is concrete: “Can I make this wireless without replacing the case?” A geometry-only answer can miss a charging incompatibility. This copy places the original assembly, component documents and requested changes in one conversation.

## The working flow

1. Open the Corne design study. Six reference files include manufacturer battery descriptions, controller specifications, hardware documentation and the pinned build guide. The source case remains an imported mesh, not a replacement box.
2. Add PDFs, PNG/JPEG/WebP diagrams, UTF-8 notes, CSV/BOM, JSON or textual KiCad files. Files stay in this browser, and their included contents are sent to Gemini with design questions. PDFs retain page numbers and are also attached inline so the model can inspect diagrams. Native PDF text is extracted by unpdf. Images and scans remain visual evidence; no AI transcription is converted into quotable source text. Their pixels are still included in multimodal reasoning.
3. Associate a component document to extract current ratings. The server matches each number, unit, page and exact quote. Uploaded facts are disabled for numeric checks until the user reviews them. A reviewed stricter limit adds to the original manufacturer limit; it cannot erase it. C-rate conversion and other inferred numeric facts are deliberately not accepted as direct mA quotations.
4. Ask for a conversion. Gemini proposes bounded choices and poses. Geometry code checks the actual source case mesh, floor support, clearances, original-part preservation and requested limits. A separate deterministic check compares the proposed charge setting, documented controller settings, battery maximum and requested minimum. Passing a numeric comparison is not electrical validation.
5. Failed checks go back to the live model for up to three attempts. Requirements freeze after the first valid proposal. The model cannot quietly lower a requested charge rate. A blocked proposal remains inspectable and cannot be applied. A ready final proposal can be applied as one undoable change.
6. Ask questions without modifying geometry. Cite chips open the exact page/section and excerpt. Inspect this view sends a JPEG of the actual WebGL canvas along with the documents. Visual observations are explicitly separate from tool measurements. The model cannot establish clearance or wiring correctness from pixels.
7. Export the full review, attempts, documents, constraints and visual review, or export/reimport the notebook separately. Local browser storage has a visible overflow warning. A reload restores source files, the assembly, constraints and text conversation; unfinished proposals require a new check.

## Local operation

Node 24+, `npm ci`, server-only `GEMINI_API_KEY` and optionally `GEMINI_MODEL=gemini-4-argon`. `npm run dev` runs port 3001. `npm run build` / `npm start` serve the production build on 3001. The original is on port 3000. No deployment was requested for this copy.

Limits are explicit: 12 uploads, 2 MB/file, 40 PDF pages, 150,000 extracted characters/file, 900,000 text characters/notebook, 4 MB per complete design request. A large visual attachment may need a text version. Raw CAD/STEP ingestion is not implemented in this notebook; import GLB geometry using the existing object workflow. KiCad source text aids reasoning; it is not a schematic simulator.

## Verification boundaries

The specific geometry redesign planner uses the documented five-part hardware catalog and keyboard study. General object generation is illustrative, and generic imports do not automatically acquire reliable physical dimensions or a verified design planner. Controller mounting, lead routing, protection, adapter wiring, retained RP2040 integration, firmware, RF and physical testing remain engineering work. Controller modes are catalog specifications; checking them does not configure actual hardware.

Documents are untrusted evidence. Excerpts are checked mechanically, but a matching quote alone does not prove semantic correctness. User review is required for uploaded numeric requirements. No actual maker interviews, saved-time measurements, Argon-versus-small-model evaluation or novel-system benchmark have been fabricated. The included source context uses its actual size, not a padded claim to fill one million tokens.

Core modules: `lib/studio/knowledge.ts`, `lib/studio/redesign-engine.ts`, `app/api/design-sources/route.ts`, `components/studio/SourceNotebook.tsx` and `components/studio/DesignReviewPanel.tsx`. Credentials never enter the browser. Requests have bounded retries, deadlines, cancellation and explicit failures; there is no mock success fallback.
