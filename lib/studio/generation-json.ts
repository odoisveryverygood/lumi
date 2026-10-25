import {z} from 'zod';
import {completedParts} from './generation-progress';

const MAX_CHARS=240_000;
export function assemblyJsonText(text:string):string {
  if(text.length>MAX_CHARS)throw new Error('The assembly exceeds the response size limit.');
  return text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
}

/** Remove only commas directly before a closing delimiter, never text inside strings.
 * No expressions, missing values, unfinished containers or geometry are invented. */
export function parseAssemblyJson(text:string):unknown {
  const source=assemblyJsonText(text);
  let quoted=false,escaped=false,clean='';
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(quoted){clean+=char;if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
    if(char==='"')quoted=true;
    if(char===','){
      let next=i+1;while(next<source.length&&/\s/.test(source[next]))next++;
      if(source[next]===']'||source[next]==='}')continue;
    }
    clean+=char;
  }
  return JSON.parse(clean);
}

const syntaxEdits=z.object({edits:z.array(z.object({
  find:z.string().min(1).max(4000),replace:z.string().max(4000),
}).strict()).min(1).max(24)}).strict();

/** Apply unique literal edits to the original response, never evaluate model code.
 * Syntax recovery cannot replace or discard already complete, valid components. */
export function repairAssemblyJson(source:string,patch:unknown):string {
  const {edits}=syntaxEdits.parse(patch);
  const ranges=edits.map(({find,replace})=>{
    const start=source.indexOf(find);
    if(start<0||source.indexOf(find,start+1)>=0)throw new Error('Syntax edit must match exactly once.');
    if(find.trim()===source.trim())throw new Error('Syntax repair cannot replace the whole response.');
    return {start,end:start+find.length,replace};
  }).sort((a,b)=>a.start-b.start);
  if(ranges.reduce((sum,r)=>sum+r.end-r.start+r.replace.length,0)>12_000)throw new Error('Syntax edits exceed the repair budget.');
  for(let i=1;i<ranges.length;i++)if(ranges[i].start<ranges[i-1].end)throw new Error('Syntax edits overlap.');
  let next=source;
  for(const range of ranges.toReversed())next=next.slice(0,range.start)+range.replace+next.slice(range.end);
  if(next.length>MAX_CHARS)throw new Error('The repaired assembly exceeds the response limit.');
  const before=completedParts(source),after=completedParts(next);
  for(const part of before){
    const retained=after.find(item=>item.id===part.id);
    if(!retained||JSON.stringify(retained)!==JSON.stringify(part))throw new Error('Syntax repair changed a complete component.');
  }
  // Require a parseable result before replacing the retained wire text.
  parseAssemblyJson(next);
  return next;
}
