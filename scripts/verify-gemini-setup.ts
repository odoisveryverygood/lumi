import {writeFile} from 'node:fs/promises';
import {generateText} from '../lib/ai';

// Public synthetic inputs only. Credentials and request/response bodies are never logged.
const checks=[];
for(const background of [false,true]){
 const started=Date.now();
 try{
  const result=await generateText('Return a JSON object with ok set to true.','Return {"ok":true}.',{transport:'interactions',thinkingLevel:'low',json:true,responseSchema:{type:'object',properties:{ok:{type:'boolean'}},required:['ok']},maxTokens:32768,timeoutMs:60000,background,...(!background?{onPartial:()=>{}}:{})});
  const valid=JSON.parse(result.text).ok===true;if(!valid)throw new Error('Unexpected synthetic response.');
  checks.push({mode:background?'background':'streaming',passed:true,model:result.model,thinkingLevel:'low',durationMs:Date.now()-started,performance:result.performance});
 }catch(error){checks.push({mode:background?'background':'streaming',passed:false,durationMs:Date.now()-started,error:error instanceof Error?error.message:'Request failed.'});}
}
await writeFile('work/gemini-setup-live.json',JSON.stringify({checkedAt:new Date().toISOString(),sdk:'@google/genai@2.31.0',checks,scope:'Synthetic SDK transport/configuration checks, not an end-to-end object-generation evaluation.'},null,2)+'\n');
console.log(JSON.stringify(checks));if(checks.some(c=>!c.passed))process.exitCode=1;
