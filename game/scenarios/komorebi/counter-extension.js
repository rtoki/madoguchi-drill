// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* The afternoon scene uses the ordinary response, item and form engines.
   Only its fictional case data and the outcome of handing over a certificate differ. */
const DAUGHTER_CASE={
 id:'family_daughter',cat:'住民票',title:'夕方の住民票請求',
 visitor:{name:'真鍋 結衣',age:28,role:'娘と名乗る女性',docs:['運転免許証']},
 steps:[{q:'申請書を作成した。提示された書類と照らして、どう応対する？',ref:'',
  choices:[{id:'hold',t:'交付を保留し、係長に確認を頼む',ok:true},
   {id:'issue',t:'このまま住民票を発行し、女性に渡す'}]}],
 end:{tag:'hold'},term:[]
};
FORMS.family_daughter={
 app:{name:'真鍋 結衣',kana:'マナベ ユイ',birth:'平成10年8月12日',addr:'こもれび町若葉3丁目8番地'},
 tgt:{name:'真鍋 恵子',kana:'マナベ ケイコ',birth:'',addr:'same',head:'真鍋 恵子'},
 rel:'母（申告）',honseki:{mode:'hide'},purpose:'その他（母から依頼）',
 identityPending:true,note:'申告と提示書類に基づく申請内容。本人確認・請求資格の確認は未了。',
 certs:[{g:'住民票',k:'世帯全部（謄本）',n:1,p:200}],items:{honseki:0,head:1,mynum:0,code:0}
};
DAUGHTER_COUNTER_FIELDS=['bi','pc','log','logged','fstage','materialKey','materialSelections','materialsExpanded','docs','visible','term','perm','done','vmood'];
function isDaughterCounter(){return S.scr==='play'&&S.mode==='story'&&S.chapter?.caseActive&&S.chapter.node==='daughter';}
function daughterCounterBeats(){
 const scene='scene-family-daughter';
 return stampCounterTimes([
  {t:'reset'},{t:'enter'},{t:'docs'},
  {t:'say',w:'v',scene:'scene-family-daughter-document',visitRequest:{document:'母の住民票（同じ世帯全員）',quantity:1,purpose:'母から頼まれたと説明',detail:'世帯主と続柄を記載。本籍・個人番号・住民票コードは不要'},x:'母と同じ世帯の分を、一通。世帯主と続柄もお願いします。本籍やマイナンバーは不要です。'},
  {t:'say',w:'n',scene:'scene-family-daughter-document',x:'申請の用件と、提示された書類を確かめる。手元には免許証が置かれている。本人確認欄は、確認が済むまで空欄にしておく。'},
  {t:'pc',scene},
  {t:'say',w:'n',scene:'scene-paperwork',x:'女性から聞いた内容と、提示された書類の記載を申請書に印刷した。申請内容に間違いがないか確かめてもらい、署名をお願いする。'},
  {t:'form',v:2},
  {t:'say',w:'n',scene,x:'女性が自署欄に名前を書いた。申請書と免許証を、手元へ戻す。住民票はまだ発行していない。申請書ができたところで、交付の判断に進む。'},
  {t:'ask',si:0,scene}
 ]);
}
function startDaughterCounter(){
 const c=S.chapter;
 if(S.scr!=='multi'||S.panel||c?.view!=='read'||c.node!=='daughter'||chapterDone('daughter')||c.choices.issuance||familyCurrentDecision()?.key!=='issuance')return;
 if(!GAME_READER.decisionReady('story'))return;
 GAME_READER.reset();
 c.caseActive=true;
 Object.assign(S,{scr:'play',beats:daughterCounterBeats(),bi:0,log:[],logged:'',pc:null,win:null,panel:null,zoom:null,done:false});
 const snapshot=c.counter;
 if(snapshot&&Number.isInteger(snapshot.bi)&&snapshot.bi>=3&&snapshot.bi<S.beats.length){
  for(const key of DAUGHTER_COUNTER_FIELDS)if(Object.hasOwn(snapshot,key))S[key]=JSON.parse(JSON.stringify(snapshot[key]));
  if(['pc','ask'].includes(beat()?.t))beat().init=true;
  render();
 }else run();
}
function rememberDaughterCounter(){
 const c=S.chapter;c.readHistory||=[];
 for(const [i,v] of S.log.entries()){
  const key='daughter:log:'+i;
  if(!c.readHistory.some(e=>e.key===key))c.readHistory.push({...v,key,context:(v.time||chapterNode('daughter').time)+' · 夕方の応対'});
 }
}
function finishDaughterCounter(value){
 if(!isDaughterCounter()||S.panel||S.win||S.zoom!==null||beat()?.t!=='ask'||!S.done||!['hold','issue'].includes(value))return;
 const c=S.chapter;
 S.log.push({n:'あなた',x:DAUGHTER_CASE.steps[0].choices.find(o=>o.id===value).t,me:true,time:storyTime()});
 rememberDaughterCounter();c.choices.issuance=value;c.caseActive=false;delete c.counter;
 GAME_READER.reset();
 S.scr='multi';S.panel=null;S.win=null;S.zoom=null;S.beats=[];
 if(value==='issue'){c.badEnding='wrong_issue';c.badPage=0;c.view='bad';}
 else{c.view='read';c.page++;c.progress.daughter=c.page;}
 render();chapterFocus();
}
function daughterLicenseHTML(){
 return japaneseLicense(DAUGHTER_CASE,{story:true,person:FORMS.family_daughter.app,photo:'<span class="family-license-face" aria-hidden="true"></span>'});
}

function chapterPages(n){
 if(!n.training)return n.pages(S.chapter).filter(page=>familyPageVisible(page));
 if(S.chapter?.recoveredDeduction)return [{key:n.id+'-summary',scene:'scene-paperwork',text:'最終推理から再開したため、午前の窓口判断の得点は引き継いでいません。物語の手掛かりは「手掛かり」から読み返せます。分岐の応対は未選択として再開します。'}];
 return [{key:n.id+'-summary',scene:'scene-paperwork',time:n.endTime||n.time,text:`吉田さんの応対を終えた。\n判断 ${S.correct}/${S.total}問正解・${S.score}/${S.max}点。\n\n${S.misses.length?'迷った判断は、下の解説で振り返ろう。':'元フローを確かめながら、広域交付の手続きへ進んだ。'}`}];
}

function startChapterCase(){
 const chapter=S.chapter;if(!chapter||!chapterAvailable('r2')||chapterDone('r2'))return;
 if(chapter.caseActive){S.scr='play';S.panel=null;render();return;}
 const keep={sound:S.sound,cat:S.cat,count:S.count,ticket:S.ticket,mode:'story',chapter};
 S=Object.assign(fresh(),keep,{scr:'play',queue:[CASES.findIndex(c=>c.id==='c11')]});
 chapter.caseActive=true;chapter.view='case';chapter.node='r2';
 const original=caseBeats(false),firstQuestion=original.findIndex(b=>b.t==='ask'||b.t==='order');
 // Arrival and ID presentation are already in r0. Keep the document UI and
 // the two reviewed questions; r1 handles the receipt and move to the waiting area.
 const prelude=original.slice(original.findIndex(b=>b.t==='docs'),firstQuestion);
 const handoff=original.findIndex(b=>b.t==='say'&&b.w==='m'&&b.scene==='scene-certificate-handoff');
 S.beats=[{t:'reset'},{t:'enter'},
  {t:'say',w:'n',visitRequest:VISIT_REQUESTS.c11,x:'吉田さん自身の証明書の用件を受け付ける。提示された本人確認書類と、請求内容を確かめよう。'},
  ...prelude,...original.slice(firstQuestion,handoff+1),{t:'fstamp'},{t:'next'}];
 S.beats=stampCounterTimes(S.beats);S.bi=0;run();
}

function finishChapterCase(){
 rememberChapterCaseReading();
 const c=S.chapter;c.caseActive=false;if(!chapterDone('r2'))c.done.push('r2');
 c.node='r2';c.person='rookie';c.view='bridge';S.scr='multi';S.panel=null;S.win=null;S.zoom=null;
 GAME_READER.reset();
 if(!pacingContinue(chapterNode('r2')))chapterFocus();
}

// Training summaries are generated from scores, but have a stable reader identity.
function scenarioPagesForSave(id,c){
 const n=chapterNode(id);return n?.training?[{key:id+'-summary'}]:(n?.pages(c)||[]);
}
