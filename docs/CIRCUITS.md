# Circuits follows the Studio object

October 25, 2026, local branch `circuits-studio-sync`. Not deployed.

The Circuits tab (`/circuits`) no longer opens its own example. It reads the object that is open in Studio, derives that object's electronics, wiring and build guide, and writes any Circuits-side edits back onto the same saved object. Pocket Forecast and the other examples are still available from **New design**, which switches Circuits into a standalone project until you choose **Back to the Studio object**.

## One project, one history

- Both tabs use the Studio saved record (`partexplode-studio-v1`). Studio keeps saving as before; Circuits reads it on load and whenever another tab changes it.
- Undo and redo share one persisted history (`morf-history-v1`, twelve entries). Studio records every committed change into it and mirrors its own undo/redo; Circuits undoes and redoes straight from it. Imported GLB scenes are excluded because their binary asset lives in IndexedDB.
- Circuits edits are mapped back onto the object: moving a part updates its Studio position (mounted children follow), renaming a part renames it in Studio, removing a part removes it and its references, and a part added by Gemini in Circuits becomes a boxed Studio part tagged with its Circuits library entry. Wire edits and firmware edits are stored on the document as `circuit`, so the derived wiring stays stable across tabs. The module is `lib/studio/shared-project.ts`; the mapping is `applyProjectToDocument` in `components/useLinkedEditor.ts`.

## How the circuit is derived

`lib/studio/circuit-derive.ts`, pure and deterministic, so the base circuit exists without a provider key:

1. **Classify** each Studio part by its name first (descriptions only break ties, because they mention neighbours). Sourced Espressif modules map by catalog reference. Roles: controller, driver (PWM/motor controller board), motor, servo, display, knob, button, LED, power input, battery, supply, sensors (I²C, analog, digital). Parts added from the Circuits library carry an explicit `Circuits library` spec and map directly.
2. **Map** each role to a catalog part with real pins. New catalog entries: a two-wire DC motor, a PWM motor speed controller module, a USB-C power input, a 3.3 V regulator, the bare ESP32-C3-MINI-1, and a pin-less "mechanical part" so the bill of materials covers the whole object. Mechanical parts keep their Studio size and finish in the 3D view.
3. **Wire** by rule: a power source (added as USB-C when the object has none) feeds the controller and driver; the controller's 3V3/5V rails feed peripherals by their voltage range; I²C parts share SDA/SCL; PWM outputs drive the motor driver and servos; knobs, buttons and analog sensors take allocated input pins; LEDs get an added 220 Ω resistor; DHT sensors get an added 10 kΩ pull-up; a bare 3.3 V module gets an added regulator. Pins are allocated once each from the catalog pin list, skipping input-only pins for outputs. Added parts are labelled "added".
4. **Guide**: mechanical steps from the Studio object first (grouped to fit the twelve-step schema), then placing the controller and power input, the remaining electrical parts, ground, power rails, data bus, drive signals, input signals, a wiring check with nothing plugged in, connecting power last, then upload and test. Every step has a "check before moving on" line; wiring steps list each wire as part + pin → part + pin, colour and what it carries.
5. **Firmware** is generated for the actual controller and the allocated pins (ESP32 `ledc` PWM at 25 kHz, `analogRead` for knobs, `INPUT_PULLUP` buttons, I²C scan, DHT readings). An object with no programmable controller gets a sketch that says so.
6. **Unknown electronics** (a motherboard, a camera, a PCB with no catalog match) are listed under "Needs pin info" and left out of the wiring and the checks. Nothing is guessed.

Gemini keeps its existing role: **Make a change** and the library's **Add** run the same `/api/project` edit on the derived project, and the result is mapped back onto the object. Questions go to `/api/ask` when the derived project passes the circuit validator, otherwise to the Studio object conversation with the derived wiring as context.

## Checks, honestly

The status bar reports only what `circuitChecks` actually runs: every pin used exists; no net joins a supply pin to a ground pin; supply voltages are within each part's range and no higher-voltage signal drives a lower-voltage pin; no non-bus signal pin carries two wires; and the catalog current estimate is within the power source's rating. Each is shown as passed, failed or not checked, and the panel ends with: "Checks cover pin, voltage and connection rules only. Real wiring, loads and firmware still need testing." The existing full project validator still gates Gemini edits and sharing.

## Links between the tabs

A Circuits part offers **Show in Studio** (`/?part=<id>`), which opens Studio with the part selected and isolated. A Studio part card offers **Show wiring** (`/circuits?wire=<id>`), which opens Circuits with that part selected and its first wire highlighted. The empty state's button opens Studio's Parts library (`/?library=electronics`).

## Look

`app/morf-circuits.css` restyles `.editor-app` with the Studio values from `morf.css`: cream canvas, peach header with the same wordmark and navigation (Circuits active), warm panels and cards, the same pills, explode slider, prompt bar, quiet footer line and light modals, and Morf in the corner. Morf explains the active wiring step and the check results, and points at the active wire in build mode.

## Verified and not verified

- Tests: `tests/circuit-derive.test.ts` (classification, pin-valid wiring, guide order, validator pass with a controller, firmware pins, honest checks, overlay merging, empty object) and `tests/shared-project.test.ts` (shared record, write-back, cross-tab undo/redo, history bound, overlay).
- Browser: Studio → Circuits with the adjustable fan, light theme side by side, build mode, Morf. See the session notes.
- Not run: live Gemini edits from Circuits (no key here), the compile service, a physical build. The derived wiring is a software plan from catalog pins, not a tested circuit.
