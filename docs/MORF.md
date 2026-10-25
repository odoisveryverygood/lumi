# Morf — local identity and mechanical companion

October 25, 2026. Local branch `codex/morf-companion`, based on merged revision `3f26257`. Prepared and verified locally, then published to GitHub at the owner’s request. No deployment was performed for this change.

Morf replaces the Lumi name throughout the live interface, metadata, assistant labels, circuit editor, PDF/export labels and current model identity prompts. The wordmark, favicon and gallery copy now match the product's understand → modify → verify direction. Historical evidence and upstream source attribution retain their original names.

The companion is a code-rendered mechanical cube: six ivory ceramic plates, a graphite chassis, vents, fasteners and an amber optic. CSS transforms articulate the panels without adding a model download, canvas or render loop. Its forms follow application activity:

- Idle: subtle hovering and occasional top-panel movement.
- Thinking: separated panels, shifting orientation and rotating optic detail.
- Scanning: an unfolding magnifier and scan line while rendering, measuring or reviewing.
- Pointing: a deployed probe and a leader line toward the selected component.
- Explaining: the top panel opens and small supports deploy.
- Response received: a brief assembly gesture. This is a conversational acknowledgement, not an engineering pass claim.
- Error: a warm warning optic and tilted pose.

Dragging, keyboard positioning, click-to-talk, automatic part guidance, chat, cancel and voice controls remain available. The old persisted position key and review-draft key remain stable; no project migration is required. The evaluation export's `lumi-design-evaluation` format identifier also stays unchanged for existing analysis scripts. Reduced-motion styling disables the decorative animation, and automatic travel respects the preference.

## Verification

- Full regression suite: 382 passed, 7 opt-in provider/evidence tests skipped. Production build and its TypeScript checks passed.
- Rebuilt browser title, header, home, conversation, parts library and review use Morf. The old yellow character markup is absent; the replacement has six panel elements.
- Actual pointer drag moved the companion from x≈1012/y≈549 to x≈862/y≈376 without opening chat. A keyboard nudge moved it another 12 px; reload restored x≈874/y≈376.
- Selecting the drive motor automatically guided the character to it and deployed the pointer form.
- A real Argon conversation completed through the companion with the requested part explanation and highlights. The post-conversation exported document exactly matched the previously accepted fan and its review. See [preservation check](morf/evidence/geometry-preservation.txt).
- A real local motion measurement entered the scanning form. It remained explicitly labeled local measurement, with draft acceptance disabled. Discard restored the saved provider-reviewed report. No new provider repair was claimed for this UI change.
- Added an Espressif module from the library, observed 12 components and its source attribution, then undid the addition to restore 11 components. The explaining form was observed after the acknowledgement.
- Desktop visual inspection completed. Voice synthesis, microphone permissions and phone-sized interaction were not exercised in this run.

The model/API and geometry contracts are preserved. Existing validated evidence is still readable. No credentials are embedded in the character or client bundle.

Screenshots: [companion](morf/evidence/companion.png), [home](morf/evidence/home.png).
