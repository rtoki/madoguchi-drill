// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const {runSuites}=require('./test-tools.cjs');

runSuites({
 'cast-motion': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs'),path=require('node:path');
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../motion/manifest.json'),'utf8'));
  const g=boot();
  for(let n=1;n<=14;n++){
   const id=`c${n}`;
   for(const [mood,cell] of Object.entries({calm:0,neutral:0,happy:1,smile:1,worried:2,serious:2,annoyed:3})){
    const key=`${id}-${cell}`;
    for(const variant of ['mobile','desktop']){
     const entry=manifest.find(e=>e.scene===key&&e.variant===variant);
     assert.ok(entry,`${key} ${variant} exists`);assert.equal(entry.render.cell,cell);assert.equal(entry.render.character,id);
     assert.equal(entry.audio,false);assert.equal(entry.fps,20);assert.equal(entry.seconds,8);
    }
    assert.ok(g.run(`avatar(LOOK.${id},'${mood}',false,true)`).includes(`data-motion-key="${key}"`));
    assert.ok(!g.run(`avatar(LOOK.${id},'${mood}',true,true)`).includes('data-motion-key'),'identity-document crops never animate');
    assert.ok(!g.run(`avatar(LOOK.${id},'${mood}',false)`).includes('data-motion-key'),'notes and gallery thumbnails stay still');
    g.run(`S=Object.assign(fresh(),{scr:'play',queue:[${n-1}],visible:true,vmood:'${mood}',beats:[{t:'ask',si:0}],bi:0});`);
    assert.ok(g.run('sceneHTML(true)').includes(`data-motion-key="${key}"`),'normal question keeps matching expression');
    assert.ok(g.run(`chapterArt('bg','${id}','${mood}')`).includes(`data-motion-key="${key}"`),'story standing portrait matches expression');
   }
   g.run(`S=Object.assign(fresh(),{scr:'play',queue:[${n-1}],visible:true,beats:[{t:'say',w:'n',scene:'scene-paperwork'}],bi:0});`);
   assert.ok(!g.run('sceneHTML(true)').includes('data-motion-key'),'hidden sprites in separate scene photographs do not load video');
   g.run("S.beats=[{t:'card'}];");assert.ok(!g.run('sceneHTML(true)').includes('data-motion-key'),'hidden title-card sprites do not load video');
   g.run(`S.beats=[{t:'say',w:'s',feedback:{ok:true}}];`);
   const teacher=g.run('sceneHTML(true)');assert.equal((teacher.match(/data-motion-key=/g)||[]).length,1);assert.ok(teacher.includes('data-motion-key="mentor-smile"'));
   g.run('S.visible=false;S.beats=[{t:"say",w:"n"}];');assert.ok(!g.run('sceneHTML(true)').includes('data-motion-key'),'no animation after visitor leaves');
  }
  assert.equal(Object.keys(g.run('MOTION_ASSETS')).length,76,'56 visitor expressions, two mentor scenes and eighteen family-story scenes');
  const conversations=Object.keys(JSON.parse(fs.readFileSync(path.join(__dirname,'../motion/story-conversation-profiles.json'),'utf8')));
  for(const scene of ['scene-family-daughter-document','scene-family-daughter-talk','scene-family-daughter-waiting','scene-family-daughter-document-late','scene-family-manabe-evening','scene-family-kurose-card','scene-family-yoshida-wait','scene-family-manabe-envelope','scene-family-yoshida-counter','scene-family-kurose-lobby',...conversations]){
   assert.ok(g.run(`chapterArt('${scene}').includes('data-motion-key="${scene}"')`),'new scene uses the existing motion host');
   for(const variant of ['mobile','desktop']){
    const entry=manifest.find(e=>e.scene===scene&&e.variant===variant);
    assert.ok(entry);assert.equal(entry.audio,false);assert.equal(entry.seconds,8);assert.equal(entry.fps,20);
    assert.ok(fs.statSync(path.join(__dirname,'../motion',`${scene}-${variant}.mp4`)).size<(variant==='mobile'?200000:450000));
   }
  }
  for(const scene of conversations){
   const pages=g.run('CHAPTER_NODES.flatMap(n=>chapterPages(n))').filter(p=>p.scene===scene);
   assert.ok(pages.length,`added motion is actually used by the story: ${scene}`);
   for(const page of pages){
    const art=g.run(`chapterArt('${page.scene}')`);
    assert.equal((art.match(/data-motion-key=/g)||[]).length,1,'two-person shots still use one video');
   }
  }
  console.log('PASS all 14 visitors / four expressions, original mood aliases, normal and story hosts, static documents/notes, no hidden-sprite decoder, mentor switch.');
 },

 'portrait-motion': function(require,module,__filename,__dirname){
  const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
  const {engineSource}=require('./test-tools.cjs');
  const runtime=engineSource('portrait-motion.js');

  function fixture({reduced=false,saveData=false,mobile=true,reject=false,mask=true}={}){
    let host=null,time=0;const videos=[],listeners={},mediaListeners={},networkListeners={};
    const makeHost=(key,kind)=>({dataset:{motionKey:key,motionKind:kind},style:{},parentElement:{style:{},classes:new Set(),classList:{toggle(k,on){on?this.owner.add(k):this.owner.delete(k)}},querySelector(){return {visitorStill:true}}},appendChild(v){v.remove();this.video=v;v.parentElement=this;v.isConnected=true;}});
    class Video{
      constructor(){this.paused=true;this.isConnected=false;this.currentTime=0;this.style={};this.events={};this.attrs={};this.assignments=[];this.loads=0;this.plays=0;this.quality={totalVideoFrames:0,droppedVideoFrames:0};this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x)};}
      set src(value){this._src=value;this.assignments.push(value);this.currentTime=0;}
      get src(){return this._src;}
      setAttribute(k,v){this.attrs[k]=v;}
      removeAttribute(k){delete this.attrs[k];if(k==='src')this._src='';}
      addEventListener(k,fn){this.events[k]=fn;}
      remove(){if(this.parentElement)delete this.parentElement.video;this.parentElement=null;this.isConnected=false;}
      pause(){this.paused=true;}
      play(){this.plays++;if(reject)return Promise.reject(Error('autoplay denied'));this.paused=false;this.events.playing();return Promise.resolve();}
      load(){this.loads++;}
      getVideoPlaybackQuality(){return this.quality;}
    }
    const mq={matches:reduced,addEventListener:(name,fn)=>mediaListeners[name]=fn};
    const net={saveData,addEventListener:(name,fn)=>networkListeners[name]=fn};
    const document={hidden:false,createElement(name){assert.equal(name,'video');const v=new Video();videos.push(v);return v;},querySelector(q){return q==='[data-motion-key]'?host:null;},addEventListener:(name,fn)=>listeners[name]=fn};
    const state={scr:'play',panel:null,win:null,zoom:null,hint:false,beats:[{t:'say',w:'s'}],bi:0};
    const context={CSS:{supports:()=>mask},MOTION_ASSETS:{'mentor-scene':{mobile:'calm-small.mp4',desktop:'calm-large.mp4'},'mentor-smile':{mobile:'smile-small.mp4',desktop:'smile-large.mp4'},'c1-0':{mobile:'c1-calm-small.mp4',desktop:'c1-calm-large.mp4'},'c1-1':{mobile:'c1-happy-small.mp4',desktop:'c1-happy-large.mp4'}},S:state,beat:()=>state.beats[state.bi],matchMedia:q=>q.includes('reduced')?mq:{matches:mobile},navigator:{connection:net},document,window:{addEventListener:(name,fn)=>listeners[name]=fn},getComputedStyle:el=>el.visitorStill?{backgroundPosition:'100% 0%',backgroundImage:'url(character.webp)'}:{backgroundPosition:'69% 50%'},Date:{now:()=>time},render:()=>context.api.sync()};
    vm.createContext(context);vm.runInContext(runtime+'\nthis.api=PORTRAIT_MOTION;',context);
    return {api:context.api,run:s=>vm.runInContext(s,context),document,state,videos,mq,net,listeners,mediaListeners,networkListeners,setHost(key,kind){host=key?makeHost(key,kind):null;if(host)host.parentElement.classList.owner=host.parentElement.classes;return host;},step(total,dropped){time+=5001;const v=videos[0];v.quality={totalVideoFrames:total,droppedVideoFrames:dropped};v.events.timeupdate();}};
  }

  (async()=>{
    for(const options of [{},{reduced:true},{saveData:true}]){
      const f=fixture(options);assert.equal(f.api.preference(),'on','motion starts enabled on mobile');
      f.setHost('mentor-scene');f.api.sync();assert.equal(f.videos.length,1);assert.equal(f.videos[0].src,'calm-small.mp4','default motion uses only the mobile asset');
      f.api.set('auto');assert.equal(f.videos[0].src,options.reduced||options.saveData?'':'calm-small.mp4','automatic mode still respects reduced motion and data saving');
      f.api.set('on');assert.equal(f.videos.length,1,'animation reuses the same decoder');
      f.api.set('off');assert.ok(f.videos[0].paused);assert.equal(f.videos[0].src,'');
      const assignments=f.videos[0].assignments.length;
      f.api.beforeRender();f.setHost('mentor-smile');f.api.sync();f.listeners.pageshow();f.mediaListeners.change();f.networkListeners.change();
      assert.equal(f.api.preference(),'off');assert.equal(f.videos[0].src,'');assert.equal(f.videos[0].assignments.length,assignments,'manual still choice survives scene changes and device events');
    }
    const f=fixture();f.api.sync();assert.equal(f.videos.length,0,'title / non-portrait pages fetch nothing');
    f.setHost('mentor-scene');f.api.sync();const v=f.videos[0];
    assert.equal(v.src,'calm-small.mp4');assert.ok(v.muted&&v.defaultMuted&&v.playsInline&&v.loop);assert.equal(v.controls,false);assert.equal(v.preload,'none');assert.equal(v.style.objectPosition,'69% 50%');
    assert.ok(v.classes.has('is-playing'));
    v.currentTime=4;
    for(let i=0;i<20;i++){f.api.beforeRender();f.setHost('mentor-scene');f.api.sync();}
    assert.equal(f.videos.length,1);assert.equal(v.assignments.length,1,'text re-renders reuse the decoder and source');assert.equal(v.currentTime,4);assert.equal(v.plays,1);
    for(const panel of ['menu','ref','chapter-notes']){
      f.state.panel=panel;f.api.beforeRender();f.setHost('mentor-scene');f.api.sync();assert.ok(v.paused);
      f.state.panel=null;f.api.sync();assert.equal(v.paused,false);assert.equal(v.assignments.length,1);
    }
    f.state.win='term';f.api.sync();assert.ok(v.paused);f.state.win=null;f.api.sync();
    f.document.hidden=true;f.listeners.visibilitychange();assert.ok(v.paused);f.document.hidden=false;f.listeners.visibilitychange();assert.equal(v.paused,false);
    f.listeners.pagehide();assert.ok(v.paused);f.listeners.pageshow();assert.equal(v.paused,false);
    f.setHost('mentor-smile');f.api.sync();assert.equal(v.src,'smile-small.mp4');assert.equal(f.videos.length,1,'switch expressions on one decoder');
    f.setHost(null);f.api.sync();assert.ok(v.paused);assert.equal(v.src,'');assert.equal(v.isConnected,false,'leaving a portrait releases the decoder source');
    const noMask=fixture({mask:false});noMask.setHost('c1-0','visitor');noMask.api.sync();assert.equal(noMask.videos.length,0,'unsupported alpha masks leave the original still intact');
    const visitors=fixture();let cutout=visitors.setHost('c1-0','visitor');visitors.api.sync();const cv=visitors.videos[0];
    assert.equal(cutout.style.maskImage,'url(character.webp)');assert.equal(cutout.style.webkitMaskImage,'url(character.webp)');assert.equal(cutout.style.maskPosition,'100% 0%');assert.ok(cutout.parentElement.classes.has('is-moving'));
    cv.currentTime=3.2;visitors.api.beforeRender();assert.equal(cutout.parentElement.classes.has('is-moving'),false);cutout=visitors.setHost('c1-0','visitor');visitors.api.sync();assert.equal(cv.assignments.length,1);assert.equal(cutout.parentElement.style.animationDelay,'-3.2s');assert.ok(cutout.parentElement.classes.has('is-moving'));
    visitors.state.panel='menu';visitors.api.sync();assert.equal(cutout.parentElement.classes.has('is-moving'),false);assert.ok(cv.paused);visitors.state.panel=null;visitors.api.sync();assert.ok(cutout.parentElement.classes.has('is-moving'));
    cutout=visitors.setHost('c1-1','visitor');visitors.api.sync();assert.equal(cv.src,'c1-happy-small.mp4');assert.equal(visitors.videos.length,1);
    visitors.api.set('off');assert.equal(cutout.parentElement.classes.has('is-moving'),false);assert.equal(cv.src,'');
    const d=fixture({mobile:false});d.setHost('mentor-scene');d.api.sync();assert.equal(d.videos[0].src,'calm-large.mp4');
    d.api.set('auto');d.net.saveData=true;d.networkListeners.change();assert.equal(d.videos[0].src,'');
    d.net.saveData=false;d.networkListeners.change();d.mq.matches=true;d.mediaListeners.change();assert.equal(d.videos[0].src,'');
    const slow=fixture();slow.setHost('mentor-scene');slow.api.sync();slow.step(0,0);slow.step(100,25);slow.step(200,50);assert.ok(slow.videos[0].paused);assert.equal(slow.videos[0].src,'');assert.match(slow.api.note(),/重い/);slow.api.sync();assert.equal(slow.videos[0].assignments.length,1,'performance fallback does not retry every render');
    const stalls=fixture();stalls.setHost('mentor-scene');stalls.api.sync();stalls.videos[0].currentTime=2;for(let i=0;i<3;i++)stalls.videos[0].events.waiting();assert.match(stalls.api.note(),/重い/);
    const missing=fixture();missing.setHost('mentor-scene');missing.api.sync();missing.videos[0].events.error();missing.api.sync();assert.equal(missing.videos[0].assignments.length,1);assert.equal(missing.videos[0].src,'');assert.match(missing.api.note(),/再生できない/);
    const denied=fixture({reject:true});denied.setHost('mentor-scene');denied.api.sync();await Promise.resolve();assert.equal(denied.videos[0].src,'');assert.match(denied.api.note(),/再生できない/);
    f.state.beats=[{t:'say',w:'s',feedback:{ok:true}}];assert.equal(f.run('normalMotionKey()'),'mentor-smile');f.state.beats=[{t:'say',w:'s',scene:'scene-guidance'}];assert.equal(f.run('normalMotionKey()'),'');f.state.beats=[{t:'say',w:'v'}];assert.equal(f.run('normalMotionKey()'),'');
    console.log('PASS portrait motion: mobile default on, lazy single decoder, repeated renders, expression / mobile selection, overlay and hidden-tab pause, source release, automatic reduced motion / save data, playback rejection / missing file / dropped frames / stalls, retained manual still controls.');
  })().catch(e=>{console.error(e);process.exitCode=1;});
 },

 'sound-controls': function(require,module,__filename,__dirname){
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
  const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const source=html.slice(html.indexOf('const audioChannels ='),html.indexOf('/* Photographic Japanese sample-card'));
  const story=JSON.parse(fs.readFileSync(path.join(root,'story-family.json')));
  const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
  // A separate authored-silence fixture keeps coverage for other scenario packs.
  const silentSpans=[['memo','memo-000','memo-001'],['stairs','stairs-001','stairs-008'],['noon','noon-002','noon-015'],['daughter','daughter-005','daughter-011'],['phone','phone-008'],['outside','outside-000--1'],['r0','paper-morning-copy','paper-morning-doubt'],['safety','paper-effect-discovered']];
  const withQuietRanges=src=>src.replace(/const sceneSounds\s*=\s*direction.effects\s*\|\|\s*\{\};/,`direction.silence=${JSON.stringify(silentSpans.map(([node,from,through])=>({node,from,through})))};const sceneSounds=direction.effects||{};`);

  function setup(options={}){
   let now=0,seq=0,ac,media;const timers=new Map(),intervals=new Map(),gains=[],events={},calls=[],storage=new Map(Object.entries(options.storage||{}));
   const param=()=>({value:0,ramps:[],cancelScheduledValues(){},cancelAndHoldAtTime(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v,t){this.ramps.push({value:v,time:t});this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
   const node=()=>({gain:param(),frequency:param(),detune:param(),Q:param(),threshold:param(),ratio:param(),connect(n){return n;},disconnect(){},start(){calls.push("synth");},stop(){}});
   class AudioContext{
    constructor(){ac=this;this.state=options.state||'suspended';this.sampleRate=1000;this.destination={};this.events={};}
    get currentTime(){return now/1000;}
    createGain(){const n=node();gains.push(n);return n;}
    createOscillator(){return node();}createBufferSource(){return node();}createBiquadFilter(){return node();}createDynamicsCompressor(){return node();}
    createMediaElementSource(){calls.push('media-source');return node();}
    createAnalyser(){return {...node(),getFloatTimeDomainData(data){data.fill(0);}};}
    createBuffer(_,count){return {getChannelData:()=>new Float32Array(count)};}
    addEventListener(k,fn){this.events[k]=fn;}
    resume(){calls.push('resume');if(options.resumeError)return Promise.reject(new Error('interrupted'));if(options.resumeDeferred)return new Promise(resolve=>this.resolveResume=()=>{this.state='running';resolve();});this.state='running';return Promise.resolve();}
    suspend(){calls.push('suspend');this.state='suspended';return Promise.resolve();}
   }
   const parts=Object.fromEntries(['audio-live','audio-master','audio-quick','audio-preview-music','audio-preview-effects','audio-preview-room'].map(id=>[id,{textContent:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;},querySelector(){return this.state??={textContent:''};}}]));
   const listen=(k,fn)=>(events[k]??=[]).push(fn);
   const S={sound:true,panel:'settings',settingsTab:'sound',scr:'title',mode:'normal'},document={hidden:false,getElementById:id=>parts[id]||null,addEventListener:listen,body:{appendChild(){calls.push('append');}},createElement(tag){assert.equal(tag,'audio');
     media={paused:true,readyState:4,currentTime:0,error:null,events:{},setAttribute(){},addEventListener(k,fn){this.events[k]=fn;},load(){calls.push('load');this.error=null;},play(){calls.push('play');if(options.playError)return Promise.reject(Object.assign(new Error('denied'),{name:options.playError}));this.paused=false;return Promise.resolve();},pause(){if(!this.paused){calls.push('pause');this.paused=true;this.events.pause?.();}}};return media;
   }};
   const navigator={audioSession:{type:'auto'}};
   const context={Element:class{static [Symbol.hasInstance](v){return !!v&&typeof v.closest==='function';}},S,FAMILY_BAD_ENDINGS:story.bad_endings,document,navigator,Date:{now:()=>now},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{...(options.audio===false?{}:{AudioContext}),addEventListener:listen},FX:{},Float32Array,Math,Object,Promise,chapterNode:id=>story.nodes.find(n=>n.id===id),chapterPages:n=>n.pages||[],pacingFrontier:()=>story.nodes.find(n=>n.id===options.frontier),
    setTimeout:(fn,delay)=>{timers.set(++seq,{fn,at:now+delay});return seq;},clearTimeout:id=>timers.delete(id),
    setInterval:fn=>{intervals.set(++seq,fn);return seq;},clearInterval:id=>intervals.delete(id)};
   vm.createContext(context);vm.runInContext((options.transformSource?options.transformSource(source):source)+';this.sound=SOUND;this.ui=soundControls;',context);
   return {s:context.sound,S,gains,parts,ui:context.ui,calls,options,storage,navigator,get ac(){return ac;},get media(){return media;},event(k,e={}){for(const f of events[k]||[])f(e);},hide(value){document.hidden=value;this.event('visibilitychange');},step(ms){now+=ms;for(const [id,t] of [...timers])if(t.at<=now){timers.delete(id);t.fn();}for(const fn of intervals.values())fn();}};
  }
  function muted(options={}){
   const g=setup({...options,storage:{'madoguchi-sound-v2':JSON.stringify({sound:false,enabled:{music:false,effects:false,room:false}}),...options.storage}});
   g.s.sync();return g;
  }
  (async()=>{
  assert.equal(require('./test-harness.cjs').boot().run('fresh().sound'),true,'game starts with master sound on');
  const fresh=setup();fresh.s.sync();assert.equal(fresh.media,undefined,'ON default still waits for a user gesture');assert.equal(fresh.s.enabled.music,true);assert.equal(fresh.s.enabled.effects,true);assert.equal(fresh.s.enabled.room,false,'room starts off');assert.equal(fresh.s.levels.music,.50,'quieter default music');
  fresh.event('click');await flush();assert.equal(fresh.media.paused,false,'first ordinary interaction starts music');
  fresh.media.currentTime=17;fresh.s.toggle();assert.equal(fresh.media.paused,true);assert.equal(fresh.parts['audio-quick'].attrs['aria-label'],'音をONにする');assert.equal(fresh.parts['audio-quick'].state.textContent,'OFF');
  fresh.s.toggle();await flush();assert.equal(fresh.media.paused,false);assert.equal(fresh.media.currentTime,17);assert.equal(fresh.parts['audio-quick'].attrs['aria-label'],'音をOFFにする');assert.equal(fresh.parts['audio-quick'].state.textContent,'ON');
  const savedRoom=setup({storage:{'madoguchi-sound-v2':JSON.stringify({sound:true,enabled:{room:true},levels:{music:.37}})}});assert.equal(savedRoom.s.enabled.room,true,'explicit room preference survives');assert.equal(savedRoom.s.levels.music,.37,'custom music level survives');
  // Unknown storage is validated before entering the typed preferences boundary.
  for(const raw of ['null','[]','12','"invalid"']){
   const malformed=setup({storage:{'madoguchi-sound-v2':raw}});malformed.s.sync();
   assert.equal(malformed.s.levels.music,.50);assert.equal(malformed.s.enabled.room,false);assert.equal(malformed.S.sound,true);
  }
  const malformed=setup({storage:{'madoguchi-sound-v2':JSON.stringify({sound:'on',levels:{music:'0.2',master:9,room:-2,other:.7},enabled:{music:'off',room:true,other:true}})}});malformed.s.sync();
  assert.equal(malformed.s.levels.music,.50);assert.equal(malformed.s.levels.master,1);assert.equal(malformed.s.levels.room,0);
  assert.equal(malformed.s.enabled.music,true);assert.equal(malformed.s.enabled.room,true);assert.equal(malformed.s.levels.other,undefined);assert.equal(malformed.s.enabled.other,undefined);
  const firstMute=setup();firstMute.s.sync();firstMute.event('click',{target:{closest:()=>({dataset:{act:'snd'}})}});firstMute.s.toggle();
  assert.equal(firstMute.S.sound,false);assert.equal(firstMute.ac,undefined,'a first-action mute never starts audio');assert.equal(firstMute.media,undefined);
  const legacy=muted();legacy.s.toggle();await flush();assert.equal(legacy.media.paused,false,'quick ON also works for legacy all-channel-OFF preferences');assert.equal(legacy.s.enabled.music,true);assert.equal(legacy.s.enabled.effects,false);assert.equal(legacy.s.enabled.room,false);
  const g=muted();g.s.sync();assert.equal(g.media,undefined,'no media request before user gesture');assert.ok(Object.values(g.s.enabled).every(v=>v===false),'saved channel OFF preferences survive the new defaults');
  g.event('click');g.s.sfx('call');g.hide(true);g.hide(false);g.event('pageshow');assert.equal(g.S.sound,false);assert.equal(g.s.status(),'消音中');assert.equal(g.ac,undefined,'ordinary taps do not initialize audio while off');assert.equal(g.media,undefined,'no music loads while off');
  g.s.preview('music');await flush();g.step(6000);assert.equal(g.S.sound,false,'preview restores saved silence');assert.equal(g.s.enabled.music,false);assert.equal(g.media.paused,true);
  g.s.channel('music');g.s.channel('effects');await flush();assert.equal(g.s.status(),'再生中');assert.equal(g.navigator.audioSession.type,'playback');assert.equal(g.media.loop,true);
  assert.equal(g.calls.filter(c=>c==='media-source').length,1);assert.ok(g.media.src.startsWith('data:audio/mpeg;base64,'));
  assert.equal((g.ui().match(/data-act="audio-channel"/g)||[]).length,3);assert.equal((g.ui().match(/type="range"/g)||[]).length,4);assert.ok(!g.ui().includes('disabled'));
  const starts=g.calls.filter(c=>c==='play').length;
  for(let i=0;i<10;i++){g.s.unlock();g.s.sync();}await flush();assert.equal(g.calls.filter(c=>c==='append').length,1);assert.equal(g.calls.filter(c=>c==='play').length,starts,'text advances do not restart music');
  const reloadOn=setup({storage:Object.fromEntries(g.storage)});reloadOn.s.sync();assert.equal(reloadOn.S.sound,true,'explicit ON survives reload');assert.equal(reloadOn.s.enabled.music,true);assert.equal(reloadOn.s.enabled.effects,true);assert.equal(reloadOn.s.enabled.room,false);reloadOn.s.unlock();await flush();assert.equal(reloadOn.media.paused,false);
  g.s.channel('effects');assert.equal(g.gains[2].gain.value,0);g.s.channel('effects');assert.equal(g.gains[2].gain.value,.62);
  g.s.channel('music');assert.equal(g.media.paused,true);g.s.set('music',37);g.s.preview('music');await flush();assert.equal(g.gains[1].gain.value,.37);assert.equal(g.gains[2].gain.value,0);assert.equal(g.s.enabled.music,false,'preview does not enable channel');assert.equal(g.parts['audio-preview-music'].textContent,'停止');
  g.s.preview('music');assert.equal(g.media.paused,true);assert.equal(g.gains[2].gain.value,.62);
  g.s.toggle();assert.equal(g.S.sound,false);g.s.preview('music');g.s.set('music',37);assert.equal(JSON.parse(g.storage.get('madoguchi-sound-v2')).sound,false,'preview volume edit does not persist temporary unmute');g.s.preview('room');g.step(6000);assert.equal(g.S.sound,false);assert.equal(g.parts['audio-live'].textContent,'すべて消音中');
  g.s.preview('music');g.s.toggle();g.step(6000);assert.equal(g.S.sound,false,'manual mute cancels preview');
  g.s.preview('music');g.s.channel('music');g.step(6000);await flush();assert.equal(g.S.sound,true);assert.equal(g.s.enabled.music,true);
  g.s.preview('room');g.S.panel=null;g.s.sync();await flush();assert.equal(g.s.previewing(),'');assert.equal(g.gains[1].gain.value,.37);assert.equal(g.media.paused,false,'closing preview restores normal BGM');
  g.s.set('master',200);assert.equal(g.s.levels.master,1);g.s.set('effects',-1);assert.equal(g.s.levels.effects,0);
  g.media.currentTime=53;g.hide(true);assert.equal(g.media.paused,true);assert.equal(g.ac.state,'suspended');g.hide(false);await flush();assert.equal(g.media.paused,false);assert.equal(g.media.currentTime,53);assert.equal(g.ac.state,'running');
  g.event('pagehide');assert.equal(g.media.paused,true);g.event('pageshow');await flush();assert.equal(g.media.paused,false);
  g.ac.state='interrupted';g.event('click',{target:{closest:()=>null}});await flush();assert.equal(g.ac.state,'running','bare text tap recovers interrupted Safari context');
  g.s.toggle();g.hide(true);g.hide(false);g.event('pageshow');g.event('click');await flush();assert.equal(g.media.paused,true,'never unmute on return/tap');
  const reload=setup({storage:Object.fromEntries(g.storage)});reload.s.sync();reload.s.unlock();assert.equal(reload.S.sound,false);assert.equal(reload.s.levels.music,.37);assert.equal(reload.media,undefined);
  const refused=muted({playError:'NotAllowedError'});refused.s.channel('music');await flush();assert.equal(refused.s.status(),'再生待ち');assert.ok(refused.s.description().includes('タップ'));refused.options.playError=null;refused.event('click');await flush();assert.equal(refused.s.status(),'再生中');
  const net=muted({playError:'NotSupportedError'});net.s.channel('music');await flush();assert.equal(net.s.status(),'読込エラー');net.options.playError=null;net.media.error={code:2};net.s.preview('music');await flush();assert.ok(net.calls.includes('load'));assert.equal(net.s.status(),'再生中');
  const safari=muted({resumeDeferred:true});safari.s.channel('music');assert.deepEqual(safari.calls.filter(c=>c!=='synth').slice(0,5),['resume','append','media-source','load','play'],'resume and play both happen before awaiting Safari promises');assert.equal(safari.s.status(),'再生待ち');safari.ac.resolveResume();await flush();assert.equal(safari.s.status(),'再生中');
  const failedCtx=muted({resumeError:true});failedCtx.s.channel('music');await flush();assert.equal(failedCtx.s.status(),'再生待ち');failedCtx.options.resumeError=false;failedCtx.event('click');await flush();assert.equal(failedCtx.s.status(),'再生中');
  const fallback=muted({audio:false});fallback.s.channel('music');await flush();assert.equal(fallback.media.paused,false,'native media works without Web Audio');fallback.s.toggle();fallback.s.preview('room');fallback.step(6000);assert.equal(fallback.S.sound,false);
  const tab=muted();tab.s.preview('music');await flush();assert.equal(tab.media.paused,false);
  tab.S.settingsTab='display';tab.s.sync();await flush();
  assert.equal(tab.s.previewing(),'');assert.equal(tab.S.sound,false);assert.equal(tab.media.paused,true,'leaving the sound tab cancels preview and restores mute');
  tab.S.settingsTab='sound';tab.s.sync();assert.equal(tab.media.paused,true,'returning to the tab does not start sound');
  assert.ok(tab.ui().includes('aria-label="BGMを試聴"'));
  const scene=muted({transformSource:withQuietRanges});
  function visit(node,key='',g=scene,settle=true){
   g.S.mode='story';g.S.scr='multi';
   const n=story.nodes.find(n=>n.id===node),index=key?n.pages.findIndex(p=>p.key===key):0;
   assert.ok(index>=0,'story page exists: '+key);
   Object.assign(g.S.chapter??={}, {node,view:'read',page:index});g.s.sync();if(settle)g.step(650);
  }
  visit('memo','memo-002');assert.equal(scene.s.cue(),'story-morning');assert.equal(scene.media,undefined,'story browsing while OFF never loads music');
  scene.s.channel('music');await flush();assert.equal(scene.media.src,scene.s.tracks['story-morning'].source);
  scene.media.currentTime=41;visit('deduction');await flush();assert.equal(scene.media.src,scene.s.tracks['story-investigation'].source);assert.equal(scene.media.currentTime,0);
  visit('memo','memo-002');await flush();assert.equal(scene.media.currentTime,41,'rereading resumes the chapter track position');
  scene.S.chapter.view='timeline';scene.S.chapter.node=null;scene.s.sync();assert.equal(scene.s.cue(),'story-morning');
  visit('noon','noon-004c');assert.equal(scene.media.paused,true);assert.equal(scene.s.cue(),null);assert.equal(scene.S.sound,true,'rescue silence does not overwrite the user preference');
  scene.s.preview('music');await flush();assert.equal(scene.media.src,scene.s.tracks['story-afternoon'].source,'preview in silence uses this chapter, not the last chapter');scene.step(6000);scene.step(650);assert.equal(scene.media.paused,true,'preview restores scripted silence after fading');
  visit('phone','phone-007');await flush();assert.equal(scene.s.cue(),'story-investigation');visit('phone','phone-008');assert.equal(scene.media.paused,true);
  scene.S.chapter.view='timeline';scene.S.chapter.node=null;scene.s.sync();assert.equal(scene.s.cue(),null,'the phone pause remains silent in the timeline');
  visit('deduction');await flush();assert.equal(scene.s.cue(),'story-investigation');visit('safety');await flush();assert.equal(scene.s.cue(),'story-return');
  visit('outside','outside-000');assert.equal(scene.s.cue(),'story-return');visit('outside','outside-000--1');assert.equal(scene.media.paused,true);
  scene.S.chapter.view='end';scene.s.sync();scene.step(650);await flush();assert.equal(scene.media.src,scene.s.tracks['story-ending'].source,'FIN keeps its separate closing music');
  scene.S.scr='title';scene.s.sync();scene.step(650);await flush();assert.equal(scene.media.src,scene.s.tracks.counter.source);
  assert.equal(scene.calls.filter(c=>c==='append').length,1,'all chapter themes share one media element');assert.equal(scene.calls.filter(c=>c==='media-source').length,1);
  scene.s.toggle();const loads=scene.calls.filter(c=>c==='load').length;visit('memo');visit('safety');assert.equal(scene.calls.filter(c=>c==='load').length,loads,'muted scene changes do not fetch tracks');
  // No source replacement or pause before a fade has finished; rapid scene changes stay safe.
  const fade=setup({state:'running',transformSource:withQuietRanges});fade.S.panel=null;fade.s.unlock();await flush();
  const initialSource=fade.media.src;
  visit('r0','r0-000',fade,false);
  assert.equal(fade.media.paused,false);assert.equal(fade.media.src,initialSource);
  assert.ok(fade.gains[1].gain.ramps.some(r=>r.value===0&&r.time===.65),'old track fades out for 650 ms');
  fade.step(300);assert.equal(fade.media.src,initialSource);assert.equal(fade.media.paused,false);
  visit('daughter','daughter-000',fade,false);fade.step(350);await flush();
  assert.equal(fade.media.src,fade.s.tracks['story-afternoon'].source,'latest requested scene wins the pending fade');
  assert.ok(fade.gains[1].gain.ramps.some(r=>r.value>0&&r.time>=1.85),'next track fades in for 1.2 seconds');
  visit('daughter','daughter-005',fade,false);assert.equal(fade.media.paused,false,'scripted silence fades rather than pausing immediately');
  fade.step(650);assert.equal(fade.media.paused,true);
  visit('daughter','daughter-012',fade);await flush();
  visit('r0','r0-000',fade,false);fade.s.toggle();assert.equal(fade.media.paused,true,'manual mute is immediate');
  const mutedSource=fade.media.src;fade.step(1000);assert.equal(fade.media.src,mutedSource,'cancelled transition cannot start while muted');
  fade.s.toggle();await flush();visit('daughter','daughter-000',fade,false);fade.hide(true);fade.step(1000);assert.equal(fade.media.paused,true,'hidden tabs cancel pending transitions');
  fade.hide(false);await flush();assert.equal(fade.media.src,fade.s.tracks['story-afternoon'].source);
  visit('daughter','daughter-005',fade,false);visit('daughter','daughter-012',fade,false);fade.step(1000);await flush();assert.equal(fade.media.paused,false,'returning during fade does not stop the same track later');

  // Chapter themes include cards and form exercises; explicit late-story scenes override them.
  visit('r0','r0-000');assert.equal(scene.s.cue(),'story-morning');
  visit('r0','r0-008');assert.equal(scene.s.cue(),'story-morning');
  visit('r1','r1-009');assert.equal(scene.s.cue(),'story-morning','the false husband claim has no ominous music hint');
  visit('r2');scene.S.scr='play';scene.s.sync();assert.equal(scene.s.cue(),'story-morning');
  visit('daughter','daughter-000');assert.equal(scene.s.cue(),'story-afternoon');
  scene.S.scr='play';scene.s.sync();assert.equal(scene.s.cue(),'story-afternoon','daughter form response keeps the chapter music');
  scene.S.scr='multi';scene.S.chapter.view='chapter';scene.S.chapter.introNode='phone';scene.s.sync();assert.equal(scene.s.cue(),null,'dark chapter card pauses music');
  scene.S.chapter.view='bridge';scene.options.frontier='noon';scene.s.sync();assert.equal(scene.s.cue(),null,'dark chapter bridge pauses music');
  // Scene overrides survive reopening/re-reading and cannot leak into normal mode.
  assert.equal(scene.S.sound,false);scene.s.toggle();await flush();
  visit('safety');await flush();assert.equal(scene.s.cue(),'story-return');
  scene.media.currentTime=23;
  visit('report');await flush();assert.equal(scene.s.cue(),'story-investigation');
  visit('next_morning');await flush();assert.equal(scene.s.cue(),'story-return');assert.equal(scene.media.currentTime,23);
  visit('safety','paper-effect-discovered');assert.equal(scene.s.cue(),null,'silence takes precedence over a scene override');
  scene.s.preview('music');await flush();assert.equal(scene.media.src,scene.s.tracks['story-return'].source);scene.step(6000);scene.step(650);assert.equal(scene.media.paused,true);
  scene.S.mode='normal';scene.S.scr='play';scene.s.sync();scene.step(650);await flush();
  assert.equal(scene.s.cue(),'counter');assert.equal(scene.media.src,scene.s.tracks.counter.source);
  assert.equal(scene.gains[1].gain.value,scene.s.levels.music,'normal-mode gain is unchanged');
  // Normal results have their own Jazz cue; review and mute must not restart it.
  const results=setup({state:'running'});results.S.panel=null;results.S.scr='play';results.s.unlock();await flush();
  const counterSource=results.media.src;
  results.S.scr='end';results.s.sync();
  assert.equal(results.media.src,counterSource,'the result transition fades the counter track first');
  results.step(650);await flush();
  assert.equal(results.media.src,results.s.tracks['story-ending'].source,'normal results use Almost New');
  results.media.currentTime=17;const resultLoads=results.calls.filter(c=>c==='load').length;
  results.S.panel='log';results.s.sync();results.S.panel=null;results.s.sync();
  assert.equal(results.media.currentTime,17);assert.equal(results.calls.filter(c=>c==='load').length,resultLoads,'result review keeps the same playback position');
  results.hide(true);assert.equal(results.media.paused,true);results.hide(false);await flush();
  assert.equal(results.media.currentTime,17,'returning from background keeps the result position');
  results.s.toggle();results.S.scr='play';results.s.sync();results.S.scr='end';results.s.sync();
  assert.equal(results.media.paused,true);assert.equal(results.calls.filter(c=>c==='load').length,resultLoads,'muted result navigation never fetches music');
  results.s.toggle();await flush();assert.equal(results.media.src,results.s.tracks['story-ending'].source);
  results.S.scr='play';results.s.sync();results.step(650);await flush();
  assert.equal(results.media.src,counterSource,'retry returns to the counter Jazz');
  results.S.scr='end';results.s.sync();results.step(650);await flush();
  results.S.scr='title';results.s.sync();results.step(650);await flush();
  assert.equal(results.media.src,counterSource,'returning to the title restores the counter Jazz');
  // Check audible/silent boundaries against the actual manuscript, not the wall clock.
  const quiet=setup({state:'running',transformSource:withQuietRanges});quiet.s.channel('room');quiet.s.unlock();await flush();quiet.S.panel=null;

  for(const node of story.nodes){
   for(const [i,page] of node.pages.entries()){
    const span=silentSpans.find(r=>r[0]===node.id);
    const mutedPage=span&&i>=node.pages.findIndex(p=>p.key===span[1])&&(!span[2]||i<=node.pages.findIndex(p=>p.key===span[2]));
    visit(node.id,page.key,quiet);await flush();
    assert.equal(quiet.s.cue(),mutedPage?null:(['safety','next_morning','outside'].includes(node.id)?'story-return':({ch1:'story-morning',ch2:'story-afternoon',ch3:'story-investigation'})[node.block]),page.key);
    if(mutedPage){
     assert.equal(quiet.media.paused,true,page.key+' pauses BGM');
     assert.equal(quiet.gains[1].gain.value,0);assert.equal(quiet.gains[2].gain.value,quiet.s.levels.effects);assert.equal(quiet.gains[3].gain.value,0);
     const count=quiet.calls.filter(c=>c==='synth').length;quiet.s.sfx('turn');quiet.s.sfx('call');
     assert.equal(quiet.calls.filter(c=>c==='synth').length,count,'no UI sounds in '+page.key);
    }
   }
  }
  visit('noon','noon-004c',quiet);quiet.S.panel='settings';quiet.S.settingsTab='sound';
  quiet.s.preview('room');assert.equal(quiet.gains[3].gain.value,quiet.s.levels.room);quiet.step(6000);assert.equal(quiet.gains[3].gain.value,0,'room preview returns to complete silence');
  quiet.hide(true);quiet.hide(false);await flush();assert.equal(quiet.media.paused,true,'background recovery preserves the quiet range');
  visit('noon','noon-017',quiet);await flush();assert.equal(quiet.media.paused,false);assert.equal(quiet.gains[3].gain.value,quiet.s.levels.room);
  const loaded=quiet.calls.filter(c=>c==='load').length;quiet.media.currentTime=37;
  visit('daughter','daughter-005',quiet);visit('daughter','daughter-012',quiet);await flush();
  assert.equal(quiet.calls.filter(c=>c==='load').length,loaded,'silence never reloads the chapter music');assert.equal(quiet.media.currentTime,37,'the chapter music continues at its held position');
  Object.assign(quiet.S.chapter,{view:'bad',badEnding:'wrong_issue',badPage:story.bad_endings.wrong_issue.pages.length});quiet.s.sync();assert.equal(quiet.s.cue(),null);assert.equal(quiet.gains[2].gain.value,quiet.s.levels.effects);assert.equal(quiet.gains[3].gain.value,0);
  const fx=setup({state:'running'});fx.s.unlock();await flush();fx.S.panel=null;
  const events=()=>fx.calls.filter(c=>c==='synth').length;
  const beforeNavigation=events();
  for(let i=0;i<20;i++){fx.s.sfx('select');fx.s.sfx('turn');fx.s.sfx('unknown-effect');}
  assert.equal(events(),beforeNavigation,'repeated navigation and unknown cues stay silent');
  const savedLevels=JSON.stringify(fx.s.levels);
  fx.s.sfx('paper');fx.s.sfx('stamp');fx.s.sfx('call');
  assert.equal(JSON.stringify(fx.s.levels),savedLevels,'softer effects do not overwrite saved volume preferences');
  for(const kind of ['card','envelope','keyboard','printer','ticket','coins','chair','steps','door','receiver','telephone','mobile','water','arrival']){
   const before=events();fx.s.sfx(kind);assert.ok(events()>before,kind+' produces sound');
  }
  fx.S.mode='story';fx.S.scr='multi';fx.S.chapter={node:'phone',view:'read',page:0};
  const first=events();visit('phone','phone-004',fx);assert.ok(events()>first);
  const once=events();fx.s.sync();fx.s.sync();assert.equal(events(),once,'rerender does not ring again');
  fx.S.panel='settings';fx.s.sync();fx.S.panel=null;fx.s.sync();assert.equal(events(),once,'closing settings does not replay a scene sound');
  fx.S.chapter.view='timeline';fx.s.sync();fx.S.chapter.view='read';fx.s.sync();assert.equal(events(),once,'returning from timeline does not ring again');
  fx.s.toggle();visit('stairs','stairs-036',fx);assert.equal(events(),once,'muted pages produce no effect');fx.s.toggle();fx.s.sync();assert.equal(events(),once,'unmute does not play a missed event');
  fx.hide(true);visit('next_morning','next_morning-015',fx);fx.hide(false);await flush();fx.s.sync();assert.equal(events(),once,'returning from background never plays missed sounds');
  fx.s.channel('effects');fx.s.sfx('telephone');assert.equal(events(),once,'the effects switch suppresses the added sounds');
  // A ringtone follows the displayed sentence, even in a BGM-free ending.
  const ring=setup({state:'running',transformSource:withQuietRanges});ring.S.panel=null;ring.s.unlock();await flush();
  const countRing=()=>ring.calls.filter(c=>c==='synth').length;
  visit('outside','paper-closing-light',ring);const beforeRing=countRing();
  ring.s.revealStorySound('paper-closing-light','係長と一緒に、書類を保管袋へ戻した。');assert.equal(countRing(),beforeRing);
  ring.s.revealStorySound('paper-closing-light','真鍋さんの携帯が鳴る。');assert.ok(countRing()>beforeRing,'diegetic mobile rings over silence');
  const afterRing=countRing();ring.s.revealStorySound('paper-closing-light','真鍋さんの携帯が鳴る。');ring.s.sync();assert.equal(countRing(),afterRing,'one ringtone per encounter');
  visit('stairs','stairs-036',ring);ring.s.toggle();ring.s.revealStorySound('stairs-036','真鍋さんの携帯が鳴った。');ring.s.toggle();ring.s.revealStorySound('stairs-036','真鍋さんの携帯が鳴った。');assert.equal(countRing(),afterRing,'muted text consumes its event');
  visit('outside','paper-closing-light',ring);ring.hide(true);ring.hide(false);await flush();ring.s.revealStorySound('paper-closing-light','真鍋さんの携帯が鳴る。');assert.equal(countRing(),afterRing,'background recovery does not replay a pending event');

  // Manuscript line wrapping and dialogue spacing must not lose a timed cue.
  const wrapped=setup({state:'running',transformSource:s=>s.replace('真鍋さんの携帯が鳴る。','真鍋さんの\\n携帯が鳴る。')});
  wrapped.S.panel=null;wrapped.s.unlock();await flush();visit('outside','paper-closing-light',wrapped);
  const beforeWrapped=wrapped.calls.filter(c=>c==='synth').length;
  wrapped.s.revealStorySound('paper-closing-light','真鍋さんの携帯が鳴');
  assert.equal(wrapped.calls.filter(c=>c==='synth').length,beforeWrapped,'a partial marker stays silent');
  wrapped.s.revealStorySound('paper-closing-light','真鍋さんの携帯が鳴る。');
  assert.ok(wrapped.calls.filter(c=>c==='synth').length>beforeWrapped,'the rendered text matches a wrapped source marker');

  // The actual original story has no mid-prose silence; only dark intermission cards pause it.
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'scenarios/komorebi/sound.json'))).silence,[]);
  const continuous=setup({state:'running'});continuous.S.panel=null;continuous.s.unlock();await flush();
  for(const node of story.nodes){
   for(const page of node.pages){
    visit(node.id,page.key,continuous);await flush();
    const expected=['safety','next_morning','outside'].includes(node.id)?'story-return':({ch1:'story-morning',ch2:'story-afternoon',ch3:'story-investigation'})[node.block];
    assert.equal(continuous.s.cue(),expected,'continuous BGM: '+page.key);
    assert.equal(continuous.media.paused,false,'no mid-prose pause: '+page.key);
   }
  }
  visit('r0','r0-000',continuous);await flush();continuous.media.currentTime=37;
  const playCount=continuous.calls.filter(c=>c==='play').length,loadCount=continuous.calls.filter(c=>c==='load').length;
  visit('r0','r0-006',continuous);continuous.S.panel='settings';continuous.s.sync();continuous.S.panel=null;continuous.s.sync();
  continuous.S.chapter.view='timeline';continuous.s.sync();visit('r0','r0-008',continuous);await flush();
  assert.equal(continuous.media.currentTime,37);assert.equal(continuous.calls.filter(c=>c==='play').length,playCount);assert.equal(continuous.calls.filter(c=>c==='load').length,loadCount,'pages, materials and menus do not restart the track');
  continuous.S.chapter.view='chapter';continuous.S.chapter.introNode='phone';continuous.s.sync();
  assert.equal(continuous.media.paused,false,'chapter card fades before pausing');continuous.step(650);assert.equal(continuous.media.paused,true);assert.equal(continuous.s.cue(),null);
  visit('phone','phone-008',continuous);await flush();assert.equal(continuous.media.paused,false,'phone revelation retains music');
  continuous.S.chapter.view='bridge';continuous.options.frontier='noon';continuous.s.sync();continuous.step(650);assert.equal(continuous.media.paused,true);
  visit('noon','noon-004c',continuous);await flush();assert.equal(continuous.media.paused,false,'rescue prose retains music');
  for(const [id,ending] of Object.entries(story.bad_endings)){
   visit(ending.node,'',continuous);await flush();
   for(let i=0;i<ending.pages.length;i++){
    Object.assign(continuous.S.chapter,{view:'bad',badEnding:id,badPage:i});continuous.s.sync();continuous.step(650);await flush();
    assert.equal(continuous.media.paused,false,id+' prose keeps the scene theme');
   }
   continuous.media.currentTime=19;continuous.S.chapter.badPage=ending.pages.length;continuous.s.sync();
   assert.equal(continuous.media.paused,false,id+' card fades out');continuous.step(650);assert.equal(continuous.media.paused,true);
   continuous.S.chapter.badPage=0;continuous.s.sync();await flush();assert.equal(continuous.media.paused,false);assert.equal(continuous.media.currentTime,19,id+' readback resumes from held position');
  }
  continuous.s.toggle();continuous.S.chapter.view='chapter';continuous.S.chapter.introNode='phone';continuous.s.sync();continuous.step(650);visit('phone','phone-008',continuous);await flush();assert.equal(continuous.media.paused,true,'leaving a card never overrides user mute');

  const m=JSON.parse(fs.readFileSync(path.join(root,'audio/manifest.json'))),crypto=require('node:crypto');assert.equal(m.tracks.length,6);
  const music=JSON.parse(fs.readFileSync(path.join(root,'scenarios/komorebi/music.json')));
  const assigned=new Set(['counter']);
  for(const scenario of ['komorebi','starter']){
   const direction=JSON.parse(fs.readFileSync(path.join(root,`scenarios/${scenario}/sound.json`)));
   for(const key of [...Object.values(direction.chapters),...Object.values(direction.scenes||{}),direction.credits])assigned.add(key);
  }
  assert.deepEqual(Object.keys(music).sort(),[...assigned].sort(),'every bundled cue has a current use');
  assert.deepEqual(m.tracks.map(t=>t.id).sort(),[...assigned].sort(),'credit only currently assigned recordings');
  assert.deepEqual(fs.readdirSync(path.join(root,'audio')).filter(f=>f.endsWith('.mp3')).sort(),m.tracks.map(t=>t.file).sort(),'no orphaned MP3 recordings');
  const published=JSON.parse(fs.readFileSync(path.join(root,'web-dist/licenses/published-assets.json'))).assets.filter(a=>a.kind==='audio');
  assert.deepEqual(published.map(a=>a.sha256).sort(),m.tracks.map(t=>t.sha256).sort(),'web export contains exactly the retained recordings');
  assert.equal(m.tracks.find(t=>t.id==='counter').sha256,'226713b2a022b3e3346abf8dcd9feff96adbd92f0e0ee2849290ba76408e21f0');
  for(const track of m.tracks){assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'audio',track.file))).digest('hex'),track.sha256);assert.ok(['CC0-1.0','CC-BY-4.0'].includes(track.license));assert.ok(scene.ui().includes(track.license_url)&&scene.ui().includes(track.url),'credits link each recording and its license');}
  console.log('PASS continuous manuscript BGM, chapter and BAD END card fades, silent navigation, softer effects, authored-silence compatibility, normal response/result Jazz transitions, saved preferences, Safari gesture ordering, previews, interruption, visibility and native fallback.');
  })().catch(e=>{console.error(e);process.exitCode=1;});
 },

 'security': function(require,module,__filename,__dirname){
  const {boot,assert}=require('./test-harness.cjs');
  const fs=require('node:fs');
  const path=require('node:path');
  const crypto=require('node:crypto');

  // Resume the actual saved afternoon response, not a renderer-only mock.
  const g=boot();
  g.run(`startChapter();S.chapter.done=PACING_ORDER.slice(0,PACING_ORDER.indexOf('daughter'));
   S.chapter.choices={envelope:'sealed',rescue:'stay'};openChapterNode('daughter');
   S.chapter.page=chapterPages(chapterNode('daughter')).findIndex(p=>p.decision==='issuance');
   render();chapterAdvance();advance();advance();saveFamilyProgress();`);
  assert.equal(g.run('beat().t'),'pc');
  const checkpoint=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  function write(saved){g.run(`localStorage.setItem(FAMILY_SAVE_KEY,${JSON.stringify(JSON.stringify(saved))});`);}
  const payload='"><img src=x onerror="document.body.dataset.securityProbe=1">';
  const saved=JSON.parse(checkpoint);
  saved.chapter.counter.term=[['該当',{tag:payload,t:'<script>unexpected()</script>'}]];
  saved.scores.unexpectedState='must not be copied';
  write(saved);
  g.run('resumeFamilyProgress();');
  assert.equal(g.run('isDaughterCounter()'),true);
  assert.equal(g.run('S.unexpectedState'),undefined);
  for(const fn of ['staffPcHTML','termNotesHTML']){
   const rendered=g.run(`${fn}()`);
   assert.ok(!rendered.includes('<img'),'saved class value must not create an element');
   assert.ok(!rendered.includes('<script>'),'saved text must not become a script');
   assert.ok(rendered.includes('&quot;&gt;&lt;img'),'attribute punctuation is escaped');
  }
  // Local search and quantity fields are equally untrusted after reload.
  g.run(`pcState().query=${JSON.stringify(payload)};pcState().quantity=${JSON.stringify(payload)};`);
  assert.ok(!g.run('pcSearchHTML()').includes('<img'));
  assert.ok(!g.run('pcExcelHTML()').includes('<img'));

  for(const scores of [{score:payload},{wait:-1},{total:0.5},{max:1e100},{cs:{'住民票':{ok:payload,n:1}}},{misses:[{rule:{}}]},[]]){
   const tampered=JSON.parse(checkpoint);tampered.scores=scores;write(tampered);
   const before=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
   assert.equal(g.run('readFamilySave()'),null,'malformed scores are not restored');
   assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),before,'invalid save stays untouched');
  }
  for(const key of ['__proto__','constructor','prototype']){
   const tampered=JSON.parse(checkpoint);tampered.scores=JSON.parse(`{"${key}":{"securityProbe":true}}`);write(tampered);
   assert.equal(g.run('readFamilySave()'),null);
   assert.equal(g.run('({}).securityProbe'),undefined);
  }
  for(const scores of [undefined,{}, {score:150,wait:3}, {score:150,max:200,total:2,correct:1,cs:{'戸籍':{ok:1,n:2}},misses:[{title:'例',q:'確認',mine:'選択',right:'判断',rule:'根拠',inc:false}]}]){
   const valid=JSON.parse(checkpoint);if(scores===undefined)delete valid.scores;else valid.scores=scores;
   write(valid);assert.ok(g.run('readFamilySave()'),'partial legacy scores remain compatible');
   g.run('resumeFamilyProgress();');assert.equal(g.run('isDaughterCounter()'),true);
  }
  // Validate the emitted policy against the final bytes, not a pre-export script.
  const root=path.resolve(__dirname,'..');
  const web=fs.readFileSync(path.join(root,'web-dist/index.html'),'utf8');
  const headers=fs.readFileSync(path.join(root,'web-dist/_headers'),'utf8');
  const policy=headers.match(/^  Content-Security-Policy: (.+)$/m)?.[1];
  assert.ok(policy,'a global CSP is emitted');
  assert.ok(headers.startsWith('/*\n'));
  const directives=Object.fromEntries(policy.split('; ').map(v=>{const [name,...parts]=v.split(' ');return [name,parts];}));
  const scripts=[...web.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.ok(scripts.length);
  const hashes=[...new Set(scripts.map(s=>`'sha256-${crypto.createHash('sha256').update(s).digest('base64')}'`))].sort();
  assert.deepEqual(directives['script-src'],hashes,'only exact bundled scripts can execute');
  for(const key of ['default-src','script-src-attr','frame-ancestors','form-action','base-uri','object-src'])assert.deepEqual(directives[key],["'none'"]);
  assert.ok(!directives['script-src'].includes("'unsafe-inline'")&&!directives['script-src'].includes("'unsafe-eval'"));
  assert.ok(headers.includes('X-Frame-Options: DENY'));
  assert.ok(headers.includes('X-Content-Type-Options: nosniff'));
  assert.ok(headers.includes('camera=(), microphone=(), geolocation=()'));
  assert.deepEqual(directives['media-src'],["'self'",'data:']);
  console.log('PASS hostile saved attributes/search/quantity, score allowlist/types, prototype keys, untouched invalid saves, compatible partial saves and final-script CSP hashes.');
 },

 'licensing': function(require,module,__filename,__dirname){
  // Verify redistributed legal text, mixed asset licenses, and the offline About UI.
  const fs=require('node:fs');
  const path=require('node:path');
  const crypto=require('node:crypto');
  const {boot,assert}=require('./test-harness.cjs');
  const root=path.resolve(__dirname,'..');
  const read=p=>fs.readFileSync(path.join(root,p),'utf8');
  const json=p=>JSON.parse(read(p));
  const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
  const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&');
  assert.equal(read('licenses/project-MIT.txt'),read('../LICENSE'));
  assert.match(read('../LICENSE'),/Copyright \(c\) 2026 rtoki/);
  for(const source of json('licenses/sources.json'))assert.equal(hash('licenses/'+source.file),source.sha256,source.name+' original notice');
  const g=boot();
  const notices=g.run('licenseNoticesHTML()');
  const originals=[...notices.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map(m=>decode(m[1]));
  const policy=json('licenses/policy.json');
  assert.deepEqual(originals,policy.documents.map(d=>read('licenses/'+d.file)),'every full legal text is available offline');
  assert.ok(notices.includes('href="https://github.com/rtoki"'),'developer credit links to the public profile');
  for(const dir of ['engine','scripts','scenarios','type-tests'])for(const name of fs.readdirSync(path.join(root,dir),{recursive:true})){
   if(!/\.(py|js|cjs|css|ts)$/.test(name))continue;
   const header=read(dir+'/'+name).slice(0,512);
   assert.match(header,/SPDX-FileCopyrightText:\s*\S/,dir+'/'+name+' copyright notice');
   assert.match(header,/SPDX-License-Identifier:\s*\S/,dir+'/'+name+' license identifier');
  }
  g.run('S.panel="about";render();');
  assert.ok(g.stage.innerHTML.includes('<summary>利用条件・クレジット</summary>'));
  assert.ok(g.stage.innerHTML.includes('独自のシナリオ・教材 · CC BY 4.0'));
  assert.ok(g.stage.innerHTML.includes('Copyright (c) 2026 Memuro-Town'));
  assert.ok(g.stage.innerHTML.includes('Copyright (c) 2026 Memuro Town'));
  assert.ok(g.stage.innerHTML.includes('href="https://github.com/rtoki"'));
  const title=g.run('titleHTML()');
  assert.ok(!title.includes('個人開発')&&!title.includes('所属組織'),'the title omits the personal-development disclaimer');
  assert.ok(title.includes('https://github.com/Memuro-Town/MADO'),'the MADO source remains visible');
  for(const mode of ['normal','story']){
   const welcome=g.run(`S.launchMode=${JSON.stringify(mode)};madoWelcomeHTML();`);
   const notice=welcome.indexOf('本作のストーリーはフィクションです。');
   assert.ok(notice>welcome.indexOf('</details>'),'fiction notice is outside collapsed settings');
   assert.ok(notice<welcome.indexOf('welcome-actions'),'fiction notice precedes the start action');
   assert.ok(welcome.includes('北海道芽室町および同町の職員・住民・実際の出来事とは一切関係ありません。'));
  }
  const page=read('licenses.html');
  for(const track of json('audio/manifest.json').tracks){
   assert.ok(page.includes(track.url)&&page.includes(track.license_url)&&page.includes(track.changes),track.title+' credits');
   assert.ok(g.stage.innerHTML.includes(track.url)&&g.stage.innerHTML.includes(track.license_url),track.title+' offline credits');
  }
  const sourceAssets=json('licenses/assets.json').assets;
  const actual=['images','motion','audio','scenarios','engine/icons'].flatMap(dir=>fs.readdirSync(path.join(root,dir),{recursive:true}).filter(p=>/\.(png|webp|jpg|jpeg|mp4|mp3)$/.test(p)).map(p=>dir+'/'+p)).sort();
  assert.deepEqual(sourceAssets.map(a=>a.file).sort(),actual,'every source media file is recorded');
  for(const asset of sourceAssets)assert.equal(hash(asset.file),asset.sha256,asset.file);
  const publicAssets=json('web-dist/licenses/published-assets.json').assets;
  assert.deepEqual(publicAssets.map(a=>a.file).sort(),fs.readdirSync(path.join(root,'web-dist/assets')).map(p=>'assets/'+p).sort(),'every published file is recorded');
  for(const asset of publicAssets){
   assert.equal(hash('web-dist/'+asset.file),asset.sha256,asset.file);
   if(asset.kind==='audio'){
    const track=json('audio/manifest.json').tracks.find(t=>t.sha256===asset.sha256);
    assert.ok(track);assert.equal(asset.license,track.license);assert.equal(asset.source,track.url);
   }
  }
  for(const doc of policy.documents)assert.equal(read('web-dist/licenses/'+doc.file),read('licenses/'+doc.file));
  assert.equal(read('web-dist/licenses.html'),page);
  for(const [,href] of page.matchAll(/href="([^"]+)"/g))if(!/^https?:/.test(href))assert.ok(fs.existsSync(path.join(root,'web-dist',href)),href+' public link');
  console.log(`PASS offline full legal texts, original copyrights, all bundled music credits, ${sourceAssets.length} source media and ${publicAssets.length} published assets with preserved licenses.`);
 },

 'engine-version': function(require,module,__filename,__dirname){
  const fs=require('node:fs'),path=require('node:path');
  const {boot,assert,html}=require('./test-harness.cjs');
  const root=path.resolve(__dirname,'..');
  const version=JSON.parse(fs.readFileSync(path.join(root,'engine/version.json')));
  const published=JSON.parse(fs.readFileSync(path.join(root,'web-dist/build-info.json')));
  const g=boot();
  assert.deepEqual(JSON.parse(g.run('JSON.stringify(ENGINE)')),version);
  assert.deepEqual(published.engine,version);
  assert.equal(published.scenario.version,g.run('SCENARIO.version'));
  assert.ok(html.includes(`<meta name="madoguchi-engine-version" content="${version.version}">`));
  g.run('S.panel="about";render();');
  assert.ok(g.stage.innerHTML.includes(`ゲームエンジン v${version.version}`));
  g.run('S.panel=null;startChapter();openChapterNode("r0");S.chapter.page=2;render();saveFamilyProgress();');
  const saved=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  const envelope=JSON.parse(saved);
  assert.equal(envelope.engineVersion,version.version);
  assert.equal(envelope.version,version.saveSchemaVersion);
  assert.equal(envelope.scenarioVersion,g.run('SCENARIO.version'));
  const key=g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key');
  // The pre-versioning release and a later compatible engine keep the same save format.
  for(const edit of ['delete s.engineVersion;delete s.scenarioVersion', 's.engineVersion="1.10.0"']){
   g.run(`{const s=JSON.parse(${JSON.stringify(saved)});${edit};localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(s));}S.scr="title";resumeFamilyProgress();`);
   assert.equal(g.run('chapterPages(chapterNode(S.chapter.node))[S.chapter.page].key'),key);
  }
  // Unknown save formats are rejected without overwriting the bytes in storage.
  g.run(`{const s=JSON.parse(${JSON.stringify(saved)});s.version=ENGINE.saveSchemaVersion+1;localStorage.setItem(FAMILY_SAVE_KEY,JSON.stringify(s));}`);
  const unsupported=g.run('localStorage.getItem(FAMILY_SAVE_KEY)');
  assert.equal(g.run('readFamilySave()'),null);
  assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),unsupported);
  g.run('S.scr="title";resumeFamilyProgress();');
  assert.equal(g.run('S.scr'),'title');
  assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),unsupported);
  g.run('S.panel="family-entry";render();');
  assert.ok(g.stage.innerHTML.includes('この保存データは、この版では開けません。'));
  assert.ok(g.stage.innerHTML.includes('新しい進行に置き換わります'));
  assert.ok(!g.stage.innerHTML.includes('まだ続きの保存はありません'));
  assert.equal(g.run('localStorage.getItem(FAMILY_SAVE_KEY)'),unsupported);
  console.log('PASS version display/build provenance, save metadata, old/compatible saves, and unknown-format preservation.');
 },

},__filename);
