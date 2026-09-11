import {$,$$,esc,icon,toast} from './ui.js';

export const STAT_CARDS=[
 {id:'stories',name:'这一段的故事',hint:'区间内记录的数量',icon:'map',example:'12',unit:'件'},
 {id:'completed',name:'已完成的事情',hint:'已标记完成的普通任务',icon:'check',example:'3',unit:'件'},
 {id:'hours',name:'认真投入的时间',hint:'选填；没写用时就显示「未填写」',icon:'clock',example:'未填写',unit:''},
 {id:'journals',name:'留下的文字',hint:'区间内的日记篇数',icon:'book',example:'4',unit:'篇'}
];
export const COLUMN_WIDTH={min:190,max:480,default:280};
export function columnWidth(value){return typeof value==='number'&&Number.isFinite(value)?Math.max(COLUMN_WIDTH.min,Math.min(COLUMN_WIDTH.max,Math.round(value))):COLUMN_WIDTH.default;}
const defaults={hero_expanded:false,stats_expanded:false,stat_cards:['stories','completed','journals'],child_limit:5,show_children:true,label_width:COLUMN_WIDTH.default};
const key='dayisle-display-v2';
export let display={...defaults};
export function cleanDisplay(raw={}){
 const value={...defaults};
 for(const field of ['hero_expanded','stats_expanded','show_children'])if(typeof raw[field]==='boolean')value[field]=raw[field];
 if(Array.isArray(raw.stat_cards))value.stat_cards=STAT_CARDS.filter(c=>raw.stat_cards.includes(c.id)).map(c=>c.id);
 if([1,3,5,10,20].includes(Number(raw.child_limit)))value.child_limit=Number(raw.child_limit);
 value.label_width=columnWidth(raw.label_width);
 return value;
}
export function initDisplay(config={}){let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{}display=cleanDisplay({...config,...saved});}
export function updateDisplay(changes){display=cleanDisplay({...display,...changes});try{localStorage.setItem(key,JSON.stringify(display));}catch{toast('当前浏览器无法保存偏好；本次设置仍会生效。');}}

function preview(value){return `<div class="layout-preview" aria-label="页面排版预览"><div class="preview-heading">我的时间地图 <span>布局示意</span></div><div class="preview-fold">${icon('leaf')}开场寄语 <span>${value.hero_expanded?'已展开':'已折叠'}</span></div>${value.hero_expanded?'<div class="preview-hero">慢慢来，也在向前走。<span>给喜欢的日常，留一点空间。</span></div>':''}<div class="preview-fold">${icon('chart')}概览 <span>${value.stats_expanded?'已展开':'已折叠'}</span></div>${value.stats_expanded?`<div class="preview-stats">${STAT_CARDS.filter(c=>value.stat_cards.includes(c.id)).map(c=>`<div>${icon(c.icon)}<span>${c.name}</span><strong>${c.example}<small>${c.unit}</small></strong></div>`).join('')||'<p>不展示统计卡片</p>'}</div>`:''}<div class="preview-timeline" style="--preview-label:${Math.round(value.label_width/10)}%"><strong>时间线</strong><div class="preview-track"><span>健身 · 持续记录</span><i></i></div>${value.show_children?`<div class="preview-child"><span>↳ 周三散步</span><i></i></div><div class="preview-child"><span>↳ 周五拉伸</span><i></i></div><small>每个父事件最多预览 ${value.child_limit} 条最近的子记录</small>`:'<small>点击事件进入子时间线</small>'}</div></div>`;}

export function openDisplaySettings(render){
 let dialog=$('#display-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='display-dialog';dialog.className='display-dialog';dialog.setAttribute('aria-labelledby','display-title');document.body.append(dialog);}
 const checked=x=>x?'checked':'';
 dialog.innerHTML=`<form id="display-form"><div class="drawer-header"><div><div class="eyebrow">LESS, BUT YOURS</div><h2 id="display-title">让首页，只展示你想看的</h2></div><button class="icon-button" type="button" id="display-close" aria-label="关闭展示设置">${icon('close')}</button></div><div class="display-settings-body"><div class="display-options"><h3>开场与概览</h3><label class="check-option"><input type="checkbox" name="hero_expanded" ${checked(display.hero_expanded)}><span>展开开场寄语<small>那一段插画和问候，随时可以收起</small></span></label><label class="check-option"><input type="checkbox" name="stats_expanded" ${checked(display.stats_expanded)}><span>展开统计概览<small>关闭后只留下轻巧的展开入口</small></span></label><h3>展开概览时，显示哪些信息？</h3>${STAT_CARDS.map(c=>`<label class="check-option card-choice"><input type="checkbox" name="stat_cards" value="${c.id}" ${checked(display.stat_cards.includes(c.id))}>${icon(c.icon)}<span>${c.name}<small>${c.hint}</small></span></label>`).join('')}<h3>名称列宽度</h3><label class="width-option">事件与记录 <output id="column-width-output">${display.label_width} px</output><input type="range" name="label_width" aria-label="名称列宽度" min="${COLUMN_WIDTH.min}" max="${COLUMN_WIDTH.max}" step="1" value="${display.label_width}"><small>也可拖动表头右侧的分隔柄；双击恢复默认。</small></label><h3>子记录预览</h3><label class="check-option"><input type="checkbox" name="show_children" ${checked(display.show_children)}><span>在父事件下展示子记录<small>按照发生时间选取最近的几条</small></span></label><label class="limit-option">每个父事件最多展示<select name="child_limit" aria-label="子记录预览数量">${[1,3,5,10,20].map(n=>`<option value="${n}" ${display.child_limit===n?'selected':''}>${n} 条</option>`).join('')}</select></label></div><aside><div class="preview-label">即时预览</div><div id="display-preview">${preview(display)}</div><p class="form-hint">这里只调整页面展示，不修改你的记录。偏好会保存在当前浏览器。</p></aside></div><div class="drawer-actions"><button type="button" class="text-button" id="display-reset">恢复安静布局</button><div><button type="button" class="button secondary" id="display-cancel">取消</button><button class="button" type="submit">保存展示设置</button></div></div></form>`;
 const form=$('#display-form');
 const read=()=>cleanDisplay({hero_expanded:form.elements.hero_expanded.checked,stats_expanded:form.elements.stats_expanded.checked,stat_cards:new FormData(form).getAll('stat_cards'),show_children:form.elements.show_children.checked,child_limit:form.elements.child_limit.value,label_width:Number(form.elements.label_width.value)});
 form.oninput=form.onchange=()=>{const value=read();$('#display-preview').innerHTML=preview(value);$('#column-width-output').value=`${value.label_width} px`;};
 $('#display-close').onclick=()=>dialog.close();$('#display-cancel').onclick=()=>dialog.close();
 $('#display-reset').onclick=()=>{for(const name of ['hero_expanded','stats_expanded','show_children'])form.elements[name].checked=defaults[name];$$('input[name=stat_cards]',form).forEach(i=>i.checked=defaults.stat_cards.includes(i.value));form.elements.child_limit.value=defaults.child_limit;form.elements.label_width.value=defaults.label_width;form.dispatchEvent(new Event('change'));};
 form.onsubmit=e=>{e.preventDefault();updateDisplay(read());dialog.close();render();toast('展示设置已保存。');};
 dialog.showModal();
}
