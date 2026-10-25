/**
 * Import only reviewed, pinned open CAD packages. No bulk repository checkout.
 * Run: node scripts/model-import.mjs
 * Upstream KiCad coordinates are 0.1 inch; output is millimetres, y up.
 * Converted model assets remain CC-BY-SA-4.0 with the KiCad library exception.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { VRMLLoader } from 'three/addons/loaders/VRMLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const commit = 'b8b3cfdfad88ba66f21002b3de51dc6f7d55ba5a';
const repository = 'KiCad/kicad-packages3D';
const output = path.resolve('public/models');
const specs = [
  { id: 'esp32-wroom-32', file: 'RF_Module.3dshapes/ESP32-WROOM-32.wrl', mapsTo: ['esp32-devkit'], note: 'Exact WROOM-32 module CAD on an illustrative DevKit carrier. Carrier PCB and header anchors are procedural, not manufacturing CAD.' },
  { id: 'led-5mm', file: 'LED_THT.3dshapes/LED_D5.0mm.wrl', mapsTo: ['led-red'], note: 'Generic 5 mm two-lead through-hole LED package, not a supplier-specific LED.' },
  { id: 'led-rgb-5mm', file: 'LED_THT.3dshapes/LED_D5.0mm-4_RGB.wrl', mapsTo: ['rgb-led'], note: 'Generic 5 mm four-lead RGB LED package. Common-cathode electrical pin assignments remain defined by the project library.' },
  { id: 'resistor-din0207', file: 'Resistor_THT.3dshapes/R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal.wrl', mapsTo: ['resistor-220', 'resistor-1k', 'resistor-10k'], note: 'Generic DIN0207 axial resistor package. Geometry and illustrative painted bands do not certify resistance or real lead spacing.' },
];

if (typeof globalThis.FileReader === 'undefined') globalThis.FileReader = class {
  result = null;
  onloadend = null;
  onerror = null;
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }, error => this.onerror?.(error)); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.(); }, error => this.onerror?.(error)); }
};

async function download(file) {
  const url = `https://raw.githubusercontent.com/${repository}/${commit}/${file}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not retrieve ${file}: ${response.status}`);
  const body = await response.text();
  if (Buffer.byteLength(body) > 2_000_000) throw new Error(`Refusing oversized asset ${file}`);
  return { body, url };
}

await fs.mkdir(output, { recursive: true });
const license = await download('LICENSE.md');
await fs.writeFile(path.join(output, 'KICAD-LICENSE.md'), license.body);
const manifest = [];
for (const spec of specs) {
  const source = await download(spec.file);
  const object = new VRMLLoader().parse(source.body, '');
  object.scale.setScalar(2.54);
  object.rotation.x = -Math.PI / 2;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -box.min.y, -center.z);
  object.updateMatrixWorld(true);
  object.traverse(child => {
    if (!child.isMesh) return;
    child.castShadow = true; child.receiveShadow = true;
    const convert = material => {
      const next = new THREE.MeshStandardMaterial({ color: material.color, opacity: material.opacity, transparent: material.transparent, side: material.side, roughness: .44, metalness: /PIN|MET/i.test(material.name) ? .6 : .1 });
      next.name = material.name;
      return next;
    };
    child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material);
  });
  // VRML exports often split every pad into a mesh. Merge identical materials
  // without decimation: the source triangle positions remain unchanged.
  const grouped = new Map();
  object.traverse(child => {
    if (!child.isMesh) return;
    if (Array.isArray(child.material)) throw Error('Review multi-material source before importing');
    const material = child.material;
    const key = `${material.color.getHexString()}:${material.opacity}:${material.side}:${material.metalness}:${material.roughness}`;
    if (!grouped.has(key)) grouped.set(key, { material, geometries: [] });
    let geometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
    if (geometry.index) geometry = geometry.toNonIndexed();
    Object.keys(geometry.attributes).forEach(name => { if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name); });
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    grouped.get(key).geometries.push(geometry);
  });
  const optimized = new THREE.Group();
  optimized.name = spec.id;
  for (const { material, geometries } of grouped.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    optimized.add(mesh);
  }
  const glb = await new GLTFExporter().parseAsync(optimized, { binary: true, onlyVisible: true });
  const target = `${spec.id}.glb`;
  await fs.writeFile(path.join(output, target), Buffer.from(glb));
  const bounds = new THREE.Box3().setFromObject(optimized).getSize(new THREE.Vector3()).toArray();
  manifest.push({ ...spec, url: `/models/${target}`, source: `https://github.com/${repository}/blob/${commit}/${spec.file}`, rawSource: source.url, commit,
    sourceSha256: createHash('sha256').update(source.body).digest('hex'), glbSha256: createHash('sha256').update(Buffer.from(glb)).digest('hex'),
    bytes: glb.byteLength, meshes: optimized.children.length, dimensionsMm: bounds, license: 'CC-BY-SA-4.0 with KiCad library exception', attribution: 'KiCad library contributors', modifications: 'Converted VRML to GLB; units converted from 0.1 inch to mm; rotated z-up to y-up; origin centered at base; material shaders converted to standard PBR; identical-material geometries merged without decimation.' });
  console.log(`${target}: ${glb.byteLength} bytes, dimensions ${bounds.map(v => v.toFixed(2)).join(' × ')} mm`);
}
await fs.writeFile(path.join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await fs.writeFile(path.join(output, 'ATTRIBUTION.md'), `# Imported hardware CAD\n\nThese four model assets are adapted from the official [KiCad package library](https://github.com/${repository}/tree/${commit}), pinned to commit ${commit}. Copyright KiCad library contributors. Distributed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) with the KiCad exception; see KICAD-LICENSE.md.\n\nThe application source has its own license; these model assets retain their upstream license. Model alterations: format conversion, coordinate rotation/unit conversion, origin adjustment, PBR material conversion, and same-material geometry merging without triangle decimation.\n\n${manifest.map(item => `- **${item.id}**: [original source](${item.source}). ${item.note}`).join('\n')}\n\nAll pin anchors and project assemblies remain schematic. Model appearance is not a manufacturing fit or electrical compatibility guarantee. Each source URL and SHA-256 is recorded in manifest.json. Rebuild with node scripts/model-import.mjs.\n`);
