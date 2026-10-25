# Morf — local identity and mechanical companion

The mechanical cube companion is restored locally. No deployment or push was performed for this integration repair.

Morf replaces the Lumi name throughout the live interface, metadata, assistant labels, circuit editor, PDF/export labels and current model identity prompts. The wordmark, favicon and gallery copy now match the product's understand → modify → verify direction. Historical evidence and upstream source attribution retain their original names.

The companion is an articulated mechanical cube with ivory panels, a graphite chassis and an amber optic. Its panels unfold for thinking, scanning, pointing and explanation. It stays draggable, supports keyboard positioning, and guides the selected part or active wire. The same companion and interaction style are used in Studio and Circuits.

Dragging, keyboard positioning, click-to-talk, automatic part guidance, chat, cancel and voice controls remain available. The old persisted position key and review-draft key remain stable; no project migration is required. The evaluation export's `lumi-design-evaluation` format identifier also stays unchanged for existing analysis scripts. Reduced-motion styling disables the decorative animation, and automatic travel respects the preference.

## Verification

- Full regression suite: 382 passed, 7 opt-in provider/evidence tests skipped. Production build and its TypeScript checks passed.
- Rebuilt browser title, header, home, conversation, parts library and review use Morf. The old yellow character markup is absent; the replacement has six panel elements.
- Actual pointer drag moved the companion from x≈1012/y≈549 to x≈862/y≈376 without opening chat. A keyboard nudge moved it another 12 px; reload restored x≈874/y≈376.
- Selecting the drive motor automatically guided the character to it and deployed the pointer form.
- A real Argon conversation completed through the companion with the requested part explanation and highlights. The post-conversation exported document exactly matched the previously accepted fan and its review. See preservation check (development transcript omitted).
- A real local motion measurement entered the scanning form. It remained explicitly labeled local measurement, with draft acceptance disabled. Discard restored the saved provider-reviewed report. No new provider repair was claimed for this UI change.
- Added an Espressif module from the library, observed 12 components and its source attribution, then undid the addition to restore 11 components. The explaining form was observed after the acknowledgement.
- Desktop visual inspection completed. Voice synthesis, microphone permissions and phone-sized interaction were not exercised in this run.

The model/API and geometry contracts are preserved. Existing validated evidence is still readable. No credentials are embedded in the character or client bundle.

Screenshots: [companion](morf/evidence/companion.png), [home](morf/evidence/home.png).

## Navigation cleanup

The main navigation is now Explore, Studio and Circuits. Studio contains Inspect, Ask Morf, Sources and Review. Review and assembly export/share controls stay out of the Explore header. The home library card reads “Start with real parts” and distinguishes sourced CAD from 3D reference models.

The existing constraint-aware design conversation and source notebook remain accessible inside Studio for supported studies. Other objects keep their ordinary assistant and can inspect their assembly provenance and component references. Circuits remains a separate electronics workbench, with navigation back to the saved 3D assembly; no automatic circuit/assembly synchronization is claimed.

Verified locally: Explore/Studio state and URLs, Circuits round trip, general object assistant and source details, and the Corne design conversation with all six notebook references. 382 regression tests and the production build pass. No provider operation was needed for these navigation checks.
