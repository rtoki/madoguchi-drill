// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const audioChannels: AudioChannel[]=['music','effects','room'];
const audioLevels: AudioLevel[]=[...audioChannels,'master'];
function isAudioChannel(key: string): key is AudioChannel {return key==='music'||key==='effects'||key==='room';}
function isAudioLevel(key: string): key is AudioLevel {return key==='master'||isAudioChannel(key);}
function readSoundPreferences(raw: unknown): SoundPreferences {
 const record=(v: unknown): v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(!record(raw))return {};
 const result: SoundPreferences={};
 if(typeof raw.sound==='boolean')result.sound=raw.sound;
 if(record(raw.levels)){
  result.levels={};for(const key of audioLevels){const value=raw.levels[key];if(typeof value==='number'&&Number.isFinite(value))result.levels[key]=value;}
 }
 if(record(raw.enabled)){
  result.enabled={};for(const key of audioChannels){const value=raw.enabled[key];if(typeof value==='boolean')result.enabled[key]=value;}
 }
 return result;
}
const SOUND = (()=>{
  const tracks=__JAZZ_TRACKS__;
  const direction=__STORY_SOUND_DIRECTION__;
  let cue: string | null='counter',trackKey: string | null=null,playVersion=0,seekTo=0;
  let chapterTrack: string | null=null,sceneSilent=false;
  let lastScene='',lastChapter: ScenarioProgress | null=null;
  let pendingSceneSound: (SceneSound & {key: string}) | null=null,transitionTimer: ReturnType<typeof setTimeout> | null=null,nativeFade: ReturnType<typeof setInterval> | null=null,fading=false;
  const positions: Record<string,number>={};
  const preferenceKey='madoguchi-sound-v2';
  let ctx: AudioContext | undefined,master: GainNode,music: GainNode,effects: GainNode,room: GainNode,ambient: AudioBufferSourceNode,player: HTMLAudioElement | undefined,mediaSource: MediaElementAudioSourceNode | undefined;
  let started=false, away=false, playPending=false, resumePending=false, failure='', solo: AudioChannel | ''='', previewTimer: ReturnType<typeof setTimeout> | null=null,beforePreviewSound: boolean | undefined,restored=false;
  let saved: SoundPreferences={};try{saved=readSoundPreferences(JSON.parse(localStorage.getItem(preferenceKey)||'{}'));}catch(_){}
  const levels: Record<AudioLevel,number>={music:.50,effects:.62,room:.36,master:.58};
  const enabled: Record<AudioChannel,boolean>={music:true,effects:true,room:false};
  for(const key of audioLevels){const value=saved.levels?.[key];if(value!==undefined&&Number.isFinite(value))levels[key]=Math.max(0,Math.min(1,value));}
  for(const key of audioChannels){const value=saved.enabled?.[key];if(typeof value==='boolean')enabled[key]=value;}
  function restore(){if(!restored){restored=true;if(typeof saved.sound==='boolean')S.sound=saved.sound;}}
  function save(){try{localStorage.setItem(preferenceKey,JSON.stringify({sound:solo?beforePreviewSound:S.sound,levels,enabled}));}catch(_){}}
  const allowed=(key: AudioChannel)=>solo?solo===key:enabled[key]&&(key==='effects'||!sceneSilent);
  const foreground=()=>!document.hidden&&!away;
  const requestedTrack=()=>solo==='music'?(cue||chapterTrack||trackKey||'counter'):cue;
  const wantsMusic=()=>started&&S.sound&&foreground()&&allowed('music')&&requestedTrack()!==null&&levels.master>0&&levels.music>0;
  const musicPermitted=()=>started&&S.sound&&foreground()&&(solo?solo==='music':enabled.music)&&levels.master>0&&levels.music>0;
  function updateCue(){
    if(S.mode!=='story'||S.scr==='title'){cue=S.scr==='end'?direction.credits:'counter';chapterTrack=null;sceneSilent=false;return;}
    const c=S.chapter;if(!c)return;
    if(c.view==='end'){cue=direction.credits;sceneSilent=false;return;}
    // Menus and the timeline keep the sound of the scene being read.
    if(S.scr==='multi'&&!['read','chapter','bridge','bad'].includes(c.view))return;
    const ending=c.view==='bad'&&typeof FAMILY_BAD_ENDINGS!=='undefined'?FAMILY_BAD_ENDINGS[c.badEnding]:null;
    const node=c.view==='bridge'&&typeof pacingFrontier==='function'?pacingFrontier():
      typeof chapterNode==='function'?chapterNode(c.view==='chapter'?c.introNode:ending?.node||c.node):null;
    if(!node)return;
    // Scene overrides are explicit and stateless, so rereading and resumed saves
    // select the same theme. Scripted silence below always takes precedence.
    chapterTrack=direction.scenes?.[node.id]||direction.chapters[node.block]||null;
    // The dark chapter / BAD END cards are pauses; their prose keeps its music.
    sceneSilent=c.view==='chapter'||c.view==='bridge'||!!ending&&(c.badPage||0)>=ending.pages.length;
    cue=sceneSilent?null:chapterTrack;
    if(S.scr!=='multi'||c.view!=='read')return;
    const pages=chapterPages(node);
    sceneSilent=direction.silence.some(range=>{
      if(range.node!==node.id)return false;
      const from=pages.findIndex(p=>p.key===range.from);
      const through=range.through?pages.findIndex(p=>p.key===range.through):pages.length-1;
      return from>=0&&c.page>=from&&c.page<=through;
    });
    if(sceneSilent)cue=null;
  }
  // Use visible events, never the concealed motives of a character, as sound cues.
  const sceneSounds=direction.effects||{};
  function sceneSound(){
    if(S.mode!=='story'){lastScene='';lastChapter=null;pendingSceneSound=null;return;}
    if(lastChapter!==S.chapter){lastScene='';lastChapter=S.chapter;pendingSceneSound=null;}
    if(S.scr!=='multi'||S.chapter?.view!=='read'||S.panel)return;
    const node=typeof chapterNode==='function'?chapterNode(S.chapter.node):undefined;
    const page=node&&typeof chapterPages==='function'?chapterPages(node)[S.chapter.page]:null;
    if(!page?.key||page.key===lastScene)return;
    // Consume even while muted/hidden; resuming must not play missed events.
    lastScene=page.key;
    pendingSceneSound=null;
    const effect=sceneSounds[page.key];
    if(!solo&&effect){
      if(typeof effect==='string')sfx(effect,true);
      else if(S.sound&&foreground()&&enabled.effects)pendingSceneSound={key:page.key,...effect};
    }
  }
  function revealStorySound(key: string,visible: string){
    // The reader joins narration lines and spaces dialogue independently of source wrapping.
    if(!pendingSceneSound||pendingSceneSound.key!==key||!visible.replace(/\s+/g,'').includes(pendingSceneSound.after.replace(/\s+/g,'')))return;
    const effect=pendingSceneSound;pendingSceneSound=null;
    if(!S.panel&&!solo)sfx(effect.kind,true);
  }
  const musicLevel=()=>levels.music;
  function audioSession(){try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch(_){}}
  const labels={music:'BGM',effects:'効果音',room:'環境音'};
  const meters: Partial<Record<AudioChannel,AnalyserNode>>={};
  const hz=(n: number)=>440*Math.pow(2,(n-69)/12);
  function envelope(bus: AudioNode,t: number,d: number,vol: number,attack=.02){
    if(!ctx)return undefined;
    const g=ctx.createGain();g.gain.setValueAtTime(.00001,t);g.gain.exponentialRampToValueAtTime(Math.max(.00002,vol),t+attack);
    g.gain.exponentialRampToValueAtTime(.00001,t+d);g.connect(bus);return g;
  }
  function note(n: number,t: number,d: number,vol: number,bus=music,kind: OscillatorType='sine'){
    if(!ctx)return;
    const g=envelope(bus,t,d,vol);if(!g)return;
    const o=ctx.createOscillator();o.type=kind;o.frequency.value=hz(n);o.connect(g);o.start(t);o.stop(t+d+.05);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function noise(t: number,d: number,vol: number,frequency: number,bus=effects,attack=.015){
    if(!ctx)return;
    const src=ctx.createBufferSource(),buf=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*d),ctx.sampleRate),v=buf.getChannelData(0);
    for(let i=0;i<v.length;i++)v[i]=Math.random()*2-1;
    src.buffer=buf;const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=frequency;f.Q.value=.65;
    const g=envelope(bus,t,d,vol,attack);if(!g)return;src.connect(f).connect(g);src.start(t);src.onended=()=>{src.disconnect();f.disconnect();g.disconnect();};
  }
  function apply(){
    if(ctx){
      const t=ctx.currentTime;
      master.gain.setTargetAtTime(S.sound&&foreground()?levels.master:0,t,.06);
      // Resume the chapter theme gently after silence; keep quiet ranges fully quiet.
      if(!fading)music.gain.setTargetAtTime(allowed('music')?musicLevel():0,t,.4);
      effects.gain.setTargetAtTime(allowed('effects')?levels.effects:0,t,.04);
      room.gain.setTargetAtTime(allowed('room')?levels.room:0,t,.08);
    }
    if(player){
      if(!mediaSource&&!fading&&nativeFade===null)player.volume=levels.master*musicLevel();
      if(!musicPermitted()){cancelTransition();player.pause();}
    }
  }
  function cancelTransition(){
    if(transitionTimer!==null)clearTimeout(transitionTimer);
    if(nativeFade!==null)clearInterval(nativeFade);
    nativeFade=null;
    transitionTimer=null;fading=false;
  }
  function rampMusic(value: number,seconds: number){
    if(!ctx){
      if(!player)return;
      if(nativeFade!==null)clearInterval(nativeFade);
      const audio=player,from=audio.volume,to=levels.master*value,at=Date.now();
      nativeFade=setInterval(()=>{
        const progress=Math.min(1,(Date.now()-at)/(seconds*1000));
        audio.volume=from+(to-from)*progress;
        if(progress>=1){if(nativeFade!==null)clearInterval(nativeFade);nativeFade=null;}
      },40);
      return;
    }
    const gain=music.gain,t=ctx.currentTime;
    if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(t);
    else {const current=gain.value;gain.cancelScheduledValues(t);gain.setValueAtTime(current,t);}
    gain.linearRampToValueAtTime(value,t+seconds);
  }
  function fadeToNext(){
    if(fading)return;
    fading=true;
    // Reuse the unlocked media element on phones. Only replace its source after fading out.
    rampMusic(0,.65);
    transitionTimer=setTimeout(()=>{
      cancelTransition();player?.pause();
      if(ctx)music.gain.setValueAtTime(0,ctx.currentTime);
      else if(player)player.volume=0;
      if(wantsMusic())playMusic();
    },650);
  }
  function initPlayer(){
    if(player)return player;
    player=document.createElement('audio');player.id='jazz-bgm';player.preload='none';player.loop=true;
    player.setAttribute('playsinline','');player.setAttribute('aria-hidden','true');player.hidden=true;
    // Keep one media element outside the stage that is replaced on each text advance.
    document.body.appendChild(player);
    if(ctx){mediaSource=ctx.createMediaElementSource(player);mediaSource.connect(music);}
    else player.volume=levels.master*musicLevel();
    const audio=player;
    audio.addEventListener('playing',()=>{failure='';if(!musicPermitted())audio.pause();else if(!fading)rampMusic(musicLevel(),1.2);updateMeters();});
    audio.addEventListener('error',()=>{failure='load';playPending=false;updateMeters();});
    audio.addEventListener('pause',updateMeters);
    audio.addEventListener('loadedmetadata',()=>{if(seekTo>0){try{audio.currentTime=seekTo;seekTo=0;}catch(_){}}});
    return audio;
  }
  function selectTrack(audio: HTMLAudioElement){
    const key=requestedTrack();if(key===null||key===trackKey)return;
    const track=tracks[key];if(!track)throw new Error("Missing audio track: "+key);
    if(trackKey)positions[trackKey]=audio.currentTime||0;
    playVersion++;playPending=false;audio.pause();
    trackKey=key;seekTo=positions[key]||0;failure='';
    audio.src=track.source;audio.load();
    try{audio.currentTime=seekTo;}catch(_){}
    if(ctx){music.gain.cancelScheduledValues(ctx.currentTime);music.gain.setValueAtTime(0,ctx.currentTime);}
    else audio.volume=0;
  }
  function playMusic(retry=false){
    if(!musicPermitted()){cancelTransition();player?.pause();return;}
    if(player&&!player.paused&&(requestedTrack()!==trackKey||!wantsMusic())){fadeToNext();return;}
    if(fading){
      // A fast return to the same scene reverses the fade, without reloading the track.
      if(wantsMusic()&&requestedTrack()===trackKey){cancelTransition();rampMusic(musicLevel(),1.2);}
      else return;
    }
    if(!wantsMusic())return;
    try{
      const audio=initPlayer();
      selectTrack(audio);
      if(audio.error){if(!retry)return;audio.load();}
      if(playPending||!audio.paused)return;
      playPending=true;
      const version=++playVersion;
      // Do not await context.resume(): Safari needs play() inside this same user gesture.
      const result=audio.play();
      Promise.resolve(result).then(()=>{
        if(version!==playVersion)return;
        playPending=false;failure='';
        if(!musicPermitted())audio.pause();else if(!fading&&wantsMusic())rampMusic(musicLevel(),1.2);
        updateMeters();
      }).catch((error: unknown)=>{
        if(version!==playVersion)return;
        playPending=false;
        const name=error!==null&&typeof error==='object'&&'name' in error?error.name:'';
        if(name!=='AbortError')failure=name==='NotAllowedError'?'gesture':'load';
        updateMeters();
      });
    }catch(_){playPending=false;failure='load';updateMeters();}
  }
  function resume(){
    if(!ctx||ctx.state==='running'||resumePending)return;
    const context=ctx;resumePending=true;
    try{Promise.resolve(context.resume()).then(()=>{
      resumePending=false;if(!foreground()){context.suspend().catch(()=>{});return;}
      apply();updateMeters();
    }).catch(()=>{resumePending=false;failure='gesture';updateMeters();});}
    catch(_){resumePending=false;failure='gesture';}
  }
  function init(){
    if(ctx)return;
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
    ctx=new C();master=ctx.createGain();music=ctx.createGain();effects=ctx.createGain();room=ctx.createGain();
    master.gain.value=0;music.gain.value=0;effects.gain.value=levels.effects;room.gain.value=0;
    const limit=ctx.createDynamicsCompressor();limit.threshold.value=-12;limit.ratio.value=5;
    const buses={music,effects,room};
    for(const key of audioChannels){
      const bus=buses[key];
      const meter=ctx.createAnalyser();meter.fftSize=1024;bus.connect(meter).connect(master);meters[key]=meter;
    }
    master.connect(limit).connect(ctx.destination);
    const b=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),a=b.getChannelData(0);let last=0;
    for(let i=0;i<a.length;i++){last=(last+.02*(Math.random()*2-1))/1.02;a[i]=last*2.3;}
    ambient=ctx.createBufferSource();ambient.buffer=b;ambient.loop=true;
    const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=650;
    const gain=ctx.createGain();gain.gain.value=.48;ambient.connect(low).connect(gain).connect(room);ambient.start();
    ctx.addEventListener?.('statechange',updateMeters);
    setInterval(updateMeters,250);apply();
  }
  function unlock(){
    restore();updateCue();if(!S.sound||!foreground())return;
    started=true;audioSession();
    try{init();resume();apply();playMusic(true);}catch(_){failure='gesture';}
    updateMeters();
  }
  function sync(){
    restore();if(solo&&!(S.panel==='settings'&&S.settingsTab==='sound'))stopPreview();
    updateCue();apply();playMusic();
    if(FX.enter)sfx('chair');
    if(FX.docs)sfx('card');else if(FX.win)sfx('paper');
    if(FX.stamp||FX.hanko)sfx('stamp');
    sceneSound();
  }
  function sfx(kind: string,sceneEvent=false){
    // Repeated navigation stays silent, including calls from shared UI handlers.
    if(kind==='select'||kind==='turn')return;
    if(!ctx||ctx.state!=='running'||!S.sound||!foreground()||!allowed('effects')||sceneSilent&&!solo&&!sceneEvent)return;
    const t=ctx.currentTime+.008;
    if(kind==='paper'){noise(t,.25,.045,850,effects,.05);noise(t+.12,.18,.018,600,effects,.04);}
    else if(kind==='stamp'){noise(t,.15,.06,180,effects,.035);note(38,t,.18,.025,effects);}
    else if(kind==='call'){[64,60].forEach((n,i)=>note(n,t+i*.4,.7,.06,effects));}
    else if(kind==='card'){noise(t,.16,.03,900,effects,.035);}
    else if(kind==='envelope'){noise(t,.4,.045,800,effects,.06);noise(t+.2,.25,.02,1100,effects,.04);}
    else if(kind==='keyboard'){[0,.08,.17,.28].forEach((d,i)=>noise(t+d,.06,.022,650+i*70,effects,.02));}
    else if(kind==='printer'||kind==='ticket'){
      const length=kind==='ticket'?.35:.9;
      noise(t,length,.065,700,effects,.05);note(42,t,length,.022,effects,'triangle');noise(t+length,.15,.025,900,effects,.035);
    }
    else if(kind==='coins'){[0,.12,.23].forEach((d,i)=>note(76+i*3,t+d,.2,.018,effects));}
    else if(kind==='chair'){noise(t,.32,.1,360);noise(t+.2,.18,.045,1100);}
    else if(kind==='steps'){[0,.33,.68].forEach(d=>{noise(t+d,.12,.09,270);note(36,t+d,.13,.035,effects);});}
    else if(kind==='door'){noise(t,.65,.085,650);noise(t+.55,.15,.09,250);}
    else if(kind==='receiver'){noise(t,.12,.035,700,effects,.03);note(42,t,.12,.018,effects);}
    else if(kind==='telephone'){
      [0,.16,.32,.64,.8,.96].forEach(d=>{note(83,t+d,.12,.075,effects);note(89,t+d,.12,.035,effects);});
    }
    else if(kind==='mobile'){[0,.9].forEach(d=>[76,79,83,79].forEach((n,i)=>note(n,t+d+i*.16,.2,.075,effects)));}
    else if(kind==='water'){noise(t,.85,.065,2600);noise(t+.25,.65,.04,950);}
    else if(kind==='arrival'){
      // A brief, distant ambulance cue; no medical-device or treatment sounds.
      [76,71,76,71].forEach((n,i)=>note(n,t+i*.42,.5,.045,effects));
    }
    // Unknown effect names are silent; never substitute an unrelated UI beep.
  }
  function toggle(){
    restore();if(solo)stopPreview(false);S.sound=!S.sound;
    if(S.sound){if(!Object.values(enabled).some(Boolean))enabled.music=true;unlock();}
    apply();save();updateMeters();
  }
  function set(key: string,value: string | number){
    if(isAudioLevel(key)&&Number.isFinite(Number(value)))levels[key]=Math.max(0,Math.min(1,Number(value)/100));
    apply();playMusic();save();updateMeters();
  }
  function channel(key: string){
    if(!isAudioChannel(key))return;
    if(solo)stopPreview();
    enabled[key]=!enabled[key];if(enabled[key]){S.sound=true;unlock();}
    apply();save();updateMeters();
  }
  function status(){
    if(!S.sound)return '消音中';
    if(sceneSilent&&!solo)return 'BGM休止中';
    if(!started)return '操作すると再生';
    if(!foreground())return '一時停止中';
    if(wantsMusic())return failure==='load'?'読込エラー':player&&!player.paused&&player.readyState>=2&&(!ctx||ctx.state==='running')?'再生中':'再生待ち';
    return ctx?.state==='running'?'再生中':'再生待ち';
  }
  function description(){
    if(!S.sound)return 'すべて消音中';
    if(sceneSilent&&!solo)return 'この場面はBGMなし';
    if(wantsMusic()&&failure==='load')return 'BGMを読み込めませんでした。「BGMを試聴」で再試行できます。';
    if(wantsMusic()&&status()==='再生待ち')return 'BGMは再生待ちです。画面をタップしてください。';
    return solo?`${labels[solo]}を試聴中（最大6秒）`:audioChannels.map(key=>`${labels[key]} ${enabled[key]?'ON':'OFF'}`).join(' ／ ');
  }
  function updateMeters(){
    for(const [key,meter] of Object.entries(meters)){
      const el=document.getElementById?.('signal-'+key);if(!el||!('value' in el))continue;
      const data=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(data);
      const rms=Math.sqrt(data.reduce((n,v)=>n+v*v,0)/data.length)*levels.master;
      el.value=S.sound?Math.min(1,rms*12):0;el.setAttribute('aria-valuetext',`${key} ${Math.round(rms*10000)/100}%`);
    }
    const el=document.getElementById?.('audio-live'),text=description();if(el&&el.textContent!==text)el.textContent=text;
    const main=document.getElementById?.('audio-master');if(main){main.textContent=S.sound?'ON':'OFF';main.setAttribute('aria-pressed',String(S.sound));}
    const quick=document.getElementById?.('audio-quick');if(quick){
      const label=S.sound?'音をOFFにする':'音をONにする';
      quick.setAttribute('aria-label',label);quick.setAttribute('title',label);quick.setAttribute('aria-pressed',String(S.sound));
      const state=quick.querySelector('.quick-sound-state');if(state)state.textContent=S.sound?'ON':'OFF';
    }
    for(const key of audioChannels){
      const label=labels[key];
      const channel=document.getElementById?.('audio-channel-'+key);if(channel){channel.textContent=enabled[key]?'ON':'OFF';channel.setAttribute('aria-pressed',String(enabled[key]));}
      const button=document.getElementById?.('audio-preview-'+key);if(!button)continue;
      const text=solo===key?'停止':'試聴';
      button.setAttribute('aria-label',solo===key?label+'の試聴を止める':label+'を試聴');
      if(button.textContent!==text)button.textContent=text;
      button.setAttribute('aria-pressed',String(solo===key));
    }
  }
  function stopPreview(restore=true){
    if(previewTimer!==null)clearTimeout(previewTimer);previewTimer=null;
    if(!solo)return;
    solo='';if(restore&&beforePreviewSound!==undefined)S.sound=beforePreviewSound;beforePreviewSound=undefined;
    apply();playMusic();updateMeters();
  }
  function preview(channel: string){
    if(!isAudioChannel(channel))return;
    if(solo===channel){stopPreview();return;}
    if(!solo)beforePreviewSound=S.sound;
    S.sound=true;solo=channel;if(previewTimer!==null)clearTimeout(previewTimer);unlock();apply();
    if(channel==='effects'){sfx('paper');setTimeout(()=>{if(solo==='effects')sfx('stamp');},600);setTimeout(()=>{if(solo==='effects')sfx('call');},1200);}
    previewTimer=setTimeout(()=>stopPreview(),6000);updateMeters();
  }
  function pause(){
    if(solo)stopPreview();
    cancelTransition();pendingSceneSound=null;
    apply();player?.pause();if(ctx&&ctx.state==='running')ctx.suspend().catch(()=>{});
    updateMeters();
  }
  function wake(){if(started&&S.sound&&foreground()){audioSession();resume();apply();playMusic();updateMeters();}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else wake();});
  window.addEventListener('pagehide',()=>{away=true;pause();});
  window.addEventListener('pageshow',()=>{away=false;wake();});
  // Bare story taps also recover audio after an iOS interruption. Audio controls handle themselves.
  document.addEventListener('click',event=>{
    const action=event.target instanceof Element?event.target.closest<HTMLElement>('[data-act]')?.dataset.act:undefined;
    if(!['snd','audio-channel','audio-test'].includes(action||''))unlock();
  },true);
  return {unlock,sync,sfx,revealStorySound,toggle,set,levels,status,preview,enabled,channel,description,previewing:()=>solo,tracks,cue:()=>cue};
})();
function chime(){SOUND.sfx('call');}
function quickSoundHTML(){
  const label=S.sound?'音をOFFにする':'音をONにする';
  return `<button type="button" id="audio-quick" class="quick-sound noadv" data-act="snd" aria-label="${label}" title="${label}" aria-pressed="${S.sound}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 5 6 9H3v6h3l5 4Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-cross" d="m16 9 6 6m0-6-6 6"/></svg><span class="quick-sound-state" aria-hidden="true">${S.sound?'ON':'OFF'}</span></button>`;
}
function soundControls(){
  const slider=(key: AudioLevel,label: string)=>`<label class="sound-slider"><span class="sound-slider-label">音量</span><input type="range" min="0" max="100" value="${Math.round(SOUND.levels[key]*100)}" data-audio="${key}" aria-label="${label}の音量"><output>${Math.round(SOUND.levels[key]*100)}%</output></label>`;
  return `<div class="sound-settings"><section class="sound-master" aria-label="全体の音"><div class="sound-card-top"><h3>全体の音</h3><button type="button" class="btn sound-switch" id="audio-master" data-act="snd" aria-label="全体の音" aria-pressed="${S.sound}">${S.sound?'ON':'OFF'}</button></div>${slider('master','全体')}<p class="audio-state" id="audio-live" role="status">${SOUND.description()}</p></section>
    <div class="sound-channels">${([['music','BGM'],['effects','効果音'],['room','環境音']] as const).map(([key,label])=>`<section class="sound-card" aria-label="${label}の設定"><div class="sound-card-top"><h3>${label}</h3><button type="button" class="btn sound-switch" id="audio-channel-${key}" data-act="audio-channel" data-v="${key}" aria-label="${label}" aria-pressed="${SOUND.enabled[key]}">${SOUND.enabled[key]?'ON':'OFF'}</button></div>${slider(key,label)}<button type="button" class="btn sound-test" id="audio-preview-${key}" data-act="audio-test" data-v="${key}" aria-label="${SOUND.previewing()===key?label+'の試聴を止める':label+'を試聴'}" aria-pressed="${SOUND.previewing()===key}">${SOUND.previewing()===key?'停止':'試聴'}</button></section>`).join('')}</div>
    <p class="sound-help">試聴は6秒間。音の設定は自動保存されます。</p>
    <details class="console-options sound-credit"><summary>使用曲・クレジット</summary>${musicCreditsHTML()}</details></div>`;
}
function musicCreditsHTML(){
  return `<p>Jazzを中心に全${Object.keys(SOUND.tracks).length}曲収録。物語は章や場面のまとまりに合わせて曲が変わります。ゲーム用に音量・フェード・圧縮率を調整しています。</p>${Object.values(SOUND.tracks).filter((t): t is MusicTrack=>t!==undefined).map(t=>`<p><a href="${t.url}" target="_blank" rel="noopener">${t.title}</a> — ${t.artistName} / <a href="${t.license_url}" target="_blank" rel="noopener">${t.license}</a><br>${t.usage}</p>`).join('')}`;
}
