# Universe Engine History — v5.40 to v5.47

This file consolidates the original per-version README files without intentionally removing their historical content.


---

## Source: `README_v5.40.0.md`

# Universe Engine Mechanical Modeler v5.40.0 — Grounded Homes & Working Villagers

## 修正内容
- 村人の家の接地処理を再調整。
  - 地形4隅の最高点だけを基準に家全体を大きく持ち上げる処理を廃止。
  - 家中央の実地形を基準にし、斜面補正の持ち上げ量を最大260 mmに制限。
  - 4本の基礎は各地点の地表まで個別に伸びるため、斜面でも家が空中に浮きにくい。
- 初回起動で村を生成した直後にも `repairAllSurfaceAnchors()` を実行。
  - 家・村建築を地表へ再接地。
  - 再接地後に全村建築を `scene.sync()` して、保存座標だけでなく表示メッシュにも即時反映。
- 村人の仕事座標を毎回現在の村施設から再設定。
  - 農民 → 共同農地
  - 木こり → 伐採地と実際の木
  - 鉱夫 → 採掘場と実際の鉱床
  - 商人 → 市場
  - その他 → 工房
- 木こり・鉱夫は仕事場付近から資源ノードを探索し、対象が枯渇したら次の資源を再探索。
- 農民は農地中央に全員重なるのではなく、農地内の担当位置へ分散して農作業。
- 「畑へ移動中」「木へ移動中」「木を伐採中」「鉱床へ移動中」「採掘中」など活動状態を更新。
- 起動直後に村人AIの再シード・インフラ再構築・NPC表示再構築を実施。

## 対象
`Universe_Engine_Mechanical_Modeler_v5.39.0_Authoritative_Grounded_Homes` をベースに修正。

---

## Source: `README_v5.41.0.md`

# Universe Engine Mechanical Modeler v5.41.0

## Village home access fix
- Village house floor slab is embedded into terrain so the floor top is flush with local ground.
- Replaced the old solid house body with separate walls and a real 1100 mm front doorway opening.
- Added collision metadata: floor/roof/foundation are walkable; walls remain solid.
- Added migration for v5.40-and-earlier solid-box village homes.
- Villagers now route to the front doorway before moving to the home interior at sleep time.
- Late terrain grounding pass also repositions the new wall shell and keeps the entrance usable.

## Multiplayer deployment note
- GitHub Pages can host the HTML/CSS/JS client.
- Multiplayer still requires the included `server/relay-server.js` WebSocket relay to run on a separate server.
- For a GitHub Pages HTTPS client, expose the relay with TLS as `wss://...`.

---

## Source: `README_v5.42.0.md`

# Universe Engine v5.42.0 — GitHub Pages + Internet Multiplayer Ready

## 追加・修正
- GitHub Pages公開用の `.github/workflows/pages.yml` を追加。
- GitHub Pages向け `.nojekyll` を追加。
- `ue-config.js` で公開Relay URLを設定可能にした。
- MULTI画面へ入力したRelay URLをブラウザの `localStorage` に保存し、次回以降も利用する。
- URLパラメータ `?relay=wss%3A%2F%2F...` からRelayを指定可能。
- Render Blueprint用 `render.yaml` を追加。
- RelayサーバーをHTTP + WebSocket共存構成へ変更。
- `/health` を追加し、Render等のWeb Serviceから正常性確認可能にした。

## GitHub Pages公開
1. このZIPを展開してGitHubリポジトリへアップロードする。
2. 既定ブランチを `main` にする。
3. GitHub repository > Settings > Pages > Source を `GitHub Actions` にする。
4. mainへpushすると `.github/workflows/pages.yml` がサイトを公開する。

## Render Relay公開
1. 同じGitHubリポジトリをRenderへ接続する。
2. Blueprintとしてリポジトリルートの `render.yaml` を使用する。
3. デプロイ後のURLが `https://universe-engine-relay-xxxx.onrender.com` なら、ゲームで使うURLは `wss://universe-engine-relay-xxxx.onrender.com`。
4. `ue-config.js` の `relayUrl` に上記 `wss://...` を書くか、MULTI画面へ直接入力する。

## 友達と接続
- 全員が同じGitHub Pages URLを開く。
- 🌐 MULTIを開く。
- Relay URLを同じ `wss://...` にする。
- Room名を同じにする。
- 1人目がHOST、他の人がJOIN。

## 注意
- Relayの現在のRoom保存は `server/data` へのファイル保存。ホスティング環境のファイルシステムが永続化されない場合、再起動時にRoom保存が消える可能性がある。
- 現段階の共同ワールド競合解決はLast-write-wins。

---

## Source: `README_v5.43.0.md`

# Universe Engine v5.43.0 — QR Multiplayer Invite

## 追加内容
- MULTI画面に「📱 QR共有」を追加。
- 現在のGitHub Pages URL、Relay URL、Room、Play Mode、Teamを招待URLへまとめる。
- 招待URLをブラウザ内だけでQRコード化（外部QR APIへURLを送信しない）。
- 「🔗 招待リンクをコピー」「↗ 共有（Web Share API）」を追加。
- QR/招待リンクから開いた端末では、Relay / Room / Mode / Teamを自動入力してMULTI画面を開く。
- 参加者はPlayer名を確認して JOIN / 参加 を押すだけ。
- QR生成ライブラリはMITライセンスのKazuhiko Arase QRCode実装をES Modules化して同梱。

## 使い方
1. HOST端末で MULTI を開く。
2. Relay URL と Room を設定して HOST / 部屋を開始。
3. 「📱 QR共有」を押す。
4. 友達・家族のスマホでQRを読み取る。
5. 開いたUniverse EngineでPlayer名を設定し、JOIN / 参加。

## 注意
- file:// で開いたページのQRは他端末からアクセスできないため、GitHub Pages等の公開URLで利用してください。
- GitHub PagesがHTTPSの場合、Relayも wss:// が必要です。

---

## Source: `README_v5.44.0.md`

# v5.44.0 Stable Realtime Multiplayer

マルチプレイ安定化版。

- プレイヤー移動: 軽量 Presence を約100ms間隔で同期
- 停止中 Presence: 3秒ごとに送信
- アプリ Heartbeat: 10秒
- Relay WebSocket Ping/Pong: 20秒
- 異常切断時: 自動再接続（指数バックオフ）
- リモートアバター: 補間移動 + シーン再構築後の自動再接続
- 全ワールドSnapshot: HOSTのみ30秒ごと（移動同期から完全分離）
- Relay保存: WebSocket処理を止めない遅延保存
- デフォルトRelay: wss://uprime-1.onrender.com
- index.htmlのキャッシュバスターをv5.44.0へ更新

## Render
既存Renderサービスで Root Directory=`server`、Build=`npm install`、Start=`node relay-server.js` のまま使用できます。GitHubへv5.44.0を反映するとAuto Deployされます。

## テスト
1. PCをHOST / Room `UNIVERSE-001` / CO-OP / Team A。
2. QRでスマホをJOIN。
3. Relay `/` で rooms=1, clients=2 を確認。
4. PCを歩かせ、スマホ上のリモートアバターが滑らかに移動するか確認。
5. 1分以上停止しても接続が維持されることを確認。

---

## Source: `README_v5.45.0.md`

# Universe Engine v5.45.0 — Realtime Multiplayer / Mobile Gamepad

- Multiplayer participant list DOM updates throttled to 750 ms; realtime pose updates no longer rebuild UI.
- Automatic full-world snapshots disabled during live play; use explicit Publish for shared world state.
- Relay caches each player last presence and supplies it to newly joined clients.
- Presence cadence 80 ms with 3 s idle refresh; render interpolation runs on requestAnimationFrame.
- Remote avatars snap after very large discontinuities and interpolate normal motion.
- Landscape coarse-pointer layout: left movement stick, right camera stick, Y/B/A/X action cluster.
- Mobile landscape hides ribbon, side panels, console, coordinate HUD, hotbar and mini-buttons.
- Universal Dial auto-collapses to a compact top-left header on mobile landscape.
- Default ABXY actions: Y=VIEW, B=USE, A=JUMP, X=INV.

---

## Source: `README_v5.46.0.md`

# Universe Engine v5.46.0 — Mobile Orientation / Collapsible Console

- Console UI can be collapsed and restored with ⇧ / ⇩.
- Drag the Console top edge to adjust its height. Desktop and mobile heights are stored separately.
- In mobile landscape, Console starts as a compact bar and can be opened only when needed.
- Mobile landscape detection now follows `screen.orientation`, `visualViewport`, resize and orientationchange, so controls reflow immediately after a 90° device rotation.
- Landscape layout remains centered on left movement stick, right camera stick and XYAB actions, with the Universal Dial compact/collapsed.

---

## Source: `README_v5.47.0.md`

# Universe Engine v5.47.0 — iPhone Landscape / Reliable Sticks

- iPhone Safari向けに `window.orientation` + VisualViewport + Screen Orientation を統合して横持ち判定。
- OS/ブラウザがportrait viewportを維持しても、端末が横向きならアプリ領域を90°回転してゲームパッド配置へ追従。
- タッチ端末では左右スティックを常時生存させ、portraitでも消えないように修正。
- Consoleの⇧/⇩をタッチ可能な最前面操作として固定。横持ちでは既定で格納。
- アバター座標HUDはデフォルトOFF。上部XYZボタンで表示/非表示を切替可能。
- v5.47.0 cache busting。
