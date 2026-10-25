import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
// Build tooling only. Run from the app root with a prepared catalog-tools directory.
const here=path.resolve(process.argv[2]||'work/catalog-tools'),app=process.cwd();
const {asyncBufferFromFile,parquetReadObjects}=await import(pathToFileURL(createRequire(import.meta.url).resolve('hyparquet',{paths:[here]})).href);
const out=path.join(app,'lib/studio/catalog-data');fs.mkdirSync(out,{recursive:true});
const licenseDir=path.join(app,'public/catalog/licenses');fs.mkdirSync(licenseDir,{recursive:true});
const espRev='dd76561812ab300351234ba6e0ec1295641796f0',nopRev='00ec2898c0a2cdebd446f0175671b633d5ae7d5f',boslRev='d29d3e5fcfe830e7554b7c914b1431dbf23e82d8';
for(const [src,dest] of [['Espressif/LICENSE.md','espressif.txt'],['NopSCADlib/COPYING','nopscadlib.txt'],['BOSL2/LICENSE','bosl2.txt']])fs.copyFileSync(path.join(here,'source',src),path.join(licenseDir,dest));
const hash=b=>createHash('sha256').update(b).digest('hex'),round=n=>Math.round(n*10000)/10000;
function geometry(triangles){
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const t of triangles)for(const p of t.points)for(let a=0;a<3;a++){lo[a]=Math.min(lo[a],p[a]);hi[a]=Math.max(hi[a],p[a]);}
 const center=lo.map((v,a)=>(v+hi[a])/2),positions=[],indices=[],colors=[],keys=new Map();
 for(const t of triangles)for(const p of t.points){const v=p.map((n,a)=>round(n-center[a])),c=(t.color||[.65,.67,.69]).map(round),key=[...v,...c].join(',');let index=keys.get(key);if(index===undefined){index=positions.length/3;keys.set(key,index);positions.push(...v);colors.push(...c);}indices.push(index);}
 if(positions.length>180000)throw Error('Mesh too large '+positions.length);
 return {mesh:{positions,indices,colors},size:hi.map((v,a)=>round(v-lo[a]))};
}
const assets=[];
const require=createRequire(import.meta.url),occt=await require(require.resolve('occt-import-js',{paths:[here,path.resolve(here,'../cad-tools')]}))();
for(const model of ['ESP32-WROOM-32E','ESP32-S3-WROOM-1','ESP32-C3-MINI-1']){
 const cache=path.join(here,model+'.mesh.json');if(fs.existsSync(cache)){assets.push(JSON.parse(fs.readFileSync(cache)));continue;}
 const file=fs.readFileSync(path.join(here,'source/Espressif',model+'.STEP'));
 const result=occt.ReadStepFile(file,{linearUnit:'millimeter',linearDeflectionType:'absolute_value',linearDeflection:.12,angularDeflection:.5});if(!result.success)throw Error(model+' tessellation failed');
 const triangles=[];for(const m of result.meshes){const p=m.attributes.position.array,ix=m.index.array;let face=0;for(let t=0;t<ix.length/3;t++){while(face+1<m.brep_faces.length&&t>m.brep_faces[face].last)face++;triangles.push({points:ix.slice(t*3,t*3+3).map(i=>[p[i*3],p[i*3+2],-p[i*3+1]]),color:m.brep_faces[face]?.color||m.color});}}
 const data={id:model.toLowerCase(),name:model,source:'espressif',category:'Electronics',description:'Official Espressif radio module CAD. Module only; not a complete development board.',tags:['esp32','wifi','bluetooth','microcontroller','smart','electronics',model.toLowerCase()],license:'CC-BY-SA-4.0 + KiCad exception',revision:espRev,url:`https://github.com/espressif/kicad-libraries/blob/${espRev}/3dmodels/espressif.3dshapes/${model}.STEP`,sha256:hash(file),color:'#ffffff',...geometry(triangles)};
 assets.push(data);fs.writeFileSync(cache,JSON.stringify(data));console.log(model,data.mesh.positions.length/3,'vertices');
}
const definitions=[
 ['m3-cap-12','M3 × 12 socket screw','Fasteners','M3 socket cap screw, 12 mm nominal length.',['screw','bolt','fastener','m3'],'vitamins/screws.scad','screw(M3_cap_screw,12);'],
 ['m4-cap-16','M4 × 16 socket screw','Fasteners','M4 socket cap screw, 16 mm nominal length.',['screw','bolt','fastener','m4'],'vitamins/screws.scad','screw(M4_cap_screw,16);'],
 ['m3-nut','M3 hex nut','Fasteners','Standard M3 hex nut model.',['nut','fastener','m3'],'vitamins/nuts.scad','nut(M3_nut);'],
 ['m3-washer','M3 washer','Fasteners','Standard M3 washer model.',['washer','fastener','m3'],'vitamins/washers.scad','washer(M3_washer);'],
 ['bearing-608','608 bearing','Motion','608 bearing: 8 mm bore, 22 mm outer diameter, 7 mm width.',['bearing','wheel','shaft','motion','motor'],'vitamins/ball_bearings.scad','ball_bearing(BB608);'],
 ['rail-2020-100','2020 extrusion · 100 mm','Structure','20 × 20 mm aluminium extrusion, 100 mm long.',['frame','rail','aluminium','structure','extrusion'],'vitamins/extrusions.scad','extrusion(E2020,100);'],
 ['rail-2020-400','2020 extrusion · 400 mm','Structure','20 × 20 mm aluminium extrusion, 400 mm long.',['frame','rail','aluminium','structure','extrusion'],'vitamins/extrusions.scad','extrusion(E2020,400);'],
 ['rounded-block','Rounded housing blank','Parametric','BOSL2 rounded cuboid: 60 × 40 × 20 mm; solid design blank, not a hollow enclosure.',['housing','case','enclosure','rounded','blank'],'std.scad','cuboid([60,40,20],rounding=4,$fn=24);','bosl2'],
 ['tube-20','Hollow tube · Ø20','Parametric','BOSL2 tube: outer diameter 20 mm, inner diameter 16 mm, length 60 mm.',['tube','pipe','hollow','structure'],'std.scad','tube(h=60,od=20,id=16,$fn=32);','bosl2'],
 ['gear-20','20-tooth spur gear','Motion','BOSL2 spur gear: module 1.5, 20 teeth, 6 mm thick, 5 mm shaft bore.',['gear','motor','transmission','motion'],'gears.scad','spur_gear(mod=1.5,teeth=20,thickness=6,shaft_diam=5,$fn=24);','bosl2'],
 ['gear-32','32-tooth spur gear','Motion','BOSL2 spur gear: module 1.5, 32 teeth, 6 mm thick, 5 mm shaft bore.',['gear','transmission','motion'],'gears.scad','spur_gear(mod=1.5,teeth=32,thickness=6,shaft_diam=5,$fn=24);','bosl2'],
];
async function runtime(sourceName){const mod={noInitialRun:true,noExitRuntime:true,wasmBinary:fs.readFileSync(path.join(here,'openscad/openscad.wasm')),print:()=>{},printErr:s=>{if(/ERROR|WARNING/.test(s))console.error(s);}};
await new Promise((resolve,reject)=>{mod.onRuntimeInitialized=resolve;mod.onAbort=reject;vm.runInNewContext(fs.readFileSync(path.join(here,'openscad/openscad.wasm.js'),'utf8'),{OpenSCAD:mod,console,WebAssembly,TextDecoder,TextEncoder,performance,setTimeout,clearTimeout,process,Buffer});});
function mount(dir,target){mod.FS.mkdirTree(target);for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isDirectory())mount(path.join(dir,e.name),target+'/'+e.name);else if(e.name.endsWith('.scad'))mod.FS.writeFile(target+'/'+e.name,fs.readFileSync(path.join(dir,e.name)));}}
mount(path.join(here,'source',sourceName),'/'+sourceName);return mod;}
const wrapperDir=path.join(app,'scripts/catalog-sources');fs.mkdirSync(wrapperDir,{recursive:true});
for(const [id,name,category,description,tags,file,code,library='nopscadlib'] of definitions){
 const bosl=library==='bosl2',sourceName=bosl?'BOSL2':'NopSCADlib';
 const mod=await runtime(sourceName);
 const moduleFile=file.replace(/s\.scad$/,'.scad');
 const wrapper=`// Source geometry: ${sourceName}, pinned revision ${bosl?boslRev:nopRev}\n${bosl?'':`include <NopSCADlib/core.scad>\ninclude <NopSCADlib/${moduleFile}>\n`}include <${sourceName}/${bosl?'std.scad':file}>\n${bosl&&file!=='std.scad'?`include <BOSL2/${file}>\n`:''}$fn=24;\n${code}\n`;
 mod.FS.writeFile('/input.scad',wrapper);try{mod.FS.unlink('/output.stl');}catch{}
 const status=mod.callMain(['/input.scad','-o','/output.stl']);if(status!==0)throw Error('OpenSCAD failed '+id+' '+status);
 const stl=mod.FS.readFile('/output.stl',{encoding:'utf8'}),vertices=[...stl.matchAll(/vertex\s+([\deE.+-]+)\s+([\deE.+-]+)\s+([\deE.+-]+)/g)].map(m=>[+m[1],+m[3],-m[2]]);
 if(!vertices.length||vertices.length%3)throw Error('Invalid STL '+id);
 const triangles=[];for(let i=0;i<vertices.length;i+=3)triangles.push({points:vertices.slice(i,i+3),color:bosl?[.88,.58,.31]:[.65,.68,.71]});
 const data={id,name,source:library,category,description,tags,license:bosl?'BSD-2-Clause':'GPL-3.0-or-later',revision:bosl?boslRev:nopRev,url:`https://github.com/${bosl?'BelfrySCAD/BOSL2':'nophead/NopSCADlib'}/blob/${bosl?boslRev:nopRev}/${file}`,sha256:hash(stl),color:'#ffffff',wrapper:`/catalog/sources/${id}.scad`,...geometry(triangles)};
 assets.push(data);fs.writeFileSync(path.join(wrapperDir,id+'.scad'),wrapper);console.log(id,data.mesh.positions.length/3,'vertices');
}
fs.writeFileSync(path.join(out,'parts.json'),JSON.stringify(assets));
const publicSources=path.join(app,'public/catalog/sources');fs.mkdirSync(publicSources,{recursive:true});for(const e of fs.readdirSync(wrapperDir))fs.copyFileSync(path.join(wrapperDir,e),path.join(publicSources,e));
const rows=await parquetReadObjects({file:await asyncBufferFromFile(path.join(here,'smithsonian.parquet'))});
const objects=rows.filter(r=>r.fileType==='glb'&&r.license==='Creative Commons Zero v1.0 Universal'&&new URL(r.fileIdentifier).hostname==='3d-api.si.edu').map(r=>({id:r.sha256.slice(0,20),name:JSON.parse(r.metadata).title,url:r.fileIdentifier,sha256:r.sha256,license:'CC0-1.0'}));
const unique=[...new Map(objects.map(r=>[r.id,r])).values()];fs.writeFileSync(path.join(out,'objects.json'),JSON.stringify(unique));
console.log('Ready parts',assets.length,'CC0 object references',unique.length,'mesh JSON bytes',fs.statSync(path.join(out,'parts.json')).size);
