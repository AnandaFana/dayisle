// Legacy zero values were automatic defaults. Show zero only when explicitly entered.
export function progressOf(event) {
 if(event.kind==='record'||event.progress==null)return null;
 if(event.progress_explicit===false)return null;
 return event.progress_explicit===true||event.progress>0||event.status==='done'?event.progress:null;
}
export const endOf = event => event.end ? new Date(event.end) : new Date(8640000000000000);
export const overlaps = (event,start,end) => new Date(event.start)<end && endOf(event)>start;
export const effortDate = event => new Date(event.end||event.start);
export function childPreview(all,parentId,{start,end,limit=5,category='all',status='all',query=''}={}) {
 const matches=e=>(category==='all'||e.category_id===category)&&(status==='all'||(status==='record'?e.kind==='record':e.kind!=='record'&&e.status===status))&&(!query||[e.title,e.notes,...(e.tags||[])].join(' ').toLocaleLowerCase().includes(query));
 const children=all.filter(e=>e.parent_id===parentId&&!e.deleted&&(!start||overlaps(e,start,end))&&matches(e));
 const selected=children.sort((a,b)=>b.start.localeCompare(a.start)||a.id.localeCompare(b.id)).slice(0,limit);
 return {total:children.length,events:selected.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id))};
}
