import {display,updateDisplay,columnWidth,COLUMN_WIDTH} from './display.js';

let resizeObserver=null;
// Resize only the rendered grid; commit the preference when the gesture finishes.
export function bindColumnResize(root=document){
 resizeObserver?.disconnect();
 const handle=root.querySelector('.column-resizer');
 if(!handle)return;
 const grid=handle.closest('.gantt');
 let gesture=null,width=display.label_width;
 const maximum=()=>Math.max(COLUMN_WIDTH.min,Math.min(COLUMN_WIDTH.max,Math.floor((grid.parentElement?.clientWidth||800)*.6)));
 const apply=value=>{
  width=Math.min(maximum(),columnWidth(value));
  grid.style.setProperty('--label-width',`${width}px`);
  handle.setAttribute('aria-valuemax',String(maximum()));
  handle.setAttribute('aria-valuenow',String(width));
  handle.setAttribute('aria-valuetext',`${width} 像素`);
 };
 const save=()=>updateDisplay({label_width:width});
 const finish=cancel=>{
  if(!gesture)return;
  const previous=gesture;
  gesture=null;
  grid.classList.remove('is-resizing');
  if(cancel)apply(previous.width);else save();
  if(handle.hasPointerCapture(previous.id))handle.releasePointerCapture(previous.id);
 };
 handle.onpointerdown=e=>{
  if(e.button!==0||gesture)return;
  e.preventDefault();handle.focus();
  gesture={id:e.pointerId,x:e.clientX,width};
  handle.setPointerCapture(e.pointerId);
  grid.classList.add('is-resizing');
 };
 handle.onpointermove=e=>{if(gesture?.id===e.pointerId)apply(gesture.width+e.clientX-gesture.x);};
 handle.onpointerup=e=>{if(gesture?.id===e.pointerId)finish(false);};
 handle.onpointercancel=e=>{if(gesture?.id===e.pointerId)finish(true);};
 handle.onlostpointercapture=()=>finish(true);
 handle.ondblclick=()=>{apply(COLUMN_WIDTH.default);save();};
 handle.onkeydown=e=>{
  if(e.key==='Escape'&&gesture){e.preventDefault();finish(true);return;}
  if(gesture)return;
  const step=e.shiftKey?40:10;
  const values={ArrowLeft:width-step,ArrowRight:width+step,Home:COLUMN_WIDTH.min,End:COLUMN_WIDTH.max,Enter:COLUMN_WIDTH.default};
  if(!(e.key in values))return;
  e.preventDefault();apply(values[e.key]);save();
 };
 apply(width);
 if(typeof ResizeObserver!=='undefined'){
  resizeObserver=new ResizeObserver(()=>{if(!gesture)apply(display.label_width);});
  resizeObserver.observe(grid.parentElement);
 }
}
