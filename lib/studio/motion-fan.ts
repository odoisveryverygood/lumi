import source from './motion-fan-source.json';
import {validateDeviceDocument} from './validation';
import {mountParts,resolveAttachments} from './attachments';
import type {DeviceDocument} from './types';
import type {MotionContract} from './motion-types';

export const FAN_MOTION_BRIEF='Repair the deliberately lowered fan stand while keeping it at least 10 mm shorter than the original reference. Retain the full -45 to +45 degree tilt range relative to its original resting head angle, with 0.5 mm sampled clearance. Only raise or lower the tilt yoke within the declared limits; preserve every original shape and the sourced 608 bearing.';
export const FAN_JOINT:MotionContract={version:1,kind:'revolute',movingRootId:'motor-housing',pivotPartId:'tilt-yoke',pivot:[0,55,0],axis:[1,0,0],minDeg:-45,maxDeg:45,stepDeg:5,clearanceMm:.5,
 allowedEdits:[{partId:'tilt-yoke',minPosition:[0,48,0],maxPosition:[0,78,0]}],
 contacts:[{partIds:['circular-grille','tilt-yoke'],reason:'Authored hinge interface: the grille has side screw lugs at local x = ±79 mm. Entire pair excluded; hinge fit and local interference remain unverified.'},{partIds:['circular-grille','tilt-knobs'],reason:'Tilt-lock knobs meet the grille side hinge lugs. Entire pair excluded, not a clearance verdict.'},{partIds:['motor-housing','tilt-yoke'],reason:'Declared head pivot interface; this pair is excluded, not a verified bearing fit.'},{partIds:['motor-housing','tilt-knobs'],reason:'Declared tilt-lock interface.'},{partIds:['tilt-yoke','base-stand'],reason:'Declared stand-to-base insertion interface.'}],
 provenance:'Reuses the saved adjustable fan in docs/sponsor-sprint/2026-10-24-quality/reviewed-fan.part.json at source commit 0bfb4bf. All source shapes preserved. Reference preparation relocates the controller PCB to [55,14,0] mm before seeding the lowered stand. Contact exceptions are declared geometric exclusions; hinge fit remains unverified. Joint axis/pivot and rigid mounts are explicitly authored study assumptions, not manufacturer CAD evidence. Range is relative to its saved -12 degree resting head angle.'};
export function createMotionFan(defective=true):DeviceDocument{
 let doc=validateDeviceDocument(structuredClone(source));
 // Explicit reference preparation, before seeding the compact-stand defect. Shapes stay identical.
 doc=resolveAttachments(doc,{...doc,parts:doc.parts.map(p=>p.id==='control-pcb'?{...p,position:[55,14,0]}:p)},['control-pcb']);
 doc=mountParts(doc,[{partId:'fan-axle',parentId:'motor-housing'},{partId:'three-blade-rotor',parentId:'motor-housing'}]);
 doc={...doc,id:'adjustable-fan-motion-study',name:'Adjustable fan · seeded tilt study',designBrief:FAN_MOTION_BRIEF,
  description:'Existing fan source with an explicitly authored tilt joint. The lowered stand is a deliberately seeded defect, not a new AI generation failure.',
  mechanisms:[{id:'fan-tilt',name:'Sampled fan tilt',description:'Sweep -45° to +45° relative to the saved resting angle. Playback is not proof of clearance.',duration:6,motion:'linear',tracks:[{partId:'motor-housing',rotation:[90,0,0]}],stages:[{at:0,title:'Lower endpoint',description:'-45 degrees from the saved resting angle.',partIds:doc.parts.map(p=>p.id)},{at:.5,title:'Rest',description:'Original resting head angle.',partIds:['motor-housing']},{at:1,title:'Upper endpoint',description:'+45 degrees from the saved resting angle.',partIds:doc.parts.map(p=>p.id)}],verification:structuredClone(FAN_JOINT)}]};
 if(defective)doc=resolveAttachments(doc,{...doc,parts:doc.parts.map(p=>p.id==='tilt-yoke'?{...p,position:[0,48,0]}:p)},['tilt-yoke']);
 return validateDeviceDocument(doc);
}
