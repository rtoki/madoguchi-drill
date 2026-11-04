// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const {runSuites}=require('./test-tools.cjs');

runSuites({
 'review-saves': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  for(const view of ['read','timeline','end','bad']){
   const g=boot();
   g.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'ask'};
   S.chapter.node='consultation';S.chapter.view='${view}';S.chapter.page=7;S.chapter.progress={consultation:12};
   S.chapter.chapterIntros=['ch1','ch2'];S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('phone'));
   S.chapter.clues=['identity','newsletter_ad','branch_review_newsletter'];
   S.chapter.investigations={source:{theory:'kurose',selected:['husband_quote','police_identity']},concealment:{theory:'interception',selected:['newsletter_ad','consultation_memo','role_sheet']}};
   S.chapter.readHistory=[{key:'consultation:7',x:'旧本文の広告説明',context:'13:41 · 旧題名'},{key:'r1:0',x:'旧本文',context:'09:16 · 待合の来庁者'}];
   ${view==='end'?"S.chapter.solutions.deduction=true;":''}
   ${view==='bad'?"S.chapter.choices.rescue='leave';S.chapter.badEnding='rescue_delay';S.chapter.badPage=2;":''}
   localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,layoutRevision:FAMILY_LAYOUT_REVISION,contentRevision:'three-choices-rescue-v1',chapter:S.chapter,scores:{score:250,wait:3}}));
   resumeFamilyProgress();`);
   assert.equal(g.run('S.chapter.view'),view);assert.equal(g.run('S.score'),250);assert.equal(g.run('S.wait'),3);
   assert.equal(g.run('S.chapter.choices.woman'),'ask');
   assert.ok(g.run('S.chapter.clues.includes("woman_contact")'));
   assert.ok(!g.run('S.chapter.clues.includes("delivery_record")||S.chapter.clues.includes("record_scope")'));
   assert.ok(!g.run('S.chapter.clues.includes("newsletter_ad")'));
   assert.equal(g.run('S.chapter.investigations.source.theory'),'kurose');
   if(view!=='end')assert.ok(!g.run('S.chapter.investigations.concealment'),'obsolete unfinished question is cleared, not silently marked correct');
   else assert.ok(g.run('S.chapter.solutions.deduction'),'completed ending remains completed');
   assert.equal(g.run('S.chapter.node'),'phone');
   if(view==='read')assert.equal(g.run('S.chapter.page'),0);
   assert.equal(g.run('S.chapter.progress.consultation'),undefined);
   assert.ok(!g.run('S.chapter.readHistory.some(e=>e.x.includes("旧本文"))'));
   assert.equal(g.run('S.chapter.readHistory.find(e=>e.key==="r1:0").context'),'09:30 · 待合の来庁者');
   if(view==='bad')assert.equal(g.run('S.chapter.badPage'),2);
   g.run('saveFamilyProgress();S.scr="title";resumeFamilyProgress();');
   assert.equal(g.run('readFamilySave().contentRevision'),g.run('FAMILY_CONTENT_REVISION'));
  }
  console.log('PASS review migration: retired-scene redirect, stable branch/score/history, updated clocks and clues, unfinished third question reset, completed and bad endings preserved.');
 },

 'short-woman-saves': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  for(const [key,pick,expected]of [['instructions-013',null,'instructions-014'],['instructions-025','explain','instructions-045'],['instructions-041','ask','instructions-045'],['instructions-036','ask','instructions-036']]){
   const g=boot();g.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('instructions'));S.chapter.node='instructions';S.chapter.view='read';S.chapter.choices={envelope:'sealed',rescue:'stay',${pick?`woman:'${pick}'`:''}};
   const beforePages=FAMILY_PRE_REVIEW_PAGES.instructions.filter(p=>Object.entries(p.when||{}).every(([k,v])=>S.chapter.choices[k]===v));
   S.chapter.page=beforePages.findIndex(p=>p.key==='${key}');S.chapter.progress.instructions=S.chapter.page;
   S.chapter.readHistory=beforePages.slice(0,S.chapter.page).map((p,i)=>({key:'instructions:'+i,n:'あなた',x:'旧版の段落'}));
   S.chapter.clues=['instructions','woman_account'];S.chapter.chapterIntros=['ch1','ch2'];
   S.chapter.investigations.concealment={theory:'interception',selected:['consultation_memo','delivery_record','branch_stairs_call']};
   localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'actor-critic-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150,wait:1}}));
   resumeFamilyProgress();`);
   assert.equal(g.run('chapterPages(chapterNode("instructions"))[S.chapter.page].key'),expected);
   assert.equal(g.run('S.score'),150);assert.equal(g.run('S.wait'),1);
   assert.equal(g.run('S.chapter.choices.woman'),pick||undefined);
   assert.ok(!g.run('S.chapter.investigations.concealment'),'the replaced question must not inherit the old answer');

   assert.ok(!g.run('S.chapter.readHistory.some(e=>e.x==="旧版の段落")'));
   if(!pick){
    const before=g.run('S.chapter.page');g.run('chapterAdvance();');assert.equal(g.run('S.chapter.page'),before,'an unanswered choice remains a stop');
    g.run('familyChooseBranch("ask");chapterAdvance();');assert.equal(g.run('chapterPages(chapterNode("instructions"))[S.chapter.page].key'),'instructions-030');
   }
   g.run('S.scr="title";resumeFamilyProgress();');assert.equal(g.run('S.chapter.node'),'instructions');
  }
  console.log('PASS shortened-scene saves: both routes, removed and retained paragraphs, unanswered choice, rewritten history, unchanged scores and reset obsolete deduction.');
 },

 'shorter-ending-saves': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');

  // Check every formerly visible page, including removed paragraphs on both routes.
  for(const woman of ['ask','explain']){
   const g=boot();
   const cases=g.run(`Object.entries(FAMILY_PRE_JAZZ).flatMap(([id,pages])=>
     ['memo','report','safety','next_morning','outside'].includes(id)?
     pages.filter(p=>!p.when||!p.when.woman||p.when.woman==='${woman}').map((p,index)=>({id,key:p.key,index})):[])`);
   for(const {id,key,index} of cases){
    g.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'${woman}'};
     S.chapter.node='${id}';S.chapter.view='read';S.chapter.page=${index};S.chapter.progress['${id}']=${index};
     S.chapter.investigations.concealment={theory:'delivery',selected:['consultation_memo','delivery_record','morning_identity']};
     S.chapter.readHistory=[{key:'${id}:${index}',n:'あなた',x:'更新前の本文'}];
     localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'elapsed-time-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150,wait:4}}));
     resumeFamilyProgress();`);
    const expected=g.run(`(()=>{
     const old=FAMILY_PRE_JAZZ['${id}'].filter(p=>Object.entries(p.when||{}).every(([k,v])=>S.chapter.choices[k]===v));
     const now=chapterPages(chapterNode('${id}'));
     const next=old.slice(${index}).find(p=>now.some(n=>n.key===p.key));
     return next?.key||now.at(-1).key;
    })()`);
    assert.equal(g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),expected,`${woman}: ${key}`);
    assert.equal(g.run(`S.chapter.progress['${id}']`),g.run('S.chapter.page'));
    assert.equal(g.run('S.chapter.choices.woman'),woman);
    assert.equal(g.run('S.chapter.investigations.concealment.theory'),'delivery','prose edits must retain an unfinished deduction');
    assert.equal(g.run('S.score'),150);assert.equal(g.run('S.wait'),4);
    assert.ok(!g.run('S.chapter.readHistory.some(e=>e.x.includes("更新前の本文"))'));
    const snapshot=g.run('JSON.stringify(S.chapter)');
    g.run('saveFamilyProgress();resumeFamilyProgress();');
    assert.equal(g.run('JSON.stringify(S.chapter)'),snapshot,'no second migration');
   }
  }
  for(const revision of ['cast-scenes-v1','counter-ending-v1']){
   const g=boot();
   g.run(`startChapter();S.chapter.readHistory=[{key:'r2:log:1',x:'窓口での会話',context:'旧時刻'}];
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'${revision}',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150}}));resumeFamilyProgress();`);
   assert.equal(g.run('S.chapter.readHistory[0].context'),'09:05 · 吉田さんの証明書');
   assert.equal(g.run('S.chapter.readHistory[0].x'),'窓口での会話');
  }
  console.log('PASS all pre-compression envelope/ending pages on both routes migrate forward by key, with refreshed history, retained deduction, score, choices and stable repeat resume.');
 },

 'three-chapter-saves': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  function saveOld(g,{view,node,doneUntil=node,introNode,page=0,intros=['b1'],progress={}}){
   g.run(`startChapter();S.chapter.view=${JSON.stringify(view)};S.chapter.node=${JSON.stringify(node)};S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf(${JSON.stringify(doneUntil)}));S.chapter.page=${page};S.chapter.introNode=${JSON.stringify(introNode)};S.chapter.chapterIntros=${JSON.stringify(intros)};S.chapter.progress=${JSON.stringify(progress)};S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'ask'};S.chapter.clues=['identity'];localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:FAMILY_CONTENT_REVISION,chapter:S.chapter,scores:{score:200}}));resumeFamilyProgress();`);
   assert.equal(g.run('S.score'),200);assert.equal(g.run('S.chapter.choices.woman'),'ask');assert.equal(g.run('S.chapter.clues.includes("identity")'),true);
  }
  for(const id of ['memo','daughter','deduction','report']){
   const g=boot({chapterCards:true});saveOld(g,{view:'chapter',node:id,introNode:id,intros:['b1','b4','b7']});
   assert.equal(g.run('S.chapter.view'),'read');assert.equal(g.run('S.chapter.node'),id);assert.equal(g.run('S.chapter.page'),0);
   assert.ok(!g.stage.innerHTML.includes('chapter-transition-wipe'),'obsolete inner chapter doors are removed');
  }
  for(const [previous,next]of [['r1','memo'],['noon','daughter'],['deduction','report']]){
   const g=boot({chapterCards:true});saveOld(g,{view:'bridge',node:previous,doneUntil:next});
   assert.equal(g.run('S.chapter.view'),'read');assert.equal(g.run('S.chapter.node'),next);
  }
  for(const [previous,next,number]of [['stairs','noon',2],['instructions','phone',3]]){
   const g=boot({chapterCards:true});saveOld(g,{view:'bridge',node:previous,doneUntil:next});
   assert.equal(g.run('S.chapter.view'),'bridge');assert.ok(g.stage.innerHTML.includes('第'+number+'章を始める'));
  }
  const waiting=boot({chapterCards:true});saveOld(waiting,{view:'chapter',node:'noon',introNode:'noon',intros:['b1','b2','b3']});
  assert.equal(waiting.run('S.chapter.view'),'chapter');assert.ok(waiting.stage.innerHTML.includes('第2章を始める'));
  const reading=boot({chapterCards:true});saveOld(reading,{view:'read',node:'instructions',page:5,progress:{instructions:5},intros:['b1','b2','b3','b4','b5']});
  assert.equal(reading.run('S.chapter.page'),5);assert.equal(reading.run('JSON.stringify(S.chapter.chapterIntros)'),JSON.stringify(['ch1','ch2']));
  reading.run('render();S.scr="title";resumeFamilyProgress();');assert.equal(reading.run('S.chapter.page'),5);
  console.log('PASS nine-chapter saves migrate at read pages, obsolete chapter cards and bridges, preserving real boundaries, choices, clues, scores and resaving.');
 },

 'shared-scenario-runtime': function(require,module,__filename,__dirname){
  // Exercise compiled packs with the real reader, including partially revealed
  // text and mobile display cuts. Build the original and starter HTML first.
  const assert=require('node:assert/strict');
  const path=require('node:path');
  const gameRoot=path.resolve(process.argv[2]||path.join(__dirname,'..'));
  function harness(root){
   const previous=process.argv[2],file=require.resolve('./test-harness.cjs');
   process.argv[2]=root;delete require.cache[file];const value=require(file);
   if(previous===undefined)delete process.argv[2];else process.argv[2]=previous;
   return value;
  }
  const original=harness(gameRoot),starter=harness(path.join(gameRoot,'build/starter'));
  const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  function boot(pack,width=390){
   const g=pack.boot({width,reducedMotion:false});let cachedHTML='',cached;
   g.context.document.documentElement.clientWidth=width;
   g.context.document.documentElement.clientHeight=844;
   // The VM harness has no browser DOM. Expose the same reader text and data
   // attributes produced by the actual rendered HTML, without replacing its logic.
   g.context.document.getElementById=id=>{
    if(id!=='familyStoryText')return null;
    const html=g.stage.innerHTML.match(/<p id="familyStoryText"[\s\S]*?<\/p>/)?.[0];
    if(!html)return null;if(html===cachedHTML)return cached;cachedHTML=html;
    const dataset=Object.fromEntries([...html.matchAll(/data-novel-([\w-]+)="([^"]*)"/g)].map(([,k,v])=>['novel'+k[0].toUpperCase()+k.slice(1),decode(v)]));
    const parts={'.family-accessible':{textContent:decode(html.match(/<span class="family-accessible">([\s\S]*?)<\/span>/)[1])},'[data-novel-visible]':{textContent:''},'[data-novel-rest]':{textContent:''}};
    cached={dataset,querySelector:q=>parts[q],classList:{toggle(){}}};return cached;
   };
   g.run('S.sound=false;');return g;
  }
  const position=g=>g.run('JSON.stringify([S.scr,S.bi,S.chapter?.view,S.chapter?.node,S.chapter?.page,S.chapter?.badPage,S.chapter?.readingSlice?.offset])');
  const domain=g=>g.run('JSON.stringify({score:S.score,correct:S.correct,total:S.total,choices:S.chapter?.choices,solutions:S.chapter?.solutions,investigations:S.chapter?.investigations})');
  function reveal(g){
   if(!g.run('GAME_READER.revealing()'))return false;
   const before=position(g),state=domain(g);
   g.run('GAME_READER.advance();');
   assert.equal(position(g),before,'first forward action reveals only the current cut');
   assert.equal(domain(g),state,'revealing text cannot answer or award points');
   assert.equal(g.run('GAME_READER.revealing()'),false);return true;
  }
  function restore(pack,g){
   g.run('saveFamilyProgress();');
   const save=g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),before=domain(g);
   assert.ok(save,'a checkpoint was saved');
   const restored=boot(pack);
   restored.run(`localStorage.setItem(FAMILY_SAVE_KEY,${JSON.stringify(save)});resumeFamilyProgress();`);
   assert.equal(domain(restored),before,'fresh runtime restores decisions, deduction drafts and score');
   assert.equal(restored.run('SCENARIO.id'),g.run('SCENARIO.id'));
   return restored;
  }
  function counterStep(pack,g){
   const type=g.run('beat().t');
   if(type==='pc')pack.completePc(g);
   else if(type==='ask'){
    assert.equal(g.run('S.done'),true,'a question is actionable only after its text');
    g.run('answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
   }else if(type==='order'){
    assert.equal(g.run('S.done'),true);
    g.run('S.pick=curCase().steps[beat().si].items.map((_,i)=>i);commitOrder();');
   }else g.run('GAME_READER.advance();');
  }
  function chooseCorrect(g){
   const puzzles=JSON.parse(g.run('JSON.stringify(Object.keys(MYSTERY_PUZZLES))'));
   for(const key of puzzles){
    g.run(`familySelectQuestion(${JSON.stringify(key)});`);
    for(const clue of JSON.parse(g.run(`JSON.stringify(MYSTERY_PUZZLES[${JSON.stringify(key)}].correct)`)))g.run(`mysterySelect(${JSON.stringify(clue)});`);
    g.run(`mysteryTheory(MYSTERY_PUZZLES[${JSON.stringify(key)}].answer);`);
   }
  }
  function storyStep(g){
   const view=g.run('S.chapter.view');
   if(view==='bridge')g.run('pacingBridgeContinue();');
   else if(view==='chapter')g.run('beginFamilyChapter();');
   else if(view==='timeline')g.run('openChapterNode(SCENARIO.review.deduction);');
   else if(view==='read'){
    const decision=g.run('familyCurrentDecision()?.key');
    if(decision&&!g.run(`S.chapter.choices[${JSON.stringify(decision)}]||chapterDone(S.chapter.node)`))g.run('familyChooseBranch(familyCurrentDecision().options[0].id);');
    else g.run('GAME_READER.advance();');
   }else if(view==='bad')g.run('GAME_READER.advance();');
   else assert.fail('unexpected story state: '+view);
  }

  // Full original: story -> scored counter -> story -> daughter form -> story ->
  // deduction -> FIN. Every forward action uses the shared revealing pipeline.
  let g=boot(original),mobileResume=false,counterResume=false,deductionResume=false,earlyQuestion=false;
  g.run('startChapter();openChapterNode(PACING_ORDER[0]);');
  let steps=0,slices=0,transitions=0,lastMode='multi';
  while(g.run('S.chapter.view')!=='end'){
   assert.ok(++steps<4500,'original must finish without a stuck transition');
   const scr=g.run('S.scr');if(scr!==lastMode){transitions++;lastMode=scr;}
   if(scr==='play'){
    assert.ok(g.run('GAME_READER.snapshot().key?.startsWith("counter:")')||!g.run('GAME_READER.revealing()'),'story characters cannot carry into counter text');
    if(g.run('beat().t==="ask"&&GAME_READER.revealing()')){
     const before=position(g),state=domain(g);
     g.run('answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
     assert.equal(position(g),before,'an answer cannot skip an unfinished counter question');
     assert.equal(domain(g),state,'an unfinished question cannot award points');
     earlyQuestion=true;
    }
    if(!counterResume&&g.run('isDaughterCounter()&&beat().t==="pc"')){
     g.run('pcState().query=pcBirthKeys(FORMS[curCase().id].app.birth)[0];pcSearch();pcSelect("app");pcState().relation=pcExpectedRelation(FORMS[curCase().id]);pcState().target=true;pcState().items={...FORMS[curCase().id].items};pcTransfer();');
     assert.equal(g.run('pcState().phase'),'excel');
     const bi=g.run('S.bi');g=restore(original,g);
     assert.equal(g.run('S.scr'),'play');assert.equal(g.run('S.bi'),bi);
     assert.equal(g.run('pcState().phase'),'excel','form editing resumes within the same counter interaction');
     g.run('pcState().quantity=String(FORMS[curCase().id].certs[0].n);pcState().lane="local";pcPrint();closeMaterial();');
     counterResume=true;continue;
    }
    if(!reveal(g))counterStep(original,g);continue;
   }
   if(g.run('S.chapter.view==="read"&&!!chapterNode(S.chapter.node)?.puzzle&&!S.chapter.solutions?.[S.chapter.node]')){
    if(reveal(g))continue;
    chooseCorrect(g);
    if(!deductionResume){g=restore(original,g);deductionResume=true;}
    g.run('mysterySolve();');
    assert.ok(g.run('S.chapter.solutions[S.chapter.node]'),'all selected answers can be submitted after resume');continue;
   }
   if(g.run('S.chapter.view==="read"&&S.chapter.readingSlice?.offset>0')){
    slices++;
    if(!mobileResume){
     const key=g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),offset=g.run('S.chapter.readingSlice.offset');
     g=restore(original,g);
     assert.equal(g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),key);
     assert.equal(g.run('S.chapter.readingSlice.offset'),offset,'resume preserves the mobile cut within its stable authored page');
     mobileResume=true;
    }
   }
   if(!reveal(g))storyStep(g);
  }
  assert.ok(mobileResume&&counterResume&&deductionResume&&earlyQuestion,'all three checkpoint types and unfinished questions were reached');
  assert.ok(slices>20,'test exercised mobile display cuts rather than skipping their reader');
  assert.ok(transitions>=4,'story and both counter interactions used distinct adapters');
  assert.equal(g.run('S.score'),200);assert.equal(g.run('S.chapter.done.length'),g.run('CHAPTER_NODES.length'));
  assert.equal(g.run('S.chapter.choices.issuance'),'hold');
  assert.equal(g.run('S.chapter.readHistory.length'),g.run('new Set(S.chapter.readHistory.map(e=>e.key)).size'),'restore never duplicates the reading log');
  g=restore(original,g);assert.equal(g.run('S.chapter.view'),'end');
  const ended=position(g);g.run('GAME_READER.advance();');assert.equal(position(g),ended,'FIN has no active reading transition');
  g.run('startGame();');assert.equal(g.run('S.chapter'),undefined,'new normal play has no old story decision state');
  g.run('GAME_READER.setSpeed("fast");startChapter();openChapterNode(PACING_ORDER[0]);');
  assert.equal(g.run('GAME_READER.snapshot().speed'),'fast','mode switches retain the same reader preference');
  assert.equal(g.run('Object.keys(S.chapter.choices).length'),0,'new story starts with no completed route');

  // Independent compiled starter has no original counter extension. It must use
  // the same text/decision/BAD/retry/deduction/FIN lifecycle without that extension.
  let s=boot(starter);s.run('startChapter();openChapterNode("arrival");');
  while(!s.run('familyCurrentDecision()')){if(!reveal(s))s.run('GAME_READER.advance();');}
  assert.equal(s.run('GAME_READER.revealing()'),true);
  const branchBefore=position(s);
  s.run('familyChooseBranch("guess");');
  assert.equal(position(s),branchBefore,'a choice made during reveal first displays its full context');
  assert.equal(s.run('S.chapter.choices.response'),undefined);
  assert.equal(s.run('GAME_READER.revealing()'),false);
  s.run('familyChooseBranch("guess");');assert.equal(s.run('S.chapter.view'),'bad');
  let badSteps=0;
  while(s.run('S.chapter.badPage<FAMILY_BAD_ENDINGS[S.chapter.badEnding].pages.length')){
   assert.ok(++badSteps<100);if(!reveal(s))s.run('GAME_READER.advance();');
  }
  s=restore(starter,s);assert.equal(s.run('S.chapter.view'),'bad');
  assert.ok(s.stage.innerHTML.includes('BAD END'));
  const badCard=position(s);s.run('GAME_READER.advance();');assert.equal(position(s),badCard);
  s.run('familyBadRetry();');assert.equal(s.run('S.chapter.choices.response'),undefined);
  while(!s.run('familyCurrentDecision()')){if(!reveal(s))s.run('GAME_READER.advance();');}
  reveal(s);s.run('familyChooseBranch("ask");');
  let sampleSteps=0;
  while(s.run('S.chapter.view')!=='end'){
   assert.ok(++sampleSteps<150);
   if(reveal(s))continue;
   if(s.run('S.chapter.view==="read"&&chapterNode(S.chapter.node)?.puzzle&&!S.chapter.solutions[S.chapter.node]')){chooseCorrect(s);s.run('mysterySolve();');}
   else storyStep(s);
  }
  assert.equal(s.run('S.chapter.done.length'),4);s=restore(starter,s);
  assert.equal(s.run('S.chapter.view'),'end');assert.ok(s.stage.innerHTML.includes('FIN'));
  assert.notEqual(s.run('FAMILY_SAVE_KEY'),g.run('FAMILY_SAVE_KEY'));

  // Original decisions and the direct counter button require the same first-tap
  // reveal as ordinary forward actions. Position at the final mobile cut so the
  // decision is visible while its final context is still being printed.
  for(const [node,decision,option] of [['memo','envelope','open'],['daughter','issuance',null]]){
   const t=boot(original);t.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf(${JSON.stringify(node)}));openChapterNode(${JSON.stringify(node)});S.chapter.page=chapterPages(chapterNode(S.chapter.node)).findIndex(p=>p.decision===${JSON.stringify(decision)});render();`);
   for(let guard=0;!t.run('familyCurrentDecision()');guard++){
    assert.ok(guard<50);if(!reveal(t))t.run('GAME_READER.advance();');
   }
   assert.equal(t.run('GAME_READER.revealing()'),true);
   const before=position(t),act=option?`familyChooseBranch(${JSON.stringify(option)});`:'startDaughterCounter();';
   t.run(act);assert.equal(position(t),before,decision+': first selection only reveals text');
   assert.equal(t.run(`S.chapter.choices[${JSON.stringify(decision)}]`),undefined);
   assert.equal(t.run('GAME_READER.revealing()'),false);
   t.run(act);assert.equal(t.run('S.scr'),option?'multi':'play');
   if(option)assert.equal(t.run('S.chapter.view'),'bad');
  }
  console.log('PASS shared reader through original/starter compiled scripts, mobile cuts, counter forms, fresh-runtime checkpoints, choices, BAD retry, deductions, FIN and mode reset.');
 },

 'scenario-runtime': function(require,module,__filename,__dirname){
  // Build starter first: python3 scripts/build.py standalone --scenario starter
  const path=require('node:path');
  process.argv[2]=path.join(__dirname,'../build/starter');
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs');
  const g=boot();
  assert.equal(g.run('SCENARIO.id'),'starter');
  assert.equal(g.run('CHAPTER_NODES.length'),4);
  assert.equal(g.run('CHAPTER_BLOCKS.length'),1);
  g.run('startChapter();openChapterNode("arrival");');
  assert.ok(!g.stage.innerHTML.includes('undefined'));
  g.run('familyChooseBranch("guess");');
  assert.equal(g.run('S.chapter.view'),'bad');
  g.run('familyBadAdvance();');
  assert.ok(g.stage.innerHTML.includes('BAD END'));
  g.run('saveFamilyProgress();S.scr="title";resumeFamilyProgress();');
  assert.ok(g.stage.innerHTML.includes('BAD END'),'completed bad ending restores the card');
  g.run('familyBadRetry();');
  assert.equal(g.run('S.chapter.page'),0);
  g.run('familyChooseBranch("ask");');
  while(g.run('S.chapter.node')==='arrival')g.run('chapterAdvance();');
  assert.equal(g.run('S.chapter.node'),'inspection');
  assert.equal(g.run('S.chapter.clues[0]'),'number');
  g.run('chapterAdvance();');
  assert.ok(g.stage.innerHTML.includes('data-v="conclusion"'));
  g.run('openChapterNode("conclusion");');
  assert.ok(g.stage.innerHTML.includes('推理 1 / 1'));
  assert.ok(!g.stage.innerHTML.includes('undefined'));
  g.run('mysteryTheory("nearby");mysterySelect("number");mysterySolve();');
  assert.equal(g.run('S.chapter.view'),'timeline');
  g.run('openChapterNode("conclusion");mysteryTheory("number_check");mysterySolve();chapterAdvance();');
  assert.equal(g.run('S.chapter.node'),'departure');
  g.run('chapterAdvance();chapterAdvance();');
  assert.equal(g.run('S.chapter.view'),'end');
  assert.ok(g.stage.innerHTML.includes('FIN'));
  g.run('saveFamilyProgress();S.scr="title";resumeFamilyProgress();');
  assert.equal(g.run('S.chapter.view'),'end');

  // Insertion and reordering retain page identity for current, progress and history.
  const r=boot();
  r.run('startChapter();openChapterNode("arrival");familyChooseBranch("ask");chapterAdvance();saveFamilyProgress();');
  const saved=r.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  r.run(`SCENARIO.story.nodes[0].pages.unshift({key:'new-opening',scene:'bg',text:'追加された未読の文章'});resumeFamilyProgress();`);
  assert.equal(r.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),'arrival-ask');
  assert.equal(r.run('S.chapter.progress.arrival'),2);
  assert.ok(!r.run('S.chapter.readHistory.some(e=>e.x.includes("追加された未読"))'));
  assert.ok(r.run('S.chapter.readHistory.some(e=>e.key==="arrival:1")'));
  r.run('saveFamilyProgress();resumeFamilyProgress();');
  assert.equal(r.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),'arrival-ask');

  for(const mutate of [
   's.scenarioId="other"',
   'delete s.anchors.current',
   'delete s.anchors.progress.arrival',
   's.anchors.current="removed-page"',
   's.anchors.history={}',
   'delete s.scenarioId;delete s.anchors'
  ]){
   r.run(`{const s=JSON.parse(${JSON.stringify(saved)});${mutate};localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(s));}`);
   assert.equal(r.run('readFamilySave()'),null,mutate);
  }
  // Another game on the same origin cannot overwrite this story or its scores.
  const mainKey=JSON.parse(fs.readFileSync(path.join(__dirname,'../scenarios/komorebi/manifest.json'))).saveKey;
  r.run(`localStorage.setItem(${JSON.stringify(mainKey)},'original-save');startChapter();openChapterNode('arrival');saveFamilyProgress();saveBest({score:100});`);
  assert.equal(r.run(`localStorage.getItem(${JSON.stringify(mainKey)})`),'original-save');
  assert.equal(r.run('SCENARIO.bestKey'),'madoguchi.score.starter.v1');
  console.log('PASS independent sample, branch/BAD retry, evidence/review/deduction/FIN, save isolation and stable current/progress/history anchors.');
 },

},__filename);
