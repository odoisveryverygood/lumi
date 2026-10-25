# Lumi — grounded design studio

Team handoffs: [Teammate 1 — generation reliability](docs/team/README_TEAMMATE_1.md) · [Teammate 2 — movement verification](docs/team/README_TEAMMATE_2.md) · [Teammate 3 — independent evidence and demo](docs/team/README_TEAMMATE_3.md). Create a feature branch from `main` and open a PR for changes.

> **October 25 team integration:** generation recovery and streaming improvements, explicit sampled-motion verification, and independent evaluation/evidence are combined. See [integration checks and remaining limits](docs/TEAM_INTEGRATION.md). Open `/?example=motion-fan` for the labeled fan study. Earlier dated notes below describe their original snapshots; they are not current deployment or universal reliability claims.

> **Lumi measured edits (October 24, local only):** 320 regression tests, TypeScript and the production build pass. Fixed request-derived checks cover supported enclosure fit, separation, access, actual dimensions and preserved parts. Visual approval cannot override a failed or unknown required measurement. Review shows original, first-attempt and retained values with locked comparison cameras; exported projects retain the baseline and evidence. [Usage and limits](docs/MEASURED_EDITS.md) · [Repeated live evaluation](docs/sponsor-sprint/2026-10-24-design-checks/verification-report.md) · [Prepared maker study, not yet run](docs/MAKER_STUDY.md).

> **Lumi quality update (October 24, local only):** actual three-view rendering, Gemini 4 Argon review, scoped corrections and another render/review before acceptance. Includes parent-following mounts, saved before/after evidence, protected drafts and atomic undo. 275 tests, TypeScript and the production build pass; a real module-placement repair and fresh fan generation were exercised live. [Usage, evidence and limits](docs/QUALITY.md).

> **Lumi parts library update (October 23):** 14 sourced CAD components from Espressif, NopSCADlib and BOSL2; 2,407 searchable CC0 Smithsonian object references via Objaverse-XL. Includes direct placement, undo/redo, source/license preservation, local Draco decoding and Gemini catalog selection. [Usage and verified limits](docs/CATALOG.md). Local only.

> **Lumi local UI revision:** a yellow animated guide, pastel-orange interface, self-hosted robotic typography, and a small-to-exploded opening with slow orbit. All existing object and grounded-design workflows remain available. Previous Flare source is archived before this revision. See [Lumi details](docs/LUMI.md). Not deployed.

> **October 23 local update:** custom generation now streams real validated parts into a temporary 3D preview, uses compact geometry, and supports measured Gemini 4 Argon Priority inference. 222 tests, TypeScript and the production build pass; live generation, direct 3D selection, manual editing and exact-document undo are verified in the [dated packet](docs/sponsor-sprint/2026-10-23-priority/verification-report.md). This update is **not deployed**. See [performance and configuration](docs/PERFORMANCE.md).

This is an independent copy of Flare based on `510216d9aed26f9c1078740a0dadd9e2d779b85b`. The preserved app is the sibling `part-explode` directory. This variant runs locally on **127.0.0.1:3001** and is deployed separately at **https://flare-grounded.vercel.app**. See [deployment verification](docs/DEPLOYMENT.md).

Start with **Open the design study**. Bring a datasheet, BOM, guide or schematic; ask for a wireless conversion; inspect source-backed numeric conflicts before applying a proposal. See [the grounded design workflow](docs/GROUNDED_DESIGN.md) and [the three-minute demo](docs/THREE_MINUTE_DEMO.md).


A conversational anatomy studio for physical objects. Ask a question and the answer acts on the 3D assembly; describe an edit and the geometry, relationships and explanation update together. The main workspace opens a detailed compact desktop computer. The circuit workbench remains available at `/circuits` for validated pin-level wiring and Arduino firmware.

## Device studio

- A light orthographic viewport renders a detailed desktop assembly with independently editable fan frames and rotors. Layered explosion, leader lines, actual geometry thumbnails, selectable callouts, top/front views and orbit/zoom use the same document.
- Click a component to inspect its role and connections, edit its name/color/position/rotation, move it with a gizmo, hide it, or isolate it. Undo/redo preserves component geometry. The inspector resizes the viewport at desktop/tablet widths.
- Eight desktop assembly steps support forward/back navigation, keyboard arrows and autoplay. This is an educational concept assembly, not manufacturer CAD or a guaranteed compatible retail parts list.
- Mechanical keyboard opens a detailed 65% reference with individually named keycaps, case, plate, PCB, controller, stabilizers and a dissectable switch. Keycap legends are rendered on the actual geometry. “See it work” animates the key, stem, contact leaf and compressing spring with pause, scrubbing, stage selection and replay. Housings become transparent while explaining the mechanism.
- The assembly tree represents object → subassemblies → parts. Mechanical, electrical, data and containment relationships are checked and shown in the inspector. Selecting a relationship highlights its endpoints and focuses the scene.
- A single conversation accepts questions and explicit edits. Gemini returns bounded scene commands: focus, highlight, isolate, explode, change view and animate. Answers include buttons to replay their scene actions and contextual follow-up prompts. Bounded recent conversation accompanies each request; local conversation text saves with the object.
- “Make this wireless” on the keyboard invokes a validated conversion that adds a battery, wireless controller, charging/power board and harness, and updates the relationships and assembly explanation together. Repeating the conversion does not duplicate parts. This is an educational integration proposal; physical fit, protected power design, firmware and RF operation are not verified.
- Other edits use atomic multi-component transactions. Unchanged geometry and identities are preserved; deletion prunes references, invalid changes are rejected, and one undo restores the whole change. Assembly and containment cycles, invalid motion tracks and unknown action targets are rejected.
- New device sends arbitrary hardware descriptions to premium Gemini. It returns separate procedural parts and educational assembly steps, with validated geometry and references. Known mechanical keyboards can use the explicitly identified curated template; other objects receive generated geometry. Generated studies can include assemblies, relationships and bounded mechanism motion. Edits use small transactions so unaffected components and detailed geometry remain intact. Failed requests preserve the current assembly; there is no disguised example fallback in this endpoint.
- Import embedded glTF 2.0 `.glb` assemblies up to25MB,2,000 logical parts and one million triangles. Original mesh geometry/materials are preserved; multi-material regions stay together as one component. Meshopt decoding uses the bundled local decoder. External resources, Draco and Basis-compressed textures are rejected with a specific message. Static snapshots are normalized to220mm display extent; this does not establish physical measurements.
- New device → Real KiCad board opens the original Stack Chan board GLB rendered by Etch, with32 modeled physical components and8 board layers, original KiCad references/values/footprints, and source attribution. One upstream switch model is absent and is documented.
- Open `/?example=keyboard` for a fresh keyboard reference; subsequent edits save normally. Imported models save in local IndexedDB; edited metadata saves in localStorage. Export a single `.part.json` project including its embedded GLB for reliable file sharing/reimport. CSV lists components and sources; Print saves the assembly guide as a PDF. URL share links contain an independent editable copy of procedural assemblies and require the app to be running at the destination.
- Contextual explanations and transactional edits use the live premium Gemini model shown in the UI. Voice uses browser speech recognition where supported. Generated device studies are approximate illustrations, not verified internal CAD, electrical schematics, functioning hardware, or repair certification.

The device studio uses `components/studio/` and `lib/studio/`, backed by `/api/device`. Device documents are separate from electrical projects so importing a camera, machine or PC does not require fictitious Arduino pins or firmware.

## Run

Use Node.js 24+ (the PDF extraction runtime requires modern Iterator helpers). Run `npm ci`, set `GEMINI_API_KEY` in `.env.local`, then run `npm run dev`. Open http://127.0.0.1:3001. The configured local key is ignored by Git and never sent to the browser. Rotate a key that has been pasted into chat before distributing this app.

`npm run build` creates the production build; `npm start` serves it on the same address. The app uses ordinary Next.js. It has no Sites integration.

## Circuit workbench (`/circuits`)

- Click any component directly in the canvas, or select it in the Explorer. The Inspector edits its reference, purpose, position in millimetres, rotation in degrees, and accent color. Edits save locally; undo/redo includes geometry and appearance.
- Move and Rotate activate real transform gizmos in 3D. In Illustration, drag a part to move it on the work plane or rotate it. `V`, `G`, `R`, and `F` select, move, rotate and fit; `⌘Z`/`⌘⇧Z` undo and redo.
- 3D, Illustration, Top and Flat use the same project data. Orbit/pan/zoom, view cube, enclosure cutaway, wire visibility, selection outlines, dimensions, hover context and explode slider are interactive. The 3D exploded view includes dashed assembly guides and signal-flow markers.
- The Wires explorer and pin table open an editable connection inspector. Change exact endpoints, type, color and purpose, add a wire, or remove a wire. Incomplete circuits remain editable drafts and show their validation issues. Manual wiring edits display a reminder to reconcile the firmware with the Assistant.
- Choose a replacement component in the Inspector or a new component in the searchable 36-part library. Gemini updates the parts, wiring, firmware and assembly plan together; valid results replace the project atomically. Failed edits preserve the current design.
- Build Mode animates components and wires through the saved assembly order, with instructions, checks, tips, step navigation, autoplay, Back, and an explicit Exit build control. Arrow keys advance and reverse steps. Ask about a step or open firmware at the upload step.
- Ask contextual questions or describe changes in the Assistant. Browser Web Speech input supports voice and hold-Space-to-talk where Chrome/Edge expose speech recognition. Unsupported browsers show a clear message; voice has not been microphone-tested in the in-app browser.
- New Design accepts an original brief and skill level. Four complete examples remain clearly labeled examples. The circuit example is a temperature/humidity monitor; its separate local saved drafts reopen automatically.
- Stats report component counts, cost estimates, difficulty, build time and the sum of catalog current ratings. Values are project estimates, not live measurements.
- Export an editable JSON envelope including colors, complete `.ino` source, CSV bill of materials with buy links, and PDF assembly instructions. JSON import accepts a project or the envelope. Read-only share links encode the validated project in the URL fragment. A localhost link works on the serving computer; JSON can be sent as a file.

## Source reuse

This rebuild directly uses code from both user-supplied repositories. Anatomy provides the exact MIT isometric projection/solid toolkit and adapted SVG rendering structure. Etch provides adapted picking, material conversion, instance fading, selection projection and outline logic, nine local GLB models, and the editor token/control hierarchy. Exact commits, files, permissions, license and model provenance are recorded in [THIRD_PARTY.md](THIRD_PARTY.md), `vendor/anatomy/`, `public/etch-parts/`, and `public/models/`.

The complete Etch KiCad/PCB fabrication backend is a separate product and is not installed here. The circuit workbench generates low-voltage hardware projects from its documented component catalog; it does not manufacture or export certified PCB routing.

## Gemini and validation

The server discovers supported premium models and prefers `gemini-4-argon`, then available Gemini Pro alternatives. It does not automatically fall back to Flash. `GEMINI_MODEL` can pin an advertised model. Circuit project generation uses actual Gemini SSE deltas for progress. Whole-device geometry generation has a 240-second per-attempt provider bound; smaller questions and scoped edits keep the 90-second default. The object API bounds the entire request, including repairs, to 270 seconds under Vercel’s 300-second function limit. The UI receives streamed progress and heartbeats, shows elapsed time, and supports cancellation; incomplete results never replace the current assembly. Long conceptual generations can take several minutes and can fail; no substitute is silently loaded.

Every generated or edited circuit result passes Zod structure and deterministic circuit checks: catalog and pin existence, quantities, supply/ground, rail and logic voltage, input-only pins, I²C mapping, duplicate connections, source conflicts, step coverage and build sequence. The model receives at most two repair attempts. Editable input drafts can contain electrical errors; unknown components, pins and malformed references are rejected before provider calls. New generation failures may return an explicitly labeled curated example. Failed edits never replace the project with a fallback. Offline Q&A is labeled project data.

## Firmware compilation

The Firmware editor supports direct source edits, copy, download and real local Arduino CLI compilation. The API uses installed board cores and libraries; it never installs toolchains, uploads firmware or executes the sketch. Nano, Uno, ESP32 and Pico can compile when their respective cores are installed. Current local installation includes AVR 1.8.8 and ESP32 2.0.17, plus libraries required by the supplied examples. Pico compilation requires its core to be installed separately.

The compile endpoint only accepts same-origin loopback requests. It validates input, uses fixed targets and argument arrays without a shell, strips provider credentials from child processes, bounds execution/output/concurrency, and removes its temporary compilation files. On a public host, this endpoint intentionally cannot invoke a visitor's local toolchain. The hosted firmware editor offers a working “Download for Arduino IDE” action and explains the required board package/libraries; it does not present an unavailable cloud compiler as a working action.

## Verification and limits

Run `npm test`, `npm run typecheck`, and `npm run build`. The opt-in live provider integration test is `RUN_LIVE_GEMINI=1 node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/live-api.test.ts` and makes billable requests.

Object conversation verification used live Gemini 4 Argon in the production browser: plain-language keyboard selection, keypress explanations with scene animation, wireless conversion with atomic undo/redo, a two-key color edit, saved conversation/action restoration and narrow layout checks. A separate live request generated a10-part pencil sharpener with82 solids, semantic groups and a crank mechanism; that exported project reopened and its contextual animation played in the same viewer. The deployment source has 154 passing tests and one skipped opt-in provider test, including hosted progress streaming, interrupted responses, cancellation and compiler capability reporting.

Browser checks for this rebuild include direct 3D and SVG selection, property edits, movement, undo, real pin editing, Gemini reconciliation of GPIO27 to GPIO26, contextual Q&A about that change, successful compilation of the exact revised ESP32 sketch, and all ten assembly steps. A separate live Gemini edit replaced ESP32/OLED with a classic Nano, 5 V DHT22 and compatible LCD; that exact generated sketch also compiled for the Nano. Regression tests reject unsafe logic conversion through series resistors and mismatched DHT pull-up rails. Additional saved evidence and screenshots accompany the delivered source.

Models use a combination of imported exact component footprints and detailed procedural module geometry. Generic module anchors and illustrations are schematic. Cases are illustrative and do not define printable hole patterns or verified mechanical clearances. No physical hardware is connected. Compilation and circuit validation do not establish sensor accuracy, physical fit or operation of a real assembly. Displays explicitly show preview/offline status and never present invented values as live telemetry.

## Circuit code structure

`components/useEditor.ts` owns provider requests, persistence and project history; `Workbench.tsx` composes the editor; `EditorPanels.tsx` provides inspectors, chat and assembly instructions. `Scene.tsx`/`PartModel.tsx` render 3D. `AnatomyView.tsx`, `components/anatomy/`, `lib/anatomy/`, and the vendored toolkit render illustrations. `lib/editor.ts` owns immutable manual edits, and `lib/validation.ts` owns project/circuit checks. `lib/ai.ts` is only imported by server code. `lib/compile.ts` handles the local compiler.

## Vercel deployment

Deploy this directory as a Next.js project with Node.js 24 and Fluid compute. Set the server-only `GEMINI_API_KEY` as a sensitive production environment variable and `GEMINI_MODEL=gemini-4-argon`. Never prefix the key with `NEXT_PUBLIC_`. The production environment is public; preview deployments keep Vercel authentication. `.vercelignore` excludes local environment files, dependencies, build output and scratch files.

Use `vercel deploy --prod --skip-domain` to stage, verify that exact deployment, then `vercel promote <deployment-url>` to publish. Browser saves stay on the visitor’s device. Export/import and project share links work across the hosted origin; local drafts are not automatically transferred from localhost. Real component assets and the Meshopt decoder are bundled locally. Arduino compilation remains local; hosted users download the complete sketch for Arduino IDE.

## Solar flare interface

The current local revision renames the interface to Flare and adds the Solar flare design system in `app/flare.css`: graphite panels, an ivory canvas, ember/rose/lilac primary actions, matching selection and mechanism controls, and dark creation/export dialogs. The circuit workspace uses the same palette. Original component materials remain unchanged. Existing PartExplode storage keys and file schemas remain compatible so browser drafts and exported projects keep opening. The generated logo concept has not been installed.

This redesign is prepared and tested locally. It has not been deployed; the existing Vercel deployment remains the prior release. Run `npm run build` and `npm start` to review the production build locally.

## Object-first workspace

The Explore view shares the live 3D renderer with the studio. First-time visitors see a gallery with rendered reference previews, a generation prompt, and direct entry into the keyboard's press/release explanation. Returning visitors keep their saved assembly. Explore remains available in the header.

The studio gives the object the full canvas. Parts live in a collapsible drawer; selecting geometry or a list entry opens a floating component card with Explain, Isolate, Focus, and Edit actions. Exact transforms, colors, specifications, and relationships remain in an optional inspector. The camera accounts for open drawers, cards, the conversation dock, and phone layouts. Mechanisms keep their own stage controls, and reduced-motion preferences stop camera interpolation.

This revision remains local and has not been deployed. Original file formats, storage keys, server-only Gemini configuration, and circuit workbench behavior remain compatible.

## Conversation in the object (local revision)

Open **Design Lab → source keyboard**, or load `/?example=corne` for a fresh Corne reference. The main canvas holds the conversation, the object and its measured witness. Evidence is an optional drawer. Other objects keep the general generation, import, part editing and assistant workflows.

- Ask **“Show how a key works.”** Argon chooses the existing key mechanism and the scene isolates and animates its illustrated internals.
- Ask **“Make it wireless, keep the case and USB charging.”** Argon chooses documented component envelopes and placement. The server checks each candidate and streams it into the canvas; measured failures go back to Argon for up to three revisions. Apply is enabled only for a final passing candidate.
- Add **“Keep the acoustic insert.”** The optional study insert reduces the modeled gap below the hot-swap sockets. The red overlap regions and dimension witness show the conflict. Questions such as **“Why does that not fit?”** use measured checks and scene actions without editing geometry.
- Ask **“Allow removing the acoustic insert. Keep the other constraints.”** to let Argon revise the layout. Compare Before/Proposed and earlier revisions, apply the proposal, or undo it. Constraints and the conversation are saved locally; unfinished proposals are not restored after a reload.
- **Show evidence** opens checks, source links and reconstruction disclosures. Export includes the original baseline, submitted input, current assembly, proposal, constraints, conversation and revision trace.

### Source geometry and limits

The Corne study uses foostan/crkbd revision `63366fb7f51cf2a796462fdd90527e99dd126055`, attributed under CC BY 4.0 / MIT. The enclosure is tessellated from its original STEP without shape rescaling. Plate contours and 21 switch openings come from published KiCad Edge.Cuts. The plate pattern registers to the source PCB switches with 0.0072 mm RMS error. This number describes pattern registration, not engineering tolerances.

The PCB silhouette is reconstructed from the plate perimeter. Keycaps, switch internals, component bodies, cable and the optional acoustic insert are labeled illustrations. Vertical assembly registration is a study based on the published guide, not a physically verified assembly. The source case has a measured 2 mm floor top in this registration; the lower-case design prism is conservative. Case collision checks use source mesh triangles and containment, rather than filling its entire bounding box. Floor coverage uses nine footprint samples. Other obstacles use conservative enclosing boxes. These checks do not certify manufacturing or physical fit.

Component dimensions link to Adafruit, Seeed and Nice Keyboards. The XIAO Sense envelope was measured from the manufacturer-linked STEP. The thinner nice!nano combines the manufacturer's 3.2 mm height with a **community KiCad drawing** for its 33.52 × 18 mm horizontal envelope, including USB projection. That separate source and its uncertainty are shown in the evidence drawer and report. Visual board details are illustrative; checks still use the complete catalog envelope. No manufacturer CAD is claimed for these component illustrations.

Charging connections are proposed object-graph relationships. Matrix interfaces, retained USB adapter, wiring, leads, swelling, mounting, antenna clearance, firmware and working hardware require engineering verification. No runtime or electrical simulation is claimed.

Source files, licenses, hashes, CAD conversion parameters and the registration method are in `public/assemblies/corne/`. Rebuild the source geometry using:

```bash
# Use the pinned crkbd source checkout and occt-import-js 0.0.23 installed separately.
node scripts/build-corne-reference.mjs /path/to/crkbd /path/to/occt-import-js
```

The converter is a build-time tool; no CAD kernel is shipped to browsers. The app loads the precomputed mesh document lazily. No API credential is included in the source or exported reports.

## Grounded-copy verification

194 tests passed; the older opt-in general provider test remains skipped. The dedicated live checks used `gemini-4-argon`: eight source files, a native five-page PDF and exact page citation, normal conversion, a blocked 500 mA / 4 mm conflict, recovery at 100 mA, actual canvas image review, apply/undo/redo and saved source restoration. Images without a native text layer remain visual evidence and cannot supply fabricated exact quotations or numerical checks. The source keyboard workflow is a design study; physical hardware remains unverified. See `docs/sponsor-sprint/2026-10-23-grounded-design/verification-report.md`.
