import {$,$$,esc,icon,api,localDate,dateAt,addDays,rangeFor,toast,download,confirmAction} from './ui.js';
import {state,live,refresh} from './state.js';
import {timelinePage,gantt,currentRange} from './timeline.js';
import {journalsPage,journalCards,reviewsPage,settingsPage,trashSection,themes} from './pages.js';
import {configureEditors,editEvent,editJournal,editCategory,writable} from './editors.js';
import {display,initDisplay,updateDisplay,openDisplaySettings} from './display.js';

import {bindColumnResize} from './column-resize.js';

const nav=[['timeline','时间地图','map'],['journals','一页日常','book'],['reviews','回望与生长','chart'],['settings','我的空间','settings']];
let reportText='';
const on=(selector,event,handler)=>$(selector)?.addEventListener(event,handler);
function themeSet(id){document.documentElement.dataset.theme=id;try{localStorage.setItem('dayisle-theme',id);}catch{}if(state.page==='settings')render();}
function go(page){state.page=page;render();window.scrollTo({top:0});}
function openParent(id){state.parent=id||null;state.search='';state.status='all';if(id){const e=live('events').find(e=>e.id===id);if(!e)return;state.category='all';if(e.end){state.view='custom';state.customStart=e.start.slice(0,10);state.customEnd=e.end.slice(0,10);if((dateAt(state.customEnd)-dateAt(state.customStart))/86400000>365){state.anchor=localDate();state.view='year';}}else{state.anchor=localDate();state.view='month';}}render();}
function bindGantt(){
 bindColumnResize();
 $$('[data-open]').forEach(b=>b.onclick=()=>openParent(b.dataset.open));
 $$('[data-edit]').forEach(b=>b.onclick=()=>editEvent(b.dataset.edit));
 $$('[data-add-child]').forEach(b=>b.onclick=()=>editEvent(null,b.dataset.addChild));
 $$('[data-color-category]').forEach(b=>b.onclick=()=>editCategory(b.dataset.colorCategory));
 $$('[data-parent]').forEach(b=>b.onclick=()=>openParent(b.dataset.parent));
 on('#edit-parent','click',()=>editEvent(state.parent));
 on('#empty-add','click',()=>editEvent());
}
function renderGantt(){$('#gantt-content').innerHTML=gantt();bindGantt();}
function bindSide(){on('#side-journal','click',()=>live('journals').length?go('journals'):editJournal());}
function bindTimeline(){
 on('#display-settings','click',()=>openDisplaySettings(render));
 on('#toggle-hero','click',()=>{updateDisplay({hero_expanded:!display.hero_expanded});render();});
 on('#toggle-stats','click',()=>{updateDisplay({stats_expanded:!display.stats_expanded});render();});
 on('#toggle-children','click',()=>{updateDisplay({show_children:!display.show_children});render();});
 on('#child-limit','change',e=>{updateDisplay({child_limit:Number(e.target.value)});renderGantt();});
 on('#category-colors','click',()=>go('settings'));
 on('#add-event','click',()=>editEvent());on('#add-category','click',()=>editCategory());
 $$('[data-category]').forEach(b=>b.onclick=()=>{state.category=b.dataset.category;render();});
 $$('[data-view]').forEach(b=>b.onclick=()=>{state.view=b.dataset.view;if(state.view==='custom'){const r=rangeFor(state.anchor,'week');state.customStart=localDate(r.start);state.customEnd=localDate(addDays(r.end,-1));}render();});
 const shift=direction=>{let d=dateAt(state.anchor);if(['day','week'].includes(state.view))d=addDays(d,direction*(state.view==='day'?1:7));else{d.setDate(1);d.setMonth(d.getMonth()+direction*({month:1,quarter:3,year:12}[state.view]||1));}state.anchor=localDate(d);render();};
 on('#prev-range','click',()=>shift(-1));on('#next-range','click',()=>shift(1));
 on('#anchor','change',e=>{if(e.target.value){state.anchor=e.target.value;render();}});
 on('#today','click',()=>{state.anchor=localDate();render();});
 const custom=()=>{const a=$('#custom-start').value,b=$('#custom-end').value;if(!a||!b)return;if(a>b){toast('结束日期不能早于开始日期');return;}if((dateAt(b)-dateAt(a))/86400000>365){toast('自定义范围最多 366 天，更长跨度请使用年视图分段查看。');return;}state.customStart=a;state.customEnd=b;render();};
 on('#custom-start','change',custom);on('#custom-end','change',custom);
 on('#event-search','input',e=>{state.search=e.target.value;renderGantt();});
 on('#event-sort','change',e=>{state.sort=e.target.value;renderGantt();});
 on('#status-filter','change',e=>{state.status=e.target.value;renderGantt();});
 bindGantt();bindSide();
}
function bindJournalCards(){
 $$('[data-journal]').forEach(b=>b.onclick=()=>editJournal(b.dataset.journal));on('#empty-journal','click',()=>editJournal());
 $$('[data-linked-event]').forEach(b=>b.onclick=()=>{state.page='timeline';openParent(b.dataset.linkedEvent);});
}
function bindJournals(){on('#add-journal','click',()=>editJournal());bindJournalCards();bindSide();on('#journal-search','input',e=>{state.journalSearch=e.target.value;const q=state.journalSearch.toLocaleLowerCase();$('#journal-list').innerHTML=journalCards(live('journals').filter(j=>[j.title,j.notes,j.date,...j.tags].join(' ').toLocaleLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)));bindJournalCards();});}
function bindReviews(){
 const invalidate=()=>{reportText='';$('#download-report').disabled=true;$('#report-output').textContent='范围已修改。点击「生成回顾」更新内容。';};
 $$('[data-report-period]').forEach(b=>b.onclick=()=>{const mode=b.dataset.reportPeriod;const anchor=mode==='lastweek'?localDate(addDays(new Date(),-7)):localDate();const r=rangeFor(anchor,mode==='month'?'month':'week');$('#report-start').value=localDate(r.start);$('#report-end').value=localDate(addDays(r.end,-1));$$('[data-report-period]').forEach(x=>x.classList.toggle('active',x===b));invalidate();});
 ['#report-start','#report-end','#report-category'].forEach(s=>on(s,'change',()=>{$$('[data-report-period]').forEach(x=>x.classList.remove('active'));invalidate();}));
 on('#report-form','submit',async e=>{e.preventDefault();const a=$('#report-start').value,b=$('#report-end').value;if(a>b){toast('结束日期不能早于开始日期');return;}const button=$('button[type=submit]',e.target);button.disabled=true;try{const query=new URLSearchParams({start:a,end:b,category:$('#report-category').value,demo:state.demo?'1':'0'});const result=await api('/api/report?'+query);reportText=result.markdown;$('#report-output').textContent=reportText;$('#download-report').disabled=false;}catch(error){toast(error.message);}finally{button.disabled=false;}});
 on('#download-report','click',()=>{if(reportText)download(`${state.demo?'示例-':''}时屿回顾-${$('#report-start').value}-${$('#report-end').value}.md`,reportText,'text/markdown;charset=utf-8');});
}
function bindSettings(){
 $('.settings-grid').insertAdjacentHTML('afterbegin',`<section class="panel settings-section"><h2>首页展示偏好</h2><p>开场、概览卡片和子记录预览，由你来决定。</p><button class="button secondary" id="settings-display">${icon('settings')}调整展示与预览</button></section>`);
 on('#settings-display','click',()=>openDisplaySettings(render));
 $('.settings-grid').insertAdjacentHTML('beforeend',trashSection());
 $$('[data-restore-id]').forEach(b=>b.onclick=async()=>{if(!writable())return;try{state.data=await api('/api/restore',{revision:state.data.revision,collection:b.dataset.restoreKind,id:b.dataset.restoreId});render();toast('已还原记录。');}catch(error){toast(error.message);}});
 $$('[data-theme-choice]').forEach(b=>b.onclick=()=>themeSet(b.dataset.themeChoice));
 $$('[data-edit-category]').forEach(b=>b.onclick=()=>editCategory(b.dataset.editCategory));on('#settings-add-category','click',()=>editCategory());
 on('#import-backup','click',()=>{if(writable())$('#backup-file').click();});
 on('#backup-file','change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('备份超过 5 MB，请调整服务端配置后使用 API 导入。');const backup=JSON.parse(await file.text());if(backup.format!=='dayisle-backup-v1')throw new Error('请选择时屿导出的 JSON 备份。');const info=`将合并 ${backup.events?.length||0} 条事件、${backup.journals?.length||0} 篇日记、${backup.categories?.length||0} 个分类。相同记录跳过，冲突记录会阻止本次全部导入。`;if(!await confirmAction('导入这份备份？',info))return;state.data=await api('/api/import',{revision:state.data.revision,backup});render();toast('备份已合并，现有记录已保留。');}catch(error){toast(error.message);}finally{e.target.value='';}});
}
export function render(){
 $('#navigation').innerHTML=nav.map(([page,title,ico])=>`<button class="nav-button ${state.page===page?'active':''}" data-page="${page}" ${state.page===page?'aria-current="page"':''}>${icon(ico)}${title}${state.page===page?'<i class="nav-dot"></i>':''}</button>`).join('');
 $$('[data-page]').forEach(b=>b.onclick=()=>go(b.dataset.page));
 $('#page-name').textContent=nav.find(x=>x[0]===state.page)[1];
 $('#demo-banner').hidden=!state.demo;$('#mode-label').textContent=state.demo?'示例空间':'本地记录';$('#demo-toggle').textContent=state.demo?'返回我的空间':'体验示例';
 $('#page').innerHTML=({timeline:timelinePage,journals:journalsPage,reviews:reviewsPage,settings:settingsPage}[state.page])();
 ({timeline:bindTimeline,journals:bindJournals,reviews:bindReviews,settings:bindSettings}[state.page])();
}
async function toggleDemo(force){try{const previous=state.demo;state.demo=force??!state.demo;try{await refresh();}catch(error){state.demo=previous;throw error;}state.parent=null;state.category='all';state.search='';state.anchor=localDate();state.view='week';render();}catch(error){toast(error.message);}}
async function init(){
 try{const [config,data]=await Promise.all([api('/api/config'),api('/api/state')]);state.config=config;state.data=data;state.view=config.defaults.view;let theme=config.defaults.theme;try{theme=localStorage.getItem('dayisle-theme')||theme;}catch{}document.documentElement.dataset.theme=themes.some(t=>t.id===theme)?theme:'mint';
 initDisplay(config.display);configureEditors(render);$('#theme-quick').innerHTML=icon('sun');on('#theme-quick','click',()=>{const index=themes.findIndex(t=>t.id===document.documentElement.dataset.theme);themeSet(themes[(index+1)%themes.length].id);toast('已切换为'+themes[(index+1)%themes.length].name);});on('#demo-toggle','click',()=>toggleDemo());on('#exit-demo','click',()=>toggleDemo(false));render();
 document.addEventListener('keydown',e=>{if($('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key.toLowerCase()==='n'&&state.page==='timeline'){e.preventDefault();editEvent();}if(e.key.toLowerCase()==='j'){e.preventDefault();editJournal();}if(e.key==='/'){e.preventDefault();$('#event-search,#journal-search')?.focus();}});
 document.addEventListener('visibilitychange',async()=>{if(!document.hidden&&!$('dialog[open]')&&!state.demo){try{const latest=await api('/api/state');if(latest.revision!==state.data.revision){state.data=latest;if(state.parent&&!live('events').some(e=>e.id===state.parent))state.parent=null;render();}}catch{toast('暂时无法连接本机服务，请检查启动窗口。');}}});
 }catch(error){$('#page').innerHTML=`<div class="fatal"><h2>暂时无法打开你的空间</h2><p>${esc(error.message)}</p><p>请确认 Python 服务正在运行，再刷新页面。</p></div>`;}
}
init();
