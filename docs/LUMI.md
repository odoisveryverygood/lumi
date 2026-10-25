# Lumi local interface revision

**October 24 simplification (local only):** click Lumi to chat and drag her anywhere. Guiding happens automatically on a new selected part or answer; a deliberate drop holds its position until the next guidance event. The three-dot menu, Guide/Stay/Wander modes and animation toggle have been removed. Idle movement, blinking, curious looks, waves, pickup and landing animations run automatically, as requested. This pet preference does not change the operating-system setting or the 3D scene’s motion preference. Previous saved positions remain compatible; old Stay/Pause settings no longer disable automatic guidance or normal motion. AI requests and responses are unchanged.

October 23, 2026. The existing Flare source was archived before edits at `../../work/lumi-preserved/flare-before-lumi-2026-10-23.tar.gz`. The original sibling app is preserved. This revision is not deployed.

Lumi is the face of the existing object assistant: a code-drawn yellow character with live eyes, blinking, a smile and gentle movement. Clicking it opens a nonmodal conversation using the existing validated object API. In the source keyboard workspace it uses the existing document-aware design conversation and its proposal checks. It does not get a separate model or bypass validation.

The character tracks the screen projection of the actual selected or explained part. Its target follows scene movement and illustrated mechanisms. A dotted pointer connects Lumi to that component. Its explanation uses the actual assistant answer; selection hints use the component name and role already in the document. Movement updates DOM transforms directly rather than rerendering the React workspace every animation frame.

The opening sequence scales the rendered assembly from small to full size, then separates its existing parts using their explode offsets. It begins a slow complete orbit afterwards. No component positions or saved transforms are changed. Manual scene interaction, editing and explanation stop the motion, and an explicit pause/resume control is available. Reduced-motion preferences bypass the entrance and automatic orbit by default. An explicit Play opening action opts into motion for the current session without changing any operating-system setting.

The interface uses self-hosted Oxanium variable typography under its included OFL license. Text is solid color. Peach and pastel-orange headers, drawers, controls and conversational surfaces replace the purple theme. Storage keys and project schemas remain compatible with existing Flare projects.

Microphone and read-aloud controls use browser speech capabilities. Read-aloud is off until explicitly enabled; voice input reports unsupported browsers through the existing UI. No speech API key or new paid service was added. Browser speech quality and microphone permission depend on the browser and operating system.

## Verification

The local browser used real Gemini 4 Argon to select and explain the desktop processor. A second request changed its finish to `#f5a45b`; the real inspector showed that value and Undo restored `#b8c0c0`. The phone-width layout was inspected in a 390 x 844 embedded viewport, including opening and closing the Lumi chat and access to the main navigation. A real request from Lumi in the source-backed Corne workspace explained a keypress and played its existing mechanism. The normal regression suite passes 226 tests, with two opt-in paid tests skipped; TypeScript and the production build pass.

Voice capture and audible playback have not been exercised in this verification. All hardware accuracy and source/CAD limitations from the earlier project remain applicable.

## Previous movable pet controls — October 23 (superseded above)

Lumi can be picked up with mouse, pen, or touch and dropped anywhere within the viewport. A six-pixel drag threshold prevents a drop from opening the conversation. A click still opens the existing Gemini-backed conversation. Pointer cancellation restores the previous spot, and arrow keys move the focused pet (Shift increases the step). Space and Enter retain button activation without starting the workspace microphone shortcut.

The adjacent three-dot control offers Guide, Stay and Wander, plus Boop, Say hi, a pet-motion toggle and Return home. Guide follows real projected component positions; Stay holds the chosen spot; Wander moves gently around its resting spot. Dropping selects Stay. Position is stored as normalized viewport coordinates under `lumi.pet.v1`, validated before restore and clamped after resize. Controls are also clamped on phones. Storage failure leaves placement usable for the session.

The pet has pickup stretch and tilt, landing squash and bounce, happy hops with sparkles, an arm wave, curious tilts and a brief idle nap. It pauses autonomous reactions while the conversation or pet controls are open, while busy, or while the page is hidden. It respects reduced motion; the pet-motion control or choosing Wander explicitly enables pet motion. No new dependencies, image services, credentials or inference calls are used for these reactions. This remains a browser companion within Lumi, with local-only delivery.
