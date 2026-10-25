'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { DeviceDocument, DevicePart, Vec3 } from '@/lib/studio/types';
import PartThumbnail from './PartThumbnail';

/** A small view of the actual reference geometry; no second WebGL context. */
export default function ObjectPreview({ document }: { document: DeviceDocument }) {
  const preview = useMemo<DevicePart>(() => ({
    ...document.parts[0], mesh: undefined, id: `preview-${document.id}`, name: document.name,
    solids: document.parts.flatMap(part => {
      const parent = new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.rotation.map(THREE.MathUtils.degToRad) as Vec3));
      return part.solids.map(solid => {
        const position = new THREE.Vector3(...solid.position).applyQuaternion(parent).add(new THREE.Vector3(...part.position)).addScaledVector(new THREE.Vector3(...part.explode), .28);
        const rotation = new THREE.Euler().setFromQuaternion(parent.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(solid.rotation || [0, 0, 0]).map(THREE.MathUtils.degToRad) as Vec3))));
        return { ...solid, position: position.toArray() as Vec3, rotation: [rotation.x, rotation.y, rotation.z].map(THREE.MathUtils.radToDeg) as Vec3, color: solid.color || part.color };
      });
    }),
  }), [document]);
  const sourceMeshes=useMemo(()=>document.parts.filter(p=>p.mesh).map(part=>{const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...part.rotation.map(THREE.MathUtils.degToRad) as Vec3)),positions:number[]=[];for(let i=0;i<part.mesh!.positions.length;i+=3){const v=new THREE.Vector3().fromArray(part.mesh!.positions,i).applyQuaternion(rotation).add(new THREE.Vector3(...part.position)).addScaledVector(new THREE.Vector3(...part.explode),.28);positions.push(v.x,v.y,v.z);}return {mesh:{positions,indices:part.mesh!.indices,colors:part.mesh!.colors},color:part.color};}),[document]);
  return <PartThumbnail part={preview} large detailLimit={1400} sourceMeshes={sourceMeshes}/>;
}
