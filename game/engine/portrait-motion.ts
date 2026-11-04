// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* One reusable video decoder for the visible portrait. No client-side AI. */
const PORTRAIT_MOTION = (()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const connection=typeof navigator==='undefined'?null:navigator.connection;
  let preference: MotionPreference='on',video: HTMLVideoElement | null=null,source='',host: HTMLElement | null=null,blocked='',generation=0;
  let sample: VideoQualitySample | null=null,badSamples=0,stalls=0;
  const failed=new Set<string>();
  const automaticPause=()=>reduced.matches||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType||'');
  const allowed=()=>preference!=='off'&&(preference==='on'||!automaticPause())&&!blocked;
  function resetSample(){sample=null;badSamples=0;stalls=0;}
  function markPlaying(active: boolean){
    video?.classList.toggle('is-playing',active);
    if(host?.dataset.motionKind==='visitor')host.parentElement?.classList.toggle('is-moving',active);
  }
  function pause(){if(video){video.pause();markPlaying(false);}resetSample();}
  function release(){
    ++generation;pause();
    if(video){video.remove();if(source){video.removeAttribute('src');video.load();}}
    source='';host=null;
  }
  function fallBack(reason: string){blocked=reason;release();}
  function quality(){
    if(!video||video.paused||document.hidden||!video.isConnected)return;
    const q=video.getVideoPlaybackQuality?.();if(!q)return;
    const now=Date.now();
    if(!sample){sample={at:now,total:q.totalVideoFrames,dropped:q.droppedVideoFrames};return;}
    if(now-sample.at<5000)return;
    const total=q.totalVideoFrames-sample.total,dropped=q.droppedVideoFrames-sample.dropped;
    sample={at:now,total:q.totalVideoFrames,dropped:q.droppedVideoFrames};
    badSamples=total>=40&&dropped>=10&&dropped/total>.15?badSamples+1:0;
    if(badSamples>=2)fallBack('performance');
  }
  function createVideo(){
    const v=document.createElement('video');
    v.className='portrait-motion-video';v.muted=true;v.defaultMuted=true;v.loop=true;
    v.playsInline=true;v.preload='none';v.controls=false;v.tabIndex=-1;
    v.setAttribute('aria-hidden','true');v.setAttribute('muted','');v.setAttribute('playsinline','');
    v.setAttribute('disablepictureinpicture','');v.setAttribute('disableremoteplayback','');
    v.addEventListener('playing',()=>{
      if(!allowed()||document.hidden||!v.isConnected){pause();return;}
      markPlaying(true);
    });
    v.addEventListener('error',()=>{if(source){failed.add(source);release();}});
    v.addEventListener('timeupdate',quality);
    v.addEventListener('waiting',()=>{if(allowed()&&!document.hidden&&!v.paused&&v.currentTime>0&&++stalls>=3)fallBack('performance');});
    return v;
  }
  function sync(){
    // Tests and static fallbacks may provide a document without media support.
    if(!document.createElement)return;
    const next=document.querySelector<HTMLElement>('[data-motion-key]');
    if(!next||!allowed()){release();return;}
    if(next.dataset.motionKind==='visitor'&&(typeof CSS==='undefined'||!CSS.supports('mask-image','linear-gradient(black,black)')&&!CSS.supports('-webkit-mask-image','linear-gradient(black,black)'))){release();return;}
    if(document.hidden||S.panel||S.win||S.zoom!==null){pause();return;}
    const asset=next.dataset.motionKey?MOTION_ASSETS[next.dataset.motionKey]:undefined;if(!asset){release();return;}
    const src=asset[matchMedia('(max-width: 700px)').matches?'mobile':'desktop'];
    if(!src||failed.has(src)){release();return;}
    if(!video)video=createVideo();
    if(source!==src){
      ++generation;pause();source=src;video.src=src;
    }
    if(host!==next)markPlaying(false);
    host=next;host.appendChild(video);
    if(host.dataset.motionKind==='visitor'){
      const parent=host.parentElement,still=parent?.querySelector('.portrait-cell');if(!parent||!still){release();return;}
      const style=getComputedStyle(still);
      host.style.maskImage=host.style.webkitMaskImage=style.backgroundImage;
      host.style.maskPosition=host.style.webkitMaskPosition=style.backgroundPosition;
      parent.style.animationDelay=`-${video.currentTime||0}s`;
      video.style.objectPosition='50% 50%';
    }else video.style.objectPosition=getComputedStyle(host.parentElement||host).backgroundPosition;
    if(!video.paused)markPlaying(true);
    const token=generation;
    if(video.paused){
      try{
        const playing=video.play();
        playing?.catch(()=>{if(token===generation&&source===src&&video?.isConnected&&!document.hidden&&!S.panel&&!S.win&&S.zoom===null)fallBack('unavailable');});
      }catch{fallBack('unavailable');}
    }
  }
  function beforeRender(){if(video?.parentElement){markPlaying(false);video.remove();}}
  function set(value: string){
    if(value!=='auto'&&value!=='on'&&value!=='off')return;
    preference=value;blocked='';failed.clear();resetSample();render();
    document.querySelector<HTMLElement>(`[data-act="motion"][data-v="${value}"]`)?.focus({preventScroll:true});
  }
  function note(){
    if(preference==='off')return '静止画で表示します。';
    if(blocked==='performance')return '再生が重いため、静止画に切り替えました。';
    if(blocked==='unavailable'||failed.size)return '動画を再生できないため、静止画で表示します。';
    if(preference==='auto'&&automaticPause())return '端末の設定や通信状況に合わせ、静止画で表示します。';
    return '真鍋さん・黒瀬・娘を名乗る女性と、来庁者のまばたき・うなずき・身体の揺れを表示します。';
  }
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('pagehide',pause);
  window.addEventListener('pageshow',sync);
  reduced.addEventListener?.('change',sync);
  connection?.addEventListener?.('change',sync);
  return {beforeRender,sync,set,note,preference:()=>preference,canAnimate:allowed};
})();

function motionSceneHTML(key: string){
  return MOTION_ASSETS[key]?`<span class="portrait-motion-host" data-motion-key="${key}" aria-hidden="true"></span>`:'';
}
function motionVisitorHTML(id: string,cell: number){
  const key=`${id}-${cell}`;
  return MOTION_ASSETS[key]?`<span class="portrait-motion-host" data-motion-key="${key}" data-motion-kind="visitor" aria-hidden="true"></span>`:'';
}
function normalMotionKey(){
  const b=beat();
  if(S.scr!=='play'||b?.t!=='say'||b.w!=='s')return '';
  if(b.feedback?.ok)return 'mentor-smile';
  // A document or a separate story photograph must remain the active scene.
  return b.scene||S.hint?'':'mentor-scene';
}
function motionControlsHTML(){
  return `<section class="motion-settings" aria-label="人物の動き"><h4>人物の動き</h4><div class="motion-options" role="group" aria-label="表情の動き方">${[['auto','自動'],['on','動かす'],['off','静止画']].map(([value,label])=>`<button type="button" data-act="motion" data-v="${value}" aria-pressed="${PORTRAIT_MOTION.preference()===value}">${label}</button>`).join('')}</div><small>「自動」は端末の動き・通信の設定に合わせます。</small></section>`;
}
