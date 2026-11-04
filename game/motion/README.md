# 本編の人物動画

写真風の架空人物に、まばたき・視線・うなずき・上半身の小さな揺れを付けた動画です。現在は74種類、スマホ用とPC用の計148本を収録しています。台詞に合わせた口パクは含みません。

顔は公式LivePortraitモデルで制作時に生成し、輪郭に沿った身体の変形と合成しています。受話器を持つ手元は元画像の一部だけを動かしています。プレイヤーの端末ではAI推論、カメラ、マイクを使いません。

## 再生

- 8秒のH.264 MP4、音声なし。幅700px以下では小容量版を使います。
- 表示中に必要な動画1本だけを取得し、同じvideo要素を再利用します。一括先読みは行いません。
- メニュー・資料・非表示タブ・ページ離脱では停止します。
- 再生拒否、読込失敗、継続的なフレーム落ちでは静止画へ切り替えます。
- 設定で［動かす］［自動］［静止画］を選べます。［自動］は取得可能な端末の省動作・通信節約設定に従います。

設定と参照先はシナリオパックの `motion.json`、表示処理は `engine/portrait-motion.ts` と同名CSSです。寸法・容量・ハッシュ・制作方式は [manifest.json](manifest.json) に記録しています。

## 素材と制作条件

元画像は本作のAI生成素材です。制作には [LivePortrait](https://github.com/KlingAIResearch/LivePortrait) のリビジョン `9b294b3d0536135442ea73cb01e6cb3ca7029dd3` と公式モデルを使用しました。InsightFaceのコード・モデル、他人の実演動画は使っていません。モデル・Python環境は配布しません。

LivePortraitの著作権表示とライセンス全文は [ライセンス原文](../licenses/LivePortrait.txt) に保持しています。素材の利用条件は [LICENSING.md](../../LICENSING.md)、第三者への表示は [THIRD-PARTY-NOTICES.md](../../docs/THIRD-PARTY-NOTICES.md) を参照してください。試作用のプレビュー一式は配布対象に含めません。

本編場面の再生成スクリプトは `scripts/media.py render-family` と `scripts/media.py render-conversation`、構図設定はこのフォルダーの `story-*-profiles.json` にあります。動画の生成には別途、制作環境が必要です。通常のゲームビルドは収録済みの動画を使います。

## 検証

`game/` で `node scripts/verify-platform.cjs --suite portrait-motion` を実行すると、動画の選択・再利用・遅延取得・停止・静止画への切替を確認できます。`node scripts/verify-platform.cjs --suite cast-motion` は来庁者14人・4表情と、身分証等を動画化しないことを確認します。自動検証は実機iPhoneの発熱・電池消費の測定を意味しません。
