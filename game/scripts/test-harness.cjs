// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=html.match(/<script>([\s\S]*?)<\/script>/i)[1];
new vm.Script(code);

function boot({photos=true,width=1280,chapterCards=false,reducedMotion=true}={}){
 const frames=[],listeners={},memory=new Map(),intervals=new Map(),text={textContent:'',dataset:{},querySelectorAll(){return [];}};let intervalId=0,clock=Date.now();const media={matches:reducedMotion};
 const stage={innerHTML:'',dataset:{},clientWidth:width,clientHeight:850,classList:{toggle(){}},style:{setProperty(){}}};
 const context={Element:class{static [Symbol.hasInstance](v){return !!v&&typeof v.closest==='function';}},console,innerWidth:width,Date:class extends Date{static now(){return clock;}},Math,Image:class{
   set src(value){const id=value.match(/images\/(.*)\.png/)[1];
    if(photos){this.naturalWidth=id==='bg'?1536:1024;this.naturalHeight=id==='bg'?1024:1536;this.onload();}
    else this.onerror();
   }
 },document:{documentElement:{dataset:{}},activeElement:null,
   querySelector(q){return q==='#stage'?stage:q==='#mwText'&&stage.innerHTML.includes('id="mwText"')?text:null;},
   getElementById(){return null;},addEventListener(name,f){(listeners[name]??=[]).push(f);}
 },window:{addEventListener(){}},matchMedia(){return media;},
 setInterval(f){intervals.set(++intervalId,f);return intervalId;},clearInterval(id){intervals.delete(id);},requestAnimationFrame(f){frames.push(f);return frames.length;},
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}};
 vm.createContext(context);vm.runInContext(code,context);
 // Focused scene tests bypass the entrance card. The dedicated chapter test uses
 // chapterCards:true and plays the real navigation, including all three cards.
 if(!chapterCards)vm.runInContext('const openChapterWithoutCard=openChapterNode;openChapterNode=(id)=>openChapterWithoutCard(id,true);',context);
 while(frames.length)frames.shift()();
 return {context,stage,run:s=>vm.runInContext(s,context),tickTyping:()=>{clock+=40;for(const f of [...intervals.values()])f();},setReducedMotion:value=>{media.matches=value;},fire:(name,event)=>{for(const f of listeners[name]||[])f(event);}};
}

function completePc(g){
 assert.equal(g.run('beat().t'),'pc');
 g.run('pcState().query=pcBirthKeys(FORMS[curCase().id].app.birth)[0];pcSearch();pcSelect("app");pcState().relation=pcExpectedRelation(FORMS[curCase().id]);pcState().target=true;pcState().items={...FORMS[curCase().id].items};pcTransfer();');
 assert.equal(g.run('pcState().phase'),'excel');
 g.run('pcState().quantity=String(FORMS[curCase().id].certs[0].n);pcState().lane=FORMS[curCase().id].certs[0].wide?"wide":"local";pcPrint();closeMaterial();');
 assert.notEqual(g.run('beat()?.t'),'pc');
}


module.exports={boot,completePc,assert,html,code};
