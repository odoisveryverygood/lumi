import {searchObjectReferences} from '@/lib/studio/object-catalog';
export const runtime='nodejs';
export async function GET(request:Request){
 const url=new URL(request.url),query=(url.searchParams.get('q')||'').slice(0,200),raw=Number(url.searchParams.get('page')||0),page=Number.isFinite(raw)?Math.max(0,Math.min(1000,Math.floor(raw))):0;
 return Response.json(searchObjectReferences(query,page),{headers:{'cache-control':'public, max-age=3600'}});
}
