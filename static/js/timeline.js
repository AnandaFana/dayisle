import {esc,icon,localDate,addDays,dateAt,rangeFor,statusNames,illustration} from './ui.js';
import {state,live,categoryOf} from './state.js';
import {display,STAT_CARDS,COLUMN_WIDTH} from './display.js';
import {progressOf,endOf,overlaps,effortDate,childPreview} from './event-model.js';

export function currentRange(){return state.view==='custom'?{start:dateAt(state.customStart),end:addDays(dateAt(state.customEnd),1)}:rangeFor(state.anchor,state.view);}
export function scopedEvents(){const {start,end}=currentRange();return live('events').filter(e=>overlaps(e,start,end)&&(state.category==='all'||e.category_id===state.category));}
export function heading(kicker,title,subtitle,button){return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subheading">${subtitle}</p></div>${button||''}</div>`;}

export function stats(){
 const events=scopedEvents(),{start,end}=currentRange();
 const completed=events.filter(e=>e.kind!=='record'&&e.status==='done').length;
 const hours=events.filter(e=>effortDate(e)>=start&&effortDate(e)<end).reduce((s,e)=>s+(e.minutes||0),0)/60;
 const journals=live('journals').filter(j=>dateAt(j.date)>=start&&dateAt(j.date)<end).length;
 const values={stories:events.length,completed,hours:hours?Number(hours.toFixed(1)):'未填写',journals};
 const notes={stories:'包含子记录 · 与区间相交',completed:'当前已完成的普通任务',hours:hours?'手填独立用时':'不计时，也是在认真生活',journals:'区间内日记 · 全部分类'};
 const cards=STAT_CARDS.filter(c=>display.stat_cards.includes(c.id));
 return `<div class="stats-grid" style="--stat-count:${Math.max(cards.length,1)}">${cards.map(c=>`<div class="stat-card"><div class="stat-label">${c.name}${icon(c.icon)}</div><div class="stat-number ${c.id==='hours'&&!hours?'unfilled':''}">${values[c.id]}<small>${c.id==='hours'?(hours?'小时':''):c.unit}</small></div><div class="stat-foot">${notes[c.id]}</div></div>`).join('')||'<div class="stats-none">概览卡片已隐藏。你可以在展示设置中随时选回。</div>'}</div>`;
}

export function overview(){
 return `<section class="overview-folds" aria-label="可折叠的首页信息"><div class="overview-controls"><button class="fold-button ${display.hero_expanded?'expanded':''}" id="toggle-hero" aria-expanded="${display.hero_expanded}" aria-controls="hero-body">${icon('leaf')}开场寄语<span>${display.hero_expanded?'收起':'展开'}</span>${icon('down')}</button><button class="fold-button ${display.stats_expanded?'expanded':''}" id="toggle-stats" aria-expanded="${display.stats_expanded}" aria-controls="stats-body">${icon('chart')}统计概览<span>${display.stats_expanded?'收起':'展开'}</span>${icon('down')}</button><button class="button secondary small display-settings-button" id="display-settings">${icon('settings')}展示设置</button></div><div id="hero-body" ${display.hero_expanded?'':'hidden'}><section class="hero"><div><div class="hero-label">${esc(new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}))} · ${state.demo?'灵感示例':'我的生活手记'}</div><h2>慢慢来，也在向前走。</h2><p>${esc(state.config.subtitle)}</p><div class="hero-foot"><span class="local-dot"></span>今天想记住什么？给未来的自己留一条线索。</div></div>${illustration()}</section></div><div id="stats-body" ${display.stats_expanded?'':'hidden'}>${display.stats_expanded?stats():''}</div></section>`;
}

export function sideCards(){
 const journal=live('journals').sort((a,b)=>b.date.localeCompare(a.date))[0],events=scopedEvents();
 return `<div class="right-stack"><section class="panel"><div class="panel-header"><h2>一页日常</h2>${icon('book')}</div><div class="journal-preview">${journal?`<div class="journal-date">${esc(journal.date.replaceAll('-',' / '))} · 最近的记录</div><h3>${esc(journal.title)}</h3><p>${esc(journal.notes)}</p><span class="mood-pill">${esc(journal.mood)}</span>`:`<div class="journal-date">${localDate().replaceAll('-',' / ')}</div><h3>今天，有什么想记住的？</h3><p>一句话也好，一整个故事也好。把此刻的心情留在这里。</p>`}<button class="journal-link" id="side-journal">${journal?'翻开我的日记':'写下今天'}${icon('arrow')}</button></div></section><section class="panel"><div class="panel-header"><div><h2>生活的不同切面</h2><small>当前区间 · 记录数量占比</small></div></div><div class="distribution">${live('categories').map(c=>{const n=events.filter(e=>e.category_id===c.id).length;return `<div class="distribution-row" style="--cat:${esc(c.color)}"><div class="distribution-label"><span><i class="color-dot"></i> ${esc(c.name)}</span><span>${n} 件</span></div><div class="meter"><span style="width:${events.length?n/events.length*100:0}%"></span></div></div>`;}).join('')}</div></section></div>`;
}

function axes(start,end){
 const ticks=[];
 for(let d=new Date(start);d<end;){
  let next;
  if(state.view==='day'){next=new Date(d);next.setHours(d.getHours()+2);}
  else if(state.view==='year'||state.view==='quarter')next=new Date(d.getFullYear(),d.getMonth()+1,1);
  else next=addDays(d,1);
  const weight=(Math.min(next,end)-d)/(end-start)*100,offset=(d-start)/(end-start)*100;
  ticks.push({weight,offset,top:state.view==='day'?`${String(d.getHours()).padStart(2,'0')}:00`:state.view==='year'||state.view==='quarter'?`${d.getMonth()+1}月`:['日','一','二','三','四','五','六'][d.getDay()],bottom:state.view==='day'?'':state.view==='year'||state.view==='quarter'?d.getFullYear():d.getDate(),date:localDate(d)});
  d=next;
 }
 return ticks;
}

export function timelineGroups(all,range,options){
 const query=(options.search||'').toLocaleLowerCase();
 const matches=e=>(options.category==='all'||e.category_id===options.category)&&(options.status==='all'||(options.status==='record'?e.kind==='record':e.kind!=='record'&&e.status===options.status))&&(!query||[e.title,e.notes,...(e.tags||[])].join(' ').toLocaleLowerCase().includes(query));
 const groups=all.filter(e=>!e.deleted&&(e.parent_id||null)===(options.parent||null)&&overlaps(e,range.start,range.end)).map(e=>({event:e,children:childPreview(all,e.id,{...range,limit:options.child_limit,category:options.category,status:options.status,query}),matches:matches(e)})).filter(g=>g.matches||g.children.total>0);
 groups.sort((a,b)=>options.sort==='title'?a.event.title.localeCompare(b.event.title,'zh'):options.sort==='progress'?(progressOf(b.event)??-1)-(progressOf(a.event)??-1):options.sort==='duration'?(endOf(b.event)-new Date(b.event.start))-(endOf(a.event)-new Date(a.event.start)):a.event.start.localeCompare(b.event.start));
 return groups;
}

function eventRow(e,{child=false,solo=false,ticks,start,end,all,today}){
 const left=Math.max(0,(new Date(e.start)-start)/(end-start)*100),right=Math.min(100,(endOf(e)-start)/(end-start)*100);
 const category=categoryOf(e.category_id),progress=progressOf(e),children=all.filter(x=>x.parent_id===e.id).length;
 const span=right-left,short=span<18,suffix=progress===null?'':` · ${progress}%`;
 const dates=`${e.start.replace('T',' ')} → ${e.end?e.end.replace('T',' '):'持续记录中'}`;
 const descriptor=e.kind==='record'?'持续记录':statusNames[e.status];
 return `<div class="gantt-row ${child?'child-row':'parent-row'} ${solo?'solo-row':''}"><div class="gantt-label" style="--cat:${esc(category.color)}">${child?'<span class="child-branch" aria-hidden="true">↳</span>':''}<button class="event-name" data-open="${esc(e.id)}" title="打开 ${esc(e.title)} 的子时间线"><strong><i class="color-dot"></i>${esc(e.title)}</strong><small>${esc(category.name)} · ${descriptor}${children?` · ${children} 条子记录`:''}</small><span class="open-hint">${children?'查看子记录':'打开记录'} ${icon('right')}</span></button><button class="row-edit icon-button" data-edit="${esc(e.id)}" title="编辑 ${esc(e.title)}" aria-label="编辑 ${esc(e.title)}">${icon('edit')}</button></div><div class="gantt-track">${ticks.map(t=>`<span class="grid-line" style="left:${t.offset}%"></span>`).join('')}${today>=0&&today<=100?`<span class="today-line" style="--today:${today}%"></span>`:''}<button class="gantt-bar ${e.kind==='record'?'record-bar':''} ${short?'short-bar':''}" data-edit="${esc(e.id)}" aria-label="编辑时间条 ${esc(e.title)}${suffix}" title="${esc(e.title)} · ${esc(dates)}${suffix}" style="--left:${left}%;--width:${span}%;--progress:${progress??0}%;--cat:${esc(category.color)}">${progress!==null?'<span class="bar-progress"></span>':''}<span class="bar-caption">${short?'':`${esc(e.title)}${suffix}`}</span>${!e.end?'<span class="ongoing-mark">→</span>':''}</button>${short?`<button class="short-caption" data-edit="${esc(e.id)}" style="left:${Math.min(left,74)}%;--cat:${esc(category.color)}" title="${esc(dates)}">${esc(e.title)}${suffix}</button>`:''}</div></div>`;
}

export function gantt(){
 const {start,end}=currentRange(),all=live('events');
 const groups=timelineGroups(all,{start,end},{...state,...display});
 const ticks=axes(start,end),minimum=state.view==='month'?1300:state.view==='custom'?Math.max(780,ticks.length*40+250):780;
 const today=(new Date()-start)/(end-start)*100;
 let crumb='';
 if(state.parent){let chain=[],item=all.find(e=>e.id===state.parent);while(item){chain.unshift(item);item=all.find(e=>e.id===item.parent_id);}const current=chain.at(-1);crumb=`<div class="context-breadcrumb"><button data-parent="">全部事件</button>${chain.map(e=>`<span>/</span><button data-parent="${esc(e.id)}">${esc(e.title)}</button>`).join('')}<button id="edit-parent" title="编辑当前父事件">${icon('edit')}</button></div>${current?.notes?`<div class="context-notes">${esc(current.notes)}</div>`:''}`;}
 const options={ticks,start,end,all,today};
 return `${crumb}<div class="gantt-scroll"><div class="gantt" style="min-width:${minimum}px;--label-width:${display.label_width}px"><div class="gantt-head"><div class="gantt-label-head"><span>${state.parent?'子记录':'事件与记录'}</span><span>${groups.length} 项</span><div class="column-resizer" role="separator" tabindex="0" aria-label="调整名称列宽度" aria-orientation="vertical" aria-valuemin="${COLUMN_WIDTH.min}" aria-valuemax="${COLUMN_WIDTH.max}" aria-valuenow="${display.label_width}" title="拖动调整列宽 · 方向键微调 · 双击还原"><span aria-hidden="true">⋮</span></div></div><div class="gantt-axis">${ticks.map(t=>`<div style="flex:0 0 ${t.weight}%" class="axis-cell ${t.date===localDate()?'today':''}">${esc(t.top)}<strong>${esc(t.bottom)}</strong></div>`).join('')}</div></div>${groups.map(g=>`<section class="event-group" aria-label="${esc(g.event.title)} 及子记录">${eventRow(g.event,{...options,solo:groups.length===1})}${display.show_children?g.children.events.map(e=>eventRow(e,{...options,child:true})).join(''):''}${g.children.total?`<div class="children-footer"><span>${display.show_children?`当前区间预览最近 ${g.children.events.length} / ${g.children.total} 条子记录`:'子记录已折叠'}${g.matches?'':' · 父事件作为上下文显示'}</span><button class="button secondary small" data-open="${esc(g.event.id)}">查看全部子记录 ${icon('right')}</button><button class="button secondary small" data-add-child="${esc(g.event.id)}" aria-label="为 ${esc(g.event.title)} 添加子记录">${icon('plus')}记录一次</button></div>`:''}</section>`).join('')}</div>${groups.length?'':`<div class="empty-state"><div class="empty-symbol">${state.parent?'↳':'✳'}</div><h3>${state.search||state.status!=='all'?'没有找到符合条件的记录':state.parent?'把日常的小进展，留在这里':'你的故事，从这一笔开始'}</h3><p>${state.search?'试试其他关键词，搜索也会查找当前层级下的子记录。':'记一件今天做过的事，也可以为长期喜欢的事情留一个位置。'}</p><button class="button secondary" id="empty-add">${icon('plus')}${state.parent?'添加子记录':'记录第一件事'}</button></div>`}</div><div class="gantt-footer"><div class="legend">${live('categories').map(c=>`<button class="legend-category" data-color-category="${esc(c.id)}" style="--cat:${esc(c.color)}" title="调整 ${esc(c.name)} 的分类颜色"><i class="color-dot"></i>${esc(c.name)} ${icon('edit')}</button>`).join('')}</div><span>拖动表头分隔柄调宽 · 名称框 → 子时间线 · 时间条 → 编辑</span></div>`;
}

export function timelinePage(){
 const {start,end}=currentRange(),rangeLabel=`${localDate(start).replaceAll('-','.')} — ${localDate(addDays(end,-1)).replaceAll('-','.')}`;
 return `${heading('MAKE ROOM FOR YOUR DAYS','时间地图','记下发生的事，也容纳慢慢生长的日常。',`<button class="button" id="add-event">${icon('plus')}${state.parent?'添加子记录':'记录一件事'}</button>`)}${overview()}<div class="workspace-grid"><section class="panel timeline-panel"><div class="panel-header"><div><h2>时间线${state.parent?' <span class="heading-context">/ 子记录</span>':''}</h2><small>${rangeLabel}</small></div><span class="keyboard-hint">N 新建 · / 搜索</span></div><div class="tabs category-tabs"><button class="tab ${state.category==='all'?'active':''}" data-category="all">总览</button>${live('categories').map(c=>`<button class="tab ${state.category===c.id?'active':''}" data-category="${esc(c.id)}"><i class="color-dot" style="--cat:${esc(c.color)}"></i>${esc(c.name)}</button>`).join('')}<button class="tab" id="add-category" title="自定义分类" aria-label="自定义分类">${icon('plus')}</button><button class="tab color-settings" id="category-colors">${icon('edit')}分类配色</button></div><div class="timeline-toolbar"><div class="segmented">${[['day','日'],['week','周'],['month','月'],['quarter','季'],['year','年'],['custom','自定']].map(([v,label])=>`<button data-view="${v}" class="${state.view===v?'active':''}">${label}</button>`).join('')}</div><div class="date-controls">${state.view==='custom'?`<div class="range-custom"><input type="date" id="custom-start" aria-label="开始日期" value="${state.customStart}">—<input type="date" id="custom-end" aria-label="结束日期" value="${state.customEnd}"></div>`:`<button class="icon-button" id="prev-range" aria-label="上一时段">${icon('left')}</button><input id="anchor" type="date" aria-label="查看日期" value="${state.anchor}"><button class="icon-button" id="next-range" aria-label="下一时段">${icon('right')}</button><button class="text-button" id="today">今天</button>`}</div></div><div class="filter-row"><label class="search-field">${icon('search')}<input id="event-search" placeholder="搜索事件、子记录、标签…" aria-label="搜索事件" value="${esc(state.search)}"></label><select id="status-filter" aria-label="按状态筛选"><option value="all">全部状态</option><option value="record" ${state.status==='record'?'selected':''}>持续记录</option>${Object.entries(statusNames).map(([v,t])=>`<option value="${v}" ${state.status===v?'selected':''}>${t}</option>`).join('')}</select><select id="event-sort" aria-label="事件排序">${[['start','按开始时间'],['duration','按持续时间'],['progress','按完成进度'],['title','按事件名称']].map(([v,t])=>`<option value="${v}" ${state.sort===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="child-display-controls"><button class="button secondary small" id="toggle-children" aria-pressed="${display.show_children}">${icon('map')}${display.show_children?'收起子记录':'展开子记录'}</button><label>每项预览<select id="child-limit" aria-label="每项子记录预览数量">${[1,3,5,10,20].map(n=>`<option value="${n}" ${display.child_limit===n?'selected':''}>${n} 条</option>`).join('')}</select></label><span>最近发生的记录，按时间排列</span></div><div id="gantt-content">${gantt()}</div></section>${sideCards()}</div>`;
}
