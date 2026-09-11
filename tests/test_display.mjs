import test from 'node:test';
import assert from 'node:assert/strict';
import {progressOf,overlaps,childPreview} from '../static/js/event-model.js';
import {cleanDisplay,updateDisplay} from '../static/js/display.js';
import {timelineGroups,gantt,stats,overview} from '../static/js/timeline.js';
import {state} from '../static/js/state.js';

const start=new Date('2026-09-01T00:00'),end=new Date('2026-10-01T00:00');
const parent={id:'parent',title:'健身',kind:'record',parent_id:null,start:'2026-01-01T09:00',end:null,category_id:'life',status:'active',progress:null,minutes:null,notes:'',tags:[]};
const children=Array.from({length:8},(_,i)=>({...parent,id:`child-${i}`,parent_id:'parent',title:`散步 ${i}`,start:`2026-09-${String(i+1).padStart(2,'0')}T09:00`,end:`2026-09-${String(i+1).padStart(2,'0')}T10:00`}));

test('quiet defaults and defensive preference parsing',()=>{
 const p=cleanDisplay();assert.equal(p.hero_expanded,false);assert.equal(p.stats_expanded,false);assert.equal(p.child_limit,5);assert.ok(!p.stat_cards.includes('hours'));
 assert.deepEqual(cleanDisplay({stat_cards:[]}).stat_cards,[]);
 assert.deepEqual(cleanDisplay({stat_cards:['hours','unknown','hours']}).stat_cards,['hours']);
 assert.equal(cleanDisplay({child_limit:999,hero_expanded:'yes'}).child_limit,5);
});
test('only deliberate progress values appear',()=>{
 assert.equal(progressOf({progress:0}),null);
 assert.equal(progressOf({progress:null}),null);
 assert.equal(progressOf({progress:0,progress_explicit:true}),0);
 assert.equal(progressOf({progress:40}),40);
 assert.equal(progressOf({kind:'record',progress:100,status:'done'}),null);
});
test('ongoing records remain visible in later ranges',()=>{
 assert.ok(overlaps(parent,start,end));
 assert.ok(!overlaps(parent,new Date('2025-01-01'),new Date('2025-02-01')));
});
test('preview chooses recent N by occurrence then lays out chronologically',()=>{
 const result=childPreview(children,'parent',{start,end,limit:5});
 assert.equal(result.total,8);assert.deepEqual(result.events.map(e=>e.id),['child-3','child-4','child-5','child-6','child-7']);
 assert.equal(childPreview(children,'parent',{start,end,limit:3}).events.length,3);
});
test('matching children retain their parent as context; deletion and dates respected',()=>{
 const result=timelineGroups([parent,...children,{...children[0],id:'deleted',deleted:true}],{start,end},{parent:null,category:'all',status:'all',search:'散步 2',sort:'start',child_limit:5});
 assert.equal(result.length,1);assert.equal(result[0].matches,false);assert.equal(result[0].children.total,1);
 assert.equal(result[0].children.events[0].id,'child-2');
 const roots=timelineGroups([parent,...children],{start,end},{parent:null,category:'work',status:'all',sort:'start',child_limit:5});
 assert.equal(roots.length,0);
});
test('rendered preview hides blank progress and does not double-count children',()=>{
 globalThis.localStorage={setItem(){}};
 state.data={events:[parent,...children],journals:[],categories:[{id:'life',name:'生活',color:'#aabbcc'}]};
 Object.assign(state,{view:'month',anchor:'2026-09-11',parent:null,search:'',status:'all',category:'all',sort:'start',config:{subtitle:'test'}});
 updateDisplay({stat_cards:['hours'],child_limit:5,show_children:true,hero_expanded:false,stats_expanded:false});
 const html=gantt();
 assert.equal((html.match(/class="gantt-row child-row/g)||[]).length,5);
 assert.ok(!html.includes(' · 0%'));assert.ok(html.includes('最近 5 / 8'));
 assert.ok(stats().includes('未填写'));assert.ok(!stats().includes('0<small>小时'));
 assert.ok(overview().includes('id="hero-body" hidden'));assert.ok(overview().includes('id="stats-body" hidden'));
 updateDisplay({show_children:false});assert.ok(!gantt().includes('class="gantt-row child-row'));
});
