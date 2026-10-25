'use client';

type Props={active:'explore'|'studio'|'circuits';disabled?:boolean;onExplore?:()=>void;onStudio?:()=>void};
export default function WorkspaceNavigation({active,disabled=false,onExplore,onStudio}:Props){
 const items=[{id:'explore',label:'Explore',href:'/?workspace=explore',action:onExplore},{id:'studio',label:'Studio',href:'/?workspace=studio',action:onStudio},{id:'circuits',label:'Circuits',href:'/circuits',action:undefined}] as const;
 return <nav className="fx-navigation morf-workspace-nav" aria-label="Workspace">{items.map(item=>item.action||disabled?<button key={item.id} aria-current={active===item.id?'page':undefined} disabled={disabled} onClick={item.action}>{item.label}</button>:<a key={item.id} href={item.href} aria-current={active===item.id?'page':undefined}>{item.label}</a>)}</nav>;
}
