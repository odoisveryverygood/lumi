# Anatomy code reuse

`iso-kit.ts` is copied verbatim from `wheresryan22/anatomy`, commit
`1482e8469b0a9e0d8cc18ea2740a01423d29ae80`, `kit/iso-kit.ts`.
Source: https://github.com/wheresryan22/anatomy

The original MIT license is retained in `LICENSE`.

PartExplode uses the kit's real orthographic projection, extrusion, bevel,
cylinder, path, face-plane text and fit helpers to draw separate editable
hardware assemblies. `components/anatomy/HardwareArt.tsx` adapts the upstream
MIT `kit/react/draw.tsx` solid rendering structure. Electronics geometry,
project binding, selection, transforms, build poses, and wire anchors are
PartExplode application code.

Dimensions and pin anchors come from PartExplode's component library. Generic
module illustrations and schematic pin anchors are not manufacturing CAD or
proof of physical compatibility.
