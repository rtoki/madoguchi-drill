# AI向け作業ガイド

このリポジトリで作業するAI向けの案内です。現在の依頼に必要な範囲を変更し、既存のプレイ・保存・素材の利用条件を維持してください。

## 最初に確認すること

- `git status --short` で作業中の変更を確認する。他の作業の変更や未追跡ファイルを取り込んだり、削除したりしない。
- ゲーム本体は `game/`。以降のコード例と、表内のパスはこのディレクトリを基準とする。
- Python 3・Node.js 20以上を使う。初回は `game/` で `npm ci` を実行する。TypeScriptはロックファイルに固定し、`npm run typecheck` と既存のPython／Node検証を使う。
- 大きな生成HTMLや埋め込み画像を全文出力せず、下記のソースを検索・編集する。

必要な資料だけを読むこと。

| 作業 | 参照資料 |
| --- | --- |
| 新しいシナリオ・記法 | [SCENARIO-AUTHORING.md](docs/SCENARIO-AUTHORING.md) |
| エンジン・保存・リリース | このガイドの「共通エンジン」「互換性と版」「Gitと配信」 |
| 原作の内容・演出 | [README](README.md)、[原作の執筆上の前提](game/scenarios/komorebi/authoring/PAPER-FAMILY.md)、変更対象の原稿 |
| 窓口の業務内容・MADOとの対応 | [第三者の出典・表示](docs/THIRD-PARTY-NOTICES.md) |
| 素材・配布条件 | [LICENSING.md](LICENSING.md)、[THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md) |

配布物には利用・改変に必要な資料だけを含め、作業メモや生成時の指示文を追加しない。

## 編集する場所

| 対象 | 正本・編集先 |
| --- | --- |
| 窓口の会話構成・指示の実行・時刻配分・保存スコアの検査 | `engine/counter-script.ts` |
| 共通の型定義 | `engine/contracts.d.ts` |
| 共通画面・窓口操作 | `engine/app.js`、`engine/shell.html`、`engine/console-ui.ts`・`.css` |
| 共通の文章送り・入力・モード接続 | `engine/game-reader.ts` |
| 物語の本文・章扉・書類拡大・FIN・保存補助・シナリオ既定値 | `engine/family-reader.ts` |
| 物語の推理・進行画面 | `engine/app.js` |
| 音・人物の動き | `engine/sound.ts`、`engine/portrait-motion.ts`・`.css` |
| 通常モードの教材・写真設定 | `scenarios/komorebi/content.json`、同パックの素材・スタイル設定 |
| 原作の本文・時刻 | `scenarios/komorebi/authoring/` 内の原稿と時刻設定 |
| 原作専用の窓口応対・旧保存移行 | `scenarios/komorebi/counter-extension.js`、`migrations.js` |
| 新作の本文・構成 | 各パックの `manifest.json`、`metadata.json`、`manuscript.md` |
| 素材・曲・章ごとの音の割り当て | 各パックの `assets.json`、manifestが参照する `music` / `motion` / `sound` / `styles` |
| ビルド・配信・原稿再生成 | `scripts/build.py` |
| シナリオ記法・検証・版の互換性 | `scripts/scenario_pack.py` |
| Pythonの検証 | `scripts/verify.py` |
| 任意の動画制作 | `scripts/media.py` |

`build/typescript/` はTypeScriptの生成先。`.ts` と `contracts.d.ts` が正本で、生成JSを直接編集しない。残る `.js` は従来の正本として扱う。

`index.html`、`story-family.json`、`STORY-FAMILY.md`、`web-dist/`、`build/` は生成物。直接修正せず、正本を直して再生成する。旧案内ファイルは配布しない。原稿は `scenarios/komorebi/authoring/` を使う。生成物でもGit管理されているものは、関連するソース変更と一緒に差分を確認する。

原作の `scenarios/komorebi/story.json` も原稿コンパイラの出力。原作の本文・時刻を編集した後は、通常ビルドの**前に**次を実行する。

```sh
python3 scripts/build.py manuscript
```

## 新しいシナリオ

1. `scenarios/starter/` を新しいフォルダーへコピーし、`manifest.id`・作品名・作者を変更する。IDは小文字英字で始まる2〜64文字の英小文字・数字・ハイフン。
2. `metadata.json` と `manuscript.md` を編集し、章・場面・選択・証拠・推理・結末の参照をそろえる。新作の `story.json` は本文の編集先ではない。
3. 各ページに変更しない `@@ key:` を付ける。`scene` / `portrait` / `route` / `common` は以降の本文、`key` / `time` / `clue` / `choice` / `beat` は直前のページに作用する。詳細は執筆ガイドを参照する。
4. `manifest.review`・`manifest.ending`・`sound.json` も新作の構成に合わせる。スターターは原作の教材・素材を参照するため、新作だけの変更を共有元へ書き込まない。
5. `--scenario <ID>` でビルドし、完走・各BAD END・途中保存からの再開を確認する。

新作の原稿はビルド時にコンパイルされる。独自の記法や任意のJavaScriptを原稿へ追加せず、未対応の機能が必要なら共通実装・検証・互換性を含めて変更する。窓口のform応対などは専用の拡張コードを要する。

現状は**1回のビルドで1作品を選ぶ**構成。フォルダーの追加だけでタイトル画面に作品一覧が出る仕組みではない。新作の生成先は `build/<ID>/` とし、原作の配信物へ混ぜない。

## 共通エンジン

通常応対・物語本文・BAD END本文は同じ `GAME_READER` を使う。文字表示タイマーや速度・自動送りをモードごとに追加しない。`game-reader.ts` 内で入力の保護と、モードごとの本文・次ページ・自動送りの可否の接続を扱う。採点・分岐・form・推理は表示処理と分ける。

資料・メニュー・非表示中は停止し、読み返し中は現在の会話へ戻す。表示途中の操作は全文表示、表示区切りの続きがあれば続きへ、読了後に次ページへ進む。分岐や窓口応対の確定には `GAME_READER.decisionReady()` を通す。回答・申請書操作・別来庁者への切替を自動化しない。

タイマーは保存せず、ページID・表示区切り・窓口状態から復元する。変更時は `verify-ui.cjs --suite shared-reader` と既存の入力・分岐・保存検証を使う。

移行済みのTypeScriptは `strict`・`noUncheckedIndexedAccess`・`noEmitOnError` を維持し、`any`・`@ts-ignore`・`@ts-nocheck` で型エラーを隠さない。未移行のJavaScriptとの接続は `contracts.d.ts` に必要な型だけを定義する。型の契約例は `type-tests/contracts.ts` に置き、ゲームへは出力しない。

## 互換性と版

- エンジン番号の正本は `engine/version.json`。初回リリースは `v1.0.0`。現在値を読んで判断し、生成HTMLだけを変更しない。
- エンジンの互換修正はPATCH、互換機能追加はMINOR、破壊的変更はMAJOR。作品の版は `manifest.version` で別管理する。文書だけの修正ではゲームの版を上げない。
- `schemaVersion`・`scriptVersion`・セーブの `version` は形式番号。`1.0.0` のようなリリース番号に置き換えない。`revision` / `layoutRevision` も移行用として維持する。
- 公開済みのページ・選択・証拠IDを再採番したり、別の意味へ流用したりしない。削除や構造変更は旧保存の扱いまで実装・検証する。
- エンジンの版だけを理由に保存先を変えない。原作の保存先と移行処理を維持し、新作はシナリオIDで保存を分離する。
- 未対応の保存形式を読んだだけで上書き・削除しない。読み返し・BAD END・FIN・窓口演習からの再開も確認する。
- リリースの変更点と必要な移行はGitのリリース説明にまとめ、独立した履歴文書は増やさない。READMEの現行表示・版の正本・生成物をそろえて検証し、配信済みタグを付け替えない。
- 対応範囲は `requiresEngine.minVersion` 以上、`maxVersionExclusive` 未満。初版の下限は `1.0.0`、上限は `2.0.0`。正式版の `X.Y.Z` だけを使い、形式番号や移行用revisionをリリース番号に置き換えない。

## ビルドと検証

リポジトリ直下から最初に `cd game` を実行する。初回は `npm ci`、編集後は `npm run typecheck` を実行する。

```sh
# 原作の単体HTML／配信用ファイル
python3 scripts/build.py standalone
python3 scripts/build.py web

# 別作品。build/starter/index.html と build/starter/web/ に出力
python3 scripts/build.py standalone --scenario starter
python3 scripts/build.py web --scenario starter
```

`build.py web` は単体HTMLの生成も行う。Web版だけ必要なときに両方を重ねて実行する必要はない。

Pythonは `scripts/verify.py`、Nodeは変更範囲に合う `scripts/verify-*.cjs` を実行する。文書だけの変更ではリンク・記載コマンド・`git diff --check` の確認でよい。共通エンジンや公開前の広い検証は次を使う。

```sh
npm run typecheck
python3 scripts/build.py web
python3 scripts/build.py standalone --scenario starter
python3 scripts/verify.py
for test in scripts/verify-*.cjs; do
  node "$test" || exit 1
done
git diff --check
```

Nodeの検証は `verify-ui.cjs`・`verify-counter.cjs`・`verify-story.cjs`・`verify-saves.cjs`・`verify-platform.cjs` の5分野へ追加する。単独実行は `node scripts/verify-ui.cjs --suite shared-reader` のように指定する。`test-tools.cjs` が各ケースを別プロセスで実行し、保存先・モジュールキャッシュを分離する。

スマホの選択画面や窓口端末を変更するときは、`verify-ui.cjs` の `reduced-motion-screen`・`mobile-form`・`quantity-keypad` も確認する。ブラウザーでは「動きを減らす」が有効な状態でも選択肢が見え、通常・ストーリー両モードで端末を開き直した後に［会話へ］で戻れることを確かめる。暗転レイヤーはアニメーションが止まっても画面を覆わないようにし、端末の再描画前には開いているダイアログを閉じる。

- `verify-saves.cjs --suite scenario-runtime` は `build/starter/index.html`、版・ライセンス検証は `web-dist/` を読む。先に上記ビルドを行う。
- `verify.py` の `ScenarioContracts` の原作保持テストは `scripts/fixtures/komorebi-contract.json` を使う。章・ページ順・分岐・救命手順を確認する。意図的な改稿では期待値を見直すが、失敗を消すためだけに検証を削除しない。
- UI・音・動画を変えたら、ブラウザーでも該当画面とスマホ幅を確認する。Nodeの検証や画面幅の変更だけを、実機iPhone・Safariでの再生確認として報告しない。
- 結果は変更点、実施した確認、未確認の点を簡潔に報告する。

## 作品・教材・素材を扱うとき

- 原作は幻想ミステリー。真鍋も最近異変に気づいた段階で、黒瀬は利益のために動く。申請書の印刷と証明書の交付を混同せず、過去の紙が残るという前提を守る。怪異を実在制度・製品の機能として説明したり、通常モードの教材へ混ぜたりしない。
- 原作の封筒の中身と `KRS-17` は意図的に未解決。依頼なく解答や広告との結び付きを追加しない。本文途中に証拠のラベルや、信用できる人物を教える地の文を加えない。
- 主人公がまだ知らない来庁者名を本文へ出さず、住民の個人情報を私的なノートへ控える描写にしない。
- 操作は既存の通常モード・共通設定に合わせる。案内やボタンを常設で増やす前に、既存の資料・メニュー・タイムラインを使えるか検討する。
- 文字表示・全文表示・次ページ・自動送り・停止は両モード共通の `GAME_READER` を使う。モード接続やシナリオ拡張へ別の文字表示タイマーを追加しない。
- 原作の音はJazzを基調とする章単位の構成。本文ではBGMを継続し、章扉・本文読了後のBAD END画面でだけフェードアウトする。過去の緊迫場面の無音指定を復活させない。ユーザーの音・動き設定、非表示時の停止、静止画への切替を壊さない。動画の一括先読みを追加しない。
- MADOの非公式教材であることと出典を維持する。窓口手続き・救命の事実関係を変える際は公的な一次資料で確認し、自治体ごとの条件を全国共通の制度として説明しない。ゲーム内の町・人物・書類データは架空とする。
- コードのMITを全素材の条件とみなさない。独自の物語・教材、画像、第三者の音楽等にはそれぞれの条件がある。素材追加・差し替え時は作者・出典・条件・ハッシュと関連台帳を更新する。

独自コードには著作権者とライセンスを示すヘッダーを付け、既存の作者・第三者の表示を保持する。シナリオや素材へコードのMITを一括適用しない。

## Gitと配信

- 配布する文書には個人のメールアドレス・端末の絶対パス・不要な制作会話を入れない。参考に読んだ作品や個人投稿の紹介を追加する場合は、公開用の文書に必要か確認する。利用した素材・コードの著作権表示と必要な出典は削除しない。
- 公開前は現在のファイルだけでなく、Git履歴・タグの作者情報も確認する。ファイルの修正や今後のコミット用メールの変更では、過去の記録は消えない。履歴の書き換えは影響範囲を説明し、明示的に依頼された範囲で行う。
- 変更対象を指定してステージする。作業ディレクトリ全体の一括追加や無関係な整理をしない。
- push・配信は現在の依頼と会話での許可範囲に従う。単なるビルドは公開ではない。リポジトリの公開範囲や認証設定を勝手に変更しない。
- 配信には検証した `web-dist/` を使う。サンプルや別作品の出力で、意図しない作品の配信先を上書きしない。
- 配信後は公開HTMLと `build-info.json` を確認する。文書だけの変更ではゲームの再配信は不要。
