import test from 'node:test';
import assert from 'node:assert/strict';
import {bindColumnResize} from '../static/js/column-resize.js';
import {cleanDisplay,updateDisplay,initDisplay,display} from '../static/js/display.js';

function fixture(){
 let saved=null,captured=null;
 globalThis.localStorage={setItem:(key,value)=>{saved=value;},getItem:()=>saved};
 updateDisplay({label_width:280});
 const attributes={},styles={};
 const grid={style:{setProperty:(key,value)=>styles[key]=value},classList:{add(){},remove(){}}};
 const handle={closest:()=>grid,focus(){},setAttribute:(key,value)=>attributes[key]=value,setPointerCapture:id=>{captured=id;},hasPointerCapture:id=>captured===id,releasePointerCapture:()=>{captured=null;}};
 bindColumnResize({querySelector:()=>handle});
 const pointer=(x,id=1)=>({button:0,pointerId:id,clientX:x,preventDefault(){}});
 const key=(key,shiftKey=false)=>handle.onkeydown({key,shiftKey,preventDefault(){}});
 return {handle,attributes,styles,pointer,key,saved:()=>JSON.parse(saved)};
}

test('drag stays aligned and persists only on release; preference survives reload',()=>{
 const f=fixture();f.handle.onpointerdown(f.pointer(300));f.handle.onpointermove(f.pointer(240));
 assert.equal(f.styles['--label-width'],'220px');assert.equal(f.saved().label_width,280);
 f.handle.onpointerup(f.pointer(240));assert.equal(f.saved().label_width,220);
 initDisplay({});assert.equal(display.label_width,220);
});
test('cancel, interrupted capture and unrelated pointers cannot accidentally save a width',()=>{
 const f=fixture();f.handle.onpointerdown(f.pointer(300));f.handle.onpointermove(f.pointer(400,2));
 assert.equal(f.attributes['aria-valuenow'],'280');
 f.handle.onpointermove(f.pointer(440));f.handle.onpointercancel(f.pointer(440));
 assert.equal(f.styles['--label-width'],'280px');assert.equal(f.saved().label_width,280);
 f.handle.onpointerdown(f.pointer(300));f.handle.onpointermove(f.pointer(400));f.key('Escape');
 assert.equal(f.styles['--label-width'],'280px');
 f.handle.onpointerdown(f.pointer(300));f.handle.onpointermove(f.pointer(400));f.handle.onlostpointercapture();
 assert.equal(f.styles['--label-width'],'280px');
});
test('keyboard and reset respect column bounds and accessible value',()=>{
 const f=fixture();f.key('ArrowLeft');assert.equal(f.saved().label_width,270);
 f.key('ArrowRight',true);assert.equal(f.saved().label_width,310);
 f.key('Home');f.key('ArrowLeft');assert.equal(f.saved().label_width,190);
 f.key('End');f.key('ArrowRight');assert.equal(f.saved().label_width,480);
 f.handle.ondblclick();assert.equal(f.attributes['aria-valuenow'],'280');
 assert.equal(cleanDisplay({label_width:'bad'}).label_width,280);
 assert.equal(cleanDisplay({label_width:Infinity}).label_width,280);
 assert.equal(cleanDisplay({label_width:10000}).label_width,480);
});
