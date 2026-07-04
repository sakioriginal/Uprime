# Planet Sandbox Engine static v0.1.1

GitHub Pages へそのまま置けるビルド不要版です。

## 配置

```
Uprime/
└─ PlanetSandboxEngine/
   ├─ index.html
   ├─ style.css
   ├─ main.js
   └─ README.md
```

## v0.1.1 修正

- キャラクターの横倒し・傾き対策
- 移動方向を必ず惑星表面の接線方向に投影
- 赤道付近から抜け出せない問題を修正
- TPV/FPVの背面追従を強化
- RTS/Planetではデッドゾーン追従に変更
- PC / VR / MR 操作仕様の土台を追加

## 操作

### スマホ

- 左スティック：移動
- 右スティック：視点
- ＋ / −：Scale変更
- ABXY：行動
- ⚙️：ボタン割当変更

### PC

- WASD：移動
- マウス：視点
- ホイール：Scale変更
- Q/E：Scale変更
- Space：ジャンプ予定

### VR / MR 仕様

現段階ではUI仕様と入力プロファイルの土台のみです。
将来 WebXR で以下に接続します。

- VR：左スティック移動、右スティック視点、トリガー選択
- MR：卓上RTS、手元UI、空間への建築配置

