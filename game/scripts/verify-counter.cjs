// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const {runSuites}=require('./test-tools.cjs');

runSuites({
 'counter-administration': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');

  // A presented document is not a completed identity check. Inspect the actual
  // application renderer, including the forged-license case and an ordinary case.
  const g=boot();
  g.run('startChapter();S.scr="play";S.chapter.node="daughter";S.chapter.caseActive=true;S.docs=true;S.fstage=2;');
  let paper=g.run('formHTML()');
  assert.ok(paper.includes('本人確認（未了）'));
  assert.ok(paper.includes('本人確認・請求資格の確認は未了'));
  assert.ok(!paper.includes('✓'),'presentation alone must not mark the license verified');
  assert.ok(!paper.includes('昭和49年2月18日'),'do not print the mother’s unprovided birth date');
  g.run('S.fstage=3;');
  assert.ok(!g.run('formHTML()').includes('class="hanko'),'unresolved identity must not get a review stamp');

  g.run('S.mode="normal";S.chapter=null;S.queue=[CASES.findIndex(c=>c.id==="c1")];S.qi=0;S.fstage=0;');
  assert.equal(g.run('curCase().id'),'c1');
  assert.ok(!g.run('formHTML()').includes('✓'),'blank application must not precheck presented IDs');
  g.run('S.fstage=2;');
  paper=g.run('formHTML()');
  assert.ok(paper.includes('✓</span>運転免許証'));
  assert.ok(!paper.includes('本人確認（未了）'));
  for(const id of ['c2']){
   g.run(`S.queue=[CASES.findIndex(c=>c.id==='${id}')];`);
   const name=g.run('curCase().visitor.docs[0]');
   assert.equal(name,'健康保険の資格確認書');
   const thumbnail=g.run('docHTML(curCase().visitor.docs[0],0)');
   const detail=g.run('docDetail(curCase(),curCase().visitor.docs[0])');
   for(const html of [thumbnail,detail]){
    assert.ok(html.includes('qualification-card'));
    assert.ok(html.includes('国民健康保険　資格確認書'));
    assert.ok(html.includes('番号は伏せ字'));
    assert.ok(!html.includes('健康保険証の見本'));
   }
  }
  assert.ok(g.run('docDetail(curCase(),"介護保険被保険者証")').includes('care-insurance'),'care insurance stays a separate document');
  console.log('PASS pending identity vs presented IDs, unprovided information omitted, no premature review stamps, current qualification documents and normal-mode checks.');
 },

 'daughter-counter': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  function start(g){
   g.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('daughter'));
    S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('daughter');
    S.chapter.page=chapterPages(chapterNode('daughter')).findIndex(p=>p.decision==='issuance');S.score=150;render();chapterAdvance();`);
   assert.equal(g.run('S.scr'),'play');assert.equal(g.run('curCase().id'),'family_daughter');
   assert.ok(g.stage.innerHTML.includes('data-act="desk"')&&g.stage.innerHTML.includes('play-ui'));
   assert.ok(!g.stage.innerHTML.includes('交付を保留'),'no outcome before the response');
   g.run('advance();');
   assert.ok(g.stage.innerHTML.includes('母の住民票'));
  }
  function resume(g){
   const saved=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
   g.run('S.scr="title";render();');
   assert.equal(g.run('isDaughterCounter()'),false,'leaving the response restores the ordinary title');
   assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),saved,'rendering the title does not overwrite the response checkpoint');
   g.run('resumeFamilyProgress();');
   assert.equal(g.run('S.scr'),'play');assert.equal(g.run('curCase().id'),'family_daughter');
   assert.equal(g.run('S.score'),150);
   return saved;
  }
  for(const outcome of ['hold','issue']){
   const g=boot({width:390});start(g);
   const page=g.run('S.chapter.page');
   if(outcome==='hold'){
    g.run('openMaterial("doc:0");');
    assert.equal(g.run('S.zoom'),0);
    assert.ok(g.stage.innerHTML.includes('family-license-card')&&g.stage.innerHTML.includes('写真の縁が二重'));
    assert.ok(g.stage.innerHTML.includes('family-license-face'));
    g.run('advance();');assert.equal(g.run('S.chapter.page'),page);
    g.run('closeMaterial();');
   }
   g.run('advance();');assert.equal(g.run('beat().t'),'pc');
   assert.ok(g.stage.innerHTML.includes('pcSearchForm'));
   g.run('pcState().query="知らない名前";pcSearch();');assert.equal(g.run('pcResults().length'),0);
   g.run('pcState().query="マナベユイ";pcSearch();pcSelect("app");');
   assert.equal(g.run('pcState().phase'),'confirm');resume(g);
   assert.equal(g.run('pcState().phase'),'confirm','search selection survives reload');
   g.run('openMaterial("term");pcState().relation="self";pcTransfer();');
   assert.equal(g.run('pcState().phase'),'confirm','incorrect target is not silently transferred');
   g.run('pcState().relation="other";pcState().target=true;pcState().items={...FORMS.family_daughter.items};pcTransfer();');
   assert.equal(g.run('pcState().phase'),'excel');
   g.run('pcQuantityKey("2");pcPrint();');assert.equal(g.run('pcState().phase'),'excel');
   g.run('pcQuantityKey("clear");pcQuantityKey("1");');resume(g);
   assert.equal(g.run('pcState().quantity'),'1','keypad input is saved without a render');
   g.run('openMaterial("term");pcPrint();');
   assert.equal(g.run('S.win'),'form');assert.equal(g.run('S.fstage'),1);
   assert.ok(g.stage.innerHTML.includes('証明交付申請書'));
   assert.equal(g.run('S.chapter.view'),'read','printing an application does not issue a certificate');
   g.run('closeMaterial();advance();advance();');
   assert.equal(g.run('beat().t'),'ask');assert.equal(g.run('S.fstage'),2);
   assert.ok(!g.run('choicesHTML()').includes('真鍋さんに相談'));
   assert.ok(!g.run('choicesHTML()').includes('正解'));
   // Opening any item at the final decision cannot commit or advance the response.
   if(outcome==='hold'){
    g.run('openMaterial("doc:0");answer(0);');assert.equal(g.run('S.scr'),'play');
    g.run('closeMaterial();');
   }
   g.run(`answer(S.perm.findIndex(i=>curCase().steps[0].choices[i].id==='${outcome}'));`);
   assert.equal(g.run('S.scr'),'multi');assert.equal(g.run('S.chapter.choices.issuance'),outcome);
   assert.equal(g.run('S.score'),150,'fictional outcome does not rescore the morning drill');
   assert.ok(!g.run('S.chapter.counter'));
   if(outcome==='issue'){
    assert.equal(g.run('S.chapter.badEnding'),'wrong_issue');
    g.run('resumeFamilyProgress();');assert.equal(g.run('S.chapter.view'),'bad');
    while(g.run('S.chapter.badPage<FAMILY_BAD_ENDINGS.wrong_issue.pages.length'))g.run('familyBadAdvance();');
    assert.ok(g.stage.innerHTML.includes('BAD END')&&g.stage.innerHTML.includes('ENDING 03'));
    g.run('familyBadRetry();');assert.equal(g.run('S.chapter.page'),page);
    assert.equal(g.run('S.chapter.choices.issuance'),undefined);
    assert.ok(!g.run('S.chapter.readHistory.some(e=>e.key.startsWith("daughter:log:"))'));
    g.run('chapterAdvance();');assert.equal(g.run('S.scr'),'play');assert.equal(g.run('S.fstage'),0);
   }else{
    assert.equal(g.run('S.chapter.page'),page+1);
    assert.equal(g.run('chapterPages(chapterNode("daughter"))[S.chapter.page].key'),'daughter-005');
    g.run('S.chapter.done.push("daughter");openChapterNode("daughter");S.chapter.page=4;startDaughterCounter();');
    assert.equal(g.run('S.scr'),'multi','completed scenes do not reopen the response');
   }
  }
  // Compressed passages map forward by key; an existing final deduction stays intact.
  for(const woman of ['ask','explain'])for(const key of ['safety-003','next_morning-006','next_morning-007','outside-005']){
   const g=boot();g.run(`startChapter();S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'${woman}'};
    S.chapter.node='${key.startsWith('safety')?'safety':key.startsWith('outside')?'outside':'next_morning'}';S.chapter.view='read';
    {const old=FAMILY_PRE_COUNTER[S.chapter.node].filter(p=>Object.entries(p.when||{}).every(([k,v])=>S.chapter.choices[k]===v));S.chapter.page=Math.max(0,old.findIndex(p=>p.key==='${key}'));S.chapter.progress[S.chapter.node]=S.chapter.page;}
    S.chapter.investigations.concealment={theory:'shared_contact',selected:['contact_card','woman_contact','woman_questions']};
    localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify({version:1,contentRevision:'sealed-letter-v1',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150}}));resumeFamilyProgress();`);
   assert.equal(g.run('S.chapter.investigations.concealment.theory'),'shared_contact');
   assert.ok(g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page]'));
   assert.equal(g.run('S.chapter.choices.issuance'),undefined,'older readers are not assigned a new answer');
   const once=g.run('S.chapter.page');g.run('saveFamilyProgress();resumeFamilyProgress();');assert.equal(g.run('S.chapter.page'),once);
  }
  console.log('PASS shared response/items/form/Excel/keypad/printed application, mid-operation reload, forged license, hold/issue endings, retry, readback lock, scoring isolation and saved-ending migration.');
 },

 'flow-links': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');

  const g=boot();
  g.run(`S=Object.assign(fresh(),{scr:'play',sound:false,queue:[CASES.findIndex(c=>c.id==='c9')],beats:[{t:'ask',si:1}]});run();
   answer(S.perm.findIndex(i=>!curCase().steps[beat().si].choices[i].ok));`);
  while(g.run('beat().feedback?.phase')!=='rule')g.run('advance();');
  assert.equal(g.run('currentFlowRef()'),'印-4');
  assert.ok(g.run('tipTextMarkup(textOf(beat()),beat())').includes('data-act="flow-ref" data-v="印-4"'));
  const progress=g.run('JSON.stringify([S.ci,S.bi,S.score,S.total,S.wait,S.hints,S.log.length,S.res])');

  // Click the actual action dispatched by an inline reference, then close with Escape.
  let prevented=false;
  const button={dataset:{act:'flow-ref',v:'印-4',flowCat:'印鑑'},closest:q=>q==='[data-act]'?button:null};
  g.fire('click',{target:button,preventDefault(){prevented=true;}});
  assert.ok(prevented);
  assert.equal(g.run('S.panel'),'ref');
  assert.equal(g.run('S.flowKey'),'印鑑');
  assert.equal(g.run('flowChart().nodes.find(n=>n.id===S.flowNode).label'),'印-4');
  assert.ok(g.stage.innerHTML.includes('解説へ戻る'));
  assert.ok(g.stage.innerHTML.includes('委任状では登録証を代替できない'));
  assert.equal(g.run('S.flowTarget'),g.run('S.flowNode'));

  // The target is scrolled into view horizontally and vertically, including on mobile.
  const viewport={clientWidth:320,clientHeight:140,scrollTop:0,scrollLeft:0};
  const elements={flowViewport:viewport,flowCanvas:{style:{}},flowSized:{style:{}},flowPercent:{textContent:''}};
  const getElement=g.context.document.getElementById;
  g.context.document.getElementById=id=>elements[id]||null;
  g.run('updateFlowView();');
  const node=JSON.parse(g.run('JSON.stringify(flowChart().nodes.find(n=>n.id===S.flowNode))'));
  assert.ok(node.left>=viewport.scrollLeft&&node.left+node.width<=viewport.scrollLeft+viewport.clientWidth);
  assert.ok(node.top>=viewport.scrollTop&&node.top+node.height<=viewport.scrollTop+viewport.clientHeight);
  g.context.document.getElementById=getElement;
  g.fire('keydown',{key:'Escape',preventDefault(){}});
  assert.equal(g.run('S.panel'),null);
  assert.equal(g.run('JSON.stringify([S.ci,S.bi,S.score,S.total,S.wait,S.hints,S.log.length,S.res])'),progress);

  // All question references resolve, including compound and named branches.
  for(const c of JSON.parse(g.run('JSON.stringify(CASES)'))){
   for(const st of c.steps){
    const full=`【${st.ref}】${st.rule||st.fb||''}`;
    const runs=JSON.parse(g.run(`JSON.stringify(flowReferenceRuns(${JSON.stringify(full)},${JSON.stringify({ref:st.ref,cat:c.cat})}))`));
    assert.equal(runs.map(r=>r.text).join(''),full);
    assert.ok(runs.some(r=>r.ref===st.ref),`${c.id}: ${st.ref} must be clickable`);
    g.run(`openFlowReference(${JSON.stringify(st.ref)},${JSON.stringify(c.cat)});`);
    assert.ok(g.run('S.flowNode!==null'));
    g.run('closeFlow();');
   }
  }
  for(const [ref,cat,label,key] of [
   ['共-2','印鑑','共-2','共通'],['印-生年月日','印鑑','印-生年月日','印鑑'],
   ['共-6〜8','住民票','帳票','住民票'],['印-発行','印鑑','発行','印鑑'],
   ['検索','住民票','住-1','住民票'],['第三者書類','住民票','第三者書類','住民票'],
   ['附-戸籍','附票','附-戸籍','附票'],['共-8','戸籍','共-8','戸籍'],
   ['共-8','印鑑','会計','印鑑']
  ]){
   const d=JSON.parse(g.run(`JSON.stringify(flowDestination(${JSON.stringify(ref)},${JSON.stringify(cat)}))`));
   assert.equal(d.node.label,label);assert.equal(d.chart.key,key);
  }

  // Multiple references link independently; unknown or ordinary story text stays plain.
  const multiple=g.run(`feedbackTextHTML('【印-1】本人分 → 印-登録証。本人以外 → 印-4。',{cat:'印鑑'})`);
  for(const ref of ['印-1','印-登録証','印-4'])assert.ok(multiple.includes(`data-v="${ref}"`));
  assert.ok(g.run(`feedbackTextHTML('共-7 発行',{cat:'印鑑'})`).includes('data-v="共-7"'));
  assert.ok(!g.run(`feedbackTextHTML('【印-40】印-40',{cat:'印鑑'})`).includes('data-act'));
  assert.equal(g.run(`feedbackTextHTML('印-4 <script>',null)`),'印-4 &lt;script&gt;');

  // A historical common reference keeps its original category, even after moving on.
  g.run(`S.panel='log';openFlowReference('共-8','戸籍');`);
  assert.equal(g.run('S.flowKey'),'戸籍');
  assert.ok(g.stage.innerHTML.includes('ログへ戻る'));
  g.run('chooseFlow("印鑑");openFlow();closeFlow();');
  assert.equal(g.run('S.panel'),'log');
  assert.ok(g.run('panelHTML()').includes('data-v="印-4"'));
  g.run('S.panel=null;');
  const history=boot();
  history.run('S='+g.run('JSON.stringify(S)')+';S.beats.push({t:"say",w:"n",x:"応対を続ける。"});advance();');
  assert.ok(history.run('conversationHistoryHTML()').includes('data-act="flow-ref"'));
  assert.ok(g.run('endHTML()').includes('data-v="印-4"'));

  // Partial reference text is not interactive until its entire code is visible.
  const partial={textContent:'',hidden:false},link={hidden:true};
  const run={dataset:{start:'1',length:'3',ref:'印-4'},querySelector:q=>q==='.tip-partial'?partial:link};
  const el={dataset:{},querySelectorAll:()=>[run]};
  g.context.probe=el;
  g.run(`paintStoryText(probe,'【印-4】確認',3,beat());`);
  assert.equal(partial.textContent,'印-');assert.equal(link.hidden,true);
  g.run(`paintStoryText(probe,'【印-4】確認',4,beat());`);
  assert.equal(link.hidden,false);assert.equal(partial.hidden,true);

  // Opening the diagram mid-line pauses the typewriter, then resumes the same line.
  g.setReducedMotion(false);
  g.run('S.done=false;GAME_READER.reset();render();');g.tickTyping();
  const typed=g.run('GAME_READER.snapshot().shown');
  g.run(`openFlowReference('印-4','印鑑');`);g.tickTyping();
  assert.equal(g.run('GAME_READER.snapshot().shown'),typed);
  g.run('closeFlow();');g.tickTyping();
  assert.equal(g.run('GAME_READER.snapshot().shown'),typed+1);
  assert.equal(g.run('JSON.stringify([S.ci,S.bi,S.score,S.total,S.wait,S.hints,S.log.length,S.res])'),progress);

  g.run(`S.mode='story';`);
  assert.equal(g.run(`feedbackTextHTML('【印-4】確認',{cat:'印鑑'})`),'【印-4】確認');
  console.log('PASS inline reference click/Escape, 46 reference destinations, mobile scroll target, exact aliases, history/log/result links, typewriter pause/resume, unchanged progress and scores.');
 },

 'story-counter': function(require,module,__filename,__dirname){
  const {boot,completePc,assert}=require('./test-harness.cjs');
  function toStoryCounter(g){
   g.run('startChapter();openChapterNode("r0");');
   let count=0;
   while(g.run('S.scr')!=='play'){assert.ok(++count<30);g.run('chapterAdvance();');}
  }
  for(const mode of ['correct','wrong','hint']){
   const g=boot();toStoryCounter(g);
   assert.ok(!g.run('S.beats.some(b=>b.t==="leave"||b.w==="s")'),'story response never leaves the building or invites the mentor');
   assert.ok(!g.run('S.beats.some(b=>b.x&&IDREQ.includes(b.x))'),'ID already presented in r0 is not requested again');
   let count=0,questions=0,feedback=0;
   while(g.run('S.scr')==='play'){
    assert.ok(++count<150);
    const type=g.run('beat().t');
    if(type==='ask'){
     questions++;
     assert.ok(g.run('choicesHTML()').includes('フローを確認 · 50点まで'));
     assert.ok(!g.run('choicesHTML()').includes('真鍋'));
     if(mode==='hint'){
      g.run('useHint();');
      assert.ok(!g.run('choicesHTML()').includes('mini'));
      assert.equal(g.run('S.log.at(-1).n'),'業務フロー');
     }
     g.run(mode==='wrong'?'answer(S.perm.findIndex(i=>!curCase().steps[beat().si].choices[i].ok));':'answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
    }else if(type==='pc')completePc(g);else g.run('advance();');
    if(g.run('S.scr')==='play'&&g.run('!!beat()?.feedback')){
     feedback++;
     assert.equal(g.run('beat().w'),'f');assert.equal(g.run('nameOf(beat())'),'業務フロー');
     assert.equal(g.stage.dataset.scene,'scene-paperwork');assert.equal(g.run('normalMotionKey()'),'');
     assert.ok(!g.run('mwHTML()').includes('真鍋'));
     assert.ok(!g.run('OK_OPEN.concat(NG_OPEN).some(x=>beat().x.startsWith(x))'));
     if(mode==='hint')assert.ok(g.run('feedbackHTML(beat().feedback)').includes('フロー参照あり'));
    }
   }
   assert.equal(questions,2);assert.ok(feedback>=2);
   assert.equal(g.run('S.score'),{correct:200,wrong:0,hint:100}[mode]);
   assert.equal(g.run('S.chapter.node'),'r1');
   assert.ok(!g.run('S.chapter.readHistory.some(e=>e.key.startsWith("r2:log:")&&e.n===SENPAI_NAME)'));
   g.run('S.scr="title";resumeFamilyProgress();');
   assert.equal(g.run('S.chapter.node'),'r1');
   const pages=JSON.parse(g.run('JSON.stringify(chapterPages(chapterNode("r1")))'));
   const dropped=pages.findIndex(p=>p.key==='r1-003');
   const introduced=pages.findIndex(p=>p.text.includes('「黒瀬修一です。'));
   assert.ok(dropped>=0&&introduced>dropped,'the anonymous helper picks up the ticket before introducing himself');
   assert.ok(pages.slice(0,introduced).every(p=>!p.text.includes('黒瀬')),'the protagonist does not know the name before the introduction');
  }
  // Rereading the generated morning summary must not invalidate the new save.
  const summary=boot();summary.run('startChapter();S.chapter.done=["r0","r2"];openChapterNode("r2");saveFamilyProgress();');
  assert.ok(summary.run('readFamilySave()'),'training summary has a stable save identity');
  summary.run('S.scr="title";resumeFamilyProgress();');assert.equal(summary.run('S.chapter.node'),'r2');
  summary.run('openChapterNode("r1");saveFamilyProgress();');assert.ok(summary.run('readFamilySave()'),'training history remains resumable later');
  // Ordinary mode keeps Manabe's support and scoring.
  const n=boot();n.run('startGame();S.queue=[CASES.findIndex(c=>c.id==="c11")];S.ci=0;S.beats=caseBeats(false);S.bi=0;run();');
  while(n.run('beat().t')!=='ask')n.run('advance();');
  assert.ok(n.run('choicesHTML()').includes('相談する · 50点まで'));
  n.run('useHint();answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
  assert.equal(n.run('beat().w'),'s');assert.equal(n.run('nameOf(beat())'),'真鍋');assert.equal(n.run('S.score'),50);
  // Repair only the story's old training feedback, retaining the real opening scene.
  const m=boot();m.run(`startChapter();S.chapter.readHistory=[
   {key:'r0:1',n:'あなた',x:'真鍋さんは開庁前に話した。'},
   {key:'r2:log:3',n:'真鍋',x:OK_OPEN[1]+'本人の請求。',feedback:{ok:true,phase:'reason',consulted:true}},
   {key:'r2:log:4',n:'真鍋',x:'ヒント：広域用セル。'}];
   migrateCounterTranscript(S.chapter);`);
  assert.equal(m.run('S.chapter.readHistory[0].x'),'真鍋さんは開庁前に話した。');
  assert.equal(m.run('S.chapter.readHistory[1].n'),'業務フロー');assert.equal(m.run('S.chapter.readHistory[1].x'),'本人の請求。');
  assert.equal(m.run('S.chapter.readHistory[1].feedback.hintSource'),'flow');
  assert.equal(m.run('S.chapter.readHistory[2].x'),'フローの確認：広域用セル。');
  console.log('PASS story feedback/hints/readback without Manabe, same scores/forms, no premature goodbye, dropped-ticket introduction, ordinary mentor retained, and old transcript repair.');
 },

 'training-clarity': function(require,module,__filename,__dirname){
  const {boot,completePc,assert}=require('./test-harness.cjs');
  const g=boot();
  const chart=g.run('FLOW_CHARTS.find(g=>g.key==="印鑑")');
  // Follow the displayed arrows for materially different document combinations.
  function follow(answers){
   let id='0';const path=[];
   while(true){
    const node=chart.nodes.find(n=>n.id===id);assert.ok(node);path.push(node.label);
    const edges=chart.edges.filter(e=>e.fromId===id);
    if(!edges.length)break;
    const edge=edges.length===1?edges[0]:edges.find(e=>e.label===answers[node.label]);
    assert.ok(edge,`Missing route from ${node.label}`);
    assert.ok(chart.svg.includes(`data-from="${edge.fromId}" data-to="${edge.toId}"`),'route is drawn');
    id=edge.toId;assert.ok(path.length<30,'no cycle');
   }
   return path;
  }
  for(const who of ['本人','本人以外']){
   const path=follow({'印-1':who});
   assert.ok(path.includes('登録証')&&path.includes('会計'));
   assert.ok(!path.includes('省略')&&!path.includes('不足'));
  }
  assert.ok(!chart.nodes.some(n=>n.ref==='印-3'),'omission exception is not taught');

  // Play all three seal cases through the actual form, questions and handover.
  // Every displayed document set includes a registration card; no case routes to
  // a missing-document handout, and the requested copy count reaches the form.
  for(const id of ['c7','c8','c9']){
   const n=boot();
   n.run(`startGame();S.queue=[CASES.findIndex(c=>c.id==='${id}')];S.ci=0;S.beats=caseBeats(false);S.bi=0;run();`);
   assert.equal(n.run('curCase().end.tag'),'ok');
   assert.ok(n.run('curCase().visitor.docs.some(d=>d.includes("印鑑登録証"))'));
   assert.ok(!n.run('S.beats.some(b=>b.t==="handout")'));
   assert.ok(!n.run('JSON.stringify(S.beats)').match(/登録証.{0,8}忘|省略条件|家に置いて|持ち物を案内してお帰り/));
   const expected=n.run('curCase().steps.length');
   let turns=0,questions=0,pc=0;
   while(n.run('S.scr')==='play'){
    assert.ok(++turns<250,id+' completes');
    const type=n.run('beat().t');
    if(type==='ask'){
     questions++;
     n.run('answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
    }else if(type==='pc'){
     pc++;
     assert.equal(n.run('FORMS[curCase().id].certs[0].n'),id==='c8'?2:1);
     completePc(n);
    }else n.run('advance();');
   }
   assert.equal(questions,expected);assert.equal(pc,1);
   assert.equal(n.run('S.score'),expected*100);assert.equal(n.run('S.scr'),'end');
  }

  // Correct-answer reference opens the new normal flow without changing scores.
  g.run(`S=Object.assign(fresh(),{scr:'play',mode:'normal',sound:false,queue:[CASES.findIndex(c=>c.id==='c8')],beats:[{t:'ask',si:0}]});run();`);
  g.run('answer(S.perm.findIndex(i=>curCase().steps[0].choices[i].ok));');
  assert.equal(g.run('S.score'),100);
  g.run(`openFlowReference('印-登録証','印鑑');`);
  assert.equal(g.run('flowChart().nodes.find(n=>n.id===S.flowNode).label'),'印-登録証');
  assert.ok(g.stage.innerHTML.includes('通常の受付だけ'));
  assert.ok(g.stage.innerHTML.includes('用語・文章で確認・出典'));
  g.run('closeFlow();');assert.equal(g.run('S.score'),100);

  // The field itself defines the previously opaque terms, without opening a hint.
  g.run(`S=Object.assign(fresh(),{scr:'play',mode:'normal',sound:false,queue:[CASES.findIndex(c=>c.id==='c11')],beats:[{t:'pc'},{t:'say',w:'n',x:'次へ'}]});run();pcState().phase='excel';`);
  const form=g.run('pcExcelHTML()');
  assert.ok(form.includes('管内（本町本籍）')&&form.includes('広域（町外本籍）'));
  assert.ok(form.includes('今の住所では分けません'));
  assert.equal(g.run('CASES.reduce((n,c)=>n+c.steps.length,0)'),46);
  assert.ok(g.run('CASES.find(c=>c.id==="c6").steps[1].choices[0].t').includes('「死亡者」などの状態表示'));
  console.log('PASS normal seal routes, all three cases complete with forms/copy counts/scores, no omitted-registration route or stale dialogue; reference navigation; 46 question slots.');
 },

 'typed-counter': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();
  // JSON content, dialogue generation and form insertions cross the typed/legacy
  // boundary. Exercise every shipped case, not just the TypeScript examples.
  const ids=JSON.parse(g.run('JSON.stringify(CASES.map(c=>c.id))'));
  for(const id of ids){
   g.run(`S=Object.assign(fresh(),{queue:[CASES.findIndex(c=>c.id===${JSON.stringify(id)})],ci:0});`);
   for(const prologue of [false,true]){
    const beats=JSON.parse(g.run(`JSON.stringify(caseBeats(${prologue}))`));
    assert.equal(beats[0].t,'reset');assert.equal(beats.at(-1).t,'next');
    assert.equal(beats.filter(b=>b.t==='ask'||b.t==='order').length,g.run('curCase().steps.length'));
    for(const [i,b] of beats.entries()){
     assert.ok(Number.isFinite(b.clockAt)&&Number.isFinite(b.clockEnd));
     assert.ok(b.clockAt>=0&&b.clockEnd>=b.clockAt&&b.clockEnd<=1+1e-10);
     if(i)assert.ok(b.clockAt>=beats[i-1].clockAt);
     if(b.t==='say')assert.equal(typeof b.x,'string');
    }
    assert.ok(Math.abs(beats.at(-1).clockEnd-1)<1e-10);
   }
   g.run('for(let si=0;si<curCase().steps.length;si++)for(const b of formBeats(si)){if(b.t==="say"&&typeof b.x!=="string")throw new Error("Invalid form dialogue");}');
  }
  const saved=value=>JSON.parse(g.run(`JSON.stringify(familySavedScores(${value}))`));
  assert.deepEqual(saved('undefined'),{});
  assert.deepEqual(saved('{score:100,cs:{住民票:{ok:1,n:2}},misses:[{title:"架空の事例",inc:true}],panel:"injected",chapter:{node:"injected"}}'),{score:100,cs:{住民票:{ok:1,n:2}},misses:[{title:'架空の事例',inc:true}]});
  for(const value of ['null','[]','{score:"100"}','{score:-1}','{max:Infinity}','{score:0.5}','{cs:{住民票:{ok:2,n:1}}}','{cs:{unknown:{ok:0,n:0}}}','{misses:[{q:7}]}','{misses:[{inc:"true"}]}'])assert.equal(saved(value),null,value);
  assert.equal(g.run('clockMinutes("16:08")'),968);
  assert.equal(g.run('clockLabel(968)'), '16:08');
  console.log('PASS typed counter boundary: all 14 scripts, form inserts, monotonic clocks, score whitelist and rejection of malformed storage.');
 },

 'upstream-form': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');

  function start(g,id){
   g.run(`S=Object.assign(fresh(),{scr:'play',mode:'normal',sound:false,queue:[CASES.findIndex(c=>c.id==='${id}')],beats:[{t:'pc'},{t:'say',w:'n',x:'記入を依頼する'},{t:'form',v:2},{t:'say',w:'n',x:'記入済み'}]});run();
    pcState().query=pcBirthKeys(FORMS[curCase().id].app.birth)[0];pcSearch();pcSelect('app');`);
  }

  // Registry facts are available before Excel, for the selected certificate target.
  for(const [id,area] of [['c10','町内（管内）'],['c11','町外（管外）'],['c14','町内（管内）']]){
   const g=boot();start(g,id);
   assert.equal(g.run('pcRegistryHTML()'),'','do not associate registry data with an unselected target');
   g.run(`pcState().relation='self';`);
   const review=g.run('pcConfirmHTML()');
   assert.equal(g.run('pcState().phase'),'confirm');
   assert.ok(review.includes(g.run('FORMS[curCase().id].honseki.v'))&&review.includes(area));
   assert.ok(review.includes(g.run('FORMS[curCase().id].honseki.hitto')));
   g.run(`pcTransfer();pcState().quantity='1';`);
   assert.equal(g.run('pcState().phase'),'excel');
   if(id==='c11'){
    g.run(`pcState().lane='local';pcPrint();`);
    assert.equal(g.run('pcState().phase'),'excel','town residence does not imply local registry');
   }
   g.run(`pcState().lane=FORMS[curCase().id].certs[0].wide?'wide':'local';pcPrint();`);
   assert.equal(g.run('pcState().phase'),'done');
   assert.ok(g.run('formHTML()').includes(g.run('FORMS[curCase().id].honseki.v')));
  }

  // A third-party application starts with blank target fields, filled by the
  // applicant only after printing. Neither preview discloses registry information.
  {
   const g=boot();start(g,'c4');
   g.run(`pcState().relation='hand';`);
   assert.equal(g.run('pcRegistryHTML()'),'');
   assert.ok(!g.run('pcConfirmHTML()').includes('前田 一真'));
   g.run(`pcTransfer();`);
   assert.ok(g.run('pcExcelHTML()').includes('空欄（申請者が手書き）'));
   g.run(`pcState().quantity='1';pcPrint();`);
   assert.equal(g.run('S.fstage'),1);
   const blank=g.run('formHTML()');
   assert.ok(blank.includes('松本 隆'));
   assert.ok(!blank.includes('前田 一真')&&!blank.includes('コーポ栄201'));
   assert.ok(blank.includes('印字しない（現行運用）'));
   g.run('closeMaterial();advance();');
   assert.equal(g.run('S.fstage'),2);
   const filled=g.run('formHTML()');
   assert.ok(filled.includes('<span class="hand">前田 一真</span>'));
   assert.ok(filled.includes('コーポ栄201'));
   assert.ok(filled.includes('<span class="hand">松本 隆</span>'));
  }

  // Certificate content remains distinct from the application's registry field.
  {
   const g=boot();start(g,'c1');
   assert.ok(g.run('pcConfirmHTML()').includes('住民票に記載する項目'));
   assert.equal(g.run('pcRegistryHTML()'),'');
   g.run(`pcState().relation='self';pcState().items.mynum=true;pcTransfer();`);
   assert.equal(g.run('pcState().phase'),'confirm','unrequested personal-number output is still rejected');
   g.run(`pcState().items.mynum=false;pcTransfer();pcState().quantity='1';pcPrint();`);
   assert.ok(g.run('formHTML()').includes('印字しない（現行運用）'));
   assert.equal(g.run('CASES.length'),14);
   assert.equal(g.run('CASES.reduce((n,c)=>n+c.steps.length,0)'),46);
  }
  console.log('PASS registry facts before Excel; correct local/wide lane; third-party blank → handwritten target; separate certificate items; unchanged 14 cases / 46 questions.');
 },

 'visit-request': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();
  let questions=0;
  for(const id of JSON.parse(g.run('JSON.stringify(CASES.map(c=>c.id))'))){
   g.run(`S=Object.assign(fresh(),{scr:'play',sound:false,queue:[CASES.findIndex(c=>c.id===${JSON.stringify(id)})]});S.beats=caseBeats(true);`);
   const opening=g.run('S.beats.findIndex(b=>b.visitRequest)');
   for(let i=0;i<=opening;i++){
    g.run(`S.bi=${i};`);
    assert.equal(g.run('currentVisitRequest()'),null,'do not reveal the request before its dialogue: '+id);
   }
   g.run(`S.bi=${opening+1};`);
   assert.ok(g.run('visitRequestHTML()').includes('今回の用件'));
   for(const i of JSON.parse(g.run('JSON.stringify(S.beats.flatMap((b,i)=>b.t==="ask"||b.t==="order"?[i]:[]))'))){
    g.run(`S.bi=${i};`);questions++;
    assert.ok(g.run('currentVisitRequest()'),id+' question must retain the request');
   }
   g.run('S.bi=S.beats.findIndex(b=>b.t==="leave")+1;');
   assert.equal(g.run('currentVisitRequest()'),null,'clear after the visitor leaves');
  }
  assert.equal(questions,46);

  // A spoken quantity change updates only subsequent pages and never the base request.
  g.run(`S=Object.assign(fresh(),{scr:'play',sound:false,queue:[0]});S.beats=caseBeats(false);S.bi=S.beats.findIndex(b=>b.visitRequest?.changed);`);
  assert.equal(g.run('currentVisitRequest().quantity'),1);
  g.run('S.bi++;');
  assert.equal(g.run('currentVisitRequest().quantity'),2);
  assert.ok(g.run('visitRequestHTML()').includes('部数変更'));
  assert.equal(g.run('VISIT_REQUESTS.c1.quantity'),1);

  // Skipping to a question still captures the opening; answering keeps the request.
  g.run(`S=Object.assign(fresh(),{scr:'play',sound:false,queue:[8]});S.beats=caseBeats(false);run();advance();skip();`);
  assert.equal(g.run('beat().t'),'ask');
  assert.equal(g.run('currentVisitRequest().document'),'夫の印鑑証明');
  const request=g.run('JSON.stringify(currentVisitRequest())');
  g.run('answer(S.perm.findIndex(i=>!curCase().steps[beat().si].choices[i].ok));');
  assert.equal(g.run('JSON.stringify(currentVisitRequest())'),request);
  g.run(`S.ci=0;S.queue=[7];S.beats=caseBeats(false);S.bi=0;run();`);
  assert.equal(g.run('currentVisitRequest()'),null,'never carry the last visitor into the next case');

  // Neither the purpose display nor its source includes hidden twists or eligibility answers.
  assert.ok(!g.run('JSON.stringify(VISIT_REQUESTS)').match(/DV|支援措置|黒瀬|交付不可|広域交付/));
  assert.ok(!g.run('JSON.stringify(VISIT_REQUESTS.c13)').includes('帯広'));
  assert.equal(g.run('VISIT_REQUESTS.c8.quantity'),2,'the opening now explicitly requests two copies');
  assert.equal(g.run('VISIT_REQUESTS.c9.purpose'),undefined,'do not expose a purpose stored only in the form');
  g.run('S.scr="title";');assert.equal(g.run('visitRequestHTML()'),'');
  console.log('PASS request hidden before opening, visible at all 46 questions, retained through feedback, 1→2 quantity update, skip handling, visitor reset, no unspoken purpose or hidden-case spoilers.');
 },

},__filename);
