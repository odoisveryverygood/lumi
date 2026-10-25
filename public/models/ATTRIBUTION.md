# Imported hardware CAD

These four model assets are adapted from the official [KiCad package library](https://github.com/KiCad/kicad-packages3D/tree/b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a), pinned to commit b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a. Copyright KiCad library contributors. Distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) with the KiCad exception; see KICAD-LICENSE.md.

The application source has its own license; these model assets retain their upstream license. Model alterations: format conversion, coordinate rotation/unit conversion, origin adjustment, PBR material conversion, and same-material geometry merging without triangle decimation.

- **esp32-wroom-32**: [original source](https://github.com/KiCad/kicad-packages3D/blob/b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a/RF_Module.3dshapes/ESP32-WROOM-32.wrl). Exact WROOM-32 module CAD on an illustrative DevKit carrier. Carrier PCB and header anchors are procedural, not manufacturing CAD.
- **led-5mm**: [original source](https://github.com/KiCad/kicad-packages3D/blob/b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a/LED_THT.3dshapes/LED_D5.0mm.wrl). Generic 5 mm two-lead through-hole LED package, not a supplier-specific LED.
- **led-rgb-5mm**: [original source](https://github.com/KiCad/kicad-packages3D/blob/b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a/LED_THT.3dshapes/LED_D5.0mm-4_RGB.wrl). Generic 5 mm four-lead RGB LED package. Common-cathode electrical pin assignments remain defined by the project library.
- **resistor-din0207**: [original source](https://github.com/KiCad/kicad-packages3D/blob/b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a/Resistor_THT.3dshapes/R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal.wrl). Generic DIN0207 axial resistor package. Geometry and illustrative painted bands do not certify resistance or real lead spacing.

All pin anchors and project assemblies remain schematic. Model appearance is not a manufacturing fit or electrical compatibility guarantee. Each source URL and SHA-256 is recorded in manifest.json. Rebuild with node scripts/model-import.mjs.
