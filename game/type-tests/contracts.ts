// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Reader */
// This file is checked with noEmit and is never included in a game bundle.
function checkReaderContracts(progress: ScenarioProgress,reader: typeof GAME_READER): void {
 const page: ReaderPage={key:'example',text:'本文',paint(visible,rest){void visible;void rest;}};
 reader.register({id:'example',active:()=>true,position:()=>page.key,surface:target=>target,read:()=>page,next(){}});
 reader.setSpeed('fast');
 const anchors: ScenarioAnchors=scenarioSaveAnchors(progress);
 restoreScenarioAnchors({scenarioId:'example',chapter:progress,anchors});
 // @ts-expect-error A reader must paint text, not numeric character counts.
 const wrongPaint: ReaderPage['paint']=(visible: number)=>{void visible;};
 void wrongPaint;
 // @ts-expect-error An adapter must return a complete page contract.
 reader.register({id:'bad',active:()=>true,position:()=>'',surface:target=>target,read:()=>({text:'missing key'}),next(){}});
 // @ts-expect-error Speed is not a number.
 reader.setSpeed(123);
 // @ts-expect-error Page positions are numbers in the runtime state.
 const wrongSave: ScenarioSave={chapter:{...progress,page:'1'}};
 void wrongSave;
 // @ts-expect-error A dialogue beat requires speaker and text.
 const incompleteBeat: ReaderBeat={t:'say'};
 void incompleteBeat;
 const untrusted: unknown={};
 // @ts-expect-error Untrusted JSON requires validation before entering the typed save boundary.
 restoreScenarioAnchors(untrusted);
}

/* Counter */
// Contract failures stay in development and never enter the browser bundle.
function checkCounterContracts(raw: unknown,step: CounterStep,save: ScenarioSave): void {
 const scores=familySavedScores(raw);
 if(scores)save.scores=scores;
 const spoken: ReaderBeat={t:'say',w:'s',x:'内容をご確認ください。'};
 const question: ReaderBeat={t:'ask',si:0};
 stampCounterTimes([spoken,question]);
 if(step.type==='order')step.items.map(item=>item.toUpperCase());
 else step.choices.map(choice=>choice.ok);
 // @ts-expect-error A question index must be numeric.
 const wrongIndex: ReaderBeat={t:'ask',si:'0'};
 void wrongIndex;
 // @ts-expect-error Terminal rows must carry both a label and value.
 const incompleteRow: ReaderBeat={t:'term',rows:[['label']]};
 void incompleteRow;
 // @ts-expect-error A request needs a document name and purpose.
 const missingRequest: VisitRequest={quantity:1};
 void missingRequest;
 // @ts-expect-error Copy count must be numeric.
 const wrongForm: CounterForm={app:{name:'架空の住民'},certs:[{n:'1',p:200}]};
 void wrongForm;
 // @ts-expect-error Raw storage is not a validated score record.
 save.scores=raw;
 // @ts-expect-error Score fields cannot contain numeric strings.
 const wrongScore: SavedScores={score:'100'};
 void wrongScore;
}

/* Story */
// Story pages and screen cuts are different units; saves retain authored keys.
function checkStoryContracts(progress: ScenarioProgress): void {
 const page: ScenarioPage={key:'stable-page',text:'本文。',scene:'bg',beat:'reveal'};
 const presentation: StoryPresentation=familyPagePresentation(page);
 const [first]=familyTextSlices(page.text,20,4);
 progress.readingSlice={key:page.key,offset:first.end,text:presentation.full};
 familyStoryTextHTML(page.text,page.key,page.beat);
 const cast: StoryCast={name:'架空の人物',scene:'bg'};
 void cast;
 // @ts-expect-error A stored display offset must be numeric.
 progress.readingSlice={key:page.key,offset:'10'};
 // @ts-expect-error A page cannot use a numeric decision identifier.
 const wrongPage: ScenarioPage={key:'stable-page',text:'本文。',decision:3};
 void wrongPage;
 // @ts-expect-error A cast member needs a scene, even when using no portrait.
 const missingScene: StoryCast={name:'架空の人物'};
 void missingScene;
 // @ts-expect-error Text slicing accepts text, not a page object.
 familyTextSlices(page);
 // @ts-expect-error UI key handlers require keyboard events.
 FAMILY_ENDING.key({key:'Enter'});
}

/* Media */
function checkMediaContracts(raw: unknown): void {
 const preferences: SoundPreferences=readSoundPreferences(raw);
 SOUND.set('music',50);SOUND.channel('effects');SOUND.preview('room');
 PORTRAIT_MOTION.set('auto');
 const mode: MotionPreference=PORTRAIT_MOTION.preference();
 const gain: number | undefined=preferences.levels?.music;
 void mode;void gain;
 // @ts-expect-error Saved gain values are numeric.
 const badGain: SoundPreferences={levels:{music:'50'}};
 void badGain;
 // @ts-expect-error Channel switches are boolean.
 const badSwitch: SoundPreferences={enabled:{room:1}};
 void badSwitch;
 // @ts-expect-error A delayed effect needs the text marker that releases it.
 const missingMarker: SceneSound={kind:'mobile'};
 void missingMarker;
 // @ts-expect-error Channel volumes cannot be arbitrary objects.
 SOUND.set('music',{});
 // @ts-expect-error Media preference input cannot be an arbitrary object.
 PORTRAIT_MOTION.set({value:'on'});
 // @ts-expect-error Raw preferences require validation.
 const unvalidated: SoundPreferences=raw;
 void unvalidated;
}

/* Console */
function checkConsoleContracts(): void {
 const view: SettingsView | null=captureSettingsView();
 restoreSettingsView(view);
 movePresentedMaterial(1,{wrap:false});moveOpenMaterial(-1);
 // @ts-expect-error A document index must be numeric.
 const badDocument: MaterialItem={key:'doc:0',label:'書類',status:'提示済み',kind:'doc',i:'0'};
 void badDocument;
 // @ts-expect-error Swipe state must retain an actual surface.
 const badSwipe: MaterialSwipe={key:'work:form',surface:null,id:1,x:0,y:0,started:0,horizontal:false};
 void badSwipe;
 // @ts-expect-error Restored scroll position must be numeric.
 restoreSettingsView({tab:'sound',top:'0',details:[],focus:null});
 // @ts-expect-error Pointer movement is not a keyboard navigation event.
 handleConsolePanelKey(new MouseEvent('click'));
}
