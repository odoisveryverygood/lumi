import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {DeviceDocument,DevicePart,Solid,Vec3} from './types';
export type GeometryBank = { shapes: Map<string, THREE.BufferGeometry>; edges: Map<THREE.BufferGeometry, THREE.EdgesGeometry> };
export type PlacedModel = { object: THREE.Group; materials: THREE.Material[]; edges: THREE.LineBasicMaterial; baseColor: string; ownedGeometry: THREE.BufferGeometry[]; textures: THREE.Texture[] };
const radians=(values:Vec3)=>values.map(THREE.MathUtils.degToRad) as Vec3;
/** Same primitive dimensions and minimum radii as shapeFor, including tiny solids. */
export function solidDimensions(solid:Solid){return solid.kind==='cylinder'?new THREE.Vector3(Math.max(.1,solid.size[0],solid.size[2]),Math.max(.05,solid.size[1]),Math.max(.1,solid.size[0],solid.size[2])):solid.kind==='torus'?new THREE.Vector3(2*(Math.max(.1,solid.size[0])+Math.max(.05,solid.size[1])),2*(Math.max(.1,solid.size[0])+Math.max(.05,solid.size[1])),2*Math.max(.05,solid.size[1])):new THREE.Vector3(...solid.size);}
export function solidLocalBounds(solid:Solid){
 const half=solidDimensions(solid).multiplyScalar(.5);
 return new THREE.Box3(half.clone().negate(),half).applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...solid.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...radians(solid.rotation||[0,0,0]))),new THREE.Vector3(1,1,1)));
}
export function localPartBounds(part: DevicePart) {
  const box = new THREE.Box3();
  if(part.mesh){for(let i=0;i<part.mesh.positions.length;i+=3)box.expandByPoint(new THREE.Vector3(...part.mesh.positions.slice(i,i+3) as Vec3));return box;}
  for (const solid of part.solids) box.union(solidLocalBounds(solid));
  if (box.isEmpty()) { const half=new THREE.Vector3(...part.size).multiplyScalar(.5);box.set(half.clone().negate(),half); }
  return box;
}


function shapeFor(solid: Solid, bank: GeometryBank) {
  let key = solid.kind as string;
  if (solid.kind === 'cylinder') key += `:${solid.size.join(':')}`;
  if (solid.kind === 'torus') key += `:${solid.size[0]}:${solid.size[1]}`;
  let geometry = bank.shapes.get(key);
  if (!geometry) {
    if (solid.kind === 'cylinder') geometry = new THREE.CylinderGeometry(Math.max(.05, solid.size[0] / 2), Math.max(.05, solid.size[2] / 2), Math.max(.05, solid.size[1]), 32, 1);
    else if (solid.kind === 'sphere') geometry = new THREE.SphereGeometry(.5, 24, 16);
    else if (solid.kind === 'torus') geometry = new THREE.TorusGeometry(Math.max(.1, solid.size[0]), Math.max(.05, solid.size[1]), 12, 48);
    else geometry = new THREE.BoxGeometry(1, 1, 1);
    bank.shapes.set(key, geometry);
  }
  let edges = bank.edges.get(geometry);
  if (!edges) { edges = new THREE.EdgesGeometry(geometry, 35); bank.edges.set(geometry, edges); }
  return { geometry, edges, unit: solid.kind === 'box' || solid.kind === 'sphere' };
}

/** Owned geometry with precisely the viewport's primitive dimensions and tessellation. */
export function solidGeometry(solid:Solid,bank:GeometryBank){
 const shape=shapeFor(solid,bank);
 return shape.geometry.clone().applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...solid.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...radians(solid.rotation||[0,0,0]))),shape.unit?new THREE.Vector3(...solid.size):new THREE.Vector3(1,1,1)));
}

function ownMaterial(source: THREE.Material, primaryColor: string) {
  const material = source.clone();
  material.userData.baseOpacity = material.opacity;
  material.userData.baseTransparent = material.transparent;
  if ('color' in material && material.color instanceof THREE.Color) {
    material.userData.baseColor = material.color.clone();
    material.userData.mainColor = `#${material.color.getHexString()}`.toLowerCase() === primaryColor.toLowerCase();
  }
  if(material instanceof THREE.MeshStandardMaterial){material.userData.baseEmissive=material.emissive.clone();material.userData.baseEmissiveIntensity=material.emissiveIntensity;}
  return material;
}

export function buildModel(part: DevicePart, bank: GeometryBank, importedScene?: unknown): PlacedModel {
  const object = new THREE.Group(), materials: THREE.Material[] = [], ownedGeometry: THREE.BufferGeometry[] = [], textures: THREE.Texture[]=[];
  let baseColor = part.color;
  const edges = new THREE.LineBasicMaterial({ color: '#273e4a', transparent: true, opacity: .14, depthWrite: false, toneMapped: false });
  const addOutline = (mesh: THREE.Mesh, geometry: THREE.EdgesGeometry) => {
    const outline = new THREE.LineSegments(geometry, edges); outline.raycast = () => {}; outline.renderOrder = 2; mesh.add(outline);
  };
  if(part.mesh){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.mesh.positions,3));geometry.setIndex(part.mesh.indices);geometry.computeVertexNormals();
    if(part.mesh.colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(part.mesh.colors,3));
    const material=new THREE.MeshStandardMaterial({color:part.color,vertexColors:Boolean(part.mesh.colors),metalness:.18,roughness:.48});material.userData.baseOpacity=1;material.userData.baseColor=material.color.clone();material.userData.mainColor=true;
    materials.push(material);ownedGeometry.push(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;
    const outline=new THREE.EdgesGeometry(geometry,40);ownedGeometry.push(outline);addOutline(mesh,outline);object.add(mesh);
  }
  if (part.assetNode && importedScene instanceof THREE.Object3D) {
    const source = importedScene.getObjectByProperty('uuid', part.assetNode) || importedScene.getObjectByName(part.assetNode);
    if (source) {
      // Derive the original finish from the asset, never from the edited/saved
      // document. This is the same first-material rule used by the importer.
      let primary: THREE.Material | undefined;
      source.traverse(child => { if (!primary && child instanceof THREE.Mesh) primary = Array.isArray(child.material) ? child.material[0] : child.material; });
      baseColor = primary && 'color' in primary && primary.color instanceof THREE.Color ? `#${primary.color.getHexString()}` : '#a3a7aa';
      // Importer bakes world transforms into centered, millimetre mesh geometry.
      // The document's part transform is the sole placement transform.
      const copy = source.clone(true); copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0); copy.scale.set(1, 1, 1);
      copy.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.material = Array.isArray(child.material) ? child.material.map(sourceMaterial => { const m = ownMaterial(sourceMaterial, baseColor); materials.push(m); return m; }) : (() => { const m = ownMaterial(child.material, baseColor); materials.push(m); return m; })();
        child.castShadow = true; child.receiveShadow = true;
        if (child.geometry.attributes.position?.count < 60000) {
          let geometry = bank.edges.get(child.geometry);
          if (!geometry) { geometry = new THREE.EdgesGeometry(child.geometry, 35); bank.edges.set(child.geometry, geometry); }
          addOutline(child, geometry);
        }
      });
      object.add(copy);
    }
  }
  if (!object.children.length) {
    const palette = new Map<string, THREE.MeshStandardMaterial>();
    const batches = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
    for (const solid of part.solids) {
      const color = solid.color || part.color, metalness = Math.min(.78, solid.metalness ?? .15), roughness = solid.roughness ?? .46;
      const key = `${color}:${metalness}:${roughness}`;
      let material = palette.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({ color, metalness, roughness });
        material.userData.baseOpacity = 1; material.userData.baseTransparent = false;
        material.userData.baseColor = material.color.clone(); material.userData.mainColor = !solid.color || solid.color.toLowerCase() === part.color.toLowerCase();
        material.userData.baseEmissive=material.emissive.clone();material.userData.baseEmissiveIntensity=material.emissiveIntensity;
        palette.set(key, material); materials.push(material);
      }
      const shape = shapeFor(solid, bank);
      const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...solid.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...radians(solid.rotation || [0,0,0]))), shape.unit ? new THREE.Vector3(...solid.size) : new THREE.Vector3(1,1,1));
      const geometry = shape.geometry.clone().applyMatrix4(matrix);
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material)!.push(geometry);
    }
    // Each merged mesh remains inside its selectable assembly. The editor needs
    // component selection, so hundreds of tiny details need no individual draw.
    for (const [material, geometries] of batches) {
      const geometry = mergeGeometries(geometries, false);
      if (geometry) {
        const outline = new THREE.EdgesGeometry(geometry, 35);
        ownedGeometry.push(geometry, outline);
        const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
        addOutline(mesh, outline); object.add(mesh);
      }
      geometries.forEach(geometry => geometry.dispose());
    }
  }
  if (!object.children.length) {
    const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: .55 });
    material.userData.baseOpacity = 1; material.userData.baseColor = material.color.clone(); material.userData.mainColor = true;
    materials.push(material);
    const shape = shapeFor({ kind: 'box', position: [0,0,0], size: part.size }, bank);
    const mesh = new THREE.Mesh(shape.geometry, material); mesh.scale.set(...part.size); mesh.castShadow = true; mesh.receiveShadow = true; addOutline(mesh, shape.edges); object.add(mesh);
  }
  if(part.id.startsWith('wireless-')&&part.specs['Catalog reference']){const shape=new THREE.BoxGeometry(...part.size),outline=new THREE.EdgesGeometry(shape);shape.dispose();const material=new THREE.LineBasicMaterial({color:'#bc83a8',transparent:true,opacity:.65,depthWrite:false});material.userData.baseOpacity=.65;material.userData.baseTransparent=true;materials.push(material);ownedGeometry.push(outline);const envelope=new THREE.LineSegments(outline,material);envelope.raycast=()=>{};object.add(envelope);}
  const legend=part.specs.Legend?.trim();
  if(legend&&part.solids.length&&typeof document!=='undefined'){
    const roofs=part.solids.filter(solid=>solid.kind==='box'&&solid.size[0]>=5&&solid.size[2]>=5&&!solid.rotation?.some(angle=>Math.abs(angle)>.01)).sort((a,b)=>(b.position[1]+b.size[1]/2)-(a.position[1]+a.size[1]/2));
    const roof=roofs[0];
    if(roof){
      const canvas=document.createElement('canvas');canvas.width=legend.length>3?256:128;canvas.height=128;
      const context=canvas.getContext('2d')!,light=new THREE.Color(part.color).getHSL({h:0,s:0,l:0}).l>.48;
      context.font=`600 ${legend.length>5?48:64}px ui-monospace, SFMono-Regular, monospace`;context.textAlign='center';context.textBaseline='middle';context.fillStyle=light?'#303c44':'#e3eaf0';context.fillText(legend.slice(0,16),canvas.width/2,66,canvas.width-12);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
      const width=Math.min(roof.size[0]*.78,legend.length>3?25:8),height=Math.min(roof.size[2]*.45,5.6),geometry=new THREE.PlaneGeometry(width,height);
      const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,toneMapped:false});material.userData.baseOpacity=1;material.userData.baseTransparent=true;materials.push(material);ownedGeometry.push(geometry);
      const label=new THREE.Mesh(geometry,material);label.position.set(roof.position[0],roof.position[1]+roof.size[1]/2+.055,roof.position[2]);label.rotation.x=-Math.PI/2;label.raycast=()=>{};object.add(label);
    }
  }
  return { object, materials, edges, baseColor, ownedGeometry, textures };
}

/** Same component builder for the editor, review captures and software viewport. */
export function renderAssembly(document:DeviceDocument,importedScene?:unknown,explode=0){
 const bank:GeometryBank={shapes:new Map(),edges:new Map()},root=new THREE.Group(),models:PlacedModel[]=[];
 for(const [index,part] of document.parts.entries()){
  const model=buildModel(part,bank,importedScene);models.push(model);model.object.position.set(...part.position).addScaledVector(new THREE.Vector3(...part.explode),explode);model.object.rotation.set(...radians(part.rotation));model.object.userData.partId=part.id;model.object.userData.partIndex=index;
  model.object.traverse(node=>{node.userData.partId=part.id;node.userData.partIndex=index;if(node instanceof THREE.Mesh){const materials=Array.isArray(node.material)?node.material:[node.material];for(const material of materials)if('color'in material&&material.color instanceof THREE.Color&&material.userData.mainColor)material.color.set(part.color);}});root.add(model.object);
 }
 root.updateMatrixWorld(true);
 return {root,dispose(){for(const m of models){m.materials.forEach(v=>v.dispose());m.edges.dispose();m.ownedGeometry.forEach(v=>v.dispose());m.textures.forEach(v=>v.dispose());}for(const g of bank.shapes.values())g.dispose();for(const g of bank.edges.values())g.dispose();}};
}
