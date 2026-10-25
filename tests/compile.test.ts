import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { checkCompileOrigin, checkCompileSource, compileBoard, compileProject, installedCoreIds, safeSketchName, sanitizeCompilerOutput, sourceHash, type CliRunner } from '../lib/compile';
import { demoProjects } from '../lib/projects';
import { POST } from '../app/api/compile/route';
const cores=JSON.stringify({platforms:[{id:'arduino:avr',installed_version:'1.8.8'},{id:'esp32:esp32',installed_version:'2.0.17'}]});
const clone=()=>structuredClone(demoProjects[0]);
const request=(origin:string|null='http://localhost:3000',body:unknown={project:clone()},url='http://localhost:3000/api/compile')=>new Request(url,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
afterEach(()=>vi.unstubAllEnvs());

describe('local compiler boundary',()=>{
  it('requires matching local origin and refuses a public host',()=>{
    expect(()=>checkCompileOrigin(request())).not.toThrow();
    const canonical=request('http://127.0.0.1:3000');canonical.headers.set('host','127.0.0.1:3000');expect(()=>checkCompileOrigin(canonical)).not.toThrow();
    expect(()=>checkCompileOrigin(request(null))).toThrow(/include.*origin/);
    expect(()=>checkCompileOrigin(request('https://evil.example'))).toThrow(/come from this app/);
    expect(()=>checkCompileOrigin(request('https://part.example',{},'https://part.example/api/compile'))).toThrow(/only from the local app/);
    expect(()=>checkCompileOrigin(request('http://127.0.0.1:3000',{},'http://127.0.0.1:3000/api/compile'))).not.toThrow();
  });
  it('rejects HTTP requests before compiling malformed or oversized payloads',async()=>{
    expect((await POST(request(null))).status).toBe(403);
    expect((await POST(request('http://localhost:3000',{}))).status).toBe(400);
    expect((await POST(request('http://localhost:3000',{project:{}}))).status).toBe(400);
    const huge=request();huge.headers.set('content-length','900000');
    expect((await POST(huge)).status).toBe(413);
  });
  it('accepts regular Arduino headers and rejects file access/include tricks',()=>{
    expect(()=>checkCompileSource('#include <Wire.h>\n#include "Adafruit_SSD1306.h"\n#include <freertos/FreeRTOS.h>')).not.toThrow();
    for(const code of ['#include "/etc/passwd"','#include "../private.h"','#include "C:\\secret.h"','#include HEADER','#include_next <Wire.h>','#import <Wire.h>','#embed "/etc/passwd"','%:include "/etc/passwd"','#inc\\\nlude "/etc/passwd"','asm(".incbin /etc/passwd");','_Pragma("GCC pch_preprocess")'])expect(()=>checkCompileSource(code),code).toThrow();
    expect(()=>checkCompileSource('é'.repeat(61_000))).toThrow(/120 KB/);
  });
  it('sanitizes sketch names, hashes exact source and selects only installed known boards',()=>{
    expect(safeSketchName('../../123; rm -rf /.ino')).not.toMatch(/[/.; ]/);
    expect(safeSketchName('pulse_pal.ino')).toBe('pulse_pal');
    expect(sourceHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(compileBoard(clone(),installedCoreIds(cores))).toBe('esp32:esp32:esp32');
    expect(()=>compileBoard(clone(),new Set())).toThrow(/core is not installed/);
    expect(installedCoreIds(JSON.stringify({platforms:[{id:'uninstalled',latest_version:'1.0'}]})).size).toBe(0);
    expect(()=>installedCoreIds('broken')).toThrow(/could not report/);
  });
  it('redacts local paths and credentials and bounds returned diagnostics',()=>{
    vi.stubEnv('GEMINI_API_KEY','test-private-key-123');
    const output=sanitizeCompilerOutput('/Users/someone/Documents/secret/file.cpp:5: error test-private-key-123\n/var/folders/compiler/build.ino', '/tmp/private-compile');
    expect(output).not.toContain('/Users/');expect(output).not.toContain('/var/');expect(output).not.toContain('test-private-key-123');
    expect(sanitizeCompilerOutput('x'.repeat(50_000)).length).toBeLessThan(12_100);
  });
});

describe('actual source compilation orchestration with a mocked process runner',()=>{
  it('writes the exact sketch, uses fixed args, reports actual output/hash and cleans up',async()=>{
    let folder='',written='';const project=clone();
    const runner:CliRunner=vi.fn(async(args,options)=>{
      if(args[0]==='core')return {exitCode:0,stdout:cores,stderr:''};
      expect(args.slice(0,3)).toEqual(['compile','--fqbn','esp32:esp32:esp32']);
      expect(args).not.toContain('--install');expect(options.timeoutMs).toBe(60_000);
      folder=options.cwd!;
      const directory=args.at(-1)!;const name=directory.split('/').at(-1)!;
      written=await readFile(join(directory,`${name}.ino`),'utf8');
      return {exitCode:0,stdout:'Sketch uses 290000 bytes.\n',stderr:`Used library from ${folder}/libraries`};
    });
    const result=await compileProject(project,{run:runner});
    expect(written).toBe(project.code.source);expect(result.success).toBe(true);expect(result.board).toBe('esp32:esp32:esp32');
    expect(result.sourceHash).toBe(sourceHash(project.code.source));expect(result.output).toContain('290000 bytes');expect(result.output).not.toContain(folder);
    expect(Date.parse(result.checkedAt)).not.toBeNaN();await expect(access(folder)).rejects.toThrow();expect(runner).toHaveBeenCalledTimes(2);
  });
  it('reports missing libraries as real compile failures and cleans up',async()=>{
    let folder='';const runner:CliRunner=async(args,options)=>{
      if(args[0]==='core')return {exitCode:0,stdout:cores,stderr:''};folder=options.cwd!;
      return {exitCode:1,stdout:'',stderr:`${folder}/sketch.ino:2: fatal error: MissingSensor.h: No such file or directory`};
    };
    const result=await compileProject(clone(),{run:runner});expect(result.success).toBe(false);expect(result.output).toContain('MissingSensor.h');expect(result.output).not.toContain(folder);await expect(access(folder)).rejects.toThrow();
  });
  it('reports a stopped timeout without claiming compilation succeeded',async()=>{
    const runner:CliRunner=async args=>args[0]==='core'?{exitCode:0,stdout:cores,stderr:''}:{exitCode:1,timedOut:true,stdout:'',stderr:''};
    const result=await compileProject(clone(),{run:runner});expect(result.success).toBe(false);expect(result.output).toContain('60 second limit');
  });
  it('allows only one concurrent compile and releases the slot after errors',async()=>{
    let finish:((value:{exitCode:number;stdout:string;stderr:string})=>void)|undefined;
    const runner:CliRunner=()=>new Promise(resolve=>{finish=resolve;});
    const first=compileProject(clone(),{run:runner});
    await expect(compileProject(clone(),{run:runner})).rejects.toMatchObject({status:429});
    finish!({exitCode:1,stdout:'',stderr:'failed'});await expect(first).rejects.toMatchObject({status:503});
    const next:CliRunner=async()=>({exitCode:1,stdout:'',stderr:'failed'});
    await expect(compileProject(clone(),{run:next})).rejects.toMatchObject({status:503});
  });
  it('rejects invalid projects before touching the CLI and never swallows CLI absence',async()=>{
    const runner=vi.fn();await expect(compileProject({},{run:runner})).rejects.toMatchObject({status:400});expect(runner).not.toHaveBeenCalled();
    const missing:CliRunner=async()=>{const {CompileError}=await import('../lib/compile');throw new CompileError(503,'Arduino CLI is not installed.');};
    await expect(compileProject(clone(),{run:missing})).rejects.toMatchObject({status:503});
  });
});
