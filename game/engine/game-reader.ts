// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Shared reading lifecycle */
/* One reader for counter dialogue, story prose and BAD END prose.
   Adapters provide text and domain transitions; they never own a timer. */
const GAME_READER=(()=>{
 const modes: ReaderAdapter[]=[];
 let page: ReaderPage|null=null,owner: ReaderAdapter|null=null,key: string|null=null;
 let chars: string[]=[],shown=0,wait=0,elapsed=0,last=0,timer: ReturnType<typeof setInterval>|null=null,completed=false,suspended=false;
 let speed: ReaderSpeed='normal',auto=false;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const mode=()=>modes.find(item=>item.active());
 const blocked=()=>document.hidden||suspended||S.panel||S.win||S.zoom!==null||isReadingBack();
 const instant=()=>speed==='instant'||reduced.matches;
 const revealing=()=>!!page&&shown<chars.length;
 const mayAuto=()=>!!page&&auto&&owner===mode()&&!!owner.canAuto?.();
 function stop(){if(timer!==null)clearInterval(timer);timer=null;}
 function reset(){stop();page=null;owner=null;key=null;chars=[];shown=0;wait=0;elapsed=0;completed=false;}
 function paint(){
  if(!page)return;
  page.paint(chars.slice(0,shown).join(''),chars.slice(shown).join(''));
  if(!revealing()&&!completed){completed=true;page.complete?.();}
 }
 function schedule(){
  if(timer===null&&page&&!blocked()&&(revealing()||mayAuto())){last=Date.now();timer=setInterval(tick,20);}
 }
 function pause(){if(blocked())stop();else schedule();}
 function tick(){
  const now=Date.now(),delta=Math.min(200,Math.max(0,now-last));last=now;
  if(blocked())return;
  if(revealing()){
   wait-=delta;if(wait>0)return;
   const char=chars[shown++]!;
   wait=(speed==='fast'?12:28)+(/[。！？]/.test(char)?190:/[、…]/.test(char)?90:char==='\n'?220:0);
   if(instant())shown=chars.length;
   elapsed=0;paint();
  }else if(mayAuto()){
   elapsed+=delta;
   const hold=instant()?Math.max(2500,chars.length*65):Math.max(1500,chars.length*18);
   if(elapsed>=hold){elapsed=0;advance();}
  }
  if(!revealing()&&!mayAuto())stop();
 }
 function sync(){
  stop();const adapter=mode(),next=adapter?.read();
  if(!next){page=null;owner=null;return;}
  if(!adapter)return;
  const id=adapter.id+':'+next.key,fresh=key!==id||chars.join('')!==next.text;
  owner=adapter;page=next;
  // Completion belongs to this reader, even when UI state was restored separately.
  if(!fresh&&completed&&next.done===false)completed=false;
  if(fresh){key=id;chars=Array.from(next.text);shown=0;wait=next.delay||0;elapsed=0;completed=false;}
  if(next.done||instant())shown=chars.length;
  paint();
  // A completion callback can render the next state. Do not decorate stale DOM.
  if(page===next)next.sync?.({fresh,paused:!!blocked(),reduced:reduced.matches});
  schedule();
 }
 function finish(){
  if(!revealing())return false;
  shown=chars.length;elapsed=0;paint();
  if(!mayAuto())stop();else schedule();
  return true;
 }
 function reveal(){
  if(finish())return true;
  return !!page?.nextSlice?.();
 }
 function ready(expected?: string){
  const adapter=mode();
  if(!adapter||expected&&adapter.id!==expected||document.hidden||suspended||S.panel||S.win||S.zoom!==null)return false;
  if(consumeReadbackAdvance())return false;
  return !finish();
 }
 function decisionReady(expected?: string){return ready(expected)&&page?.last!==false;}
 function advance(expected?: string){
  if(!ready(expected)||page?.nextSlice?.())return;
  mode()?.next();
 }
 function setSpeed(value: string){if(value!=='normal'&&value!=='fast'&&value!=='instant')return;speed=value;render();}
 function toggleAuto(){auto=!auto;elapsed=0;render();}
 function controls(){return `<button type="button" class="family-auto" data-act="reader-auto" aria-pressed="${auto}">${auto?'自動送り ON':'自動送り'}</button>`;}
 function settings(){return `<section class="motion-settings"><h4>文章の表示速度</h4><div class="motion-options" role="group" aria-label="文章の表示速度">${[['normal','ふつう'],['fast','速い'],['instant','一括表示']].map(([value,label])=>`<button type="button" data-act="reader-speed" data-v="${value}" aria-pressed="${speed===value}">${label}</button>`).join('')}</div></section>`;}
 function positionKey(){const adapter=mode();return [adapter?.id,adapter?.position(),S.panel,S.win,S.zoom].join(':');}
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>{suspended=true;stop();});
 window.addEventListener('pageshow',()=>{suspended=false;sync();});
 reduced.addEventListener?.('change',sync);
 return {register(adapter: ReaderAdapter){if(modes.some(item=>item.id===adapter.id))throw Error('Duplicate reader mode: '+adapter.id);modes.push(adapter);},
  sync,beforeRender:stop,reset,pause,advance,decisionReady,reveal,finish,setSpeed,toggleAuto,controls,settings,revealing,
  automatic:()=>auto,positionKey,surface:(target: Element)=>mode()?.surface(target),
  snapshot:()=>({key,shown,text:chars.join(''),speed,automatic:auto,running:timer!==null})};
})();

/* Mode adapters */
/* Mode-specific rules plug into the same reader. No animation loops, input
   listeners or speed settings belong in these adapters. */
GAME_READER.register({
 id:'counter',active:()=>S.scr==='play',position:()=>[S.mode,S.ci,S.bi,beat()?.t].join(':'),
 surface:target=>target.closest('#stage'),
 read(){
  const el=document.querySelector<HTMLElement>('#mwText'),b=beat();if(!el||!b)return null;
  const full=textOf(b);
  return {key:[S.mode,curCase()?.id,S.ci,S.bi,b.t].join(':'),text:full,done:S.done,
   paint:visible=>paintStoryText(el,full,visible.length,b),
   complete(){if(!S.done)finishStoryLine();}};
 },
 // Reading automation stops before an answer, form, call or change of visitor.
 canAuto:()=>beat()?.t==='say'&&S.beats[S.bi+1]?.t==='say',
 next:()=>advanceCounterPage()
});
GAME_READER.register({
 id:'story',active:()=>S.scr==='multi'&&S.chapter?.view==='read',
 position:()=>[S.chapter!.node,S.chapter!.page,S.chapter!.readingSlice?.offset].join(':'),
 surface:target=>!chapterNode(S.chapter!.node)?.puzzle&&target.closest('.multi-reader'),
 read:()=>familyReaderPage(),canAuto:()=>familyReaderMayAuto(),next:()=>advanceStoryPage()
});
GAME_READER.register({
 id:'bad',active:()=>S.scr==='multi'&&S.chapter?.view==='bad',
 position:()=>[S.chapter!.badEnding,S.chapter!.badPage,S.chapter!.readingSlice?.offset].join(':'),
 surface:target=>{const c=S.chapter;return c?.view==='bad'&&(c.badPage||0)<(FAMILY_BAD_ENDINGS[c.badEnding]?.pages.length||0)&&target.closest('.multi-reader');},
 read:()=>familyReaderPage(),canAuto:()=>false,next:()=>advanceBadPage()
});

/* Pointer and keyboard input */
// Both modes use the reading surface. Controls keep their native action, and a
// scroll/drag (including one that returns to its starting point) is never a tap.
const READING_CONTROLS='button,a,input,select,textarea,label,summary,[contenteditable]:not([contenteditable="false"]),[role="button"],[role="slider"],[data-act]';
interface ReadingPointer {
 id: number; x: number; y: number; area: HTMLElement|null;
 top: number; key: string; blocked: boolean;
}
let readingPointer: ReadingPointer|null=null;
function readingTarget(event: Event): Element|null {
 const target=event.target;
 return target&&'closest' in target&&typeof target.closest==='function'?target as Element:null;
}
function readingSurfaceKey(){
 return GAME_READER.positionKey();
}
document.addEventListener('pointerdown',e=>{
 const target=readingTarget(e);
 if(!target?.closest('#stage')){readingPointer=null;return;}
 const area=readbackArea();
 readingPointer={id:e.pointerId,x:e.clientX,y:e.clientY,area,top:area?.scrollTop||0,key:readingSurfaceKey(),blocked:e.isPrimary===false||!!target.closest(READING_CONTROLS)};
});
document.addEventListener('pointermove',e=>{
 if(readingPointer&&readingPointer.id===e.pointerId&&Math.hypot(e.clientX-readingPointer.x,e.clientY-readingPointer.y)>8)readingPointer.blocked=true;
});
document.addEventListener('pointercancel',e=>{if(readingPointer&&readingPointer.id===e.pointerId)readingPointer.blocked=true;});
document.addEventListener('scroll',e=>{if(readingPointer&&readingPointer.area===e.target)readingPointer.blocked=true;},true);
function handleReadingSurfaceClick(e: MouseEvent){
 const target=readingTarget(e);
 if(!target?.closest('#stage')||target.closest(READING_CONTROLS)||S.panel||S.win||S.zoom!==null)return;
 const surface=GAME_READER.surface(target);if(!surface)return;
 const blocked=target.closest('.noadv');if(target.closest('.conversation-past')||blocked&&blocked!==surface)return;
 const pointer=readingPointer;readingPointer=null;
 if((e.button!==undefined&&e.button!==0)||window.getSelection?.()?.toString())return;
 if(e.detail!==0&&pointer&&(pointer.blocked||pointer.key!==readingSurfaceKey()||pointer.area!==readbackArea()||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8||Math.abs((readbackArea()?.scrollTop||0)-pointer.top)>8))return;
 GAME_READER.advance();
}
