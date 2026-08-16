# Universe Engine Relay Server

PC/スマホ/タブレットを同じUniverse Engine Roomへ接続するWebSocket Relayです。

## ローカルLAN
```bash
cd server
npm install
npm start
```
既定ポートは8787。PCが `192.168.1.10` の場合、別端末は `ws://192.168.1.10:8787` へ接続します。

## Render
リポジトリルートの `render.yaml` からWeb Serviceとしてデプロイできます。
Render URLが `https://example.onrender.com` の場合、Universe EngineのRelay URLには `wss://example.onrender.com` を指定します。

## Health check
`GET /health` は `{ ok: true, ... }` を返します。
