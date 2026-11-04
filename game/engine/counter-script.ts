// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Counter script assembly and execution */
// Counter dialogue assembly and clock weighting share one typed script contract.
const clockMinutes=(value: string)=>{const [h,m]=value.split(':').map(Number);return Number(h)*60+Number(m);};
const clockLabel=(value: number)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(Math.floor(value)%60).padStart(2,'0')}`;
function stampCounterTimes(beats: ReaderBeat[],from=0,to=1){
 const card=from===0&&to===1?beats.findIndex(b=>b.t==='card'):-1;
 const durations: Partial<Record<ReaderBeat['t'],number>>={say:1,ask:8,order:8,pc:5,form:1};
 const weights=beats.map((b,i)=>i<card?0:(durations[b.t]||0));
 const total=weights.reduce((sum,w)=>sum+w,0)||1;let elapsed=0;
 return beats.map((b,i)=>{const clockAt=from+(to-from)*elapsed/total;elapsed+=weights[i]??0;return {...b,clockAt,clockEnd:from+(to-from)*elapsed/total};});
}

function counterRequired<T>(value: T | undefined,label: string): T {
 if(value===undefined)throw new Error(`Missing counter script value: ${label}`);
 return value;
}
function counterPhrase(phrases: string[],index: number): string {
 const phrase=phrases[index%phrases.length];
 if(phrase===undefined)throw new Error("Counter dialogue phrases must not be empty.");
 return phrase;
}

function caseBeats(withPro: boolean): ReaderBeat[]{
  const c = counterRequired(curCase(),"active case"),story=storyFor(c); const b: ReaderBeat[] = [{t:"reset"}];
  if (withPro) b.push(...PROLOGUE.map(x=>({...x})));
  const no=pad3(S.ticket);
  b.push({t:"card"},
    {t:"say",w:"n",scene:"scene-lobby",x:`♪ ピンポーン ―「受付番号${no}番でお待ちの方、3番窓口へお越しください」`},
    {t:"enter"},
    {t:"say",w:"n",x:story.arrival,scene:c.id==="c11"?"scene-timetable":null},
    {t:"say",w:"m",x:counterPhrase(GREET,S.ci)},
    {t:"say",w:"v",x:story.opening||c.say,visitRequest:VISIT_REQUESTS[c.id]},...storyBridge(c),
    {t:"say",w:"m",x:counterPhrase(IDREQ,S.ci)},
    {t:"docs"},
    {t:"say",w:"n",x:"提示された書類：" + c.visitor.docs.join("、")});
  if (c.term.length) b.push({t:"term",rows:c.term});
  c.steps.forEach((st,si)=>{
    if(si===1)b.push({t:"say",w:"n",x:story.pause,scene:c.id==="c1"?"scene-first-step":c.id==="c3"?"scene-file-wait":null},...fieldSceneBeats(c,"mid"));
    const fix=FORMS[c.id]?.fix;
    if (st.say) b.push({t:"say",w:"v",x:st.say,...(fix?.at===si?{visitRequest:{...counterRequired(VISIT_REQUESTS[c.id],c.id+" visit request"),quantity:fix.to,changed:true}}:{})});
    if (st.term) b.push({t:"term",rows:st.term});
    b.push(...suspenseBeats(c,si));
    b.push({t: st.type==="order" ? "order" : "ask", si});
  });
  const f=FORMS[c.id];
  const ho = HANDOUT[c.id];
  let close = (ho && ho.close) || CLOSE_ID[c.id] || CLOSE[c.end.tag];
  if (c.end.tag==="ok" && f){ const n=f.fix?f.fix.to:f.certs[0].n; const yen=f.certs.reduce((a,x)=>a+x.p*n,0); close=`お待たせいたしました。こちらが証明書です。内容をご確認ください。手数料は${yen.toLocaleString()}円です。`; }
  if (ho) b.push({t:"handout"});
  b.push({t:"say",w:"m",x:counterRequired(close,c.id+" closing"),scene:c.id==="c11"?"scene-certificate-handoff":null});
  if (ho) b.push({t:"say",w:"n",x:ho.narr});
  b.push(...fieldSceneBeats(c,"closing"));
  b.push({t:"mood",x:counterRequired(BYE_MOOD[c.end.tag],c.end.tag+" mood")},{t:"say",w:"v",x:counterRequired(story.goodbye||(ho&&ho.bye)||BYE_ID[c.id]||BYE[c.end.tag],c.id+" goodbye")},{t:"fstamp"},
         {t:"say",w:"n",x:`結末【${c.end.label}】${c.end.text}`},{t:"leave"},{t:"say",w:"n",x:story.after,scene:c.id==="c14"?"scene-bag-home":null},...fieldAfterBeats(c),{t:"next"});
  return stampCounterTimes(b);
}

function textOf(b: ReaderBeat | undefined): string{
  if (!b) return "";
  if (b.t==="pc") return "申請書を作るため、職員用PCを操作します。";
  if (b.t==="say") return b.x;
  if (b.t==="ask"||b.t==="order") return counterRequired(counterRequired(curCase(),"active case").steps[b.si],"question "+b.si).q;
  return "";
}
function nameOf(b: ReaderBeat): string{
  if (b.t==="say") return b.w==="v" ? counterRequired(curCase(),"active case").visitor.name : b.w==="s" ? SENPAI_NAME : b.w==="f" ? "業務フロー" : b.w==="m" ? "あなた" : "";
  if (b.t==="ask"||b.t==="order") return "判断";
  return "";
}

function formBeats(si: number): ReaderBeat[]{
  const c=counterRequired(curCase(),"active case"), f=FORMS[c.id]; if (!f) return [];
  const out: ReaderBeat[]=[];
  if (f.fill===si) out.push({t:"pc"},{t:"say",w:"n",scene:"scene-paperwork",x: c.id==="c4" ? "申請者欄を印刷した。対象者欄の記入と署名を、松本さんにお願いした。" : "申請書を印刷し、来庁者の前へ向けた。内容の確認と署名をお願いする。"});
  if (f.sign===si) out.push({t:"form",v:2},{t:"say",w:"n",scene:"scene-paperwork",x:`${f.app.name.split(" ")[0]}さんが自署欄に署名した。`});
  if (f.fix && f.fix.at===si) out.push({t:"form",v:2,fix:true},{t:"say",w:"n",scene:"scene-paperwork",x:`申請書の通数を紙で訂正した（${f.certs[0].n}通→${f.fix.to}通）。`});
  if(f.sign===si)out.push(...fieldSceneBeats(c,"sign"));
  return out;
}


// Execute the same beat protocol in normal and story counter exercises.
function baseMood(){ return S.cw>=6 ? "annoyed" : S.cw>=3 ? "neutral" : "calm"; }

function runCore(){
  for (let g=0; g<300; g++){
    const b = beat(); if (!b) return;
    switch (b.t){
      case "reset": { const reset={pc:null,materialKey:"term",materialSelections:{},materialReturn:null,zoom:null,handout:false,visible:false,term:[],win:null,docs:false,cw:0,cm:0,res:[],fstage:0,ffix:false,vmood:"calm",hint:false,ans:null} satisfies Partial<ReaderHostState>; Object.assign(S,reset); S.bi++; continue; }
      case "enter": S.visible=true; FX.enter=true; S.bi++; continue;
      case "docs": S.materialKey="doc:0"; S.docs=true; FX.docs=true; S.bi++; continue;
      case "term": S.materialKey="term"; S.term=b.rows; if (S.win) { S.win="term"; FX.win=true; } S.bi++; continue;
      case "mood": S.vmood=b.x; S.bi++; continue;
      case "pc": if(!b.init){b.init=true;S.pc=null;pcState();S.materialKey="term";S.win="term";requestAnimationFrame(()=>document.getElementById("pcHeading")?.focus({preventScroll:true}));} return;
      case "form": S.materialKey="form"; if (b.v) S.fstage=Math.max(S.fstage,b.v); if (b.fix) S.ffix=true; FX.win=true; S.bi++; continue;
      case "fstamp": { const c=counterRequired(curCase(),"active case"); if (FORMS[c.id] && S.fstage>=1 && (c.end.tag==="ok"||c.end.tag==="plan")){ S.fstage=3; S.materialKey="form"; FX.win=true; FX.hanko=true; } S.bi++; continue; }
      case "handout": S.materialKey="hand"; S.handout=true; FX.win=true; S.bi++; continue;
      case "leave": S.visible=false; S.docs=false; S.zoom=null; S.win=null; S.bi++; continue;
      case "next": endCase(); if (S.scr!=="play") return; continue;
      case "ask": case "order":
        if (!b.init){ FX.cut=true; b.init=true; S.si=b.si; S.ans=null; S.hint=false; S.pick=[]; S.vmood=baseMood();
          const st=counterRequired(counterRequired(curCase(),"active case").steps[b.si],"question "+b.si);
          if (b.t==="order"){
            if(st.type!=="order")throw new Error("Order beat requires an order question.");
            let p: number[]; do{ p=shuffle(st.items.map((_,i)=>i)); }while(p.every((v,i)=>v===i)); S.perm=p; }
          else {
            if(st.type==="order")throw new Error("Choice beat requires a choice question.");
            S.perm=shuffle(st.choices.map((_,i)=>i));
          }
          if (innerWidth<900) S.win=null;
        }
        return;
      case "say": rememberStoryReveal(b); return;
      default: return; // card
    }
  }
}
function run(){ runCore(); S.done=false; logBeat(); render(); }

/* Saved score validation */
// Local storage is editable. Copy only score fields, never arbitrary state keys.
function familySavedScores(raw: unknown): SavedScores | null{
 const record=(v: unknown): v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const count=(v: unknown): v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
 if(raw===undefined)return {};
 if(!record(raw))return null;
 const result: SavedScores={};
 for(const key of ['score','max','total','correct','wait','inc','hints'] as const)if(Object.hasOwn(raw,key)){
  if(!count(raw[key]))return null;result[key]=raw[key];
 }
 if(Object.hasOwn(raw,'cs')){
  if(!record(raw.cs))return null;result.cs={};
  for(const [key,v] of Object.entries(raw.cs)){
   if(!Object.hasOwn(CAT_LABEL,key)||!record(v)||!count(v.ok)||!count(v.n)||v.ok>v.n)return null;
   result.cs[key]={ok:v.ok,n:v.n};
  }
 }
 if(Object.hasOwn(raw,'misses')){
  if(!Array.isArray(raw.misses))return null;result.misses=[];
  for(const miss of raw.misses){
   if(!record(miss))return null;
   const entry: SavedMiss={};
   for(const key of ['title','cat','ref','q','mine','right','rule'] as const)if(Object.hasOwn(miss,key)){
    if(typeof miss[key]!=='string')return null;entry[key]=miss[key];
   }
   if(Object.hasOwn(miss,'inc')){if(typeof miss.inc!=='boolean')return null;entry.inc=miss.inc;}
   result.misses.push(entry);
  }
 }
 return result;
}
