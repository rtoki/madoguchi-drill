# シナリオの追加・執筆ガイド

新しい物語は `scenarios/` 内の一式として追加します。文章送り、章扉、選択肢、推理、保存、写真・動画・音の再生は `engine/` を共有します。最初の実例は [`scenarios/starter/`](../game/scenarios/starter/) の短編「閉庁前の忘れ物」です。

## 最初に動かす

ゲーム本体の `game/` を作業ディレクトリにして実行します。初回は `npm ci` でTypeScriptコンパイラを準備してください。通常のビルドに、画像・動画の生成ツールは不要です。

```sh
npm ci
python3 scripts/build.py standalone --scenario starter --out /tmp/madoguchi-starter.html
```

`/tmp/madoguchi-starter.html` をブラウザーで開くと短編を遊べます。原稿はこの処理中にコンパイル・検証されます。配信用の画像・動画・音声を分けた構成は次で作れます。

```sh
python3 scripts/build.py web --scenario starter --out /tmp/madoguchi-starter-web
```

出力の `index.html` が入口です。どちらも原作の `index.html` を上書きしません。出力先を省略した新作は `build/<シナリオID>/` に置かれます。

共通エンジンのTS／JSを編集せずに本文・場面・画像を追加できます。配布するゲームはJavaScriptへ変換済みで、プレイヤー側に開発ツールは不要です。

## 三つの執筆ファイル

| ファイル | 編集するもの |
| --- | --- |
| `manifest.json` | シナリオID、表示名、作者、素材・設定ファイルの参照、振り返りとエンディングの設定 |
| `metadata.json` | 章・場面の順序、時刻、選択肢、証拠の説明、推理問題、早期終了 |
| `manuscript.md` | 本文、写真の切替、ページID、選択や証拠を置く位置 |

`story.json` はゲーム向けの生成形式です。本文編集の入力には使いません。`manifest.authoring` が指定されていれば、ビルドは `metadata.json` と `manuscript.md` を正本として読みます。生成JSONを明示的に保存したいときは次を実行します。

```sh
python3 scripts/scenario_pack.py compile --metadata scenarios/starter/metadata.json --manuscript scenarios/starter/manuscript.md --out /tmp/starter-story.json
```

## 自分のシナリオを作る

1. `scenarios/starter/` を、たとえば `scenarios/evening-desk/` へコピーします。
2. `manifest.json` の `id` を `evening-desk`、`name` を作品名へ変更します。`creator`、`version`、`revision`、`layoutRevision` も自作に合わせます。
3. `manuscript.md` と `metadata.json` を編集します。場面を増減したら、`metadata.nodes` と章の `blocks[].nodes`、本文の `##` 見出しの順序をそろえます。
4. `manifest.review` の振り返り位置・推理位置と `manifest.ending`、`sound.json` の章IDも新しい構成に合わせます。
5. `--scenario evening-desk` を指定してビルドします。本文・参照・分岐・素材の検証に通ったら、通常経路と各早期終了、途中保存からの再開を遊んで確認します。

シナリオIDは小文字英字で始まる2〜64文字の英小文字・数字・ハイフンです。同じ公開環境に別作品を置く場合は必ず別IDにします。

## 本文の書き方

`## arrival` は画面に出ない場面IDです。空行で1ページを区切ります。同じページ内の地の文の改行は表示時につなぎ、台詞の前に段落の余白を入れます。台詞直後の動作は一度だけ改行し、後続の地の文とまとめます。短い一文を独立して見せたい場合は、別ページと `@@ beat:reveal` を使います。すべてのページに `@@ key:` を付けます。

```markdown
## arrival

@@ scene:scene-paperwork

カウンターの端に、青い手帳が残っていた。
入口へ向かう人が、二人。どちらの持ち物だろう。

@@ key:arrival-paper
@@ time:16:50
@@ choice:response

@@ route:response=ask

「お忘れ物はありませんか」
一人が足を止め、上着のポケットを確かめた。

@@ key:arrival-ask
@@ time:16:51

@@ common

自分は、手帳を開かずに手元へ引き寄せた。

@@ key:arrival-safe
@@ time:16:51
```

この例の `response` は `metadata.decisions`、背景は `metadata.scenes` に定義されています。

| 指示 | 作用する位置・意味 |
| --- | --- |
| `@@ scene:ID` | **以降の本文**の背景。人物画像指定もいったん解除する |
| `@@ portrait:ID` | **以降の本文**の人物画像。`metadata.portraits` に宣言する |
| `@@ route:選択ID=選択肢ID` | **以降の本文**を、その回答を選んだ場合だけ表示する |
| `@@ common` | **以降の本文**を、どの通常経路でも表示する |
| `@@ key:ID` | **直前のページ**の変更しない識別子。必須 |
| `@@ time:16:50` | **直前のページ**のゲーム内時刻。24時間表記 |
| `@@ clue:ID` | **直前のページ**で読める証拠。説明は `metadata.clues` に定義する |
| `@@ choice:ID` | **直前のページ**の後で出す選択肢。内容は `metadata.decisions` に定義する |
| `@@ beat:reveal` | **直前のページ**に、短い一文を見せる既存の演出を指定する |

場面が変わると背景・人物・経路の指定はリセットされます。背景 `bg` が宣言済みなら初期背景に使われますが、各場面の先頭に `scene` を書くと意図が明確です。人物の内部IDと、本文にいつ名前を出すかは別です。本人確認前に本名を出したくない場合は、本文でも「男性」「女性」などと書きます。

場面の `time` と `endTime` は、その場面の本文を含む開始・終了時刻にします。ビルドでは24時間表記、場面の範囲、各分岐を通った場合の時刻の逆戻りを検出します。回想の過去時刻は本文で説明し、画面時計は現在時刻を維持してください。翌朝へ移る結末では、該当する `pages` の `dayOffset: 1` と終了時刻の `endDayOffset: 1` を指定します。日数は物語の初日を0とする絶対値で、画面には時刻だけが表示されます。

## 分岐・証拠・結末

選択は通常ページに一度だけ置き、選んだ後のページで `route` を使います。条件付きページの上に別の選択を置く入れ子分岐や、まだ行われていない選択の参照はエラーです。条件は一つずつ指定し、別の `route` で切り替え、`common` で合流します。ジャンプ、呼び出し、変数計算、任意のプログラム実行はありません。

早期終了する選択肢には `ending` を指定します。本文は `metadata.bad_endings` に、背景・本文・ページIDを持つ `pages` として置きます。空の結末は作れません。通常本文の `route` に早期終了の選択肢を指定することはできません。

証拠は `metadata.clues` に `title`、`who`、`text` を定義し、本文へ `@@ clue:ID` を一度置きます。`node`、`page`、`pageKey`、経路条件はコンパイラが補完します。ゲームは読了状況に応じて証拠を扱い、執筆指示自体をプレイヤーには表示しません。推理の正解に必要な証拠が、各完走経路で推理前に提示されるかもビルドで検証します。

推理の問いには、必要な根拠で何を確かめるのかを明記します。「誰が言ったか」だけを問うのに、発言が誤りだった証拠まで必須にするなど、問いにない条件で不正解にしないでください。証拠の読み返し先は、根拠となる発言や文面そのもののページに置きます。説明した本人の意思や、まだ提示していない真相を推理の正解として要求しません。

## 写真・動画・音楽

starter は原作と同じ素材を宣言パスで参照しています。コピーしたパックから `../komorebi/` やプロジェクト内の `../../images/` を参照できるため、同じ素材を複製する必要はありません。プロジェクト外のパスは使えません。

- `assets.json`：素材のファイル、形式、ハッシュ、作者、条件。
- `styles` の参照先：写真の表示位置など。本文の `scene` は、`content.PHOTO_ASSETS` に存在する背景IDを使います。
- `motion` の参照先：表示する写真と動画の対応。
- `music` の参照先と `sound.json`：章の曲、スタッフロール、無音区間、ページごとの効果音。

starter の `sound.json` は `sample` 章に `story-return`、FINに `story-ending` を割り当て、`arrival-paper` に紙の効果音を付けています。無音区間もページ番号ではなくページIDで指します。新しい素材を追加したら、台帳と参照先を合わせて更新してください。作者・利用条件を省略した素材や、台帳と異なるファイルは検証で止まります。

### 自分の画像を一枚追加する例

`scenarios/evening-desk/` を作成済みとします。原作の共有設定を書き換えないよう、まず `scenarios/komorebi/content.json` と `styles.json` を新作フォルダーへコピーし、新作のmanifestを `"content": "content.json"`、`"styles": "styles.json"` に変更します。

1. 新作フォルダーに `assets/` を作り、利用権限のあるPNG・JPEG・WebP画像を `assets/room.png` などとして置きます。動画化は必須ではありません。
2. 新作の `assets.json` に次のような項目を追加します。ハッシュは画像を変更するたびに更新します。作者・条件はその画像の実際のものを記載し、第三者素材の表示義務も引き継いでください。

```json
"my-room-image": {
  "file": "assets/room.png",
  "mime": "image/png",
  "sha256": "画像ファイルのSHA-256をここへ記載",
  "creator": "画像の作者名",
  "license": "CC-BY-4.0",
  "source": "画像の出典URL"
}
```

```sh
python3 -c "import hashlib,pathlib; print(hashlib.sha256(pathlib.Path('scenarios/evening-desk/assets/room.png').read_bytes()).hexdigest())"
```

3. 新作の `content.json` の `PHOTO_ASSETS` に `"my-room": {"ready": true, "width": 1280, "height": 720}` を追加します。寸法は実際の画像に合わせます。`metadata.json` の `scenes` にも `"my-room"` を追加します。
4. 新作の `styles.json` に次の文字列項目を追加します。`my-room` は場面ID、`my-room-image` は素材IDです。

```json
"my-images": ".multi-art[data-scene-key=\"my-room\"]{background-image:url(\"asset:my-room-image\");background-position:center center;}"
```

5. 原稿の表示したい本文の前へ `@@ scene:my-room` を置きます。本文の後には変更しない `@@ key:` を付け、`python3 scripts/build.py web --scenario evening-desk` で確認します。出力は `build/evening-desk/web/` です。

上記のJSONは既存オブジェクトへ追加する項目です。前後のカンマも必要です。画像の作者・利用条件・出典は生成される素材台帳へ引き継がれます。ゲーム全体を自分の作品として配布する場合は、manifestだけでなく `licenses/policy.json` のクレジットも確認してください。元のコード・素材の必要な表示は残します。

省略可能な `scenes` に `{"場面ID":"曲ID"}` を指定して、その場面だけ章の曲を上書きできます。次の場面へは引き継がないため、同じ曲を続ける場面はそれぞれ指定します。読み返し・保存からの再開でも同じ割り当てになり、`silence` は常に優先します。未定義の場面・曲はビルド時にエラーになります。章の基本曲を保ち、長いまとまりの切替に使ってください。初版エンジンで利用できます。

`effects` の値に `{"kind":"mobile","after":"携帯が鳴った。"}` を指定できます。指定した一節が表示された時点で一度だけ鳴ります。通常の文字列指定はページ開始時に鳴ります。無音区間はBGMと環境音・操作音を止め、本文で指定した着信などは残します。ユーザーの消音・効果音OFF・非表示時は鳴りません。曲の変更と無音への移行はフェードし、画像には緩やかな寄り・引きを加えます。静止画設定と端末の視差効果抑制では、この画像演出を止めます。

`effects` の対象は通常本文のページです。早期終了の本文内の効果音は未対応のため、ビルド時にエラーになります。`after` は本文中の一節を指定し、改行・空白を除いて照合します。章扉・章間画面・本文読了後のBAD END画面で曲を止め、通常本文と早期終了の本文では曲を継続します。`silence: []` なら本文に無音区間はありません。`click`・`turn`は互換性のため受理しますが、操作音としては鳴らしません。使用できる音名は `click`、`paper`、`stamp`、`call`、`turn`、`card`、`envelope`、`keyboard`、`printer`、`ticket`、`coins`、`chair`、`steps`、`door`、`receiver`、`telephone`、`mobile`、`water`、`arrival` です。未知の音名や、本文にない発音位置はエラーになります。

## 画面幅に合わせた文章送り

通常の本文を画面幅に応じて約4〜6行の表示区切りへ分けます。段落・文・読点の順に切れ目を優先し、原稿のページIDや時刻を増やしません。`beat` の一行演出・推理・早期終了は分割しません。選択肢と書類は原稿ページの最後の区切りで出ます。

表示区切りの位置は途中保存され、画面幅が変わっても読みかけの箇所を含む区切りから再開します。本文が改稿されている場合はその原稿ページの先頭へ戻ります。`effects.after` は区切りの前後を含む本文で照合するため、発音位置のためにページを分け直す必要はありません。

## 紙の照合・写真・回想

manifest に省略可能な `"moments": "moments.json"` を指定します。ファイルは安定したページIDをキーとするオブジェクトです。初版エンジンで利用できます。本文の最後の表示区切りで現れ、通常の「次へ」で進めます。追加の分岐や正誤判定にはなりません。

- `kind: "compare"`：`label`、`paperLabel`、`screenLabel` と `rows`（1〜4行）。各行は `label`、`paper`、`screen`、任意の `masked: true`。覆う値は初めから匿名化した文字列を入れ、実データをCSSで隠す用途には使いません。紙の位置は保存されます。
- `kind: "photo"`：`label`、`scene`、読み上げ用の `description`。写真は既存の背景と同じ素材登録が必要です。通常本文と早期終了に使用できます。
- `kind: "recall"`：`label` と `frames`（1〜5カット）。各カットは既出の `page`、そこに実在する短い `quote`、`duration`（2500〜10000ミリ秒）。写真と時刻は参照ページから取得します。未来のページ・分岐限定のページ・作った台詞は使用できません。

選択肢・条件付きページ・一行演出とは重ねません。表示中は本文の自動送りを止め、回想のカットだけ自動で切り替えます。画面が隠れたときは停止し、通常モードに演出を出しません。原作の設定例は `scenarios/komorebi/moments.json` を参照してください。

## IDと途中保存

場面・ページ・選択・証拠などのIDは、英字で始まる英数字・`_`・`-` を使います。`constructor`、`prototype`、`__proto__` は使用できません。ページIDは早期終了を含め、同じ作品内で重複させません。

本文を直しただけなら既存IDを維持します。途中へ一ページ足す場合は新しいIDを付け、後続ページを再採番しません。別の意味のページへ古いIDを使い回すことも避けます。新作の保存位置・既読履歴は安定したページIDを使い、作品ごとの保存先は `manifest.id` から自動で分離されます。進行は `madoguchi.scenario.<ID>.v1`、得点は `madoguchi.score.<ID>.v1` です。

公開後に選択・場面・ページを削除したり意味を変えたりする変更は、既存保存での再開確認も必要です。原作 `komorebi` は、既存ページと旧保存を守るため専用の移行処理・旧原稿コンパイラを維持しています。新作は starter から始めてください。

## 検証と利用条件

```sh
python3 scripts/verify.py ScenarioCompilerTests
```

文法と負例の検証です。作品固有の検証は `build.py standalone` で実施します。窓口のform応対など特殊な操作を追加する場合は、開発者が管理する拡張コードと検証が必要です。本文にプログラムを書き込む方式ではありません。

本リポジトリの独自コード・技術文書は MIT、独自の物語・設問は CC BY 4.0 です。写真・動画・音楽は各素材の条件を引き継ぎます。実際の範囲・クレジットは [`LICENSING.md`](../LICENSING.md) と [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) を参照してください。記法は本ガイドを正本とする独自形式で、他のシナリオエンジンとの互換形式ではありません。任意のJavaScript、汎用jump/call、再帰マクロは扱いません。

## 対応エンジンと作品の版

初版の共通エンジン・原作・starterはすべて **v1.0.0** です。現在値の正本は `engine/version.json` と各作品の `manifest.json` です。`manifest.version` は作品自体の版、`requiresEngine` は対応するエンジンの範囲です。`schemaVersion` と `scriptVersion` はともに1。版の決め方と更新時の保存互換性は [AI向け作業ガイド](../AGENTS.md)を参照してください。
