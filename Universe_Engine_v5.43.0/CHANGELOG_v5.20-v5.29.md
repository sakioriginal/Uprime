# Universe Engine History — v5.20 to v5.29

This file consolidates the original per-version README files without intentionally removing their historical content.


---

## Source: `README_v5.20.0.md`

# Universe Engine Mechanical Modeler v5.20.0

## Gravity Foundation / Terrain Support
- Smart Building and Floor Plan generation now sample the actual rendered PlanetTerrain at support points.
- Building datum is set from the highest sampled terrain point so floors remain level.
- Individual support foundations extend down to each local terrain height.
- Added Building Assist settings: Auto Foundation, foundation width, minimum exposed foundation height.
- Re-ground command replaced with gravity-foundation retrofit for selected buildings.
- Planet ground CAD resolver now prefers a radial raycast against the rendered terrain mesh, reducing visual height gaps.

---

## Source: `README_v5.21.0.md`

# Universe Engine Mechanical Modeler v5.21.0 — Ghost Building Placement / Spawn Village Grounding

- Fixed the three initial spawn-village houses using the same rendered `PlanetTerrain` surface as avatar/building grounding.
- Spawn houses remain level in the local planetary tangent plane and receive four terrain-reaching support piers, eliminating the visual floating gap on uneven terrain.
- Floor-plan generation no longer commits immediately at the avatar/Creator origin.
- Floor-plan and Smart Building creation now enter a whole-building ghost placement stage first.
- FPV / TPV: building ghost follows the center aiming ray. Click/tap commits; Esc cancels.
- RTS / pointer editing: building ghost follows the pointer ray. Click commits; Esc cancels.
- Q / E rotates the whole building ghost in 15-degree increments before placement.
- Ghost geometry is excluded from placement raycasts, preventing the preview from snapping onto itself.
- After placement, foundation support heights are recalculated against terrain at the final position, instead of retaining heights from the original avatar position.
- This prevents floor-plan generation from trapping the avatar inside newly committed walls and establishes a common preview-before-commit workflow for future buildings, recipes, vehicles and large models.

---

## Source: `README_v5.22.0.md`

# Universe Engine Mechanical Modeler v5.22.0

## Surface Media / Lighting
- Surface PaintをSurface Media / Lightingへ拡張。
- コンテンツ種別: Image / GIF / Video / YouTube / Audio / Music / LED Vision。
- ローカル動画はThree.js VideoTextureで壁面再生。
- GIFはCanvasTextureをループ更新して壁面アニメーション。
- YouTubeはURL/Video IDを保存し、アプリ内iframeプレイヤーで再生。
- 音声・音楽は壁面メディア属性として保存し、内蔵プレイヤーで再生。
- 照明種別: None / Backlight / Neon / Spot / Flood。
- ライト色・強度をSurface metadataに保存。
- LED Visionはemissive表示に対応。

## Ghost Building Placement
- FPV/TPV/RTS共通のグループ建築ゴースト配置を維持。
- 画面上にゴースト配置HUDを追加。
- HUDから左右15度回転、確定、取消が可能。
- スマホでもタップ操作可能。
- 間取り建築・半自動建築は即時確定せずゴースト配置を経由。

## Notes
- ブラウザの自動再生ポリシーにより、音声付きメディアはユーザー操作後に再生される場合があります。
- 外部メディアURLは配信元のCORS/埋め込み許可設定の影響を受けます。

---

## Source: `README_v5.23.0.md`

# Universe Engine v5.23.0 — Creation Origin / Montage Face / YouTube Wall Fix

## Creation Origin
- Creatorの作成原点を `視点 / アバター前方 / 照準・RTSカーソル / 作業台 / 任意原点` から選択可能。
- 任意原点はXYZ数値入力で移動可能。
- `⌖` ボタンで現在の照準・焦点位置を任意原点として取得。
- `CREATEORIGIN AVATAR|AIM|WORKBENCH|VIEW|CUSTOM x y z` コマンドに対応。
- 建築・CADオブジェクト生成はCreatorの共通 `creationPositionCad()` を使用するため、作成位置の基準を統一。

## Montage Face
- Character Creatorに `3D Face / 円柱シェル・モンタージュ` を追加。
- 顔ベース画像、目、鼻、口の画像レイヤーを読み込み可能。
- 顔面を楕円円柱シェルとして頭部へ配置し、画像をCanvasTextureで合成。
- 顔の巻き幅を調整可能。
- 既存の自動瞬きタイミングと連動し、モンタージュ顔でも目領域を動的に閉じる。
- 口の開きパラメータを持ち、将来の音声リップシンクへ接続可能。
- 3D顔モードは従来通り使用可能。

## YouTube wall improvement
- YouTube URL / Video IDの解釈を強化（watch, youtu.be, shorts, live, embed）。
- 不正なYouTube URLは適用時にエラー表示。
- YouTube壁面には動画サムネイルと再生アイコンを表示。
- `▶ 再生/開く` からアプリ内の youtube-nocookie 埋め込みプレイヤーで再生。
- HTTPS/GitHub Pages時は埋め込みoriginパラメータも設定。

### Browser limitation
YouTube iframeの映像をWebGLのVideoTextureへ直接コピーすることは、ブラウザ/YouTubeのセキュリティ制約により通常はできません。そのためv5.23.0では、3D壁面はサムネイル表示、実動画はアプリ内埋め込みプレイヤーで再生する構成です。ローカル動画は従来通りVideoTextureで壁面上に直接再生できます。

---

## Source: `README_v5.24.0.md`

# Universe Engine v5.24.0 — YouTube Wall Loop Playback

## YouTube wall playback
- YouTube壁面をサムネイルだけでなく、3D壁面位置へ追従する埋め込みプレイヤーとして表示。
- `壁面で再生` のON/OFFを追加。
- `自動再生 / ループ / ミュート / 音量 / 開始秒 / 終了秒` を面ごとに保存。
- 自動再生はブラウザ制約に合わせ、標準ではミュートONで安定動作を優先。
- ループ時はYouTube Embedの `loop=1 + playlist=<videoId>` を使用。
- `watch / youtu.be / shorts / live / embed / Video ID` を継続サポート。
- カメラ移動・ズームに追従して壁面プレイヤーの画面位置とサイズを更新。
- 壁が画面外・カメラ背面・非表示になった場合は壁面プレイヤーも非表示。
- Surface Media設定を消去、他メディアへ変更、オブジェクト削除した場合は埋め込みプレイヤーも破棄。

## Local media
- ローカル動画は従来通りThree.js VideoTextureで3Dマテリアルへ直接表示。
- GIF、画像、音声、音楽、LEDビジョン、各種ライト設定との組み合わせを継続。
- ローカル動画でも `ミュート` 設定を独立して使用。

## Notes
YouTubeはクロスオリジン制約によりWebGL VideoTextureへ直接コピーできないため、v5.24.0ではYouTube iframeを3D壁面のスクリーン位置へ重ねる方式を採用しています。YouTube側で埋め込みを禁止している動画、年齢/地域制限がある動画などは再生できない場合があります。GitHub PagesなどHTTPS環境での利用を推奨します。

---

## Source: `README_v5.25.0.md`

# Universe Engine Mechanical Modeler v5.25.0

## Embedded Wall Media / Smartphone

- YouTube/Vimeo/汎用埋め込みURLを壁面メディアとして設定可能。
- 壁面iframeはモデル前面の投影四隅でclip-pathし、壁外へ飛び出す表示を抑制。
- YouTube/Vimeoの壁面再生・一時停止・ミュート切替を追加。
- 自動再生、ループ、ミュート、音量、開始/終了秒の設定を保持。
- 埋め込みを禁止しているサイトはブラウザ/配信元のX-Frame-Options/CSP制約により表示不可。
- スマートフォンを作業台クラフトレシピへ追加。右手装備可能。
- Smartphone USEでUniverse Phoneを開き、Inventory / Craft / Multi / Mediaへアクセス可能。

---

## Source: `README_v5.26.0.md`

# Universe Engine Mechanical Modeler v5.26.0

## Perspective Signage & Occlusion

- YouTube / Vimeo / embedded wall media is projected with a true 4-corner CSS projective transform so it appears trapezoidal in perspective.
- Wall media is hidden when viewed from the back side.
- Camera-to-sign ray occlusion hides the HTML media layer when terrain, walls, buildings, or other solid meshes are in front.
- Media overlays are clipped to the WebGL canvas viewport.
- Surface-media objects are listed under `特殊オブジェクト > 看板 / メディア`.
- Selecting or pressing `編集` on a signage entry selects the source object and opens Surface Media / Lighting directly.
- Existing play / pause / mute controls are preserved.

---

## Source: `README_v5.26.1.md`

# Universe Engine v5.26.1 — Trapezoid Signage Projection Fix

## Wall video projection fix
- Replaced fragile fixed-size CSS matrix3d iframe projection with viewport-sized projected-quad clipping.
- The YouTube/Vimeo/embed DOM surface now uses the actual projected screen bounds, so it shrinks with distance and viewing angle.
- `clip-path: polygon(...)` clips the player to the four projected billboard corners, producing a stable trapezoidal silhouette.
- Off-screen and pathological oversized projected bounds are hidden to prevent overlays from covering the play screen.
- Existing front/back culling and raycast occlusion remain active.

This remains an HTML iframe overlay because cross-origin YouTube video cannot be copied into a WebGL VideoTexture. The new method prioritizes stable perspective footprint and screen-space containment.

---

## Source: `README_v5.26.2.md`

# Universe Engine Mechanical Modeler v5.26.2

## Signage Rotation Persistence
- Added per-sign media rotation: 0 / 90 / 180 / 270 degrees.
- Default correction is 180 degrees for embedded wall media.
- Added Auto Rotation Correction state and persisted resolved rotation.
- Rotation settings are stored under `metadata.surfaceArt`, so `.uecad`, cross-save and multiplayer snapshots preserve them.
- Ctrl-drag duplication explicitly deep-copies signage metadata, including rotation settings.
- Object tree shows each sign rotation.

---

## Source: `README_v5.27.0.md`

# Universe Engine Mechanical Modeler v5.27.0

## Spatial Audio / CD & Record Media Items

- 壁面 YouTube / Vimeo / ローカル音声・動画に3D距離減衰を追加
- 基準距離、最大距離、減衰率をSurface Mediaごとに設定可能
- 音楽CD / レコード / メディアプレイヤーをクラフトレシピへ追加
- CD / レコードごとにタイトルとYouTube / Vimeo / 直接音源URLを保存
- メディアプレイヤーへセットして再生 / 一時停止 / 再開 / 取り出し
- プレイヤー位置からの距離に応じて音量をリアルタイム減衰
- メディア情報とプレイヤー設定はプロジェクト保存・クロスセーブ対象

### Browser note
音付きYouTube/Vimeoの自動再生はブラウザポリシーにより最初のユーザー操作を要求される場合があります。

---

## Source: `README_v5.28.0.md`

# Universe Engine v5.28.0 — Shop & Shopkeeper

## Added
- Starter shop: フロンティア雑貨店
- Shopkeeper NPC with role / occupation / shopId and greeting dialogue
- Physical shop building: floor, walls, counter and sign
- SHOP button and store UI
- Stock, sale price, purchase price and shop cash
- Buy resources and crafted tools/items
- Sell resources back to the shop
- Inventory delivery through ItemCraftingManager.grantRecipe()
- Shops are persisted in .uecad / cross-save snapshots
- Additional shops can be created at the current creation origin

## Starter stock
Wood, stone, fiber, iron, stone axe, pickaxe, torch, bandage, bow and shield.

---

## Source: `README_v5.29.0.md`

# Universe Engine v5.29.0 - Living Village & Relationship Core

- 初回ワールドに「はじまりの村」を自動生成。広場・井戸・住宅6軒・雑貨店を配置。
- 村人を職業付きで生成：村長、農民、木こり、鍛冶屋、商人、大工、狩人、司祭。
- Village UIを追加。村人ごとに友好度・信頼度・信仰度・仲間・家族状態を表示。
- 会話、プレゼント、イベントで関係値が変化。
- 友好35 + 信頼25で仲間化。仲間は直接操作可能。
- 仲間かつ信頼50または信仰50以上でRTS命令を解放。
- 友好75 + 信頼65で家族候補になり、家族化可能。
- サバイバルでは村所有の建物・設備を削除・移動・複製・プロパティ変更不可。
- Creatorモードでは所有権保護を解除して編集可能。
- 村・関係値・所有権・ゲームモードはUECAD/クロスセーブ/共同ワールド同期対象。
