import type * as THREE from 'three';
import { importDeviceGLB } from './import';
import type { DeviceDocument, DevicePart } from './types';
import { validateDeviceDocument } from './validation';

const BASE='/assemblies/stack-chan';
const BOARD_COMMIT='ad876ea36e7ef13f08de2982fe8d15a6ffda5cc7';
const ETCH_COMMIT='c548129ec5ed13f59f76b0a852a5dd03b728825b';
const BOARD_URL=`https://github.com/stack-chan/stack-chan/blob/${BOARD_COMMIT}/schematics/m5-pantilt/m5-pantilt.kicad_pcb`;
const ETCH_URL=`https://github.com/PranavAchar01/etch/tree/${ETCH_COMMIT}/deploy/etch-app/world/boards/stack-chan__stack-chan`;

type BoardPart={value:string;footprint:string;description:string;side:string;pos_mm:number[];rot:number;node:string|null};
type BoardMeta={size_mm:[number,number];layers:number;parts:number;board:{thickness_mm:number};models:{resolved:number;missing:{ref:string;reason:string}[]};rendered:string;kicad:string};

function componentDetails(ref:string,part:BoardPart):{name:string;category:string;role:string} {
  if(ref.startsWith('R'))return {name:`${ref} · ${part.value==='0'?'0 Ω link':`${part.value}Ω resistor`}`,category:'Resistor',role:part.value==='0'?'Zero-ohm link listed in the source board. Net connectivity and current limits have not been imported.':'Passive resistor with the value and footprint recorded in the source board. Its exact circuit role requires the schematic.'};
  if(ref.startsWith('C'))return {name:`${ref} · ${part.value.replace('u',' µ')}F capacitor`,category:'Capacitor',role:'Capacitor listed in the source board. The component value and footprint are source metadata; no circuit or polarity verification was performed.'};
  if(ref.startsWith('J')) {
    const connector=ref==='J1'?'2 × 15 pin header':ref==='J2'?'2 × 15 pin socket':ref==='J5'?'BAT connector':ref==='J7'?'5 V power connector':ref==='J6'?'4-pin JST connector':'3-pin JST connector';
    return {name:`${ref} · ${connector}`,category:'Connector',role:'Board connector identified by its source footprint and reference. Pin assignments, mating orientation and permissible voltage require the original schematic.'};
  }
  if(ref.startsWith('D'))return {name:`${ref} · ${part.value}`,category:'Diode',role:'Diode listed in the source board. Orientation and its role in the circuit must be checked against the source schematic.'};
  if(ref.startsWith('Q'))return {name:`${ref} · ${part.value}`,category:'Transistor',role:`${part.value} transistor listed in the source board; its circuit function and operating limits have not been inferred from the 3D mesh.`};
  return {name:`${ref} · ${part.value}`,category:'Integrated circuit',role:ref==='U1'?'MAX3485 RS-485/RS-422 transceiver listed in the source board. The model preserves package geometry, not verified electrical connectivity.':'Integrated circuit identified by the source board metadata.'};
}

function layerDetails(name:string):{name:string;description:string;role:string} {
  if(name.startsWith('board_copper'))return {name:'PCB · copper',description:'Actual copper-layer geometry exported from the KiCad board.',role:'Conductive copper geometry from the source layout. Electrical nets are not available in this viewer.'};
  if(name.startsWith('board_pad'))return {name:'PCB · solder pads',description:'Actual exposed pad geometry exported from the KiCad board.',role:'Physical component soldering and contact pads from the source layout.'};
  if(name.startsWith('board_via'))return {name:'PCB · vias',description:'Actual via geometry exported from the KiCad board.',role:'Physical inter-layer via geometry. This viewer does not infer connected nets.'};
  if(name.startsWith('board_silkscreen'))return {name:`PCB · ${name.endsWith('_1')?'bottom':'top'} silkscreen`,description:'Original KiCad silkscreen text and artwork geometry.',role:'Printed reference labels and artwork identify component placement.'};
  if(name.startsWith('board_soldermask'))return {name:`PCB · ${name.endsWith('_1')?'bottom':'top'} solder mask`,description:'Original solder-mask geometry exported from the KiCad board.',role:'Solder mask covers selected copper areas while leaving pads exposed.'};
  return {name:'PCB · substrate',description:'Original board body and outline from the KiCad PCB file.',role:'Mechanical substrate supporting the source board components.'};
}

async function resource(path:string):Promise<Response> {
  const response=await fetch(`${BASE}/${path}`);
  if(!response.ok)throw new Error(`The bundled Stack Chan ${path.endsWith('.glb')?'3D model':'metadata'} could not be loaded. Please retry.`);
  return response;
}

/** Genuine pinned KiCad geometry, loaded locally without a Gemini request. */
export async function loadStackChan():Promise<{document:DeviceDocument;scene:THREE.Group;asset:ArrayBuffer}> {
  const [assetResponse,metaResponse,partsResponse]=await Promise.all([resource('original.glb'),resource('meta.json'),resource('parts.json')]);
  const [asset,meta,partData]=await Promise.all([assetResponse.arrayBuffer(),metaResponse.json() as Promise<BoardMeta>,partsResponse.json() as Promise<{parts:Record<string,BoardPart>}>]);
  if(!Array.isArray(meta.size_mm)||!partData.parts||meta.models?.resolved!==32)throw new Error('The bundled Stack Chan metadata is incomplete.');
  const imported=await importDeviceGLB(asset,'Stack Chan.glb');
  const missing=meta.models.missing.map(part=>part.ref).join(', ');
  const allParts=imported.document.parts.map((part):DevicePart=>{
    const ref=part.name,sourcePart=partData.parts[ref];
    if(sourcePart) {
      const detail=componentDetails(ref,sourcePart);
      return {...part,...detail,description:sourcePart.description||`Source component ${ref}.`,specs:{
        ...part.specs,'KiCad reference':ref,'Source value':sourcePart.value,'Footprint':sourcePart.footprint,'Source side':sourcePart.side,
        'Source placement':`${sourcePart.pos_mm.join(', ')} mm; ${sourcePart.rot}° in the KiCad source coordinates`,
        'Electrical verification':'Not performed; no net connectivity imported','License':'Apache-2.0',
      },sourceUrl:BOARD_URL,notes:`Actual Etch-exported component geometry. Material regions remain grouped as one component. Source PCB is ${meta.size_mm.join(' × ')} mm; the whole imported model is normalized to a 220 mm display extent. ${missing} has no 3D model and is omitted. See /assemblies/stack-chan/NOTICE.`};
    }
    const detail=layerDetails(ref);
    return {...part,...detail,category:'PCB layer',specs:{...part.specs,'Source board size':`${meta.size_mm.join(' × ')} mm`,'Source board thickness':`${meta.board.thickness_mm} mm`,'Copper layers':String(meta.layers),'Source geometry':ref,'Missing model':`${missing}: no geometry in the source KiCad model library`,'License':'Apache-2.0'},sourceUrl:BOARD_URL,notes:'Real KiCad board geometry. Layer separation is an inspection effect, not an assembly or fabrication instruction. Physical source dimensions differ from the normalized display dimensions. See /assemblies/stack-chan/NOTICE.'};
  });
  const ids=(predicate:(part:DevicePart)=>boolean)=>allParts.filter(predicate).map(part=>part.id);
  const boardIds=ids(part=>part.category==='PCB layer');
  const document=validateDeviceDocument({...imported.document,name:'Stack Chan · real KiCad board',
    description:`A real ${meta.size_mm.join(' × ')} mm, ${meta.layers}-layer M5Stack pan-tilt board from the open-source Stack Chan robot. Preserves ${meta.models.resolved} modeled components plus the original copper, pads, vias, silkscreen, solder mask and PCB body. ${missing} has no source 3D model and is omitted. Display geometry is normalized to a 220 mm overall extent; this is a visual inspection model, not a verified manufacturing or electrical assembly.`,
    provenance:`Source: stack-chan/stack-chan @ ${BOARD_COMMIT}, schematics/m5-pantilt/m5-pantilt.kicad_pcb (Apache-2.0; Copyright 2021 Shinya Ishikawa). Etch render: PranavAchar01/etch @ ${ETCH_COMMIT}; metadata records KiCad ${meta.kicad}, rendered ${meta.rendered}. The untouched Etch GLB is decoded locally with the bundled meshopt decoder; original geometry and materials are preserved. Original: ${ETCH_URL}. License and modification notice: /assemblies/stack-chan/LICENSE and /assemblies/stack-chan/NOTICE.`,
    parts:allParts,steps:[
      {title:'Inspect the real PCB',description:`This is the actual ${meta.size_mm.join(' × ')} mm source board rendered at a normalized display scale. Explore the outline, mounting holes and original materials.`,partIds:boardIds},
      {title:'Explore copper, pads and vias',description:'Separate the source copper, exposed pads and via geometry. Their shapes are genuine; electrical nets have not been imported.',partIds:ids(part=>/copper|pad|via/.test(part.specs['Source geometry']??''))},
      {title:'Inspect the board connectors',description:'Select each source connector to see its reference, footprint and placement. Check pin assignments in the linked KiCad source before connecting hardware.',partIds:ids(part=>part.category==='Connector')},
      {title:'Inspect resistors and capacitors',description:'Original package meshes, source values and placement are preserved. Each component keeps its body and terminal material regions together.',partIds:ids(part=>['Resistor','Capacitor'].includes(part.category))},
      {title:'Inspect the transceiver and semiconductors',description:'Explore U1 MAX3485, Q1/Q2 and D1/D2 as identified in the source board metadata. No electrical behavior is simulated.',partIds:ids(part=>['Integrated circuit','Transistor','Diode'].includes(part.category))},
      {title:'Review source completeness',description:`The source metadata lists ${meta.parts} footprints, ${meta.models.resolved} resolved component models, and missing model ${missing}. Mounting holes and artwork remain part of the PCB geometry; no stand-in component geometry was invented. Use the pinned source and bundled license for attribution.`,partIds:boardIds},
    ]});
  return {document,scene:imported.scene,asset};
}
