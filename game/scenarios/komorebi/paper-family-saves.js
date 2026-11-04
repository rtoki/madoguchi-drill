// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* The fantasy rewrite changes the premise, not the save format. Keep the
   published 1.x record intact until the reader explicitly starts the new story. */
const FAMILY_PRE_PAPER_SAVE_KEY=FAMILY_SAVE_KEY+'.before-paper-v2';
function isPrePaperStorySave(raw){
 try{
  const saved=JSON.parse(raw||'null');
  return saved?.version===ENGINE.saveSchemaVersion&&saved.chapter&&
   (!saved.scenarioId||saved.scenarioId===SCENARIO.id)&&
   // Release numbers were rebased for the initial distribution. The content
   // revision identifies the premise; a current 1.0.0 save is not an old story.
   saved.contentRevision!==FAMILY_CONTENT_REVISION&&
   (/^1\.\d+\.\d+$/.test(saved.scenarioVersion||'')||saved.contentRevision==='jazz-ending-v1');
 }catch{return false;}
}
{
 const previousRead=readFamilySave,previousSave=saveFamilyProgress;
 readFamilySave=function(){
  try{
   if(isPrePaperStorySave(localStorage.getItem(FAMILY_SAVE_KEY))){
    familySaveUnavailableReason='物語を改稿しました。「最初から」で新しい第1章へ。以前の記録は別に保存します。';
    return null;
   }
  }catch{}
  return previousRead();
 };
 saveFamilyProgress=function(){
  const counter=isDaughterCounter();
  if(S.mode!=='story'||!S.chapter||S.chapter.recoveredDeduction||!counter&&(S.scr!=='multi'||S.chapter.caseActive))return;
  try{
   const raw=localStorage.getItem(FAMILY_SAVE_KEY);
   if(isPrePaperStorySave(raw)){
    const archive=localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY);
    // Preserve every distinct prior record; never replace an existing archive.
    if(!archive)localStorage.setItem(FAMILY_PRE_PAPER_SAVE_KEY,raw);
    else if(archive!==raw){
     let index=2;
     while(localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY+'.'+index)&&localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY+'.'+index)!==raw)index++;
     if(!localStorage.getItem(FAMILY_PRE_PAPER_SAVE_KEY+'.'+index))localStorage.setItem(FAMILY_PRE_PAPER_SAVE_KEY+'.'+index,raw);
    }
   }
  }catch{familySaveFailed=true;return;}
  return previousSave();
 };
}
