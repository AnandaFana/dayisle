import {$,$$,esc,icon,localDate,statusNames,toast,confirmAction} from './ui.js';
import {state,live,save,remove,refresh} from './state.js';
import {progressOf} from './event-model.js';

let rerender=()=>{};
export function configureEditors(fn){rerender=fn;}
export function writable(){if(state.demo){toast('这是独立的示例空间。点击顶部「开始我的记录」后即可保存自己的故事。');return false;}return true;}
const tags=value=>value.split(/[,，]/).map(t=>t.trim()).filter(Boolean);
const options=(items,value)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
const field=(label,html,hint='')=>`<label class="field"><span>${label}</span>${html}${hint?`<small>${hint}</small>`:''}</label>`;
const input=(name,value,type='text',extra='')=>`<input name="${name}" type="${type}" value="${esc(value)}" ${extra}>`;
const draftKey=(kind,id)=>`dayisle-draft-${kind}-${id||'new'}`;

async function openForm(kind,original,html,title,collect){
 const id=original?.id;const key=draftKey(kind,id);const dialog=$('#editor');
 $('#editor-content').innerHTML=`<form id="record-form"><div class="drawer-header"><div><div class="eyebrow">A MOMENT WORTH KEEPING</div><h2>${title}</h2></div><button type="button" class="icon-button" id="close-editor" aria-label="关闭编辑">${icon('close')}</button></div><div class="drawer-body">${html}<div id="form-error" class="form-error" hidden></div><p class="form-hint" id="draft-status">输入会暂存在当前浏览器；点击保存后才会写入本机文件。</p></div><div class="drawer-actions"><div>${id?`<button type="button" class="icon-button" id="delete-record" aria-label="删除记录" title="删除记录">${icon('trash')}</button>`:''}<button type="button" class="text-button" id="discard-draft">清除草稿</button></div><div><button type="button" class="button secondary" id="cancel-editor">关闭</button><button class="button" type="submit" id="save-record">${icon('check')}保存${kind==='journals'?'日记':'记录'}</button></div></div></form>`;
 const form=$('#record-form');
 try {const draft=JSON.parse(localStorage.getItem(key)||'null');if(draft){for(const [name,value] of Object.entries(draft)){const control=form.elements.namedItem(name);if(control){if(control.type==='checkbox')control.checked=value==='on';else control.value=value;}}$('#draft-status').textContent='已恢复上次未保存的草稿。';}}catch{}
 const stash=()=>{try{const draft=Object.fromEntries(new FormData(form));$$('input[type=checkbox]',form).forEach(control=>draft[control.name]=control.checked?'on':'off');localStorage.setItem(key,JSON.stringify(draft));$('#draft-status').textContent='草稿已暂存 · 尚未写入记录文件';}catch{$('#draft-status').textContent='浏览器草稿空间不可用，请及时保存。';}};
 form.addEventListener('input',stash);form.addEventListener('change',stash);
 const close=()=>dialog.close();$('#close-editor').onclick=close;$('#cancel-editor').onclick=close;
 $('#discard-draft').onclick=async()=>{if(await confirmAction('清除未保存草稿？','仅清除当前编辑内容，已经保存的记录不受影响。')){localStorage.removeItem(key);dialog.close();}};
 $('#delete-record')?.addEventListener('click',async()=>{
  if(!await confirmAction('删除这条记录？',kind==='events'?'此事件及其所有子事件将一并移出视图。关联日记会保留并解除关联；历史内容仍保存在 JSONL 中。':'记录将移出视图，历史内容仍保存在 JSONL 中。'))return;
  try{await remove(kind,id);localStorage.removeItem(key);if(state.parent&&!live('events').some(e=>e.id===state.parent))state.parent=null;dialog.close();rerender();toast('记录已移出视图');}catch(error){$('#form-error').hidden=false;$('#form-error').textContent=error.message;}
 });
 form.onsubmit=async e=>{e.preventDefault();const button=$('#save-record');button.disabled=true;$('#form-error').hidden=true;try{
  const record=collect(Object.fromEntries(new FormData(form)));await save(kind,{...original,...record,id});localStorage.removeItem(key);dialog.close();rerender();toast('已保存，给生活留下一笔。');
 }catch(error){$('#form-error').hidden=false;$('#form-error').textContent=error.message;if(error.message.includes('其他窗口')){try{await refresh();$('#form-error').textContent+=' 已读取最新版本，请核对当前输入后再次保存。';}catch{}}}finally{button.disabled=false;}};
 dialog.showModal();
 // Escape closes safely because every edit is drafted synchronously.
 $('input:not([type=hidden]),textarea',form)?.focus();
}

export function editEvent(id=null,parentId=state.parent){
 if(!writable())return;
 const original=live('events').find(e=>e.id===id);
 const parent=live('events').find(e=>e.id===(original?original.parent_id:parentId));
 const date=localDate();
 let start=`${date}T09:00`,end=`${date}T10:00`;
 if(parent){if(start<parent.start||parent.end&&end>parent.end){start=parent.start;end=parent.end||`${parent.start.slice(0,10)}T23:59`;}}
 const e=original||{kind:'task',title:'',category_id:parent?.category_id||(state.category!=='all'?state.category:live('categories')[0]?.id),start,end,status:'active',progress:null,minutes:null,notes:'',tags:[],parent_id:parent?.id||null};
 const descendants=new Set(id?[id]:[]);let old=-1;while(old!==descendants.size){old=descendants.size;live('events').forEach(x=>{if(descendants.has(x.parent_id))descendants.add(x.id);});}
 const html=`${field('事件名称',input('title',e.title,'text','required maxlength="160" placeholder="例如：健身、读书，或一个小项目"'))}
 ${field('记录方式',`<select name="kind">${options([['task','普通任务 · 有阶段目标'],['record','持续记录 · 慢慢积累的日常']],e.kind||'task')}</select>`,'持续记录适合健身、阅读、长期研究等，不展示任务状态和百分比。')}
 <div class="field-row">${field('所属分类',`<select name="category_id" required>${options(live('categories').map(c=>[c.id,c.name]),e.category_id)}</select>`)}<div id="task-status-field">${field('当前状态',`<select name="status">${options(Object.entries(statusNames),e.status)}</select>`)}</div></div>
 ${field('父事件',`<select name="parent_id">${options([['','独立事件（顶层）'],...live('events').filter(x=>!descendants.has(x.id)).map(x=>[x.id,x.title])],e.parent_id||'')}</select>`,'子记录需在父事件时间范围内；持续记录可以一直延续。')}
 <label class="check-option" id="open-ended-field"><input name="open_ended" type="checkbox" ${e.kind==='record'&&!e.end?'checked':''}><span>不设结束时间<small>让它成为持续积累的生活记录</small></span></label>
 <div class="field-row">${field('开始时间',input('start',e.start,'datetime-local','required'))}${field('结束时间',input('end',e.end||'','datetime-local'))}</div>
 <div class="field-row"><div id="task-progress-field">${field('完成进度（选填 %）',input('progress',progressOf(e)??'','number','min="0" max="100" step="1" placeholder="不填就不显示"'))}</div>${field('独立投入（选填分钟）',input('minutes',e.minutes||'','number','min="0" max="1000000" step="1" placeholder="不计时也没关系"'))}</div>
 <p class="form-hint" style="margin-bottom:18px">只填写这条记录自身的用时，不重复累计子记录。长期事项可以用每天的子记录留下进展。</p>
 ${field('标签',input('tags',e.tags.join('，'),'text','placeholder="用逗号分隔，例如：阅读，灵感"'))}
 ${field('记录、进展与收获',`<textarea name="notes" rows="7" maxlength="100000" placeholder="今天发生了什么？有什么想留下的？">${esc(e.notes)}</textarea>`)}`;
 const optionalNumber=value=>value==null||value.trim()===''?null:Number(value);
 openForm('events',original,html,original?'编辑这一段故事':parent?'添加一条子记录':'记录一件事',f=>({...f,end:f.end||null,progress:f.kind==='record'?null:optionalNumber(f.progress),progress_explicit:f.kind!=='record'&&f.progress!=null&&f.progress.trim()!=='',minutes:optionalNumber(f.minutes),tags:tags(f.tags),parent_id:f.parent_id||null}));
 const form=$('#record-form');
 const sync=()=>{const recording=form.elements.kind.value==='record';$('#task-status-field').hidden=recording;$('#task-progress-field').hidden=recording;$('#open-ended-field').hidden=!recording;form.elements.status.disabled=recording;form.elements.progress.disabled=recording;form.elements.end.disabled=recording&&form.elements.open_ended.checked;form.elements.end.required=!recording;};
 form.elements.kind.addEventListener('change',()=>{if(form.elements.kind.value==='record')form.elements.open_ended.checked=true;sync();form.dispatchEvent(new Event('input',{bubbles:true}));});
 form.elements.open_ended.addEventListener('change',sync);
 sync();
}
export function editJournal(id=null){if(!writable())return;const original=live('journals').find(e=>e.id===id);const j=original||{title:'',date:localDate(),mood:'平静',notes:'',tags:[],event_id:state.parent};
 const html=`${field('给今天一个标题',input('title',j.title,'text','required maxlength="160" placeholder="今天，有什么值得收藏？"'))}<div class="field-row">${field('记录日期',input('date',j.date,'date','required'))}${field('此刻的心情',`<select name="mood">${options(['开心','平静','充实','疲惫','低落'].map(m=>[m,m]),j.mood)}</select>`)}</div>${field('关联事件（可选）',`<select name="event_id">${options([['','独立日记'],...live('events').map(e=>[e.id,e.title])],j.event_id||'')}</select>`)}<div class="actions" style="margin:0 0 10px;justify-content:flex-start"><button type="button" id="journal-template" class="button secondary small">填入回顾提纲</button></div>${field('今天的文字',`<textarea name="notes" rows="13" maxlength="100000" placeholder="不必写得完美，真实就好。支持自由文字与 Markdown 源文。">${esc(j.notes)}</textarea>`)}${field('标签',input('tags',j.tags.join('，'),'text','placeholder="小确幸，读书随想…"'))}`;
 openForm('journals',original,html,original?'翻开这一页':'写一页日常',f=>({...f,tags:tags(f.tags),event_id:f.event_id||null}));
 $('#journal-template').onclick=()=>{const area=$('textarea[name=notes]');area.value+=(area.value?'\n\n':'')+'今天做了什么\n\n值得记住的瞬间\n\n一个新的发现\n\n明天的小愿望\n';area.dispatchEvent(new Event('input',{bubbles:true}));};
}
export function editCategory(id=null){if(!writable())return;const original=live('categories').find(c=>c.id===id);const c=original||{name:'',color:'#6d8b70'};openForm('categories',original,`${field('分类名称',input('name',c.name,'text','required maxlength="24" placeholder="例如：运动、创作、家庭"'))}${field('分类颜色',input('color',c.color,'color'))}<p class="form-hint">删除分类前，请先把该分类中的事件移动到其他分类。</p>`,'自定义生活分类',f=>f);}
