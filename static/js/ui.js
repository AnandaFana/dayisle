export const $ = (selector, root=document) => root.querySelector(selector);
export const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 map:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 8h7M10 12h7M7 16h5"/>',
 book:'<path d="M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 1-3ZM3 17h17M8 7h7M8 11h5"/>',
 chart:'<path d="M4 3v17h17M8 15v-4M13 15V6M18 15V9"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
 left:'<path d="m14 6-6 6 6 6"/>',right:'<path d="m9 6 6 6-6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',check:'<path d="m5 12 4 4L19 6"/>',
 arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',leaf:'<path d="M20 3C7 2 2 8 5 15s16 6 15-12ZM4 21 15 9"/>',
 edit:'<path d="m4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4"/>', trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
export const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.leaf}</svg>`;
export const localDate = (date=new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const addDays = (date,n) => {const d=new Date(date);d.setDate(d.getDate()+n);return d;};
export const dateAt = value => new Date(`${value}T00:00:00`);
export const statusNames = {planned:'待开始',active:'进行中',done:'已完成',paused:'已暂停'};
export function rangeFor(anchor, view) {
 let start=dateAt(anchor),end;
 if(view==='week') start=addDays(start,-((start.getDay()+6)%7));
 if(view==='month') start.setDate(1);
 if(view==='quarter') {start.setDate(1);start.setMonth(Math.floor(start.getMonth()/3)*3);}
 if(view==='year') {start.setDate(1);start.setMonth(0);}
 end=new Date(start);
 if(view==='day') end=addDays(start,1);
 if(view==='week') end=addDays(start,7);
 if(view==='month') end.setMonth(end.getMonth()+1);
 if(view==='quarter') end.setMonth(end.getMonth()+3);
 if(view==='year') end.setFullYear(end.getFullYear()+1);
 return {start,end};
}
export function toast(message) {const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,5000);}
export async function api(path, body) {
 const response=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json','X-DayIsle':'1'},body:JSON.stringify(body)}:{});
 const result=await response.json(); if(!response.ok) throw new Error(result.error||'请求失败'); return result;
}
export function download(name, content, type='text/plain;charset=utf-8') {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function confirmAction(title,message) {$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;const d=$('#confirm-dialog');d.showModal();return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true}));}
export function illustration() {return `<svg class="island-art" viewBox="0 0 300 180" fill="none" aria-hidden="true"><ellipse cx="160" cy="153" rx="112" ry="15" fill="currentColor" opacity=".06"/><circle cx="237" cy="45" r="23" fill="#eedba5"/><path d="M35 141c26-48 72-46 109-37 43-48 90-19 123 38-60 22-164 20-232-1Z" fill="#d3dfc8"/><path d="M80 142c22-17 56-25 86-6s53 7 80 7" stroke="#a2b899" stroke-width="2"/><path d="M164 137V64m0 37c-30 0-40-18-34-36 18 0 35 10 34 36Zm1-13c25 1 40-16 34-33-21 0-35 13-34 33Z" fill="#789b73"/><path d="M84 126V79l36-12v58l-36 9V126Z" fill="#fffdf5" stroke="#a3b59b"/><path d="m120 67 31 12v53l-31-7V67Z" fill="#f2ead9" stroke="#a3b59b"/><path d="m93 90 18-6m-18 16 18-6m19-6 13 4m-13 7 13 4" stroke="#b7bea8" stroke-width="2"/><path d="M58 72c4-5 8-5 12 0m1-1c4-5 8-5 12 0" stroke="#89a081" stroke-width="2"/><circle cx="215" cy="120" r="4" fill="#e3b87b"/><path d="M215 124v18" stroke="#7e9474"/><path d="m29 36 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="#afbf9c"/></svg>`;}
