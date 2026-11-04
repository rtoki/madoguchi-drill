// SPDX-FileCopyrightText: 2026 rtoki
// SPDX-License-Identifier: MIT

/* Reader and progress state */
/** Stable boundary between the typed reader and the remaining game UI. */
type ReaderSpeed = 'normal' | 'fast' | 'instant';
interface ReaderSync { fresh: boolean; paused: boolean; reduced: boolean; }
interface ReaderPage {
 key: string;
 text: string;
 done?: boolean;
 last?: boolean;
 delay?: number;
 paint(visible: string, rest: string): void;
 complete?(): void;
 nextSlice?(): boolean;
 sync?(state: ReaderSync): void;
}
interface ReaderAdapter {
 id: string;
 active(): boolean;
 position(): string;
 surface(target: Element): Element | null | false;
 read(): ReaderPage | null;
 canAuto?(): boolean;
 next(): void;
}
interface ScenarioPage {
 key: string;
 text: string;
 when?: Record<string, string>;
 time?: string;
 scene?: string;
 portrait?: string;
 mood?: string;
 beat?: string;
 decision?: string;
 document?: string;
}
interface ScenarioHistoryEntry { key: string; x: string; }
interface ScenarioProgressBase {
 node: string | null;
 person?: string;
 page: number;
 act?: number;
 done: string[];
 introNode?: string;
 chapterIntros?: string[];
 endingSeen?: boolean;
 badEnding?: string;
 badPage?: number;
 readingSlice?: { key?: string; offset: number; text?: string };
 choices: Record<string, string>;
 progress: Record<string, number>;
 readHistory?: ScenarioHistoryEntry[];
}
type ScenarioProgress = ScenarioProgressBase & (
 { view: 'bad'; badEnding: string; badPage: number } |
 { view: 'read' | 'chapter' | 'bridge' | 'timeline' | 'end' }
);
interface ScenarioNode {
 id: string;
 title: string;
 time: string;
 block: string;
 puzzle?: boolean;
 training?: boolean;
 pages(chapter: ScenarioProgress): ScenarioPage[];
}
interface ScenarioAnchors {
 current?: string | null;
 progress?: Record<string, string>;
 history?: Record<string, string>;
 bad?: string | null;
 badFinished?: boolean;
}
interface ScenarioSave {
 scores?: SavedScores;
 scenarioId?: string;
 chapter: ScenarioProgress;
 anchors?: ScenarioAnchors;
}
/** Both counter scripts and the reader use this same discriminated union. */
interface BeatPresentation {
 clockAt?: number;
 clockEnd?: number;
}
type ReaderBeat = BeatPresentation & (
 { t: 'say'; x: string; w: 'n' | 'v' | 'm' | 's' | 'f'; scene?: string | null; feedback?: {ok?: boolean}; visitRequest?: VisitRequest } |
 { t: 'ask' | 'order'; si: number; init?: boolean } |
 { t: 'term'; rows: CounterTerm[] } |
 { t: 'mood'; x: string } |
 { t: 'form'; v?: number; fix?: boolean } |
 { t: 'pc'; init?: boolean } |
 { t: 'reset' | 'card' | 'enter' | 'docs' | 'handout' | 'next' | 'fstamp' | 'leave' }
);
interface ReaderHostState {
 sound: boolean;
 settingsTab?: string;
 cat: string;
 count: string;
 titleSettings?: boolean;
 score: number;
 total: number;
 correct: number;
 log: CounterLog[];
 materialLibraryGroup?: string;
 flowFrom?: string;
 mode: 'normal' | 'story';
 scr: 'title' | 'play' | 'multi' | 'end';
 panel: string | null;
 win: string | null;
 zoom: number | null;
 ci: number;
 ticket: number;
 si: number;
 cw: number;
 cm: number;
 pc: object | null;
 materialKey: string;
 materialSelections: Record<string,string>;
 materialReturn: string | null;
 handout: boolean;
 visible: boolean;
 term: CounterTerm[];
 docs: boolean;
 res: unknown[];
 fstage: number;
 ffix: boolean;
 vmood: string;
 hint: boolean;
 ans: number | null;
 pick: number[];
 perm: number[];
 bi: number;
 beats: ReaderBeat[];
 done: boolean;
 chapter: ScenarioProgress | null;
}
declare const S: ReaderHostState;
declare const FAMILY_BAD_ENDINGS: Record<string, {node: string; pages: ScenarioPage[] }>;
declare function render(): void;
declare function isReadingBack(): boolean;
declare function consumeReadbackAdvance(): boolean;
declare function readbackArea(): HTMLElement | null;
declare function beat(): ReaderBeat | undefined;
declare function curCase(): CounterCase | undefined;
declare function paintStoryText(element: HTMLElement, text: string, visible: number, beat: ReaderBeat): void;
declare function finishStoryLine(): void;
declare function advanceCounterPage(): void;
declare function chapterNode(id: string | null | undefined): ScenarioNode | undefined;
declare function advanceStoryPage(): void;
declare function advanceBadPage(): void;
declare function familyPageVisible(page: ScenarioPage): boolean;

interface Navigator { standalone?: boolean; }
interface Document {
 webkitFullscreenElement?: Element | null;
 webkitFullscreenEnabled?: boolean;
 webkitExitFullscreen?(): Promise<void> | void;
}
interface HTMLElement { webkitRequestFullscreen?(): Promise<void> | void; }

/* Counter training */
/** Reviewed JSON content is validated by the scenario loader before bundling. */
type CounterTerm = [string, string | {tag: string; t: string}];
interface VisitRequest {
 document: string;
 quantity?: number;
 purpose: string;
 detail?: string;
 changed?: boolean;
}
interface CounterStepBase {
 ref: string;
 q: string;
 rule: string;
 say?: string;
 term?: CounterTerm[];
}
type CounterStep = CounterStepBase & (
 {type: 'order'; items: string[]; fb: string} |
 {type?: 'choice'; choices: {t: string; ok?: boolean; fb: string}[]}
);
interface CounterCase {
 id: string;
 cat: string;
 visitor: {name: string; docs: string[]};
 say: string;
 term: CounterTerm[];
 steps: CounterStep[];
 end: {tag: string; label: string; text: string};
}
interface CounterForm {
 app: {name: string};
 fill?: number;
 sign?: number;
 certs: [{n: number; p: number}, ...{n: number; p: number}[]];
 fix?: {at: number; to: number};
}
interface CounterStory {
 arrival: string;
 opening?: string;
 pause: string;
 goodbye?: string;
 after: string;
}
interface SavedMiss {
 title?: string;
 cat?: string;
 ref?: string;
 q?: string;
 mine?: string;
 right?: string;
 rule?: string;
 inc?: boolean;
}
interface SavedScores {
 score?: number;
 max?: number;
 total?: number;
 correct?: number;
 wait?: number;
 inc?: number;
 hints?: number;
 cs?: Record<string,{ok: number; n: number}>;
 misses?: SavedMiss[];
}
// Narrow interfaces for values still owned by the legacy UI.
declare const CAT_LABEL: Record<string,string>;
declare const PROLOGUE: ReaderBeat[];
declare const GREET: string[], IDREQ: string[];
declare const FORMS: Record<string,CounterForm | undefined>;
declare const VISIT_REQUESTS: Record<string,VisitRequest>;
declare const HANDOUT: Record<string,{close?: string; narr: string; bye?: string} | undefined>;
declare const CLOSE_ID: Record<string,string>, CLOSE: Record<string,string>;
declare const BYE_ID: Record<string,string>, BYE: Record<string,string>, BYE_MOOD: Record<string,string>;
declare function storyFor(c: CounterCase): CounterStory;
declare function storyBridge(c: CounterCase): ReaderBeat[];
declare function fieldSceneBeats(c: CounterCase,part: 'mid' | 'closing' | 'sign'): ReaderBeat[];
declare function fieldAfterBeats(c: CounterCase): ReaderBeat[];
declare function suspenseBeats(c: CounterCase,index: number): ReaderBeat[];
declare function pad3(value: number): string;
declare const SENPAI_NAME: string;
declare const FX: Record<string,boolean>;
declare function pcState(): object;
declare function endCase(): void;
declare function shuffle<T>(values: T[]): T[];
declare function rememberStoryReveal(beat: ReaderBeat): void;
declare function logBeat(): void;

/* Story presentation */
/** Story presentation consumes validated pages; it does not own route state. */
interface StoryTextSlice {start: number; end: number; text: string;}
interface StoryPresentation extends StoryTextSlice {
 key: string;
 full: string;
 prefix: string;
 last: boolean;
}
interface StoryBlock {act: number; title: string; nodes: string[];}
interface StoryCast {name: string; scene: string; portrait?: string; roman?: string; role?: string;}
interface PortraitAppearance {photoId?: string;}
declare const SCENARIO: {entryCaption: string; ending: {scene: string; cast: StoryCast[]}};
declare const STORY_MOMENTS: {config(page: ScenarioPage | null | undefined): object | null; interactive(): boolean};
declare const PACING_ORDER: string[];
declare const CHAPTER_BLOCKS: StoryBlock[];
declare const FAMILY_STATS: {path_chars_min: number};
declare const LOOK: Record<string,PortraitAppearance | undefined>;
declare const familySaveUnavailableReason: string;
declare function esc(value: unknown): string;
declare function chapterFocus(selector: string): void;
declare function chapterArt(scene: string): string;
declare function chapterFooter(content: string): string;
declare function chapterDone(id: string): boolean;
declare function chapterAvailable(id: string): boolean;
declare function openChapterNode(id: string,skipCard: boolean): void;
declare function pacingBlock(id: string): StoryBlock | undefined;
declare function readFamilySave(): ScenarioSave | null;
declare function saveFamilyProgress(): void;
declare function avatar(person: PortraitAppearance,mood: string,crop: boolean,motion: boolean): string;

/* Audio and portrait media */
type MotionPreference = 'auto' | 'on' | 'off';
interface MotionConnection {
 saveData?: boolean;
 effectiveType?: string;
 addEventListener?(type: 'change',listener: () => void): void;
}
interface Navigator {
 connection?: MotionConnection;
 audioSession?: {type: 'playback' | 'auto' | 'ambient' | 'play-and-record' | 'transient' | 'transient-solo'};
}
interface Window {webkitAudioContext?: typeof AudioContext;}
interface VideoQualitySample {at: number; total: number; dropped: number;}
declare const MOTION_ASSETS: Record<string,{mobile: string; desktop: string} | undefined>;
type AudioChannel = 'music' | 'effects' | 'room';
type AudioLevel = AudioChannel | 'master';
interface MusicTrack {
 source: string;
 title: string;
 url: string;
 artistName: string;
 license: string;
 license_url: string;
 usage: string;
}
interface SceneSound {kind: string; after: string;}
interface SoundDirection {
 chapters: Record<string,string | undefined>;
 credits: string;
 scenes?: Record<string,string | undefined>;
 silence: {node: string; from: string; through?: string}[];
 effects?: Record<string,string | SceneSound | undefined>;
}
interface SoundPreferences {
 sound?: boolean;
 levels?: Partial<Record<AudioLevel,number>>;
 enabled?: Partial<Record<AudioChannel,boolean>>;
}
declare const __JAZZ_TRACKS__: Record<string,MusicTrack | undefined>;
declare const __STORY_SOUND_DIRECTION__: SoundDirection;
declare function pacingFrontier(): ScenarioNode | undefined;

/* Console and materials */
interface CounterLog {n?: string; x: string; time?: string; context?: string; feedback?: {ok?: boolean} | null;}
interface ReadbackPosition {key?: string; top: number; anchor: number;}
interface ClockTimelineReturn {
 chapter: ScenarioProgress;
 scr: ReaderHostState['scr'];
 view: ScenarioProgress['view'];
 node: string | null;
 page: number;
 person?: string;
 act?: number;
 time: string;
 reading: ReadbackPosition | null;
}
interface MaterialItem {key: string; label: string; status: string; kind: 'pc' | 'doc' | 'form' | 'hand' | 'guide'; i?: number;}
interface MaterialSwipe {key: string; surface: Element; id: number; x: number; y: number; started: number; horizontal: boolean;}
interface SettingsView {
 tab?: string;
 top: number;
 details: boolean[];
 focus: {id: string; act?: string; value?: string} | null;
}
declare const CASES: CounterCase[];
declare const CATS: string[];
declare const materialGesture: {moved: boolean} | null;
declare function storyTime(): string;
declare function captureReadback(): ReadbackPosition | null;
declare function restoreReadback(position: ReadbackPosition | null): void;
declare function openChapterTimeline(back: ClockTimelineReturn): void;
declare function feedbackHistoryHTML(feedback?: CounterLog['feedback']): string;
declare function feedbackTextHTML(text: string,feedback?: CounterLog['feedback']): string;
declare function materials(): MaterialItem[];
declare function materialPicture(item: MaterialItem): string;
declare function openMaterial(key: string): void;
declare function currentVisitRequest(): VisitRequest | null;
declare function personNotesHTML(): string;
