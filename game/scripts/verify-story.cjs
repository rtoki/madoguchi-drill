// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const {runSuites}=require('./test-tools.cjs');

runSuites({
 'chapter-transitions': function(require,module,__filename,__dirname){
  const {boot,completePc,assert}=require('./test-harness.cjs');
  const g=boot({chapterCards:true}),cards=[];
  g.run('startChapter();openChapterNode("r0");');
  assert.equal(g.run('S.chapter.view'),'chapter');
  assert.ok(g.stage.innerHTML.includes('第1章を始める'));
  g.run('render();S.scr="title";render();resumeFamilyProgress();');assert.equal(g.run('S.chapter.view'),'chapter','save/resume keeps the chapter entrance');
  let guard=0;
  while(g.run('S.chapter.view')!=='end'){
   assert.ok(++guard<900,'all chapters must finish');
   const view=g.run('S.chapter.view');
   if(g.run('S.scr')==='play'){
    const kind=g.run('beat().t');
    if(kind==='ask')g.run('answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
    else if(kind==='pc')completePc(g);
    else g.run('advance();');
   }else if(view==='chapter'||view==='bridge'){
    const block=g.run(view==='chapter'?'pacingBlock(S.chapter.introNode).id':'pacingBlock(pacingFrontier().id).id');cards.push(block);
    assert.ok(g.stage.innerHTML.includes('chapter-transition-wipe'));
    g.run(view==='chapter'?'beginFamilyChapter();':'pacingBridgeContinue();');
   }else if(view==='timeline'){
    g.run('openChapterNode(pacingFrontier().id);');
   }else if(g.run('S.chapter.node')==='deduction'&&!g.run('S.chapter.solutions.deduction')){
    for(const id of ['source','purpose','concealment'])g.run(`familySelectQuestion('${id}');mysteryTheory(MYSTERY_PUZZLES.${id}.answer);for(const cid of MYSTERY_PUZZLES.${id}.correct)mysterySelect(cid);`);
    g.run('mysterySolve();chapterAdvance();');
   }else g.run('{const d=familyCurrentDecision();if(d&&!S.chapter.choices[d.key])familyChooseBranch(d.options[0].id);chapterAdvance();}');
  }
  assert.deepEqual(cards,["ch1","ch2","ch3"]);assert.equal(g.run('S.chapter.done.length'),g.run('CHAPTER_NODES.length'));
  assert.equal(g.run('S.score'),200);
  console.log('PASS exactly three animated chapter entrances, exact chapter numbers, saved entrance, phone review, three deductions, normal-case training and ending.');
 },

 'deduction-navigation': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();g.run('resumeAtDeduction();');
  assert.equal(g.run('S.chapter.node'),'deduction');assert.equal(g.run('mysteryClues().length'),17);assert.equal(g.run('S.score'),0,'recovery must not invent training answers or scores');
  assert.match(g.run('chapterPages(chapterNode("r2"))[0].text'),/得点は引き継いでいません/);
  const next=()=>g.fire('click',{target:{closest:q=>q==='[data-act]'?{dataset:{act:'family-next'},closest:()=>null}:null}});
  next();assert.equal(g.run('familyQuestion()'),'source');assert.match(g.run('S.chapter.feedback'),/推理を一つ/);assert.equal(g.run('S.chapter.feedbackTarget'),'theory');
  g.run('mysteryTheory("kurose");');next();assert.match(g.run('S.chapter.feedback'),/あと2つ/);assert.equal(g.run('S.chapter.feedbackTarget'),'evidence');
  g.run('mysterySelect("husband_quote");');next();assert.match(g.run('S.chapter.feedback'),/あと1つ/);assert.equal(g.run('familyQuestion()'),'source');
  g.run('mysterySelect("police_identity");');next();assert.equal(g.run('familyQuestion()'),'purpose');
  g.run('mysteryTheory("deceived");mysterySelect("woman_account");mysterySelect("instructions");');
  let prevented=false;g.fire('keydown',{key:'Enter',preventDefault(){prevented=true;},target:{closest:()=>null}});assert.ok(prevented);assert.equal(g.run('familyQuestion()'),'concealment','Enter follows the visible next action');
  g.run('mysteryTheory("shared_contact");mysterySelect("contact_card");');next();assert.match(g.run('S.chapter.feedback'),/あと1つ/);
  g.run('mysterySelect("woman_contact");');
  for(const q of ['source','purpose','concealment']){
   g.run(`familySelectQuestion('${q}');`);
   assert.match(g.stage.innerHTML,/data-act="mystery-solve">答え合わせ/,'all completed questions allow checking from any tab');
   assert.ok(g.stage.innerHTML.includes('3 / 3 問の選択完了'));
  }
  g.fire('keydown',{key:'Enter',preventDefault(){},target:{closest:()=>null}});
  assert.ok(g.run('S.chapter.solutions.deduction'));assert.ok(g.stage.innerHTML.includes('警察へ説明する'));
  g.fire('click',{target:{closest:q=>q==='[data-act]'?{dataset:{act:'chapter-next'},closest:()=>null}:null}});
  assert.equal(g.run('S.chapter.view'),'read');assert.equal(g.run('S.chapter.node'),'report','the final deduction continues within chapter three without another chapter card');
  let count=0;while(g.run('S.chapter.view')!=='end'){assert.ok(++count<140);g.run('S.chapter.view==="bridge"?pacingBridgeContinue():chapterAdvance();');}
  assert.ok(g.stage.innerHTML.includes('ending-fin')&&g.stage.innerHTML.includes('FIN'));
  // Clicking an explicit deduction control must work even if scrolling it into
  // view puts the question tabs just above the conversation's readback boundary.
  const scrolled=boot();scrolled.run('resumeAtDeduction();isReadingBack=()=>true;');
  for(const q of ['source','purpose','concealment']){
   scrolled.run(`familySelectQuestion('${q}');`);
   assert.equal(scrolled.run('familyQuestion()'),q,'a visible question tab is an explicit selection');
   scrolled.run(`mysteryTheory(MYSTERY_PUZZLES.${q}.answer);for(const id of MYSTERY_PUZZLES.${q}.correct)mysterySelect(id);`);
   assert.ok(scrolled.run(`familyComplete('${q}')`));
  }
  scrolled.run('mysterySolve();');assert.ok(scrolled.run('S.chapter.solutions.deduction'));
  const legacy=boot();legacy.run('resumeAtDeduction();S.chapter.recoveredDeduction=false;S.chapter.investigations.concealment={theory:"shared_contact",selected:["contact_card","woman_contact","woman_questions"],hint:true};saveFamilyProgress();S.scr="title";resumeFamilyProgress();familySelectQuestion("concealment");');
  assert.deepEqual(Array.from(legacy.run('mysteryDraft("concealment").selected')),['contact_card','woman_contact'],'old three-clue draft retains the two relevant selections');
  assert.equal(legacy.run('mysteryDraft("concealment").theory'),'shared_contact');
  assert.ok(legacy.run('familyComplete("concealment")'),'an old draft never requires a negative number of clues');
  for(const q of ['source','purpose'])legacy.run(`familySelectQuestion('${q}');mysteryTheory(MYSTERY_PUZZLES.${q}.answer);for(const id of MYSTERY_PUZZLES.${q}.correct)mysterySelect(id);`);
  legacy.run('mysterySolve();');assert.ok(legacy.run('S.chapter.solutions.deduction'));
  const evidence=boot();evidence.run('resumeAtDeduction();familyClueSource("police_identity");');
  assert.equal(evidence.run('chapterPages(chapterNode("phone"))[S.chapter.page].key'),'phone-008');
  assert.equal(evidence.run('chapterPages(chapterNode("phone"))[S.chapter.page].text'),'「いいえ。別の方です」','readback lands on the confirming words, not the reaction after them');
  console.log('PASS two-clue questions, incomplete theory/evidence guidance, old three-clue save, all-tab answer check, Enter navigation, recovery without invented score, police scene and ending.');
 },

 'envelope-ending': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const story=JSON.parse(fs.readFileSync(path.join(__dirname,'../story-family.json'),'utf8'));
  function arrive(g){
   g.run('startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf("memo"));openChapterNode("memo");S.chapter.page=chapterPages(chapterNode("memo")).findIndex(p=>p.decision==="envelope");render();');
  }
  const g=boot();arrive(g);
  const point=g.run('S.chapter.page'),clues=g.run('JSON.stringify(S.chapter.clues)'),score=g.run('S.score');
  g.run('chapterAdvance();');assert.equal(g.run('S.chapter.page'),point,'must choose whether to open the sealed envelope');
  g.run('familyChooseBranch("open");');assert.equal(g.run('S.chapter.view'),'bad');
  assert.equal(g.run('S.chapter.badEnding'),'envelope_open');
  assert.ok(g.stage.innerHTML.includes('何をしているの'));
  g.run('familyBadAdvance();');assert.ok(g.stage.innerHTML.includes('預かったのは、渡すためです。読むためではありません'));
  g.run('render();S.scr="title";render();resumeFamilyProgress();');
  assert.equal(g.run('S.chapter.view'),'bad');assert.equal(g.run('S.chapter.badPage'),1,'resume the early ending at the saved page');
  g.run('openChapterTimeline();openChapterNode("memo");chapterAdvance();familyBadRetry();');
  assert.equal(g.run('S.chapter.view'),'bad','cannot bypass the ending using timeline or premature retry');
  g.run('familyBadAdvance();familyBadAdvance();familyBadAdvance();');
  assert.ok(!g.stage.innerHTML.includes('BAD END'),'the final line is read before the end card');
  assert.ok(g.stage.innerHTML.includes('十時四十分の約束は、取り消された'));
  g.run('familyBadAdvance();');
  assert.ok(g.stage.innerHTML.includes('BAD END')&&g.stage.innerHTML.includes('family-bad-card'));
  assert.ok(g.stage.innerHTML.includes('封筒の選択からやり直す'));
  assert.equal(g.run('chapterAvailable("stairs")'),false);
  assert.equal(g.run('JSON.stringify(S.chapter.clues)'),clues,'opening the envelope must not reveal later evidence');
  assert.equal(g.run('S.score'),score);
  g.run('familyBadRetry();');assert.equal(g.run('S.chapter.view'),'read');assert.equal(g.run('S.chapter.page'),point);
  assert.equal(g.run('S.chapter.choices.envelope'),undefined);
  g.run('familyChooseBranch("sealed");chapterAdvance();');
  assert.equal(g.run('S.chapter.view'),'read');assert.equal(g.run('S.chapter.page'),point+1);
  assert.equal(g.run('S.chapter.choices.envelope'),'sealed');assert.equal(g.run('S.chapter.badEnding'),undefined);
  g.run('render();S.scr="title";render();resumeFamilyProgress();');assert.equal(g.run('S.chapter.page'),point+1);
  // The older save format has no envelope choice. It remains readable at an already passed page.
  g.run('delete S.chapter.choices.envelope;S.chapter.page=8;render();S.scr="title";resumeFamilyProgress();');
  assert.equal(g.run('S.chapter.page'),8);
  const h=boot();arrive(h);h.run('familyChooseBranch("sealed");familyChooseBranch("open");');
  assert.equal(h.run('S.chapter.view'),'read','a committed choice cannot be changed while rereading');
  // A production save from the former four-choice story has filtered page offsets.
  const legacy=boot();legacy.run(`startChapter();
   S.chapter.choices={morning:'handoff',stairs:'call',woman:'ask',review:'newsletter'};
   S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('phone'));
   S.chapter.node='consultation';S.chapter.view='read';S.chapter.page=14;S.chapter.progress.consultation=14;
   S.chapter.readHistory=[{key:'consultation:14',n:'あなた',x:'旧版の地の文',context:'資料の確認'}];
   localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,chapter:S.chapter,scores:{score:100}}));`);
  legacy.run('resumeFamilyProgress();');
  assert.equal(legacy.run('S.chapter.node'),'phone');
  assert.equal(legacy.run('S.chapter.page'),0);
  assert.equal(legacy.run('S.chapter.choices.morning'),undefined);
  assert.equal(legacy.run('S.chapter.choices.review'),undefined);
  assert.equal(legacy.run('S.chapter.choices.woman'),'ask');
  assert.equal(legacy.run('S.score'),100);
  assert.ok(!legacy.run('S.chapter.readHistory.some(e=>e.x==="旧版の地の文")'));
  const bad=story.bad_endings.envelope_open.pages.map(p=>p.text).join('\n');
  assert.ok(!bad.includes('KRS-17')&&!bad.includes('管理料'));
  assert.ok(story.nodes.find(n=>n.id==='instructions').pages.some(p=>p.text.includes('警察からの折り返し')));
  assert.ok(story.nodes.find(n=>n.id==='report').pages.some(p=>p.text.includes('黒瀬さんからも連絡')));
  console.log('PASS envelope early ending, reprimand, no future clues, save/resume, retry, sealed route and legacy progress.');
  // Compression remaps a deleted page to the next retained scene, not its old offset.
  for(const [revision,archive] of [[undefined,'FAMILY_LEGACY_PAGES'],['three-choices-v1','FAMILY_EXPANDED_PAGES']]){
   const g=boot();g.run(`startChapter();S.chapter.choices={envelope:'sealed',morning:'listen',stairs:'call',woman:'ask',review:'letters'};`);
   const target=JSON.parse(g.run(`JSON.stringify((()=>{const old=${archive}.memo.filter(p=>Object.entries(p.when||{}).every(([k,v])=>S.chapter.choices[k]===v)),now=chapterPages(chapterNode('memo'));const i=old.findIndex((p,i)=>i>3&&!now.some(n=>n.key===p.key)&&old.slice(i+1).some(p=>now.some(n=>n.key===p.key)));return {index:i,next:old.slice(i+1).find(p=>now.some(n=>n.key===p.key)).key};})())`));
   assert.ok(target.index>=0);
   g.run(`S.chapter.node='memo';S.chapter.view='read';S.chapter.page=${target.index};S.chapter.progress.memo=${target.index};S.chapter.readHistory=[{key:'memo:${target.index}',x:'removed prose'}];localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:${JSON.stringify(revision)||'undefined'},chapter:S.chapter,scores:{score:75}}));resumeFamilyProgress();`);
   assert.equal(g.run('chapterPages(chapterNode("memo"))[S.chapter.page].key'),target.next);
   assert.equal(g.run('S.score'),75);assert.equal(g.run('S.chapter.readHistory.some(e=>e.x==="removed prose")'),false);
  }
  console.log('PASS removed-page migration from both expanded formats without duplicate or unread future transcript entries.');
 },

 'family-ending': function(require,module,__filename,__dirname){
  const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
  const {engineSource}=require('./test-tools.cjs');
  const source=engineSource('family-reader.js');
  function setup({reduced=false,motion='on',seen=false}={}){
   let now=0,seq=0,saved=0;const timers=new Map(),listeners={};
   const state={scr:'multi',panel:null,win:null,zoom:null,chapter:{view:'end',endingSeen:seen}};
   const pause={textContent:'',setAttribute(){}},progress={style:{}},frames={innerHTML:''};
   const controls={innerHTML:'data-act="ending-pause"',querySelector(){return this.innerHTML.includes('ending-pause')?{}:null;}};
   const root={dataset:{},querySelector(){return controls.innerHTML.includes('ending-pause')||controls.innerHTML.includes('ending-next')?pause:null;}};
   const parts={familyEnding:root,familyEndingFrames:frames,familyEndingControls:controls,familyEndingProgress:progress};
   const mq={matches:reduced,addEventListener(n,f){this.change=f;}};
   const doc={hidden:false,activeElement:null,getElementById:id=>state.scr==='multi'&&state.chapter.view==='end'?parts[id]:null,addEventListener:(n,f)=>listeners[n]=f};
   const ctx={SCENARIO:JSON.parse(fs.readFileSync(path.join(__dirname,'../scenarios/komorebi/manifest.json'),'utf8')),S:state,document:doc,window:{addEventListener:(n,f)=>listeners[n]=f},Date:{now:()=>now},matchMedia:()=>mq,PORTRAIT_MOTION:{preference:()=>motion},LOOK:{c11:{}},avatar:()=>'<span data-photo="c11"></span>',esc:x=>x,chapterFocus(){},saveFamilyProgress(){saved++;},setInterval:f=>{timers.set(++seq,f);return seq;},clearInterval:id=>timers.delete(id)};
   vm.createContext(ctx);vm.runInContext(source+';this.api=FAMILY_ENDING;',ctx);
   const api=ctx.api;api.html();api.sync();
   return {api,state,doc,mq,root,frames,controls,timers,listeners,saved:()=>saved,step(ms){for(let i=0;i<ms;i+=100){now+=100;for(const f of [...timers.values()])f();}}};
  }
  const f=setup();
  assert.ok(f.api.html().includes('FIN<span'));
  assert.ok(f.api.html().includes('scene-family-empty-consultation'),'FIN continues the actual consultation-seat scene');
  assert.equal(f.timers.size,1);
  f.step(7000);assert.ok(f.api.html().includes('FIN<span'));assert.ok(!f.api.html().includes('椅子だけが'));
  f.step(300);assert.match(f.frames.innerHTML,/MANABE/);
  f.api.toggle();f.step(10000);assert.match(f.frames.innerHTML,/MANABE/);assert.equal(f.timers.size,0);
  f.api.next();assert.match(f.frames.innerHTML,/YOSHIDA TAKUMI/,'a paused sequence can still be stepped manually');
  f.api.toggle();f.step(4700);assert.match(f.frames.innerHTML,/KUROSE/);
  f.doc.hidden=true;f.listeners.visibilitychange();f.step(6000);assert.match(f.frames.innerHTML,/KUROSE/);assert.equal(f.timers.size,0);
  f.doc.hidden=false;f.listeners.visibilitychange();f.step(4600);assert.match(f.frames.innerHTML,/THE VISITOR/);
  f.step(4700);assert.match(f.frames.innerHTML,/THANK YOU/);assert.match(f.frames.innerHTML,/娘を名乗る女性/);assert.ok(!f.frames.innerHTML.includes('真鍋 結衣'));
  for(const name of ['真鍋 恵子','黒瀬 修一','結衣'])assert.ok(f.frames.innerHTML.includes(name));
  assert.ok(!f.frames.innerHTML.includes('家族だと言ったのは誰'));
  assert.equal(f.timers.size,0,'the final card does not keep a polling timer');assert.equal(f.state.chapter.endingSeen,true);assert.equal(f.saved(),1);
  assert.ok(!f.api.html().includes('data-motion-key'),'credits never create portrait video decoders');
  f.api.replay();assert.match(f.frames.innerHTML,/FIN<span/);assert.equal(f.timers.size,1);
  f.api.skip();assert.match(f.frames.innerHTML,/THANK YOU/);assert.equal(f.timers.size,0);
  f.api.replay();f.state.scr='title';f.api.beforeRender();f.api.sync();f.step(50000);assert.equal(f.timers.size,0,'leaving the ending releases the timer');
  for(const config of [{reduced:true},{motion:'off'}]){
   const g=setup(config);assert.equal(g.timers.size,1);assert.equal(g.root.dataset.motion,'false');
   assert.ok(!g.api.html().includes('次のカット'));g.step(30000);assert.match(g.frames.innerHTML,/THANK YOU/,'still pictures advance automatically too');assert.equal(g.timers.size,0);
  }
  const seen=setup({seen:true});assert.match(seen.api.html(),/THANK YOU/);assert.equal(seen.timers.size,0,'resuming a viewed ending lands on the final card');
  seen.api.replay();seen.mq.matches=true;seen.mq.change();assert.equal(seen.timers.size,1,'changing reduced-motion preference does not stop automatic progression');
  const keys=setup();let prevented=0;
  keys.api.key({key:'Enter',preventDefault(){prevented++;}});assert.match(keys.frames.innerHTML,/MANABE/);
  keys.api.key({key:'Escape',preventDefault(){prevented++;}});assert.match(keys.frames.innerHTML,/THANK YOU/);assert.equal(prevented,2);
  console.log('PASS normal FIN/cast/thanks progression, pause/manual advance, hidden-tab suspension, skip/replay, reduced motion, completed-save resume, keyboard controls and timer/video release.');
 },

 'family-story': function(require,module,__filename,__dirname){
  const {boot,completePc,assert,html}=require('./test-harness.cjs');
  const fs=require('node:fs');
  const path=require('node:path');

  function trainingStep(g,mode='correct'){
   const type=g.run('beat().t');
   if(type==='ask'){
    if(g.run('isDaughterCounter()')){g.run('answer(S.perm.findIndex(i=>curCase().steps[0].choices[i].ok));');return;}
    if(mode==='hint')g.run('useHint();');
    g.run(mode==='wrong'?'answer(S.perm.findIndex(i=>!curCase().steps[beat().si].choices[i].ok));':'answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
   }else if(type==='order'){
    if(mode==='hint')g.run('useHint();');
    g.run('S.pick=curCase().steps[beat().si].items.map((_,i)=>i);'+(mode==='wrong'?'S.pick.reverse();':'')+'commitOrder();');
   }else if(type==='pc')completePc(g);else g.run('advance();');
  }
  function advanceStory(g){g.run('{const d=familyCurrentDecision();if(d&&!S.chapter.choices[d.key]&&!chapterDone(S.chapter.node))familyChooseBranch(d.options[0].id);chapterAdvance();}');}
  function playToPhone(g,mode='correct'){
   g.run('S.sound=false;startChapter();openChapterNode(PACING_ORDER[0]);');
   let count=0;
   while(!(g.run('S.scr')==='multi'&&g.run('S.chapter.node')==='phone'&&g.run('S.chapter.page')===g.run('chapterPages(chapterNode("phone")).length-1'))){
    assert.ok(++count<1500,'story must reach the phone');
    assert.equal(g.run('chapterAvailable("deduction")'),false,'deduction stays locked before the call ends');
    assert.equal(g.run('chapterAvailable("report")'),false);
    if(g.run('S.scr')==='play')trainingStep(g,mode);
    else if(g.run('S.chapter.view')==='bridge')g.run('pacingBridgeContinue();');
    else advanceStory(g);
   }
   assert.ok(g.stage.innerHTML.includes('どなたから、ご主人だと聞いたんですか'));
   assert.ok(g.stage.innerHTML.includes('朝の会話を振り返る'));
   assert.equal(g.run('chapterDone("phone")'),false);
   assert.equal(g.run('mysteryClues().length'),18);
   g.run('render();render();');
   assert.equal(g.run('S.chapter.node'),'phone','rendering never advances the pause');
   g.run('chapterAdvance();');
   assert.equal(g.run('S.chapter.view'),'timeline');
   assert.equal(g.run('S.chapter.act'),1,'the call returns to the morning');
   assert.equal(g.run('chapterAvailable("deduction")'),true);
   g.run('openChapterNode("deduction");');
  }
  function selectCorrect(g){
   for(const id of ['source','purpose','concealment']){
    g.run(`familySelectQuestion('${id}');`);
    for(const clue of JSON.parse(g.run(`JSON.stringify(MYSTERY_PUZZLES.${id}.correct)`)))g.run(`mysterySelect('${clue}');`);
    g.run(`mysteryTheory(MYSTERY_PUZZLES.${id}.answer);`);
   }
  }
  function finish(g){
   let guard=0;
   while(g.run('S.chapter.view')!=='end'){
    assert.ok(++guard<100,'ending is reachable');
    if(g.run('S.chapter.view')==='bridge')g.run('pacingBridgeContinue();');else advanceStory(g);
   }
   assert.ok(g.stage.innerHTML.includes('FIN<span'));
   assert.ok(g.stage.innerHTML.includes('自動で進みます'));
   assert.ok(g.run('S.chapter.readHistory.some(v=>v.x.includes("あの名前も、確認できていません"))'));
   assert.equal(g.run('S.chapter.done.length'),g.run('CHAPTER_NODES.length'));
   assert.equal(g.run('S.chapter.readHistory.some(v=>v.x.includes("暴行の可能性"))'),true);
  }

  const g=boot();
  assert.ok(g.run('titleHTML()').includes('ストーリーモード'));
  assert.ok(!html.includes('家族だと言ったのは誰'));
  assert.ok(!html.includes('午前9時の三人'));
  assert.equal(g.run('CHAPTER_BLOCKS.length'),3);
  assert.equal(g.run('Object.keys(MYSTERY_PUZZLES).length'),3);
  assert.ok(g.run('CHAPTER_NODES.filter(n=>!n.training).reduce((sum,n)=>sum+chapterPages(n).reduce((s,p)=>s+p.text.length,0),0)')>=12600,'expanded prose must not revert to the short edition');
  assert.equal(g.run('new Set(CHAPTER_NODES.flatMap(n=>chapterPages(n)).map(p=>p.scene).filter(s=>s.startsWith("scene-family-"))).size'),34);
  assert.equal(g.run('CHAPTER_NODES.flatMap(n=>n.pages()).flatMap(p=>p.clues||[]).length'),19,'each clue is published on exactly one page');
  for(const [node,key,scene] of [['r0','paper-photo-count','scene-family-paper-photo'],['memo','paper-extension-name','scene-family-extension-phone'],['noon','paper-cloth-received','scene-family-cloth-lobby'],['noon','paper-cloth-owner','scene-family-borrowed-cloth'],['safety','paper-photo-return','scene-family-paper-photo']]){
   const page=g.run(`chapterPages(chapterNode(${JSON.stringify(node)})).find(p=>p.key===${JSON.stringify(key)})`);
   assert.equal(page.scene,scene);assert.equal((page.clues||[]).length,0,'uncanny scenes do not add deduction requirements');
  }

  assert.equal(g.run('chapterPages(chapterNode("safety")).find(p=>p.key==="paper-two-daughters").scene'),'scene-family-daughter-document-late');
  assert.ok(g.run('CHAPTER_NODES.flatMap(n=>chapterPages(n)).filter(p=>p.time>="17:30").every(p=>p.scene!=="mentor-scene")'),'late story pages never reuse the sunlit normal-mode mentor');
  for(const id of g.run('Object.keys(PHOTO_ASSETS).filter(id=>id.startsWith("scene-family-"))')){
   assert.ok(['webp','jpeg','png'].some(type=>html.includes(`.multi-art[data-scene-key="${id}"]{background-image:url("data:image/${type};base64,`)),'dedicated scene image is embedded: '+id);
  }
  g.run('startChapter();openChapterNode("r0");');
  assert.equal(g.run('mysteryClues().length'),0);
  assert.ok(!g.run('mysteryNotebookHTML()').includes('KRS-17'));
  g.run('openChapterNode("instructions");chapterEnd();');
  assert.equal(g.run('S.chapter.node'),'r0');
  assert.equal(g.run('S.chapter.view'),'read');
  // Check data integrity and each clue's exact publication page.
  assert.equal(g.run('CHAPTER_NODES.every(n=>n.needs.every(id=>chapterNode(id))&&chapterPages(n).every(p=>p.text&&(!p.scene||PHOTO_ASSETS[p.scene])&&(p.clues||[]).every(id=>MYSTERY_CLUES[id])))'),true);
  assert.equal(g.run('Object.entries(MYSTERY_CLUES).every(([id,c])=>chapterNode(c.node).pages().find(p=>p.key===c.pageKey).clues.includes(id))'),true);
  assert.equal(g.run('Object.values(MYSTERY_PUZZLES).every(p=>p.correct.length===p.count&&new Set(p.correct).size===p.count&&p.correct.every(id=>p.clues.includes(id))&&p.options.some(o=>o.id===p.answer))'),true);
  for(const id of JSON.parse(g.run('JSON.stringify(Object.keys(MYSTERY_CLUES))'))){
   const t=boot();
   t.run(`startChapter();Object.assign(S.chapter.choices,Object.fromEntries(Object.entries(FAMILY_DECISIONS).map(([k,d])=>[k,d.options[0].id])),MYSTERY_CLUES['${id}'].when||{});S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf(MYSTERY_CLUES['${id}'].node));openChapterNode(MYSTERY_CLUES['${id}'].node);`);
   const page=t.run(`chapterPages(chapterNode(MYSTERY_CLUES['${id}'].node)).findIndex(p=>p.key===MYSTERY_CLUES['${id}'].pageKey)`);
   if(page>0)assert.equal(t.run(`mysteryClues().includes('${id}')`),false);
   for(let i=0;i<page;i++)t.run('chapterAdvance();');
   assert.equal(t.run(`mysteryClues().includes('${id}')`),true);
  }
  playToPhone(g);
  const scoring=g.run('JSON.stringify([S.score,S.correct,S.total,S.max,S.hints,S.wait,S.inc])');
  assert.equal(g.run('S.score'),200);
  g.run('chapterAdvance();finishChapterNode();chapterEnd();mysterySolve();');
  assert.equal(g.run('S.chapter.node'),'deduction');
  assert.equal(g.run('S.chapter.attempts'),undefined);
  assert.equal(g.run('chapterAvailable("report")'),false);
  g.run('mysterySelect("woman_contact");mysteryTheory("unknown");');
  assert.equal(g.run('mysteryDraft("source").selected.length'),0);
  g.run('mysteryHint();S.panel="chapter-notes";mysterySelect("husband_quote");mysterySolve();S.panel=null;');
  assert.equal(g.run('mysteryDraft("source").selected.length'),0);
  selectCorrect(g);
  const draft=g.run('JSON.stringify(S.chapter.investigations)');
  g.run('S.panel="chapter-notes";familyClueSource("husband_quote");');
  assert.equal(g.run('S.chapter.node'),'r1');
  assert.equal(g.run('S.chapter.page'),g.run('chapterPages(chapterNode("r1")).findIndex(p=>p.key===MYSTERY_CLUES.husband_quote.pageKey)'));
  assert.ok(g.stage.innerHTML.includes('最終推理へ'));
  g.run('openChapterTimeline();openChapterNode("deduction");');
  assert.equal(g.run('JSON.stringify(S.chapter.investigations)'),draft);
  // Reject a wrong theory, preserve all drafts, show only the contradictory evidence.
  g.run('familySelectQuestion("source");mysteryTheory("yoshida");familySelectQuestion("concealment");mysterySolve();');
  assert.equal(g.run('S.chapter.view'),'timeline');
  assert.ok(g.stage.innerHTML.includes('その証拠では、まだここまで言えない'));
  assert.equal(g.run('S.chapter.contradictions.length'),1);
  assert.equal(g.run('chapterAvailable("report")'),false);
  g.run('openChapterNode("deduction");familySelectQuestion("source");mysteryTheory("kurose");');
  // Reject a correct theory paired with irrelevant evidence.
  g.run('mysterySelect("police_identity");mysterySelect("identity");mysterySolve();');
  assert.equal(g.run('S.chapter.view'),'timeline');
  assert.equal(g.run('S.chapter.contradictions[0].id'),'source');
  g.run('openChapterNode("deduction");mysterySelect("identity");mysterySelect("police_identity");mysterySolve();');
  assert.equal(g.run('S.chapter.solutions.deduction.attempts'),3);
  assert.equal(g.run('S.chapter.notice'),'');
  assert.equal(g.run('JSON.stringify([S.score,S.correct,S.total,S.max,S.hints,S.wait,S.inc])'),scoring);
  g.run('mysterySolve();mysterySelect("police_identity");');
  assert.equal(g.run('S.chapter.solutions.deduction.attempts'),3,'solved deductions are immutable');
  finish(g);
  g.run('openChapterNode("deduction");');
  assert.ok(g.stage.innerHTML.includes('三つの推理と根拠がそろった'));
  assert.ok(!g.stage.innerHTML.includes('data-act="mystery-solve"'));
  g.run('startChapter();');
  assert.equal(g.run('mysteryClues().length'),0);
  assert.equal(g.run('Object.keys(S.chapter.investigations).length'),0);
  assert.equal(g.run('Object.keys(S.chapter.solutions).length'),0);
  g.run('startGame();');assert.equal(g.run('S.chapter'),undefined);

  for(const mode of ['hint','wrong']){
   const t=boot({width:360});playToPhone(t,mode);selectCorrect(t);t.run('mysterySolve();');finish(t);
   assert.equal(t.run('S.score'),mode==='hint'?100:0);
  }
  // Every incorrect theory and wrong fact set stays blocked, independently per question.
  for(const id of ['source','purpose','concealment']){
   for(const kind of ['theory','evidence']){
    const t=boot();playToPhone(t);selectCorrect(t);
    t.run(`familySelectQuestion('${id}');`);
    if(kind==='theory')t.run(`mysteryTheory(MYSTERY_PUZZLES.${id}.options.find(o=>o.id!==MYSTERY_PUZZLES.${id}.answer).id);`);
    else t.run(`mysterySelect(MYSTERY_PUZZLES.${id}.correct[0]);mysterySelect(MYSTERY_PUZZLES.${id}.clues.find(k=>!MYSTERY_PUZZLES.${id}.correct.includes(k)));`);
    t.run('mysterySolve();');assert.equal(t.run('S.chapter.view'),'timeline');assert.equal(t.run('S.chapter.contradictions[0].id'),id);assert.equal(t.run('chapterAvailable("report")'),false);
   }
  }
  // Resume the training case after visiting its timeline without duplicating scores.
  const resume=boot();resume.run('startChapter();openChapterNode("r0");');
  while(resume.run('S.scr')!=='play')resume.run('chapterAdvance();');
  trainingStep(resume);const before=resume.run('S.bi');
  resume.run('openChapterTimeline();openChapterNode("r2");');
  assert.equal(resume.run('S.bi'),before);

  // All existing normal-mode cases, including form interactions, still terminate and score.
  for(const mode of ['correct','hint','wrong']){
   const t=boot();t.run('S.count="all";S.sound=false;startGame();');let guard=0;
   while(t.run('S.scr')==='play'){assert.ok(++guard<1500);trainingStep(t,mode);}
   assert.equal(t.run('S.total'),46);assert.equal(t.run('S.score'),{correct:4600,hint:2300,wrong:0}[mode]);
  }
  const stats=JSON.parse(g.run('JSON.stringify({chapters:CHAPTER_BLOCKS.length,scenes:CHAPTER_NODES.length,pagesAcrossBranches:FAMILY_STATS.total_pages,clues:Object.keys(MYSTERY_CLUES).length,deductions:Object.keys(MYSTERY_PUZZLES).length})'));
  console.log('PASS',stats,'page-gated evidence, phone pause, all three deductions, wrong theories/evidence, retry/readback preservation, ending/reset, training pause, and all 46 normal questions.');
 },

 'longform-branches': function(require,module,__filename,__dirname){
  const {boot,completePc,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const story=JSON.parse(fs.readFileSync(path.join(__dirname,'../story-family.json'),'utf8'));
  assert.ok(story.stats.total_chars>=20000&&story.stats.total_chars<=30000,'the fantasy revision remains a compact three-chapter story');
  assert.ok(story.stats.path_chars_min>=15000);
  assert.equal(story.stats.choices,4);assert.equal(story.stats.early_endings,3);assert.equal(story.stats.total_paths,5);assert.equal(story.stats.routes,2);
  assert.equal(story.stats.core_clues,17);assert.equal(story.stats.all_clues,19);
  const keys=Object.keys(story.decisions).filter(k=>k!=='envelope');
  for(let mask=0;mask<2;mask++){
   const g=boot();g.run("startChapter();S.chapter.choices.envelope='sealed';");
   const picks=Object.fromEntries(keys.map((key,i)=>[key,story.decisions[key].options[key==='woman'?mask:0].id]));
   for(const key of keys){
    const n=story.nodes.find(n=>n.pages.some(p=>p.decision===key));
    g.run(`S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('${n.id}'));openChapterNode('${n.id}');S.chapter.page=chapterPages(chapterNode('${n.id}')).findIndex(p=>p.decision==='${key}');render();`);
    const before=g.run('S.chapter.page');g.run('chapterAdvance();');
    assert.equal(g.run('S.chapter.page'),before,'an unanswered branch cannot be skipped');
    if(key==='issuance'){
     while(g.run('beat().t')!=='pc')g.run('advance();');completePc(g);
     while(g.run('beat().t')!=='ask')g.run('advance();');
     g.run('answer(S.perm.findIndex(i=>curCase().steps[0].choices[i].ok));');
     assert.equal(g.run('S.chapter.choices.issuance'),'hold');assert.equal(g.run('S.chapter.page'),before+1);continue;
    }
    g.run(`familyChooseBranch('${picks[key]}');`);
    assert.equal(g.run(`S.chapter.choices['${key}']`),picks[key]);
    const other=story.decisions[key].options.find(o=>o.id!==picks[key]).id;
    g.run(`familyChooseBranch('${other}');`);
    assert.equal(g.run(`S.chapter.choices['${key}']`),picks[key],'a committed choice cannot be silently replaced');
    g.run('chapterAdvance();');assert.equal(g.run('S.chapter.page'),before+1);
   }
   const visible=JSON.parse(g.run('JSON.stringify(CHAPTER_NODES.flatMap(n=>chapterPages(n)))'));
   for(const page of visible)for(const [key,value] of Object.entries(page.when||{}))assert.equal(picks[key],value);
   const clueIds=visible.flatMap(p=>p.clues||[]);
   assert.equal(clueIds.length,18,'one optional clue per selected response, plus 17 shared clues');
   for(const puzzle of Object.values(story.puzzles))for(const id of puzzle.correct)assert.ok(clueIds.includes(id),'every route supplies the final evidence');
   const outside=JSON.parse(g.run('JSON.stringify(chapterPages(chapterNode("outside")))')).map(p=>p.text).join('\n');
   assert.ok(outside.includes(picks.woman==='explain'?'係長も相談に入っている':'戻って報告しなくていいですか'));
   const savedChoices=g.run('JSON.stringify(S.chapter.choices)');
   g.run('render();S.scr="title";render();');assert.ok(g.stage.innerHTML.includes('data-act="family-entry"'));
   g.run('resumeFamilyProgress();');assert.equal(g.run('JSON.stringify(S.chapter.choices)'),savedChoices);
   assert.equal(g.run('S.chapter.node'),'instructions');
   // A selected optional clue opens its exact page after earlier branches changed page offsets.
   g.run(`S.chapter.clues=${JSON.stringify(clueIds)};familyClueSource('branch_woman_${picks.woman}');`);
   assert.equal(g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),story.clues['branch_woman_'+picks.woman].pageKey);
   assert.ok(g.stage.innerHTML.includes(g.run('esc(familyReadingText(chapterPages(chapterNode(S.chapter.node))[S.chapter.page].text))')));
  }
  const recovery=boot();recovery.run('resumeAtDeduction();');
  assert.equal(recovery.run('mysteryClues().length'),17);
  assert.equal(recovery.run('Object.keys(S.chapter.choices).length'),0,'recovery must not fabricate earlier player choices');
  assert.ok(!recovery.run('mysteryClues().some(id=>MYSTERY_CLUES[id].when)'));
  assert.ok(!recovery.run('readFamilySave()'),'recovery URL does not overwrite an ordinary playthrough');
  const storage=boot();storage.run('startChapter();openChapterNode("r0");chapterAdvance();');
  const snapshot=storage.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  storage.run('S.scr="play";S.chapter.caseActive=true;saveFamilyProgress();');assert.equal(storage.run('localStorage.getItem(FAMILY_SAVE_KEY)'),snapshot,'training resumes from the preceding story checkpoint');
  storage.run('localStorage.setItem(FAMILY_SAVE_KEY,"broken");');assert.equal(storage.run('readFamilySave()'),null);
  const all=story.nodes.flatMap(n=>n.pages).map(p=>p.text).join('\n');
  assert.ok(!all.includes('佐伯沙希'),'the daughter actor never supplies a verified real name');
  assert.ok(!all.includes('来庁した警察官へ、係長'));
  assert.ok(!all.includes('吉田拓海。受付時刻。請求した証明書。'));
  assert.ok(!all.includes('警察は、呼んでもらった')&&!all.includes('頼まれただけの人の声ではなかった'));
  assert.equal(story.puzzles.purpose.answer,'deceived');
  assert.deepEqual(story.puzzles.purpose.correct,['woman_account','instructions']);
  assert.ok(all.includes('家族の連絡を手伝う仕事だって')&&all.includes('あの名前も、確認できていません'));
  assert.ok(!story.nodes.find(n=>n.id==='outside').pages.some(p=>p.scene==='scene-family-outside-call'));
  assert.ok(!story.nodes.filter(n=>!['next_morning','outside'].includes(n.id)).flatMap(n=>n.pages).some(p=>/その電話では話さなかった|同じ時間の話を聞こうとして|女性の話の残りまで確かめた気/.test(p.text)));
  assert.ok(all.includes('真鍋さんと、ご家族の安全が確認できた'));
  console.log('PASS shortened manuscript, both completed branch combinations, persistent choices, 18 accessible clues per path, source links, recovery without invented choices, save/resume, and disappearing accomplice ending.');
 },

 'newsletter': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const root=path.resolve(__dirname,'..');
  const brochure=fs.readFileSync(path.join(root,'komorebi-17.html'),'utf8');
  assert.ok(!/Kurose|KRS-17|YHD-17|TBR-17|id="advertisements"/.test(brochure),'retired advertisement cannot still decode the label');
  for(const [,id] of brochure.matchAll(/href="#([^"]+)"/g))assert.ok(brochure.includes(`id="${id}"`));
  const g=boot();
  assert.ok(!g.run('titleHTML()').includes('komorebi-17.html'));
  g.run('resumeAtDeduction();');
  assert.equal(g.run('mysteryClues().length'),17);
  assert.ok(!g.run('mysteryNotebookHTML()').includes('komorebi-17.html'));
  assert.equal(g.run('MYSTERY_CLUES.woman_contact.node'),'instructions');
  g.run('familyClueSource("woman_contact");');
  assert.equal(g.run('S.chapter.node'),'instructions');
  assert.equal(g.run('chapterPages(chapterNode("instructions"))[S.chapter.page].key'),'instructions-045');
  assert.ok(g.stage.innerHTML.includes('黒瀬修一さんです。事務サポートの。'));
  g.run('openChapterNode("deduction");');
  for(const q of ['source','purpose','concealment'])g.run(`familySelectQuestion('${q}');mysteryTheory(MYSTERY_PUZZLES.${q}.answer);for(const id of MYSTERY_PUZZLES.${q}.correct)mysterySelect(id);`);
  // The argument cannot identify the person named as the woman's client.
  g.run('mysterySelect("woman_contact");mysterySelect("argument");mysterySolve();');
  assert.equal(g.run('S.chapter.view'),'timeline');
  assert.equal(g.run('S.chapter.contradictions[0].id'),'concealment');
  assert.ok(g.stage.innerHTML.includes('依頼者の名前・屋号'));
  g.run('openChapterNode("deduction");familySelectQuestion("concealment");mysterySelect("argument");mysterySelect("woman_contact");mysterySolve();');
  assert.ok(g.run('S.chapter.solutions.deduction'));
  assert.ok(g.stage.innerHTML.includes('本人の説明として'),'the woman’s account supports an inference, not omniscient innocence');
  assert.ok(g.stage.innerHTML.includes('二つの来庁を結ぶ接点'));
  assert.ok(!/Kurose Records Service|17は掲載号|管理・取次ぎの請求/.test(g.stage.innerHTML));
  assert.ok(g.stage.innerHTML.includes('警察へ説明する'));
  console.log('PASS advertisement removed, no external-document dependency, named contact readback, wrong evidence rejected, two-source contact deduction and scoped conclusion.');
 },

 'paper-family': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const story=JSON.parse(fs.readFileSync(path.join(__dirname,'../story-family.json'),'utf8'));
  const page=key=>story.nodes.flatMap(n=>n.pages).find(p=>p.key===key);
  // The revised premise cannot be introduced halfway through a completed 1.x game.
  for(const view of ['read','bad','end']){
   const g=boot();g.run(`startChapter();S.chapter.node='${view==='bad'?'daughter':'outside'}';S.chapter.view='${view}';
    S.chapter.done=[...PACING_ORDER];S.chapter.choices={envelope:'sealed',rescue:'stay',issuance:'${view==='bad'?'issue':'hold'}',woman:'ask'};
    ${view==='bad'?"S.chapter.badEnding='wrong_issue';S.chapter.badPage=2;":''}
    saveFamilyProgress();
    {const saved=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));saved.scenarioVersion='1.0.5';saved.contentRevision='jazz-ending-v1';localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(saved));}`);
   const old=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
   g.run('S.scr="title";openFamilyEntry();');
   assert.ok(g.stage.innerHTML.includes('物語を改稿しました'));
   assert.ok(g.stage.innerHTML.includes('data-act="family-resume" disabled'));
   assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),old,'reading never overwrites the former story');
   assert.equal(g.run('localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY)'),null,'do not mutate storage just by opening the menu');
   g.run('S.panel=null;prepareMode("story");');
   assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),old,'welcome can be cancelled');
   g.run('beginMode();');
   assert.equal(g.run('localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY)'),old,'archive contains the exact old bytes');
   assert.equal(g.run('S.chapter.node'),'r0');
   assert.equal(g.run('S.chapter.done.length'),0);
   assert.equal(g.run('Object.keys(S.chapter.choices).length'),0);
   assert.equal(g.run('S.score'),0);
   const current=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
   assert.equal(JSON.parse(current).scenarioVersion,g.run('SCENARIO.version'));
   g.run('S.scr="title";resumeFamilyProgress();');
   assert.equal(g.run('S.chapter.node'),'r0');
   assert.equal(g.run('localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY)'),old,'new saves leave the archive untouched');
  }
  // Current-premise saves survive the initial-version rebase, including developer saves.
  for(const scenarioVersion of ['1.0.0','2.3.8']){
   const current=boot();current.run('startChapter();openChapterNode("r0");S.chapter.page=2;render();saveFamilyProgress();');
   current.run(`{const s=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));s.scenarioVersion=${JSON.stringify(scenarioVersion)};localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(s));}`);
   const raw=current.run('localStorage.getItem(FAMILY_SAVE_KEY)');
   assert.equal(current.run(`isPrePaperStorySave(${JSON.stringify(raw)})`),false);
   current.run('S.scr="title";resumeFamilyProgress();');
   assert.equal(current.run('S.scr'),'multi');
   assert.equal(current.run('S.chapter.page'),2);
   assert.equal(current.run('localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY)'),null);
  }

  // Archiving failure is visible and must never destroy the old save.
  const fail=boot();fail.run(`startChapter();{const saved=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));saved.scenarioVersion='1.0.5';saved.contentRevision='jazz-ending-v1';localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(saved));}`);
  const original=fail.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  fail.run(`{const write=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key===FAMILY_PRE_PAPER_SAVE_KEY)throw new Error('quota');write(key,value);};}startChapter();`);
  assert.equal(fail.run('localStorage.getItem(FAMILY_SAVE_KEY)'),original);
  assert.equal(fail.run('familySaveFailed'),true);

  // A second imported 1.x record cannot replace an earlier archived playthrough.
  const collision=boot();collision.run(`localStorage.setItem(FAMILY_PRE_PAPER_SAVE_KEY,'first archived record');startChapter();
   {const saved=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));saved.scenarioVersion='1.0.4';saved.contentRevision='jazz-ending-v1';localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(saved));}`);
  const second=collision.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  collision.run('startChapter();');
  assert.equal(collision.run('localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY)'),'first archived record');
  assert.equal(collision.run('localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY+".2")'),second);

  // Fantasy evidence remains page-gated; it cannot leak from a future scene.
  const g=boot();g.run('startChapter();openChapterNode("r0");');
  for(const clue of ['paper_copy','return_price','application_only']){
   assert.ok(!g.run(`mysteryClues().includes('${clue}')`));
   g.run(`{const clue=MYSTERY_CLUES.${clue};S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf(clue.node));openChapterNode(clue.node);S.chapter.page=chapterPages(chapterNode(clue.node)).findIndex(p=>p.key===clue.pageKey);render();}`);
   assert.ok(g.run(`mysteryClues().includes('${clue}')`));
   g.run(`familyClueSource('${clue}');`);
   assert.equal(g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),story.clues[clue].pageKey);
  }
  assert.ok(story.puzzles.purpose.title.includes('説明した'),'the question asks about her account, not verified innocence');
  assert.ok(story.puzzles.purpose.solved.includes('確認できたことにはしない'));
  const deductionIndex=story.nodes.findIndex(n=>n.id==='deduction');
  for(const puzzle of Object.values(story.puzzles))for(const clue of puzzle.correct){
   assert.ok(story.nodes.findIndex(n=>n.id===story.clues[clue].node)<deductionIndex,'no ending revelation is graded as an already-known fact');
  }
  assert.ok(page('paper-recording-return').text.includes('吉田さんから預かった音声'));
  assert.ok(page('paper-return-price').text.includes('音声'),'the recording is established before the rescue, not invented at the ending');
  assert.equal(story.bad_endings.wrong_issue.pages[1].dayOffset,1);
  assert.equal(story.bad_endings.wrong_issue.pages[1].time,'08:55');
  assert.ok(story.bad_endings.wrong_issue.pages[1].text.includes('翌朝'));
  assert.ok(story.bad_endings.wrong_issue.pages[1].text.includes('携帯'),'the changed family photo is digital; old paper remains');
  assert.equal(g.run('FORMS.family_daughter.certs[0].k'),'世帯全部（謄本）');
  assert.equal(g.run('FORMS.family_daughter.items.head'),1);
  assert.ok(g.run('daughterCounterBeats().find(b=>b.visitRequest).visitRequest.detail').includes('世帯主と続柄を記載'));
  console.log('PASS v1 archive and explicit restart, archive failure preservation, new evidence gates, provisional testimony, known evidence only, recording provenance, next-day BAD END and household request consistency.');
 },

 'rescue-ending': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const story=JSON.parse(fs.readFileSync(path.join(__dirname,'../story-family.json'),'utf8'));
  const g=boot();
  g.run(`startChapter();S.chapter.choices.envelope='sealed';S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('noon'));openChapterNode('noon');S.chapter.page=chapterPages(chapterNode('noon')).findIndex(p=>p.decision==='rescue');render();`);
  const point=g.run('S.chapter.page'),clues=g.run('JSON.stringify(S.chapter.clues)'),score=g.run('S.score');
  g.run('chapterAdvance();');assert.equal(g.run('S.chapter.page'),point);
  g.run("familyChooseBranch('leave');");assert.equal(g.run('S.chapter.badEnding'),'rescue_delay');
  assert.ok(g.stage.innerHTML.includes('先生を呼んだほうが確実だ'));
  g.run('familyBadAdvance();render();S.scr="title";resumeFamilyProgress();');
  assert.equal(g.run('S.chapter.view'),'bad');assert.equal(g.run('S.chapter.badPage'),1);
  g.run("openChapterTimeline();openChapterNode('daughter');familyBadRetry();");assert.equal(g.run('S.chapter.view'),'bad');
  for(let i=0;i<5;i++)g.run('familyBadAdvance();');
  assert.ok(g.stage.innerHTML.includes('BAD END')&&g.stage.innerHTML.includes('戻れなかった五分'));
  assert.ok(g.stage.innerHTML.includes('発見した場面からやり直す'));
  assert.ok(g.stage.innerHTML.includes('人工呼吸ができない・ためらわれる場合も、胸骨圧迫を続けます'));
  assert.equal(g.run('JSON.stringify(S.chapter.clues)'),clues);assert.equal(g.run('S.score'),score);
  g.run('familyBadRetry();');assert.equal(g.run('S.chapter.node'),'noon');assert.equal(g.run('S.chapter.page'),point);
  assert.equal(g.run('S.chapter.choices.rescue'),undefined);assert.equal(g.run('S.chapter.choices.envelope'),'sealed');
  g.run("familyChooseBranch('stay');chapterAdvance();");assert.equal(g.run('S.chapter.view'),'read');assert.equal(g.run('S.chapter.page'),point+1);
  g.run("familyChooseBranch('leave');");assert.equal(g.run('S.chapter.choices.rescue'),'stay');
  for(let i=0;i<7;i++)g.run('chapterAdvance();');
  assert.equal(g.run('S.chapter.badEnding'),undefined);
  assert.ok(g.run('S.chapter.readHistory.some(e=>e.x.includes("医務室の医師です"))'));
  // Existing production saves with the retired stairs branch remain loadable.
  const old=boot();old.run(`startChapter();S.chapter.node='phone';S.chapter.view='read';S.chapter.page=0;S.chapter.choices={stairs:'supervisor',woman:'ask'};S.chapter.clues=['branch_stairs_supervisor','identity'];localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,chapter:S.chapter,scores:{score:200}}));resumeFamilyProgress();`);
  assert.equal(old.run('S.chapter.node'),'phone');assert.equal(old.run('S.score'),200);
  assert.equal(old.run('S.chapter.choices.stairs'),undefined);assert.equal(old.run('S.chapter.choices.rescue'),undefined,'migration must not invent the new choice');
  assert.equal(old.run('S.chapter.clues.includes("identity")'),true);
  assert.equal(old.run('S.chapter.clues.includes("branch_stairs_supervisor")'),false);
  assert.equal(Object.keys(story.decisions).join(','),'envelope,rescue,issuance,woman');
  console.log('PASS rescue early ending, checkpoint restore, prior choices/scores/evidence preserved, no premature bypass, successful medical handover, and legacy retired-branch migration.');
 },

 'sealed-letter': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const story=JSON.parse(fs.readFileSync(path.join(__dirname,'../story-family.json'),'utf8'));
  const active=JSON.stringify({nodes:story.nodes,clues:story.clues,puzzles:story.puzzles});
  assert.ok(!story.nodes.some(n=>n.id==='consultation'));
  assert.ok(!story.blocks.some(b=>b.nodes.includes('consultation')));
  assert.deepEqual(story.nodes.find(n=>n.id==='phone').needs,['instructions']);
  assert.ok(!/届かなかった言葉|届け済み|十九日|訂正案|consultation_memo|delivery_record|role_sheet|record_scope/.test(active),'no retired letter explanation in narrative, clues or deductions');
  assert.ok(!story.nodes.some(n=>n.pages.some(p=>p.scene==='scene-family-letters')),'the opened-letter image is not shown');
  assert.deepEqual(story.puzzles.concealment.correct,['contact_card','woman_contact']);
  assert.equal(story.puzzles.concealment.answer,'shared_contact');
  assert.equal(story.puzzles.purpose.answer,'deceived','the woman is still treated as deceived before her disappearance');
  assert.ok(story.nodes.find(n=>n.id==='report').pages.some(p=>p.text.includes('いいえ。読んでいません')));

  // A player saved at any of the 37 removed pages can continue at the next scene.
  for(const woman of ['ask','explain'])for(let page=0;page<37;page++){
   const g=boot();g.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'${woman}'};
    S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('phone'));
    S.chapter.node='consultation';S.chapter.view='read';S.chapter.page=${page};S.chapter.progress.consultation=${page};
    S.chapter.clues=['identity','delivery_record','record_scope'];
    S.chapter.readHistory=[{key:'consultation:${page}',x:'削除された手紙の内容',context:'届かなかった言葉'},
     {key:'r2:log:1',n:'業務フロー',x:'窓口の採点記録'}];
    S.chapter.investigations={source:{theory:'kurose',selected:['husband_quote','police_identity']},purpose:{theory:'deceived',selected:['woman_account','instructions']},concealment:{theory:'interception',selected:['consultation_memo','delivery_record','branch_stairs_call']}};
    S.chapter.contradictions=[{id:'concealment',text:'削除された手紙の内容'}];S.chapter.feedback='削除された手紙の内容';
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'character-address-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150,wait:4}}));resumeFamilyProgress();`);
   assert.equal(g.run('S.chapter.node'),'phone');assert.equal(g.run('S.chapter.page'),0);
   assert.ok(g.run('chapterAvailable("phone")'));assert.equal(g.run('S.chapter.progress.consultation'),undefined);
   assert.equal(g.run('S.score'),150);assert.equal(g.run('S.wait'),4);
   assert.equal(g.run('S.chapter.investigations.source.theory'),'kurose');assert.equal(g.run('S.chapter.investigations.purpose.theory'),'deceived');
   assert.ok(!g.run('S.chapter.investigations.concealment'));
   assert.ok(g.run('S.chapter.clues.includes("woman_contact")'));
   assert.ok(!g.run('JSON.stringify(S.chapter).includes("削除された手紙")||S.chapter.clues.includes("delivery_record")'));
   assert.equal(g.run('S.chapter.readHistory[0].x'),'窓口の採点記録');
   const before=g.run('JSON.stringify(S.chapter)');g.run('saveFamilyProgress();resumeFamilyProgress();');assert.equal(g.run('JSON.stringify(S.chapter)'),before);
  }

  // No evidence is granted before its source page; both route-dependent offsets work.
  for(const woman of ['ask','explain'])for(const seen of [false,true]){
   const g=boot();g.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'${woman}'};
    S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('instructions'));S.chapter.node='instructions';S.chapter.view='read';
    S.chapter.page=chapterPages(chapterNode('instructions')).findIndex(p=>p.key==='instructions-045')${seen?'':'-1'};
    S.chapter.progress.instructions=S.chapter.page;
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'morning-ticket-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:50}}));resumeFamilyProgress();`);
   assert.equal(g.run('S.chapter.clues.includes("woman_contact")'),seen);
  }

  // A completed playthrough stays completed; its old Q3 answer is not remapped.
  const end=boot();end.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'ask'};
   S.chapter.done=[...PACING_ORDER,'consultation'];S.chapter.node='outside';S.chapter.view='end';S.chapter.endingSeen=true;
   S.chapter.solutions.deduction={attempts:2,answers:{source:{theory:'kurose'},concealment:{theory:'interception',selected:['delivery_record']}}};
   S.chapter.readHistory=[{key:'consultation:10',x:'削除された手紙の内容'},{key:'report:3',x:'削除された手紙の内容'}];
   localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'character-address-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:200}}));resumeFamilyProgress();`);
  assert.equal(end.run('S.chapter.view'),'end');assert.equal(end.run('S.chapter.endingSeen'),true);
  assert.equal(end.run('S.chapter.solutions.deduction.attempts'),2);assert.equal(end.run('S.chapter.solutions.deduction.answers.concealment'),undefined);
  assert.ok(!end.run('JSON.stringify(S.chapter).includes("削除された手紙")'));
  end.run('openChapterNode("deduction");');assert.ok(end.stage.innerHTML.includes('二つの来庁を結ぶ接点'));assert.ok(!end.stage.innerHTML.includes('十九日'));

  // Chapter boundaries remain animated, including an old bridge after the deleted scene.
  for(const view of ['bridge','chapter','timeline']){
   const g=boot({chapterCards:true});g.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'ask'};
    S.chapter.done=[...PACING_ORDER.slice(0,PACING_ORDER.indexOf('phone')),'consultation'];S.chapter.node='consultation';S.chapter.view='${view}';
    ${view==='chapter'?"S.chapter.introNode='consultation';":''}
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'character-address-v1',chapter:S.chapter,scores:{score:150}}));resumeFamilyProgress();`);
   assert.equal(g.run('readFamilySave()!==null'),true);assert.ok(!g.stage.innerHTML.includes('届かなかった言葉'));
   if(view==='bridge'||view==='chapter')assert.ok(g.stage.innerHTML.includes('第3章を始める'));
  }
  console.log('PASS letter stays unread, entire scene removed, 37-page save redirect on both routes, history/feedback cleanup, evidence gating, old answer reset, completed ending preservation and chapter boundaries.');
 },

 'sound-novel-pacing': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();
  g.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'ask'};
   S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('noon'));openChapterNode('noon');
   S.chapter.page=chapterPages(chapterNode('noon')).findIndex(p=>p.key==='noon-002');render();`);
  assert.ok(!g.run('chapterPages(chapterNode("noon"))[S.chapter.page].text.includes("吉田さんだった。")'));
  assert.ok(!g.stage.innerHTML.includes('吉田さんだった。'),'recognition is not visible on the preceding screen');
  g.run('chapterAdvance();');
  assert.equal(g.run('chapterPages(chapterNode("noon"))[S.chapter.page].text'),'吉田さんだった。');
  assert.ok(g.stage.innerHTML.includes('family-beat-page')&&g.stage.innerHTML.includes('data-novel-beat="reveal"'));
  g.run('chapterAdvance();');
  assert.equal(g.run('familyCurrentDecision().key'),'rescue','the rescue choice still follows recognition and response checking');

  // Page indices change on both sides of the branch and the phone reveal.
  for(const [node,key] of [['memo','memo-011'],['stairs','stairs-003'],['noon','noon-003'],['phone','phone-014'],['safety','safety-002'],['outside','outside-001']]){
   const h=boot();
   h.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'ask'};
    S.chapter.node='${node}';S.chapter.view='read';
    S.chapter.page=FAMILY_PRE_PACING.nodes['${node}'].findIndex(p=>p.key==='${key}');
    S.chapter.progress['${node}']=S.chapter.page;
    S.chapter.investigations.concealment={theory:'interception',selected:['consultation_memo','delivery_record','branch_stairs_call']};
    S.chapter.readHistory=[{key:'phone:6',x:'旧・否定と反応を一ページで表示',n:'あなた'}];
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'workplace-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150,wait:4}}));resumeFamilyProgress();`);
   assert.equal(h.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),key);
   assert.equal(h.run(`S.chapter.progress['${node}']`),h.run('S.chapter.page'));
   assert.ok(!h.run('S.chapter.investigations.concealment'));
   assert.equal(h.run('S.score'),150);assert.equal(h.run('S.wait'),4);
   assert.ok(h.run('S.chapter.readHistory.some(e=>e.x==="「いいえ。別の方です」")'));
   assert.ok(h.run('S.chapter.readHistory.some(e=>e.x.startsWith("受話器を握った指"))'),'both halves of a previously read paragraph remain in history');
   const snapshot=h.run('JSON.stringify(S.chapter)');h.run('saveFamilyProgress();resumeFamilyProgress();');
   assert.equal(h.run('JSON.stringify(S.chapter)'),snapshot,'resuming a migrated save must not shift it twice');
  }

  for(const id of ['envelope_open','rescue_delay']){
   const h=boot();
   h.run(`startChapter();S.chapter.choices={envelope:'${id==='envelope_open'?'open':'sealed'}',rescue:'leave'};
    S.chapter.view='bad';S.chapter.badEnding='${id}';S.chapter.badPage=FAMILY_PRE_PACING.badEndings['${id}'].length-1;
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'workplace-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:200}}));resumeFamilyProgress();`);
   assert.equal(h.run(`FAMILY_BAD_ENDINGS['${id}'].pages[S.chapter.badPage].key`),h.run(`FAMILY_PRE_PACING.badEndings['${id}'].at(-1).key`));
   for(let i=0;i<3;i++)h.run('familyBadAdvance();');
   assert.ok(h.stage.innerHTML.includes('family-bad-card')&&h.stage.innerHTML.includes('BAD END')&&h.stage.innerHTML.includes('バッドエンド'));
   assert.ok(!h.stage.innerHTML.includes('familyStoryText'),'the end card is a separate screen');
   const end=h.run('S.chapter.badPage');h.run('saveFamilyProgress();resumeFamilyProgress();familyBadAdvance();');assert.equal(h.run('S.chapter.badPage'),end);
   h.run('familyBadReadback();');assert.equal(h.run('S.chapter.badPage'),end-1);assert.ok(h.stage.innerHTML.includes('familyStoryText'));
   h.run('familyBadAdvance();familyBadRetry();');assert.equal(h.run('S.chapter.view'),'read');assert.equal(h.run('S.score'),200);
  }
  // Retained scenes refresh their prose without applying page-splitting twice.
  // Only the obsolete third-question draft is reset; completed endings remain viewed.
  for(const revision of ['sound-novel-pacing-v1','morning-ticket-v1','character-address-v1'])for(const woman of ['ask','explain'])for(const view of ['read','end','bad']){
   const h=boot();
   h.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'${woman}'};
    S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('report'));
    S.chapter.node='report';S.chapter.page=chapterPages(chapterNode('report')).findIndex(p=>p.key==='report-003');S.chapter.progress.report=S.chapter.page;
    S.chapter.view='${view}';S.chapter.endingSeen=true;
    S.chapter.investigations.concealment={theory:'interception',selected:['consultation_memo','delivery_record','branch_stairs_call']};
    S.chapter.readHistory=['r1','memo','report'].map((id,i)=>({key:id+':'+chapterPages(chapterNode(id)).findIndex(p=>p.key===['r1-003','memo-033','report-003'][i]),n:'あなた',x:'旧本文の聞こえない会話'}));
    S.chapter.readHistory.push({key:'r2:log:1',n:'業務フロー',x:'得点を伴う窓口応対の記録'});
    S.chapter.readHistory.push({key:'memo:'+chapterPages(chapterNode('memo')).findIndex(p=>p.decision==='envelope')+':decision',n:'あなた',x:'選んだ応対：開けずに、真鍋へ渡す'});
    ${view==='bad'?"S.chapter.badEnding='rescue_delay';S.chapter.badPage=FAMILY_BAD_ENDINGS.rescue_delay.pages.length;S.chapter.choices.rescue='leave';":''}
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'${revision}',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150,wait:4}}));
    resumeFamilyProgress();`);
   assert.equal(h.run('S.chapter.view'),view);
   assert.equal(h.run('S.chapter.page'),h.run('chapterPages(chapterNode("report")).findIndex(p=>p.key==="report-003")'));
   assert.equal(h.run('S.chapter.progress.report'),h.run('S.chapter.page'));
   assert.ok(!h.run('S.chapter.investigations.concealment'));
   assert.equal(h.run('S.chapter.endingSeen'),true);assert.equal(h.run('S.score'),150);
   assert.ok(!h.run('S.chapter.readHistory.some(e=>e.x.includes("旧本文"))'));
   assert.equal(h.run('S.chapter.readHistory.find(e=>e.key==="r2:log:1").x'),'得点を伴う窓口応対の記録');
   assert.equal(h.run('S.chapter.readHistory.find(e=>e.key.endsWith(":decision")).x'),h.run('"選んだ応対："+FAMILY_DECISIONS.envelope.options.find(o=>o.id==="sealed").label'));
   if(view==='bad')assert.equal(h.run('S.chapter.badPage'),h.run('FAMILY_BAD_ENDINGS.rescue_delay.pages.length'));
   const snapshot=h.run('JSON.stringify(S.chapter)');h.run('saveFamilyProgress();resumeFamilyProgress();');assert.equal(h.run('JSON.stringify(S.chapter)'),snapshot);
  }
  console.log('PASS reveal only after a page turn, unchanged rescue branch, workplace save migration through every inserted passage, complete split history, stable repeat resume, both bad-end cards/resume/readback/retry, and prose-only history refresh without changing progress or ending status.');
 },

 'story-cast-scenes': function(require,module,__filename,__dirname){
  const {boot,assert,html}=require('./test-harness.cjs');
  const g=boot();
  assert.ok(!html.includes('家族だと言ったのは誰'));
  assert.ok(!g.run('titleHTML()').includes('title-story-mark'));
  const pages=JSON.parse(g.run('JSON.stringify(Object.fromEntries(CHAPTER_NODES.map(n=>[n.id,n.pages()])))'));
  assert.ok(pages.r0[0].text.includes('真鍋 恵子'));
  const intro=pages.r1.findIndex(p=>p.text.includes('「黒瀬修一です。'));
  assert.ok(intro>0&&pages.r1.slice(0,intro).every(p=>!p.text.includes('黒瀬')));
  assert.ok(pages.r1.find(p=>p.key==='r1-007').text.includes('黒瀬事務サポート　黒瀬 修一'));
  assert.ok(pages.daughter.slice(0,4).every(p=>!p.text.includes('結衣')));
  assert.ok(pages.daughter[4].text.includes('「真鍋結衣です」'));
  assert.equal(g.run('FORMS.family_daughter.app.name'),'真鍋 結衣');
  assert.equal(g.run('FORMS.family_daughter.tgt.name'),'真鍋 恵子');
  for(const id of ['scene-family-daughter-document','scene-family-daughter-talk','scene-family-daughter-waiting','scene-family-kurose-card']){
   assert.ok(Object.values(pages).flat().some(p=>p.scene===id));
   assert.ok(g.run(`PHOTO_ASSETS['${id}']&&MOTION_ASSETS['${id}'].mobile&&MOTION_ASSETS['${id}'].desktop`));
  }
  for(const id of ['scene-family-yoshida-wait','scene-family-manabe-envelope','scene-family-yoshida-counter','scene-family-kurose-lobby']){
   assert.ok(Object.values(pages).flat().some(p=>p.scene===id));
   assert.ok(g.run(`PHOTO_ASSETS['${id}']&&MOTION_ASSETS['${id}'].mobile&&MOTION_ASSETS['${id}'].desktop`));
  }
  assert.equal(pages.instructions.find(p=>p.key==='instructions-049').scene,'scene-family-daughter-phone');
  for(const key of ['r0-009','r0-012']){
   const page=pages.r0.find(p=>p.key===key);
   assert.equal(page.scene,'scene-family-yoshida-counter');
   assert.ok(!page.portrait,'the full scene photograph must not also overlay a standing portrait');
  }
  assert.equal(pages.next_morning.find(p=>p.key==='next_morning-015').scene,'scene-family-police-arrival');
  assert.equal(pages.outside[0].scene,'scene-family-empty-consultation');
  assert.ok(Object.entries(pages).every(([id,items])=>id==='outside'||items.every(p=>p.scene!=='scene-family-empty-consultation')),'the empty seat is not shown before the disappearance');
  // A saved response from the preceding deployment retains its operation, score,
  // choices and deduction drafts while earlier readback gets the updated names.
  g.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('daughter'));
   S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('daughter');S.chapter.page=4;render();chapterAdvance();
   advance();advance();pcState().query='マナベユイ';pcSearch();pcSelect('app');S.score=150;
   S.chapter.readHistory=[{key:'r1:3',x:'「黒瀬です。」',n:'あなた'}];
   S.chapter.investigations.source={theory:'kurose',selected:['husband_quote','police_identity']};saveFamilyProgress();
   {const saved=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));saved.scenarioVersion='2.3.8';saved.contentRevision='counter-ending-v1';localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(saved));}
   S.scr='title';resumeFamilyProgress();`);
  assert.equal(g.run('isDaughterCounter()'),true);
  assert.equal(g.run('pcState().phase'),'confirm');
  assert.equal(g.run('pcState().query'),'マナベユイ');
  assert.equal(g.run('S.chapter.page'),4);assert.equal(g.run('S.score'),150);
  assert.equal(g.run('S.chapter.choices.rescue'),'stay');
  assert.equal(g.run('S.chapter.investigations.source.theory'),'kurose');
  assert.ok(g.run('S.chapter.readHistory.find(e=>e.key==="r1:3").x.includes("黒瀬修一")'));
  assert.equal(g.run('readFamilySave().contentRevision'),g.run('FAMILY_CONTENT_REVISION'));
  g.run('saveFamilyProgress();resumeFamilyProgress();');assert.equal(g.run('pcState().phase'),'confirm');
  console.log('PASS no story title, name disclosure order, form names, eight image/motion pairs, no duplicate portrait, and prior-deployment response/readback migration.');
 },

 'story-moments': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot(),timers=new Map();let now=0,nextTimer=0;
  g.context.setInterval=fn=>{timers.set(++nextTimer,fn);return nextTimer;};
  g.context.clearInterval=id=>timers.delete(id);
  g.context.Date=class extends Date{static now(){return now;}};
  const root={dataset:{},style:{setProperty(k,v){this[k]=v;}},querySelector(){return {getBoundingClientRect:()=>({width:400})};}};
  const slider={value:'50'},frame={innerHTML:''};
  g.context.document.getElementById=id=>{
   if(!g.stage.innerHTML.includes('id="storyMoment"'))return null;
   return id==='storyMoment'?root:id==='momentPaperPosition'?slider:id==='momentRecallFrame'?frame:null;
  };
  function jump(node,key){
   g.run(`S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('${node}'));S.chapter.node='${node}';S.chapter.view='read';S.chapter.page=chapterPages(chapterNode('${node}')).findIndex(p=>p.key==='${key}');delete S.chapter.readingSlice;render();`);
  }
  function step(ms){for(let t=0;t<ms;t+=100){now+=100;for(const fn of [...timers.values()])fn();}}
  g.run('startChapter();openChapterNode("r0");');
  assert.ok(!g.stage.innerHTML.includes('id="storyMoment"'),'no early family-photo hint');
  jump('safety','paper-effect-discovered');
  assert.ok(g.stage.innerHTML.includes('type="range"'));
  assert.ok(g.stage.innerHTML.includes('先週の紙の控え'));
  assert.ok(g.stage.innerHTML.includes('今日の照会'));
  assert.equal((g.stage.innerHTML.match(/水沢 朋子/g)||[]).length,2,'both records identify the same household head');
  assert.ok(g.stage.innerHTML.includes('水沢 里奈')&&g.stage.innerHTML.includes('水沢 誠'),'the two different family members are visible');
  assert.ok(!g.stage.innerHTML.includes('覆われている'),'names are not obscured in the fictional comparison');
  const choices=g.run('JSON.stringify(S.chapter.choices)'),page=g.run('S.chapter.page');
  g.run('STORY_MOMENTS.move(75);saveFamilyProgress();');
  assert.equal(root.style['--paper-position'],'75');
  assert.equal(g.run('readFamilySave().chapter.momentPositions["paper-effect-discovered"]'),75);
  g.run('S.scr="title";resumeFamilyProgress();');
  assert.equal(g.run('STORY_MOMENTS.position()'),75);
  g.run('STORY_MOMENTS.move(Infinity);');assert.equal(g.run('STORY_MOMENTS.position()'),75);
  g.run('STORY_MOMENTS.move(-1);');assert.equal(g.run('STORY_MOMENTS.position()'),0);
  g.run('STORY_MOMENTS.move(150);');assert.equal(g.run('STORY_MOMENTS.position()'),100);
  assert.equal(g.run('JSON.stringify(S.chapter.choices)'),choices,'moving paper does not create a choice');
  assert.equal(g.run('S.chapter.page'),page,'moving paper does not advance time');
  g.context.document.documentElement.clientWidth=390;g.context.document.documentElement.clientHeight=844;
  g.run('delete S.chapter.readingSlice;render();');
  assert.ok(!g.stage.innerHTML.includes('id="storyMoment"'),'comparison is gated until the final display cut');
  g.run(`{const p=chapterPages(chapterNode('safety'))[S.chapter.page],text=familyReadingText(p.text);S.chapter.readingSlice={key:p.key,text,offset:text.length-1};render();}`);
  assert.ok(g.stage.innerHTML.includes('id="storyMoment"'));
  g.run('GAME_READER.toggleAuto();');step(30000);
  assert.equal(g.run('S.chapter.page'),page,'auto never skips an interactive visual');
  g.run('GAME_READER.toggleAuto();');
  delete g.context.document.documentElement.clientWidth;
  jump('safety','paper-two-daughters');
  assert.ok(g.stage.innerHTML.includes('data-scene-key="scene-family-photo-original"'));
  assert.ok(!g.stage.innerHTML.includes('scene-family-photo-changed'));
  g.run(`S.chapter.view='bad';S.chapter.badEnding='wrong_issue';S.chapter.badPage=1;render();`);
  assert.ok(g.stage.innerHTML.includes('data-scene-key="scene-family-photo-changed"'));
  assert.ok(!g.stage.innerHTML.includes('scene-family-photo-original'));
  assert.ok(g.stage.innerHTML.includes('08:55'),'changed photo belongs to the next morning');
  jump('outside','paper-empty-place');
  assert.ok(g.stage.innerHTML.includes('落ちましたよ'));
  const recallPage=g.run('S.chapter.page');
  step(4300);assert.ok(frame.innerHTML.includes('ご主人ですよ'));
  g.context.document.hidden=true;g.run('STORY_MOMENTS.sync();');const paused=frame.innerHTML;step(20000);assert.equal(frame.innerHTML,paused);
  g.context.document.hidden=false;g.run('STORY_MOMENTS.sync();');step(4900);assert.ok(frame.innerHTML.includes('忙しいのに'));
  step(6000);assert.equal(timers.size,0,'one short timer ends after the final cut');
  assert.equal(g.run('S.chapter.page'),recallPage,'recall does not advance the narrative');
  g.run('STORY_MOMENTS.replay();');assert.ok(frame.innerHTML.includes('落ちましたよ'));
  g.run('S.panel="chapter-menu";render();');assert.equal(timers.size,0,'menu stops the timer');
  g.run('S.panel=null;render();');step(4300);assert.ok(frame.innerHTML.includes('ご主人ですよ'));
  g.run('S.scr="title";render();');assert.equal(timers.size,0);
  console.log('PASS visual gates, paper drag state/save, no score/route/time effects, family-photo isolation, recall timing/pause/replay and idle cleanup.');
 },

},__filename);
