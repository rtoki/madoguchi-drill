// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT


const CASES=SCENARIO.content.CASES;

const CATS=SCENARIO.content.CATS;
const CAT_LABEL=SCENARIO.content.CAT_LABEL;

const REF=SCENARIO.content.REF;



/* ---------------- 見た目（立ち絵） ---------------- */
const SKIN=SCENARIO.content.SKIN;
const LOOK=SCENARIO.content.LOOK;
const SENPAI=SCENARIO.content.SENPAI;
const SENPAI_NAME=SCENARIO.content.SENPAI_NAME;


// 2×2画像をSVGのビューポートで切り出す。画像未配置・読込失敗時は従来のSVG。
for (const [id, look] of Object.entries(LOOK)) look.photoId=id;
SENPAI.photoId="senpai";
const PHOTO_ASSETS=SCENARIO.content.PHOTO_ASSETS;
const EXPRESSION={calm:0,neutral:0,happy:1,smile:1,worried:2,serious:2,annoyed:3};
let assetFrame=0;
function avatar(p, mood, crop, motion=false){
  const cell=EXPRESSION[mood]??0;
  return `<span class="photo-portrait${crop?' cropped':''}" aria-hidden="true"><span class="portrait-cell" data-photo="${p.photoId}" style="background-position:${cell%2?100:0}% ${cell>1?100:0}%"></span>${motion&&!crop?motionVisitorHTML(p.photoId,cell):''}</span>`;
}
function loadPhotoAssets(){}
function updatePhotoLayout(){
  const st=$("#stage"),asset=PHOTO_ASSETS.bg;
  if(!st || !asset?.ready) return;
  const w=st.clientWidth,h=st.clientHeight;
  const scaledHeight=asset.height*Math.max(w/asset.width,h/asset.height);
  const edge=(scaledHeight*.648-(scaledHeight-h)/2)/h*100;
  st.style.setProperty("--photo-counter-start",`${edge.toFixed(3)}%`);
}
const COUNTER_CASE_MINUTES=28;
function counterClockProgress(){
 if(!beat())return 0;
 if(!Number.isFinite(beat().clockAt))S.beats=stampCounterTimes(S.beats);
 const b=beat();let fraction=0;
 if(b.t==='pc'&&S.pc){
  const current=S.pc.phase==='excel'?.7:S.pc.phase==='confirm'?.35:S.pc.searched?.15:0;
  S.pc.timeProgress=Math.max(S.pc.timeProgress||0,current);fraction=S.pc.timeProgress;
 }
 return Math.max(0,Math.min(1,b.clockAt+(b.clockEnd-b.clockAt)*fraction));
}
function storyTime(){
 if(S.chapter){
  const n=chapterNode(isDaughterCounter()?'daughter':'r2');
  const pages=isDaughterCounter()?chapterPages(n):[],at=pages.findIndex(p=>p.decision==='issuance');
  const from=clockMinutes(at>=0?pages[at].time:n.time),to=clockMinutes(at>=0?pages[at+1].time:n.endTime);
  return clockLabel(from+Math.floor((to-from)*counterClockProgress()+1e-7));
 }
 const elapsed=S.scr==='play'?S.ci*COUNTER_CASE_MINUTES+Math.floor(COUNTER_CASE_MINUTES*counterClockProgress()+1e-7):S.scr==='end'?S.queue.length*COUNTER_CASE_MINUTES:0;
 return clockLabel(9*60+elapsed+(S.scr==='title'?0:S.wait));
}
const CASE_CAPTIONS=SCENARIO.content.CASE_CAPTIONS;

const TOWN=SCENARIO.content.TOWN;
const FORMS=SCENARIO.content.FORMS;
const PEOPLE=SCENARIO.content.PEOPLE;
const ERA = {"明治":1867,"大正":1911,"昭和":1925,"平成":1988,"令和":2018};
function toDate(w){ const m=/^(明治|大正|昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日/.exec(w||""); if(!m) return null; return new Date(ERA[m[1]]+(m[2]==="元"?1:+m[2]), +m[3]-1, +m[4]); }
function ageOf(id){ const d=toDate((PEOPLE[id]||{}).birth); if(!d) return null; const n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--; return a; }
for (const c of CASES){ const a=ageOf(c.id); if (a) c.visitor.age=a; }

const PURPOSES=SCENARIO.content.PURPOSES;
const ID_BOXES=SCENARIO.content.ID_BOXES;

/* ---------------- 台詞 ---------------- */
const PROLOGUE=SCENARIO.content.PROLOGUE;
const OK_OPEN=SCENARIO.content.OK_OPEN;
const NG_OPEN=SCENARIO.content.NG_OPEN;
const GREET=SCENARIO.content.GREET;
const IDREQ=SCENARIO.content.IDREQ;
const CLOSE=SCENARIO.content.CLOSE;
const HANDOUT=SCENARIO.content.HANDOUT;
const CLOSE_ID=SCENARIO.content.CLOSE_ID;
const BYE_ID=SCENARIO.content.BYE_ID;
const BYE=SCENARIO.content.BYE;
const BYE_MOOD=SCENARIO.content.BYE_MOOD;

/* ---------------- util ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const pad3 = n => String(n).padStart(3,"0");
const stars = n => "★".repeat(n)+"☆".repeat(3-n);
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function wareki(d){ const y=d.getFullYear()-2018; return `令和${y}年${d.getMonth()+1}月${d.getDate()}日`; }
function loadBest(){ try{ return JSON.parse(localStorage.getItem(SCENARIO.bestKey)||"null"); }catch(e){ return null; } }
function saveBest(b){ try{ localStorage.setItem(SCENARIO.bestKey, JSON.stringify(b)); }catch(e){} }

/* ---------------- state ---------------- */
let S, FX = {};
function fresh(){
  return {scr:"title", mode:"normal", launchMode:"normal", cat:"すべて", count:"6", queue:[], ci:0, bi:0, beats:[], si:0,
    score:0, max:0, total:0, correct:0, wait:0, inc:0, hints:0, misses:[], recap:[], log:[], cs:{},
    ticket:1+Math.floor(Math.random()*80), visible:false, vmood:"calm", term:[], win:null, docs:false,
    ans:null, hint:false, perm:[], pick:[], res:[], cw:0, cm:0, fstage:0, ffix:false,
    panel:null, done:false, logged:"", confirmTitle:false, sound:true, handout:false, zoom:null, materialKey:"term", materialSelections:{}, materialsExpanded:false, tipsSeen:[], storyReveals:[]};
}
const curCase = () => isDaughterCounter()?DAUGHTER_CASE:CASES[S.queue[S.ci]];
const beat = () => S.beats[S.bi];

function logBeat(){
  const b=beat(); if (!b || S.scr!=="play") return;
  const key = S.ci+"-"+S.bi+"-"+b.t;
  if (S.logged===key || !(b.t==="say"||b.t==="ask"||b.t==="order")) return;
  S.logged=key; S.log.push({n:nameOf(b)||"―", x:textOf(b), feedback:b.feedback||null, time:storyTime(),context:storyTime()+" · "+curCase().visitor.name+"の応対"});
  if (S.log.length>300) S.log.shift();
}

function startGame(){
  GAME_READER.reset();
  let pool = CASES.map((c,i)=>i).filter(i=>S.cat==="すべて"||CASES[i].cat===S.cat);
  if (S.count==="6") pool = shuffle(pool).slice(0,6);
  else pool.sort((a,b)=>CASES[a].lv-CASES[b].lv||a-b);
  const keep={cat:S.cat,count:S.count,ticket:S.ticket,sound:S.sound};
  S = Object.assign(fresh(), keep, {scr:"play", queue:pool});
  S.beats = caseBeats(true); S.bi=0; run();
}
function endCase(){
  const c=curCase();
  S.recap.push({id:c.id, miss:S.cm, tag:c.end.tag, label:c.end.label});
  if(S.chapter?.caseActive){finishChapterCase();return;}
  if (S.ci+1 < S.queue.length){ S.ci++; S.ticket++; S.beats=caseBeats(false); S.bi=0; return; }
  S.scr="end";
  const pct = S.max ? S.score/S.max : 0;
  const best = loadBest();
  S.newBest = !best || pct>best.pct || (pct===best.pct && S.inc<best.inc);
  if (S.newBest) saveBest({score:S.score,max:S.max,pct,inc:S.inc,n:S.queue.length,date:new Date().toLocaleDateString("ja-JP")});
}

function typing(){ return S.scr==='play'&&GAME_READER.revealing(); }
function finishTyping(){ GAME_READER.finish(); }
function advance(){ GAME_READER.advance('counter'); }
function advanceCounterPage(){
  if (S.scr!=="play" || S.panel || S.win || S.zoom!==null) return;
  const b=beat(); if (!b) return;
  if (b.t==="pc"){openMaterial("term");return;}
  if (b.t==="card"){ chime(); S.bi++; run(); return; }
  if (b.t==="ask"||b.t==="order") return;
  SOUND.sfx("turn"); S.bi++; run();
}
function skip(){
  if (S.scr!=="play") return;
  GAME_READER.reset();
  for (let g=0; g<200; g++){
    const b=beat(); if (!b || b.t!=="say") break;
    logBeat(); S.bi++; runCore(); if (S.scr!=="play") break;
  }
  logBeat(); S.done=true; render();
}

// The story's morning clerk checks the written flow while Manabe is on the phone.
function storyCounter(){return S.mode==='story'&&!!S.chapter?.caseActive;}
function counterGuideName(){return storyCounter()?'業務フロー':SENPAI_NAME;}
function counterGuideText(text){
 const opening=[...OK_OPEN,...NG_OPEN].find(prefix=>text.startsWith(prefix));
 return opening?text.slice(opening.length):text;
}
function counterFeedbackBeat(b){
 if(!storyCounter()||!b.feedback)return b;
 return {...b,w:'f',scene:'scene-paperwork',x:counterGuideText(b.x)};
}
function answer(i){
  if(consumeReadbackAdvance())return;
  const b=beat(); if (!b || b.t!=="ask" || !S.done) return;
  const c=curCase(), st=c.steps[b.si];
  const idx=S.perm[i], ch=st.choices[idx], right=st.choices.find(x=>x.ok);
  if(isDaughterCounter()){finishDaughterCounter(ch?.id);return;}
  const ok=!!ch.ok, pts= ok ? (S.hint?50:100) : 0;
  S.score+=pts; S.max+=100; S.total++; S.res[b.si]=ok;
  S.cs[c.cat] = S.cs[c.cat] || {ok:0,n:0}; S.cs[c.cat].n++; if (ok){ S.correct++; S.cs[c.cat].ok++; }
  S.log.push({n:"あなた", x:ch.t, me:true,time:storyTime()});
  const fb=[];
  if (!ok){
    S.wait+=3; S.cw+=3; S.cm++; if (ch.incident) S.inc++;
    S.misses.push({title:c.title, cat:c.cat, ref:st.ref, q:st.q, mine:ch.t, right:right.t, rule:st.rule, inc:!!ch.incident});
  }
  S.vmood = ok ? "happy" : (S.cw>=6 ? "annoyed" : "worried");
  FX.stamp = ok ? "ok" : "ng";
  if (ch.incident) fb.push({t:"say",w:"s",m:"serious",feedback:feedbackMeta(false,"safety"),x:"ここはいったん止めよう。住民の権利や安全に関わる、大切な確認なんだ。"});
  if (ok) fb.push({t:"say",w:"s",m:"smile",feedback:feedbackMeta(true,"reason"),x:OK_OPEN[S.total%OK_OPEN.length]+right.fb+(S.mode==='normal'?`\n\n根拠のフロー：【${st.ref}】`:'')});
  else {
    fb.push({t:"say",w:"s",m:"serious",feedback:feedbackMeta(false,"review"),x:NG_OPEN[S.total%NG_OPEN.length]+ch.fb});
    fb.push({t:"say",w:"s",m:"calm",feedback:feedbackMeta(false,"correction"),x:`正しくは「${right.t}」。${right.fb}`});
    fb.push({t:"say",w:"n",feedback:feedbackMeta(false,"rule"),x:`【${st.ref}】${st.rule}`});
  }
  fb.push(...formBeats(b.si));
  S.beats.splice(S.bi+1,0,...stampCounterTimes(fb.map(counterFeedbackBeat),b.clockAt||0,b.clockEnd||0));
  S.bi++; run();
}
function pick(i){ const b=beat(); if (!b||b.t!=="order") return; const v=S.perm[i]; if(!S.pick.includes(v)) S.pick.push(v); render(); }
function commitOrder(){
  if(consumeReadbackAdvance())return;
  const b=beat(); if (!b||b.t!=="order"||S.pick.length!==curCase().steps[b.si].items.length) return;
  const c=curCase(), st=c.steps[b.si];
  const ok=S.pick.every((v,i)=>v===i), pts= ok ? (S.hint?50:100) : 0;
  S.score+=pts; S.max+=100; S.total++; S.res[b.si]=ok;
  S.cs[c.cat]=S.cs[c.cat]||{ok:0,n:0}; S.cs[c.cat].n++; if (ok){ S.correct++; S.cs[c.cat].ok++; }
  S.log.push({n:"あなた", x:S.pick.map(v=>st.items[v]).join(" → "), me:true,time:storyTime()});
  const fb=[];
  if (!ok){ S.wait+=3; S.cw+=3; S.cm++; S.misses.push({title:c.title,cat:c.cat,ref:st.ref,q:st.q,mine:S.pick.map(v=>st.items[v]).join(" → "),right:st.items.join(" → "),rule:st.rule}); }
  S.vmood = ok ? "happy" : "worried"; FX.stamp = ok ? "ok" : "ng";
  if (ok) fb.push({t:"say",w:"s",m:"smile",feedback:feedbackMeta(true,"reason"),x:OK_OPEN[S.total%OK_OPEN.length]+st.fb+(S.mode==='normal'?`\n\n根拠のフロー：【${st.ref}】`:'')});
  else { fb.push({t:"say",w:"s",m:"serious",feedback:feedbackMeta(false,"correction"),x:"この順番は不正解だよ。正しくは、"+st.items.map((t,i)=>`${i+1}. ${t}`).join("　")}); fb.push({t:"say",w:"s",m:"calm",feedback:feedbackMeta(false,"rule"),x:`【${st.ref}】${st.fb}`}); }
  fb.push(...formBeats(b.si));
  S.beats.splice(S.bi+1,0,...stampCounterTimes(fb.map(counterFeedbackBeat),b.clockAt||0,b.clockEnd||0)); S.bi++; run();
}
function useHint(){ if(isDaughterCounter())return;const b=beat(); if (!b||S.hint||!(b.t==="ask"||b.t==="order")) return; S.hint=true; S.hints++; S.wait+=1; S.log.push({n:counterGuideName(),x:(storyCounter()?"フローの確認：":"ヒント：")+curCase().steps[b.si].rule,time:storyTime()}); render(); }

function rankOf(pct,inc){
  let r;
  if (pct>=.9&&inc===0) r=["窓口の要","文句なし。迷いやすいところも、フローどおりに判断できてたよ。明日から隣は任せられるね。"];
  else if (pct>=.75&&inc===0) r=["頼れる主任","おおむね正確だった。間違えた分岐だけ、早見で見直しておこう。"];
  else if (pct>=.5) r=["窓口担当","基本の流れは押さえてる。保留と交付不可の境目を、もう一度確かめておこうか。"];
  else r=["新任研修中","最初はそんなもの。フロー早見を一通り読んでから、もう一度やってみよう。"];
  if (inc>0 && (r[0]==="窓口の要"||r[0]==="頼れる主任")) r=["窓口担当","正答率は高いけど、重大な誤りがあった。そこだけは窓口で起こさないようにしよう。"];
  return r;
}

/* ---------------- render ---------------- */
function sceneHTML(showSprite){
  if(isDaughterCounter())return chapterArt(beat()?.scene||'scene-family-daughter')+'<div class="scene-shade"></div>';
  const c = S.scr==="play" ? curCase() : null;
  const docs = c && S.docs && showSprite ? `<div class="docs ${FX.docs?"in":""}">${c.visitor.docs.map((d,i)=>docHTML(d,i)).join("")}</div><div class="docs-hint">書類をクリックすると拡大します</div>` : "";
  return `
    ${PHOTO_ASSETS.bg?.ready?`<div class="photo-bg">${motionSceneHTML(normalMotionKey())}</div><div class="scene-shade"></div>`:""}
    <div class="wall"></div>
    <div class="ceil"></div>
    <div class="lobby"></div>
    ${silHTML()}
    <div class="hang"><span class="hs"><i>2</i>住民異動</span><div class="sign">証明書交付窓口<i>3</i></div><span class="hs"><i>4</i>税証明</span></div>
    <div class="clock" aria-hidden="true">${clockSVG()}</div>
    <div class="led" aria-hidden="true"><small>お呼び出し番号</small><b>${S.scr==="play"?pad3(S.ticket):"---"}</b><span class="wait">お待ちの方 <b>${waiting()}</b>人</span></div>
    <div class="poster" aria-hidden="true"><b>お願い</b>証明書の請求には本人確認書類をご提示ください。<div class="ids"><span></span><span></span><span></span></div></div>
    ${c && S.visible && showSprite && beat()?.w!=="s" ? `<div class="sprite ${FX.enter?"enter":""}">${avatar(LOOK[c.id], beat()?.t==="say"&&storyFor(c)?.narrativeMood?storyFor(c).narrativeMood:S.vmood,false,!beat()?.scene&&beat()?.t!=='card')}</div>` : ""}
    <div class="glass"></div>
    <div class="counter"></div>
    `;
}
function staffPcHTML(){
  const rows=S.term.slice(0,3).map(([label,...values])=>`<span class="pc-row"><b>${esc(label)}</b><span>${values.map(v=>v&&typeof v==='object'?`<em class="pc-flag ${esc(v.tag)}">${esc(v.t)}</em>`:esc(v)).join(' ')}</span></span>`).join('');
  return `<button type="button" class="staff-pc noadv" data-act="tab" data-v="term" aria-label="職員用PCのformを開く"><span class="pc-screen"><span class="pc-brand">form <small>住民情報照会</small></span><span class="pc-search">⌕ 氏名・生年月日・住所</span><span class="pc-content">${rows||'<span class="pc-empty">用件と本人確認後に<br>対象者を検索します</span>'}</span></span><span class="pc-label"><span class="pc-long">職員用PC / </span>form を開く ↗</span></button>`;
}
function waiting(){
  if (S.scr!=="play") return 3;
  return Math.min(9, Math.max(0, S.queue.length - S.ci - 1) + 1 + Math.floor(S.wait/3));
}
function silHTML(){
  const pos=[6,14,22,61,70,79,88,30,54];
  const n=Math.min(pos.length, waiting());
  return pos.slice(0,n).map((x,i)=>`<span class="sil" style="left:${x}%;transform:scale(${[1,.92,1.06,.96,1.02,.9,1.08,.94,1][i]})"></span>`).join("");
}
function clockSVG(){
  const [hour,m]=storyTime().split(':').map(Number),h=hour%12+m/60;
  const ticks=Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180;return `<line x1="${50+38*Math.sin(a)}" y1="${50-38*Math.cos(a)}" x2="${50+43*Math.sin(a)}" y2="${50-43*Math.cos(a)}" stroke="var(--clock-ink)" stroke-width="${i%3?2:3.5}"/>`;}).join("");
  return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="var(--clock-face)" stroke="var(--clock-ink)" stroke-width="4"/>${ticks}
    <line id="clkH" x1="50" y1="50" x2="50" y2="26" stroke="var(--clock-ink)" stroke-width="5" stroke-linecap="round" transform="rotate(${h*30} 50 50)"/>
    <line id="clkM" x1="50" y1="50" x2="50" y2="14" stroke="var(--clock-ink)" stroke-width="3" stroke-linecap="round" transform="rotate(${m*6} 50 50)"/>
    <circle cx="50" cy="50" r="3.5" fill="var(--clock-ink)"/></svg>`;
}

/* Licensed jazz recordings with original synthesized interface sound effects. */
/* BUNDLE_SOUND */
/* Photographic Japanese sample-card layouts; all visible resident fields are fictional. */
function japaneseLicense(c,options={}){
  const p=options.person||PEOPLE[c.id]||{};
  return `<span class="jp-card license${options.story?' family-license-card':''}" role="img" aria-label="運転免許証の見本。氏名 ${esc(c.visitor.name)}。生年月日 ${esc(p.birth)}。住所 ${esc(p.addr)}。交付 令和5年8月10日。有効期限 令和10年8月12日。${options.story?'写真の縁が二重に見え、氏名欄の一部には紙片の段差がある。':''}番号は伏せ字。すべて架空。">
    <span class="lic-field lic-name">${esc(c.visitor.name)}</span>
    <span class="lic-field lic-birth">${esc(p.birth)} 生</span>
    <span class="lic-field lic-address">${esc(p.addr)}</span>
    <span class="lic-field lic-issued">令和5年8月10日　●●●●●</span>
    <span class="lic-field lic-valid">令和10年8月12日まで有効</span>
    <span class="lic-photo">${options.photo||avatar(LOOK[c.id],"calm",true)}</span>
    <span class="lic-field lic-number">●●●●●●●●●●●●</span>
    <span class="lic-field lic-issuer">○○県公安委員会</span>
  </span>`;
}
function japaneseSeal(){
  return `<span class="jp-card seal" role="img" aria-label="印鑑登録証の見本・こもれび町・登録番号のみで氏名や生年月日の記載なし"><span class="seal-number">●●●●●●</span></span>`;
}
function japaneseMyNumber(c){
  const p=PEOPLE[c.id]||{};
  return `<span class="jp-card mynumber" role="img" aria-label="マイナンバーカード表面の見本。氏名 ${esc(c.visitor.name)}。住所 ${esc(p.addr)}。生年月日 ${esc(p.birth)}。性別 ${esc(p.sex)}。有効期限 令和13年まで。こもれび町長。すべて架空。番号類は伏せ字、裏面・個人番号は表示しません。">
    <span class="mn-field mn-name">${esc(c.visitor.name)}</span>
    <span class="mn-field mn-address">${esc(p.addr)}</span>
    <span class="mn-field mn-sex">${esc(p.sex)}</span>
    <span class="mn-field mn-birth">${esc(p.birth)}</span>
    <span class="mn-field mn-valid">令和13年まで</span>
    <span class="mn-field mn-issuer">こもれび町長</span>
    <span class="mn-photo">${avatar(LOOK[c.id],"calm",true)}</span>
  </span>`;
}
function japaneseHealthInsurance(c){
  const p=PEOPLE[c.id]||{};
  return `<span class="jp-card health-insurance qualification-card" role="img" aria-label="国民健康保険の資格確認書の見本。氏名 ${esc(c.visitor.name)}。生年月日 ${esc(p.birth)}。住所 ${esc(p.addr)}。性別 ${esc(p.sex)}。有効期限 令和10年11月30日。写真欄なし。番号は伏せ字。研修用の架空書類。">
    <span class="health-title">国民健康保険　資格確認書</span><span class="health-sample">見本</span>
    <span class="health-label" style="top:18%">有効期限</span><span class="health-label" style="top:27.5%">記号・番号</span>
    <span class="health-label" style="top:37%">氏名</span><span class="health-label" style="top:46.3%">生年月日</span><span class="health-label" style="left:80%;top:46.3%">性別</span>
    <span class="health-label" style="top:56%">住所</span><span class="health-label" style="top:65.6%">交付年月日</span>
    <span class="health-label" style="top:77%">保険者番号</span><span class="health-label" style="top:85.4%">保険者名</span>
    <span class="insurance-field health-valid">令和10年11月30日</span>
    <span class="insurance-field health-number">●● ・ ●●●●</span>
    <span class="insurance-field health-name">${esc(c.visitor.name)}</span>
    <span class="insurance-field health-birth">${esc(p.birth)}</span>
    <span class="insurance-field health-sex">${esc(p.sex)}</span>
    <span class="insurance-field health-address">${esc(p.addr)}</span>
    <span class="insurance-field health-issued">●年●月●日</span>
    <span class="insurance-field health-insurer">●●●●●●●●</span>
    <span class="insurance-field health-issuer">こもれび町</span>
  </span>`;
}
function japaneseCareInsurance(c){
  const p=PEOPLE[c.id]||{};
  return `<span class="jp-card care-insurance" role="img" aria-label="介護保険被保険者証の見本。氏名 ${esc(c.visitor.name)}。住所 ${esc(p.addr)}。生年月日 ${esc(p.birth)}。性別 ${esc(p.sex)}。交付 令和3年4月1日。保険者 こもれび町。写真欄なし。番号は伏せ字。研修用の架空書類。">
    <span class="insurance-field care-number">●●●●●●●●●●</span>
    <span class="insurance-field care-address">${esc(p.addr)}</span>
    <span class="insurance-field care-name">${esc(c.visitor.name)}</span>
    <span class="insurance-field care-birth">${esc(p.birth)}</span>
    <span class="insurance-field care-sex">${esc(p.sex)}</span>
    <span class="insurance-field care-issued">令和3年4月1日</span>
    <span class="insurance-field care-insurer">●●●●●●</span>
    <span class="insurance-field care-issuer">こもれび町</span>
  </span>`;
}

function docHTML(name,i){
  const cell=/年金手帳/.test(name)?2:/登録証|保険|資格確認書/.test(name)?1:/免許|マイナンバー/.test(name)?0:3;
  const rot=[-7,4,-3,6,-4][i%5];
  const prop=isDaughterCounter()&&/免許/.test(name)?daughterLicenseHTML():/免許/.test(name)?japaneseLicense(curCase()):/マイナンバー/.test(name)?japaneseMyNumber(curCase()):/登録証/.test(name)?japaneseSeal():/介護保険/.test(name)?japaneseCareInsurance(curCase()):/保険証|資格確認書/.test(name)?japaneseHealthInsurance(curCase()):`<span class="prop" style="background-position:${cell%2?100:0}% ${cell>1?100:0}%"><span class="sample">見本</span></span>`;
  return `<button type="button" class="item ${cell===2?'book':''} noadv" id="doc-${i}" data-act="doc" data-i="${i}" style="--rot:${rot}deg" aria-label="${esc(name)}を拡大">${prop}<figcaption>${esc(name)}</figcaption></button>`;
}

function termNotesHTML(){
  if (!S.term || !S.term.length) return `<p class="empty">まだ検索していません。用件と本人確認が済んだら、formで対象者を検索します。</p>`;
  const q=(S.term.find(r=>r[0]==="form 検索")||[])[1];
  return `<div class="term-bar"><b>form</b><span class="q">${esc(q?q.split(" ")[0]:"―")}</span></div><dl>${S.term.map(r=>{
    const v=r.slice(1).map(x=> x&&typeof x==="object" ? `<span class="tag ${esc(x.tag)}">${esc(x.t)}</span>` : `<span>${esc(x)}</span>`).join("");
    return `<dt>${esc(r[0])}</dt><dd>${v}</dd>`;}).join("")}</dl>`;
}

function formHTML(){
  const c=curCase(), f=FORMS[c.id]||null, st=S.fstage;
  const filled = f && st>=1;
  const P = (v) => filled ? `<span class="pr">${esc(v)}</span>` : "";
  const today = wareki(new Date());
  let app="", tgt="";
  if (filled){
    const a=f.app;
    app = `<tr><th>氏名</th><td colspan="2"><span class="kana">${esc(a.kana)}</span><span class="pr">${esc(a.name)}</span></td><th>自署</th><td colspan="2" class="sig">${st>=2?`<span class="hand">${esc(a.name)}</span>`:""}</td></tr>
      <tr><th>生年月日</th><td colspan="2" class="pr">${esc(a.birth)}</td><th>申請日</th><td colspan="2" class="pr">${today}</td></tr>
      <tr><th>住所</th><td colspan="5" class="pr">${esc(a.addr)}</td></tr>`;
  } else {
    app = `<tr><th>氏名</th><td colspan="2"></td><th>自署</th><td colspan="2" class="sig"></td></tr><tr><th>生年月日</th><td colspan="2"></td><th>申請日</th><td colspan="2"></td></tr><tr><th>住所</th><td colspan="5">&nbsp;</td></tr>`;
  }
  if (filled){
    const same = f.tgt==="same";
    const t = same ? null : f.tgt;
    const val = (v, hand) => hand ? (st>=2?`<span class="hand">${esc(v)}</span>`:"") : `<span class="pr">${esc(v)}</span>`;
    const hs = f.honseki.mode==="print" ? `<span class="pr">${esc(f.honseki.v)}</span>` : f.honseki.mode==="hide" ? `<span class="mask">印字しない（現行運用）</span>` : "";
    const hit = f.honseki.mode==="print" ? `<span class="pr">${esc(f.honseki.hitto)}</span>` : "";
    tgt = `<tr><th>氏名</th><td colspan="5">${same?`<span class="on">■</span>１と同じ`:`□１と同じ　${t.kana?`<span class="kana">${esc(t.kana)}</span>`:""}${val(t.name,t.hand)}`}</td></tr>
      <tr><th>続柄</th><td colspan="2" class="pr">${esc(f.rel)}</td><th>生年月日</th><td colspan="2">${same?`<span class="pr">${esc(f.app.birth)}</span>`:(t.birth?val(t.birth,t.hand):"")}</td></tr>
      <tr><th>住所</th><td colspan="5">${same||(t&&t.addr==="same")?`<span class="on">■</span>１と同じ`:`□１と同じ　${val(t.addr,t.hand)}`}</td></tr>
      <tr><th>世帯主</th><td colspan="5">${same?`<span class="pr">${esc(f.head)}</span>`:(t.head?val(t.head,t.hand):"")}</td></tr>
      <tr><th>本籍</th><td colspan="3">${hs}</td><th>筆頭者</th><td>${hit}</td></tr>
      <tr><th>使用目的</th><td colspan="5" class="boxes">${PURPOSES.map(p=>{const on=f.purpose.startsWith(p);return `<span class="${on?"on":""}">${on?"■":"□"}${esc(p)}${on&&p==="その他"&&f.purpose.length>3?esc(f.purpose.slice(3)):""}</span>`;}).join("")}</td></tr>`;
  } else {
    tgt = `<tr><th>氏名</th><td colspan="5">□１と同じ</td></tr><tr><th>続柄</th><td colspan="2"></td><th>生年月日</th><td colspan="2"></td></tr><tr><th>住所</th><td colspan="5">□１と同じ</td></tr><tr><th>世帯主</th><td colspan="5">&nbsp;</td></tr><tr><th>本籍</th><td colspan="3"><span class="kana">※戸籍に関する証明が必要な場合のみ</span></td><th>筆頭者</th><td></td></tr><tr><th>使用目的</th><td colspan="5" class="boxes">${PURPOSES.map(p=>`<span>□${esc(p)}</span>`).join("")}</td></tr>`;
  }
  let certs = "";
  if (filled){
    const rows = f.certs.map(x=>{
      const nCell = S.ffix && f.fix ? `<s>${x.n}</s><span class="fixnote">${f.fix.to}</span>` : x.n;
      return `<tr><th>${esc(x.g==="印鑑"?"印鑑証明":x.g==="戸籍"?"戸籍に関する証明":x.g)}</th><td colspan="3"><span class="on">■</span>${esc(x.k)}　<span class="kana" style="display:inline">${x.p}円</span></td><td class="num">${x.wide?"":nCell}</td><td class="num">${x.wide?nCell:""}</td></tr>`;
    }).join("");
    let items="";
    if (f.items){
      const L=[["honseki","本籍・筆頭者の記載"],["head","世帯主・続柄"],["mynum","個人番号"],["code","住民票コード"]];
      items = `<tr><th>記載事項</th><td colspan="5" class="boxes">${L.map(([k,l])=>`<span>${esc(l)}：${f.items[k]?"□不要 <b class=\"on\">■必要</b>":"<b class=\"on\">■不要</b> □必要"}</span>`).join("<br>")}</td></tr>`;
    }
    const n = S.ffix&&f.fix ? f.fix.to : f.certs[0].n;
    const sum = f.certs.reduce((a,x)=>a+x.p*(S.ffix&&f.fix?f.fix.to:x.n),0);
    const sum0 = f.certs.reduce((a,x)=>a+x.p*x.n,0);
    certs = `<tr><th></th><td colspan="3" style="font-size:10px;color:var(--paper-sub)">種類</td><td class="num" style="font-size:10px">通</td><td class="num" style="font-size:10px">広域</td></tr>${rows}${items}
      <tr><th>合計</th><td colspan="5" class="pr">${S.ffix&&f.fix?`<s>${f.certs[0].n}通　${sum0}円</s><span class="fixnote">${n}通 ${sum}円</span>`:`${n}通　${sum}円`}</td></tr>`;
  } else {
    certs = `<tr><th>住民票</th><td colspan="5">□世帯全員(謄本)　□世帯一部(抄本)　□除票　□記載事項証明</td></tr><tr><th>戸籍</th><td colspan="5">□戸籍全員(謄本)　□戸籍一部(抄本)　□附票　□身分証明書</td></tr><tr><th>印鑑</th><td colspan="5">□印鑑証明書</td></tr><tr><th>合計</th><td colspan="5">&nbsp;</td></tr>`;
  }
  const docs = c.visitor.docs;
  const has = b => docs.some(d => b==="運転免許証"? /免許/.test(d) : b==="マイナンバーカード"? /マイナンバー/.test(d) : /^(保険証|資格確認書)/.test(b)? /保険|資格確認書/.test(d) : b==="委任状"? /委任状/.test(d) : false);
  const others = docs.filter(d=>!/免許|マイナンバー|保険|資格確認書|委任状/.test(d));
  const idrow = `<td colspan="5" class="boxes">${ID_BOXES.map(b=>{
    const on = S.docs && filled && !f?.identityPending && (b==="その他" ? others.length>0 : has(b));
    return `<span>${on?`<span class="hand">✓</span>`:"□"}${esc(b)}${b==="その他"&&on?`（<span class="hand">${esc(others.join("・"))}</span>）`:""}</span>`;
  }).join("")}</td>`;
  const hk = st>=3 && !f?.identityPending;
  return `<div class="paper">
    <div class="f-title">${TOWN}　証明交付申請書</div>
    <div class="f-to"><span>${TOWN}長様</span><span>下記のとおり申請いたします。</span></div>
    <h6>●１．窓口に来られた方</h6><table>${app}</table>
    <h6>●２．どなたの証明が必要ですか（証明対象者）</h6><table>${tgt}</table>
    <h6>●３．申請する証明書</h6><table>${certs}</table>
    <h6>本人確認${f?.identityPending?'（未了）':''}</h6><table><tr><th>確認書類</th>${idrow}</tr></table>
    <div class="f-foot"><div class="hbox"><span>担当</span>${hk?`<div class="hanko ${FX.hanko?"in":""}">あなた</div>`:""}</div><div class="hbox"><span>審査</span>${hk?`<div class="hanko ${FX.hanko?"in":""}">真鍋</div>`:""}</div></div>
  </div>
  <p class="f-note">${!f ? "このケースでは申請書の作成まで進みません。" : st<1 ? "転記するとここに印字されます。" : f.note ? esc(f.note) : "印字は form からの転記。署名・訂正は手書き。"}　様式は統一様式「証明交付申請書」の欄構成を簡略化したもの。人物・住所は架空。</p>`;
}

function handoutHTML(){
  const c=curCase(), h=HANDOUT[c.id], today=wareki(new Date());
  if (h?.kind==="ininjo"){
    const L = (label, note) => `<tr><th>${label}</th><td colspan="5">${note?`<span class="callout">${note}</span>`:"&nbsp;"}</td></tr>`;
    return `<div class="paper">
      <div class="f-title">委　任　状</div>
      <div class="f-to"><span>${TOWN}長様</span><span>令和　　年　　月　　日</span></div>
      <h6>代理人（窓口に来る方）</h6>
      <table>${L("住所")}${L("氏名")}${L("生年月日")}${L("電話番号")}</table>
      <p class="lead">私は、上記の者を代理人と定め、下記の権限を委任します。</p>
      <h6>委任する内容</h6>
      <table>
        <tr><th>証明の種類</th><td colspan="5" class="boxes"><span>□住民票の写し（□世帯全員　□世帯一部）</span><span>□その他（　　　　　）</span><span class="callout">↑ どの証明か、具体的に</span></td></tr>
        <tr><th>通数</th><td colspan="5">　　　通</td></tr>
        <tr><th>記載事項</th><td colspan="5" class="boxes"><span>本籍・筆頭者　□要　□不要</span><span>世帯主・続柄　□要　□不要</span><span>個人番号　□要　□不要</span></td></tr>
        <tr><th>使用目的</th><td colspan="5">&nbsp;<span class="callout">提出先も書いていただくと確認がスムーズです</span></td></tr>
      </table>
      <h6>委任者（証明が必要な方）</h6>
      <table>${L("住所")}<tr><th>氏名（自署）</th><td colspan="5"><span class="callout">★ ここはお母さまご本人が自署</span></td></tr>${L("生年月日")}${L("電話番号")}</table>
      <div class="warnbox">窓口では、代理人の本人確認書類もご提示いただきます。</div>
    </div>
    <p class="f-note">青い手書きは窓口で書き添えた案内。様式は架空の参考例で、実際の委任状の要件は各自治体の様式・案内によります。フローでは、委任状がない場合は用紙を渡し、提出・確認まで保留（住-関係）。</p>`;
  }
  if(!h)return '';
  return `<div class="paper">
    <div class="f-title">印鑑登録証明書の請求に<br>お持ちいただくもの</div>
    <p class="lead">この町の通常の窓口申請では、次の書類を確認します。</p>
    <ol class="need"><li><b>証明が必要な方の印鑑登録証</b></li><li><b>窓口に来られる方の本人確認書類</b></li></ol>
    <p>対象者の氏名・住所・生年月日と、必要な部数をお伝えください。</p>
  </div><p class="f-note">架空の町の案内例。登録証未持参・紛失などの個別対応は、この教材では扱いません。</p>`;
}

function docDetail(c, name){
  if(isDaughterCounter()&&/免許/.test(name))return daughterLicenseHTML();
  const P=PEOPLE[c.id]||{}, v=c.visitor, face=avatar(LOOK[c.id],"calm",true);
  const idc=(title, band, rows, foot, sub, noPhoto=false) => `<div class="idc${noPhoto?" no-photo":""}" style="--band:${band}"><div class="hd">${title}<small>${sub||"ゲーム用のイメージ"}</small></div>
    <dl>${rows.map(([k,x])=>`<dt>${k}</dt><dd>${esc(x)}</dd>`).join("")}</dl>${noPhoto?"":`<div class="ph">${face}</div>`}<div class="ft">${foot}</div></div>`;
  if (/免許/.test(name)) return japaneseLicense(c);
  if (/マイナンバー/.test(name)) return japaneseMyNumber(c);
  if (/介護保険/.test(name)) return japaneseCareInsurance(c);
  if (/保険証|資格確認書/.test(name)) return japaneseHealthInsurance(c);
  if (/年金手帳/.test(name)) return `<div class="bookz"><div>年金手帳</div><div><dl><dt>基礎年金番号</dt><dd>●●●● - ●●●●●●</dd><dt>氏名</dt><dd>${esc(v.name)}</dd><dt>生年月日</dt><dd>${esc(P.birth)}</dd><dt>写真</dt><dd>なし</dd></dl></div></div>`;
  if (/登録証/.test(name)) return japaneseSeal();
  const today = wareki(new Date());
  const W = {
    c3:{from:"山口 さくら", fromAddr:"こもれび町若葉1丁目6番地", fromBirth:"平成12年9月3日", what:"住民票の写し（世帯一部）　1通", why:"勤務先への提出"},
    c5:{from:"小林 拓也", fromAddr:"こもれび町南5条3丁目2番地", fromBirth:"平成元年8月20日", what:"住民票の写し（世帯一部・個人番号の記載あり）　1通", why:"年金の手続き"},
    c12:{from:"西村 葵", fromAddr:"こもれび町栄町1丁目9番地（本籍：釧路市）", fromBirth:"昭和62年2月8日", what:"戸籍全部事項証明書（謄本）　1通", why:"相続の手続き"}
  };
  if (/委任状/.test(name) && W[c.id]){
    const w=W[c.id];
    return `<div class="paper"><div class="f-title">委　任　状</div><div class="f-to"><span>${TOWN}長様</span><span class="hand">令和8年10月26日</span></div>
      <h6>代理人</h6><table><tr><th>住所</th><td><span class="hand">${esc(P.addr)}</span></td></tr><tr><th>氏名</th><td><span class="hand">${esc(v.name)}</span></td></tr></table>
      <p class="lead">私は、上記の者を代理人と定め、下記の権限を委任します。</p>
      <h6>委任する内容</h6><table><tr><th>証明の種類・通数</th><td><span class="hand">${esc(w.what)}</span></td></tr><tr><th>使用目的</th><td><span class="hand">${esc(w.why)}</span></td></tr></table>
      <h6>委任者</h6><table><tr><th>住所</th><td><span class="hand">${esc(w.fromAddr)}</span></td></tr><tr><th>氏名（自署）</th><td><span class="hand" style="font-size:18px">${esc(w.from)}</span></td></tr><tr><th>生年月日</th><td><span class="hand">${esc(w.fromBirth)}</span></td></tr></table></div>`;
  }
  if (/契約書/.test(name)) return `<div class="paper"><div class="f-title">建物賃貸借契約書（写し）</div>
    <table><tr><th>物件</th><td>コーポ栄 201号室（こもれび町栄町2丁目5番地）</td></tr><tr><th>貸主</th><td>${esc(v.name)}</td></tr><tr><th>借主</th><td>前田 一真</td></tr><tr><th>賃料</th><td>月額 48,000円（毎月末日払い）</td></tr><tr><th>契約期間</th><td>令和5年4月1日から2年間</td></tr></table>
    <p class="lead">第8条　借主が賃料の支払いを3か月以上怠ったときは、貸主は本契約を解除できる。</p><p class="f-note" style="margin:6px 0 0">写し。原本は貸主が保管。</p></div>`;
  if (/督促状/.test(name)) return `<div class="paper"><div class="f-title">督促状（控え）</div>
    <table><tr><th>宛先</th><td>前田 一真 様（コーポ栄 201号室）</td></tr><tr><th>未払い額</th><td>144,000円（令和7年12月分〜令和8年2月分）</td></tr><tr><th>送付日</th><td>令和8年3月10日</td></tr><tr><th>差出人</th><td>${esc(v.name)}</td></tr></table>
    <p class="lead">上記の賃料が未払いです。令和8年3月31日までにお支払いください。</p><p class="f-note" style="margin:6px 0 0">「あて所に尋ねあたりません」で返送された封筒が添えられている。</p></div>`;
  return `<div class="paper"><div class="f-title">${esc(name)}</div><p class="lead">（内容の表示はありません）</p></div>`;
}
function zoomHTML(){
  if (S.zoom===null || S.scr!=="play") return "";
  const c=curCase(), docs=c.visitor.docs, i=Math.min(S.zoom,docs.length-1), name=docs[i];
  return `<div class="zoom noadv" id="zoom" data-act="zclose" role="dialog" aria-modal="true" aria-label="${esc(name)}" aria-describedby="zoomDismissHint">
    <div class="zoom-in" data-stop="1">
      <div class="zoom-bar"><b>${esc(name)}</b><span class="nav">${docs.length>1?`<button type="button" class="btn" id="z-prev" data-act="zgo" data-d="-1">前</button><button type="button" class="btn" id="z-next" data-act="zgo" data-d="1">次</button>`:""}<button type="button" class="btn" id="z-close" data-act="zclose">閉じる</button></span></div>
      ${docDetail(c,name)}
      <p class="material-dismiss-hint" id="zoomDismissHint">資料・背景をクリック／タップで戻る · Esc</p>
      <div class="tip">${i+1} / ${docs.length}　端末や申請書と見比べてみましょう。番号類は伏せています。書類・人物はすべて架空です。</div>
    </div></div>`;
}

function winHTML(){
  if (!S.win || S.scr!=="play") return "";
  const c=curCase(); if (!c) return "";
  if(S.win==="term")return pcWindowHTML();
  return `<div class="material-backdrop noadv" aria-hidden="true"></div><div class="win open ${S.win==='term'?'pc-window':S.win==='directory'?'directory-window':''} ${FX.win?"pop":""} noadv" id="win" role="dialog" aria-modal="true" aria-label="資料の詳細" aria-describedby="winDismissHint">
    <div class="win-tabs material-view-header">${workMaterialNavigationHTML()}
      <button type="button" class="x" id="win-x" data-act="winx" aria-label="閉じる">×</button>
    </div>
    <div class="win-body">${S.win==="directory"?townHallBodyHTML():S.win==="term"?termHTML():S.win==="hand"&&HANDOUT[c.id]?handoutHTML():formHTML()}</div>
    <p class="material-dismiss-hint" id="winDismissHint">${S.win==='term'?'背景・×・Escで会話へ戻る · 入力内容は保持':S.win==='directory'?'×・Escで会話へ戻る':'資料・背景をクリック／タップで戻る · Esc'}</p>
  </div>`;
}

/* Keep the conversation in focus; open supporting materials on demand. */
function consoleHudHTML(){return quietHudHTML();}
function consoleTransportHTML(){
  const b=beat(),decision=b&&(b.t==='ask'||b.t==='order'),card=b?.t==='card';
  return `${materialsRailHTML()}<nav class="console-controls noadv" aria-label="ゲーム操作">${conversationReturnHTML()}<div class="utility-controls"><button type="button" data-act="menu">メニュー</button></div>${decision?'<span class="next-prompt" id="readingScrollHint">選択肢を選んでください</span>':`<span class="read-scroll-note" id="readingScrollHint" hidden>本文は上下にスクロール</span><button type="button" class="next-button" data-act="advance">${b?.t==='pc'?'PCを操作':card?'番号を呼ぶ':S.done?'次へ':'全文を表示'} <span aria-hidden="true">▶</span></button>`}</nav>`;
}
function updateReadingOverflow(){
  const reading=$('#readingArea'),hint=$('#readingScrollHint');if(!reading||!hint)return;
  const overflow=reading.scrollHeight-readbackCurrentTop(reading)>reading.clientHeight+2;
  if(hint.classList.contains('next-prompt'))hint.textContent=overflow?'上下にスクロールして選択':'選択肢を選んでください';
  else hint.hidden=!overflow;
}
function deskControls(){
  const c=curCase();
  return `<p class="panel-intro">必要な資料を選んで、内容を確認できます。</p><div class="desk-layout"><section class="desk-pc"><h4>職員用PC</h4>${staffPcHTML()}</section><section><h4>提示された書類</h4><div class="desk-docs">${S.docs?c.visitor.docs.map((d,i)=>docHTML(d,i)).join(''):'<p class="empty-note">まだ提示されていません。</p>'}</div></section></div><div class="desk-actions"><button type="button" class="btn" data-act="tab" data-v="form">申請書を開く</button>${S.handout?'<button type="button" class="btn" data-act="tab" data-v="hand">お渡しする用紙</button>':''}</div>`;
}
function gameMenu(){
 return `<p class="pause-context">${esc(curCase().visitor.name)} · ${storyTime()}</p><div class="game-menu">${S.chapter?'<button type="button" data-act="chapter-map">タイムライン</button>':''}<button type="button" data-act="log">会話ログ</button><button type="button" data-act="request">用件・人物</button><button type="button" data-act="ref">フロー早見</button><button type="button" data-act="tips">寄り道ノート</button>${townHallMenuHTML()}<button type="button" data-act="skip">次の判断まで進む</button>${GAME_READER.controls()}<button type="button" data-act="settings">設定</button><button type="button" data-act="totitle">${S.confirmTitle?'タイトルへ戻る（確定）':'タイトルへ戻る'}</button></div>${S.mode==='normal'?`<p class="pause-score">${S.score}点 · お待たせ +${S.wait}分 · 重大な誤り ${S.inc}</p>`:''}`;
}

/* Original fictional vignettes. These add character, never eligibility or judging rules. */
const STORIES=SCENARIO.content.STORIES;
function storyFor(c){return STORIES[c?.id];}
/* Only the request already spoken at the counter, never the outcome or hidden circumstances. */
const VISIT_REQUESTS=SCENARIO.content.VISIT_REQUESTS;
function currentVisitRequest(){
 if(isDaughterCounter())return S.beats.find(b=>b.visitRequest)?.visitRequest||null;
 if(S.scr!=='play'||beat()?.t==='card')return null;
 // A request takes effect after its dialogue page, including when skipping to a question.
 const entry=S.beats.slice(0,S.bi).reverse().find(b=>b.visitRequest||b.t==='leave');
 return entry?.visitRequest||null;
}
function visitRequestHTML(){
 const r=currentVisitRequest();if(!r)return '';
 return `<aside class="visit-request noadv" aria-label="来庁者の用件"><span class="visit-request-label">今回の用件</span><div><strong>${esc(r.document)}${r.quantity?` <span class="visit-request-quantity">${r.quantity}通</span>`:''}${r.changed?'<small class="visit-request-change">部数変更</small>':''}</strong><p>${esc(r.purpose||'')}</p></div></aside>`;
}
function personNotesHTML(){
 if(isDaughterCounter())return '<div class="person-notes"><div><p class="person-kicker">午後の来庁者</p><h3>娘と名乗る女性</h3><p>母の住民票を一通、取りに来たと話している。</p><p>提示された免許証の氏名：真鍋 結衣</p></div></div>';
 const c=curCase(),p=storyFor(c);if(!c||!p)return '';
 return `<div class="person-notes"><div class="person-photo">${avatar(LOOK[c.id],'calm',true)}</div><div><p class="person-kicker">今日、窓口に来た人</p><h3>${esc(c.visitor.name)}<small>${c.visitor.age}歳</small></h3><p class="person-title">${esc(p.title)}</p><p>${esc(p.memo)}</p><p class="person-footnote">人物のエピソードは、このゲームの創作です。</p></div></div>`;
}
function storyCardHTML(){
 const c=curCase(),p=storyFor(c);
 return `<div class="ov card story-card" id="card"><div class="card-photo">${avatar(LOOK[c.id],'calm')}</div><div class="inner"><div class="chapter-marker">TODAY'S STORY <span>${String(S.ci+1).padStart(2,'0')} / ${String(S.queue.length).padStart(2,'0')}</span></div><div class="timecode">${storyTime()}<span>こもれび町・証明書窓口</span></div><p class="chapter-person">${esc(c.visitor.name)}<small>${c.visitor.age}歳</small></p><h2>${esc(p?.title||c.title)}</h2><p class="caption">${esc(p?.tagline||'')}</p><div class="meta"><span>受付番号 ${pad3(S.ticket)}</span><span>${esc(CAT_LABEL[c.cat])}</span></div></div></div>`;
}

/* Fiction inspired by published first-person accounts. No new eligibility rules. */
const FIELD_STORIES=SCENARIO.content.FIELD_STORIES;
for(const [id,extra] of Object.entries(FIELD_STORIES))Object.assign(STORIES[id],extra);

function fieldSceneBeats(c,part){return (storyFor(c)?.[part]||[]).map(v=>({t:'say',...v}));}
function storyBridge(c){
 const seen=id=>S.recap.some(r=>r.id===id);
 let x='';
 if(c.id==='c8'&&seen('c7'))x='先ほどの伊藤さんと同じ、印鑑証明の用件だ。今回は二通。必要な部数も、目の前の人に確かめる。';
 else if(c.id==='c7'&&seen('c8'))x='山本さんには二通お渡しした。次も印鑑証明の用件だが、必要なのは一通。前の応対の数を引きずらないよう、申請内容を見直す。';
 else if(c.id==='c12'&&seen('c11'))x='吉田さんの戸籍は、ここで受け取っていただけた。次も本籍が町外、と聞いて、同じ手順を思い浮かべる。誰の請求かを、先に確かめよう。';
 else if(c.id==='c11'&&seen('c12'))x='林さんには本籍地への請求を案内した。その結末を、次の人にそのまま当てはめるわけにはいかない。新しい用件を聞こう。';
 else if(c.id==='c13'&&seen('c2'))x='佐々木さんが、説明を手帳へ書いていた姿を思い出す。今度は、こちらから話す速度にも気をつけてみよう。';
 else if(c.id==='c10'&&seen('c1'))x='高橋さんの、初日に遅刻しないためのメモ。次の番号札にも、この窓口を出たあとの予定があるのだろう。';
 return x?[{t:'say',w:'n',x}]:[];
}
function fieldAfterBeats(c){
 const out=[{t:'say',w:'n',x:storyFor(c).reflection}];
 if(S.mode==='normal'&&S.ci===0&&c.id!=='c8')out.push(
  {t:'say',w:'n',scene:'scene-worn-notebook',x:'空いた受付を見て、ノートに短く書き足す。真鍋さんが、自分の使い込んだノートを隣へ開いた。最初のほうのページには、何度も書き足した跡がある。'},
  {t:'say',w:'s',scene:'scene-guidance',x:'これ、私が入りたてのころ。「持ち物を説明した」って書いてあるでしょう。でも、帰る間際に「家で何を探せばいいの」って聞かれたんだよね。'},
  {t:'say',w:'n',scene:'scene-worn-notebook',x:'その行の下に、濃い字が続く。「案内を指しながら、次にすることを一緒に確かめる」。できたことの記録だと思ったページに、伝わらなかったときの書き直しが残っていた。'},
  {t:'say',w:'s',scene:'scene-guidance',x:'一度に話しすぎる癖があってね。次の人が来たときに思い出せるよう、書き足したの。迷ったところは、あとで一緒に見よう。'},
  {t:'say',w:'n',scene:'scene-paperwork',x:'自分のノートにも、余白を残す。「説明のあと、相手が次にすることを一緒に確かめる」。次の応対で試せるように、短く書いた。'}
 );
 if(S.ci===S.queue.length-1)out.push(
  {t:'say',w:'n',scene:'scene-paperwork',x:'最初は白かったノートに、迷ったところと、次に試したい言い方が残った。読み返して伝わらなければ、また書き足そう。真鍋さんのノートが厚くなった理由が、少し分かった。'},
  {t:'say',w:'s',scene:'scene-guidance',x:'ここでいったん、振り返ろうか。判断の根拠はフローで。伝え方は、今日の会話を思い出しながらね。'}
 );
 if(out[0])out[0].scene="scene-worn-notebook";
 return out;
}
function storyRecapHTML(){
 const entries=S.recap.slice(-3).map(r=>{const c=CASES.find(c=>c.id===r.id);return `<li><b>${esc(c.visitor.name)}</b><span>${esc(storyFor(c).note)}</span></li>`;}).join('');
 return `<section class="field-recap"><h3>ノートに残したこと</h3><p>今日の会話から。採点とは別の、伝え方の振り返りです。</p><ul>${entries}</ul></section>`;
}
/* A snap carousel shared by touch, pointer and keyboard navigation. */
let materialScrollTimer=null;
let materialGesture=null;
function materialIsOpen(){return S.scr==='play'&&!S.panel&&(S.zoom!==null||!!S.win);}
function closeMaterial(){
 const group=S.zoom!==null?'presented':'work';
 const dialog=document.getElementById('win');if(dialog?.open&&typeof dialog.close==='function')dialog.close();
 S.zoom=null;S.win=null;materialGesture=null;S.panel=null;S.materialReturn=null;render();
 focusMaterialLauncher(group);
}
function handleMaterialClick(e){
 if(!materialIsOpen())return false;
 const surface=e.target.closest(S.zoom!==null?'#zoom':'#win');
 if(surface&&S.zoom===null&&S.win==='term'){
  const rect=surface.getBoundingClientRect?.();
  if(!rect||e.target!==surface||e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom)return false;
 }
 // The directory is panned and zoomed, rather than dismissed by tapping the map.
 if(surface&&S.win==='directory'&&e.target.closest('.win-body'))return false;
 // Tabs, document navigation and explicit close controls retain their own actions.
 if(surface&&e.target.closest('button,a,input,select,textarea,label,[contenteditable="true"]'))return false;
 e.preventDefault();e.stopPropagation();
 // A drag, scroll or text selection is reading, not a request to dismiss.
 if(materialGesture?.moved||window.getSelection?.()?.isCollapsed===false)return true;
 closeMaterial();return true;
}
document.addEventListener('pointerdown',e=>{
 materialGesture=materialIsOpen()?{id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}:null;
});
document.addEventListener('pointermove',e=>{
 if(materialGesture&&materialGesture.id===e.pointerId&&Math.hypot(e.clientX-materialGesture.x,e.clientY-materialGesture.y)>8)materialGesture.moved=true;
});
document.addEventListener('pointercancel',()=>{if(materialGesture)materialGesture.moved=true;});
document.addEventListener('scroll',e=>{
 if(materialGesture&&materialIsOpen()&&e.target.closest?.('#zoom,#win'))materialGesture.moved=true;
},true);
let townHallEnlarged=false;
function townHallBodyHTML(){
 const guide=SCENARIO.content.TOWN_HALL;if(!guide)return '';
 return `${S.win==='directory'?'<h3>庁内案内</h3>':''}<div class="town-hall-toolbar"><button type="button" class="btn" data-act="town-hall-zoom" aria-pressed="${townHallEnlarged}" aria-controls="townHallViewport">${townHallEnlarged?'全体を表示':'拡大する'}</button></div><div id="townHallViewport" class="town-hall-viewport" tabindex="0" role="region" aria-label="庁内案内図。拡大時は上下左右にスクロールできます"><div class="town-hall-image${townHallEnlarged?' is-enlarged':''}" role="img" aria-label="${esc(guide.alt)}"></div></div><p class="town-hall-help">拡大すると、上下左右にスクロールできます。</p><dl class="town-hall-floors">${guide.floors.map(([floor,text])=>`<div><dt>${esc(floor)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl><p class="town-hall-help">ゲーム内の架空の庁舎です。</p>`;
}
function townHallMenuHTML(){return SCENARIO.content.TOWN_HALL?'<button type="button" data-act="town-hall">庁内案内</button>':'';}
function materials(){
 const c=curCase();if(!c)return [];
 const formState=['未作成','転記済み','署名済み','審査済み'][S.fstage]||'未作成';
 return [{key:'term',label:'職員用PC · form',status:S.term.length?'照会情報あり':'照会待ち',kind:'pc'},
   ...(S.docs?c.visitor.docs.map((label,i)=>({key:'doc:'+i,label,status:'提示された書類',kind:'doc',i})):[]),
   {key:'form',label:'証明交付申請書',status:formState,kind:'form'},
   ...(S.handout?[{key:'hand',label:HANDOUT[c.id]?.tab||'お渡しする用紙',status:'持ち帰り用',kind:'hand'}]:[]),
   {key:'guide',label:'新人のあんちょこ',status:currentFlowRef()?`フロー早見 · ${currentFlowRef()}`:'フロー早見 · 手続き別',kind:'guide'},
   ...(SCENARIO.content.TOWN_HALL?[{key:'directory',label:'庁内案内',status:'庁舎の配置・受付案内',kind:'directory'}]:[])];
}
function selectedMaterial(){
 const list=materials();let i=list.findIndex(v=>v.key===S.materialKey);if(i<0)i=0;
 return {list,i,item:list[i]};
}
function materialPicture(item){
 if(item.kind==='directory')return '<span class="town-hall-image town-hall-thumbnail" aria-hidden="true"></span>';
 if(item.kind==='guide')return `<span class="material-guide"><span class="guide-tab">確認</span><small>窓口の手引き</small><b>新人の<br>あんちょこ</b><svg viewBox="0 0 92 40" aria-hidden="true"><path d="M16 20H76M38 16L42 20L38 24M65 16L69 20L65 24" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="2" y="9" width="27" height="22" rx="2"/><rect x="43" y="9" width="19" height="22" rx="2"/><rect x="71" y="9" width="19" height="22" rx="2"/></svg><em>フロー早見</em></span>`;
 if(item.kind==='pc'){const html=staffPcHTML();return `<span class="staff-pc">${html.slice(html.indexOf('>')+1,html.lastIndexOf('</button>'))}</span>`;}
 if(item.kind==='doc'){
  // Reuse the same photographic prop as the zoom view, without nested buttons.
  const html=docHTML(item.label,item.i);
  return html.slice(html.indexOf('>')+1,html.lastIndexOf('<figcaption>'));
 }
 return `<span class="material-sheet"><b>${item.kind==='form'?'証明交付申請書':esc(item.label)}</b><i></i><i></i><i></i><i></i><span>${item.kind==='form'&&S.fstage>=2?'署名済み':'見本'}</span></span>`;
}
function materialsRailHTML(){
 if(!curCase()||beat()?.t==='card')return '';
 return materialLaunchersHTML();
}
function updateMaterials({center=false,smooth=false}={}){
 const track=document.getElementById('materialTrack');if(!track)return;
 const {list,i,item}=selectedMaterial();if(!item)return;S.materialKey=item.key;
 const cards=[...track.querySelectorAll('.material-card')];
 cards.forEach((el,n)=>{el.setAttribute('aria-current',String(n===i));el.setAttribute('aria-label',list[n].label+'を'+(n===i?'開く':'選ぶ'));});
 document.getElementById('materialName').textContent=item.label;
 document.getElementById('materialStatus').textContent=item.status;
 document.getElementById('materialPosition').textContent=String(i+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0');
 document.getElementById('materialInspect').setAttribute('aria-label',item.label+'を詳しく見る');
 const rail=track.closest('.material-carousel');
 rail.querySelector('[data-d="-1"]').disabled=i===0;
 rail.querySelector('[data-d="1"]').disabled=i===list.length-1;
 if(center&&cards[i])track.scrollTo({left:cards[i].offsetLeft-(track.clientWidth-cards[i].offsetWidth)/2,behavior:smooth&&!reduce()?'smooth':'auto'});
}
function moveMaterial(direction){
 const {list,i}=selectedMaterial();if(!list.length)return;
 S.materialKey=list[Math.max(0,Math.min(list.length-1,i+direction))].key;
 updateMaterials({center:true,smooth:true});
}
function activateMaterial(key){
 if(!materials().some(m=>m.key===key))return;
 if(selectedMaterial().item?.key===key){openMaterial(key);return;}
 S.materialKey=key;updateMaterials({center:true,smooth:true});
}
function openMaterial(key){
 const {list}=selectedMaterial(),m=list.find(v=>v.key===(key||S.materialKey))||list[0];if(!m)return;
 townHallEnlarged=false;S.materialReturn=null;S.materialLibraryGroup=m.kind==='doc'?'presented':'work';rememberMaterial(m.key);
 S.materialKey=m.key;S.panel=null;S.win=null;S.zoom=null;materialGesture=null;SOUND.sfx('paper');
 if(m.kind==='guide'){openFlow('material');return;}
 if(m.kind==='doc')S.zoom=m.i;else S.win=m.key;
 render();
 requestAnimationFrame(()=>document.getElementById(m.kind==='doc'?'z-close':'win-x')?.focus({preventScroll:true}));
}
function syncMaterialScroll(track){
 if(!S.materialsExpanded)return;
 const cards=[...track.querySelectorAll('.material-card')];if(!cards.length)return;
 const center=track.scrollLeft+track.clientWidth/2;
 const nearest=cards.reduce((a,b)=>Math.abs(b.offsetLeft+b.offsetWidth/2-center)<Math.abs(a.offsetLeft+a.offsetWidth/2-center)?b:a);
 S.materialKey=nearest.dataset.key;updateMaterials();
}
document.addEventListener('scroll',e=>{
 if(e.target.id!=='materialTrack')return;
 clearTimeout(materialScrollTimer);const track=e.target;
 materialScrollTimer=setTimeout(()=>{if(track.isConnected)syncMaterialScroll(track);},150);
},true);

/* Original dramatic scenes. Review results are fictional; workflow decisions stay in CASES. */
Object.assign(STORIES.c3,{
 mid:[
  {w:'v',x:'折らないで、今日中に持ってきてって。それで、このファイルに入れてきました。'},
  {w:'n',x:'ファイルの中には、もう紙がない。中村さんは留め具を押さえたまま、こちらの画面が切り替わるのを待っている。'}
 ],
 reflection:'出さなかった一通のことを考える。山口さんの今日の暮らしは、ここからは見えない。見えないまま守れたものが、あるのかもしれない。',
 note:'その場にいない人の安全も、確認の先にある。'
});
Object.assign(STORIES.c14,{
 reflection:'岡田さんが立ったあと、椅子が静かに戻った。止めていた手続きを、確かめてから進められた。ノートに書く前に、少しだけ息をつく。',
 note:'慎重な確認は、必要な交付を届けるためでもある。'
});

const SUSPENSE_SCENES=SCENARIO.content.SUSPENSE_SCENES;
function suspenseBeats(c,si){
 const out=(SUSPENSE_SCENES[c.id]?.[si]||[]).map(b=>({t:'say',...b}));
 if(c.id==='c14'&&si===2&&S.recap.some(r=>r.id==='c3'))out.splice(1,0,{t:'say',w:'n',tone:'settle',x:'中村さんの請求では、交付できなかった。同じ支援措置の表示でも、その先の確認と結論は違う。\n目の前にいる岡田さんへ、顔を上げる。'});
 return out;
}
function rememberStoryReveal(b){
 if(!b?.reveal)return;
 S.storyReveals||=[];
 if(!S.storyReveals.includes(b.reveal))S.storyReveals.push(b.reveal);
}

function hudHTML(){return consoleHudHTML();}

/* Original side stories. Eligibility and scoring remain in the reviewed workflow. */
const STORY_TIPS=SCENARIO.content.STORY_TIPS;

function tipById(id){return STORY_TIPS.find(t=>t.id===id);}
function tipSeen(id){return (S.tipsSeen||[]).includes(id);}
function isTipPanel(){return S.panel==='tip'||S.panel==='tips';}
function tipRuns(full,b,caseId=curCase()?.id){
 if(b?.t!=='say')return [{text:full,start:0}];
 const candidates=[],references=flowReferenceRuns(full,b?.feedback).filter(r=>r.ref);
 for(const t of STORY_TIPS){
  if(t.caseId&&t.caseId!==caseId)continue;
  if(t.reveal&&!(S.storyReveals||[]).includes(t.reveal))continue;
  for(const word of t.words){const start=full.indexOf(word);if(start>=0&&!references.some(r=>start<r.start+r.text.length&&start+word.length>r.start))candidates.push({id:t.id,text:word,start,local:!!t.caseId});}
 }
 candidates.sort((a,b)=>a.start-b.start||Number(b.local)-Number(a.local)||b.text.length-a.text.length);
 const chosen=[],used=new Set();let end=0;
 for(const c of candidates){if(chosen.length===2)break;if(c.start<end||used.has(c.id))continue;chosen.push(c);used.add(c.id);end=c.start+c.text.length;}
 const runs=[];let at=0;
 for(const c of chosen){if(c.start>at)runs.push({text:full.slice(at,c.start),start:at});runs.push(c);at=c.start+c.text.length;}
 if(at<full.length)runs.push({text:full.slice(at),start:at});return runs;
}
function tipTextMarkup(full,b){
 const runs=tipRuns(full,b).flatMap(r=>r.id?[r]:flowReferenceRuns(r.text,b?.feedback).map(v=>({...v,start:r.start+v.start})));
 return runs.map(r=>`<span data-ink-run data-start="${r.start}" data-length="${r.text.length}"${r.id?` data-tip="${r.id}"`:r.ref?` data-ref="${esc(r.ref)}"`:''}>${r.id?`<span class="tip-partial"></span><button type="button" class="tip-link ${tipSeen(r.id)?'seen':''} noadv" data-act="tip" data-v="${r.id}" aria-label="${esc(r.text)}の寄り道を読む${tipSeen(r.id)?'（既読）':''}" hidden>${esc(r.text)}</button>`:r.ref?`<span class="tip-partial"></span>${flowReferenceButton(r.ref,r.cat,true)}`:''}</span>`).join('');
}
function paintStoryText(el,full,count,b){
 if(b?.t!=='say'){el.textContent=full.slice(0,count);return;}
 const key=S.ci+'-'+S.bi+'-'+full;
 if(el.dataset.inkKey!==key){el.innerHTML=tipTextMarkup(full,b);el.dataset.inkKey=key;}
 for(const run of el.querySelectorAll('[data-ink-run]')){
  const from=+run.dataset.start,len=+run.dataset.length,text=full.slice(from,Math.max(from,Math.min(from+len,count)));
  if(run.dataset.tip||run.dataset.ref){const partial=run.querySelector('.tip-partial'),button=run.querySelector('button');partial.textContent=text;partial.hidden=text.length===len;button.hidden=text.length<len;}
  else run.textContent=text;
 }
}
function finishStoryLine(){
 S.done=true;
 // Keep visible links stable while a pointer or keyboard is interacting with them.
 if(beat()?.t!=='say'){render();return;}
 const next=document.querySelector('.next-button');if(next)next.innerHTML='次へ <span aria-hidden="true">▶</span>';
 const mw=document.getElementById('mw');if(mw&&!mw.querySelector('.ind'))mw.insertAdjacentHTML('beforeend','<span class="ind" aria-hidden="true"></span>');
 updateReadingOverflow();
}
function openTip(id){
 const t=tipById(id);if(!t)return;
 const fromList=S.panel==='tips';
 if(fromList&&!tipSeen(id))return;
 if(!fromList&&(S.panel||!tipRuns(textOf(beat()),beat()).some(r=>r.id===id)))return;
 if(fromList)S.tipListScroll=document.getElementById('tipListBody')?.scrollTop||0;
 S.tipFrom=fromList?'tips':'story';S.tipId=id;S.panel='tip';S.tipsSeen||=[];
 if(!tipSeen(id))S.tipsSeen.push(id);
 SOUND.sfx('paper');render();requestAnimationFrame(()=>document.getElementById('tipTitle')?.focus({preventScroll:true}));
}
function openTips(){S.panel='tips';S.tipListScroll=0;render();requestAnimationFrame(()=>document.getElementById('tipsTitle')?.focus({preventScroll:true}));}
function closeTipPanel(){
 const id=S.tipId,from=S.tipFrom,wasTip=S.panel==='tip';
 S.panel=wasTip?(from==='tips'?'tips':null):'menu';render();
 requestAnimationFrame(()=>{
  if(S.panel==='tips'){const body=document.getElementById('tipListBody');if(body)body.scrollTop=S.tipListScroll||0;document.querySelector(`.tip-entry[data-v="${id}"]`)?.focus({preventScroll:true});}
  else if(!S.panel)document.querySelector(`.tip-link[data-v="${id}"]`)?.focus({preventScroll:true});
  else document.querySelector('[data-act="tips"]')?.focus({preventScroll:true});
 });
}
function handleTipKey(e){
 if(!isTipPanel())return false;
 if(e.key==='Escape'){e.preventDefault();closeTipPanel();return true;}
 if(e.key!=='Tab')return false;
 const panel=document.querySelector('.tip-panel,.tips-library'),items=panel?[...panel.querySelectorAll('button:not([disabled]),a[href]')]:[];
 if(!items.length)return false;
 const i=items.indexOf(document.activeElement);
 if(i<0||(!e.shiftKey&&i===items.length-1)||(e.shiftKey&&i===0)){e.preventDefault();items[e.shiftKey?items.length-1:0].focus();return true;}
 return false;
}
function tipArtHTML(t){
 const scenes={notebook:'scene-paperwork',manabe:'scene-guidance',ticket:'scene-lobby','c3-file':'scene-file-wait','c3-request-chain':'scene-file-wait','c11-timetable':'scene-timetable','c14-clearance':'scene-bag-home'};
 const scene=t?(scenes[t.id]||(t.kind==='desk'?'scene-paperwork':'bg')):'scene-paperwork';
 const person=scene==='bg'&&t?.caseId?LOOK[t.caseId]:null;
 return `<div class="tip-art" data-scene-key="${scene}" aria-hidden="true">${person?`<div class="tip-character">${avatar(person,'calm',false)}</div>`:''}</div><div class="tip-shade" aria-hidden="true"></div>`;
}
function tipFooterHTML(back){
 return `<footer><span class="tip-return-help"><span class="tip-pointer-help">背景クリック / Escでも戻る</span><span class="tip-touch-help">背景タップでも戻る</span></span><button type="button" data-act="tip-close">${back} <span aria-hidden="true">↩</span></button></footer>`;
}
function tipPanelHTML(){
 if(S.panel==='tips'){
  const read=(S.tipsSeen||[]).map(tipById).filter(Boolean);
  return `<div class="tip-backdrop noadv" data-act="tip-backdrop" aria-hidden="true"></div><section class="panel tips-library noadv" role="dialog" aria-modal="true" aria-labelledby="tipsTitle">${tipArtHTML(null)}<header><span class="tip-kicker">TIPS <i>／</i> 寄り道ノート</span><span class="tip-meta">読んだ補足 ${read.length}件</span></header><div class="body" id="tipListBody"><h2 id="tipsTitle" tabindex="-1">寄り道ノート</h2><p class="tip-library-intro">この研修で見つけた言葉を、もう一度。</p>${read.length?`<div class="tip-entries">${read.map(t=>`<button type="button" class="tip-entry" data-act="tip" data-v="${t.id}"><small>${t.caseId?esc(CASES.find(c=>c.id===t.caseId).visitor.name):t.kind==='desk'?'窓口のことば':'窓口のひとこま'}</small><b>${esc(t.title)}</b><span aria-hidden="true">↗</span></button>`).join('')}</div>`:'<p class="tip-empty">まだ白いページです。<br>本文の黄色い下線から、寄り道を見つけてみてください。</p>'}</div>${tipFooterHTML('メニューへ')}</section>`;
 }
 const t=tipById(S.tipId);if(!t)return '';
 const c=t.caseId?CASES.find(c=>c.id===t.caseId):null;
 const back=S.tipFrom==='tips'?'ノートへ戻る':'本文へ戻る';
 return `<div class="tip-backdrop noadv" data-act="tip-backdrop" aria-hidden="true"></div><section class="panel tip-panel noadv" role="dialog" aria-modal="true" aria-labelledby="tipTitle">${tipArtHTML(t)}<header><span class="tip-kicker">TIPS <i>／</i> ${t.kind==='desk'?'窓口のことば':'物語の寄り道'}</span><span class="tip-meta">ひと息、寄り道</span></header><div class="tip-body" id="tipBody"><div class="tip-heading">${c?`<p class="tip-person">${esc(c.visitor.name)}のひとこま</p>`:''}<h2 id="tipTitle" tabindex="-1">${esc(t.title)}</h2></div>${t.body.map(x=>`<p>${esc(x)}</p>`).join('')}${t.kind==='desk'&&t.aside?`<div class="tip-insight"><p>${esc(t.aside)}</p></div>`:''}<p class="tip-source">${t.kind==='desk'?`元フローの用語補足 · ${esc(t.ref)}`:'人物・出来事・内面の描写は、このゲームの創作です。'}</p></div>${tipFooterHTML(back)}</section>`;
}

/* Result metadata belongs to an answered question, never to all mentor dialogue. */
function feedbackMeta(ok,phase){return {ok,phase,points:ok?(S.hint?50:100):0,consulted:S.hint,hintSource:storyCounter()?'flow':'mentor',ref:curCase()?.steps[beat()?.si]?.ref,cat:curCase()?.cat};}
function feedbackPurpose(f){
 return {reason:'正解の理由',review:'見直す点',correction:'正しい対応',safety:'権利・安全の確認',rule:'フローの根拠'}[f?.phase]||'';
}
function feedbackSummary(f){
 return f?`あなたの回答：${f.ok?'正解':'不正解'}${f.consulted?(f.hintSource==='flow'?'（フロー参照あり）':'（相談あり）'):''} ／ ${feedbackPurpose(f)}`:'';
}
function feedbackHTML(f){
 if(!f)return '';
 return `<p class="answer-feedback" data-answer-result="${f.ok?'correct':'incorrect'}"><span>あなたの回答：</span><strong><i aria-hidden="true">${f.ok?'✓':'×'}</i>${f.ok?'正解':'不正解'}</strong>${S.mode==='normal'?`<span class="answer-points" aria-label="今回の獲得点 ${f.points??(f.ok?(f.consulted?50:100):0)}点">${f.ok?'+':''}${f.points??(f.ok?(f.consulted?50:100):0)}<small>点</small></span>`:''}${f.consulted?`<small>${f.hintSource==='flow'?'フロー参照あり':'相談あり'}</small>`:''}</p>`;
}
function feedbackHistoryHTML(f){return f?`<small class="feedback-history">${esc(feedbackSummary(f))}</small>`:'';}

function mwHTML(){
  const b=beat(); if (!b || b.t==="card") return "";
  let plate="", face="", cls="";
  if(b.t==="pc")return `<div class="mw"><div class="mw-text">申請書を作成する。</div></div>`;
  if (b.t==="say"){
    if (b.w==="v"){ const v=curCase().visitor; plate=`<div class="plate">${esc(v.name)}<small>${v.age}歳・${esc(v.role)}</small></div>`; }
    else if (b.w==="s"){ plate=`<div class="plate${b.feedback?" feedback-plate":""}">${SENPAI_NAME}<small>${b.feedback?feedbackPurpose(b.feedback):"先輩職員"}</small></div>`; face=""; }
    else if (b.w==="f"){ plate=`<div class="plate feedback-plate">業務フロー<small>${feedbackPurpose(b.feedback)}</small></div>`; }
    else if (b.w==="m"){ plate=`<div class="plate me">あなた<small>窓口担当</small></div>`; }
    else cls="narr";
  } else {
    const st=curCase().steps[b.si];
    plate=`<div class="plate judge">判断<span class="ref">${esc(st.ref)}</span>${st.plan?`<small>運用案</small>`:""}</div>`;
  }
  const showInd = S.done && b.t==="say";
  return `<div class="mw" id="mw">
    ${b.caption?`<p class="story-beat-caption">${esc(b.caption)}</p>`:""}${feedbackHTML(b.feedback)}${plate}${face}${b.feedback&&!plate?`<p class="feedback-purpose">${feedbackPurpose(b.feedback)}</p>`:""}
    <div class="mw-text ${cls}" id="mwText"></div>
    ${showInd?`<span class="ind" aria-hidden="true"></span>`:""}
  </div>`;
}

function transportHTML(){return quietTransportHTML();}

function choicesHTML(){
  const b=beat(); if (!b || !S.done || (b.t!=="ask" && b.t!=="order")) return "";
  const st=curCase().steps[b.si];
  const fromFlow=storyCounter();
  const consult = `<button type="button" class="consult" id="consult" data-act="hint" ${S.hint?"disabled":""}>${fromFlow?'':`<span class="mini">${avatar(SENPAI,"smile",true)}</span>`}${fromFlow?(S.hint?"確認済み（この問題は50点まで）":"フローを確認 · 50点まで"):(S.hint?"相談済み（この問題は50点まで）":"相談する · 50点まで")}</button>`;
  const hint = S.hint ? `<div class="hintcard">${fromFlow?'':`<span class="mini">${avatar(SENPAI,"calm",true)}</span>`}<span><b class="hint-label">${fromFlow?'業務フロー · ':''}回答前のヒント</b>${fromFlow?esc(st.rule):`「${esc(st.rule)}」`}</span></div>` : "";
  if (b.t==="ask"){
    const L=["1","2","3","4"];
    return `<div class="choices in noadv" role="group" aria-label="選択肢">
      ${S.perm.map((idx,i)=>`<button type="button" class="choice" id="ch-${i}" data-act="ans" data-i="${i}"><span class="k">${L[i]}</span><span>${esc(st.choices[idx].t)}</span></button>`).join("")}
      ${isDaughterCounter()?'':hint+consult}</div>`;
  }
  if (b.t==="order"){
    const pool=S.perm.map((v,i)=>S.pick.includes(v)?"":`<button type="button" id="ord-${i}" data-act="pick" data-i="${i}">＋ ${esc(st.items[v])}</button>`).join("");
    const picked=S.pick.map(v=>`<li>${esc(st.items[v])}</li>`).join("")+Array.from({length:st.items.length-S.pick.length}).map(()=>`<li class="ph">.</li>`).join("");
    return `<div class="orderbox noadv">
      <h5>あなたの順番</h5><ol class="picked">${picked}</ol>
      <h5>工程（押した順に並びます）</h5><div class="pool">${pool||`<span style="font-size:13px;color:var(--muted)">すべて並べました。</span>`}</div>
      <div class="obtns"><button type="button" class="btn primary" id="commit" data-act="commit" ${S.pick.length===st.items.length?"":"disabled"}>この順番で確定</button>
      <button type="button" class="btn" id="reset" data-act="reset" ${S.pick.length?"":"disabled"}>並べ直す</button></div>
      ${hint}${consult}</div>`;
  }
  return "";
}

function cardHTML(){return storyCardHTML();}

/* Original chapter fiction. Choices change dialogue, never certificate eligibility. */
/* Original story mode; facts unlock only on their page. */
/* Generated from story-family.json by scripts/build-family-story.py. */
const CHAPTER_PEOPLE=SCENARIO.people;
const FAMILY_DECISIONS=SCENARIO.story.decisions||{};
const FAMILY_STATS=SCENARIO.story.stats;
const FAMILY_BAD_ENDINGS=SCENARIO.story.bad_endings||{};
const CHAPTER_NODES=SCENARIO.story.nodes.map(node=>({...node,pages:()=>node.pages}));
const MYSTERY_ACTS=SCENARIO.story.blocks.map(b=>({id:b.act,title:b.title}));
const MYSTERY_CLUES=SCENARIO.story.clues||{};
const MYSTERY_PUZZLES=SCENARIO.story.puzzles||{};
const CHAPTER_BLOCKS=SCENARIO.story.blocks;
const PACING_ORDER=CHAPTER_BLOCKS.flatMap(block=>block.nodes);
const FAMILY_LEGACY_PAGES=SCENARIO.legacy.FAMILY_LEGACY_PAGES||{};
const FAMILY_EXPANDED_PAGES=SCENARIO.legacy.FAMILY_EXPANDED_PAGES||{};
const FAMILY_COMPACT_PAGES=SCENARIO.legacy.FAMILY_COMPACT_PAGES||{};
const FAMILY_PRE_REVIEW_PAGES=SCENARIO.legacy.FAMILY_PRE_REVIEW_PAGES||{};
const FAMILY_PRE_PACING=SCENARIO.legacy.FAMILY_PRE_PACING||{};
const FAMILY_PRE_COUNTER=SCENARIO.legacy.FAMILY_PRE_COUNTER||{};
const FAMILY_PRE_JAZZ=SCENARIO.legacy.FAMILY_PRE_JAZZ||{};
function chapterNode(id){return CHAPTER_NODES.find(n=>n.id===id);}
function familyPageVisible(page){return Object.entries(page.when||{}).every(([key,value])=>S.chapter?.choices?.[key]===value);}
function familyCurrentDecision(){
 const c=S.chapter,n=c&&chapterNode(c.node),page=n&&chapterPages(n)[c.page];
 return page?.decision&&FAMILY_DECISIONS[page.decision]&&familyPagePresentation(page).last?{key:page.decision,page,...FAMILY_DECISIONS[page.decision]}:null;
}
function familyChooseBranch(value){
 const c=S.chapter,d=familyCurrentDecision();
 if(d?.interaction==='counter'){startDaughterCounter();return;}
 if(S.scr!=='multi'||S.panel||c?.view!=='read'||!d||chapterDone(c.node)||c.choices[d.key]||!d.options.some(o=>o.id===value))return;
 if(!GAME_READER.decisionReady('story'))return;
 c.choices[d.key]=value;
 const ending=d.options.find(o=>o.id===value)?.ending;
 if(ending){c.badEnding=ending;c.badPage=0;c.view='bad';render();chapterFocus();return;}
 render();chapterFocus('#familyDecision');
}
function familyDecisionHTML(page){
 const key=page.decision,d=FAMILY_DECISIONS[key];if(!d)return '';
 const selected=S.chapter.choices[key],locked=!!selected||chapterDone(S.chapter.node);
 if(d.interaction==='counter')return locked?'':`<section class="family-decision" id="familyDecision" tabindex="-1"><button type="button" data-act="family-counter">窓口で応対する ▶</button></section>`;
 return `<section class="family-decision" id="familyDecision" tabindex="-1" aria-label="会話の分岐"><h2>${esc(d.prompt)}</h2>${d.options.map((o,i)=>`<button type="button" data-act="family-branch" data-v="${o.id}" aria-pressed="${selected===o.id}" ${locked?'disabled':''}><b>${i+1}</b><span>${esc(o.label)}${selected===o.id?'<small>選んだ応対</small>':''}</span></button>`).join('')}</section>`;
}
function familyBadEndingHTML(){
 const c=S.chapter,b=FAMILY_BAD_ENDINGS[c.badEnding],index=c.badPage||0,finished=index===b.pages.length;
 if(finished)return `<section class="multi-screen family-bad-card noadv">${chapterArt(b.pages.at(-1).scene)}<div class="family-bad-shade" aria-hidden="true"></div><div class="family-bad-card-body"><p class="family-bad-number">ENDING ${String(Object.keys(FAMILY_BAD_ENDINGS).indexOf(c.badEnding)+1).padStart(2,'0')} / バッドエンド</p><h1 id="chapterTitle" tabindex="-1">BAD END</h1><h2>${esc(b.title)}</h2><p class="family-bad-caption">この物語は、ここで終わりました。</p>${b.note?`<aside class="rescue-afterword">${esc(b.note)} <a href="${esc(b.source)}" target="_blank" rel="noopener">日本医師会の手順</a></aside>`:''}</div><footer class="multi-footer family-bad-actions"><button type="button" data-act="home">タイトルへ</button><button type="button" data-act="family-bad-readback">結末を読み返す</button><button type="button" class="multi-primary" data-act="family-bad-retry">${esc(b.retry)}</button></footer></section>`;
 const page=b.pages[index],last=index===b.pages.length-1,moment=STORY_MOMENTS.html(page);
 const prefix=familyPagePresentation(page).prefix;
 const past=b.pages.slice(0,index).map(p=>`<p class="multi-prose">${esc(familyReadingText(p.text))}</p>`).join('')+(prefix?`<p class="multi-prose">${esc(prefix)}</p>`:'');
 const controls=`<div class="multi-page-controls"><button type="button" class="multi-primary" data-act="family-bad-next">${last?'結末へ':'次へ'} ▶</button></div>`;
 return `<section class="multi-screen multi-reader family-bad-ending noadv${moment?' family-moment-layout':''}">${chapterArt(page.scene,page.portrait,page.mood)}${moment}${chapterHeader(b.label,'あなたの視点',page.time||chapterNode(b.node).time)}<div class="multi-reading has-conversation" id="chapterReading" data-reading-key="bad-${c.badEnding}-${index}" tabindex="0" aria-label="${esc(b.label)}"><div class="conversation-past">${past}</div><div class="conversation-current${page.beat?' family-beat-page':''}" data-conversation-current tabindex="-1">${familyStoryTextHTML(page.text,page.key,page.beat)}</div></div><footer class="multi-footer console-story-footer">${controls}${familySaveFailed?'<span role="status">このブラウザーでは自動保存を利用できません。</span>':''}</footer></section>`;
}
function familyBadAdvance(){ GAME_READER.advance('bad'); }
function advanceBadPage(){
 const c=S.chapter,b=c&&FAMILY_BAD_ENDINGS[c.badEnding];
 if(S.scr!=='multi'||S.panel||c?.view!=='bad'||!b)return;
 if((c.badPage||0)<b.pages.length){c.badPage=(c.badPage||0)+1;render();chapterFocus();}
}
function familyBadReadback(){
 const c=S.chapter,b=c&&FAMILY_BAD_ENDINGS[c.badEnding];
 if(S.scr!=='multi'||S.panel||c?.view!=='bad'||!b||c.badPage!==b.pages.length)return;
 c.badPage=b.pages.length-1;render();chapterFocus();
}
function familyBadRetry(){
 const c=S.chapter,b=c&&FAMILY_BAD_ENDINGS[c.badEnding];
 if(S.scr!=='multi'||S.panel||c?.view!=='bad'||!b||c.badPage!==b.pages.length)return;
 delete c.badEnding;delete c.badPage;delete c.choices[b.decision];
 c.view='read';c.node=b.node;c.page=chapterPages(chapterNode(b.node)).findIndex(p=>p.decision===b.decision);c.progress[b.node]=c.page;
 c.readHistory=(c.readHistory||[]).filter(p=>p.key!==b.node+':'+c.page+':decision');
 if(b.decision==='issuance'){delete c.counter;c.caseActive=false;c.readHistory=c.readHistory.filter(p=>!p.key.startsWith('daughter:log:'));}
 render();chapterFocus('#familyDecision');
}
const FAMILY_CONTENT_REVISION=SCENARIO.revision;
function migrateFamilyProgress(saved){return saved;}
const FAMILY_LAYOUT_REVISION=SCENARIO.layoutRevision;
function migrateFamilyLayout(saved){return saved;}
const FAMILY_SAVE_KEY=SCENARIO.saveKey;
let familySaveFailed=false;
let familySaveUnavailableReason='';
function readFamilySave(){
 familySaveUnavailableReason='';
 try{const v=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY)||'null',(key,value)=>{
  if(['__proto__','constructor','prototype'].includes(key))throw new TypeError('Invalid save property');
  return value;
 }),c=v?.chapter;
 if(v&&v.version!==ENGINE.saveSchemaVersion){familySaveUnavailableReason='この保存データは、この版では開けません。';return null;}
 if(!c||!Array.isArray(c.done)||!c.choices||!Array.isArray(c.clues)||!['read','timeline','bridge','end','bad','chapter'].includes(c.view))return null;
 const scores=familySavedScores(v.scores);if(!scores)return null;v.scores=scores;
 if(v.scenarioId&&v.scenarioId!==SCENARIO.id)return null;
 if(!v.scenarioId&&!SCENARIO.allowLegacySave)return null;
 if(!v.scenarioId){migrateFamilyProgress(v);migrateFamilyLayout(v);migrateCounterTranscript(c);}
 if(!restoreScenarioAnchors(v))return null;
 // These edits keep all page keys and positions. Refresh only paragraphs already
 // read, so an older transcript does not retain the nine-minute ambulance arrival.
 for(const entry of c.readHistory||[]){
  const match=/^([^:]+):(\d+)$/.exec(entry.key||'');
  if(match){
   const node=chapterNode(match[1]),page=node?.pages(c).filter(p=>Object.entries(p.when||{}).every(([k,v])=>c.choices[k]===v))[+match[2]];
   if(page){entry.x=page.text;entry.context=(page.time||node.time)+' · '+node.title;if(entry.time)entry.time=page.time||node.time;}
  }
 }
 for(const entry of [...(c.readHistory||[]),...(c.counter?.log||[])])if(typeof entry.x==='string')entry.x=entry.x.replaceAll('仕事を休んで、切符を取ってとなると。','仕事を休んで、遠くから来ていただくとなると。').replaceAll('formからExcelへ転記し、申請書を印刷した。','申請書を印刷した。');
 if(c.done.some(id=>!chapterNode(id))||c.node&&!chapterNode(c.node)||c.clues.some(id=>!Object.hasOwn(MYSTERY_CLUES,id)))return null;
 if(Object.entries(c.choices).some(([k,v])=>!FAMILY_DECISIONS[k]?.options.some(o=>o.id===v)))return null;
 if(c.view==='chapter'&&(!chapterNode(c.introNode)||c.introNode!==c.node))return null;
 if(c.view==='bad'&&(!FAMILY_BAD_ENDINGS[c.badEnding]||!Number.isInteger(c.badPage)||c.badPage<0||c.badPage>FAMILY_BAD_ENDINGS[c.badEnding].pages.length))return null;
 return v;}catch{return null;}
}
function migrateCounterTranscript(c){
 for(const entry of c.readHistory||[]){
  if(!entry.key?.startsWith('r2:log:'))continue;
  if(entry.feedback){
   entry.n='業務フロー';entry.x=counterGuideText(entry.x);entry.feedback.hintSource='flow';
  }else if(entry.n===SENPAI_NAME&&entry.x.startsWith('ヒント：')){
   entry.n='業務フロー';entry.x=entry.x.replace(/^ヒント：/,'フローの確認：');
  }
 }
}
function saveFamilyProgress(){
 const counter=isDaughterCounter();
 if(S.mode!=='story'||!S.chapter||S.chapter.recoveredDeduction||!counter&&(S.scr!=='multi'||S.chapter.caseActive))return;
 if(counter)S.chapter.counter=Object.fromEntries(DAUGHTER_COUNTER_FIELDS.filter(k=>S[k]!==undefined).map(k=>[k,S[k]]));
 try{const scores=Object.fromEntries(['score','max','total','correct','wait','inc','hints','misses','cs'].map(k=>[k,S[k]]));
 localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:ENGINE.saveSchemaVersion,engineVersion:ENGINE.version,scenarioVersion:SCENARIO.version,scenarioId:SCENARIO.id,anchors:scenarioSaveAnchors(S.chapter),contentRevision:FAMILY_CONTENT_REVISION,layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores}));familySaveFailed=false;}catch{familySaveFailed=true;}
}
function resumeFamilyProgress(){
 const saved=readFamilySave();if(!saved)return;
 const keep={sound:S.sound,cat:S.cat,count:S.count,ticket:S.ticket};
 S=Object.assign(fresh(),keep,saved.scores,{mode:'story',scr:'multi',chapter:saved.chapter});
 S.chapter.caseActive=false;
 if(S.chapter.view==='read')S.chapter.page=Math.max(0,Math.min(Number(S.chapter.page)||0,chapterPages(chapterNode(S.chapter.node)).length-1));
 if(S.chapter.counter&&S.chapter.node==='daughter'&&!S.chapter.choices.issuance){startDaughterCounter();return;}
 render();chapterFocus();
}

function chapterDone(id){return !!S.chapter?.done.includes(id);}
function chapterAvailable(id){const n=chapterNode(id);return !!n&&!!S.chapter&&n.needs.every(chapterDone);}
function chapterStatus(n){return chapterDone(n.id)?'読了':!chapterAvailable(n.id)?'まだ先':S.chapter.progress[n.id]!==undefined||n.training&&S.chapter.caseActive?'途中':'読める';}
function startChapter(recover=false){
 GAME_READER.reset();
 const keep={sound:S.sound,cat:S.cat,count:S.count,ticket:S.ticket,mode:'story'};
 S=Object.assign(fresh(),keep,{scr:'multi',chapter:{act:1,clues:[],solutions:{},investigations:{},view:'timeline',person:'rookie',node:null,progress:{},done:[],choices:{},caseActive:false,notice:'',recoveredDeduction:recover}});
 render();chapterFocus();
}
function resumeAtDeduction(){
 startChapter(true);const c=S.chapter;
 c.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf(SCENARIO.review.deduction));c.recoveredDeduction=true;c.readHistory=[];
 c.clues=Object.keys(MYSTERY_CLUES).filter(id=>c.done.includes(MYSTERY_CLUES[id].node)&&!MYSTERY_CLUES[id].when);
 for(const id of c.done){const n=chapterNode(id);if(n.training)continue;
  chapterPages(n).forEach((page,i)=>c.readHistory.push({key:id+':'+i,n:'あなた',x:page.text,context:(page.time||n.time)+' · '+n.title}));
 }
 openChapterNode(SCENARIO.review.deduction);
}
function chapterFocus(selector='#chapterTitle'){
 requestAnimationFrame(()=>document.querySelector(selector)?.focus({preventScroll:true}));
}
function openChapterTimeline(returnTo=null){
 if(!S.chapter||S.chapter.badEnding)return;
 CLOCK_TIMELINE_RETURN=returnTo;
 if(S.scr==='play')S.chapter.person='rookie';
 S.scr='multi';S.panel=null;S.win=null;S.zoom=null;S.chapter.view='timeline';S.chapter.node=null;
 render();chapterFocus();
}
function openChapterNode(id,skipIntro=false){
 if(!S.chapter||S.chapter.badEnding||S.scr!=='multi'||!chapterAvailable(id))return;
 CLOCK_TIMELINE_RETURN=null;
 const n=chapterNode(id),c=S.chapter;c.act=n.act||1;c.node=id;c.person=n.person;
 const block=pacingBlock(id);
 if(!skipIntro&&block.nodes[0]===id&&!chapterDone(id)&&!(c.progress[id]>0)&&!c.chapterIntros?.includes(block.id)){c.introNode=id;c.view='chapter';render();chapterFocus();return;}
 if(n.training&&!chapterDone(id)){startChapterCase();return;}
 if(chapterDone(id))delete c.readingSlice;
 c.view='read';c.page=chapterDone(id)?0:(c.progress[id]||0);if(!chapterDone(id))c.progress[id]=c.page;render();chapterFocus();
}
function chapterChoose(value){
 const c=S.chapter,n=chapterNode(c?.node);
 if(S.scr!=='multi'||c?.view!=='read'||!n?.choice||chapterDone(n.id)||c.page!==n.pages(c).length-1||!n.options.some(o=>o.value===value))return;
 if(!GAME_READER.decisionReady('story'))return;
 c.choices[n.choice]=value;finishChapterNode();
}
function chapterAdvance(){ GAME_READER.advance('story'); }
function advanceStoryPage(){
 const c=S.chapter,n=chapterNode(c?.node);if(S.scr!=='multi'||S.panel||c?.view!=='read'||!n)return;
 const pages=chapterPages(n);
 if(FAMILY_DECISIONS[pages[c.page]?.decision]?.interaction==='counter'&&!c.choices[pages[c.page].decision]&&!chapterDone(n.id)){startDaughterCounter();return;}
 if(pages[c.page]?.decision&&!c.choices[pages[c.page].decision]&&!chapterDone(n.id)){requestAnimationFrame(()=>{const el=document.getElementById('familyDecision');el?.focus({preventScroll:true});el?.scrollIntoView({block:'start'});});return;}
 if(c.page<pages.length-1){c.page++;if(!chapterDone(n.id))c.progress[n.id]=c.page;render();chapterFocus();return;}
 if(n.puzzle&&!c.solutions?.[n.id])return;
 if(n.choice&&!chapterDone(n.id))return;
 if(chapterDone(n.id)){pacingRereadNext(n);return;}
 finishChapterNode();
}
function chapterPrevious(){scrollConversationBack();}
function finishChapterNode(){pacingFinishNode();}

function chapterEnd(){
 if(S.scr!=='multi'||!S.chapter||S.chapter.done.length!==CHAPTER_NODES.length)return;
 S.chapter.act=MYSTERY_ACTS.length;S.chapter.view='end';S.chapter.node=null;FAMILY_ENDING.begin();SOUND.sfx('call');render();chapterFocus();
}
function chapterArt(scene,portrait,mood='calm'){
 const p=portrait==='senpai'?SENPAI:LOOK[portrait];
 return `<div class="multi-art" data-scene-key="${scene||'bg'}" aria-hidden="true">${motionSceneHTML(scene)}${p?`<div class="multi-character">${avatar(p,mood,false,!MOTION_ASSETS[scene])}</div>`:''}</div><div class="multi-shade" aria-hidden="true"></div>`;
}
function chapterHeader(title,detail,time='09:00'){
 const active=S.chapter?.node?pacingBlock(S.chapter.node):null;
 return `<header class="multi-header console-story-header">${clockTimeHTML(time,'multi-clock')}<div class="console-scene-title">${active?`<span>第${CHAPTER_BLOCKS.indexOf(active)+1}章</span>`:''}<h1 id="chapterTitle" tabindex="-1">${esc(title)}</h1></div><div class="console-scene-tools">${consoleMenuButtonHTML('chapter-menu')}</div></header>`;
}
function chapterFooter(right=''){
 const hasHeader=['read','timeline','bad'].includes(S.chapter.view);
 return `<footer class="multi-footer console-story-footer">${hasHeader?'':consoleMenuButtonHTML('chapter-menu')}${conversationReturnHTML()}${right}${familySaveFailed?'<span class="multi-footnote" role="status">自動保存できませんでした。</span>':''}</footer>`;
}
function chapterPersonPicture(p){return p.photo?avatar(p.photo==='senpai'?SENPAI:LOOK[p.photo],'calm',true):`<span class="multi-art" data-scene-key="${p.scene}"></span>`;}
function chapterTimelineHTML(){return pacingTimelineHTML();}

function chapterReadHTML(){return mysteryReadHTML();}

function chapterBridgeHTML(){return pacingBridgeHTML();}

function chapterEndHTML(){return mysteryEndHTML();}

function chapterHTML(){return S.chapter.view==='chapter'?familyChapterCardHTML(chapterNode(S.chapter.introNode)):S.chapter.view==='bad'?familyBadEndingHTML():S.chapter.view==='timeline'?chapterTimelineHTML():S.chapter.view==='read'?chapterReadHTML():S.chapter.view==='bridge'?chapterBridgeHTML():chapterEndHTML();}
function handleChapterKey(e){
 if(S.scr!=='multi'||S.panel)return false;
 if(e.key==='Escape'&&S.chapter.view==='timeline'&&clockTimelineReturn()){e.preventDefault();returnClockTimeline();return true;}
 if(S.chapter.view==='end'&&FAMILY_ENDING.key(e))return true;
 if(S.chapter.view==='chapter'&&(e.key==='Enter'||e.key===' ')&&!document.activeElement?.closest?.('button')){e.preventDefault();beginFamilyChapter();return true;}
 if(S.chapter.view==='bad'){if((e.key==='Enter'||e.key===' ')&&!document.activeElement?.closest?.('button')){e.preventDefault();familyBadAdvance();return true;}if(e.key==='Escape'){e.preventDefault();openConsolePanel('chapter-menu');return true;}return false;}
 if(e.key==='Escape'){e.preventDefault();openConsolePanel('chapter-menu');return true;}
 if(document.activeElement?.closest?.('button'))return false;
 if((e.key==='Enter'||e.key===' ')&&S.chapter.view==='bridge'){e.preventDefault();pacingBridgeContinue();return true;}
 if((e.key==='Enter'||e.key===' ')&&S.chapter.view==='read'){e.preventDefault();if(mysteryReady())familyNext();else chapterAdvance();return true;}
 if('123'.includes(e.key)&&e.key.length===1&&S.chapter.view==='read'){const decision=familyCurrentDecision();if(decision&&!S.chapter.choices[decision.key]){e.preventDefault();familyChooseBranch(decision.options[+e.key-1]?.id);return true;}const p=mysteryReady()?MYSTERY_PUZZLES[familyQuestion()]:null;if(p){e.preventDefault();mysteryTheory(p.options[+e.key-1]?.id);return true;}
const n=chapterNode(S.chapter.node);if(n?.choice){e.preventDefault();chapterChoose(n.options[+e.key-1]?.value);return true;}}
 return false;
}

/* Two direct entries: the regular counter drill and the three-viewpoint story. */
function modeName(){return S.mode==='story'?'ストーリーモード':'通常モード';}
function prepareMode(mode='normal'){
 if(!['normal','story'].includes(mode))return;
 S.launchMode=mode;S.panel='welcome';render();
}
function beginMode(){
 if(S.launchMode==='story'){startChapter();openChapterNode(PACING_ORDER[0]);}else startGame();
}

/* Presentation only: keep all decisions and application state in the shared engine. */
function toggleMaterialShelf(){
 if(S.scr!=='play'||S.panel||S.win||S.zoom!==null||beat()?.t==='card')return;
 S.materialsExpanded=!S.materialsExpanded;render();
 requestAnimationFrame(()=>document.getElementById('materialShelfToggle')?.focus({preventScroll:true}));
}
function compactHudHTML(){
 const c=curCase(),done=S.res.filter(v=>typeof v==='boolean').length;
 return `<header class="console-hud compact-hud"><div class="scene-context"><time>${storyTime()}</time><span>${esc(CAT_LABEL[c.cat])}</span></div><div class="scene-person"><button type="button" class="noadv" data-act="person" aria-label="${esc(c.visitor.name)}の人物メモ">${esc(c.visitor.name)}</button><small aria-label="${S.ci+1}/${S.queue.length}人目。このケースの判断 ${done}/${c.steps.length}">${S.ci+1} / ${S.queue.length}</small></div></header>`;
}
function chapterMenuHTML(){
 const n=chapterNode(S.chapter.node),c=S.chapter;
 return `<p class="pause-context">${n?esc(n.title):'ストーリーモード'}${c.view==='read'?' · '+pacingPageNumber(n):''}</p><div class="chapter-pause-menu">${c.view!=='timeline'?'<button type="button" data-act="chapter-map">タイムライン</button>':''}<button type="button" data-act="mystery-notes">手掛かり</button>${familyResumeHTML()}${townHallMenuHTML()}${familyLicenseAvailable()?'<button type="button" data-act="family-license">免許証</button>':''}${GAME_READER.controls()}<button type="button" data-act="settings">設定</button><button type="button" data-act="totitle">${S.confirmTitle?'タイトルへ戻る（確定）':'タイトルへ戻る'}</button></div>`;
}

/* Training-only form workflow, using the current case's disclosed fictional data. */
const PC_ITEMS=[['honseki','本籍・筆頭者'],['head','世帯主・続柄'],['mynum','個人番号'],['code','住民票コード']];
function pcTask(){return S.scr==='play'&&beat()?.t==='pc';}
function pcState(){
 const id=curCase()?.id;
 if(!S.pc||S.pc.id!==id)S.pc={id,phase:'search',query:'',searched:false,selected:null,relation:'',target:false,items:{honseki:false,head:false,mynum:false,code:false},quantity:'',lane:'',feedback:'',view:'work'};
 return S.pc;
}
function pcNormalize(s){return String(s||'').normalize('NFKC').replace(/[\s・‐－-]/g,'').replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+96));}
function pcBirthKeys(s){
 const d=toDate(s),m=/^(明治|大正|昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日/.exec(s||'');
 if(!m||!d)return [];
 const pad=n=>String(n).padStart(2,'0');
 return [d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate()),String(['明治','大正','昭和','平成','令和'].indexOf(m[1])+1)+pad(m[2]==='元'?1:m[2])+pad(m[3])+pad(m[4])];
}
function pcWorkAvailable(){return pcTask()||S.fstage>=1;}
function pcLookupRecords(){
 const search=(S.term.find(r=>r[0]==='form 検索')||[])[1]||'';
 return S.term.filter(r=>r[0]==='該当'||/^候補\d/.test(r[0])).map((r,i)=>{
  const str=r.slice(1).filter(v=>typeof v==='string').join(' '),birth=(str+' '+search).match(/(?:明治|大正|昭和|平成|令和)(?:元|\d+)年\d+月\d+日/)?.[0]||'';
  return {key:String(i),name:str,birth,addr:'',kana:search,tag:r.find(v=>typeof v==='object')};
 });
}
function pcRecords(){
 const f=FORMS[curCase().id];
 return pcWorkAvailable()&&f?[{...f.app,key:'app'}]:pcLookupRecords();
}
function pcMatches(record,query){
 const q=pcNormalize(query);if(!q)return false;
 const keys=[record.name,record.kana,record.birth,...pcBirthKeys(record.birth)].map(pcNormalize);
 return keys.some(k=>k===q||!/^\d+$/.test(q)&&k.includes(q));
}
function pcResults(){const p=pcState();return p.searched?pcRecords().filter(r=>pcMatches(r,p.query)):[];}
function pcDraw(focus='pcHeading'){
 render();requestAnimationFrame(()=>document.getElementById(focus)?.focus({preventScroll:true}));
}
function handlePcKey(e){
 if(S.win!=='term'||S.panel||S.scr!=='play')return false;
 if(e.key==='Escape'){e.preventDefault();closeMaterial();return true;}
 if(e.key!=='Tab')return false;
 const win=document.getElementById('win');if(!win)return false;
 const buttons=[...win.querySelectorAll('button:not([disabled]),input,select,summary')].filter(v=>v.getClientRects().length);
 if(!buttons.length)return false;
 const first=buttons[0],last=buttons[buttons.length-1],active=document.activeElement;
 if(!buttons.includes(active)||e.shiftKey&&active===first||!e.shiftKey&&active===last){e.preventDefault();(e.shiftKey?last:first).focus();return true;}
 return false;
}
function pcFail(message){pcState().feedback=message;pcDraw('pcFeedback');return false;}
function pcSearch(){
 const p=pcState();if(p.phase!=='search')return;
 p.searched=true;p.selected=null;p.feedback='';
 if(!pcNormalize(p.query))return pcFail('生年月日か氏名を入力してください。');
 if(!pcResults().length)return pcFail('該当するデータがありません。入力した生年月日・氏名を確かめてください。');
 SOUND.sfx('keyboard');pcDraw('pcResults');
}
function pcSelect(key){
 const p=pcState();if(p.phase!=='search')return;
 const r=pcResults().find(r=>r.key===key);if(!r)return;
 p.selected=key;p.feedback='';p.phase=pcTask()?'confirm':'inspect';pcDraw();
}
function pcExpectedRelation(f){return f.tgt==='same'?'self':f.tgt.hand?'hand':'other';}
function pcTransfer(){
 const p=pcState(),f=FORMS[curCase().id];
 if(!pcTask()||p.phase!=='confirm'||p.selected!=='app'||!f)return false;
 if(p.relation!==pcExpectedRelation(f))return pcFail(f.tgt==='same'?'今回は申請者ご本人の証明です。対象者の欄を確認してください。':f.tgt.hand?'第三者請求では、対象者欄を申請者に書いてもらいます。役場から対象者情報を転記しません。':'申請者と証明が必要な人が異なります。対象者を確認してください。');
 if(p.relation==='other'&&!p.target)return pcFail('証明が必要な人の氏名・生年月日を確認し、対象者に選んでください。');
 if(f.items){const diff=PC_ITEMS.filter(([k])=>!!p.items[k]!==!!f.items[k]);if(diff.length)return pcFail('聞き取った記載事項に合わせてください：'+diff.map(([k,n])=>n+'は'+(f.items[k]?'必要':'不要')).join('、')+'。');}
 p.phase='excel';p.feedback='';p.quantity='';p.lane='';SOUND.sfx('paper');pcDraw();return true;
}
function pcPrint(){
 const p=pcState(),f=FORMS[curCase().id];if(!pcTask()||p.phase!=='excel'||!f)return false;
 const quantity=pcNormalize(p.quantity);
 if(!/^\d+$/.test(quantity)||Number(quantity)!==f.certs[0].n)return pcFail('今回の依頼は'+f.certs[0].n+'通です。部数を確認してください。');
 if(curCase().cat==='戸籍'&&p.lane!==(f.certs[0].wide?'wide':'local'))return pcFail('本籍欄と確認済みの請求内容を見て、'+(f.certs[0].wide?'広域':'管内')+'の部数欄を選んでください。');
 p.phase='done';p.feedback='';S.fstage=Math.max(S.fstage,1);S.materialKey='form';rememberMaterial('form');S.win='form';SOUND.sfx('printer');
 S.bi++;run();requestAnimationFrame(()=>document.getElementById('win-x')?.focus({preventScroll:true}));return true;
}
function pcUpdateQuantity(value){
 const p=pcState();p.quantity=value;
 if(isDaughterCounter())saveFamilyProgress();
 if(p.feedback){p.feedback='';document.getElementById('pcFeedback')?.remove();}
}
function pcQuantityKey(key){
 const p=pcState();
 if(!pcTask()||S.win!=='term'||S.panel||p.phase!=='excel'||p.view!=='work'||!(/^[0-9]$/.test(key)||key==='backspace'||key==='clear'))return;
 const input=document.getElementById('pcQuantity'),text=p.quantity||'',status=document.getElementById('pcQuantityStatus');
 const hasCaret=input?.dataset.quantityCaret==='true'||document.activeElement===input;
 const start=Math.min(hasCaret?(input?.selectionStart??text.length):text.length,text.length),end=Math.min(hasCaret?(input?.selectionEnd??text.length):text.length,text.length);
 let next=text,caret=start;
 if(key==='clear'){next='';caret=0;}
 else if(key==='backspace'){
  caret=start===end?Math.max(0,start-1):start;
  next=text.slice(0,caret)+text.slice(end);
 }else{
  next=text.slice(0,start)+key+text.slice(end);caret=start+1;
  if(next.length>3){if(status)status.textContent='部数は3桁まで入力できます。';return;}
 }
 pcUpdateQuantity(next);
 // Keep focus on the key: no rerender, scrolling jump, or forced mobile keyboard.
 if(input){input.value=next;input.dataset.quantityCaret='true';input.setSelectionRange(caret,caret);}
 if(status)status.textContent=next?`入力中の部数：${next}通`:'部数を消去しました。';
}
function pcQuantityKeypadHTML(){
 return `<div class="pc-keypad" role="group" aria-label="部数の数字キーパッド">${['1','2','3','4','5','6','7','8','9','clear','0','backspace'].map(key=>`<button type="button" class="${key==='clear'||key==='backspace'?'pc-keypad-edit':''}" data-act="pc" data-pc="quantity-key" data-v="${key}" aria-controls="pcQuantity" aria-label="${key==='clear'?'部数をすべて消す':key==='backspace'?'部数を1文字消す':`部数に${key}を入力`}">${key==='clear'?'クリア':key==='backspace'?'⌫':key}</button>`).join('')}</div><span id="pcQuantityStatus" class="pc-keypad-status" role="status" aria-live="polite" aria-atomic="true"></span>`;
}
function pcAction(action,value){
 if(S.scr!=='play'||S.win!=='term')return;
 const p=pcState();
 if(action==='view'){p.view=value==='notes'?'notes':'work';pcDraw();}
 if(action==='search')pcSearch();
 if(action==='sample'){
  p.query=pcBirthKeys(pcRecords()[0]?.birth)[0]||pcRecords()[0]?.kana||'';p.searched=false;p.feedback='';pcDraw('pcQuery');
 }
 if(action==='select')pcSelect(value);
 if(action==='back'&&['confirm','inspect'].includes(p.phase)){p.phase='search';p.selected=null;p.relation='';p.target=false;p.feedback='';pcDraw('pcQuery');}
 if(action==='relation'&&p.phase==='confirm'){p.relation=value;p.target=false;p.feedback='';pcDraw();}
 if(action==='target'&&p.phase==='confirm'&&p.relation==='other'){p.target=!p.target;pcDraw();}
 if(action==='transfer')pcTransfer();
 if(action==='edit'&&p.phase==='excel'){p.phase='confirm';p.feedback='';pcDraw();}
 if(action==='quantity-key')pcQuantityKey(value);
 if(action==='print')pcPrint();
}
function pcHeadingHTML(label,step=''){return `<h3 id="pcHeading" tabindex="-1">${esc(label)}${step?`<small>${step} / 3</small>`:''}</h3>`;}
function pcPersonHTML(person,label){return `<section class="pc-person"><small>${esc(label)}</small><strong>${esc(person.name)}</strong><p>${esc(person.birth||'照会メモで確認')}${person.addr?`<br>${esc(person.addr)}`:''}</p></section>`;}
function pcNotesHTML(){return `<section class="pc-notes">${pcHeadingHTML('照会メモ')}${termNotesHTML()}</section>`;}
function pcSearchHTML(){
 const p=pcState(),records=pcResults(),ready=pcRecords().length>0;
 return `${pcHeadingHTML(pcTask()?'申請者を検索':'住民情報を検索',pcTask()?'1':'')}
 ${ready?`<form id="pcSearchForm" class="emu-search"><label for="pcQuery">生年月日・氏名</label><input id="pcQuery" data-pc-input="query" value="${esc(p.query)}" autocomplete="off" maxlength="80" placeholder="例：19930930"><div class="pc-search-help"><button type="button" class="pc-text" data-act="pc" data-pc="sample">${pcTask()?'書類':'メモ'}から入力</button><details><summary>入力方法</summary><p>和暦7桁・西暦8桁・漢字やかなの氏名で検索できます。<br>例：平成5年9月30日 → 4050930 ／ 19930930</p></details></div></form>`:'<p class="pc-empty-state">用件と本人確認を進めると、照会情報が届きます。</p>'}
 ${p.searched?`<section id="pcResults" tabindex="-1" class="pc-results"><h4>検索結果 <span>${records.length}件</span></h4>${records.map(r=>`<button type="button" data-act="pc" data-pc="select" data-v="${r.key}"><span><b>${esc(r.name)}</b><small>${esc(r.birth)}${r.addr?'<br>'+esc(r.addr):''}</small>${r.tag?`<em class="tag status">${esc(r.tag.t)}</em>`:''}</span><span aria-hidden="true">→</span></button>`).join('')}</section>`:''}`;
}
function pcRegistryHTML(){
 const p=pcState(),f=FORMS[curCase().id],h=f?.honseki;
 // Show only the current scenario's disclosed registry data for the selected person.
 if(!['戸籍','附票'].includes(curCase().cat)||!h?.v||!h.area||f.tgt?.hand||p.relation!==pcExpectedRelation(f)||(p.relation==='other'&&!p.target))return '';
 return `<section class="pc-registry" aria-label="対象者の本籍"><h4>対象者の本籍</h4><dl><dt>本籍</dt><dd>${esc(h.v)}<small>${h.area==='local'?'町内（管内）':'町外（管外）'}</small></dd><dt>筆頭者</dt><dd>${esc(h.hitto||'')}</dd></dl></section>`;
}
function pcConfirmHTML(){
 const p=pcState(),f=FORMS[curCase().id],other=f.tgt!=='same'&&!f.tgt.hand;
 return `${pcHeadingHTML('対象者と項目を確認','2')}${pcPersonHTML(f.app,'申請者')}
 <fieldset class="pc-relations"><legend>誰の証明ですか</legend>${[['self','申請者本人'],['other','本人以外'],['hand','対象者欄は手書き']].map(([v,l])=>`<button type="button" data-act="pc" data-pc="relation" data-v="${v}" aria-pressed="${p.relation===v}">${l}</button>`).join('')}</fieldset>
 ${p.relation==='other'&&other?`<div class="pc-target-review">${pcPersonHTML({...f.tgt,addr:f.tgt.addr==='same'?f.app.addr:f.tgt.addr},'対象者')}<button type="button" class="pc-target" data-act="pc" data-pc="target" aria-pressed="${p.target}">${p.target?'✓ 選択済み':'この人を対象者にする'}</button></div>`:''}
 ${pcRegistryHTML()}
 ${p.relation==='hand'?'<p class="pc-notice">対象者欄は空欄で印刷し、申請者に記入してもらいます。本籍は印字しません。</p>':''}
 ${f.items?`<fieldset class="pc-options"><legend>住民票に記載する項目</legend>${PC_ITEMS.map(([k,l])=>`<label><input type="checkbox" data-pc-item="${k}" ${p.items[k]?'checked':''}>${l}</label>`).join('')}</fieldset>`:''}`;
}
function pcExcelHTML(){
 const p=pcState(),f=FORMS[curCase().id],c=curCase(),cert=f.certs[0];
 return `${pcHeadingHTML('申請書の内容を確認','3')}<div class="pc-excel-layout"><section class="pc-sheet"><h4>${esc(TOWN)} 証明交付申請書</h4><dl><dt>申請者</dt><dd>${esc(f.app.name)}</dd><dt>対象者</dt><dd>${esc(f.tgt==='same'?f.app.name:f.tgt.hand?'空欄（申請者が手書き）':f.tgt.name)}</dd><dt>本籍</dt><dd>${esc(f.honseki.mode==='print'?f.honseki.v:'印字しない')}</dd><dt>証明書</dt><dd>${esc(cert.k)}</dd>${f.items?`<dt>住民票に記載</dt><dd>${esc(PC_ITEMS.filter(([k])=>p.items[k]).map(([,l])=>l).join('・')||'すべて不要')}</dd>`:''}</dl></section>
 <section class="pc-quantity-panel" aria-label="部数の入力">${c.cat==='戸籍'?`<label class="pc-field pc-lane-field" for="pcLane"><span>部数を入れる欄</span><select id="pcLane" data-pc-input="lane"><option value="">選んでください</option><option value="local" ${p.lane==='local'?'selected':''}>管内（本町本籍）</option><option value="wide" ${p.lane==='wide'?'selected':''}>広域（町外本籍）</option></select></label><p class="pc-lane-help">管内・管外は、本籍がこの町にあるかどうか。今の住所では分けません。広域交付は、本籍地以外の窓口で戸籍証明書を受け取る制度です。</p>`:''}<label class="pc-field" for="pcQuantity"><span>必要部数</span><span class="pc-count"><input id="pcQuantity" data-pc-input="quantity" inputmode="numeric" maxlength="3" value="${esc(p.quantity)}" aria-describedby="pcRequest">通</span></label><p id="pcRequest">依頼：${cert.n}通</p>${pcQuantityKeypadHTML()}</section></div>
 <details class="pc-details"><summary>申請書の作成について</summary><p>この端末は、聞き取った内容を申請書に反映して印刷する、ゲーム内の模擬画面です。</p><p>自署欄は空欄です。印刷後、申請者に署名をお願いします。</p><p>${c.id==='c4'?'申請書を整えた後、住基で対象者を検索します。通常経路の宛名番号コピーは使いません。':c.cat==='戸籍'||c.cat==='附票'?'戸籍端末では、この申請書を見て検索します。宛名番号を貼り付ける操作はありません。':c.cat==='住民票'?'宛名番号 ●●●●●● を住基への引継ぎ用にコピー済み（ゲーム内）。記載事項の「住民票コード」とは別です。':'証明書は、この申請書をもとに別システムで照合・発行します。'}</p><p>研修用の模擬操作です。実際のExcel・プリンターには接続しません。</p></details>`;
}
function pcFooterHTML(){
 const p=pcState(),task=pcTask();
 if(p.view==='notes')return `<button type="button" class="pc-primary" data-act="pc" data-pc="view" data-v="work">操作に戻る</button>`;
 if(S.fstage>=1&&!task)return `<button type="button" class="pc-primary" data-act="tab" data-v="form">申請書を見る</button>`;
 if(p.phase==='confirm'&&task)return `<button type="button" class="pc-text" data-act="pc" data-pc="back">戻る</button><button type="button" class="pc-primary" data-act="pc" data-pc="transfer">申請書の作成へ →</button>`;
 if(p.phase==='excel'&&task)return `<button type="button" class="pc-text" data-act="pc" data-pc="edit">戻る</button><button type="button" class="pc-primary" data-act="pc" data-pc="print">申請書を印刷</button>`;
 if(p.phase==='inspect')return `<button type="button" class="pc-text" data-act="pc" data-pc="back">検索へ戻る</button>`;
 return pcRecords().length?`<button type="submit" form="pcSearchForm" class="${pcResults().length?'pc-text':'pc-primary'}">${pcResults().length?'検索し直す':'検索'}</button>`:'';
}
function termHTML(){
 const p=pcState(),task=pcTask(),done=S.fstage>=1&&!task;
 let body;
 if(p.view==='notes')body=pcNotesHTML();
 else if(done)body=`${pcHeadingHTML('申請書を作成しました')}<p>署名・確認へ進みましょう。</p>`;
 else if(p.phase==='confirm'&&task)body=pcConfirmHTML();
 else if(p.phase==='excel'&&task)body=pcExcelHTML();
 else if(p.phase==='inspect')body=`${pcHeadingHTML('検索結果を確認')}${pcPersonHTML(pcRecords().find(r=>r.key===p.selected)||{name:'照会情報が更新されました'},'氏名・生年月日・状態を照合')}<p class="pc-notice">会話に戻り、請求の資格と必要な確認を進めます。</p>`;
 else body=pcSearchHTML();
 return `<div class="form-pc" data-pc-phase="${esc(p.phase)}"><header class="emu-brand"><b>${p.phase==='excel'&&task?'申請書':'form'}<small>MADO · 練習</small></b><div>${p.view!=='notes'?'<button type="button" class="pc-text" data-act="pc" data-pc="view" data-v="notes">照会メモ</button>':''}<button type="button" id="win-x" data-act="winx" aria-label="会話に戻る">会話へ</button></div></header><div class="emu-content">${p.feedback?`<p id="pcFeedback" class="pc-feedback" role="status" tabindex="-1">${esc(p.feedback)}</p>`:''}${body}</div><footer class="pc-actions">${pcFooterHTML()}</footer></div>`;
}
function pcWindowHTML(){return `<dialog class="win pc-window noadv" id="win" aria-modal="true" aria-label="職員用PC · form">${workMaterialNavigationHTML()}${termHTML()}</dialog>`;}
document.addEventListener('submit',e=>{if(e.target.id==='pcSearchForm'){e.preventDefault();pcSearch();}});
document.addEventListener('focusin',e=>{if(e.target.id==='pcQuantity')e.target.dataset.quantityCaret='true';});
document.addEventListener('input',e=>{
 if(S.win!=='term'||S.scr!=='play')return;
 const p=pcState(),k=e.target.dataset?.pcInput,item=e.target.dataset?.pcItem;
 if(['query','quantity','lane'].includes(k)){
  if(k==='quantity')pcUpdateQuantity(e.target.value);else p[k]=e.target.value;
  if(k==='query'){p.searched=false;p.selected=null;document.getElementById('pcResults')?.remove();}
 }
 if(PC_ITEMS.some(([k])=>k===item)&&p.phase==='confirm')p.items[item]=e.target.checked;
 if(isDaughterCounter())saveFamilyProgress();
});

function quietHudHTML(){
 return `<header class="console-hud quiet-hud">${clockTimeHTML(storyTime())}${normalScoreHTML()}${consoleMenuButtonHTML()}</header>`;
}
function quietTransportHTML(){
 const b=beat(),decision=b&&(b.t==='ask'||b.t==='order');
 return `<nav class="console-controls console-simple-controls noadv" aria-label="ゲーム操作">${materialsRailHTML()}${conversationReturnHTML()}${decision?'':`<button type="button" class="next-button" data-act="advance">${b?.t==='pc'?'PCを操作':b?.t==='card'?'呼び出す':'次へ'} <span aria-hidden="true">▶</span></button>`}</nav>`;
}

/* Original suspense fiction. Deductions concern only facts introduced in this story.
   They never change the reviewed c11 eligibility questions or the normal-mode data. */
function mysteryClues(){return S.chapter?.clues||[];}
function collectMysteryClues(){
 const c=S.chapter;if(S.scr!=='multi'||!c||c.view!=='read')return;
 const n=chapterNode(c.node),page=n&&chapterPages(n)[c.page];
 if(page&&!familyPagePresentation(page).last)return;
 for(const id of page?.clues||[])if(MYSTERY_CLUES[id]&&!c.clues.includes(id))c.clues.push(id);
}
function mysteryReady(){return S.scr==='multi'&&S.chapter?.view==='read'&&S.chapter.node===SCENARIO.review.deduction&&chapterDone(SCENARIO.review.after)&&!S.chapter.solutions[SCENARIO.review.deduction];}
function mysteryDraft(id){
 const d=S.chapter.investigations[id]||=( {selected:[],theory:null,hint:false} ),p=MYSTERY_PUZZLES[id];
 // Keep unfinished saves usable when a question drops an evidence slot.
 d.selected=[...new Set(d.selected)].filter(key=>p.clues.includes(key)).slice(0,p.count);
 return d;
}
function familyQuestion(){return S.chapter.question||Object.keys(MYSTERY_PUZZLES)[0];}
function familyComplete(id){const p=MYSTERY_PUZZLES[id],d=mysteryDraft(id);return d.theory&&d.selected.length===p.count;}
function familyRequire(id){
 const c=S.chapter,p=MYSTERY_PUZZLES[id],d=mysteryDraft(id);
 c.question=id;c.feedbackTarget=d.theory?'evidence':'theory';
 c.feedback=d.theory?`根拠をあと${p.count-d.selected.length}つ選んでください（${d.selected.length} / ${p.count}）。`:'推理を一つ選んでください。そのあと根拠を選びます。';
 render();requestAnimationFrame(()=>{
  const el=document.getElementById('deductionFeedback');
  el?.focus({preventScroll:true});el?.scrollIntoView({block:'start'});
 });
}
function familyNext(){
 if(S.panel||consumeReadbackAdvance()||!mysteryReady())return;
 const id=familyQuestion();
 if(!familyComplete(id)){familyRequire(id);return;}
 const keys=Object.keys(MYSTERY_PUZZLES),i=keys.indexOf(id);
 const next=[...keys.slice(i+1),...keys.slice(0,i)].find(key=>!familyComplete(key));
 if(next)familySelectQuestion(next);else mysterySolve();
}
function familySelectQuestion(id){
 if(S.panel||!mysteryReady()||!MYSTERY_PUZZLES[id])return;
 S.chapter.question=id;S.chapter.feedback='';render();chapterFocus('#deductionQuestion');
}
function mysterySelect(id){
 if(S.panel||!mysteryReady())return;
 const p=MYSTERY_PUZZLES[familyQuestion()],d=mysteryDraft(familyQuestion());
 if(!p.clues.includes(id)||!mysteryClues().includes(id))return;
 if(d.selected.includes(id))d.selected=d.selected.filter(v=>v!==id);
 else if(d.selected.length<p.count)d.selected.push(id);
 else {S.chapter.feedbackTarget='evidence';S.chapter.feedback=`根拠は${p.count}つ選びます。選択したものを押すと外せます。`;render();return;}
 S.chapter.feedback='';render();chapterFocus(`[data-act="mystery-clue"][data-v="${id}"]`);
}
function mysteryTheory(id){
 if(S.panel||!mysteryReady())return;
 const p=MYSTERY_PUZZLES[familyQuestion()];if(!p.options.some(o=>o.id===id))return;
 mysteryDraft(familyQuestion()).theory=id;S.chapter.feedback='';render();chapterFocus(`[data-act="mystery-theory"][data-v="${id}"]`);
}
function mysteryHint(){if(S.panel||!mysteryReady())return;mysteryDraft(familyQuestion()).hint=true;render();}
function mysterySolve(){
 if(S.panel||!mysteryReady())return;
 const c=S.chapter,keys=Object.keys(MYSTERY_PUZZLES),missing=keys.find(id=>!familyComplete(id));
 if(missing){familyRequire(missing);return;}
 c.attempts=(c.attempts||0)+1;
 const errors=keys.flatMap(id=>{
  const p=MYSTERY_PUZZLES[id],d=mysteryDraft(id);
  const facts=d.selected.every(k=>mysteryClues().includes(k))&&p.correct.every(k=>d.selected.includes(k));
  return !facts||d.theory!==p.answer?[{id,text:!facts?p.evidenceFeedback:p.feedback}]:[];
 });
 if(errors.length){
  c.question=errors[0].id;c.notice='その証拠では、まだここまで言えない。';c.contradictions=errors;
  c.act=1;openChapterTimeline();return;
 }
 c.solutions[SCENARIO.review.deduction]={attempts:c.attempts,answers:Object.fromEntries(keys.map(id=>[id,{...mysteryDraft(id),selected:[...mysteryDraft(id).selected]}]))};
 c.notice='';c.contradictions=[];c.feedback='';render();chapterFocus('#mysterySolved');
}
function familyClueSource(id){
 if(!S.chapter||!mysteryClues().includes(id))return;
 const clue=MYSTERY_CLUES[id];S.panel=null;openChapterNode(clue.node);
 const page=chapterPages(chapterNode(clue.node)).findIndex(p=>p.key===clue.pageKey);
 S.chapter.page=Math.max(0,page);render();chapterFocus();
}
function mysteryActAvailable(act){return CHAPTER_NODES.some(n=>n.act===act&&chapterAvailable(n.id));}
function mysteryAct(value){const act=Number(value);if(S.scr!=='multi'||S.chapter?.view!=='timeline'||!mysteryActAvailable(act))return;S.chapter.act=act;render();chapterFocus();}
function familyResumeHTML(){return chapterDone(SCENARIO.review.after)&&S.chapter.node!==SCENARIO.review.deduction&&!chapterDone(SCENARIO.review.deduction)?`<button type="button" class="multi-primary" data-act="chapter-node" data-v="${esc(SCENARIO.review.deduction)}">最終推理へ ↗</button>`:'';}
function familyDocumentLinkHTML(key,label='こもれび通信 第17号を読む'){
 if(key==='daughter-license')return familyLicenseButtonHTML();
 if(key!=='newsletter')return '';
 return `<a class="family-document-link noadv" href="komorebi-17.html" target="_blank" rel="noopener">${esc(label)}<small>別タブ ↗</small></a>`;
}
function mysteryNotebookHTML(){
 const ids=mysteryClues();
 return `<div class="mystery-notes"><p>読んだ場面で確かめたこと。${ids.length}件の手掛かり。</p>${ids.map(id=>{const v=MYSTERY_CLUES[id];return `<article><small>${esc(v.who)}</small><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p>${v.document?familyDocumentLinkHTML(v.document):''}<button type="button" class="btn" data-act="family-source" data-v="${id}">この場面を読み返す ↗</button></article>`;}).join('')||'<p>まだ記録はありません。窓口の一日を読み進めましょう。</p>'}<p class="mystery-small">プレイヤーが読んだ場面を振り返るための画面です。主人公が住民の実名や事情を私的に書き留めたノートではありません。</p></div>`;
}
function mysteryPuzzleHTML(){
 const c=S.chapter,keys=Object.keys(MYSTERY_PUZZLES);
 if(c.solutions[SCENARIO.review.deduction])return `<section class="mystery-solved" id="mysterySolved" tabindex="-1"><small>${keys.length===3?'三つ':keys.length+'問'}の推理と根拠がそろった</small>${keys.map((id,i)=>`<h2>${i+1}. ${esc(MYSTERY_PUZZLES[id].title)}</h2><p>${esc(MYSTERY_PUZZLES[id].solved)}</p>`).join('')}<p>${esc(SCENARIO.review.solvedPrompt||'推理がまとまった。')}</p></section>`;
 const id=familyQuestion(),p=MYSTERY_PUZZLES[id],d=mysteryDraft(id);
 const feedback=target=>c.feedback&&(c.feedbackTarget||'theory')===target?`<p class="mystery-feedback" id="deductionFeedback" role="status" tabindex="-1">${esc(c.feedback)}</p>`:'';
 return `<section class="mystery-puzzle family-puzzle" aria-label="最終推理"><nav class="family-questions" aria-label="推理する問い">${keys.map((key,i)=>`<button type="button" data-act="family-question" data-v="${key}" aria-pressed="${key===id}">${i+1}. ${esc(MYSTERY_PUZZLES[key].shortTitle||MYSTERY_PUZZLES[key].title)}<small>${familyComplete(key)?'選択済み':key===id?'選択中':'未選択'}</small></button>`).join('')}</nav>
 <p class="mystery-kicker">推理 ${keys.indexOf(id)+1} / ${keys.length}</p><h2 id="deductionQuestion" tabindex="-1">${esc(p.title)}</h2>
 <fieldset class="mystery-theories"><legend>推理を一つ選ぶ</legend>${feedback('theory')}${p.options.map((o,i)=>`<button type="button" data-act="mystery-theory" data-v="${o.id}" aria-pressed="${d.theory===o.id}"><span>${i+1}</span>${esc(o.text)}</button>`).join('')}</fieldset>
 <fieldset class="mystery-evidence"><legend>根拠を${p.count}つ選ぶ <span>${d.selected.length} / ${p.count}</span></legend>${feedback('evidence')}${p.clues.filter(key=>mysteryClues().includes(key)).map(key=>`<button type="button" data-act="mystery-clue" data-v="${key}" aria-pressed="${d.selected.includes(key)}"><span class="clue-check" aria-hidden="true">${d.selected.includes(key)?'✓':'＋'}</span><span><b>${esc(MYSTERY_CLUES[key].title)}</b><small>${esc(MYSTERY_CLUES[key].text)}</small></span></button>`).join('')}</fieldset>
 ${d.hint?`<p class="mystery-hint">${esc(p.hint)}</p>`:''}<div class="mystery-actions"><button type="button" data-act="mystery-hint">考えるヒント</button></div><p class="mystery-small">各問いで推理を一つと、指定数の根拠を選びます。${keys.length===3?'三問':keys.length+'問'}がそろうと「答え合わせ」へ進めます。手掛かりやタイムラインへ移っても選択は残ります。</p></section>`;
}
function mysteryReadHTML(){
 const c=S.chapter,n=chapterNode(c.node),pages=chapterPages(n),page=pages[c.page],last=c.page===pages.length-1,puzzle=!!n.puzzle,blocked=puzzle&&!c.solutions[SCENARIO.review.deduction];
 const part=familyPagePresentation(page),dialogue=!puzzle&&!page.beat,moment=STORY_MOMENTS.html(page);
 const keys=Object.keys(MYSTERY_PUZZLES),id=familyQuestion(),draft=blocked?mysteryDraft(id):null,p=MYSTERY_PUZZLES[id],complete=blocked?keys.filter(familyComplete).length:0;
 const choosing=part.last&&page.decision&&!c.choices[page.decision]&&!chapterDone(n.id);
 const action=choosing?'':familyResumeHTML()|| (blocked?`<div class="multi-page-controls family-page-controls"><div class="family-progress" role="status"><b>${complete} / ${keys.length} 問の選択完了</b><span>この問い：推理${draft.theory?' ✓':' 未選択'} · 根拠 ${draft.selected.length} / ${p.count}</span></div><button type="button" class="multi-primary" data-act="${complete===keys.length?'mystery-solve':'family-next'}">${complete===keys.length?'答え合わせ':!draft.theory?'推理を選ぶ':!familyComplete(id)?'根拠を選ぶ':'次の問いへ ▶'}</button></div>`:
 `<div class="multi-page-controls"><button type="button" class="multi-primary" data-act="chapter-next">${!part.last?'次へ':n.id===SCENARIO.review.after&&last&&!chapterDone(n.id)?(SCENARIO.review.label||'出来事を振り返る'):puzzle?(SCENARIO.review.continueLabel||'続きを読む'):page.decision&&!c.choices[page.decision]&&!chapterDone(n.id)?'応対を選ぶ':last&&chapterDone(n.id)?'タイムラインへ':'次へ'} ▶</button></div>`);
 return `<section class="multi-screen multi-reader noadv${dialogue?' family-dialogue-layout':''}${choosing?' family-response-layout':''}${moment?' family-moment-layout':''}">${chapterArt(page.scene,page.portrait,page.mood)}${moment}${chapterHeader(n.title,`${n.id==='outside'?'庁舎の外':'あなたの視点'}${chapterDone(n.id)?' ／ 読み返し':''}`,page.time||n.time)}
 <div class="multi-reading has-conversation" id="chapterReading" data-reading-key="${n.id}-${c.page}${puzzle?'-'+familyQuestion()+(c.solutions[SCENARIO.review.deduction]?'-solved':''):''}" tabindex="0" aria-label="物語の本文。上へスクロールして前の会話"><div class="conversation-past">${conversationHistoryHTML()}</div><div class="conversation-current${page.beat?' family-beat-page':''}" data-conversation-current tabindex="-1">${puzzle?mysteryPuzzleHTML():familyStoryTextHTML(page.text,page.key||n.id+'-'+c.page,page.beat)}
 ${part.last&&page.decision?familyDecisionHTML(page):''}
 ${!part.last||page.decision==='issuance'&&!chapterDone(n.id)&&!c.choices.issuance?'':page.document?familyDocumentLinkHTML(page.document):''}
 ${n.training&&S.misses.length?`<div class="multi-review">${S.misses.map(m=>`<article><h2>${esc(m.q)}</h2><p>選んだ判断：${esc(m.mine)}</p><p>フローの判断：${esc(m.right)}</p><p>${esc(m.rule)}</p></article>`).join('')}</div>`:''}</div></div>${chapterFooter(action)}</section>`;
}
function mysteryEndHTML(){
 return FAMILY_ENDING.html();
}
function pacingBlock(id){return CHAPTER_BLOCKS.find(b=>b.nodes.includes(id));}
function pacingNext(id){return chapterNode(PACING_ORDER[PACING_ORDER.indexOf(id)+1]);}
function pacingFrontier(){return PACING_ORDER.map(chapterNode).find(n=>!chapterDone(n.id)&&chapterAvailable(n.id));}
function pacingPageNumber(n){return `${S.chapter.page+1} / ${chapterPages(n).length}`;}
function pacingContinue(n){
 const next=pacingNext(n.id);
 if(next&&next.block===n.block&&chapterAvailable(next.id)){openChapterNode(next.id);return true;}
 return false;
}
function pacingFinishNode(){
 const c=S.chapter,n=chapterNode(c?.node);
 if(S.scr!=='multi'||S.panel||c?.view!=='read'||!n||n.training||chapterDone(n.id)||c.page!==chapterPages(n).length-1||n.puzzle&&!c.solutions[SCENARIO.review.deduction])return;
 c.done.push(n.id);delete c.progress[n.id];
 if(n.id===SCENARIO.review.after){c.act=1;c.notice=SCENARIO.review.notice;openChapterTimeline();return;}
  if(!pacingNext(n.id)){chapterEnd();return;}
 if(pacingContinue(n))return;c.view='bridge';render();chapterFocus();
}
function pacingRereadNext(){openChapterTimeline();}
function pacingBridgeContinue(){
 if(S.scr!=='multi'||S.chapter?.view!=='bridge'||S.panel||consumeReadbackAdvance())return;
 const next=pacingFrontier();if(next){S.chapter.chapterIntros||=[];if(!S.chapter.chapterIntros.includes(next.block))S.chapter.chapterIntros.push(next.block);openChapterNode(next.id,true);}else chapterEnd();
}
function pacingBridgeHTML(){
 const next=pacingFrontier();return next?familyChapterCardHTML(next,'pacing-continue'):chapterEndHTML();
}

function pacingTimelineHTML(){
 const c=S.chapter,act=c.act||1,blocks=CHAPTER_BLOCKS.filter(b=>b.act===act),complete=b=>b.nodes.every(chapterDone),done=CHAPTER_BLOCKS.filter(complete).length;
 return `<section class="multi-screen multi-map noadv">${chapterArt('scene-lobby')}${chapterHeader('タイムライン',`${done} / ${CHAPTER_BLOCKS.length} 章を読了`,clockTimelineReturn()?.time||chapterNode(blocks[0].nodes[0]).time)}
 <div class="multi-map-body">${c.notice?`<div class="mystery-feedback" role="status"><p>${esc(c.notice)}</p>${(c.contradictions||[]).map(e=>`<p>問い${Object.keys(MYSTERY_PUZZLES).indexOf(e.id)+1}：${esc(e.text)}</p>`).join('')}</div>`:''}
 <nav class="mystery-acts" aria-label="物語の章">${MYSTERY_ACTS.map(a=>`<button type="button" data-act="mystery-act" data-v="${a.id}" aria-pressed="${act===a.id}" ${mysteryActAvailable(a.id)?'':'disabled'}><b>第${a.id}章</b><span>${mysteryActAvailable(a.id)?esc(a.title):'まだ先'}</span></button>`).join('')}</nav>
 <div class="pacing-chapters">${blocks.map(b=>{const ready=chapterAvailable(b.nodes[0]);return `<section class="family-chapter ${ready?'':'locked'}"><h2>第${CHAPTER_BLOCKS.indexOf(b)+1}章 · ${ready?esc(b.title):'まだ先の章'}</h2>${b.nodes.map(id=>{const n=chapterNode(id),available=chapterAvailable(id);return `<button type="button" class="multi-node ${chapterDone(id)?'read':''}" data-act="chapter-node" data-v="${id}" ${available?'':'disabled'}><span class="multi-node-top"><time>${esc(n.time)}</time><small>${chapterStatus(n)}</small></span><b>${available?esc(n.title):'手前の場面を読むと開きます'}</b><span class="multi-node-note">${chapterDone(id)?'読み返す':available?'続きへ':''}</span></button>`;}).join('')}</section>`;}).join('')}</div></div>
 ${chapterFooter(clockTimelineReturn()?'<button type="button" class="multi-primary" data-act="clock-return">元の場面へ ▶</button>':done===CHAPTER_BLOCKS.length?'<button type="button" class="multi-primary" data-act="chapter-end">結末を読み返す ▶</button>':chapterDone(SCENARIO.review.after)&&!chapterDone(SCENARIO.review.deduction)?`<button type="button" class="multi-primary" data-act="chapter-node" data-v="${esc(SCENARIO.review.deduction)}">最終推理へ ▶</button>`:'<span class="multi-footnote">読んだ場面へ、いつでも戻れます</span>')}</section>`;
}

function titleHTML(){
 return `<div class="ov title console-title noadv" data-title-motion="${TITLE_CINEMA.playing()?'on':'off'}">${TITLE_CINEMA.html()}<div class="console-title-tools">${quickSoundHTML()}<button type="button" class="console-title-settings" data-act="settings" aria-haspopup="dialog">設定</button></div><div class="tx"><div class="eyebrow">こもれび町・証明書窓口</div><h1>証明書窓口<br>ドリル</h1><p class="opening-line">一枚の証明書。<br>その向こうに、一人の暮らし。</p><div class="menu"><button type="button" class="mbtn main mode-entry" id="start" data-act="start">通常モード <span aria-hidden="true">›</span></button><button type="button" class="mbtn mode-entry" id="story-start" data-act="family-entry" aria-haspopup="dialog">ストーリーモード <span aria-hidden="true">›</span></button></div><div class="src"><span class="title-mado">芽室町のOSS <a href="https://github.com/Memuro-Town/MADO" target="_blank" rel="noopener noreferrer">MADO</a> の公開資料を参考に制作</span><span>非公式の研修用ゲーム · 人物・住所は架空です</span><span>個人開発：<a href="https://github.com/rtoki" target="_blank" rel="noopener noreferrer">tocky8bit</a> · 所属組織とは関係ありません</span><span class="title-repo"><a href="https://github.com/rtoki/madoguchi-drill" target="_blank" rel="noopener noreferrer">GitHub · ソースコード・ご意見</a></span></div></div></div>`;
}
function endHTML(){
  const pct=S.max?S.score/S.max:0; const [rank,msg]=rankOf(pct,S.inc);
  const R=52, C=2*Math.PI*R;
  const ring=`<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="正答率${Math.round(pct*100)}%"><circle cx="60" cy="60" r="${R}" fill="none" stroke="rgba(150,190,230,.2)" stroke-width="10"/><circle cx="60" cy="60" r="${R}" fill="none" stroke="#F4CF31" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C*pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 60 60)"/><text x="60" y="58" text-anchor="middle" font-size="26" fill="#FFFFFF">${Math.round(pct*100)}<tspan font-size="13">%</tspan></text><text x="60" y="78" text-anchor="middle" font-size="10" fill="#B9C8D8">得点率</text></svg>`;
  const bars=Object.keys(S.cs).map(k=>{const v=S.cs[k];const p=v.n?v.ok/v.n:0;return `<div class="bar"><span>${esc(CAT_LABEL[k])}</span><span class="track"><span class="fill" style="width:${(p*100).toFixed(0)}%;display:block"></span></span><span class="v">${v.ok}/${v.n}</span></div>`;}).join("");
  const faces=S.recap.map(r=>{const c=CASES.find(x=>x.id===r.id);const m=r.miss===0?(BYE_MOOD[c.end.tag]||"neutral"):r.miss===1?"neutral":"annoyed";return `<div class="vf"><div class="pic">${avatar(LOOK[r.id],m,true)}</div><span>${esc(c.visitor.name)}</span><span class="tag ${r.tag}">${esc(r.label)}</span><span>${r.miss?`ミス${r.miss}`:"ミスなし"}</span></div>`;}).join("");
  const misses=S.misses.length?S.misses.map(m=>`<details><summary><span class="r">${flowReferenceButton(m.ref,m.cat||CASES.find(c=>c.title===m.title)?.cat)}</span>${esc(m.title)}${m.inc?` <span class="tag ng">重大な誤り</span>`:""}</summary><dl><dt>場面</dt><dd>${esc(m.q)}</dd><dt>あなた</dt><dd>${esc(m.mine)}</dd><dt>正しくは</dt><dd>${esc(m.right)}</dd><dt>根拠</dt><dd>${esc(m.rule)}</dd></dl></details>`).join(""):`<div class="allclear">間違えた判断はありません。種類を変えるか「全員」で試してみてください。</div>`;
  return `<div class="ov endov noadv"><div class="end">
    <div class="top"><div class="face">${avatar(SENPAI,pct>=.75&&!S.inc?"smile":"calm",true)}</div>
      <div><small>${modeName()} · ${S.queue.length}人を応対</small><h1>${esc(rank)}</h1><p class="say">${SENPAI_NAME}「${esc(msg)}」</p>${S.newBest?`<p style="margin:6px 0 0"><span class="tag ok">自己ベスト更新</span></p>`:""}</div>
      ${ring}</div>
    <dl class="estats"><div><dt>得点</dt><dd>${S.score}<small style="font-size:13px"> / ${S.max}</small></dd></div><div><dt>正しい判断</dt><dd>${S.correct}/${S.total}</dd></div><div><dt>お待たせ時間</dt><dd>+${S.wait}分</dd></div><div><dt>重大な誤り</dt><dd>${S.inc}</dd></div><div><dt>相談</dt><dd>${S.hints}</dd></div></dl>
    ${storyRecapHTML()}
    <div class="bars"><h3>証明の種類ごとの正答</h3>${bars}</div>
    <div class="faces"><h3>今日の来庁者</h3><div class="row">${faces}</div></div>
    <div class="misses"><h3>見直す判断</h3>${misses}</div>
    <div class="eact"><button type="button" class="mbtn main" id="again" data-act="replay">同じ条件でもう一度</button><button type="button" class="mbtn" id="e-title" data-act="home">タイトルへ</button><button type="button" class="mbtn" id="e-ref" data-act="ref">フロー早見</button></div>
  </div></div>`;
}

/* Introduce the real project before entering the fictional training scene. */
function madoLinksHTML(){
  return `<div class="mado-links">
    <a href="https://www.memuro.net/administration/soshiki/soumu/dx/2026-0612-memuro-oss.html" target="_blank" rel="noopener noreferrer"><b>芽室町の取組を知る <span aria-hidden="true">↗</span></b><span>「楽らく窓口」とMADOの紹介</span></a>
    <a href="https://github.com/Memuro-Town/MADO" target="_blank" rel="noopener noreferrer"><b>MADOを詳しく見る <span aria-hidden="true">↗</span></b><span>オープンソースの公式 GitHub</span></a>
  </div>`;
}
function madoWelcomeHTML(){
 const normal=S.launchMode!=='story';
 const intro=normal?`<p class="welcome-lead">あなたは、こもれび町役場・住民課に配属されたばかりの新人職員。今日は窓口の受付当番です。</p><p class="welcome-lead">まずは先輩の真鍋さんと、「書かない窓口」の流れを確認しましょう。</p>`:`<p class="welcome-lead">こもれび町役場。配属されたばかりの新人職員として、窓口の一日を過ごします。</p>`;
 return `<dialog class="panel mado-welcome noadv console-welcome" id="madoWelcome" aria-labelledby="madoWelcomeTitle"><div class="welcome-body"><h2 id="madoWelcomeTitle" tabindex="-1">窓口の一日を、始めよう。</h2>${intro}<details class="console-options"><summary>このゲームの設定</summary><p>登場する町・人物・書類は架空です。職員用PCもゲーム専用の模擬画面で、実際の業務システムには接続しません。</p></details><p class="welcome-note welcome-fiction">本作のストーリーはフィクションです。登場する町・人物・団体・事件・出来事はすべて架空であり、北海道芽室町および同町の職員・住民・実際の出来事とは一切関係ありません。</p></div><footer class="welcome-actions"><button type="button" class="btn" data-act="close">戻る</button><button type="button" class="btn welcome-begin" data-act="begin-training">始める <span aria-hidden="true">▶</span></button></footer></dialog>`;
}


const FLOW_CHARTS=SCENARIO.content.FLOW_CHARTS;
/* Reference diagrams: training order adapted from the cited municipal workflow. */
function currentFlowRef(){
 const b=beat();return S.scr==='play'?(b?.feedback?.ref||(b?.si!==undefined?curCase()?.steps[b.si]?.ref:'')||''):'';
}
function flowCurrentNodes(g,ref){
 if(!ref)return [];
 const exact=g.nodes.filter(n=>n.label===ref);if(exact.length)return exact;
 const refs=ref==='共-6〜8'?['共-6','共-印刷','共-署名','共-7','共-審査','共-8']:ref==='印-発行'?['共-7']:ref==='検索'?['住-1']:ref==='共-印刷'&&!g.nodes.some(n=>n.ref===ref)?['共-6']:[ref];
 return g.nodes.filter(n=>refs.includes(n.ref));
}
function flowChart(){return FLOW_CHARTS.find(g=>g.key===S.flowKey)||FLOW_CHARTS[0];}
function flowDestination(ref,cat){
 const preferred=ref==='共-1'||ref==='共-2'?'共通':cat;
 const chart=FLOW_CHARTS.find(g=>g.key===preferred&&flowCurrentNodes(g,ref).length)||FLOW_CHARTS.find(g=>g.nodes.some(n=>n.label===ref))||FLOW_CHARTS.find(g=>flowCurrentNodes(g,ref).length);
 return chart?{chart,node:flowCurrentNodes(chart,ref)[0]}:null;
}
function flowReferenceButton(ref,cat,hidden=false){
 if(S.mode!=='normal'||!flowDestination(ref,cat))return esc(ref);
 return `<button type="button" class="flow-ref-link noadv" data-act="flow-ref" data-v="${esc(ref)}" data-flow-cat="${esc(cat||'')}" aria-haspopup="dialog" aria-label="${esc(ref)}のフローチャートを確認" title="フローチャートの該当箇所を開く"${hidden?' hidden':''}>${esc(ref)}</button>`;
}
function flowReferenceRuns(full,feedback){
 if(S.mode!=='normal'||!feedback)return [{text:full,start:0}];
 const cat=feedback.cat||curCase()?.cat;
 const codes=[...new Set([...REF.flatMap(([,rows])=>rows.map(([ref])=>ref)),...CASES.flatMap(c=>c.steps.map(st=>st.ref)),...FLOW_CHARTS.flatMap(g=>g.nodes.flatMap(n=>[n.ref,n.label]))])].filter(ref=>ref.includes('-')).sort((a,b)=>b.length-a.length);
 const pattern=new RegExp('【([^】]+)】|(?:'+codes.join('|')+')(?![A-Za-z0-9-])','g');
 const runs=[];let at=0;
 for(const match of full.matchAll(pattern)){
  const ref=match[1]||match[0],start=match.index+(match[1]?1:0);
  if(!flowDestination(ref,cat))continue;
  if(start>at)runs.push({text:full.slice(at,start),start:at});
  runs.push({text:ref,start,ref,cat});at=start+ref.length;
 }
 if(at<full.length)runs.push({text:full.slice(at),start:at});
 return runs;
}
function feedbackTextHTML(full,feedback){
 return flowReferenceRuns(full,feedback).map(r=>r.ref?flowReferenceButton(r.ref,r.cat):esc(r.text)).join('');
}
function openFlowReference(ref,cat,button){
 if(S.mode!=='normal'||!flowDestination(ref,cat))return;
 S.flowReturn={panel:S.panel,reading:captureReadback(),logTop:document.querySelector('.panel .body')?.scrollTop||0,endTop:document.querySelector('.endov')?.scrollTop||0,details:[...(document.querySelectorAll?.('.endov details')||[])].map(el=>el.open),focus:[...(document.querySelectorAll?.('.flow-ref-link')||[])].indexOf(button)};
 openFlow('reference',ref,cat);
}
function openFlow(from,ref=currentFlowRef(),cat=curCase()?.cat){
 if(from!=='reference'&&S.panel!=='ref')S.flowReturn=null;
 S.flowFrom=from||(S.panel==='ref'?S.flowFrom:'menu');
 const destination=flowDestination(ref,cat),key=destination?.chart.key||cat||'共通';
 S.panel='ref';S.flowKey=key;S.flowScale=1;S.flowRef=ref;
 const g=flowChart();S.flowNode=flowCurrentNodes(g,ref)[0]?.id??null;
 S.flowTarget=S.flowNode||g.nodes[0].id;render();
 requestAnimationFrame(()=>document.getElementById('flowViewport')?.focus({preventScroll:true}));
}
function closeFlow(){
 const from=S.flowFrom,back=S.flowReturn;S.panel=back?.panel||null;S.materialReturn=null;S.flowFrom=null;S.flowReturn=null;S.flowRef=null;render();
 requestAnimationFrame(()=>{
  if(back){
   restoreReadback(back.reading);
   const log=document.querySelector('.panel .body'),end=document.querySelector('.endov');
   document.querySelectorAll?.('.endov details').forEach((el,i)=>{el.open=!!back.details[i];});
   if(log)log.scrollTop=back.logTop;if(end)end.scrollTop=back.endTop;
   document.querySelectorAll?.('.flow-ref-link')[back.focus]?.focus({preventScroll:true});
  }
  else if(from==='material')focusMaterialLauncher('work');
  else document.querySelector('[data-act="menu"]')?.focus({preventScroll:true});
 });
}
const TRAINING_TERMS=SCENARIO.content.TRAINING_TERMS;
function flowPanelHTML(){
 const g=flowChart(),ref=S.flowRef??currentFlowRef(),n=g.nodes.find(n=>n.id===S.flowNode),current=flowCurrentNodes(g,ref).map(n=>n.id);
 const rows=REF.flatMap(([,r])=>r),detail=n?(rows.find(([k])=>k===n.label)||rows.find(([k])=>k===n.ref))?.[1]||n.note:'';
 const names={'共通':'共通受付','住民票':'住民票','印鑑':'印鑑証明','戸籍':'戸籍証明','附票':'附票'};
 return `<div class="flow-backdrop noadv" data-act="flow-backdrop" aria-hidden="true"></div><div class="panel flow-panel noadv" role="dialog" aria-modal="true" aria-label="新人のあんちょこ · フロー早見図">
  <header><b>新人のあんちょこ <small>フロー早見図</small></b><button type="button" class="btn" id="p-close" data-act="flow-close">${S.flowReturn?(S.flowReturn.panel==='log'?'ログへ戻る':S.scr==='end'?'振り返りへ戻る':'解説へ戻る'):'手元へ戻す'}</button></header>
  ${S.flowFrom==='material'?workMaterialNavigationHTML():''}<nav class="flow-tabs" aria-label="証明書の種類">${FLOW_CHARTS.map(v=>`<button type="button" data-act="flow-tab" data-v="${v.key}" aria-pressed="${v.key===g.key}">${names[v.key]}</button>`).join('')}</nav>
  <div class="flow-tools" aria-label="図の表示操作"><button type="button" data-act="flow-zoom" data-v="out" aria-label="図を縮小">−</button><button type="button" data-act="flow-zoom" data-v="reset" id="flowPercent" aria-label="図を100パーセントに戻す">100%</button><button type="button" data-act="flow-zoom" data-v="in" aria-label="図を拡大">＋</button><button type="button" data-act="flow-zoom" data-v="fit">全体</button>${FLOW_CHARTS.some(chart=>flowCurrentNodes(chart,currentFlowRef()).length)?'<button type="button" class="flow-current" data-act="flow-current">今の判断へ</button>':''}</div>
  <p class="flow-guide">矢印の条件をたどる · 枠を押すと説明<span>上下左右にスクロールできます</span></p>
  <div class="flow-workspace ${n?'has-detail':''}">
   <section class="flow-viewport" id="flowViewport" tabindex="0" aria-label="${esc(g.title)}のフローチャート。上下左右にスクロールできます。">
    <div class="flow-sized" id="flowSized"><div class="flow-canvas" id="flowCanvas" style="width:${g.width}px;height:${g.height}px">
    ${g.svg}${g.nodes.map(v=>`<button type="button" class="flow-node ${v.kind?'flow-'+v.kind:''} ${v.id===S.flowNode?'selected':''} ${current.includes(v.id)?'is-current':''}" data-act="flow-node" data-v="${v.id}" style="left:${v.left}px;top:${v.top}px;width:${v.width}px;height:${v.height}px" aria-pressed="${v.id===S.flowNode}" aria-label="${esc(v.label+'：'+v.title)}${current.includes(v.id)?'。参照箇所':''}"><span class="flow-ref">${v.kind==='decision'?'◇ 判断 · ':v.kind==='hold'?'保留・確認 · ':v.kind==='stop'?'交付不可 · ':''}${esc(v.label)}</span><b>${esc(v.title)}</b>${v.note?`<small>${esc(v.note)}</small>`:''}</button>`).join('')}
    </div></div>
   </section>
   ${n?`<aside class="flow-detail" aria-label="選んだ工程の説明"><div class="flow-detail-top"><b>${esc(n.label)}</b><button type="button" data-act="flow-detail-close" aria-label="工程の説明をたたむ">×</button></div><div class="flow-detail-text" tabindex="0"><h3>${esc(n.title)}</h3>${detail?`<p>${esc(detail)}</p>`:''}${n.note&&n.note!==detail?`<p class="flow-note">図の補足：${esc(n.note)}</p>`:''}<p class="flow-source">自治体の窓口業務を題材に、研修用に確認順を整理した図です。印鑑証明は登録証を持参した通常の受付だけを扱います。</p></div></aside>`:''}
  </div>
  <details class="flow-text"><summary>用語・文章で確認・出典</summary><div><h4>用語</h4><dl>${TRAINING_TERMS.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${REF.map(([title,rs])=>`<h4>${esc(title)}</h4><dl>${rs.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`).join('')}<p><a href="https://github.com/Memuro-Town/MADO-packages/blob/70f912dbbcd67fa9241b38bb891034a9c604c6f9/docs/form/workflow.html" target="_blank" rel="noopener">参考にした業務フロー（外部資料）</a> · 2026年10月の運用記録／非公式の研修用表示</p><p>印鑑証明は対象者の登録証を持参した通常の受付に限定しています。未持参・紛失・提示省略などの個別対応は扱いません。実際の取扱いは各自治体の案内をご確認ください。<a href="https://www.moj.go.jp/MINJI/minji04_00082.html" target="_blank" rel="noopener">戸籍の広域交付（法務省）</a>。全国一律の手順を示すものではありません。</p></div></details>
 </div>`;
}
function updateFlowView(){
 const viewport=document.getElementById('flowViewport'),canvas=document.getElementById('flowCanvas'),sized=document.getElementById('flowSized');if(!viewport||!canvas)return;
 const g=flowChart(),z=S.flowScale||1;
 canvas.style.transform=`scale(${z})`;sized.style.width=g.width*z+'px';sized.style.height=g.height*z+'px';
 document.getElementById('flowPercent').textContent=Math.round(z*100)+'%';
 if(S.flowTarget!==undefined){
  const n=g.nodes.find(n=>n.id===S.flowTarget)||g.nodes[0];
  viewport.scrollLeft=Math.max(0,(n.left+n.width/2)*z-viewport.clientWidth/2);
  viewport.scrollTop=Math.max(0,n.top*z-Math.max(0,Math.min(24,(viewport.clientHeight-n.height*z)/2)));delete S.flowTarget;
 }
}
function renderFlow(){
 const old=document.getElementById('flowViewport'),pos=old?{left:old.scrollLeft,top:old.scrollTop}:null;
 render();requestAnimationFrame(()=>{const el=document.getElementById('flowViewport');if(el&&pos){el.scrollLeft=pos.left;el.scrollTop=pos.top;}});
}
function chooseFlow(key){
 if(!FLOW_CHARTS.some(g=>g.key===key))return;
 S.flowKey=key;S.flowScale=1;S.flowNode=null;S.flowTarget=flowChart().nodes[0].id;render();
 requestAnimationFrame(()=>document.querySelector(`.flow-tabs [data-v="${key}"]`)?.focus({preventScroll:true}));
}
function chooseFlowNode(id){
 if(!flowChart().nodes.some(n=>n.id===id))return;
 S.flowNode=id;renderFlow();requestAnimationFrame(()=>document.querySelector('.flow-detail-text')?.focus({preventScroll:true}));
}
function zoomFlow(kind){
 const viewport=document.getElementById('flowViewport');if(!viewport)return;
 const old=S.flowScale||1,g=flowChart(),center={x:(viewport.scrollLeft+viewport.clientWidth/2)/old,y:(viewport.scrollTop+viewport.clientHeight/2)/old};
 S.flowScale=kind==='fit'?Math.max(.05,Math.min(1,viewport.clientWidth/g.width,viewport.clientHeight/g.height)):kind==='reset'?1:Math.max(.2,Math.min(1.6,Math.round((old+(kind==='in'?.15:-.15))*100)/100));
 updateFlowView();
 if(kind==='fit'){viewport.scrollLeft=0;viewport.scrollTop=0;}else{viewport.scrollLeft=center.x*S.flowScale-viewport.clientWidth/2;viewport.scrollTop=center.y*S.flowScale-viewport.clientHeight/2;}
}

/* BEGIN LICENSE NOTICES */
function licenseNoticesHTML(){return '';}
/* END LICENSE NOTICES */

function panelHTML(){
  if(isTipPanel())return tipPanelHTML();
  if(S.panel==="ref")return flowPanelHTML();
  if(S.panel==="welcome")return madoWelcomeHTML();
  if(S.panel==="family-license")return familyLicensePanelHTML();
  if (!S.panel) return "";
  let title="", body="";
  if (S.panel==="ref"){ title="フロー早見"; body=REF.map(([g,rows])=>`<h4>${esc(g)}</h4><dl>${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`).join(""); }
  else if (S.panel==="log"){ title="ログ"; body=`<div class="log">${S.log.length?S.log.map(l=>`<div class="${l.me?"me":""}"><b>${esc(l.n)}</b><span>${feedbackHistoryHTML(l.feedback)}${feedbackTextHTML(l.x,l.feedback)}</span></div>`).join(""):"<p>まだありません。</p>"}</div>`; }
  else if(S.panel==="person"){title="来庁者の人物メモ";body=personNotesHTML();}
  else if(S.panel==="request"){title="用件・人物";body=counterRequestHTML();}
  else if(S.panel==="timeline"){title="タイムライン";body=counterTimelineHTML();}
  else if(S.panel==="settings"){title="設定";body=gameSettingsHTML();}
  else if(S.panel==="chapter-notes"){title="手掛かり";body=mysteryNotebookHTML();}
  else if(S.panel==="chapter-menu"){title="メニュー";body=chapterMenuHTML();}
  else if(S.panel==="town-hall"){title=SCENARIO.content.TOWN_HALL?.title||"庁内案内";body=townHallBodyHTML();}
  else if(S.panel==="family-entry"){title="ストーリーモード";body=familyEntryHTML();}
  else if(S.panel==="family-term"){title="死戦期呼吸（しせんきこきゅう）";body=familyTermExplanationHTML();}
  else if(S.panel==="menu"){title="メニュー";body=gameMenu();}
  else { title="このゲームについて"; body=`
    <p><strong>個人開発：<a href="https://github.com/rtoki" target="_blank" rel="noopener noreferrer">tocky8bit</a></strong></p>
    <p><a href="https://github.com/rtoki/madoguchi-drill" target="_blank" rel="noopener noreferrer">GitHub：ソースコード・不具合報告・ご意見</a></p>
    <p>本作は tocky8bit が個人として開発・公開したゲームです。作者が所属する組織とは関係なく、その見解や方針を示すものではありません。</p>
    <p class="engine-version"><strong>ゲームエンジン v${esc(ENGINE.version)}</strong><br><small>シナリオ v${esc(SCENARIO.version)}</small></p>
    <p>北海道芽室町が OSS「MADO」の申請書作成パッケージ（form）の設計相談のために公開した、証明書窓口の業務フローをもとにした判断練習です。</p>
    <p>元資料：<a href="https://github.com/Memuro-Town/MADO-packages/blob/70f912dbbcd67fa9241b38bb891034a9c604c6f9/docs/form/workflow.html" target="_blank" rel="noopener">Memuro-Town/MADO-packages／docs/form/workflow.html</a>（2026-10-16の運用説明、2026-10-21の追記／公開資料の確認：2026-11-02）。申請書の欄構成は同リポジトリの「統一様式_標準化後.xlsx」を簡略化して再現しています。</p>
    ${madoLinksHTML()}
    <p>参考元の実装では、formで確認した情報をExcelの申請書に入れて印刷します。このゲームの端末は、その流れを題材にした独自の模擬画面です。<a href="https://github.com/Memuro-Town/MADO-packages/blob/70f912dbbcd67fa9241b38bb891034a9c604c6f9/packages/form/README.md" target="_blank" rel="noopener">参考元の実装説明（外部サイト）</a></p>
    <details class="console-options license-notices"><summary>利用条件・クレジット</summary>${licenseNoticesHTML()}</details>
    <h4>謝辞</h4>
    <p><a href="https://github.com/Memuro-Town/MADO" target="_blank" rel="noopener noreferrer">MADO</a>を開発・公開し、窓口業務の設計や運用の知見を共有されている皆さまに感謝します。開発者tocky8bitは、MADOの取り組みを個人として応援しています。</p>
    <h4>注意</h4>
    <p>元資料は一つの町の現行運用の記録です。他の自治体の運用や法令の解釈とは異なる場合があります。実務の判断は、各自治体の規程と上席の指示に従ってください。</p>
    <p>「運用案」の印がある問題は検討中の運用です（POS実機での確認はこれから）。OSS版formも設計議論中で、このゲームの操作画面は研修用に作成しています。戸籍・附票の本籍は転記前にも確認できるよう、改善要求を取り入れています。申請書への印字は現行フローに沿ったままです。</p>
    <p>郵送・公用請求、税証明、戸籍の後日交付は、元資料の詳細経路に含まれないため出題していません。</p>
    <p>本作のストーリーはフィクションです。登場する町・人物・団体・事件・出来事はすべて架空であり、北海道芽室町および同町の職員・住民・実際の出来事とは一切関係ありません。</p>
    <p>登場人物・住所・申請書の記載はすべて架空です。このページは芽室町やMADOプロジェクトの公式教材ではありません。</p>
    <p>人物と施設の写真風素材はAIで生成した架空のものです。実在の住民の写真は使用していません。</p>
    <p>通常モードの時計は9時開始・1ケース28分を目安に、応対と端末操作が進むと動きます。お待たせ時間も加算します。ストーリーは場面ごとの時刻に沿って進みます。いずれも実際の標準処理時間や実時間の経過を表すものではありません。</p>
    <h4>音楽</h4>${musicCreditsHTML()}
    ${SCENARIO.storyHelp||SCENARIO.content.STORY_HELP}
    ${SCENARIO.modeHelp||SCENARIO.content.MODE_HELP}
    <h4>職員用PCの操作</h4><p>申請書を作る場面でformを操作します。生年月日・氏名で検索し、申請者と対象者、住民票の記載事項を確認。「申請書の作成へ」で次の画面に進み、内容と部数を確認して、申請書を印刷します。操作のやり直しは減点しません。途中で閉じても、PCを開くと続きから操作できます。実システムに接続しない研修用の模擬画面です。</p>
    <h4>遊び方</h4>
    <p>クリック・タップ・Enter・スペースで文章を送ります。選択肢は 1〜4 キーでも選べます。［スキップ］で次の判断まで進み、［ログ］で会話を読み返せます。</p>
    <p>1問100点。通常モードで真鍋さんに相談するか、ストーリーモードで回答前のフローヒントを見ると50点まで。誤りは0点で、お待たせ時間が3分のびます。住民の権利や安全に関わる誤りは「重大な誤り」として数えます。</p>`; }
  return `<div class="panel noadv" role="dialog" aria-modal="true" aria-label="${title}"><header><b>${S.panel==='family-term'?'死戦期呼吸<small class="family-term-reading">しせんきこきゅう</small>':title}</b><button type="button" class="btn" id="p-close" data-act="close">${CONSOLE_PANEL_TRAIL.length?'戻る':['menu','chapter-menu'].includes(S.panel)?'再開':'閉じる'}</button></header>${S.panel==='settings'?settingsTabsHTML():''}<div class="body" ${S.panel==='settings'?`id="settings-content" role="tabpanel" aria-labelledby="settings-${S.settingsTab}-tab" data-settings-tab="${S.settingsTab}"`: ''}>${body}</div></div>`;
}

/* Read-only transcript above the current line. Scrolling never rewinds game state. */
let READBACK_ACTIVE=false;
function rememberChapterReading(){
 collectMysteryClues();
 const c=S.chapter;if(!c||S.scr!=='multi')return;
 c.readHistory||=[];
 const n=chapterNode(c.node);
 if(c.view==='read'&&n){
  const page=chapterPages(n)[c.page],person=CHAPTER_PEOPLE.find(p=>p.id===n.person),key=n.id+':'+c.page;
  if(page&&!c.readHistory.some(v=>v.key===key))c.readHistory.push({key,n:person.name,x:page.text,context:(page.time||n.time)+' · '+n.title});
  if(page?.decision&&c.choices[page.decision]){const option=FAMILY_DECISIONS[page.decision].options.find(o=>o.id===c.choices[page.decision]);const choiceKey=key+':decision';if(!c.readHistory.some(v=>v.key===choiceKey))c.readHistory.push({key:choiceKey,n:'あなた',x:'選んだ応対：'+option.label,context:(page.time||n.time)+' · '+n.title});}
 }
 if(c.view==='bridge'&&n?.choice){
  const option=n.options.find(o=>o.value===c.choices[n.choice]),key=n.id+':choice';
  if(option&&!c.readHistory.some(v=>v.key===key))c.readHistory.push({key,n:CHAPTER_PEOPLE.find(p=>p.id===n.person).name,x:'選んだ言葉：'+option.label,context:n.time+' · '+n.title});
 }
}
function rememberChapterCaseReading(){
 const c=S.chapter;if(!c)return;c.readHistory||=[];
 for(const [i,v] of S.log.entries()){
  const key='r2:log:'+i;
  if(!c.readHistory.some(e=>e.key===key))c.readHistory.push({...v,key,context:(v.time||chapterNode('r2').time)+' · 吉田さんの証明書'});
 }
}
function conversationHistory(){
 const c=S.chapter,history=c?.readHistory||[];
 if(S.scr==='play'){
  if(beat()?.t==='card')return [];
  const currentKey=S.ci+'-'+S.bi+'-'+beat()?.t;
  const log=S.logged===currentKey?S.log.slice(0,-1):S.log;
  return [...(c?.caseActive?history:[]),...log];
 }
 if(S.scr!=='multi')return [];
 if(c.view==='read'){
  const i=history.findIndex(v=>v.key===c.node+':'+c.page);
  const entries=i<0?[]:history.slice(0,i),page=chapterPages(chapterNode(c.node))[c.page],part=familyPagePresentation(page);
  if(part.prefix.trim())entries.push({...history[i],key:c.node+':'+c.page+':display',x:part.prefix});
  return entries;
 }
 return c.view==='bridge'||c.view==='end'?history:[];
}
function conversationHistoryHTML(){
 const entries=conversationHistory();if(!entries.length)return '';
 return `<section class="conversation-history noadv" aria-label="ここまでの会話"><h2>ここまでの会話</h2>${entries.map(v=>`<article class="conversation-entry"><header>${esc(v.n==='―'?'情景':v.n||'情景')}${v.context?`<small>${esc(v.context)}</small>`:''}</header>${feedbackHistoryHTML(v.feedback)}<p>${feedbackTextHTML(S.scr==='multi'?familyReadingText(v.x):v.x,v.feedback)}</p></article>`).join('')}</section>`;
}
function conversationHintHTML(){return '';}
function conversationReturnHTML(){return '<button type="button" class="readback-return noadv" data-act="readback-current" hidden>いまの会話へ ↓</button>';}
function readbackArea(){return document.getElementById(S.scr==='multi'?'chapterReading':'readingArea');}
function readbackCurrentTop(area){
 const current=area?.querySelector('[data-conversation-current]');
 return current?Math.max(0,current.getBoundingClientRect().top-area.getBoundingClientRect().top+area.scrollTop-area.clientTop):0;
}
function captureReadback(){
 const area=readbackArea();return area?{key:area.dataset.readingKey,top:area.scrollTop,anchor:readbackCurrentTop(area)}:null;
}
function isReadingBack(){const area=readbackArea();return !!area&&area.scrollTop<readbackCurrentTop(area)-24;}
function updateReadback(){
 const back=isReadingBack();READBACK_ACTIVE=back;document.getElementById('stage')?.classList.toggle('is-reading-back',back);
 document.querySelectorAll?.('.readback-return').forEach(b=>b.hidden=!back);
 GAME_READER.pause();
}
function resizeReadback(){
 const area=readbackArea();if(area&&!READBACK_ACTIVE)area.scrollTop=readbackCurrentTop(area);
 updateReadback();
}
function restoreReadback(position){
 const area=readbackArea();if(!area){updateReadback();return;}
 const top=readbackCurrentTop(area);
 area.scrollTop=position?.key===area.dataset.readingKey?Math.max(0,position.top+top-position.anchor):top;
 // The handler does not rerender: wheel, trackpad and touch keep native scrolling.
 area.onscroll=updateReadback;updateReadback();
}
function returnToConversation(){
 const area=readbackArea();if(!area)return;
 area.scrollTop=readbackCurrentTop(area);updateReadback();
 area.querySelector('[data-conversation-current]')?.focus({preventScroll:true});
}
function scrollConversationBack(){
 const area=readbackArea();if(!area)return;
 const entries=[...area.querySelectorAll('.conversation-entry')];
 const offset=e=>e.getBoundingClientRect().top-area.getBoundingClientRect().top+area.scrollTop-area.clientTop;
 const target=entries.filter(e=>offset(e)<area.scrollTop-8).pop()||entries[0];
 if(target){area.scrollTop=Math.max(0,offset(target));updateReadback();area.focus({preventScroll:true});}
}
function consumeReadbackAdvance(){if(S.panel||S.win||S.zoom!==null||!isReadingBack())return false;returnToConversation();return true;}
function handleReadbackKey(e){
 if(S.panel||S.win||S.zoom!==null||!isReadingBack()||e.target?.closest?.('button,a,input,select,textarea'))return false;
 if(e.key==='Enter'||e.key===' '||'1234'.includes(e.key)&&e.key.length===1){e.preventDefault();returnToConversation();return true;}
 return false;
}

function render(){
  const settingsView=captureSettingsView();
  const readbackPos=captureReadback();
  rememberChapterReading();
  saveFamilyProgress();
  const st=$("#stage"),oldReading=$("#readingArea");
  const readingPos=oldReading?{key:oldReading.dataset.readingKey,top:oldReading.scrollTop}:null;
  const oldChapter=document.getElementById("chapterReading");
  const chapterPos=oldChapter?{key:oldChapter.dataset.readingKey,top:oldChapter.scrollTop}:null;
  const scene=S.scr==="play"?(beat()?.scene||(beat()?.w==="s"&&S.hint?"scene-guidance":"")):"";
  st.dataset.scene=scene;
  st.dataset.storyTone=S.scr==="play"?(beat()?.tone||""):"";
  st.classList.toggle("is-reading-tip",isTipPanel());
  st.classList.toggle("is-multistory",S.scr==="multi");
  st.classList.toggle("photo",true);
  st.dataset.panel=S.panel||"";
  st.dataset.shelf="closed"; // Older saves may still contain the retired carousel flag.
  st.classList.toggle("has-overlay",(S.scr==="play"||S.scr==="multi")&&!!(S.win||S.panel||S.zoom!==null));
  st.classList.toggle("is-title",S.scr==="title");
  st.classList.toggle("is-card",S.scr==="play"&&beat()?.t==="card");
  st.classList.toggle("is-mentor",S.scr==="play"&&beat()?.w==="s");
  st.dataset.mentorExpression=S.scr==="play"&&beat()?.w==="s"&&beat()?.feedback?.ok?"smile":"";
  st.classList.toggle("is-decision",S.scr==="play"&&['ask','order'].includes(beat()?.t));
  st.classList.toggle("has-visit-request",!!currentVisitRequest());
  SOUND.sync();
  let h="";
  if (S.scr==="title"){ h = sceneHTML(false) + titleHTML(); }
  else if (S.scr==="multi"){h=chapterHTML();}
  else if (S.scr==="end"){ h = sceneHTML(false) + endHTML(); }
  else {
    const b=beat();
    h = sceneHTML(true) + (FX.cut&&!reduce()?`<div class="cut-flash" aria-hidden="true"></div>`:"") + hudHTML() + winHTML() + (FX.stamp?`<div class="stampfx ${FX.stamp}" aria-hidden="true">${FX.stamp==="ok"?"正解":"不正解"}</div>`:"") + `<div class="play-ui">${visitRequestHTML()}<section class="reading-area has-conversation" id="readingArea" tabindex="0" aria-label="本文と選択肢（長い場合は上下にスクロール）" data-reading-key="${S.ci}-${S.bi}-${b?.t}">` + conversationHistoryHTML() + `<div class="conversation-current" data-conversation-current tabindex="-1">` + conversationHintHTML() + mwHTML() + choicesHTML() + `</div></section>` + transportHTML() + `</div>` + (b&&b.t==="card"?cardHTML():"");
  }
  h += zoomHTML() + panelHTML();
  const focusDefaultMode=S.scr==="title"&&!S.panel&&!document.getElementById("start");
  const welcomeWasOpen=!!document.getElementById("madoWelcome")?.open;
  const oldPcDialog=document.getElementById('win');if(oldPcDialog?.open&&typeof oldPcDialog.close==='function')oldPcDialog.close();
  PORTRAIT_MOTION.beforeRender();
  GAME_READER.beforeRender();
  FAMILY_ENDING.beforeRender();
  STORY_MOMENTS.beforeRender();
  st.innerHTML = h;
  const pcDialog=document.getElementById('win');
  if(S.win==='term'&&pcDialog&&typeof pcDialog.showModal==='function'){
    pcDialog.addEventListener('cancel',event=>{event.preventDefault();closeMaterial();});
    if(!pcDialog.open)pcDialog.showModal();
  }
  restoreSettingsView(settingsView);
  if(focusDefaultMode)document.getElementById("start")?.focus({preventScroll:true});
  restoreReadback(readbackPos);
  if(S.panel==="ref")requestAnimationFrame(()=>updateFlowView());
  const welcome=document.getElementById("madoWelcome");
  if(welcome){welcome.showModal();document.getElementById("madoWelcomeTitle")?.focus({preventScroll:true});}
  else if(welcomeWasOpen){document.getElementById(S.scr==="end"?"again":S.launchMode==="story"?"story-start":"start")?.focus();}
  requestAnimationFrame(()=>{
    const reading=$("#readingArea");

    const chapterReading=document.getElementById("chapterReading");
    restoreReadback(readbackPos);
    updateMaterials({center:true});
    updateReadingOverflow();
  });
  updatePhotoLayout();
  PORTRAIT_MOTION.sync();
  GAME_READER.sync();
  FAMILY_ENDING.sync();
  STORY_MOMENTS.sync();
  TITLE_CINEMA.sync();
  FX = {};
}

/* BUNDLE_MOTION */

/* BUNDLE_READER */

/* ---------------- events ---------------- */
document.addEventListener("click", e=>{
  if(consumeMaterialSwipeClick(e))return;
  if(handleMaterialClick(e))return;
  const a=e.target.closest("[data-act]");
  if (a){
    const act=a.dataset.act;
    if(S.panel&&!a.closest(".panel")&&act!=="tip-backdrop"&&act!=="flow-backdrop")return;
    if(S.win&&!a.closest(".win")&&S.zoom===null&&!S.panel)return;
    if(S.zoom!==null&&!a.closest(".zoom"))return;
    if(!["snd","audio-channel","audio-test"].includes(act)){SOUND.unlock();SOUND.sfx("select");}
    if (act!=="totitle") S.confirmTitle=false;
    switch(act){
      case "town-hall": if(SCENARIO.content.TOWN_HALL){townHallEnlarged=false;openConsolePanel("town-hall");}break;
      case "town-hall-zoom": townHallEnlarged=!townHallEnlarged;render();requestAnimationFrame(()=>document.querySelector('[data-act="town-hall-zoom"]')?.focus({preventScroll:true}));break;
      case "clock-timeline": openClockTimeline();break;
      case "clock-return": returnClockTimeline();break;
      case "chapter-begin": beginFamilyChapter();break;
      case "title-cinema": TITLE_CINEMA.toggle();break;
      case "family-auto": case "reader-auto": GAME_READER.toggleAuto();break;
      case "family-entry": openFamilyEntry();break;
      case "family-term": openFamilyTerm(a.dataset.v);break;
      case "family-license": if(S.panel==='chapter-menu'){CONSOLE_PANEL_TRAIL.push(S.panel);S.panel=null;}openFamilyLicense();break;
      case "family-counter": startDaughterCounter();break;
      case "family-license-zoom": toggleFamilyLicenseZoom();break;
      case "family-text-speed": case "reader-speed": GAME_READER.setSpeed(a.dataset.v);break;
      case "motion": PORTRAIT_MOTION.set(a.dataset.v);break;
      case "pc": pcAction(a.dataset.pc,a.dataset.v);break;
      case "readback-current": returnToConversation();break;
      case "readback-up": scrollConversationBack();break;
      case "mystery-act": mysteryAct(a.dataset.v);break;
      case "mystery-notes": if(S.chapter)openConsolePanel("chapter-notes");break;
      case "mystery-clue": mysterySelect(a.dataset.v);break;
      case "family-question": familySelectQuestion(a.dataset.v);break;
      case "family-branch": familyChooseBranch(a.dataset.v);break;
      case "family-bad-next": familyBadAdvance();break;
      case "family-bad-retry": familyBadRetry();break;
      case "family-bad-readback": familyBadReadback();break;
      case "family-resume": resumeFamilyProgress();break;
      case "family-next": familyNext();break;
      case "family-source": familyClueSource(a.dataset.v);break;
      case "mystery-theory": mysteryTheory(a.dataset.v);break;
      case "mystery-hint": mysteryHint();break;
      case "mystery-solve": mysterySolve();break;
      case "pacing-continue": pacingBridgeContinue();break;
      case "chapter-menu": openConsolePanel("chapter-menu");break;
      case "chapter-map": openChapterTimeline();break;
      case "chapter-person": if(S.chapter&&CHAPTER_PEOPLE.some(p=>p.id===a.dataset.v)){S.chapter.person=a.dataset.v;render();chapterFocus('.multi-cast button[aria-pressed="true"]');}break;
      case "chapter-node": openChapterNode(a.dataset.v);break;
      case "chapter-next": chapterAdvance();break;
      case "chapter-prev": chapterPrevious();break;
      case "chapter-choice": chapterChoose(a.dataset.v);break;
      case "chapter-end": chapterEnd();break;
      case "ending-pause": FAMILY_ENDING.toggle();break;
      case "ending-next": FAMILY_ENDING.next();break;
      case "ending-skip": FAMILY_ENDING.skip();break;
      case "ending-replay": FAMILY_ENDING.replay();break;
      case "moment-replay": STORY_MOMENTS.replay();break;
      case "theme": if(a.dataset.v==="auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme=a.dataset.v; render(); break;
      case "cat": S.cat=a.dataset.v; render(); break;
      case "count": S.count=a.dataset.v; render(); break;
      case "chapter-start": prepareMode("story");break;
      case "start": prepareMode();break;
      case "replay": prepareMode(S.mode);break;
      case "begin-training": beginMode();break;
      case "home": { const k={cat:S.cat,count:S.count,ticket:S.ticket+1,sound:S.sound}; GAME_READER.reset(); S=Object.assign(fresh(),k); render(); break; }
      case "totitle": if (S.confirmTitle){ const k={cat:S.cat,count:S.count,ticket:S.ticket+1,sound:S.sound}; GAME_READER.reset(); S=Object.assign(fresh(),k); } else S.confirmTitle=true; render(); break;
      case "ans": answer(+a.dataset.i); break;
      case "pick": pick(+a.dataset.i); break;
      case "reset": S.pick=[]; render(); break;
      case "commit": commitOrder(); break;
      case "hint": useHint(); break;
      case "skip": S.panel=null; skip(); break;
      case "snd": SOUND.toggle(); break;
      case "tip": openTip(a.dataset.v);break;
      case "tips": openTips();break;
      case "tip-close": case "tip-backdrop": if(isTipPanel())closeTipPanel();break;
      case "person": S.win=null;S.panel="person";render();break;
      case "materials-toggle": toggleMaterialShelf();break;
      case "material-select": activateMaterial(a.dataset.key);break;
      case "flow-close": case "flow-backdrop": closeFlow();break;
      case "material-move": moveMaterial(+a.dataset.d);break;
      case "material-open": openMaterial(a.dataset.key);break;
      case "advance": advance(); break;
      case "desk": openMaterialLibrary(a.dataset.group);break;
      case "material-view-move": moveOpenMaterial(+a.dataset.d);break;
      case "request": openConsolePanel("request");break;
      case "settings": openConsolePanel("settings");break;
      case "screen-toggle": SCREEN_MODE.toggle();break;
      case "settings-tab": selectSettingsTab(a.dataset.v);break;
      case "menu": openConsolePanel("menu");break;
      case "audio-channel": SOUND.channel(a.dataset.v);break;
      case "audio-test": SOUND.preview(a.dataset.v);break;
      case "sound": openConsolePanel("sound");break;
      case "log": openConsolePanel("log"); break;
      case "ref": openFlow(); break;
      case "flow-ref": e.preventDefault();openFlowReference(a.dataset.v,a.dataset.flowCat,a);break;
      case "flow-tab": chooseFlow(a.dataset.v);break;
      case "flow-node": chooseFlowNode(a.dataset.v);break;
      case "flow-zoom": zoomFlow(a.dataset.v);break;
      case "flow-current": openFlow();break;
      case "flow-detail-close": S.flowNode=null;renderFlow();break;
      case "about": openConsolePanel("about"); break;
      case "close": closeConsolePanel();break;
      case "tab": S.panel=null;SOUND.sfx("paper"); S.win = (S.win===a.dataset.v && a.closest(".ctrl")) ? null : a.dataset.v; if(S.win){S.materialKey=S.win;rememberMaterial(S.win);} render(); break;
      case "winx": closeMaterial(); break;
      case "doc": S.panel=null;SOUND.sfx("paper"); S.zoom=+a.dataset.i; S.materialKey="doc:"+S.zoom; render(); break;
      case "zgo": movePresentedMaterial(+a.dataset.d);break;
      case "zclose": closeMaterial(); break;
    }
    return;
  }
  handleReadingSurfaceClick(e);
});
document.addEventListener("keydown", e=>{
  if (e.metaKey||e.ctrlKey||e.altKey) return;
  if(handleMaterialViewerKey(e))return;
  if(handlePcKey(e))return;
  if(document.activeElement?.matches?.("input,select,textarea"))return;
  if(document.activeElement?.closest?.('[contenteditable]:not([contenteditable="false"])'))return;
  if((e.key==="Enter"||e.key===" ")&&document.activeElement?.closest?.(READING_CONTROLS))return;
  SOUND.unlock();
  if(handleFamilyPanelKey(e))return;
  if(handleConsolePanelKey(e))return;
  if(e.key==="Escape"&&S.panel==="ref"){e.preventDefault();closeFlow();return;}
  if(handleReadbackKey(e))return;
  if(handleChapterKey(e))return;
  if(handleTipKey(e))return;
  if (e.key==="Escape"){ if(materialIsOpen()){e.preventDefault();closeMaterial();return;} if (S.zoom!==null){ S.zoom=null; render(); return; } if (S.panel){ S.panel=null; render(); } else if (S.win){ S.win=null; render(); } else if(S.scr==="play"){openConsolePanel("menu");}else if(S.scr==="title"){openConsolePanel("settings");} return; }
  if (S.panel || S.win || S.zoom!==null || S.scr!=="play") return;
  if(document.activeElement?.closest?.(".material-carousel")){
    if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();SOUND.sfx("select");moveMaterial(e.key==="ArrowLeft"?-1:1);document.querySelector('.material-card[aria-current="true"]')?.focus({preventScroll:true});return;}
    if(e.key==="Enter"&&document.activeElement.id==="materialTrack"){e.preventDefault();openMaterial();return;}
  }
  const b=beat();
  if (b && b.t==="ask" && S.done){ const k="1234".indexOf(e.key); if (k>=0 && k<S.perm.length){ e.preventDefault(); answer(k); return; } }
  if ((e.key==="Enter"||e.key===" ") && !(document.activeElement && document.activeElement.closest("button"))){ e.preventDefault(); advance(); }
  if (e.key==="l"||e.key==="L"){ S.panel="log"; render(); }
});
document.addEventListener("input",e=>{
  const key=e.target.dataset?.audio;if(!key)return;
  SOUND.unlock();SOUND.set(key,e.target.value);
  const output=e.target.parentElement.querySelector('output');if(output)output.textContent=e.target.value+'%';
});
document.addEventListener("toggle",e=>{if(e.target.matches?.('.title-settings'))S.titleSettings=e.target.open;},true);
window.addEventListener("resize",()=>{updatePhotoLayout();resizeReadback();updateReadingOverflow();updateMaterials({center:true});PORTRAIT_MOTION.sync();});

/* ---------------- boot ---------------- */
function start(data){
  S = (data && data.S && data.S.scr) ? data.S : fresh();
  if (S.scr==="play" && !curCase()) S=fresh();
  S.done = true;
  if(typeof location!=='undefined'&&SCENARIO.review.deduction&&new URLSearchParams(location.search).get('resume')==='deduction'){resumeAtDeduction();return;}
  render();

}
window.claude?.hot?.snapshot?.(()=>({S}));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
