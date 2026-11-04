// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Story presentation and panels */
/* The title animates existing photographs with compositor transforms, not another decoder. */
const TITLE_CINEMA=(()=>{
 let requested: boolean | null=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const playing=()=>requested===null?PORTRAIT_MOTION.preference()==='on'||PORTRAIT_MOTION.preference()==='auto'&&!reduced.matches:requested;
 function sync(){const el=document.querySelector<HTMLElement>('.title-cinema');if(el)el.dataset.playing=String(playing()&&!document.hidden&&!S.panel);}
 function toggle(){requested=!playing();render();}
 function html(){
  return `<div class="title-cinema" data-playing="${playing()}" aria-hidden="true">${['scene-family-waiting','scene-family-kurose-counter','scene-family-daughter','scene-family-stairwell'].map((key,i)=>`<div class="multi-art title-shot title-shot-${i}" data-scene-key="${key}"></div>`).join('')}<div class="title-cinema-shade"></div><div class="title-light-line"></div></div>`;
 }
 document.addEventListener('visibilitychange',sync);
 reduced.addEventListener?.('change',()=>{if(S.scr==='title')render();});
 function controls(){return `<button type="button" class="title-motion-toggle" data-act="title-cinema" aria-pressed="${playing()}">タイトルの演出：${playing()?'ON':'OFF'}</button>`;}
 return {html,controls,sync,toggle,playing};
})();

/* Story presentation adapter. Timing, speed, pause and forward actions live in
   GAME_READER, exactly as they do for the counter dialogue. */
let familyReaderScene: string | undefined='',familyReaderSceneAt=0;
function familyReaderPage(): ReaderPage | null{
 const el=document.getElementById('familyStoryText');if(!el)return null;
 const accessible=el.querySelector<HTMLElement>('.family-accessible'),visibleText=el.querySelector<HTMLElement>('[data-novel-visible]'),remaining=el.querySelector<HTMLElement>('[data-novel-rest]');
 const key=el.dataset.novelKey;if(!key||!accessible||!visibleText||!remaining)return null;
 return {
  key,text:accessible.textContent,last:!el.dataset.novelNext,
  delay:el.dataset.novelBeat==='reveal'?420:0,
  paint(visible,rest){
   const term=el.querySelector<HTMLElement>('[data-novel-term]');
   if(term){
    const label=term.textContent,start=(visible+rest).indexOf(label),ready=start>=0&&visible.length>=start+label.length;
    visibleText.textContent=ready?visible.slice(0,start):visible;
    term.hidden=!ready;
    const after=el.querySelector<HTMLElement>('[data-novel-after]');if(after)after.textContent=ready?visible.slice(start+label.length):'';
   }else visibleText.textContent=visible;
   remaining.textContent=rest;
   if(typeof SOUND!=='undefined')SOUND.revealStorySound(el.dataset.novelSource||key,(el.dataset.novelPrefix||'')+visible);
   el.classList.toggle('is-revealing',!!rest);
  },
  nextSlice(){
   if(!el.dataset.novelNext||!S.chapter)return false;
   S.chapter.readingSlice={key:el.dataset.novelSource,offset:Number(el.dataset.novelNext),text:el.dataset.novelText};
   render();return true;
  },
  sync({fresh,paused,reduced}){
   const art=document.querySelector<HTMLElement>('.multi-art');if(!art)return;
   const moving=(PORTRAIT_MOTION.canAnimate?PORTRAIT_MOTION.canAnimate():PORTRAIT_MOTION.preference()!=='off')&&!reduced;
   if(familyReaderScene!==art.dataset.sceneKey){familyReaderScene=art.dataset.sceneKey;familyReaderSceneAt=Date.now();if(moving)art.classList.add('novel-scene-enter');}
   art.classList.toggle('novel-camera',moving);
   art.dataset.novelPage=el.dataset.novelSource||key;
   art.dataset.novelFresh=String(fresh&&moving&&!paused);
   art.style.setProperty('--novel-camera-delay',`-${(Date.now()-familyReaderSceneAt)/1000}s`);
   art.style.animationPlayState=paused?'paused':'running';
  }
 };
}
function familyReaderMayAuto(){
 const c=S.chapter;if(!c)return false;
 const n=chapterNode(c.node),pages=n?chapterPages(n):[],p=pages[c.page];
 if(c?.view!=='read'||n?.puzzle||n?.training||p?.beat)return false;
 if(typeof STORY_MOMENTS!=='undefined'&&STORY_MOMENTS.interactive())return false;
 if(document.getElementById('familyStoryText')?.dataset.novelNext)return true;
 return !p?.decision&&!p?.document&&!pages[c.page+1]?.beat&&c.page<pages.length-1;
}
let familyReaderResizeTimer: ReturnType<typeof setTimeout> | undefined;
window.addEventListener('resize',()=>{
 clearTimeout(familyReaderResizeTimer);
 if(S.scr==='multi'&&(S.chapter?.view==='read'||S.chapter?.view==='bad')&&!S.panel)familyReaderResizeTimer=setTimeout(()=>render(),180);
});

function familyReadingText(text: string){
 // Manuscript line wrapping is not a pause. Keep explicit paragraphs and dialogue turns.
 return String(text).trim().split(/\n\s*\n/).map(paragraph=>{
  const lines=paragraph.split('\n').map(line=>line.trim()).filter(Boolean);
  return lines.reduce((out,line,i)=>out+(i?(line.startsWith('「')?'\n\n':lines[i-1]?.endsWith('」')?'\n':''):'')+line,'');
 }).join('\n\n');
}
// Display cuts do not create authored pages: decisions, clocks and saves keep
// their stable IDs. Character offsets survive a change of screen size.
function familyTextSlices(text: string,columns=28,lines=5): [StoryTextSlice,...StoryTextSlice[]]{
 const parts=[];let start=0;
 while(start<text.length){
  let row=1,col=0,end=start,sentence=0,paragraph=0,comma=0;
  for(const ch of text.slice(start)){
   const size=ch==='\n'?0:/[\u0000-\u007f]/.test(ch)?.58:1;
   if(ch==='\n'){row++;col=0;}else{if(col+size>columns){row++;col=0;}col+=size;}
   if(row>lines)break;
   end+=ch.length;
   if(/[。！？]/.test(ch))sentence=end;
   if(ch==='\n'){sentence=end;if(text[end-2]==='\n')paragraph=end;}
   if(ch==='、')comma=end;
  }
  if(end<text.length){
   // Prefer a substantial paragraph or sentence, then a clause in long prose.
   const substantial=start+(end-start)*.45;
   end=paragraph>=substantial?paragraph:sentence>start?sentence:comma>start?comma:end;
   while(end<text.length&&/[」』）】。！？、\n]/.test(text.charAt(end)))end++;
  }
  if(end<=start)end=start+(Array.from(text.slice(start))[0]?.length||1);
  parts.push({start,end,text:text.slice(start,end)});start=end;
 }
 const [first,...rest]=parts;return first?[first,...rest]:[{start:0,end:0,text:''}];
}
function familyPagePresentation(page: ScenarioPage | null | undefined): StoryPresentation{
 const text=familyReadingText(page?.text||''),key=page?.key||'',viewport=document.documentElement?.clientWidth;
 const node=S.chapter?.node?chapterNode(S.chapter.node):undefined;
 const moment=typeof STORY_MOMENTS!=='undefined'?STORY_MOMENTS.config(page):null;
 if(!viewport||S.chapter?.view!=='read'&&!moment||page?.beat||node?.puzzle)return {key,text,full:text,prefix:'',start:0,end:text.length,last:true};
 const height=document.documentElement.clientHeight||844;
 const mobile=viewport<=700,width=moment?(height<=540?viewport*.43:Math.min(viewport*.9,950)):mobile?viewport*.9:Math.min(viewport*.62,780),font=mobile?20:24;
 const columns=Math.max(12,Math.floor((width-(mobile?8:24))/(font*1.025)));
 const parts=familyTextSlices(text,columns,moment?3:height<=540?4:5);
 const saved=S.chapter?.readingSlice;
 const offset=saved?.key===key&&saved.text===text&&Number.isSafeInteger(saved.offset)&&saved.offset>=0&&saved.offset<text.length?saved.offset:0;
 const part=parts.find(p=>p.end>offset)||parts[0];
 return {key,...part,full:text,prefix:text.slice(0,part.start),last:part.end===text.length};
}
function familyStoryTextHTML(text: string,key: string,beat?: string){
 const dramatic=beat==='reveal';
 const part=familyPagePresentation({text,key,beat});text=part.text.trim();
 const term=key==='noon-004a'&&text.includes('口をパクパク')?'<button type="button" class="family-term-link noadv" data-act="family-term" data-v="agonal" data-novel-term hidden aria-haspopup="dialog" aria-label="口をパクパク：死戦期呼吸の説明を開く">口をパクパク</button><span aria-hidden="true" data-novel-after></span>':'';
 return `<p id="familyStoryText" class="multi-prose family-story-text${dramatic?' family-dramatic':''}" data-novel-key="${esc(key)}:${part.start}-${part.end}" data-novel-source="${esc(key)}" data-novel-next="${part.last?'':part.end}" data-novel-text="${esc(part.full)}" data-novel-prefix="${esc(part.prefix)}" data-novel-beat="${dramatic?'reveal':''}"><span class="family-accessible">${esc(text)}</span><span aria-hidden="true" data-novel-visible>${esc(text)}</span>${term}<span aria-hidden="true" data-novel-rest></span><span class="family-text-cursor" aria-hidden="true"> ▾</span></p>`;
}

function familyTermExplanationHTML(){
 return `<div class="family-term-explanation"><p>心停止の直後などにみられる、あえぐような不規則な呼吸です。口をパクパクさせたり、あごをしゃくり上げたりし、途切れ途切れに起こることがあります。</p><p class="family-term-important"><strong>普段どおりの呼吸ではありません。</strong></p><p>呼びかけに反応がなく、普段どおりの呼吸がない、または判断に迷う場合は、心停止と考えます。</p><p>周囲に助けを求め、119番通報とAEDの手配をして、ただちに胸骨圧迫を始めます。呼吸の確認は10秒以内にし、119番の指示にも従います。</p><div class="family-term-sources"><span>詳しい説明（別タブで開きます）</span><a href="https://www.city.narashino.lg.jp/soshiki/keibo/gyomu/shobo/kyukyu/okyusochi/aed_1.html" target="_blank" rel="noopener noreferrer">習志野市消防本部：呼吸の確認・死戦期呼吸 ↗</a><a href="https://www.fdma.go.jp/relocation/kyukyukikaku/oukyu/02jokyu/05shinpai/02_05_04.html" target="_blank" rel="noopener noreferrer">消防庁：応急手当WEB講習 ↗</a></div></div>`;
}
function openFamilyTerm(id: string){
 if(id!=='agonal'||S.scr!=='multi'||S.panel||S.chapter?.view!=='read')return;
 S.panel='family-term';render();chapterFocus('#p-close');
}
// Re-reading the document does not change an already committed response.
let familyLicenseEnlarged=false;
function familyLicenseAvailable(){
 const c=S.chapter;if(S.scr!=='multi'||c?.view!=='read')return false;
 if(c.node==='instructions')return true;
 if(c.node!=='daughter')return false;
 const node=chapterNode('daughter');if(!node)return false;
 const pages=chapterPages(node),first=pages.findIndex(p=>p.document==='daughter-license');
 return first>=0&&c.page>=first;
}
function familyLicenseButtonHTML(){
 return '<button type="button" class="family-document-link noadv" data-act="family-license" aria-haspopup="dialog">提示された免許証を見る <small>拡大 ↗</small></button>';
}
function openFamilyLicense(){
 if(S.panel||!familyLicenseAvailable())return;
 familyLicenseEnlarged=false;S.panel='family-license';SOUND.sfx('paper');render();chapterFocus('#p-close');
}
function familyLicensePanelHTML(){
 const card=daughterLicenseHTML();
 return `<div class="panel family-license-panel noadv" role="dialog" aria-modal="true" aria-label="提示された免許証"><header><b>提示された免許証</b><button type="button" class="btn" id="p-close" data-act="close">閉じる</button></header><div class="body"><div class="family-license-toolbar"><span>手元の書類</span><button type="button" class="btn" id="familyLicenseZoom" data-act="family-license-zoom" aria-pressed="${familyLicenseEnlarged}" aria-controls="familyLicenseViewport">${familyLicenseEnlarged?'全体を表示':'拡大する'}</button></div><div class="family-license-viewport" id="familyLicenseViewport" tabindex="0" role="region" aria-label="免許証。拡大した書類は左右にスクロールできます。"><div class="family-license-sheet${familyLicenseEnlarged?' is-enlarged':''}">${card}</div></div><p class="family-license-help">${familyLicenseEnlarged?'左右にスクロールして確認できます。':'「拡大する」で文字や写真を大きく表示できます。'}</p><p class="family-license-note">ゲーム内の架空の書類です。番号類は伏せています。</p></div></div>`;
}
function toggleFamilyLicenseZoom(){
 if(S.panel!=='family-license')return;
 familyLicenseEnlarged=!familyLicenseEnlarged;render();chapterFocus('#familyLicenseZoom');
}
function openFamilyEntry(){
 if(S.scr!=='title'||S.panel)return;
 S.panel='family-entry';render();chapterFocus('.family-entry-options button:not(:disabled)');
}
function familyEntryHTML(){
 const saved=readFamilySave(),c=saved?.chapter,id=c?.view==='chapter'?c.introNode:c?.view==='bridge'?PACING_ORDER.find(id=>!c.done.includes(id)):c?.node,n=chapterNode(id),block=n?pacingBlock(n.id):CHAPTER_BLOCKS.find(b=>b.act===c?.act);
 const progress=c?(c.view==='end'?'読了した物語を開く':block?'第'+(CHAPTER_BLOCKS.indexOf(block)+1)+'章 · '+block.title+'から再開':'保存した場面から再開'):familySaveUnavailableReason||'まだ続きの保存はありません';
 return `<div class="family-entry-content"><p class="family-entry-kicker">全${CHAPTER_BLOCKS.length}章 · 約${FAMILY_STATS.path_chars_min>=10000?(FAMILY_STATS.path_chars_min/10000).toFixed(1)+'万字':FAMILY_STATS.path_chars_min+'字'}</p><div class="family-entry-options"><button type="button" class="mbtn mode-entry" data-act="family-resume" ${saved?'':'disabled'}><span class="mode-title">続きから</span><span class="mode-description">${esc(progress)}</span></button><button type="button" class="mbtn mode-entry" data-act="chapter-start"><span class="mode-title">最初から</span><span class="mode-description">${esc(SCENARIO.entryCaption)}</span></button></div>${saved||familySaveUnavailableReason?'<p class="family-entry-note">「最初から」で物語を始めると、今の続きは新しい進行に置き換わります。</p>':''}</div>`;
}
function closeFamilyPanel(){
 const panel=S.panel;if(!['family-term','family-entry','family-license'].includes(panel||''))return;
 S.panel=null;render();chapterFocus(panel==='family-term'?'[data-act="family-term"]':panel==='family-license'?'[data-act="family-license"]':'#story-start');
}
function handleFamilyPanelKey(e: KeyboardEvent){
 if(!['family-term','family-entry','family-license'].includes(S.panel||''))return false;
 if(e.key==='Escape'){e.preventDefault();closeConsolePanel();return true;}
 if(e.key==='Tab'){
  const items=[...(document.querySelectorAll?.<HTMLElement>('.panel button:not(:disabled), .panel a[href], .panel [tabindex="0"]')||[])],first=items[0],last=items.at(-1);
  if(items.length&&(!items.some(item=>item===document.activeElement)||e.shiftKey&&document.activeElement===first||!e.shiftKey&&document.activeElement===last)){
   e.preventDefault();(e.shiftKey?last:first)?.focus();
  }
  return true;
 }
 return false;
}

function familyChapterCardHTML(node: ScenarioNode,action='chapter-begin'){
 const block=pacingBlock(node.id);if(!block)throw new Error("Missing chapter block: "+node.id);
 const number=CHAPTER_BLOCKS.indexOf(block)+1,page=chapterPages(node)[0];
 const previous=CHAPTER_BLOCKS[number-2],completed=previous?.nodes.every(chapterDone);
 return `<section class="multi-screen chapter-transition noadv">${chapterArt(page?.scene||'bg')}<div class="chapter-transition-wipe" aria-hidden="true"></div><header class="chapter-transition-top"><span>${completed?'第'+(number-1)+'章 読了':'STORY MODE'}</span></header><div class="chapter-transition-body"><p class="chapter-transition-number">第<span>${String(number).padStart(2,'0')}</span>章</p><time class="chapter-transition-time">${esc(node.time)}</time><h1 id="chapterTitle" tabindex="-1">${esc(block.title)}</h1><div class="chapter-transition-progress" role="img" aria-label="全${CHAPTER_BLOCKS.length}章のうち第${number}章">${CHAPTER_BLOCKS.map((_,i)=>`<span class="${i<number?'passed':''}"></span>`).join('')}</div><p class="chapter-transition-caption">${number} / ${CHAPTER_BLOCKS.length} CHAPTERS</p></div>${chapterFooter(`<button type="button" class="multi-primary chapter-begin" data-act="${action}">第${number}章を始める ▶</button>`)}</section>`;
}

function beginFamilyChapter(){
 const c=S.chapter;if(S.scr!=='multi'||S.panel||c?.view!=='chapter')return;
 const n=chapterNode(c.introNode);if(!n||!chapterAvailable(n.id))return;
 c.chapterIntros||=[];if(!c.chapterIntros.includes(n.block))c.chapterIntros.push(n.block);
 delete c.introNode;openChapterNode(n.id,true);
}

/* Stable save anchors and scenario defaults */
/* Optional authored interactions. A plain story needs no executable extension. */
let DAUGHTER_COUNTER_FIELDS: string[]=[];
function isDaughterCounter(){return false;}
function startDaughterCounter(){}
function finishDaughterCounter(){}
function daughterLicenseHTML(){return '';}
function startChapterCase(): never {throw new Error('This scenario has no counter exercise adapter.');}
function finishChapterCase(){}

function chapterPages(node: ScenarioNode){return node.pages(S.chapter!).filter(familyPageVisible);}
function scenarioPagesForSave(id: string,c: ScenarioProgress){return chapterNode(id)?.pages(c)||[];}

// Persist stable authored page IDs; numeric positions remain runtime-only.
function scenarioSaveAnchors(c: ScenarioProgress): ScenarioAnchors {
 const pages=(id: string)=>scenarioPagesForSave(id,c).filter(p=>Object.entries(p.when||{}).every(([key,value])=>c.choices[key]===value));
 const history: Record<string,string>={};
 for(const entry of c.readHistory||[]){
  const match=/^([^:]+):(\d+)(:decision)?$/.exec(entry.key||'');
  if(match){const key=pages(match[1]!)[+match[2]!]?.key;if(key)history[entry.key]=key;}
 }
 const progress: Record<string,string>={};
 for(const [id,index] of Object.entries(c.progress||{})){
  const key=pages(id)[index]?.key;if(key)progress[id]=key;
 }
 const bad=c.badEnding?FAMILY_BAD_ENDINGS[c.badEnding]?.pages:undefined;
 return {current:c.node?pages(c.node)[c.page]?.key:null,progress,history,
  bad:c.badEnding?bad?.[Math.min(c.badPage??Number.NaN,bad.length-1)]?.key:null,
  badFinished:!!c.badEnding&&c.badPage===bad?.length};
}
function restoreScenarioAnchors(saved: ScenarioSave){
 const a=saved.anchors,c=saved.chapter;if(!a)return !saved.scenarioId;
 const pages=(id: string)=>scenarioPagesForSave(id,c).filter(p=>Object.entries(p.when||{}).every(([key,value])=>c.choices[key]===value));
 if(c.view==='read'&&(!c.node||!a.current))return false;
 if(Object.keys(c.progress||{}).some(id=>!a.progress?.[id]&&!chapterNode(id)?.training))return false;
 if(a.current&&c.node&&c.view==='read'){
  const index=pages(c.node).findIndex(p=>p.key===a.current);if(index<0)return false;c.page=index;
 }
 for(const [id,key] of Object.entries(a.progress||{})){
  const index=pages(id).findIndex(p=>p.key===key);if(index<0)return false;c.progress[id]=index;
 }
 for(const entry of c.readHistory||[]){
  const match=/^([^:]+):(\d+)(:decision)?$/.exec(entry.key||'');if(!match)continue;
  const key=a.history?.[entry.key];if(!key)return false;
  const list=pages(match[1]!),index=list.findIndex(p=>p.key===key);if(index<0)return false;
  const page=list[index]!;
  entry.key=match[1]+':'+index+(match[3]||'');if(!match[3]&&typeof page.text==='string')entry.x=page.text;
 }
 if(a.bad&&c.view==='bad'){
  const ending=FAMILY_BAD_ENDINGS[c.badEnding];
  const index=ending?.pages.findIndex(p=>p.key===a.bad);if(index===undefined||index<0||!ending)return false;
  c.badPage=a.badFinished?ending.pages.length:index;
 }
 return true;
}

/* Photographic ending */
/* A short photographic curtain call. Only the current cut is mounted; no video decoder. */
const FAMILY_ENDING=(()=>{
 const cast=SCENARIO.ending.cast;
 const durations=[7200,...cast.map(()=>4600)],lastCut=durations.length,total=durations.reduce((a,b)=>a+b,0);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let session: ScenarioProgress | null=null,cut=0,elapsed=0,paused=false,timer: ReturnType<typeof setInterval> | null=null,last=0;
 const active=()=>S.scr==='multi'&&S.chapter?.view==='end'&&!S.panel&&!S.win&&S.zoom===null;
 const motion=()=>!reduced.matches&&PORTRAIT_MOTION.preference()!=='off';
 const root=()=>document.getElementById('familyEnding');
 function stop(){if(timer!==null)clearInterval(timer);timer=null;}
 // Reduced motion changes the pictures, not whether the credits advance.
 function begin(){stop();session=S.chapter;cut=0;elapsed=0;paused=false;}
 function prepare(){if(session!==S.chapter){begin();if(S.chapter?.endingSeen)cut=lastCut;}}
 function endingPortrait(id: string): PortraitAppearance {
  const person=LOOK[id];if(!person)throw new Error('Missing ending portrait: '+id);return person;
 }
 function art(person: Pick<StoryCast,'scene' | 'portrait'>,extra=''){
  return `<div class="multi-art ending-photo ${extra}" data-scene-key="${person.scene}" aria-hidden="true">${person.portrait?`<div class="ending-portrait">${avatar(endingPortrait(person.portrait),'calm',false,false)}</div>`:''}</div>`;
 }
 function frame(){
  if(cut===0)return `<article class="ending-frame ending-fin">${art({scene:SCENARIO.ending.scene})}<div class="ending-shade"></div><div class="ending-fin-copy"><h1 id="chapterTitle" tabindex="-1">FIN<span aria-hidden="true">.</span></h1></div></article>`;
  if(cut===lastCut)return `<article class="ending-frame ending-thanks"><div class="ending-cast-strip" aria-label="登場人物">${cast.map(p=>`<figure>${art(p)}<figcaption>${esc(p.name)}${p.role?`<small>${esc(p.role)}</small>`:''}</figcaption></figure>`).join('')}</div><div class="ending-thanks-copy"><h1 id="chapterTitle" tabindex="-1"><span>THANK YOU</span><span>FOR PLAYING<span class="ending-period">.</span></span></h1><p class="ending-message">最後までお付き合いいただき、<br class="ending-mobile-break">ありがとうございました。</p><span class="ending-signature">FIN / 証明書窓口ドリル</span></div></article>`;
  const person=cast[cut-1];if(!person)throw new Error("Missing ending cast: "+cut);
  return `<article class="ending-frame ending-cast ending-cast-${cut}">${art(person)}<div class="ending-shade"></div><span class="ending-cut-number" aria-hidden="true">0${cut}</span><div class="ending-cast-copy"><p class="ending-eyebrow">登場人物 <span>${String(cut).padStart(2,'0')} / ${String(cast.length).padStart(2,'0')}</span></p><div class="ending-name-rule" aria-hidden="true"></div><h1 id="chapterTitle" tabindex="-1">${esc(person.name)}</h1><p class="ending-roman">${esc(person.roman||'')}</p>${person.role?`<p class="ending-role">${esc(person.role)}</p>`:''}</div></article>`;
 }
 function controls(){
  return cut===lastCut?'<button type="button" data-act="ending-replay">もう一度見る</button><button type="button" data-act="chapter-map">物語を読み返す</button><button type="button" class="multi-primary" data-act="home">タイトルへ</button>':`<button type="button" data-act="ending-pause" aria-pressed="${paused}">${paused?'再生':'一時停止'}</button><span class="ending-auto-label">自動で進みます</span><button type="button" data-act="ending-skip">スキップ</button>`;
 }
 function html(){
  prepare();
  return `<section class="multi-screen family-ending noadv" id="familyEnding" aria-label="エンディング" data-motion="${motion()}" data-playing="false"><header class="ending-top"><span>STORY COMPLETE</span></header><div id="familyEndingFrames" class="ending-frames" aria-live="polite" aria-atomic="true">${frame()}</div><div class="ending-progress" aria-hidden="true"><span id="familyEndingProgress"></span></div><footer class="multi-footer ending-controls" id="familyEndingControls">${controls()}</footer></section>`;
 }
 function paint(){
  const el=root();if(!el)return;
  el.dataset.playing=String(active()&&!document.hidden&&!paused&&cut<lastCut);
  el.dataset.motion=String(motion());
  const progress=document.getElementById('familyEndingProgress');
  if(progress)progress.style.transform=`scaleX(${cut===lastCut?1:(durations.slice(0,cut).reduce((a,b)=>a+b,0)+elapsed)/total})`;
  const button=el.querySelector('[data-act="ending-pause"]');
  if(button){button.textContent=paused?'再生':'一時停止';button.setAttribute('aria-pressed',String(paused));}
 }
 function sync(){
  stop();if(!root())return;paint();
  if(active()&&!document.hidden&&!paused&&cut<lastCut){last=Date.now();timer=setInterval(tick,100);}
 }
 function tick(){
  if(!active()||document.hidden){sync();return;}
  const now=Date.now();elapsed+=Math.min(250,Math.max(0,now-last));last=now;
  if(elapsed>=(durations[cut]??0))next();else paint();
 }
 function show(){
  const frames=document.getElementById('familyEndingFrames'),buttons=document.getElementById('familyEndingControls');
  if(!frames||!buttons)return;
  const focused=document.activeElement?.getAttribute('data-act');
  frames.innerHTML=frame();
  // Keep controls (and keyboard focus) stable across automatic cast cuts.
  if(cut===lastCut){
   buttons.innerHTML=controls();if(session)session.endingSeen=true;saveFamilyProgress();
   chapterFocus('#chapterTitle');
  }else if(!buttons.querySelector('[data-act="ending-pause"]')){
   buttons.innerHTML=controls();if(focused)chapterFocus('[data-act="ending-pause"]');
  }
  sync();
 }
 function next(){if(!active()||cut===lastCut)return;stop();cut++;elapsed=0;show();}
 function skip(){if(!active())return;stop();cut=lastCut;elapsed=0;show();}
 function toggle(){if(!active()||cut===lastCut)return;paused=!paused;sync();}
 function replay(){if(!active())return;begin();show();}
 function key(e: KeyboardEvent){
  if(!active())return false;
  if(cut===lastCut)return false;
  if(e.key==='Escape'){e.preventDefault();skip();return true;}
  if(document.activeElement?.closest?.('button,a'))return false;
  if(e.key===' '){e.preventDefault();toggle();return true;}
  if(e.key==='Enter'||e.key==='ArrowRight'){e.preventDefault();next();return true;}
  return false;
 }
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',stop);
 window.addEventListener('pageshow',sync);
 reduced.addEventListener?.('change',sync);
 return {html,begin,sync,beforeRender:stop,next,skip,toggle,replay,key};
})();
