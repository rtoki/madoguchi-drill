// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

function migrateSealedLetter(c){
 // Remove the retired scene from every saved surface, including failed-answer
 // feedback and readback. The letter's contents are no longer player evidence.
 c.done=c.done.filter(id=>id!=='consultation');
 delete c.progress?.consultation;
 c.readHistory=(c.readHistory||[]).filter(entry=>!entry.key?.startsWith('consultation:'));
 c.clues=(c.clues||[]).filter(id=>MYSTERY_CLUES[id]);
 const clue=MYSTERY_CLUES.woman_contact,node=chapterNode(clue.node);
 const index=node.pages(c).filter(p=>Object.entries(p.when||{}).every(([k,v])=>c.choices[k]===v)).findIndex(p=>p.key===clue.pageKey);
 const alreadyRead=c.done.includes(node.id)||(c.progress?.[node.id]??-1)>=index||c.node===node.id&&c.page>=index||c.readHistory.some(entry=>entry.key===node.id+':'+index);
 if(alreadyRead&&!c.clues.includes('woman_contact'))c.clues.push('woman_contact');
 // Keep completed endings, but never reinterpret an old answer as the new Q3.
 if(c.investigations)delete c.investigations.concealment;
 if(c.solutions?.deduction?.answers)delete c.solutions.deduction.answers.concealment;
 c.contradictions=[];c.feedback='';c.feedbackTarget='';c.notice='';
 if(c.node==='consultation'){
  c.node='phone';c.page=c.progress?.phone||0;
  if(c.view==='read'){c.act=3;c.person='rookie';c.progress||={};c.progress.phone=c.page;}
 }
 if(c.introNode==='consultation')c.introNode='phone';
}
function migrateFamilyProgress(saved){
 if(saved.contentRevision===FAMILY_CONTENT_REVISION)return saved;
 const c=saved.chapter,previous={...c.choices};
 if(c.node==='daughter'&&c.counter?.log){
  const time=chapterNode('daughter').pages(c).find(p=>p.decision==='issuance').time;
  c.counter.log=c.counter.log.map(entry=>entry.time?entry:{...entry,time,context:time+' · 夕方の応対'});
 }
 // Map older positions by immutable page keys after tightening the ending.
 const latest=['elapsed-time-v1','counter-ending-v1','cast-scenes-v1'].includes(saved.contentRevision);
 const recent=latest||['sound-novel-pacing-v1','morning-ticket-v1','character-address-v1','sealed-letter-v1'].includes(saved.contentRevision);
 const archive=latest?FAMILY_PRE_JAZZ:recent?FAMILY_PRE_COUNTER:['shorter-woman-v1','daughter-license-v1','workplace-v1'].includes(saved.contentRevision)?FAMILY_PRE_PACING.nodes:['actor-critic-v1','three-choices-rescue-v1'].includes(saved.contentRevision)?FAMILY_PRE_REVIEW_PAGES:saved.contentRevision==='three-choices-30k-v1'?FAMILY_COMPACT_PAGES:saved.contentRevision==='three-choices-v1'?FAMILY_EXPANDED_PAGES:FAMILY_LEGACY_PAGES;
 const oldPages=id=>(archive[id]||[]).filter(p=>Object.entries(p.when||{}).every(([k,v])=>previous[k]===v));
 const newPages=id=>(chapterNode(id)?.pages(c)||[]).filter(p=>Object.entries(p.when||{}).every(([k,v])=>previous[k]===v));
 const mapped=(id,index)=>{
  const before=oldPages(id),now=newPages(id),start=Math.max(0,Number(index)||0);
  for(let i=start;i<before.length;i++){const found=now.findIndex(p=>p.key===before[i].key);if(found>=0)return found;}
  return Math.max(0,now.length-1);
 };
 if(c.node&&c.view==='read')c.page=mapped(c.node,c.page);
 for(const id of Object.keys(c.progress||{}))c.progress[id]=mapped(id,c.progress[id]);
 if(!recent&&c.view==='bad'&&FAMILY_PRE_PACING.badEndings[c.badEnding]){
  const key=FAMILY_PRE_PACING.badEndings[c.badEnding][c.badPage]?.key;
  const index=FAMILY_BAD_ENDINGS[c.badEnding].pages.findIndex(p=>p.key===key);
  c.badPage=Math.max(0,index);
 }
 const seen=new Set();
 c.readHistory=(c.readHistory||[]).flatMap(entry=>{
  const match=/^([a-z_][a-z_0-9]*):(\d+)(:decision)?$/.exec(entry.key||'');
  // These two versions predate the clock schedule, including counter log labels.
  if(['counter-ending-v1','cast-scenes-v1'].includes(saved.contentRevision)){
   const logged=/^(r2|daughter):log:/.exec(entry.key||''),node=match&&chapterNode(match[1]);
   if(logged)return [{...entry,context:chapterNode(logged[1]).time+' · '+(logged[1]==='r2'?'吉田さんの証明書':'夕方の応対')}];
   if(node?.training)return [{...entry,context:node.endTime+' · '+node.title}];
  }
  if(!match||!archive[match[1]]?.length)return [entry];
  const id=match[1],old=oldPages(id)[+match[2]],now=newPages(id),index=now.findIndex(p=>p.key===old?.key),page=now[index];
  if(!page)return [];
  const key=id+':'+index+(match[3]||'');if(seen.has(key))return [];seen.add(key);
  if(match[3]){const d=FAMILY_DECISIONS[page.decision],o=d?.options.find(o=>o.id===previous[page.decision]);return o?[{...entry,key,x:'選んだ応対：'+o.label,context:(page.time||chapterNode(id).time)+' · '+chapterNode(id).title}]:[];}
  // A previously read paragraph may now span several deliberate page turns.
  return now.flatMap((p,i)=>{
   if(p.key!==old.key&&!p.key.startsWith(old.key+'--'))return [];
   const splitKey=id+':'+i;if(splitKey!==key&&seen.has(splitKey))return [];
   seen.add(splitKey);return [{...entry,key:splitKey,x:p.text,context:(p.time||chapterNode(id).time)+' · '+chapterNode(id).title}];
  });
 });
 delete c.choices.morning;delete c.choices.review;delete c.choices.stairs;
 const renamed={newsletter_ad:'delivery_record',branch_review_newsletter:'record_scope'};
 c.clues=[...new Set((c.clues||[]).map(id=>renamed[id]||id).filter(id=>MYSTERY_CLUES[id]))];
 // This question now asks about the delivery records, not the removed advertisement.
 // Preserve the reader's progress; an unfinished deduction needs fresh evidence.
 if(!recent&&!['actor-critic-v1','shorter-woman-v1','daughter-license-v1','workplace-v1'].includes(saved.contentRevision)&&!c.solutions?.deduction&&c.investigations?.concealment)delete c.investigations.concealment;
 if(!latest&&saved.contentRevision!=='sealed-letter-v1')migrateSealedLetter(c);
 saved.contentRevision=FAMILY_CONTENT_REVISION;return saved;
}

function migrateFamilyLayout(saved){
 if(saved.layoutRevision===FAMILY_LAYOUT_REVISION)return saved;
 const c=saved.chapter,oldIntros=c.chapterIntros||[];
 const groups={ch1:['b1','b2','b3'],ch2:['b4','b5','b6'],ch3:['b7','b8','b9']};
 c.chapterIntros=CHAPTER_BLOCKS.filter(b=>oldIntros.includes(b.id)||groups[b.id].some(id=>oldIntros.includes(id))||b.nodes.some(id=>c.done.includes(id)||(c.progress?.[id]||0)>0)).map(b=>b.id);
 if(c.view==='chapter'){
  const node=chapterNode(c.introNode),block=node&&pacingBlock(node.id);
  if(block&&block.nodes[0]!==node.id){c.view='read';c.node=node.id;c.act=node.act;c.page=c.progress?.[node.id]||0;delete c.introNode;}
 }
 if(c.view==='bridge'){
  const next=PACING_ORDER.map(chapterNode).find(n=>!c.done.includes(n.id)&&n.needs.every(id=>c.done.includes(id)));
  if(next&&pacingBlock(next.id).nodes[0]!==next.id){c.view='read';c.node=next.id;c.act=next.act;c.person=next.person;c.page=c.progress?.[next.id]||0;}
 }
 saved.layoutRevision=FAMILY_LAYOUT_REVISION;return saved;
}
