# 第三者の出典・利用条件

独自部分の条件は [LICENSING.md](../LICENSING.md) を参照してください。以下の原著作権・許諾を、本作の MIT や CC BY に置き換えることはありません。取得した原文の出典と SHA-256 は [licenses/sources.json](../game/licenses/sources.json) に記録しています。

## MADO

| 参照元 | 確認した版 | 原著作権表示 | 原文 |
| --- | --- | --- | --- |
| [MADO](https://github.com/Memuro-Town/MADO) | `96e0ff86e6ca5f2e99b9479f9d6de3f8c21b603d` | Copyright (c) 2026 Memuro-Town | [MIT](../game/licenses/MADO-MIT.txt) |
| [MADO-packages](https://github.com/Memuro-Town/MADO-packages) | `70f912dbbcd67fa9241b38bb891034a9c604c6f9` | Copyright (c) 2026 Memuro Town | [MIT](../game/licenses/MADO-packages-MIT.txt) |
| [MADO-queue](https://github.com/Memuro-Town/MADO-queue) | `4a080438bc147ddf22e8514f6bae06ecbd8f49b5` | Copyright (c) 2026 Memuro Town | [MIT](../game/licenses/MADO-queue-MIT.txt) |

MADO-packages の `docs/form/workflow.html` と帳票の「統一様式_標準化後.xlsx」を参考に、説明・フロー図・申請書・操作画面を研修用に作成しています。確認順を整理し、架空自治体名・記載例に置き換え、欄構成を簡略化しています。由来する部分には元の MIT を保持し、新たに書いた独自の物語・設問等には CC BY 4.0 を適用します。参照した業務フローは [確認済みの原文](https://github.com/Memuro-Town/MADO-packages/blob/70f912dbbcd67fa9241b38bb891034a9c604c6f9/docs/form/workflow.html)です。

MADO 本体と queue の実行コードは組み込んでいません。関連する仕組みの参照先として、各リポジトリの原文も併記しています。

## 模擬画面と教材の範囲

formは申請書作成の模擬操作であり、証明書の発行は別の段階です。本人確認、請求資格、署名、別職員による審査を区別します。第三者請求の対象者欄は印刷時に空欄とし、記入後に表示します。本籍の事前確認は改善要求を取り入れた教材上の補完であり、OSS版の完成画面を再現したものではありません。

印鑑証明は印鑑登録証を持参した通常交付に限定し、登録証の省略条件は出題しません。「運用案」は実機で検証済みの運用ではありません。MADO・queueのサーバー、Excel、プリンター、POSには接続せず、未採用の提案や未決事項を全国共通の正解として扱いません。

## 音楽

HoliznaCC0 の1曲とKevin MacLeod の5曲、計6曲を収録しています。[音楽クレジット](../game/audio/README.md)、[曲ごとの出典・ライセンス・加工履歴](../game/audio/manifest.json)を参照してください。

- *Busted Guitar (JAZZ)* の *1 (jazz)*：CC0 1.0。
- 音量調整、フェード、配信用再エンコードを行っています。加工の詳細と元音源・配信音源のハッシュは台帳に記録しています。

原文：[CC0 1.0](../game/licenses/CC0-1.0.txt)、[CC BY 4.0](../game/licenses/CC-BY-4.0.txt)。本作の作者名だけで、音楽の作者表示を置き換えないでください。

## フォント

Google Fonts から BIZ UDGothic、BIZ UDPGothic、BIZ UDPMincho、Yomogi を読み込みます。いずれも SIL Open Font License 1.1。フォント本体はリポジトリ・Web 配布物に同梱していません。各原文には原著作権表示も含まれます。

- [BIZ UDGothic](../game/licenses/bizudgothic-OFL.txt)
- [BIZ UDPGothic](../game/licenses/bizudpgothic-OFL.txt)
- [BIZ UDPMincho](../game/licenses/bizudpmincho-OFL.txt)
- [Yomogi](../game/licenses/yomogi-OFL.txt)

## 人物動画の制作ツール

[LivePortrait](https://github.com/KlingAIResearch/LivePortrait)、リビジョン `9b294b3d0536135442ea73cb01e6cb3ca7029dd3`。Copyright (c) 2024 Kuaishou Visual Generation and Interaction Center。[原文](../game/licenses/LivePortrait.txt)は MIT 本文に加えて InsightFace のモデルに関する例外の記述をそのまま保存しています。

本作の制作では、既知の構図を切り出し、独自の動作カーブと公式の LivePortrait モデルで生成しています。InsightFace のコード・モデル、および他人の実演動画は使用していません。モデル・Python 環境は配布していません。詳細は [制作記録](../game/motion/README.md)を参照してください。

ツールのライセンスを根拠に、生成された映像の著作権の成立を主張するものではありません。出力画像・動画について保有する権利の範囲と許諾は、独自素材の方針を参照してください。

## ビルド用ツール

[TypeScript](https://github.com/microsoft/TypeScript) 7.0.2を開発時の型チェック・変換に使用します。Apache-2.0。依存の版と整合性は `game/package-lock.json` に固定し、配布元の[ライセンス](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)を保持します。コンパイラとプラットフォーム別の実行ファイルはゲームのWeb配信物へ同梱しません。独自コード・シナリオ・素材の利用条件はそれぞれ別に適用します。
