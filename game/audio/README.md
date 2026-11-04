# Jazz recordings

Six recordings are bundled: one by HoliznaCC0 and five by Kevin MacLeod. All six are assigned to the title, normal mode or story. The sample story reuses the return and FIN tracks.

| Cue | Recording / artist | Use | License |
| --- | --- | --- | --- |
| counter | [1 (jazz)](https://freemusicarchive.org/music/holiznacc0/busted-guitar-jazz/1-jazz/) / HoliznaCC0 | タイトル・通常モード | CC0-1.0 |
| story-morning | [Airport Lounge](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100806) / Kevin MacLeod | ストーリー第1章 | CC-BY-4.0 |
| story-afternoon | [Night on the Docks - Piano](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100135) / Kevin MacLeod | ストーリー第2章 | CC-BY-4.0 |
| story-investigation | [Covert Affair](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100795) / Kevin MacLeod | ストーリー第3章 | CC-BY-4.0 |
| story-return | [Cool Vibes](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100863) / Kevin MacLeod | ストーリー終盤・サンプル本文 | CC-BY-4.0 |
| story-ending | [Almost New](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1800008) / Kevin MacLeod | FIN・スタッフロール | CC-BY-4.0 |

## Sources and edits

Source URLs, original and edited SHA-256 hashes, durations and edit descriptions are in [manifest.json](manifest.json). The five story tracks use 96 kbps stereo MP3 at 44.1 kHz, two-pass -25 LUFS / -2 dBTP target normalization and short fades. Full recordings loop at their endings. The title/normal-mode recording is unchanged. The composers do not endorse the game.

Total MP3 size is 14.64 MB. The web build fetches only the selected same-origin recording when music is enabled; the standalone HTML embeds audio for offline use. No external music stream or third-party player is used.

## Playback and scene direction

Master sound, BGM and effects default ON. Room ambience defaults OFF; BGM starts at 50%. Playback waits for a user gesture. Saved switches and volume settings take precedence. The quick sound button mutes or resumes without interrupting text reveal.

A persistent HTML audio element is routed through Web Audio gains. `resume()` and `play()` are issued in the same user gesture for Safari activation ordering. Hidden pages pause audio; returning restores the previous position.

The chapter/cue map is [scenarios/komorebi/sound.json](../scenarios/komorebi/sound.json). Reading, form work, settings, the timeline and menu navigation continue the current theme. Chapter cards and the BAD END result card fade out; BAD END prose keeps its theme. Other packs may declare quiet ranges. User mute and channel preferences always apply.

Scene effects are synthesized locally. Stable page keys gate authored effects; muted or background events are not replayed later. Navigation sounds remain quiet.

Run `node scripts/verify-platform.cjs --suite sound-controls` from `game/` for automated checks. Browser emulation does not establish playback compatibility on a physical iPhone or Safari.
