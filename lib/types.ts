export type Vec3 = [number, number, number];
export type Category = 'microcontroller'|'sensor'|'display'|'power'|'input'|'output'|'passive'|'wiring'|'enclosure';
export interface LibraryPart {
 datasheetUrl?:string;sourceUrl?:string;
 id:string; name:string; category:Category; whatItIs:string;
 model:{glb?:string;fallback:'pcb'|'box'|'cylinder'|'screen'|'battery'|'button'|'led'};
 size:Vec3; colour:string;
 pins:{name:string;position:Vec3;type:'power'|'ground'|'digital'|'analog'|'i2c-sda'|'i2c-scl'|'spi'|'uart'|'pwm';voltage?:number}[];
 voltage:{min:number;max:number};currentMa:number;priceUsd:number;buyUrl:string;alternatives:string[];
}
export interface PartInstance {
 id:string;libraryId:string;label:string;role:string;quantity:number;assembledPosition:Vec3;rotation:Vec3;explodeDirection:Vec3;explodeDistance:number;layer:number;watchOut?:string;
 /** Per-instance envelope in mm for parts carried over from a Studio object; the library size applies otherwise. */
 size?:Vec3;
 /** Finish carried over from a Studio object. */
 colour?:string;
}
export interface Connection {
 id:string;from:{partId:string;pin:string};to:{partId:string;pin:string};kind:'power'|'ground'|'signal'|'data';wireColor:'red'|'black'|'yellow'|'blue'|'green'|'white'|'orange';purpose:string;signalDirection:'from-to'|'to-from'|'both';
}
export interface BuildStep {index:number;title:string;instructions:string;partIds:string[];connectionIds:string[];tip?:string;check?:string;camera:{position:Vec3;target:Vec3}}
export interface Project {
 id:string;name:string;prompt:string;description:string;howItWorks:string;difficulty:1|2|3|4|5;buildTimeMinutes:number;skillLevel:'beginner'|'intermediate';parts:PartInstance[];connections:Connection[];buildSteps:BuildStep[];code:{language:'arduino';filename:string;source:string;libraries:string[]};heroImagePrompt?:string;
}
export type ViewMode='3d'|'top'|'flat';
export type AssemblyMode='assembled'|'exploded'|'build';
export interface ValidationResult {valid:boolean;errors:string[];warnings:string[];project?:Project}
