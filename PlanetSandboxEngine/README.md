# Planet Sandbox Engine / PSE

FPV・TPV・RTS・惑星・宇宙を、モード切替ではなく **Scale（ズーム）** でつなぐサンドボックスエンジンです。

## v0.0.1 の内容

- Vite + TypeScript + Three.js プロジェクト
- 球体惑星プロトタイプ
- Scale CameraRig（FPV / TPV / RTS / Planet）
- PC操作：WASD、マウス、ホイール
- スマホ操作：左右スティック、＋－、ABXY UI
- Entity / Command / EventBus の最小実装
- NPC、会話、忠誠心、五感センサーの土台
- MOD拡張を前提にした構造

## 起動方法

```bash
npm install
npm run dev
```

ブラウザで表示されたローカルURLを開きます。

## 操作

- WASD: 移動
- マウス移動: 視点
- ホイール: Scale変更
- スマホ左スティック: 移動
- スマホ右スティック: 視点
- ＋ / －: Scale変更
- A: コンテキスト会話・採集
- Y / 🏠: 建築

## 開発思想

- Everything is Entity
- Everything is Editable
- Scale, not Modes
- Mod First
- Knowledge Evolves
