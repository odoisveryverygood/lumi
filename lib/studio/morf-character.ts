export type MorfMode='idle'|'thinking'|'scanning'|'pointing'|'explaining'|'success'|'alert';
type Activity={busy:boolean;progress:string;error?:string;partName?:string;answer:string;emotion:string;dragging:boolean};

/** Presentation follows real application activity; it never changes model/check results. */
export function morfActivity(activity:Activity):{mode:MorfMode;label:string}{
 if(activity.dragging)return {mode:'idle',label:'repositioning'};
 if(activity.busy)return /review|measur|render|inspect|check|verif/i.test(activity.progress)?{mode:'scanning',label:'inspecting'}:{mode:'thinking',label:'thinking'};
 if(activity.error)return {mode:'alert',label:'needs a look'};
 if(activity.emotion==='happy')return {mode:'success',label:'ready'};
 if(activity.answer)return {mode:'explaining',label:'explaining'};
 if(activity.partName)return {mode:'pointing',label:'exploring'};
 return {mode:'idle',label:'morf'};
}
