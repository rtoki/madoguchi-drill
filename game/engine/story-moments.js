// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Optional, page-bound visuals. No new route, score, video or network request. */
const STORY_MOMENTS=(()=>{
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let session=null,key='',frame=0,elapsed=0,last=0,timer=null,drag=null;
 const photoShown=new Set();
 const config=page=>SCENARIO.moments?.[page?.key]||null;
 function current(){
  if(S.scr!=='multi')return null;
  const c=S.chapter;
  return c?.view==='read'?chapterPages(chapterNode(c.node))[c.page]:c?.view==='bad'?FAMILY_BAD_ENDINGS[c.badEnding]?.pages[c.badPage||0]:null;
 }
 const root=()=>document.getElementById('storyMoment');
 const active=()=>!!root()&&!document.hidden&&!S.panel&&!S.win&&S.zoom===null&&!isReadingBack();
 const moving=()=>!reduced.matches&&PORTRAIT_MOTION.preference()!=='off';
 const source=id=>SCENARIO.story.nodes.flatMap(n=>n.pages).find(p=>p.key===id);
 function position(page=current()){
  const value=S.chapter?.momentPositions?.[page?.key];
  return Number.isFinite(value)?Math.min(100,Math.max(0,value)):50;
 }
 function photo(scene,description,extra=''){
  return `<div class="multi-art moment-photo ${extra}" data-scene-key="${esc(scene)}" role="img" aria-label="${esc(description)}"></div>`;
 }
 function record(item,paper){
  const kind=paper?'paper':'screen';
  return `<div class="moment-record ${paper?'moment-paper':'moment-screen'}" ${paper?'data-paper-drag':''}><h2>${esc(paper?item.paperLabel:item.screenLabel)}</h2><dl>${item.rows.map(row=>`<dt>${esc(row.label)}</dt><dd${row.masked?' class="moment-covered"':''}>${row.masked?'<span>覆われている</span>':esc(row[kind])}</dd>`).join('')}</dl></div>`;
 }
 function recallFrame(item){
  const shot=item.frames[frame],page=source(shot.page);
  return `${photo(page.scene,shot.quote)}<div class="moment-recall-shade"></div><div class="moment-recall-copy"><span>${esc(page.time||'')} · 今日の記憶</span><p>「${esc(shot.quote)}」</p></div>`;
 }
 function html(page){
  const item=config(page);if(!item||!familyPagePresentation(page).last)return '';
  if(session!==S.chapter){photoShown.clear();session=S.chapter;key='';}
  if(key!==page.key){key=page.key;frame=0;elapsed=0;}
  const freshPhoto=!photoShown.has(page.key);if(item.kind==='photo')photoShown.add(page.key);
  let body='';
  if(item.kind==='compare'){
   body=`<div class="moment-compare-board">${record(item,false)}${record(item,true)}</div><label class="moment-slider-label" for="momentPaperPosition">紙を左右に動かす <span aria-hidden="true">↔</span></label><input id="momentPaperPosition" class="moment-slider" type="range" min="0" max="100" step="1" value="${position(page)}" aria-label="古い控えを左右に動かす">`;
  }else if(item.kind==='photo'){
   body=`<div class="moment-phone"><div class="moment-phone-photo">${photo(item.scene,item.description)}</div><div class="moment-phone-home" aria-hidden="true"></div></div>`;
  }else{
   body=`<div id="momentRecallFrame" class="moment-recall-frame">${recallFrame(item)}</div><button type="button" class="moment-replay" data-act="moment-replay" aria-label="短い回想をもう一度見る">↻</button>`;
  }
  return `<section id="storyMoment" class="story-moment moment-${item.kind}${item.kind==='compare'?' noadv':''}" aria-label="${esc(item.label)}" data-kind="${item.kind}" data-fresh="${freshPhoto}" data-motion="${moving()}" data-playing="false" style="--paper-position:${position(page)}"><span class="moment-caption">${esc(item.label)}</span>${body}</section>`;
 }
 function stop(){if(timer!==null)clearInterval(timer);timer=null;drag=null;}
 function sync(){
  stop();const el=root();if(!el)return;
  el.dataset.playing=String(active());el.dataset.motion=String(moving());
  const item=config(current());
  if(item?.kind==='recall'&&active()&&frame<item.frames.length){last=Date.now();timer=setInterval(tick,100);}
 }
 function tick(){
  const item=config(current());if(!item||item.kind!=='recall'||!root()){stop();return;}
  const now=Date.now(),delta=Math.min(250,Math.max(0,now-last));last=now;
  root().dataset.playing=String(active());
  if(!active()||GAME_READER.revealing())return;
  elapsed+=delta;
  if(elapsed<item.frames[frame].duration)return;
  if(frame===item.frames.length-1){stop();return;}
  frame++;elapsed=0;
  const target=document.getElementById('momentRecallFrame');if(target)target.innerHTML=recallFrame(item);
 }
 function replay(){
  const item=config(current());if(!active()||item?.kind!=='recall')return;
  frame=0;elapsed=0;const target=document.getElementById('momentRecallFrame');if(target)target.innerHTML=recallFrame(item);sync();
 }
 function move(value){
  if(!active()||config(current())?.kind!=='compare'||!Number.isFinite(value))return;
  const x=Math.min(100,Math.max(0,value)),c=S.chapter;
  c.momentPositions||={};c.momentPositions[current().key]=x;
  root().style.setProperty('--paper-position',String(x));
  const slider=document.getElementById('momentPaperPosition');if(slider)slider.value=String(Math.round(x));
 }
 document.addEventListener('input',e=>{if(e.target.id==='momentPaperPosition')move(Number(e.target.value));});
 document.addEventListener('change',e=>{if(e.target.id==='momentPaperPosition')saveFamilyProgress();});
 document.addEventListener('pointerdown',e=>{
  if(e.button!==0||!e.target.closest?.('[data-paper-drag]')||!active())return;
  const board=root().querySelector('.moment-compare-board');
  drag={id:e.pointerId,x:e.clientX,position:position(),width:board.getBoundingClientRect().width};
  e.target.setPointerCapture?.(e.pointerId);e.preventDefault();
 });
 document.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  move(drag.position+(e.clientX-drag.x)/Math.max(1,drag.width)*100/1.65);
 });
 function finishDrag(e){if(drag?.id===e.pointerId){drag=null;saveFamilyProgress();}}
 document.addEventListener('pointerup',finishDrag);document.addEventListener('pointercancel',finishDrag);
 document.addEventListener('visibilitychange',sync);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',sync);
 reduced.addEventListener?.('change',sync);
 return {config,html,sync,beforeRender:stop,replay,move,position,interactive:()=>!!root()};
})();
