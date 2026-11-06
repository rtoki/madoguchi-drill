// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Secondary actions live in a pause menu; the scene keeps one forward action. */
let CONSOLE_PANEL_TRAIL: string[]=[];
let CLOCK_TIMELINE_RETURN: ClockTimelineReturn | null=null;
function clockTimelineReturn(){return CLOCK_TIMELINE_RETURN?.chapter===S.chapter?CLOCK_TIMELINE_RETURN:null;}
function clockTimeHTML(time: string,className=''){
 const label=esc(time);
 if(S.scr==='multi'&&S.chapter?.view!=='read')return `<time class="${className}">${label}</time>`;
 return `<button type="button" class="clock-timeline noadv ${className}" data-act="clock-timeline" aria-label="${label} · タイムラインを開く" title="タイムラインを開く"><time>${label}</time></button>`;
}
function openClockTimeline(){
 if(S.panel||S.win||S.zoom!==null)return;
 if(S.mode==='story'&&S.chapter){
  if(S.scr!=='play'&&!(S.scr==='multi'&&S.chapter.view==='read'))return;
  const c=S.chapter,n=chapterNode(c.node);if(!n)return;
  const time=S.scr==='play'?storyTime():chapterPages(n)[c.page]?.time||n.time;
  const back={chapter:c,scr:S.scr,view:c.view,node:c.node,page:c.page,person:c.person,act:c.act,time,reading:captureReadback()};
  openChapterTimeline(back);
 }else if(S.scr==='play'){
  openConsolePanel('timeline');
  requestAnimationFrame(()=>document.querySelector<HTMLElement>('.counter-timeline li:last-child')?.scrollIntoView({block:'nearest'}));
 }
}
function returnClockTimeline(){
 const back=clockTimelineReturn();if(!back||S.scr!=='multi'||S.chapter?.view!=='timeline'||S.panel)return;
 CLOCK_TIMELINE_RETURN=null;S.scr=back.scr;
 Object.assign(S.chapter,{view:back.view,node:back.node,page:back.page,person:back.person,act:back.act});
 render();requestAnimationFrame(()=>{restoreReadback(back.reading);document.querySelector<HTMLElement>('[data-act="clock-timeline"]')?.focus({preventScroll:true});});
}
function counterTimelineHTML(){
 if(!S.log.length)return '<p class="timeline-empty">まだ応対の記録はありません。</p>';
 return `<ol class="counter-timeline">${S.log.map(v=>`<li><time>${esc(v.time||v.context?.match(/^\d{2}:\d{2}/)?.[0]||'—')}</time><div><b>${esc(v.n==='―'?'情景':v.n||'情景')}</b>${v.context?`<small>${esc(v.context.replace(/^\d{2}:\d{2}\s*·\s*/,''))}</small>`:''}${feedbackHistoryHTML(v.feedback)}<p>${feedbackTextHTML(v.x,v.feedback)}</p></div></li>`).join('')}</ol>`;
}
function consoleMenuButtonHTML(action='menu'){
 return `<div class="console-quick-actions">${quickSoundHTML()}<button type="button" class="console-menu-button noadv" data-act="${action}" aria-label="メニュー" aria-haspopup="dialog"><span aria-hidden="true">☰</span></button></div>`;
}
function openConsolePanel(panel: string){
 if(panel==='sound'){S.settingsTab='sound';panel='settings';}
 if(panel==='settings'&&!['display','sound'].includes(S.settingsTab||''))S.settingsTab='display';
 if(S.panel&&S.panel!==panel)CONSOLE_PANEL_TRAIL.push(S.panel);else if(!S.panel)CONSOLE_PANEL_TRAIL=[];
 S.win=null;S.panel=panel;render();
 requestAnimationFrame(()=>document.querySelector<HTMLElement>(panel==='settings'?'.settings-tabs [aria-selected="true"]':'.panel .body button:not(:disabled), .panel #p-close')?.focus({preventScroll:true}));
}
function closeConsolePanel(){
 const closing=S.panel;
 if(!CONSOLE_PANEL_TRAIL.length&&['family-term','family-entry','family-license'].includes(S.panel||'')){closeFamilyPanel();return;}
 S.panel=CONSOLE_PANEL_TRAIL.pop()||null;render();
 requestAnimationFrame(()=>document.querySelector<HTMLElement>(S.panel?'.panel #p-close':closing==='timeline'?'[data-act="clock-timeline"]':closing==='desk'?`[data-act="desk"][data-group="${S.materialLibraryGroup||'work'}"]`:S.scr==='title'?'[data-act="settings"]':S.scr==='multi'?'[data-act="chapter-menu"]':'[data-act="menu"]')?.focus({preventScroll:true}));
}
function handleConsolePanelKey(e: KeyboardEvent){
 if(!['settings','menu','chapter-menu','desk','request','sound','about','log','timeline','chapter-notes','town-hall'].includes(S.panel||''))return false;
 if(e.key==='Escape'){e.preventDefault();closeConsolePanel();return true;}
 if(S.panel==='settings'&&e.target instanceof Element&&e.target.closest('.settings-tabs')&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
  e.preventDefault();selectSettingsTab(e.key==='Home'?'display':e.key==='End'?'sound':S.settingsTab==='sound'?'display':'sound');return true;
 }
 const items=[...(document.querySelectorAll?.<HTMLElement>('.panel button:not(:disabled), .panel a[href], .panel input, .panel select, .panel summary, .panel [tabindex="0"]')||[])].filter(el=>el.tabIndex>=0);
 if(e.key==='Tab'&&items.length){
  const i=items.findIndex(item=>item===document.activeElement);
  if(i<0||e.shiftKey&&i===0||!e.shiftKey&&i===items.length-1){e.preventDefault();items[e.shiftKey?items.length-1:0]?.focus();}
  return true;
 }
 if(['menu','chapter-menu'].includes(S.panel||'')&&['ArrowDown','ArrowUp'].includes(e.key)&&items.length){
  e.preventDefault();const i=items.findIndex(item=>item===document.activeElement);items[(i+(e.key==='ArrowDown'?1:items.length-1)+items.length)%items.length]?.focus();return true;
 }
 return false;
}
const MATERIAL_GROUPS=[{key:'work',label:'業務資料'},{key:'presented',label:'提示書類'}];
function groupedMaterials(group: string){return materials().filter(m=>group==='presented'?m.kind==='doc':m.kind!=='doc');}
function groupSelection(group: string){
 const list=groupedMaterials(group),saved=S.materialSelections?.[group];
 const index=Math.max(0,list.findIndex(m=>m.key===saved));
 return {list,index,item:list[index]};
}
function rememberMaterial(key: string){
 const item=materials().find(m=>m.key===key);if(!item)return;
 S.materialSelections||={};S.materialSelections[item.kind==='doc'?'presented':'work']=key;
}
function materialLaunchersHTML(){
 return `<div class="material-launchers">${MATERIAL_GROUPS.map(g=>{
  const {item}=groupSelection(g.key);
  return `<button type="button" class="material-launch noadv" data-act="desk" data-group="${g.key}" aria-haspopup="dialog" aria-label="${g.label}${item?'：'+esc(item.label):'：まだ提示されていません'}" ${item?'':'disabled'}><span class="shelf-preview" aria-hidden="true">${item?`<span class="library-picture">${materialPicture(item)}</span>`:'<span class="empty-document"></span>'}</span><span class="shelf-label">${g.label}${item?'':'<small>未提示</small>'}</span></button>`;
 }).join('')}</div>`;
}
// Launch the selected item directly. Switching stays inside the open document.
function openMaterialLibrary(group: string){
 const selected=group==='presented'?'presented':'work';
 const {item}=groupSelection(selected);if(!item)return;
 CONSOLE_PANEL_TRAIL=[];openMaterial(item.key);
}
function workMaterialNavigationHTML(){
 const list=groupedMaterials('work'),key=S.panel==='ref'?'guide':S.win;
 const index=list.findIndex(m=>m.key===key);if(index<0)return '';
 return `<nav class="material-view-nav noadv" aria-label="業務資料の切替"><button type="button" data-act="material-view-move" data-d="-1" aria-label="前の業務資料${index>0?'：'+esc(list[index-1]?.label):''}" ${index===0?'disabled':''}>‹</button><span>業務資料 <b>${index+1} / ${list.length}</b></span><button type="button" data-act="material-view-move" data-d="1" aria-label="次の業務資料${index<list.length-1?'：'+esc(list[index+1]?.label):''}" ${index===list.length-1?'disabled':''}>›</button></nav>`;
}
function moveOpenMaterial(delta: number){
 if(S.scr!=='play'||!(S.win||S.panel==='ref'&&S.flowFrom==='material'))return;
 const list=groupedMaterials('work'),key=S.panel==='ref'?'guide':S.win,index=list.findIndex(m=>m.key===key);
 if(index<0)return;
 const next=Math.max(0,Math.min(list.length-1,index+delta));if(next===index)return;
 const nextItem=list[next];if(!nextItem)return;openMaterial(nextItem.key);
 requestAnimationFrame(()=>document.querySelector<HTMLElement>('.material-view-nav button:not(:disabled)')?.focus({preventScroll:true}));
}
function handleMaterialViewerKey(e: KeyboardEvent){
 if(!(e.target instanceof Element)||!e.target.closest('.material-view-nav')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return false;
 e.preventDefault();moveOpenMaterial(e.key==='Home'?-999:e.key==='End'?999:e.key==='ArrowLeft'?-1:1);return true;
}
function movePresentedMaterial(delta: number,{wrap=true}={}){
 if(S.scr!=='play'||S.panel||S.zoom===null)return;
 const count=curCase()?.visitor.docs.length||0;if(count<2)return;
 const next=wrap?(S.zoom+delta+count)%count:Math.max(0,Math.min(count-1,S.zoom+delta));
 if(next===S.zoom)return;
 SOUND.sfx('paper');S.zoom=next;S.materialKey='doc:'+next;rememberMaterial(S.materialKey);render();
}
// Claim only an intentional one-finger horizontal gesture. Native vertical
// scrolling, pinch zoom, form controls and the chart's two-axis pan stay native.
let materialSwipe: MaterialSwipe | null=null,materialSwipeClickUntil=0;
function materialSwipeContext(){
 if(S.scr!=='play')return '';
 if(S.panel==='ref'&&S.flowFrom==='material')return 'work:guide';
 if(S.panel)return '';
 return S.zoom!==null?'presented:'+S.zoom:S.win?'work:'+S.win:'';
}
document.addEventListener('touchstart',e=>{
 materialSwipe=null;materialSwipeClickUntil=0;
 if(e.touches.length!==1)return;
 const key=materialSwipeContext(),target=e.target;if(!(target instanceof Element))return;
 const surface=target.closest?.(S.panel==='ref'?'.flow-panel':S.zoom!==null?'#zoom':'#win');
 if(!key||!surface||target.closest?.('button,a,input,select,textarea,label,summary,[contenteditable]:not([contenteditable="false"]),#flowViewport,.town-hall-viewport,.flow-tabs,[role="slider"]'))return;
 const t=e.touches[0];if(!t)return;
 materialSwipe={key,surface,id:t.identifier,x:t.clientX,y:t.clientY,started:Date.now(),horizontal:false};
},{passive:true});
document.addEventListener('touchmove',e=>{
 const g=materialSwipe;if(!g)return;
 const t=Array.from(e.touches).find(t=>t.identifier===g.id);
 if(e.touches.length!==1||!t||!g.surface.isConnected||g.key!==materialSwipeContext()){materialSwipe=null;return;}
 const dx=Math.abs(t.clientX-g.x),dy=Math.abs(t.clientY-g.y);
 if(!g.horizontal){
  if(Math.max(dx,dy)<12)return;
  if(dy>=dx/1.4||Date.now()-g.started>650||window.getSelection?.()?.isCollapsed===false){materialSwipe=null;return;}
  g.horizontal=true;
 }
 if(!e.cancelable){materialSwipe=null;return;}
 e.preventDefault();
 if(materialGesture)materialGesture.moved=true;
},{passive:false});
document.addEventListener('touchend',e=>{
 const g=materialSwipe;materialSwipe=null;
 if(!g?.horizontal||e.touches.length||!g.surface.isConnected||g.key!==materialSwipeContext())return;
 const t=Array.from(e.changedTouches).find(t=>t.identifier===g.id);if(!t)return;
 if(e.cancelable)e.preventDefault();
 // Some browsers emit a click after touchend, even after the view is replaced.
 // Suppress that click so the newly opened document is not immediately closed.
 materialSwipeClickUntil=Date.now()+700;
 const dx=t.clientX-g.x,dy=t.clientY-g.y;
 if(Math.abs(dx)<48||Math.abs(dx)<Math.abs(dy)*1.4)return;
 if(g.key.startsWith('presented:'))movePresentedMaterial(dx<0?1:-1,{wrap:false});
 else moveOpenMaterial(dx<0?1:-1);
},{passive:false});
document.addEventListener('touchcancel',()=>{materialSwipe=null;},{passive:true});
function consumeMaterialSwipeClick(e: MouseEvent){
 if(Date.now()>=materialSwipeClickUntil||e.detail===0)return false;
 materialSwipeClickUntil=0;e.preventDefault();e.stopPropagation();return true;
}
function focusMaterialLauncher(group: string){
 requestAnimationFrame(()=>document.querySelector<HTMLElement>(`[data-act="desk"][data-group="${group}"]`)?.focus({preventScroll:true}));
}
function normalScoreHTML(){
 if(S.mode!=='normal')return '';
 return `<div class="normal-score" role="group" aria-label="得点 ${S.score}点、${S.total}問中${S.correct}問正解"><span class="score-number"><small>得点</small><b>${S.score}</b><small>点</small></span><span class="score-correct">${S.total?`正解 ${S.correct} / ${S.total} 問`:'まだ回答していません'}</span></div>`;
}
function counterRequestHTML(){
 const r=currentVisitRequest();
 return `${r?`<section class="request-detail"><h3>${esc(r.document)}${r.quantity?' '+r.quantity+'通':''}</h3>${r.purpose?`<p>${esc(r.purpose)}</p>`:''}${r.detail?`<p>${esc(r.detail)}</p>`:''}</section>`:''}${personNotesHTML()}`;
}
function selectSettingsTab(tab: string){
 if(S.panel!=='settings'||!['display','sound'].includes(tab)||S.settingsTab===tab)return;
 S.settingsTab=tab;render();
 requestAnimationFrame(()=>document.getElementById('settings-'+tab+'-tab')?.focus({preventScroll:true}));
}
function settingsTabsHTML(){
 return `<nav class="settings-tabs" role="tablist" aria-label="設定の種類">${[['display','画面・操作'],['sound','サウンド']].map(([tab,label])=>`<button type="button" role="tab" id="settings-${tab}-tab" data-act="settings-tab" data-v="${tab}" aria-controls="settings-content" aria-selected="${S.settingsTab===tab}" tabindex="${S.settingsTab===tab?'0':'-1'}">${label}</button>`).join('')}</nav>`;
}
function captureSettingsView(){
 const body=document.getElementById('settings-content');if(!body)return null;
 const focus=document.activeElement as HTMLElement | null;
 return {tab:body.dataset.settingsTab,top:body.scrollTop,details:[...body.querySelectorAll('details')].map(el=>el.open),focus:focus&&body.contains(focus)?{id:focus.id,act:focus.dataset.act,value:focus.dataset.v}:null};
}
function restoreSettingsView(view: SettingsView | null){
 const body=document.getElementById('settings-content');if(!body||!view||view.tab!==body.dataset.settingsTab)return;
 body.querySelectorAll('details').forEach((el,i)=>{if(i<view.details.length)el.open=view.details[i]??false;});
 body.scrollTop=view.top;
 const f=view.focus,el=f?.id?document.getElementById(f.id):f?.act?body.querySelector<HTMLElement>(`[data-act="${f.act}"]${f.value!==undefined?`[data-v="${f.value}"]`:''}`):null;
 el?.focus({preventScroll:true});
}
function gameSettingsHTML(){
 if(S.settingsTab==='sound')return `<div class="console-settings">${soundControls()}</div>`;
 const count=(k: string)=>k==='すべて'?CASES.length:CASES.filter(c=>c.cat===k).length,all=count(S.cat);
 return `<div class="console-settings">${SCREEN_MODE.controls()}
 <section class="motion-settings"><h4>画面の明るさ</h4><div class="motion-options" role="group" aria-label="画面の明るさ">${[['auto','自動'],['light','ライト'],['dark','ダーク']].map(([v,label])=>`<button type="button" data-act="theme" data-v="${v}" aria-pressed="${(document.documentElement.dataset.theme||'auto')===v}">${label}</button>`).join('')}</div></section>
 ${motionControlsHTML()}${S.scr==='title'?`<div class="title-motion-setting">${TITLE_CINEMA.controls()}</div>`:''}
 ${GAME_READER.settings()}
 ${S.scr==='title'?`<details class="console-options title-settings" ${S.titleSettings?'open':''}><summary>通常モードの出題</summary><h4>証明の種類</h4><div class="motion-options">${CATS.map(k=>`<button type="button" data-act="cat" data-v="${k}" aria-pressed="${S.cat===k}">${esc(k==='すべて'?'すべて':CAT_LABEL[k])}</button>`).join('')}</div><h4>来庁者の数</h4><div class="motion-options"><button type="button" data-act="count" data-v="6" aria-pressed="${S.count==='6'}">ランダム ${Math.min(6,all)}人</button><button type="button" data-act="count" data-v="all" aria-pressed="${S.count==='all'}">全員 ${all}人</button></div></details>`:''}
 <details class="console-options"><summary>操作方法</summary><p>クリック・タップで文章送り。表示中に押すと全文を表示します。</p><p>Enter / Space：文章送り<br>1〜4：選択肢　Esc：メニュー・戻る</p><p>本文を上へスクロールすると、前の会話を読み返せます。</p></details>
 <button type="button" class="settings-link" data-act="about">このゲームについて <span aria-hidden="true">›</span></button></div>`;
}
