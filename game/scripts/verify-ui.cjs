// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const {runSuites}=require('./test-tools.cjs');

runSuites({
 'reduced-motion-screen': function(require){
  const {boot,assert}=require('./test-harness.cjs');
  for(const reducedMotion of [true,false]){
   const g=boot({width:390,reducedMotion});
   g.run('S=Object.assign(fresh(),{scr:"play",sound:false,queue:[0],beats:[{t:"ask",si:0}]});run();GAME_READER.finish();');
   assert.ok(g.stage.innerHTML.includes('aria-label="選択肢"'));
   if(reducedMotion)assert.ok(!g.stage.innerHTML.includes('class="cut-flash"'),'reduced motion never mounts an opaque screen transition');
  }
  const fs=require('node:fs'),path=require('node:path'),css=fs.readFileSync(path.join(__dirname,'../engine/shell.html'),'utf8');
  const rule=css.match(/\.cut-flash\{([^}]+)\}/)[1];
  assert.ok(rule.includes('opacity:0'),'a disabled/interrupted animation is transparent by default');
  assert.ok(rule.includes('z-index:5'),'transition stays below dialogue and controls');
  console.log('PASS reduced-motion choices remain visible; disabled transitions default transparent below UI.');
 },

 'mobile-form': function(require){
  const {boot,assert}=require('./test-harness.cjs');
  for(const mode of ['normal','story']){
   const g=boot({width:390});let html=g.stage.innerHTML,dialog=null,shown=0,closed=0;
   const classes=new Set();g.stage.classList={toggle(key,on){on?classes.add(key):classes.delete(key);}};
   Object.defineProperty(g.stage,'innerHTML',{get(){return html;},set(value){
    assert.ok(!dialog?.open,'an old top-layer dialog must close before replacing its DOM');
    html=value;dialog=value.includes('<dialog class="win pc-window')?{
     open:false,events:{},addEventListener(name,fn){this.events[name]=fn;},
     showModal(){assert.equal(this.open,false);this.open=true;shown++;},
     close(){this.open=false;closed++;},
     getBoundingClientRect(){return {left:0,top:0,right:390,bottom:844};},
     querySelectorAll(){return [];},focus(){}
    }:null;
   }});
   const get=g.context.document.getElementById;
   g.context.document.getElementById=id=>id==='win'?dialog:get(id);
   if(mode==='normal')g.run('S=Object.assign(fresh(),{scr:"play",sound:false,queue:[0],done:true,beats:[{t:"ask",si:0}],perm:[0,1,2]});render();');
   else g.run('startChapter();S.sound=false;S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf("daughter"));S.chapter.choices={envelope:"sealed",rescue:"stay"};openChapterNode("daughter");S.chapter.page=chapterPages(chapterNode("daughter")).findIndex(p=>p.decision==="issuance");render();startDaughterCounter();closeMaterial();');
   const before=g.run('JSON.stringify([S.bi,S.score,S.total,S.chapter?.node,S.chapter?.page,S.chapter?.choices,storyTime()])');
   g.run('openMaterial("term");pcState().query="1234567";');assert.equal(dialog.open,true);assert.ok(classes.has('has-overlay'));
   g.run('pcDraw();');assert.equal(dialog.open,true);assert.ok(shown>=2&&closed>=1,'rerender reuses one visible top layer');
   const button={dataset:{act:'winx'},closest(q){return q==='[data-act]'||q.startsWith('button')?this:q==='#win'||q==='.win'?dialog:null;}};
   g.fire('click',{target:button,preventDefault(){},stopPropagation(){}});
   assert.equal(g.run('S.win'),null);assert.equal(dialog,null);assert.ok(!classes.has('has-overlay'));
   assert.equal(g.run('pcState().query'),'1234567');
   assert.equal(g.run('JSON.stringify([S.bi,S.score,S.total,S.chapter?.node,S.chapter?.page,S.chapter?.choices,storyTime()])'),before);
   g.run('openMaterial("term");');let prevented=false;dialog.events.cancel({preventDefault(){prevented=true;}});
   assert.ok(prevented);assert.equal(g.run('S.win'),null);assert.ok(!classes.has('has-overlay'));
  }
  console.log('PASS normal/story native form modal open, redraw, button/cancel close, overlay cleanup, input and progress retention.');
 },

 'console-ui': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();
  function click(act,extra={}){
   const inPanel=!!g.run('S.panel'),button={dataset:{act,...extra},closest:q=>q==='.panel'&&inPanel?{}:null};
   g.fire('click',{target:{closest:q=>q==='[data-act]'?button:null},preventDefault(){},stopPropagation(){}});
  }
  const actions=html=>[...html.matchAll(/<button\b[^>]*data-act="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(actions(g.run('titleHTML()')),['snd','settings','start','family-entry']);
  click('settings');assert.equal(g.run('S.panel'),'settings');
  assert.equal(g.run('S.settingsTab'),'display');
  assert.ok(g.stage.innerHTML.includes('role="tablist"')&&g.stage.innerHTML.includes('role="tabpanel"'));
  assert.ok(!actions(g.run('gameSettingsHTML()')).includes('sound'),'no nested sound settings page');
  click('settings-tab',{v:'sound'});assert.equal(g.run('S.panel'),'settings');assert.equal(g.run('S.settingsTab'),'sound');
  assert.ok(g.stage.innerHTML.includes('id="audio-master"')&&!g.stage.innerHTML.includes('aria-label="画面の明るさ"'));
  assert.equal(g.run('CONSOLE_PANEL_TRAIL.length'),0,'tabs are not another menu layer');
  const tabKey=key=>g.fire('keydown',{key,target:{closest:q=>q==='.settings-tabs'?{}:null},preventDefault(){}});
  tabKey('ArrowLeft');assert.equal(g.run('S.settingsTab'),'display');
  tabKey('End');assert.equal(g.run('S.settingsTab'),'sound');
  tabKey('Home');assert.equal(g.run('S.settingsTab'),'display');
  click('settings-tab',{v:'unknown'});assert.equal(g.run('S.settingsTab'),'display');
  click('sound');assert.equal(g.run('S.panel'),'settings');assert.equal(g.run('S.settingsTab'),'sound','legacy sound entry goes to the same frame');
  g.fire('keydown',{key:'Escape',preventDefault(){}});assert.equal(g.run('S.panel'),null);
  g.run("startChapter();openChapterNode('r0');");
  assert.deepEqual(actions(g.run('mysteryReadHTML()')).filter(a=>a!=='readback-current'),['clock-timeline','snd','chapter-menu','chapter-next'],'time opens the timeline without another toolbar button');
  const chapter=g.run('JSON.stringify(S.chapter)');
  const sceneHTML=g.stage.innerHTML,typed=g.run('JSON.stringify(GAME_READER.snapshot())');
  click('snd');assert.equal(g.run('S.sound'),false);assert.equal(g.stage.innerHTML,sceneHTML,'quick mute never rerenders the scene');assert.equal(g.run('JSON.stringify(GAME_READER.snapshot())'),typed,'quick mute preserves the active text reveal');assert.equal(g.run('JSON.stringify(S.chapter)'),chapter);
  click('snd');assert.equal(g.run('S.sound'),true);
  const beforeKey=g.run('S.sound');g.context.document.activeElement={closest:q=>q.split(',').some(s=>['button','[data-act]','[data-act="snd"]'].includes(s.trim()))?{}:null};
  g.fire('keydown',{key:'Enter',preventDefault(){}});assert.equal(g.run('S.sound'),beforeKey,'keyboard activation leaves the single toggle to the native button click');g.context.document.activeElement=null;
  g.fire('keydown',{key:'Escape',preventDefault(){}});assert.equal(g.run('S.panel'),'chapter-menu');
  click('mystery-notes');assert.equal(g.run('S.panel'),'chapter-notes');click('close');assert.equal(g.run('S.panel'),'chapter-menu');
  click('settings');click('sound');
  for(const expected of ['chapter-menu',null]){click('close');assert.equal(g.run('S.panel'),expected);}
  assert.equal(g.run('JSON.stringify(S.chapter)'),chapter,'menus never change the story position or decisions');
  g.run("S.chapter.done=['r0','r2','r1'];openChapterNode('memo');S.chapter.page=chapterPages(chapterNode('memo')).findIndex(p=>p.decision==='envelope');render();");
  assert.equal(actions(g.run('mysteryReadHTML()')).filter(a=>a==='family-branch').length,2);
  assert.ok(!actions(g.run('mysteryReadHTML()')).includes('chapter-next'),'no duplicate advance beside an unresolved choice');
  g.fire('keydown',{key:'1',preventDefault(){}});assert.equal(g.run('S.chapter.choices.envelope'),'sealed');

  g.run("startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('daughter'));S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('daughter');S.chapter.page=4;render();startDaughterCounter();");
  const before=g.run('JSON.stringify([S.bi,S.chapter.page,S.score,S.total])');
  assert.deepEqual(actions(g.run('quietTransportHTML()')).filter(a=>a!=='readback-current'),['desk','desk','advance']);
  assert.deepEqual(actions(g.run('quietHudHTML()')),['clock-timeline','snd','menu']);
  g.run('S.materialsExpanded=true;render();');assert.equal(g.stage.dataset.shelf,'closed','old shelf state does not reserve a fourth layout row');
  click('desk',{group:'presented'});assert.equal(g.run('S.panel'),null);
  assert.ok(!g.stage.innerHTML.includes('document-group'),'no intermediate category chooser');
  assert.equal(g.run('S.zoom'),0);assert.equal(g.run('S.panel'),null);
  assert.ok(g.stage.innerHTML.includes('family-license-card'));
  g.run('closeMaterial();');assert.equal(g.run('S.panel'),null);assert.equal(g.run('JSON.stringify([S.bi,S.chapter.page,S.score,S.total])'),before);
  g.fire('keydown',{key:'Escape',preventDefault(){}});assert.equal(g.run('S.panel'),'menu');
  click('request');assert.ok(g.stage.innerHTML.includes('世帯主と続柄を記載。本籍・個人番号・住民票コードは不要'),'full spoken request remains available');
  click('close');assert.equal(g.run('S.panel'),'menu');click('close');assert.equal(g.run('S.panel'),null);
  assert.equal(g.run('JSON.stringify([S.bi,S.chapter.page,S.score,S.total])'),before);
  g.run('resumeAtDeduction();openChapterNode("r1");');
  assert.ok(g.run('mysteryReadHTML()').includes('data-v="deduction">最終推理へ'),'evidence readback has a direct way back');
  console.log('PASS unified settings tabs, keyboard switching, one-step return, minimal title/story/counter controls, pause/back navigation, menus preserve progress, branch keyboard selection, direct ID access, request details and deduction return.');
 },

 'material-groups-score': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();
  function click(act,extra={}){
   const button={dataset:{act,...extra},closest:q=>q==='.panel'&&g.run('!!S.panel')||q==='.zoom'&&g.run('S.zoom!==null')||q==='.win'&&g.run('!!S.win')?{}:null};
   g.fire('click',{target:{closest:q=>q==='[data-act]'||q.startsWith('button,')?button:q==='#zoom'&&g.run('S.zoom!==null')||q==='#win'&&g.run('!!S.win')?{}:null},preventDefault(){},stopPropagation(){}});
  }
  g.run(`S=Object.assign(fresh(),{scr:'play',queue:[0],visible:true,done:true,beats:[{t:'ask',si:0}],perm:CASES[0].steps[0].choices.map((_,i)=>i)});`);
  assert.equal(g.run('groupedMaterials("presented").length'),0);
  assert.ok(g.run('materialLaunchersHTML()').includes('未提示'));
  click('desk',{group:'presented'});assert.equal(g.run('S.zoom'),null);assert.ok(!g.run('S.win'),'unpresented documents cannot open');
  assert.ok(g.run('titleHTML()').includes('https://github.com/Memuro-Town/MADO'));
  assert.ok(g.run('titleHTML()').includes('公開資料を参考に制作'));
  assert.ok(g.run('titleHTML()').includes('非公式'));
  const caseIndex=g.run('CASES.findIndex(c=>c.visitor.docs.length>1)');assert.ok(caseIndex>=0);
  g.run(`S.queue=[${caseIndex}];S.docs=true;`);
  assert.ok(g.run('groupedMaterials("presented").every(m=>m.kind==="doc")'));
  assert.ok(g.run('groupedMaterials("work").every(m=>m.kind!=="doc")'));
  const state=g.run('JSON.stringify([S.bi,S.score,S.total,S.fstage,storyTime()])');
  // A single click opens the selected document, without a library/category dialog.
  click('desk',{group:'presented'});
  assert.equal(g.run('S.zoom'),0);assert.equal(g.run('S.panel'),null);
  assert.ok(g.stage.innerHTML.includes('id="zoom"'));assert.ok(!g.stage.innerHTML.includes('document-group'));
  click('zgo',{d:'1'});assert.equal(g.run('S.zoom'),1);
  click('zclose');assert.equal(g.run('S.panel'),null);assert.equal(g.run('S.zoom'),null);
  assert.equal(g.run('groupSelection("presented").item.key'),'doc:1');
  click('desk',{group:'presented'});assert.equal(g.run('S.zoom'),1,'reopen the document last read');click('zclose');
  // Work materials switch in their detail view, including the reference chart.
  click('desk',{group:'work'});assert.equal(g.run('S.win'),'term');assert.equal(g.run('S.panel'),null);
  g.run('pcState().query="1234567";');
  click('material-view-move',{d:'1'});assert.equal(g.run('S.win'),'form');
  click('material-view-move',{d:'1'});assert.equal(g.run('S.panel'),'ref');assert.equal(g.run('S.flowFrom'),'material');
  assert.ok(g.run('flowPanelHTML()').includes('data-act="material-view-move"'));
  click('material-view-move',{d:'1'});assert.equal(g.run('S.materialKey'),'guide','no wrap at the end');
  click('flow-close');assert.equal(g.run('S.panel'),null,'close returns to response, not another picker');
  click('desk',{group:'work'});assert.equal(g.run('S.panel'),'ref','remember the work item separately');
  click('material-view-move',{d:'-1'});assert.equal(g.run('S.win'),'form');assert.equal(g.run('S.panel'),null);
  click('material-view-move',{d:'-1'});assert.equal(g.run('S.win'),'term');
  assert.equal(g.run('pcState().query'),'1234567','switching retains PC input');
  click('material-view-move',{d:'-1'});assert.equal(g.run('S.win'),'term','no wrap at the start');
  g.fire('keydown',{key:'Escape',preventDefault(){}});assert.equal(g.run('S.win'),null);assert.equal(g.run('S.panel'),null);
  assert.equal(g.run('groupSelection("presented").item.key'),'doc:1','work browsing does not change the presented item');
  assert.equal(g.run('JSON.stringify([S.bi,S.score,S.total,S.fstage,storyTime()])'),state,'browsing never advances case, time or score');
  g.run('S.materialSelections.work="obsolete";');click('desk',{group:'work'});assert.equal(g.run('S.win'),'term');click('winx');
  for(const mode of ['correct','hint','wrong']){
   const t=boot();
   t.run(`S=Object.assign(fresh(),{scr:'play',queue:[0],visible:true,done:true,docs:true,beats:[{t:'ask',si:0}],perm:CASES[0].steps[0].choices.map((_,i)=>i),hint:${mode==='hint'}});`);
   t.run(`answer(S.perm.findIndex(i=>${mode==='wrong'?'!':''}curCase().steps[0].choices[i].ok));`);
   const points={correct:100,hint:50,wrong:0}[mode];
   assert.equal(t.run('S.score'),points);assert.equal(t.run('beat().feedback.points'),points);
   assert.ok(t.run('feedbackHTML(beat().feedback)').includes(`今回の獲得点 ${points}点`));
   assert.ok(t.run('quietHudHTML()').includes(`得点 ${points}点、1問中${mode==='wrong'?0:1}問正解`));
   const before=t.run('JSON.stringify([S.score,S.total,S.max])');t.run('render();openMaterialLibrary("work");closeMaterial();render();');assert.equal(t.run('JSON.stringify([S.score,S.total,S.max])'),before,'rendering never scores twice');
   t.run('S.mode="story";');assert.ok(!t.run('quietHudHTML()').includes('normal-score'));assert.ok(!t.run('feedbackHTML(beat().feedback)').includes('answer-points'));
  }
  assert.ok(g.run('feedbackHTML({ok:true,consulted:true})').includes('今回の獲得点 50点'),'old feedback without points migrates from outcome/hint flags');
  console.log('PASS one-click material opening, presentation gating, independent selections, bounds, input preservation, direct document/flow return, score visibility, 100/50/0 points, no duplicate scoring and story isolation.');
 },

 'material-swipe': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot({width:390});
  g.run(`S=Object.assign(fresh(),{scr:'play',queue:[CASES.findIndex(c=>c.visitor.docs.length>1)],docs:true,visible:true,done:true,beats:[{t:'ask',si:0}]});openMaterial('term');pcState().query='1234567';`);
  const before=g.run('JSON.stringify([S.bi,S.score,S.total,S.fstage,storyTime()])');
  function gesture({dx=-120,dy=0,blocked=false,cancel=false,multiple=false,cancelable=true,replace=false,long=false,verticalFirst=false}={}){
   const surface={isConnected:true};
   const target={closest(selector){return ['#win','#zoom','.flow-panel'].includes(selector)?surface:blocked?{}:null;}};
   const touch=(x,y,id=1)=>({identifier:id,clientX:x,clientY:y});
   let prevented=0;
   const event=(touches,changedTouches=touches)=>({target,touches,changedTouches,cancelable,preventDefault(){prevented++;}});
   g.fire('touchstart',event([touch(200,220)]));
   if(long)g.run('if(materialSwipe)materialSwipe.started-=1000;');
   if(replace)surface.isConnected=false;
   if(verticalFirst)g.fire('touchmove',event([touch(204,260)]));
   g.fire('touchmove',event(multiple?[touch(200+dx,220+dy),touch(220,250,2)]:[touch(200+dx,220+dy)]));
   if(cancel)g.fire('touchcancel',event([]));
   g.fire('touchend',event([],[touch(200+dx,220+dy)]));
   return prevented;
  }
  gesture();assert.equal(g.run('S.win'),'form','left swipe opens next work material');
  // A synthetic click after the touch must neither close the new paper nor advance play.
  let stopped=false;
  g.fire('click',{detail:1,target:{closest:()=>null},preventDefault(){stopped=true;},stopPropagation(){}});
  assert.ok(stopped);assert.equal(g.run('S.win'),'form');
  gesture();assert.equal(g.run('S.panel'),'ref');assert.equal(g.run('S.flowFrom'),'material');
  gesture();assert.equal(g.run('S.materialKey'),'guide','swipes stop at the end of the work group');
  gesture({dx:120});assert.equal(g.run('S.win'),'form');assert.equal(g.run('S.panel'),null);
  gesture({dx:120});assert.equal(g.run('S.win'),'term');
  gesture({dx:120});assert.equal(g.run('S.win'),'term','no wrap at the start');
  assert.equal(g.run('pcState().query'),'1234567','PC inputs survive swipe navigation');
  for(const options of [
   {dx:0,dy:140},{dx:80,dy:100},{dx:-20},{blocked:true},{cancel:true},
   {multiple:true},{cancelable:false},{replace:true},{long:true},{verticalFirst:true}
  ]){
   gesture(options);assert.equal(g.run('S.win'),'term',JSON.stringify(options)+' must not switch materials');
  }
  assert.equal(gesture({dx:0,dy:120}),0,'vertical scrolling is never prevented');
  assert.equal(gesture({blocked:true}),0,'controls and chart scrolling stay native');
  assert.equal(gesture({multiple:true}),0,'pinch zoom stays native');
  g.run("openMaterial('guide');");gesture({blocked:true});assert.equal(g.run('S.panel'),'ref','chart panning never changes the document');
  g.run("closeFlow();openFlow('menu');");gesture();assert.equal(g.run('S.panel'),'ref','the standalone chart has no material swipe');
  g.run("S.panel=null;openMaterial('doc:0');");
  gesture();assert.equal(g.run('S.zoom'),1,'presented documents swipe within their own group');
  g.run('S.zoom=curCase().visitor.docs.length-1;');gesture();assert.equal(g.run('S.zoom'),g.run('curCase().visitor.docs.length-1'),'presented swipes stop at the last document');
  g.run('S.zoom=0;');gesture({dx:120});assert.equal(g.run('S.zoom'),0);
  g.run('movePresentedMaterial(-1);');assert.equal(g.run('S.zoom'),g.run('curCase().visitor.docs.length-1'),'existing arrow behavior is retained');
  g.run("closeMaterial();openMaterial('term');");
  assert.equal(g.run('groupSelection("presented").index'),g.run('curCase().visitor.docs.length-1'),'group selections are independent');
  assert.equal(g.run('JSON.stringify([S.bi,S.score,S.total,S.fstage,storyTime()])'),before,'gestures do not change the response, score or clock');
  // The story counter uses the same viewer, including its single presented ID.
  g.run("startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('daughter'));S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('daughter');S.chapter.page=4;render();startDaughterCounter();openMaterial('term');");
  const storyState='JSON.stringify([Object.fromEntries(Object.entries(S.chapter).filter(([key])=>key!=="counter")),S.bi,S.score,S.total,S.fstage,storyTime()])';
  const story=g.run(storyState);
  gesture();assert.equal(g.run('S.win'),'form');
  g.run("openMaterial('doc:0');");gesture();assert.equal(g.run('S.zoom'),0,'a single ID stays open');
  assert.equal(g.run(storyState),story);
  console.log('PASS material swipes, separate groups, bounds, PC input retention, ghost-click prevention, native scrolling/controls/pinch, cancellation and normal/story progress preservation.');
 },

 'quantity-keypad': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();
  assert.deepEqual(Array.from(g.run('pcQuantityKeypadHTML()').matchAll(/data-v="([^"]+)"/g),m=>m[1]),['1','2','3','4','5','6','7','8','9','clear','0','backspace'],'phone keypad has 1 at the top left');
  g.run(`S=Object.assign(fresh(),{scr:'play',sound:false,queue:[0],win:'term',beats:[{t:'pc'},{t:'say',w:'n',x:'印刷を確認する。'}],score:200,total:3,wait:3});pcState().phase='excel';render();`);
  const progress=g.run('JSON.stringify([S.bi,S.score,S.total,S.wait,S.hints,S.fstage])');
  const input={id:'pcQuantity',dataset:{pcInput:'quantity'},value:'',selectionStart:0,selectionEnd:0,setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}};
  const status={textContent:''};let feedbackRemoved=0;
  const originalGet=g.context.document.getElementById;
  g.context.document.getElementById=id=>id==='pcQuantity'?input:id==='pcQuantityStatus'?status:id==='pcFeedback'?{remove(){feedbackRemoved++;}}:null;
  const key=k=>g.run(`pcAction('quantity-key',${JSON.stringify(k)});`);
  const count=()=>g.run('pcState().quantity');

  // Real click dispatch must update the field without closing the PC or rerendering it.
  const originalHTML=g.stage.innerHTML;
  const button={dataset:{act:'pc',pc:'quantity-key',v:'1'},closest:q=>q==='#win'||q==='.win'?{}:q==='[data-act]'||q.startsWith('button')?button:null};
  g.fire('click',{target:button});
  assert.equal(count(),'1');assert.equal(input.value,'1');assert.equal(g.run('S.win'),'term');
  assert.equal(g.stage.innerHTML,originalHTML,'key presses must not replace the focused UI');
  key('2');key('3');assert.equal(count(),'123');
  key('4');assert.equal(count(),'123');assert.ok(status.textContent.includes('3桁'));
  key('backspace');assert.equal(count(),'12');
  key('clear');assert.equal(count(),'');key('backspace');assert.equal(count(),'');
  for(const digit of '0123456789'){key('clear');key(digit);assert.equal(count(),digit);}

  // Physical typing, then keypad insertion or replacement at the selected position.
  input.value='12';input.setSelectionRange(2,2);
  g.fire('focusin',{target:input});g.fire('input',{target:input});
  assert.equal(count(),'12');key('3');assert.equal(count(),'123');
  input.setSelectionRange(1,3);key('9');assert.equal(count(),'19');
  input.setSelectionRange(1,1);key('4');assert.equal(count(),'149');
  input.setSelectionRange(1,2);key('backspace');assert.equal(count(),'19');
  input.setSelectionRange(0,0);key('backspace');assert.equal(count(),'19');
  key('clear');

  // After reopening, append by default instead of inserting at the input's initial caret 0.
  input.value='12';input.dataset.quantityCaret=undefined;input.setSelectionRange(0,0);
  g.fire('input',{target:input});key('3');assert.equal(count(),'123');

  // Quantity correction clears stale feedback; invalid quantities still cannot print.
  key('clear');key('2');g.run('pcPrint();');assert.equal(g.run('pcState().phase'),'excel');
  assert.ok(g.run('pcState().feedback').includes('1通'));
  key('clear');key('1');assert.equal(g.run('pcState().feedback'),'');assert.ok(feedbackRemoved>0);
  assert.equal(g.run('JSON.stringify([S.bi,S.score,S.total,S.wait,S.hints,S.fstage])'),progress);
  key('bad');assert.equal(count(),'1');
  g.run(`pcState().view='notes';`);key('2');assert.equal(count(),'1');
  g.run(`pcState().view='work';pcState().phase='confirm';`);key('2');assert.equal(count(),'1');
  g.run(`pcState().phase='excel';S.win=null;`);key('2');assert.equal(count(),'1');
  g.run(`S.win='term';S.panel='menu';`);key('2');assert.equal(count(),'1');
  g.run('S.panel=null;');
  g.context.document.getElementById=originalGet;
  assert.equal(g.run('pcPrint()'),true);
  assert.equal(g.run('S.win'),'form');assert.equal(g.run('S.bi'),1);assert.equal(g.run('S.score'),200);

  // Both modes use the shared keypad; every key is a non-submitting accessible button.
  for(const mode of ['normal','story']){
   g.run(`S.mode=${JSON.stringify(mode)};`);
   const markup=g.run('pcQuantityKeypadHTML()');
   assert.equal((markup.match(/type="button"/g)||[]).length,12);
   assert.equal((markup.match(/aria-controls="pcQuantity"/g)||[]).length,12);
   assert.ok(markup.includes('部数をすべて消す'));assert.ok(markup.includes('部数を1文字消す'));
  }
  console.log('PASS keypad click, all digits, 3-digit limit, backspace/clear, keyboard mixing, caret selection, reopening, guards, validation/printing, stable UI and unchanged scoring.');
 },

 'reading-interaction': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  function element(selectors=[],parent=null,dataset={}){
   const el={dataset,focus(){},matches:q=>q.split(',').some(s=>selectors.includes(s.trim()))};
   el.closest=q=>el.matches(q)?el:parent?.closest(q)||null;
   return el;
  }
  function setup(mode='story'){
   const g=boot({reducedMotion:false});let cachedHTML='',cached,selection='',reading=false;
   const current={getBoundingClientRect:()=>({top:600-area.scrollTop}),focus(){}};
   const area={scrollTop:600,clientTop:0,dataset:{readingKey:'test'},getBoundingClientRect:()=>({top:0}),querySelector:()=>current,querySelectorAll:()=>[]};
   g.context.window.getSelection=()=>selection;
   g.context.document.getElementById=id=>{
    if(reading&&(id==='chapterReading'||id==='readingArea'))return area;
    if(id!=='familyStoryText')return null;
    const html=g.stage.innerHTML.match(/<p id="familyStoryText"[\s\S]*?<\/p>/)?.[0];
    if(!html)return null;if(html===cachedHTML)return cached;cachedHTML=html;
    const dataset=Object.fromEntries([...html.matchAll(/data-novel-([\w-]+)="([^"]*)"/g)].map(([,k,v])=>['novel'+k[0].toUpperCase()+k.slice(1),decode(v)]));
    const parts={'.family-accessible':{textContent:decode(html.match(/<span class="family-accessible">([\s\S]*?)<\/span>/)[1])},'[data-novel-visible]':{textContent:''},'[data-novel-rest]':{textContent:''}};
    cached={dataset,querySelector:q=>parts[q],classList:{toggle(){}}};return cached;
   };
   if(mode==='story')g.run('startChapter();openChapterNode("r0");');
   else g.run('startGame();S.bi=S.beats.findIndex(b=>b.t==="say");run();');
   const stage=element(['#stage']),surface=mode==='story'?element(['.multi-reader','.noadv'],stage):stage;
   const text=element(['#familyStoryText'],surface);
   const event=(target,extra={})=>({target,clientX:500,clientY:200,pointerId:1,isPrimary:true,button:0,detail:1,preventDefault(){this.prevented=true;},stopPropagation(){},...extra});
   const tap=(target=surface,extra={})=>{g.fire('pointerdown',event(target,extra));g.fire('pointerup',event(target,extra));g.fire('click',event(target,extra));};
   const key=(value,target=null)=>{g.context.document.activeElement=target;const e=event(target||surface,{key:value});g.fire('keydown',e);return e;};
   const position=()=>g.run('JSON.stringify([S.scr,S.bi,S.chapter?.view,S.chapter?.node,S.chapter?.page,S.chapter?.badPage,S.chapter?.readingSlice?.offset])');
   const finish=()=>g.run(mode==='story'?'GAME_READER.setSpeed("instant");':'finishTyping();');
   return {...g,surface,text,area,event,tap,key,position,finish,select:v=>selection=v,readback(){reading=true;area.scrollTop=200;}};
  }

  // Actual click dispatch reaches exactly one reveal/advance in both modes.
  for(const mode of ['normal','story']){
   const g=setup(mode),before=g.position();
   g.tap();assert.equal(g.position(),before,mode+': first background tap reveals the current text');
   assert.equal(g.run(mode==='story'?'GAME_READER.revealing()':'typing()'),false);
   g.tap();assert.notEqual(g.position(),before,mode+': second background tap advances');
   const text=setup(mode),control=setup(mode);text.finish();control.finish();
   text.tap(text.text);control.run(mode==='story'?'chapterAdvance();':'advance();');
   assert.equal(text.position(),control.position(),mode+': text tap performs exactly one forward action');
   for(const value of ['Enter',' ']){
    const keyboard=setup(mode),prior=keyboard.position();keyboard.key(value);
    assert.equal(keyboard.position(),prior,mode+': '+value+' first reveals');
    keyboard.key(value);assert.notEqual(keyboard.position(),prior,mode+': '+value+' then advances');
   }
   // Move away and back, cancel, scroll, select text, and a stale click after a
   // different cut are deliberately distinct from a tap.
   for(const gesture of ['drag','cancel','scroll','selection','changed-page']){
    const t=setup(mode);t.finish();if(gesture==='scroll'){t.readback();t.area.scrollTop=600;}
    t.fire('pointerdown',t.event(t.surface));
    if(gesture==='drag'){t.fire('pointermove',t.event(t.surface,{clientY:250}));t.fire('pointermove',t.event(t.surface));}
    if(gesture==='cancel')t.fire('pointercancel',t.event(t.surface));
    if(gesture==='scroll'){t.area.scrollTop=200;t.fire('scroll',{target:t.area});t.area.scrollTop=600;}
    if(gesture==='selection')t.select('選択した文章');
    if(gesture==='changed-page')t.run(mode==='story'?'chapterAdvance();':'advance();');
    const before=t.position();t.fire('click',t.event(t.surface));
    assert.equal(t.position(),before,mode+': '+gesture+' must not advance');
   }
   const back=setup(mode);back.finish();back.readback();const prior=back.position();
   back.tap();assert.equal(back.area.scrollTop,600,mode+': first scrollback background tap returns to current text');
   assert.equal(back.position(),prior,mode+': returning from scrollback never advances');
   back.tap();assert.notEqual(back.position(),prior,mode+': another tap advances after returning');

   for(const selector of ['a','input','select','textarea','summary','[contenteditable]:not([contenteditable="false"])','[role="slider"]']){
    const t=setup(mode);t.finish();const control=element([selector],t.surface),before=t.position();
    t.tap(control);assert.equal(t.position(),before,mode+': clicking '+selector+' is not forward');
    for(const value of ['Enter',' ']){
     const e=t.key(value,control);assert.equal(t.position(),before,mode+': focused '+selector+' keeps '+value);
     assert.ok(!e.prevented,mode+': native control activation is not prevented');
    }
   }
   for(const overlay of ['S.panel="settings"','S.panel="log"','S.win="term"','S.zoom=0']){
    const t=setup(mode);t.finish();t.run(overlay);const before=t.position();t.tap();
    assert.equal(t.position(),before,mode+': overlays block underlying taps');
   }
   const protectedArea=setup(mode);protectedArea.finish();const protectedBefore=protectedArea.position();
   protectedArea.tap(element(['.noadv'],protectedArea.surface));
   assert.equal(protectedArea.position(),protectedBefore,mode+': nested history/doc/choice regions stay protected');
   protectedArea.tap(element(['.conversation-past'],protectedArea.surface));
   assert.equal(protectedArea.position(),protectedBefore,mode+': tapping an earlier paragraph never advances');
  }

  // Explicit story boundaries stay explicit even if a reading surface is present.
  for(const view of ['chapter','timeline','bridge','end']){
   const g=setup();g.finish();g.run(`S.chapter.view=${JSON.stringify(view)};`);const before=g.position();g.tap();
   assert.equal(g.position(),before,view+': background cannot start or dismiss this screen');
  }
  const puzzle=setup();puzzle.finish();puzzle.run('S.chapter.node=SCENARIO.review.deduction;');const puzzleBefore=puzzle.position();puzzle.tap();
  assert.equal(puzzle.position(),puzzleBefore,'deduction background never submits or changes a question');

  const decision=setup();decision.run(`S.chapter.node='memo';S.chapter.page=chapterPages(chapterNode('memo')).findIndex(p=>p.decision==='envelope');delete S.chapter.readingSlice;render();GAME_READER.setSpeed('instant');`);
  for(let i=0;i<30&&!decision.run('familyPagePresentation(chapterPages(chapterNode("memo"))[S.chapter.page]).last');i++)decision.tap();
  const decisionBefore=decision.position();decision.tap();assert.equal(decision.position(),decisionBefore,'branch waits for an explicit option');
  assert.equal(decision.run('S.chapter.choices.envelope'),undefined);
  decision.run('familyChooseBranch("open");GAME_READER.setSpeed("instant");');
  const badBefore=decision.position();decision.tap();assert.notEqual(decision.position(),badBefore,'BAD END narrative uses the same background action');
  decision.run('S.chapter.badPage=FAMILY_BAD_ENDINGS[S.chapter.badEnding].pages.length;render();');
  const badCard=decision.position();decision.tap();assert.equal(decision.position(),badCard,'BAD END result never restarts on a background tap');

  // The visible next button still dispatches once after removing the separate
  // story-text click listener; photo/recall surfaces are not marked interactive.
  const button=setup(),direct=setup();button.finish();direct.finish();
  button.tap(element(['button','[data-act]'],button.surface,{act:'chapter-next'}));direct.run('chapterAdvance();');
  assert.equal(button.position(),direct.position(),'next button has exactly one effect');
  for(const kind of ['photo','recall','compare']){
   const g=setup();g.run(`const momentPage=CHAPTER_NODES.flatMap(n=>chapterPages(n)).find(p=>SCENARIO.moments?.[p.key]?.kind===${JSON.stringify(kind)});familyPagePresentation=()=>({last:true});`);
   const markup=g.run('STORY_MOMENTS.html(momentPage)');
   assert.equal(/class="story-moment [^"]*\bnoadv\b/.test(markup),kind==='compare',kind+': only the paper manipulation surface blocks background reading');
  }
  console.log('PASS shared normal/story click, touch, Enter/Space, reveal-before-advance, scrollback return, native controls, gestures, overlays, branch/deduction/chapter/BAD/FIN boundaries, and visual surfaces.');
 },

 'shared-reader': function(require,module,__filename,__dirname){
  const {engineSource}=require('./test-tools.cjs');
  const vm=require('node:vm'),assert=require('node:assert/strict');
  const runtime=['game-reader.js','family-reader.js'].map(engineSource).join('\n');
  function setup(){
   let clock=0,serial=0,back=false,returns=0;
   const intervals=new Map(),events={},windowEvents={},media={matches:false,addEventListener:(n,f)=>events.motion=f};
   const texts=['一枚の紙。\n次の言葉。','続きの文章です。'];
   const beats=texts.map(x=>({t:'say',x}));beats.push({t:'ask',x:'判断してください。'});
   const pages=texts.map((text,i)=>({key:'page-'+i,text}));
   const state={scr:'play',mode:'normal',panel:null,win:null,zoom:null,ci:0,bi:0,beats,done:false,
    chapter:{view:'read',node:'opening',page:0,choices:{}}};
   const painted={counter:'',story:'',rest:''},parts={'.family-accessible':{textContent:texts[0]},
    '[data-novel-visible]':{set textContent(v){painted.story=v;}},'[data-novel-rest]':{set textContent(v){painted.rest=v;}}};
   const story={dataset:{novelKey:'page-0'},querySelector:q=>parts[q],classList:{toggle(){}}};
   const doc={hidden:false,addEventListener:(n,f)=>(events[n]??=[]).push(f),
    querySelector:q=>q==='#mwText'&&state.scr==='play'?{}:null,
    getElementById:id=>id==='familyStoryText'&&state.scr==='multi'?story:null};
   const ctx={SCENARIO:{ending:{cast:[],scene:'bg'}},familyPageVisible:()=>true,document:doc,window:{addEventListener:(n,f)=>{const previous=windowEvents[n];windowEvents[n]=()=>{previous?.();f();};}},S:state,
    Date:{now:()=>clock},matchMedia:()=>media,setInterval:f=>{intervals.set(++serial,f);return serial;},clearInterval:id=>intervals.delete(id),
    isReadingBack:()=>back,consumeReadbackAdvance:()=>{if(!back)return false;back=false;returns++;return true;},
    beat:()=>state.beats[state.bi],curCase:()=>({id:'counter-case'}),textOf:b=>b.x,paintStoryText:(el,text,n)=>painted.counter=text.slice(0,n),
    finishStoryLine:()=>{state.done=true;},chapterNode:()=>({pages:()=>pages}),chapterPages:()=>pages,
    PORTRAIT_MOTION:{preference:()=> 'off'},FAMILY_BAD_ENDINGS:{},render:()=>ctx.api.sync(),
    advanceCounterPage:()=>{if(state.beats[state.bi].t!=='say')return;state.bi++;state.done=false;ctx.api.sync();},
    advanceStoryPage:()=>{if(pages[state.chapter.page].decision||state.chapter.page===pages.length-1)return;state.chapter.page++;story.dataset.novelKey=pages[state.chapter.page].key;parts['.family-accessible'].textContent=pages[state.chapter.page].text;ctx.api.sync();},advanceBadPage(){}
   };
   vm.createContext(ctx);vm.runInContext(runtime+';this.api=GAME_READER;',ctx);
   function step(ms){for(let n=0;n<ms;n+=20){clock+=20;for(const f of [...intervals.values()])f();assert.ok(intervals.size<=1,'both modes share at most one text timer');}}
   return {api:ctx.api,ctx,state,painted,intervals,events,windowEvents,media,pages,step,fire:name=>{for(const f of events[name]||[])f();},
    reading(value){back=value;ctx.api.pause();},returns:()=>returns,
    switch(mode){state.scr=mode==='counter'?'play':'multi';ctx.api.sync();}};
  }

  // The actual adapters receive identical timing and global settings.
  const normal=setup(),story=setup();normal.api.sync();story.switch('story');
  for(let ms=0;ms<2500;ms+=20){normal.step(20);story.step(20);assert.equal(normal.painted.counter,story.painted.story,'identical text reveals at the same cadence');}
  for(const mode of ['counter','story']){
   const g=setup();g.switch(mode);g.step(100);assert.ok(g.api.revealing());
   const position=()=>mode==='counter'?g.state.bi:g.state.chapter.page;
   for(const overlay of ['panel','win','zoom']){
    g.state[overlay]=overlay==='zoom'?0:'open';g.api.sync();const before=g.api.snapshot().shown;
    assert.equal(g.intervals.size,0,'overlay stops the shared timer');g.step(2000);g.api.advance();
    assert.equal(g.api.snapshot().shown,before);assert.equal(position(),0);
    g.state[overlay]=null;g.api.sync();assert.equal(g.intervals.size,1);
   }
   g.reading(true);assert.equal(g.intervals.size,0);g.api.advance();assert.equal(g.returns(),1);assert.equal(position(),0);
   g.reading(false);g.ctx.document.hidden=true;g.fire('visibilitychange');assert.equal(g.intervals.size,0);
   g.step(5000);g.ctx.document.hidden=false;g.fire('visibilitychange');assert.equal(g.intervals.size,1);
   g.windowEvents.pagehide();assert.equal(g.intervals.size,0);g.windowEvents.pageshow();assert.equal(g.intervals.size,1);
   g.api.advance();assert.equal(position(),0,'first advance finishes text');assert.equal(g.api.revealing(),false);
   g.api.advance();assert.equal(position(),1,'second advance changes the domain page');
   g.api.setSpeed('instant');assert.equal(g.api.revealing(),false);assert.equal(g.intervals.size,0);
  }

  // Reopening a modal/restored UI cannot strand already revealed answer choices.
  const restoredQuestion=setup();restoredQuestion.api.setSpeed('instant');restoredQuestion.api.sync();
  restoredQuestion.state.done=false;restoredQuestion.api.sync();
  assert.equal(restoredQuestion.state.done,true,'completed text restores its derived UI completion flag');

  const transfer=setup();transfer.api.sync();transfer.step(100);transfer.api.setSpeed('fast');transfer.switch('story');
  assert.equal(transfer.api.snapshot().speed,'fast','speed carries into story');
  assert.equal(transfer.painted.story,'','new mode starts at its own text');assert.equal(transfer.intervals.size,1);
  transfer.step(100);transfer.switch('counter');assert.equal(transfer.api.snapshot().speed,'fast');assert.equal(transfer.intervals.size,1);
  transfer.api.setSpeed('instant');transfer.switch('story');assert.equal(transfer.api.revealing(),false);
  transfer.api.reset();assert.equal(transfer.intervals.size,0);assert.equal(transfer.api.snapshot().speed,'instant','reset clears progress, not the shared setting');

  const auto=setup();auto.api.setSpeed('instant');auto.api.toggleAuto();auto.step(10000);
  assert.equal(auto.state.bi,1,'normal auto stops at the last dialogue before a question');assert.equal(auto.intervals.size,0);
  auto.api.advance();assert.equal(auto.state.beats[auto.state.bi].t,'ask');auto.step(10000);assert.equal(auto.state.bi,2,'auto cannot answer or skip a question');
  auto.switch('story');auto.pages[0].decision='choice';auto.api.sync();auto.step(10000);assert.equal(auto.state.chapter.page,0,'same auto setting cannot choose a branch');
  assert.equal(auto.intervals.size,0);

  // Ending credits have their own clock; manuscript text still has exactly one.
  assert.ok(!engineSource('app.js').includes('setInterval('),'counter UI adds no text timer');
  assert.ok(!engineSource('family-reader.js').split('const FAMILY_ENDING =')[0].includes('setInterval('),'story presentation adds no text timer');
  assert.equal((engineSource('game-reader.js').match(/\bsetInterval\(/g)||[]).length,1,'shared reading, adapters and input keep one text timer');
  console.log('PASS shared counter/story timing, settings, one timer, modal/readback/visibility/page lifecycle, mode transitions, reveal-before-advance, question/branch auto boundaries.');
 },

 'screen-mode': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  async function main(){
   const g=boot(),doc=g.context.document;
   g.context.matchMedia=()=>({matches:false});
   g.context.navigator={userAgent:'iPhone',standalone:false};
   const status={textContent:''},help={open:false},button={};
   doc.getElementById=id=>id==='screen-status'?status:id==='screen-home-help'?help:null;
   const oldQuery=doc.querySelector;
   doc.querySelector=q=>q==='#screen-controls [data-act="screen-toggle"]'?button:oldQuery(q);
   const state=g.run('JSON.stringify(S)'),save=g.context.localStorage.getItem('madoguchi.family-longform.v1');
   assert.ok(g.run('SCREEN_MODE.controls()').includes('Safariの共有メニュー'));
   await g.run('SCREEN_MODE.toggle()');
   assert.equal(help.open,true);assert.match(status.textContent,/ホーム画面/);
   let enter=0,exit=0,done;
   doc.fullscreenEnabled=true;
   doc.documentElement.requestFullscreen=()=>{enter++;return new Promise(resolve=>{done=resolve;});};
   const pending=g.run('SCREEN_MODE.toggle()');
   assert.equal(enter,1,'request runs synchronously in the user gesture');
   assert.equal(button.disabled,true);
   await g.run('SCREEN_MODE.toggle()');assert.equal(enter,1,'double tap cannot queue another request');
   doc.fullscreenElement=doc.documentElement;g.fire('fullscreenchange',{});done();await pending;
   assert.equal(button.disabled,false);assert.match(button.innerHTML,/全画面を終了/);
   doc.exitFullscreen=()=>{exit++;doc.fullscreenElement=null;g.fire('fullscreenchange',{});return Promise.resolve();};
   await g.run('SCREEN_MODE.toggle()');assert.equal(exit,1);assert.match(button.innerHTML,/画面いっぱい/);
   // Escape and browser-provided controls also synchronize the button.
   doc.fullscreenElement=doc.documentElement;g.fire('fullscreenchange',{});
   doc.fullscreenElement=null;g.fire('fullscreenchange',{});assert.match(button.innerHTML,/画面いっぱい/);
   doc.documentElement.requestFullscreen=()=>Promise.reject(new Error('denied'));
   await g.run('SCREEN_MODE.toggle()');assert.match(status.textContent,/切り替えられません/);assert.equal(button.disabled,false);
   doc.fullscreenEnabled=false;enter=0;
   doc.documentElement.requestFullscreen=()=>{enter++;};
   await g.run('SCREEN_MODE.toggle()');assert.equal(enter,0,'disabled API is never called');
   delete doc.documentElement.requestFullscreen;
   doc.documentElement.webkitRequestFullscreen=()=>{doc.webkitFullscreenElement=doc.documentElement;g.fire('webkitfullscreenchange',{});};
   doc.webkitExitFullscreen=()=>{doc.webkitFullscreenElement=null;g.fire('webkitfullscreenchange',{});};
   await g.run('SCREEN_MODE.toggle()');assert.match(button.innerHTML,/全画面を終了/);
   await g.run('SCREEN_MODE.toggle()');assert.match(button.innerHTML,/画面いっぱい/);
   g.context.navigator.standalone=true;g.fire('fullscreenchange',{});
   assert.equal(button.hidden,true);assert.match(status.textContent,/URLバーなし/);
   assert.equal(g.run('JSON.stringify(S)'),state,'screen changes do not alter progress, score or preferences');
   assert.equal(g.context.localStorage.getItem('madoguchi.family-longform.v1'),save);
   // A pending request may finish after the settings panel closes.
   doc.getElementById=()=>null;doc.querySelector=oldQuery;
   await g.run('SCREEN_MODE.toggle()');
   const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
   const manifest=JSON.parse(read('web-dist/manifest.webmanifest'));
   assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.ok(!manifest.orientation);
   const web=read('web-dist/index.html');
   assert.ok(web.includes('href="manifest.webmanifest"'));assert.ok(web.includes('apple-mobile-web-app-capable'));
   assert.ok(!read('index.html').includes('href="manifest.webmanifest"'),'local single file needs no missing web metadata');
   for(const icon of manifest.icons){
    const data=fs.readFileSync(path.join(root,'web-dist',icon.src));
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`,icon.sizes);
    const record=JSON.parse(read('web-dist/licenses/published-assets.json')).assets.find(a=>a.file===icon.src);
    assert.equal(record.license,'MIT');assert.ok(record.records.includes('build.py'));
   }
   console.log('PASS fullscreen gesture, exit, failure, iPhone guidance, installed mode, unchanged progress and web app metadata/icons.');
  }
  main().catch(e=>{console.error(e);process.exitCode=1;});
 },

 'clock-progress': function(require,module,__filename,__dirname){
  const {boot,completePc,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const story=JSON.parse(fs.readFileSync(path.join(__dirname,'../story-family.json'),'utf8'));
  const minutes=s=>{const [h,m]=s.split(':').map(Number);return h*60+m;};
  for(const mode of ['correct','hint','wrong']){
   const g=boot();g.run('S.count="all";S.sound=false;startGame();');let previous=540,guard=0;const seen=new Map();
   function sample(){const t=minutes(g.run('storyTime()'));assert.ok(t>=previous,`${mode}: clock moved backward from ${previous} to ${t}`);previous=t;const id=g.run('S.ci');if(!seen.has(id))seen.set(id,new Set());seen.get(id).add(t);}
   while(g.run('S.scr')==='play'){
    assert.ok(++guard<2000);sample();const type=g.run('beat().t');
    if(type==='ask'){
     if(mode==='hint'){g.run('useHint();');assert.equal(g.run('S.log.at(-1).time'),g.run('storyTime()'));}
     g.run(mode==='wrong'?'answer(S.perm.findIndex(i=>!curCase().steps[beat().si].choices[i].ok));':'answer(S.perm.findIndex(i=>curCase().steps[beat().si].choices[i].ok));');
    }else if(type==='order'){
     if(mode==='hint')g.run('useHint();');
     g.run('S.pick=curCase().steps[beat().si].items.map((_,i)=>i);'+(mode==='wrong'?'S.pick.reverse();':'')+'commitOrder();');
    }else if(type==='pc'){
     g.run('pcState().query=pcBirthKeys(FORMS[curCase().id].app.birth)[0];pcSearch();');sample();
     g.run('pcSelect("app");');sample();
     g.run('pcState().relation=pcExpectedRelation(FORMS[curCase().id]);pcState().target=true;pcState().items={...FORMS[curCase().id].items};pcTransfer();');sample();
     const at=g.run('storyTime()');g.run('pcState().phase="search";');assert.equal(g.run('storyTime()'),at,'reviewing search does not rewind time');g.run('pcState().phase="excel";');
     g.run('pcState().quantity=String(FORMS[curCase().id].certs[0].n);pcState().lane=FORMS[curCase().id].certs[0].wide?"wide":"local";pcPrint();closeMaterial();');
    }else g.run('advance();');
   }
   sample();assert.equal(previous,540+14*28+g.run('S.wait'));assert.equal(g.run('S.total'),46);
   for(const clock of seen.values())assert.ok(clock.size>=5,'each response shows intermediate times');
  }
  for(const woman of ['ask','explain']){
   let previous=0;
   for(const node of story.nodes){
    assert.ok(minutes(node.time)>=previous,node.id);
    for(const p of node.pages.filter(p=>!p.when||p.when.woman===woman)){
     assert.ok(p.time,`${p.key} needs a time`);assert.ok(minutes(p.time)>=previous,`${p.key} is out of order`);previous=minutes(p.time);
    }
    previous=minutes(node.endTime);
   }
  }
  const node=id=>story.nodes.find(n=>n.id===id),page=(n,key)=>node(n).pages.find(p=>p.key===key);
  assert.equal(node('daughter').time,'16:10');assert.equal(node('phone').time,'17:02');
  assert.equal(page('noon','noon-002').time,'12:07');assert.equal(page('noon','noon-004b').time,'12:07');assert.equal(page('noon','noon-004c').time,'12:08');
  assert.equal(minutes(page('noon','noon-006').time)-minutes(page('noon','noon-004').time),15,'ambulance arrives fifteen minutes after the call');
  assert.equal(page('noon','noon-006').time,'12:22');
  assert.ok(page('noon','noon-004d').text.includes('交代しながら、救命処置を続けている'));
  assert.ok(page('noon','noon-006').text.includes('十二時二十二分')&&page('noon','noon-006').text.includes('十五分'));
  assert.ok(minutes(page('noon','noon-009').time)>minutes(page('noon','noon-006').time),'transport follows the on-scene handover');
  assert.ok(node('instructions').pages.some(p=>p.text.includes('15:36')));
  // Refresh an older reader's already-read scene without changing progress,
  // adding unread paragraphs, or resetting choices and deduction work.
  {
   const legacy=boot();legacy.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('phone'));S.chapter.choices={envelope:'sealed',rescue:'stay',woman:'ask'};openChapterNode('phone');S.score=150;
    S.chapter.investigations={source:{theory:'kurose',selected:['husband_quote']}};saveFamilyProgress();
    {const saved=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));delete saved.scenarioId;delete saved.anchors;const index=chapterNode('noon').pages().findIndex(p=>p.key==='noon-006');
     saved.chapter.readHistory=[{key:'noon:'+index,x:'救急隊が着くと、医師が処置と状態を引き継いだ。',time:'12:16',context:'12:16 · 昼休み'}];
     localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(saved));}`);
   const before=legacy.run('JSON.stringify([S.chapter.node,S.chapter.page,S.chapter.done,S.chapter.choices,S.chapter.investigations,S.score])');
   legacy.run('resumeFamilyProgress();');
   assert.equal(legacy.run('JSON.stringify([S.chapter.node,S.chapter.page,S.chapter.done,S.chapter.choices,S.chapter.investigations,S.score])'),before);
   const arrival=legacy.run('S.chapter.readHistory.find(e=>e.key.startsWith("noon:"))');
   assert.ok(arrival.x.includes('十五分'));assert.equal(arrival.time,'12:22');assert.ok(arrival.context.startsWith('12:22'));
   assert.equal(legacy.run('S.chapter.readHistory.filter(e=>e.key.startsWith("noon:")).length'),1,'unread rescue pages are not inserted');
   const once=legacy.run('JSON.stringify(S.chapter.readHistory)');legacy.run('saveFamilyProgress();resumeFamilyProgress();');assert.equal(legacy.run('JSON.stringify(S.chapter.readHistory)'),once);
  }
  const g=boot();g.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('daughter'));S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('daughter');S.chapter.page=4;render();chapterAdvance();advance();advance();`);
  const start=g.run('storyTime()');assert.ok(minutes(start)>=minutes('16:15'));
  g.run('pcState().query="マナベユイ";pcSearch();pcSelect("app");');const confirm=g.run('storyTime()');assert.ok(confirm>start);
  g.run('saveFamilyProgress();{const saved=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));delete saved.scenarioId;delete saved.anchors;saved.scenarioVersion="2.3.8";saved.contentRevision="cast-scenes-v1";saved.chapter.readHistory=[{key:"daughter:0",x:"旧本文",context:"13:16 · 午後の受付"}];for(const entry of saved.chapter.counter.log){delete entry.time;entry.context="13:16 · 午後の受付";}localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(saved));}S.scr="title";resumeFamilyProgress();');
  assert.equal(g.run('storyTime()'),confirm);assert.ok(g.run('S.chapter.readHistory[0].context.startsWith("16:10")'));
  assert.ok(g.run('S.log.every(entry=>entry.time==="16:15"&&entry.context.startsWith("16:15"))'),'active response history migrates with its saved progress');
  completePc(g);while(g.run('beat().t')!=='ask')g.run('advance();');
  const end=g.run('storyTime()');g.run('answer(S.perm.findIndex(i=>curCase().steps[0].choices[i].ok));');
  assert.ok(g.stage.innerHTML.includes('16:30'));assert.ok(minutes(end)<=minutes('16:30'));
  const reading=g.run('S.chapter.page');g.run('render();render();S.panel="chapter-menu";render();S.panel=null;render();');assert.equal(g.run('S.chapter.page'),reading,'menus and renders never advance the clock');
  assert.ok(g.run('S.chapter.readHistory.find(e=>e.key==="daughter:5").context.startsWith("16:30")'));
  const fallback=boot({photos:false});fallback.run('startGame();');assert.ok(fallback.run('clockSVG()').includes('rotate(270 50 50)'),'fallback clock uses the fictional time');
  // The visible clock opens history without advancing time, answers or form input.
  function clickClock(t,act='clock-timeline'){
   const button={dataset:{act},closest:()=>null};
   t.fire('click',{target:{closest:q=>q==='[data-act]'?button:null},preventDefault(){}});
  }
  const normal=boot();normal.run('startGame();skip();');
  const normalState=normal.run('JSON.stringify([S.bi,S.ci,S.score,S.total,S.wait,S.log,S.pc,storyTime()])');
  assert.ok(normal.run('quietHudHTML()').includes('data-act="clock-timeline"'));
  clickClock(normal);assert.equal(normal.run('S.panel'),'timeline');
  assert.ok(normal.stage.innerHTML.includes('counter-timeline'));
  assert.equal(normal.run('(counterTimelineHTML().match(/<li>/g)||[]).length'),normal.run('S.log.length'));
  assert.ok(normal.run('counterTimelineHTML()').includes(normal.run('S.log[0].time')));
  normal.fire('keydown',{key:'1',preventDefault(){}});normal.fire('keydown',{key:'Escape',preventDefault(){}});
  assert.equal(normal.run('S.panel'),null);assert.equal(normal.run('JSON.stringify([S.bi,S.ci,S.score,S.total,S.wait,S.log,S.pc,storyTime()])'),normalState);
  normal.run('S.log=[];');assert.ok(normal.run('counterTimelineHTML()').includes('まだ応対の記録はありません'));
  const storyClock=boot();storyClock.run('startChapter();openChapterNode("r0");S.chapter.page=2;render();');
  const pageState=storyClock.run('JSON.stringify([S.chapter.node,S.chapter.page,S.chapter.view,S.chapter.act,S.chapter.done,S.chapter.clues,S.chapter.choices,S.score,S.total])');
  clickClock(storyClock);assert.equal(storyClock.run('S.chapter.view'),'timeline');assert.ok(storyClock.stage.innerHTML.includes('元の場面へ'));
  assert.ok(!storyClock.stage.innerHTML.includes('data-act="clock-timeline"'),'timeline clock is not a recursive trigger');
  storyClock.fire('keydown',{key:'Escape',preventDefault(){}});
  assert.equal(storyClock.run('JSON.stringify([S.chapter.node,S.chapter.page,S.chapter.view,S.chapter.act,S.chapter.done,S.chapter.clues,S.chapter.choices,S.score,S.total])'),pageState);
  clickClock(storyClock);clickClock(storyClock,'clock-return');assert.equal(storyClock.run('S.chapter.page'),2);
  clickClock(storyClock);storyClock.run('openChapterNode("r0");');assert.equal(storyClock.run('clockTimelineReturn()'),null,'choosing a scene consumes the temporary return route');
  storyClock.run('resumeAtDeduction();mysteryTheory(MYSTERY_PUZZLES[familyQuestion()].options[0].id);');
  const draft=storyClock.run('JSON.stringify(S.chapter.investigations)');clickClock(storyClock);clickClock(storyClock,'clock-return');
  assert.equal(storyClock.run('S.chapter.node'),'deduction');assert.equal(storyClock.run('JSON.stringify(S.chapter.investigations)'),draft);
  const counter=boot();counter.run('startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf("daughter"));S.chapter.choices={envelope:"sealed",rescue:"stay"};openChapterNode("daughter");S.chapter.page=4;render();startDaughterCounter();pcState().query="マナベユイ";');
  const counterState=counter.run('JSON.stringify([S.scr,S.bi,S.pc,S.log,S.chapter.view,S.chapter.node,S.chapter.page,S.chapter.caseActive,S.score,storyTime()])');
  clickClock(counter);assert.equal(counter.run('S.chapter.view'),'timeline');clickClock(counter,'clock-return');
  assert.equal(counter.run('JSON.stringify([S.scr,S.bi,S.pc,S.log,S.chapter.view,S.chapter.node,S.chapter.page,S.chapter.caseActive,S.score,storyTime()])'),counterState);
  console.log('PASS clock timeline clicks, direct/Escape return, history-only display, no answer/time/form/deduction changes, normal clock progression, story schedules, rescue timing, evening arrival and save migration.');
 },

 'family-entry-and-term': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  function click(g,act,{inPanel=false,term=false}={}){
   const button={dataset:{act,v:term?'agonal':undefined},closest:q=>q==='.panel'&&inPanel?{}:null};
   const target={closest:q=>q==='[data-act]'||term&&q==='[data-act="family-term"]'?button:q==='#familyStoryText'&&term?{}:null};
   g.fire('click',{target,preventDefault(){},clientX:0,clientY:0});
  }
  const intro=boot();intro.run('prepareMode("normal")');
  for(const wording of ['こもれび町役場','新人職員','書かない窓口','真鍋さん'])assert.ok(intro.stage.innerHTML.includes(wording),wording);
  assert.equal(intro.run('S.scr'),'title','guidance appears before normal-mode play');
  intro.run('beginMode()');assert.equal(intro.run('S.mode'),'normal');assert.equal(intro.run('S.scr'),'play');
  const g=boot({chapterCards:true});
  assert.ok(g.stage.innerHTML.includes('data-act="family-entry"'));
  assert.ok(!g.stage.innerHTML.includes('data-act="family-resume"')&&!g.stage.innerHTML.includes('data-act="chapter-start"'),'title has only the story-mode entry');
  click(g,'family-entry');assert.equal(g.run('S.panel'),'family-entry');
  assert.match(g.stage.innerHTML,/data-act="family-resume" disabled/);
  assert.equal(g.run('readFamilySave()'),null);
  click(g,'close',{inPanel:true});assert.equal(g.run('S.scr'),'title');assert.equal(g.run('S.panel'),null);
  click(g,'family-entry');click(g,'chapter-start',{inPanel:true});assert.equal(g.run('S.panel'),'welcome');assert.equal(g.run('readFamilySave()'),null);
  click(g,'begin-training',{inPanel:true});assert.equal(g.run('S.chapter.view'),'chapter');assert.equal(g.run('S.chapter.node'),'r0');

  g.run(`beginFamilyChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('noon'));S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('noon',true);S.chapter.page=chapterPages(chapterNode('noon')).findIndex(p=>p.key==='noon-004a');S.score=200;render();`);
  const position=g.run('S.chapter.page'),score=g.run('S.score');
  // An older transcript gets only the revised sentence; choices, page and score survive.
  g.run(`{const saved=JSON.parse(localStorage.getItem(FAMILY_SAVE_KEY));saved.chapter.readHistory.push({key:'wording-legacy',x:'仕事を休んで、切符を取ってとなると。'});saved.chapter.counter={log:[{x:'仕事を休んで、切符を取ってとなると。'}]};localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(saved));}`);
  const revised=g.run('readFamilySave()');
  assert.ok(revised.chapter.readHistory.find(e=>e.key==='wording-legacy').x.includes('遠くから来ていただく'));
  assert.ok(revised.chapter.counter.log[0].x.includes('遠くから来ていただく'),'old response logs use the revised wording too');
  assert.equal(revised.chapter.page,position);assert.equal(revised.scores.score,score);
  assert.ok(!g.run('CHAPTER_NODES.flatMap(n=>n.pages()).some(p=>p.text.includes("切符"))'));

  assert.ok(g.stage.innerHTML.includes('data-novel-term hidden'));
  const before=g.run('JSON.stringify(S.chapter)');click(g,'family-term',{term:true});
  assert.equal(g.run('S.panel'),'family-term');assert.equal(g.run('S.chapter.page'),position,'term click must not also advance the paragraph');
  assert.ok(g.stage.innerHTML.includes('死戦期呼吸（しせんきこきゅう）'));
  assert.ok(g.stage.innerHTML.includes('普段どおりの呼吸ではありません。'));
  for(const source of ['https://www.city.narashino.lg.jp/','https://www.fdma.go.jp/'])assert.ok(g.stage.innerHTML.includes(source));
  g.fire('keydown',{key:'Escape',preventDefault(){}});assert.equal(g.run('S.panel'),null);assert.equal(g.run('JSON.stringify(S.chapter)'),before);
  click(g,'family-term',{term:true});click(g,'close',{inPanel:true});assert.equal(g.run('S.panel'),null);assert.equal(g.run('S.score'),score);assert.equal(g.run('S.chapter.page'),position);
  g.run('openFamilyTerm("unknown")');assert.equal(g.run('S.panel'),null);

  g.run('S.scr="title";render()');const saved=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  assert.ok(!g.stage.innerHTML.includes('data-act="family-resume"'));
  click(g,'family-entry');assert.ok(g.stage.innerHTML.includes('第2章 · 昼休みから再開'));
  assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),saved,'opening entry must not alter save');
  g.fire('keydown',{key:'Escape',preventDefault(){}});assert.equal(g.run('S.panel'),null);assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),saved);
  click(g,'family-entry');click(g,'family-resume',{inPanel:true});assert.equal(g.run('S.chapter.page'),position);assert.equal(g.run('S.score'),score);assert.equal(g.run('S.panel'),null);
  g.run('S.scr="title";render()');click(g,'family-entry');click(g,'chapter-start',{inPanel:true});
  assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),saved,'welcome can still be cancelled without erasing save');
  click(g,'begin-training',{inPanel:true});assert.equal(g.run('S.chapter.node'),'r0');assert.equal(g.run('S.chapter.done.length'),0);assert.equal(g.run('S.score'),0);
  console.log('PASS one title entry, saved/unsaved submenu, cancel without save changes, resume/start, inline term without advance, dialog close/Escape and preserved story state.');
 },

 'family-license': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  function click(g,act,{inPanel=false}={}){
   const button={dataset:{act},closest:q=>q==='.panel'&&inPanel?{}:null};
   g.fire('click',{target:{closest:q=>q==='[data-act]'?button:null},preventDefault(){},stopPropagation(){}});
  }
  const g=boot({width:390});
  g.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('daughter'));S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('daughter');`);
  for(let i=0;i<4;i++){
   g.run(`S.chapter.page=${i};render();`);
   assert.ok(!g.stage.innerHTML.includes('data-act="family-license"'),'no document before it has been presented');
   click(g,'family-license');assert.equal(g.run('S.panel'),null);
  }
  g.run('S.chapter.page=4;S.chapter.choices.issuance="hold";S.score=150;render();');
  assert.equal(g.run('chapterPages(chapterNode("daughter"))[4].document'),'daughter-license');
  assert.ok(g.stage.innerHTML.includes('提示された免許証を見る'));
  const before=g.run('JSON.stringify(S.chapter)'),score=g.run('S.score');
  click(g,'family-license');
  assert.equal(g.run('S.panel'),'family-license');
  assert.ok(g.stage.innerHTML.includes('jp-card license family-license-card'),'reuse the normal-mode card');
  assert.ok(g.stage.innerHTML.includes('真鍋 結衣')&&g.run('familyLicensePanelHTML().includes(\'class="family-license-face"\')'));
  assert.ok(!g.run('familyLicensePanelHTML().includes("data-motion-key")'),'identity-document photograph is static');
  click(g,'family-license-zoom',{inPanel:true});assert.ok(g.stage.innerHTML.includes('family-license-sheet is-enlarged'));
  click(g,'chapter-next');assert.equal(g.run('S.chapter.page'),4,'the modal blocks story clicks');
  g.fire('keydown',{key:'Enter',preventDefault(){}});assert.equal(g.run('S.chapter.page'),4,'the modal blocks story keyboard advance');
  g.fire('keydown',{key:'Escape',preventDefault(){}});
  assert.equal(g.run('S.panel'),null);assert.equal(g.run('JSON.stringify(S.chapter)'),before);assert.equal(g.run('S.score'),score);
  click(g,'family-license');assert.ok(!g.run('familyLicenseEnlarged'),'reopening starts at whole-card size');
  click(g,'close',{inPanel:true});assert.equal(g.run('S.panel'),null);
  g.run('chapterAdvance();');assert.equal(g.run('S.chapter.page'),5);assert.ok(g.stage.innerHTML.includes('提示された免許証を見る'));
  g.run('S.chapter.page=12;openConsolePanel("chapter-menu");');assert.ok(g.stage.innerHTML.includes('data-act="family-license"'),'can recheck from the pause menu');click(g,'family-license',{inPanel:true});assert.equal(g.run('S.panel'),'family-license');click(g,'close',{inPanel:true});assert.equal(g.run('S.panel'),'chapter-menu');g.run('closeConsolePanel();');
  g.run('S.chapter.done.push("daughter");openChapterNode("instructions");openConsolePanel("chapter-menu");');assert.ok(g.stage.innerHTML.includes('data-act="family-license"'));g.run('closeConsolePanel();');

  // Both deployed prose-only revisions preserve page keys/choices and refresh saved logs.
  for(const revision of ['shorter-woman-v1','daughter-license-v1']){
  g.run(`{S.chapter.node='daughter';S.chapter.page=4;S.chapter.progress.daughter=4;
   S.chapter.readHistory=[{key:'r0:0',x:'old text',n:'あなた'},{key:'noon:8',x:'old text',n:'あなた'},{key:'daughter:1',x:'old text',n:'あなた'}];
   S.chapter.investigations.concealment={theory:'interception',selected:['consultation_memo','delivery_record','branch_stairs_call']};
   const oldSave={version:1,contentRevision:'${revision}',layoutRevision:FAMILY_LAYOUT_REVISION,chapter:S.chapter,scores:{score:150}};
   localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(oldSave));resumeFamilyProgress();}`);
  assert.equal(g.run('S.chapter.page'),4);assert.equal(g.run('S.chapter.choices.rescue'),'stay');assert.equal(g.run('S.score'),150);
  assert.ok(!g.run('S.chapter.investigations.concealment'));
  assert.ok(g.run('S.chapter.readHistory.find(e=>e.key==="daughter:1").x.includes("病院へ向かった")'));
  assert.ok(g.run('S.chapter.readHistory.find(e=>e.key==="r0:0").x.includes("職員用の通路")'));
  assert.ok(!g.run('S.chapter.readHistory.some(e=>e.x==="old text")'));
  assert.equal(g.run('readFamilySave().contentRevision'),g.run('FAMILY_CONTENT_REVISION'));
  }
  const normal=g.run('japaneseLicense(CASES.find(c=>c.id==="c1"))');
  assert.ok(!normal.includes('family-license-card')&&!normal.includes('真鍋 結衣'),'normal-mode documents retain their own fields and appearance');
  console.log('PASS story document visibility, shared card, static photo, zoom, modal keyboard/click blocking, close/reopen, conversation recheck, preserved save position/choices/score and reset obsolete deduction, refreshed prose, and normal-mode isolation.');
 },

 'family-reader': function(require,module,__filename,__dirname){
  const {engineSource}=require('./test-tools.cjs');
  const vm=require('node:vm'),assert=require('node:assert/strict');
  const runtime=['game-reader.js','family-reader.js'].map(engineSource).join('\n');
  function setup({reduced=false,motion='on',camera=false}={}){
   let time=0,intervals=new Map(),seq=0,readingBack=false,advances=0;
   const listeners={},parts={'.family-accessible':{textContent:'一言。\n次の言葉。'},'[data-novel-visible]':{textContent:''},'[data-novel-rest]':{textContent:''}};
   const el={dataset:{novelKey:'r1-005'},querySelector:q=>parts[q],classList:{toggle(){}}},button={textContent:'次へ ▶',dataset:{}},mq={matches:reduced,addEventListener(){}};
   const classes=new Set(),art={dataset:{sceneKey:'bg'},style:{setProperty(k,v){this[k]=v;}},classList:{add:k=>classes.add(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k)}};
   const pages=[{key:'r1-005'},{key:'r1-006'},{key:'r1-007'}],state={scr:'multi',panel:null,win:null,zoom:null,chapter:{view:'read',node:'r1',page:0}},node={id:'r1',pages:()=>pages};
   const doc={hidden:false,getElementById:id=>id==='familyStoryText'?el:null,querySelector:q=>q.startsWith('[data-act="chapter-next"')?button:camera&&q==='.multi-art'?art:null,addEventListener:(n,f)=>{(listeners[n]??=[]).push(f)}};
   const context={SCENARIO:{ending:{cast:[],scene:'bg'}},familyPageVisible:()=>true,document:doc,window:{addEventListener(){},getSelection:()=>''},S:state,matchMedia:()=>mq,Date:{now:()=>time},PORTRAIT_MOTION:{preference:()=>motion},Array,Math,
   setInterval:f=>{intervals.set(++seq,f);return seq},clearInterval:id=>intervals.delete(id),isReadingBack:()=>readingBack,chapterNode:()=>node,chapterPages:()=>pages,readbackArea:()=>({scrollTop:0}),esc:x=>x,
   consumeReadbackAdvance:()=>false,chapterAdvance:()=>context.api.advance('story'),advanceStoryPage:()=>{advances++;state.chapter.page++;},familyBadAdvance(){},render:()=>context.api.sync()};
   vm.createContext(context);vm.runInContext(runtime+';this.api=GAME_READER;this.titleApi=TITLE_CINEMA;',context);
   return {api:context.api,context,el,parts,button,state,node,pages,doc,mq,art,classes,advance:context.chapterAdvance,advances:()=>advances,reading:v=>readingBack=v,intervals,step(ms){for(let i=0;i<ms;i+=20){time+=20;for(const f of [...intervals.values()])f();}},newPage(key,text){el.dataset.novelKey=key;parts['.family-accessible'].textContent=text;context.api.sync();}};
  }
  const f=setup();f.api.sync();assert.equal(f.parts['[data-novel-visible]'].textContent,'');assert.equal(f.button.textContent,'次へ ▶','forward control stays stable while revealing');
  f.step(80);assert.ok(f.parts['[data-novel-visible]'].textContent.length>0);f.advance();assert.equal(f.advances(),0,'first press reveals, never skips');assert.equal(f.parts['[data-novel-rest]'].textContent,'');f.advance();assert.equal(f.advances(),1,'second press advances');
  f.newPage('r1-006','続きの文章。');f.step(40);const shown=f.parts['[data-novel-visible]'].textContent;f.state.panel='chapter-menu';f.api.sync();f.step(1000);assert.equal(f.parts['[data-novel-visible]'].textContent,shown,'menu pauses text');f.state.panel=null;f.api.sync();f.step(80);assert.ok(f.parts['[data-novel-visible]'].textContent.length>shown.length);
  f.api.setSpeed('instant');assert.equal(f.parts['[data-novel-rest]'].textContent,'');f.api.toggleAuto();f.reading(true);f.step(4000);assert.equal(f.advances(),1,'scrollback blocks auto');f.reading(false);f.doc.hidden=true;f.step(4000);assert.equal(f.advances(),1,'hidden tab blocks auto');f.doc.hidden=false;f.step(2600);assert.equal(f.advances(),2,'auto advances after a readable hold');
  for(const kind of ['decision','document','puzzle','training','last','bad','beat','before-beat']){
   const g=setup({reduced:true});g.api.sync();g.api.toggleAuto();if(kind==='decision')g.pages[0].decision='envelope';if(kind==='document')g.pages[0].document='newsletter';if(kind==='beat')g.pages[0].beat='reveal';if(kind==='before-beat')g.pages[1].beat='reveal';if(['puzzle','training'].includes(kind))g.node[kind]=true;if(kind==='last')g.state.chapter.page=2;if(kind==='bad')g.state.chapter.view='bad';g.step(10000);assert.equal(g.advances(),0,kind+' is never auto-advanced');
   assert.equal(g.parts['[data-novel-rest]'].textContent,'','reduced motion shows complete text');
  }
  const idle=setup({reduced:true});idle.api.sync();assert.equal(idle.intervals.size,0,'instant idle page needs no polling timer');
  const slice=setup(),cues=[];let sliceRenders=0;
  Object.assign(slice.el.dataset,{novelKey:'stairs-036:20-40',novelSource:'stairs-036',novelNext:'40',novelText:'前の段落。真鍋さんの携帯が鳴った。次の段落。',novelPrefix:'前の段落。'});
  slice.parts['.family-accessible'].textContent='真鍋さんの携帯が鳴った。';
  slice.context.SOUND={revealStorySound:(key,text)=>cues.push({key,text})};slice.context.render=()=>sliceRenders++;
  slice.api.sync();slice.advance();assert.equal(sliceRenders,0,'first tap reveals this cut');
  assert.deepEqual(cues.at(-1),{key:'stairs-036',text:'前の段落。真鍋さんの携帯が鳴った。'},'sound markers retain the authored key and preceding text');
  slice.advance();assert.equal(sliceRenders,1);assert.equal(slice.state.chapter.readingSlice.offset,40);assert.equal(slice.advances(),0,'second tap changes only the display cut');
  const cutAuto=setup({reduced:true});cutAuto.el.dataset.novelNext='8';cutAuto.el.dataset.novelSource='r1-005';cutAuto.el.dataset.novelText='続く文章';cutAuto.state.chapter.page=2;cutAuto.pages[2].decision='envelope';let autoCuts=0;cutAuto.context.render=()=>autoCuts++;
  cutAuto.api.sync();cutAuto.api.toggleAuto();cutAuto.api.sync();cutAuto.step(2600);assert.ok(autoCuts>=2);assert.equal(cutAuto.advances(),0,'auto may finish a multi-cut decision page without choosing or advancing it');
  const camera=setup({camera:true});camera.api.sync();assert.ok(camera.classes.has('novel-camera'));
  camera.step(1000);camera.newPage('r1-006','次の一文。');assert.equal(camera.art.style['--novel-camera-delay'],'-1s','same-scene text advances keep the camera position');
  assert.equal(camera.art.dataset.novelFresh,'true');camera.state.panel='settings';camera.api.sync();assert.equal(camera.art.style.animationPlayState,'paused');
  camera.state.panel=null;camera.api.sync();assert.equal(camera.art.dataset.novelFresh,'false','closing a menu never retriggers a dramatic cut');
  camera.doc.hidden=true;camera.api.sync();assert.equal(camera.art.style.animationPlayState,'paused');
  camera.doc.hidden=false;camera.context.PORTRAIT_MOTION.canAnimate=()=>false;camera.api.sync();assert.ok(!camera.classes.has('novel-camera'),'automatic data/performance fallback also pauses the camera');
  for(const options of [{motion:'off'},{reduced:true}]){const still=setup({...options,camera:true});still.api.sync();assert.ok(!still.classes.has('novel-camera'));assert.equal(still.art.dataset.novelFresh,'false');}
  const beat=setup();beat.el.dataset.novelBeat='reveal';beat.newPage('noon-002--1','吉田さんだった。');beat.step(380);assert.equal(beat.parts['[data-novel-visible]'].textContent,'','brief silence precedes an isolated line');beat.advance();assert.equal(beat.parts['[data-novel-visible]'].textContent,'吉田さんだった。');assert.equal(beat.advances(),0,'a click can skip the hold without skipping the line');
  assert.equal(beat.context.familyReadingText('「はい」\n「お願いします」\nうなずいた。'),'「はい」\n\n「お願いします」\nうなずいた。','dialogue turns keep space; their following action stays attached');
  assert.equal(beat.context.familyReadingText('椅子を引いた。\n床が鳴った。\n窓の外を見た。'),'椅子を引いた。床が鳴った。窓の外を見た。','consecutive narration reads as a paragraph');
  assert.equal(beat.context.familyReadingText('前半。\n\n後半。'),'前半。\n\n後半。','explicit paragraph remains');
  assert.equal(beat.context.familyReadingText('吉田さんだった。'),'吉田さんだった。','isolated reveal stays isolated');
  const annotated=setup(),term={textContent:'口をパクパク',hidden:true};
  annotated.parts['[data-novel-term]']=term;annotated.parts['[data-novel-after]']={textContent:''};
  annotated.newPage('noon-004a','口をパクパクしている。');
  annotated.step(40);assert.equal(term.hidden,true,'partly revealed term is not yet an interactive link');
  annotated.api.reveal();assert.equal(term.hidden,false);assert.equal(annotated.parts['[data-novel-visible]'].textContent,'');assert.equal(annotated.parts['[data-novel-after]'].textContent,'している。');
  annotated.api.toggleAuto();annotated.state.panel='family-term';annotated.api.sync();annotated.step(10000);assert.equal(annotated.advances(),0,'explanation pauses automatic advance');
  assert.equal(annotated.parts['[data-novel-term]'],term,'typing updates keep the same focusable link');
  annotated.state.panel=null;annotated.api.sync();assert.equal(annotated.advances(),0);annotated.step(2600);assert.equal(annotated.advances(),1,'auto resumes only after closing the explanation');
  for(const reduced of [false,true]){
   const title=setup({reduced}),api=title.context.titleApi;
   assert.equal(api.playing(),true,'initial title motion follows default on even with reduced motion');
   if(api.playing())api.toggle();
   assert.ok(api.controls().includes('タイトルの演出：OFF'));api.toggle();assert.equal(api.playing(),true,'explicit play works even when reduced motion is on');
   assert.ok(api.controls().includes('タイトルの演出：ON'));api.toggle();assert.equal(api.playing(),false);
   title.context.PORTRAIT_MOTION.preference=()=> 'off';api.toggle();assert.equal(api.playing(),true,'title replay is independent of portrait video preference');
   assert.equal(setup({reduced,motion:'auto'}).context.titleApi.playing(),!reduced,'automatic title motion respects reduced-motion preference');
   assert.equal(setup({reduced,motion:'off'}).context.titleApi.playing(),false,'manual still mode initially pauses the title');
  }
  console.log('PASS story reader reveal-before-advance, speed, punctuation timing, overlay/scrollback/background pause, auto boundaries, reduced motion and idle timer release; title default on, automatic reduced motion, manual play/stop.');
 },

 'story-display': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const g=boot();
  const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  let cachedHTML='',cached;
  g.context.document.documentElement.clientWidth=390;
  g.context.document.documentElement.clientHeight=844;
  g.context.document.getElementById=id=>{
   if(id!=='familyStoryText')return null;
   const html=g.stage.innerHTML.match(/<p id="familyStoryText"[\s\S]*?<\/p>/)?.[0];
   if(!html)return null;
   if(html===cachedHTML)return cached;
   cachedHTML=html;
   const dataset=Object.fromEntries([...html.matchAll(/data-novel-([\w-]+)="([^"]*)"/g)].map(([,k,v])=>['novel'+k[0].toUpperCase()+k.slice(1),decode(v)]));
   const parts={'.family-accessible':{textContent:decode(html.match(/<span class="family-accessible">([\s\S]*?)<\/span>/)[1])},'[data-novel-visible]':{textContent:''},'[data-novel-rest]':{textContent:''}};
   cached={dataset,querySelector:q=>parts[q],classList:{toggle(){}}};return cached;
  };
  // The display splitter preserves every authored character at all target widths.
  for(const width of [320,390,700,1280]){
   g.context.document.documentElement.clientWidth=width;
   g.run('startChapter();');
   for(const page of g.run('CHAPTER_NODES.flatMap(n=>n.pages())')){
    g.context.sampleText=page.text;
    const source=g.run('familyReadingText(sampleText)'),parts=g.run(`familyTextSlices(familyReadingText(sampleText),${width<701?Math.floor(width*.9/20.5):31},5)`);
    assert.equal(parts.map(p=>p.text).join(''),source,page.key);
    assert.ok(parts.every(p=>p.end>p.start),page.key);
   }
  }
  g.context.document.documentElement.clientWidth=390;
  g.run('startChapter();openChapterNode("r0");GAME_READER.setSpeed("instant");');
  const originalPage=g.run('S.chapter.page'),first=g.run('familyPagePresentation(chapterPages(chapterNode("r0"))[0])');
  assert.equal(first.start,0);assert.equal(first.last,false);
  assert.ok(g.stage.innerHTML.includes('family-dialogue-layout'));
  g.run('chapterAdvance();');
  assert.equal(g.run('S.chapter.page'),originalPage,'display cuts do not move authored page or clock');
  assert.equal(g.run('S.chapter.readingSlice.offset'),first.end);
  assert.equal(g.run('conversationHistory().at(-1).x'),first.text,'scrollback has only already read text from this page');
  assert.equal(g.run('readFamilySave().chapter.readingSlice.offset'),first.end);
  g.run('S.scr="title";resumeFamilyProgress();');
  assert.equal(g.run('familyPagePresentation(chapterPages(chapterNode("r0"))[0]).start'),first.end,'saved subpage resumes');
  g.context.document.documentElement.clientWidth=1280;g.run('render();');
  const resized=g.run('familyPagePresentation(chapterPages(chapterNode("r0"))[0])');
  assert.ok(resized.start<=first.end&&resized.end>first.end,'rotation retains the current passage');
  g.run('S.chapter.readingSlice.text="old manuscript";render();');
  assert.equal(g.run('familyPagePresentation(chapterPages(chapterNode("r0"))[0]).start'),0,'changed prose safely restarts that page');
  // Branches and evidence remain unavailable until the last display cut.
  g.context.document.documentElement.clientWidth=390;
  g.run(`S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('memo'));S.chapter.node='memo';S.chapter.view='read';S.chapter.page=chapterPages(chapterNode('memo')).findIndex(p=>p.decision==='envelope');delete S.chapter.readingSlice;render();`);
  const decision=g.run('chapterPages(chapterNode("memo"))[S.chapter.page]');
  assert.equal(g.run('familyPagePresentation(chapterPages(chapterNode("memo"))[S.chapter.page]).last'),false);
  assert.ok(!g.stage.innerHTML.includes('id="familyDecision"'));
  g.run('familyChooseBranch("open");');assert.equal(g.run('S.chapter.choices.envelope'),undefined);
  for(let i=0;i<50&&!g.run('familyPagePresentation(chapterPages(chapterNode("memo"))[S.chapter.page]).last');i++)g.run('chapterAdvance();');
  assert.ok(g.stage.innerHTML.includes('id="familyDecision"'));
  g.run('familyChooseBranch("open");');assert.equal(g.run('S.chapter.view'),'bad');
  assert.ok(!g.stage.innerHTML.includes('family-dialogue-layout'),'BAD END retains its own composition');
  g.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('noon'));S.chapter.node='noon';S.chapter.view='read';S.chapter.page=chapterPages(chapterNode('noon')).findIndex(p=>p.beat==='reveal');render();`);
  assert.ok(g.stage.innerHTML.includes('family-beat-page'));assert.ok(!g.stage.innerHTML.includes('family-dialogue-layout'));
  assert.equal(g.run('familyPagePresentation(chapterPages(chapterNode("noon"))[S.chapter.page]).last'),true);
  console.log('PASS all manuscript display cuts, original page/clock identity, save/resume, viewport changes, scrollback, choice gating, BAD END and isolated reveal.');
 },

},__filename);
