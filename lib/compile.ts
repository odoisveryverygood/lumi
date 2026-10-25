import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { PART_MAP } from './library';
import { validateProject } from './validation';
import type { Project } from './types';

export interface CompileResult { success:boolean; board:string; output:string; checkedAt:string; sourceHash:string }
export class CompileError extends Error { constructor(public readonly status:number,message:string){super(message);this.name='CompileError';} }
export interface CliResult { stdout:string; stderr:string; exitCode:number; timedOut?:boolean }
export type CliRunner=(args:string[],options:{cwd?:string;timeoutMs:number})=>Promise<CliResult>;
const MAX_SOURCE_BYTES=120_000;
const COMPILE_TIMEOUT_MS=60_000;
const MAX_OUTPUT_CHARS=12_000;
const compilerState=globalThis as typeof globalThis & {__partExplodeCompilerBusy?:boolean};
const BOARD_TARGETS:Record<string,{core:string;fqbn:string}[]>={
  'arduino-nano':[{core:'arduino:avr',fqbn:'arduino:avr:nano:cpu=atmega328'}],
  'arduino-uno':[{core:'arduino:avr',fqbn:'arduino:avr:uno'}],
  'esp32-devkit':[{core:'esp32:esp32',fqbn:'esp32:esp32:esp32'}],
  'raspberry-pi-pico':[{core:'rp2040:rp2040',fqbn:'rp2040:rp2040:rpipico'},{core:'arduino:mbed_rp2040',fqbn:'arduino:mbed_rp2040:pico'}],
};

/** This endpoint is for the local application; remote/public hosts cannot run this compiler. */
export function checkCompileOrigin(request:Request) {
  const url=new URL(request.url);
  // Next can canonicalize request.url to localhost even when a browser used127.0.0.1.
  const host=request.headers.get('host');
  let actual=url;
  try {if(host)actual=new URL(`${url.protocol}//${host}`);}catch{throw new CompileError(403,'Invalid local app host.');}
  if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!['localhost','127.0.0.1','[::1]'].includes(actual.hostname))throw new CompileError(403,'Sketch compilation is available only from the local app.');
  const origin=request.headers.get('origin');
  if(!origin)throw new CompileError(403,'Compilation requests must include this app’s origin.');
  try {if(new URL(origin).origin===actual.origin && request.headers.get('sec-fetch-site')!=='cross-site')return;}catch{/* Fixed error below. */}
  throw new CompileError(403,'Compilation requests must come from this app.');
}

export function sourceHash(source:string){return createHash('sha256').update(source,'utf8').digest('hex');}
export function safeSketchName(filename:string) {
  const stem=filename.replace(/\.ino$/i,'').replace(/[^a-zA-Z0-9_]/g,'_').slice(0,44);
  return /^[a-zA-Z]/.test(stem)?stem:`project_${stem||'sketch'}`;
}

/** Flat header names resolve only through the installed compiler/core/library search paths. */
export function checkCompileSource(source:string) {
  if(Buffer.byteLength(source,'utf8')>MAX_SOURCE_BYTES)throw new CompileError(413,'The sketch exceeds the 120 KB compilation limit.');
  if(/\b(?:asm|__asm__?|_Pragma|__has_include)\b|\.incbin\b|^\s*#\s*pragma\s+(?:GCC|clang)\b/im.test(source))throw new CompileError(400,'Inline assembly and compiler-specific preprocessing are not supported by this local sketch check.');
  if(source.includes('\0'))throw new CompileError(400,'The sketch contains invalid null characters.');
  const joined=source.replace(/\\\r?\n/g,'');
  if(/%:|\?\?=/.test(joined))throw new CompileError(400,'Unsupported preprocessor syntax. Use standard Arduino #include directives.');
  const withoutComments=joined.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  for(const line of withoutComments.split(/\r?\n/)) {
    if(!/^\s*#\s*(include|include_next|import|embed)\b/.test(line))continue;
    const include=line.match(/^\s*#\s*include\s*[<"]([^>"]+)[>"]\s*$/);
    if(!include||!/^([a-zA-Z0-9_][a-zA-Z0-9_.-]*|(?:freertos|driver|soc)\/[a-zA-Z0-9_][a-zA-Z0-9_.-]*)$/.test(include[1])||include[1].includes('..'))throw new CompileError(400,'Only named installed Arduino headers are supported; absolute paths, traversal and macro includes are not allowed.');
  }
}

export function installedCoreIds(stdout:string):Set<string> {
  let value:unknown;
  try {value=JSON.parse(stdout);}catch{throw new CompileError(503,'Arduino CLI could not report its installed board cores.');}
  const records=Array.isArray(value)?value:value&&typeof value==='object'&&'platforms'in value?(value as {platforms:unknown}).platforms:undefined;
  if(!Array.isArray(records))throw new CompileError(503,'Arduino CLI returned an unsupported board-core response.');
  return new Set(records.flatMap(p=>p&&typeof p==='object'&&typeof p.id==='string'&&(p.installed_version||p.installed)?[p.id]:[]));
}

export function compileBoard(project:Project,installed:Set<string>):string {
  const controllers=project.parts.filter(p=>PART_MAP[p.libraryId]?.category==='microcontroller');
  if(controllers.length!==1)throw new CompileError(400,'Compile one microcontroller per project.');
  const targets=BOARD_TARGETS[controllers[0].libraryId];
  if(!targets)throw new CompileError(400,'This controller is not supported by the local compiler.');
  const target=targets.find(item=>installed.has(item.core));
  if(!target)throw new CompileError(503,`The ${PART_MAP[controllers[0].libraryId].name} board core is not installed on this computer. Install its Arduino board package before compiling.`);
  return target.fqbn;
}

/** Keep computer paths and server credentials out of returned compiler diagnostics. */
export function sanitizeCompilerOutput(raw:string,temporaryDirectory?:string):string {
  let output=raw;
  const paths=[temporaryDirectory,homedir(),process.cwd()].filter((v):v is string=>!!v).sort((a,b)=>b.length-a.length);
  for(const path of paths)output=output.split(path).join('[local]');
  for(const [name,value]of Object.entries(process.env))if(/key|token|secret|password|credential/i.test(name)&&value&&value.length>=6)output=output.split(value).join('[redacted]');
  output=output.replace(/\u001b\[[\d;]*m/g,'').replace(/(?:[a-zA-Z]:[\\/]|\/)(?:[^\s:"<>|]+[\\/])*[^\s:"<>|]+/g,'[path]');
  return output.length>MAX_OUTPUT_CHARS?`${output.slice(0,MAX_OUTPUT_CHARS)}\n[Compiler output truncated]`:output;
}

const runArduinoCli:CliRunner=(args,options)=>new Promise((resolve,reject)=>{
  // No shell and no user-supplied compiler flags. Provider/API credentials are not inherited.
  const env:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV||'development',PATH:process.env.PATH,HOME:process.env.HOME,USERPROFILE:process.env.USERPROFILE,SystemRoot:process.env.SystemRoot,TMPDIR:process.env.TMPDIR};
  execFile('arduino-cli',args,{cwd:options.cwd,encoding:'utf8',timeout:options.timeoutMs,killSignal:'SIGKILL',maxBuffer:512_000,env},(error,stdout,stderr)=>{
    if(error && 'code'in error && error.code==='ENOENT'){reject(new CompileError(503,'Arduino CLI is not installed or is unavailable to this app.'));return;}
    const detail=error as (Error & {code?:number|string;killed?:boolean})|null;
    resolve({stdout:String(stdout||''),stderr:String(stderr||''),exitCode:detail?typeof detail.code==='number'?detail.code:1:0,timedOut:!!detail?.killed});
  });
});

/** Compiles exactly the submitted source. Never downloads cores/libraries or uploads to a board. */
export async function compileProject(input:unknown,dependencies:{run?:CliRunner}={}):Promise<CompileResult> {
  const checked=validateProject(input);
  if(!checked.valid||!checked.project)throw new CompileError(400,`Project validation failed: ${checked.errors.slice(0,3).join('; ')}`);
  const project=checked.project;
  checkCompileSource(project.code.source);
  if(compilerState.__partExplodeCompilerBusy)throw new CompileError(429,'Another sketch is compiling. Wait for it to finish and try again.');
  compilerState.__partExplodeCompilerBusy=true;
  let folder:string|undefined;
  try {
    const run=dependencies.run??runArduinoCli;
    const cores=await run(['core','list','--format','json'],{timeoutMs:10_000});
    if(cores.exitCode!==0)throw new CompileError(503,'Arduino CLI could not read its installed board cores.');
    const board=compileBoard(project,installedCoreIds(cores.stdout));
    folder=await mkdtemp(join(tmpdir(),'partexplode-compile-'));
    const name=safeSketchName(project.code.filename),sketch=join(folder,name);
    await mkdir(sketch);
    await writeFile(join(sketch,`${name}.ino`),project.code.source,'utf8');
    const result=await run(['compile','--fqbn',board,'--warnings','default','--build-path',join(folder,'build'),sketch],{cwd:folder,timeoutMs:COMPILE_TIMEOUT_MS});
    const messages=[result.stdout,result.stderr].filter(Boolean).join('\n');
    const output=result.timedOut?'Compilation exceeded the 60 second limit and was stopped. Try again after checking your sketch and installed libraries.\n'+messages:messages;
    return {success:result.exitCode===0&&!result.timedOut,board,output:sanitizeCompilerOutput(output|| (result.exitCode===0?'Compilation succeeded.':'Compilation failed.'),folder),checkedAt:new Date().toISOString(),sourceHash:sourceHash(project.code.source)};
  } finally {
    try {if(folder)await rm(folder,{recursive:true,force:true});}
    finally {compilerState.__partExplodeCompilerBusy=false;}
  }
}
