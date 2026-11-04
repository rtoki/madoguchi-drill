// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Fullscreen is a user action; it never changes game state or saved settings. */
const SCREEN_MODE=(()=>{
 let busy=false,message='';
 const active=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
 const installed=()=>typeof navigator!=='undefined'&&navigator.standalone===true||
  typeof matchMedia==='function'&&['standalone','fullscreen'].some(mode=>matchMedia('(display-mode: '+mode+')').matches);
 function enterMethod(){
  const root=document.documentElement;
  if(root.requestFullscreen&&document.fullscreenEnabled!==false)return ()=>root.requestFullscreen();
  if(root.webkitRequestFullscreen&&document.webkitFullscreenEnabled!==false)return ()=>root.webkitRequestFullscreen!();
  return null;
 }
 function exitMethod(){
  if(document.webkitFullscreenElement&&!document.fullscreenElement&&document.webkitExitFullscreen)return ()=>document.webkitExitFullscreen!();
  if(document.exitFullscreen)return ()=>document.exitFullscreen();
  if(document.webkitExitFullscreen)return ()=>document.webkitExitFullscreen!();
  return null;
 }
 const ios=()=>typeof navigator!=='undefined'&&(/iPhone|iPad|iPod/.test(navigator.userAgent||'')||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 function controls(){
  const running=installed()&&!active();
  return `<section id="screen-controls" class="screen-settings">
  <button type="button" class="settings-link" data-act="screen-toggle" ${running?'hidden':''} ${busy?'disabled':''}>${active()?'全画面を終了':'画面いっぱいで遊ぶ'} <span aria-hidden="true">⛶</span></button>
  <p id="screen-status" role="status" aria-live="polite">${message|| (running?'URLバーなしで表示しています。':'')}</p>
  <details id="screen-home-help" class="screen-home-help"><summary>ホーム画面から開く</summary>
  ${ios()?'<p>Safariの共有メニューから「ホーム画面に追加」を選びます。「Webアプリとして開く」が表示されたらオンにして追加し、ホーム画面のアイコンから開いてください。</p>':'<p>ブラウザーのメニューで「アプリをインストール」または「ホーム画面に追加」を選びます。対応している場合は、追加したアイコンからURLバーなしで開けます。</p>'}
  <p>iPhone・iPadでは、Safariの続きはホーム画面版へ自動で引き継がれません。今の続きは元のSafariから遊べます。</p>
  ${typeof location!=='undefined'&&location.protocol==='file:'?'<p>ホーム画面への追加は、公開されたWeb版から行ってください。</p>':''}
  </details></section>`;
 }
 function update(){
  const button=document.querySelector<HTMLButtonElement>('#screen-controls [data-act="screen-toggle"]'),status=document.getElementById('screen-status');
  if(button){button.hidden=installed()&&!active();button.disabled=busy;button.innerHTML=(active()?'全画面を終了':'画面いっぱいで遊ぶ')+' <span aria-hidden="true">⛶</span>';}
  if(status)status.textContent=message||(installed()&&!active()?'URLバーなしで表示しています。':'');
 }
 function help(text: string){message=text;update();const detail=document.getElementById('screen-home-help') as HTMLDetailsElement|null;if(detail)detail.open=true;}
 async function toggle(){
  if(busy)return;
  const leaving=active(),method=leaving?exitMethod():enterMethod();
  if(!method){help(leaving?'端末の戻る操作で全画面を終了できます。':'このブラウザーでは、ホーム画面から開くと画面を広く使えます。');return;}
  busy=true;message='';
  try{
   // Call before the first await to retain the tap's transient user activation.
   const result=method();update();await result;
  }catch(error){
   help(leaving?'全画面を終了できませんでした。端末の戻る操作もお試しください。':'全画面に切り替えられませんでした。ホーム画面から開く方法もあります。');
  }finally{busy=false;update();}
 }
 function changed(){message='';update();}
 document.addEventListener('fullscreenchange',changed);
 document.addEventListener('webkitfullscreenchange',changed);
 if(typeof matchMedia==='function')for(const mode of ['standalone','fullscreen'])matchMedia('(display-mode: '+mode+')').addEventListener?.('change',changed);
 return {controls,toggle};
})();
