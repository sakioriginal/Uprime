# Universe Engine History — v5.10 to v5.19

This file consolidates the original per-version README files without intentionally removing their historical content.


---

## Source: `README_v5.10.1.md`

# Universe Engine Mechanical Modeler v5.10.1

Smart Building Preview / Layers update.

- Semi-transparent whole-building ghost preview before placement.
- Preview commit / cancel workflow.
- Building layer visibility controls for columns, walls, floors and roofs.
- Preview objects are non-physical until committed.
- Existing v5.10.0 smart building and Recipe / Blueprint Library retained.

---

## Source: `README_v5.10.2.md`

# Universe Engine Mechanical Modeler v5.10.2

## Live Building Snap / Ghost Placement

- Building Assist にリアルタイム配置を追加。
- 柱: マウスに追従するゴーストをクリックで連続配置。
- 壁: 始点クリック → 終点へゴースト追従 → クリックで確定。
- 床 / 屋根: 1点目と対角点の2クリックで矩形生成。
- 既存の柱芯、柱天端、壁端、床/屋根角へスマートスナップ。
- スナップ格子とスナップ半径をUIで変更可能。
- ゴースト色: 水色=自由配置、黄=スナップ、赤=同位置重複。
- ESC: 1回で途中の始点をキャンセル、もう1回でリアルタイム配置終了。
- コマンド: `BUILDPLACE COLUMN|WALL|FLOOR|ROOF|OFF`
- v5.10.1 の建物全体プレビュー、レイヤー、半自動建築、Recipe / Blueprint は維持。

---

## Source: `README_v5.10.3.md`

# Universe Engine Mechanical Modeler v5.10.3

## Planet Surface Base / Hand Equipment

### Planet defaults
- Radius: 1,000,000 mm (1 km)
- Terrain elevation range setting: 10,000 mm
- Sea level: 0 mm
- Spawn target elevation: approximately +1,000 mm above sea level
- Planet values are stored in millimetres and converted to render-space units from `workspace.unitScaleMm`.

### Ground base
- Planet terrain is registered as a placement surface.
- When no portable workbench is deployed, Creator uses the local tangent plane at the avatar's planet position as the work coordinate frame.
- A deployed workbench aligns its local up axis to the outward planet normal.
- `workspace.groundBaseCadZ` records the terrain/floor level relative to the current workbench work origin so building primitives can start from ground level.
- The initial portable workbench is stored in inventory instead of appearing at the world origin.

### Vegetation
- Normal trees are not generated below sea level.
- Tree height is randomized from 1x to 3x the avatar height.

### Hand equipment
- Select an object and use `✋ 右手` or `🤚 左手`.
- `⬇ 手放す` drops the held object back into the CAD/world coordinate system.
- Existing Grip sockets are used; if missing, an `Auto Grip` socket is created.
- The held object is visible at the avatar wrist in TPV and is moved to a first-person presentation position in FPV.
- Commands: `HOLD RIGHT`, `HOLD LEFT`, `DROPTOOL RIGHT`, `DROPTOOL LEFT`.

### Validation
All JavaScript files were checked with `node --check`, and duplicate HTML IDs were checked.

---

## Source: `README_v5.10.4.md`

# Universe Engine Mechanical Modeler v5.10.4

Ocean / Celestial / Creator Assist update.

- Water render surface is slightly below nominal sea level to reduce the oversized-water appearance while keeping sea level = 0 mm for terrain/elevation logic.
- Animated multi-frequency spherical waves.
- Sun, moon, neighboring planet and orbit guide in the planet sky.
- More aggressive logarithmic camera-distance scaling toward AU scale so astronomical distances feel substantially larger relative to the 1 km starter planet.
- Stable tangent-frame workbench placement: tabletop is perpendicular to the planet radius without unwanted roll.
- Running-bond brick wall generator.
- Generic small-part ghost placement assist for Box/Cylinder/Sphere in Creator mode with cursor tracking and scale-aware snapping.
- Creator palette moved/compacted at top-right, collapsible, with Pan / Rotate / Camera Reset controls.

---

## Source: `README_v5.10.5.md`

# v5.10.5 Planet Time / Pale Blue Dot

- Planet-surface local frame is now applied to CAD/building objects whenever workbench anchoring is enabled, not only while Creator is toggled on.
- Creator scale camera expansion strengthened for AU-class views so the 1 km-radius home planet can collapse toward a pale-blue-dot scale.
- Procedural star field added.
- Solar-system simulation state added: simulation hours, 24 h rotation period, 365.25 d orbit period, 23.4 deg axial tilt.
- Sun/Moon/neighbor planet positions update from simulation time; directional sunlight creates a moving day/night terminator.
- Time rotary dial added to Creator palette. One full turn = 24 simulation hours; clockwise advances and counter-clockwise rewinds.
- Existing procedural continent/ocean terrain, sea-level water, waves, rivers and biomes retained.

Note: planet rotation is evaluated in a surface-local reference frame so avatars/workbenches/buildings remain attached to their terrain positions while the sun direction changes with time.

---

## Source: `README_v5.10.6.md`

# Universe Engine Mechanical Modeler v5.10.6

## Solar System / Calendar / Stable Controls

- Creator scale upper range extended from 1 AU to 1 light-year.
- At 1 AU-class scale the renderer switches to a compressed solar-system overview so the whole planetary system fits in view. The home world is shown as a small blue point rather than a giant nearby sphere.
- Added visible planetary rotation axis and prime-meridian rotation marker using the configured 23.4° axial tilt and 24 h rotation period.
- Day/night lighting now follows daily rotation while annual orbital position changes solar declination.
- Added a Gregorian-style calendar beside the time dial. The dial moves time forward/backward; the date follows automatically, and the date can also be entered directly or stepped by ±1 day.
- Fixed virtual left/right sticks disappearing when the object/property side panels are collapsed. Panel CSS is now scoped to `.panel.left` / `.panel.right` instead of generic `.left` / `.right` classes.
- Solar overview planet positions advance with simulation time.

---

## Source: `README_v5.10.7.md`

# v5.10.7 Stellar Navigation / Reference Frame

- Creator scale: Solar overview from ~0.35 AU; local stellar neighborhood from ~0.04 ly to 1 ly.
- Stellar overview shows Sol and nearby reachable star-system targets (Alpha Centauri, Barnard, Sirius, Epsilon Eridani, Procyon, Tau Ceti).
- Star field now changes with simulated sidereal rotation in avatar-reference mode.
- Added avatar-reference / stellar-reference toggle with orbital-path icon.
- Solar overview keeps all eight planets and their orbital motion.
- At AU/ly scales the view no longer becomes empty: solar or stellar map representation is used.
- Star-system objects include reachable metadata as a foundation for future rocket/spacecraft travel and landing.

---

## Source: `README_v5.10.8.md`

# Universe Engine Mechanical Modeler v5.10.8

## Biome / Land Coverage
- Home planet target land fraction defaults to about 30%.
- Spawn search remains land-only and targets about +1000 mm above sea level.
- Biomes: ocean, coast, wetland, plain, forest, desert, tundra, mountain, snowfield.
- Terrain seed changes regenerate the land/ocean distribution.

## Spacecraft Builder
Toolbar: `🚀 宇宙船`

Installable CAD entities:
- Rocket engine
- Fuel tank
- Pilot seat
- Landing leg
- Parachute
- RCS thruster

Select multiple spacecraft parts and register them as a craft. The initial flight core supports:
`landed -> ascent -> orbit -> transfer -> arrival orbit -> descent -> landed`.

Commands:
- `SPACEPART engine|tank|seat|landing|parachute|rcs`
- `SPACECRAFT ASSEMBLE`
- `SPACECRAFT BOARD`
- `SPACECRAFT LAUNCH`
- `SPACECRAFT ORBIT`
- `SPACECRAFT TRANSFER <celestial-id>`
- `SPACECRAFT LAND`

## Celestial naming
Click a visible planet, moon, star-system marker, or sky star to open Celestial Properties.
The initial name is its identifier. Rename it and independently enable/disable its label.

Commands:
- `CELESTIALNAME <id> <new name>`
- `CELESTIALLABEL <id> ON|OFF`

Celestial names and spacecraft state are included in `.uecad` project data.

---

## Source: `README_v5.10.9.md`

# Universe Engine Mechanical Modeler v5.10.9

## Celestial selection
- Home terrain (`PLANET-HOME-0001`) is no longer a celestial click target while walking/editing on its surface.
- The home planet can still be configured from Planet / Terrain and appears as `SOL-P03` in the solar-system overview.

## Star catalogue
- Every generated sky point now receives a persistent identifier/name at creation time (`SKY-000001` ...).
- Each star can still be renamed and its label individually shown/hidden.

## Orbital Mechanics Core
New `src/workspace/orbital-mechanics.js` implements:
- inverse-square two-body gravity
- circular and escape velocity
- state-vector orbital elements (semi-major axis, eccentricity, period, energy)
- semi-implicit numerical propagation
- Tsiolkovsky rocket equation / remaining delta-v
- Hohmann transfer delta-v and transfer-time estimates

Spacecraft flight now keeps physical position and velocity vectors in metres / m/s around the active central body. Launch thrust and fuel flow are integrated continuously. Orbit insertion circularizes at the selected altitude. Prograde/retrograde impulse burns change the orbit. Interplanetary transfer uses a heliocentric Hohmann estimate for the solar-system targets.

### Commands
```
SPACECRAFT THROTTLE 75
SPACECRAFT BURN prograde 5
SPACECRAFT BURN retrograde 2
SPACECRAFT ORBIT 200000
SPACECRAFT TRANSFER SOL-P04
```

---

## Source: `README_v5.11.0.md`

# Universe Engine Mechanical Modeler v5.11.0

Cockpit / Position / Terrain Detail

- Spacecraft current-position readout: latitude, longitude, altitude and XYZ meters while near a planet; transfer progress and elapsed/total days during interplanetary transfer.
- Boarding now switches to a cockpit-follow camera and hides the avatar while seated; an Unboard action restores the avatar.
- Added `SPACECRAFT UNBOARD` command.
- Planet terrain controls: continent scale, detail strength, roughness and mountain sharpness.
- Terrain generator now layers broad continents, ridged mountains, multi-frequency detail and a simple erosion term while preserving the land/ocean and biome system.

Live Server: extract the ZIP to a fresh folder and hard reload once after updating.

---

## Source: `README_v5.11.1.md`

# Universe Engine Mechanical Modeler v5.11.1

## Spacecraft navigation / walkable ship update

### Camera modes
- Cockpit: camera anchored to the seat, right stick / mouse look can look around.
- Chase: spacecraft-centred chase camera.
- Orbit: spacecraft-centred spherical overview camera.
- `C` cycles cockpit -> chase -> orbit while piloting.

### Flight controls
While seated in the pilot seat:
- W / S: pitch control
- A / D: yaw control
- Q / E: roll input state
- Shift: throttle +5%
- Ctrl: throttle -5%
- Left virtual stick: pitch/yaw control
- Right virtual stick: camera look/orbit

The existing throttle slider, prograde/retrograde burns, orbit insertion, transfer and landing controls remain available.

### Engine plume
Engine objects now emit a visible animated exhaust plume while thrust is active and fuel remains. The plume can be toggled from the spacecraft panel.

### Walkable large spacecraft
- `船内FPV` / `船内TPV` re-enables the avatar while the spacecraft keeps moving.
- The avatar is translated together with the moving spacecraft.
- A downward raycast keeps the avatar on spacecraft part surfaces where possible.
- `運転席へ戻る` returns to cockpit control.
- `改造モード` enables Creator while the ship remains an ordinary assembly of editable CAD objects.

This is the first moving-building implementation: large spacecraft remain made from ordinary objects, so their interior/exterior can be edited during travel.

### Terrain detail
Planet terrain generation adds adjustable valley, plateau, cliff, island and erosion signals on top of continent, mountain and detail noise. Controls are available in Planet / Terrain.

## Commands
```text
SPACECRAFT CAMERA cockpit
SPACECRAFT CAMERA chase
SPACECRAFT CAMERA orbit
SPACECRAFT WALK fpv
SPACECRAFT WALK tpv
SPACECRAFT SEAT
SPACECRAFT MODIFY ON
SPACECRAFT MODIFY OFF
```

---

## Source: `README_v5.11.2.md`

# v5.11.2 Building Access & Vertical Navigation

- 建築物・大型宇宙船共通のドア、窓、階段、ハシゴを追加。
- ドアは蝶番 MotionAxis とドアノブを持つ複数パーツ構成。選択して「↔ 開閉」または `DOOR`。
- 窓は半透明ガラス＋枠のアセンブリ。
- 階段はアバターが登れる歩行面として生成。
- ハシゴはレール・段＋低透明度の climb-aid を備え、通常の歩行面判定で高低差を移動しやすくした。
- 惑星上のアバター足元判定を建築/CAD walkable objectにも拡張。
- `BUILD door`, `BUILD window`, `BUILD stairs`, `BUILD ladder`, `DOOR` コマンドを追加。

---

## Source: `README_v5.11.3.md`

# Universe Engine Mechanical Modeler v5.11.3

## Smart Openings / Auto Vertical Fit
- Select a wall, then create Door or Window: the host wall is replaced by opening-aware wall segments and the access part is inserted into the opening.
- Door/window keep the selected wall orientation.
- Select two floors/platforms, then create Stairs: rise and run are inferred from the selected levels.
- Select building/ship parts spanning a height, then create Ladder: ladder height automatically extends across the selected vertical range.
- Works with ordinary buildings and walkable spacecraft because access parts remain normal editable CAD/building objects.
- Existing manual placement remains available when no host/target objects are selected.

---

## Source: `README_v5.11.4.md`

# v5.11.4 Human Scale Spacecraft / Compact Transform / Snap Camera

- Spacecraft parts resized to human-scale proportions; added crew hull, interior deck and hull-wall parts.
- Hull walls can use the shared building door/window opening workflow.
- Added cockpit attitude-control buttons for yaw/pitch/roll; existing W/S A/D Q/E and throttle controls remain.
- Middle-mouse drag pans the camera focus; right-mouse drag rotates the view.
- Transform (M/R) UI changed from a wide bottom panel to a compact vertical right-side palette.
- Creator palette can temporarily hide/show the avatar for close-up workbench modelling.
- Object drag/copy now applies Building Assist face-to-face snapping when SNAP/AUTO is enabled.
- Clicking back into the viewport releases focused form controls so avatar WASD movement resumes during building work.

---

## Source: `README_v5.11.5.md`

# Universe Engine Mechanical Modeler v5.11.5

## Smart Snap Targets

- 移動/コピー中に近傍オブジェクトのスナップ候補をリアルタイム表示
- 頂点、辺中点、面中心、オブジェクト中心、XYZ軸端を候補化
- 黄色いマーカーと候補種別・対象名をビューポートへ表示
- マウスを離した時、移動側の最も近い基準点を候補へ密着
- Ctrl+ドラッグコピーにも同じSmart Snapを適用
- Creator右上パレットからSmart Snapと候補種別を個別ON/OFF
- 候補が無い場合は従来のBuilding Assist面スナップへフォールバック

---

## Source: `README_v5.11.6.md`

# Universe Engine Mechanical Modeler v5.11.6

## Dual Recipe Thumbnails
- Recipe / Blueprint 登録時に2種類のサムネイルを自動生成します。
  - 📷 Screenshot: 現在のメインビューポートを切り抜いた画像。
  - 🧊 Model: 選択モデルだけを専用のオフスクリーン3Dシーンで自動フィットして描画した画像。
- ライブラリカード上で Screenshot / Model を切替可能。
- 各サムネイルは個別に撮り直し可能。
- 標準表示を登録時に選択可能。
- サムネイルは `.uecad` と `.uerecipe.json` の Recipe データ内へ保存されます。

## Category expansion
標準カテゴリ: アイテム / 道具 / 食べ物 / 建築素材 / 建築 / 家具 / 乗り物 / 機械 / キャラ / 服装 / 武器 / 装備 / クリーチャー / その他。

---

## Source: `README_v5.11.7.md`

# Universe Engine Mechanical Modeler v5.11.7

## Marketplace Economy + Safe Ground Recovery

- Fixed avatar getting stranded on top of doors / wall-like building parts.
  - Door, door frame, window, wall, column are no longer treated as avatar walkable support surfaces.
  - Floors, roofs, stairs, ladder climb aids, platforms and foundations remain walkable.
  - Storing a portable workbench now immediately recalculates a safe supporting surface.
- Added Marketplace Core.
  - Anyone can create a Market and place a Market Entity in the world.
  - Market owner can set commission from 0% to 20%.
  - Platform Contribution default: 1% of seller distribution and 1% of market commission distribution.
  - Point wallets, purchase ledger, marketplace/platform balances.
  - Recipe / Blueprint listing with screenshot/model thumbnail.
  - Price breakdown: material cost + labor + creator margin + sale price.
  - License choices: use, modify, redistribute, commercial use, derivative sale.
  - 1–5 star ratings for purchased products only.
  - Rating reward is independent of the score and can be funded from the advertising pool.
  - Advertising revenue pool and configurable distribution percentage.
- Marketplace data is included in `.uecad` project save/load.

This remains an in-engine point economy. External payment, cash conversion, identity, tax and legal settlement are intentionally not implemented in this browser prototype.

---

## Source: `README_v5.11.7a.md`

# Universe Engine Mechanical Modeler v5.11.7a — Ground Recovery Hotfix

## Fixed
- Workbench storage now forces the avatar back to the actual planet terrain surface.
- Walking support raycasts now start just above the avatar's current feet instead of from a fixed high altitude.
- The avatar can no longer teleport upward onto a door/header/roof merely because it is vertically above the current position.
- Door leaf, door frame, knob, window, wall, column, ladder rails and ladder rungs are excluded from automatic walking support.
- Human-sized step-up limit is enforced; downward recovery remains possible.

---

## Source: `README_v5.11.7b.md`

# v5.11.7b Movement / Ground Separation Hotfix

- Planet locomotion and grounding are now separated.
- WASD / arrows / left stick always update the tangent-plane position first.
- Grounding only changes radial `surfaceOffset`; it never rewrites latitude/longitude orientation.
- Workbench storage triggers a one-shot terrain recovery with a short cooldown, then normal movement resumes.
- Door / wall / column / window remain excluded from walkable support surfaces.

---

## Source: `README_v5.11.8.md`

# v5.11.8 Placement Target System

- 建築物の生成中心をアバター中心から分離。
- FPV/TPVではカメラ焦点/視線先を配置基準に使用。
- 焦点がアバター中心付近の場合は前方約2500 mmへ自動オフセット。
- 作業台の惑星上Deployもアバターと同一地点ではなく、進行方向約2500 mm先の地表へ配置。
- 作業台Creatorでは従来どおり作業台中心をローカル原点として使用。
- Safe Ground Recoveryは保険として維持し、通常生成時の位置決定には使用しない。

---

## Source: `README_v5.11.8a.md`

# v5.11.8a Fixed Design Anchor Hotfix

- Fixed a bug where buildings followed the avatar because the CAD/work coordinate frame was rebuilt from the avatar planet normal every frame.
- The planet tangent design frame is now captured once and stays fixed while the avatar moves.
- Added `reanchorDesignSpace()` for explicit future re-anchoring instead of implicit per-frame re-anchoring.
- Existing Placement Target behavior (view target / forward placement / workbench origin) is preserved.

---

## Source: `README_v5.11.9.md`

# v5.11.9 Planet Surface Design Anchor

- Planet Design Anchor direction is now persisted in project state.
- Avatar movement no longer changes the design/building coordinate frame.
- Explicit re-anchor updates the saved planet anchor.
- Added `⇩ 建築を地表へ再接地` in Building Assist.
- Re-ground changes only CAD Z, preserving designed X/Y layout.
- Selected buildings are re-grounded together; with no selection all building entities are corrected as one set.

---

## Source: `README_v5.12.0.md`

# v5.12.0 — Door Hinge / Land-Water / Workbench Reach Origin

- Door leaves now rotate around their actual hinge edge instead of their center.
- Door commands support selected/nearest doors and `DOOR ALL OPEN|CLOSE`.
- Terrain calibration now targets the final visible land fraction (~30%) after terrain detail, not only the broad continent mask.
- Default water render surface is slightly lower and wave amplitude/detail are increased.
- Deployed workbench creation is constrained to the workbench top plane and footprint.
- World FPV/TPV creation uses the center camera ray intersecting a configurable avatar reach sphere (`Creator > 間合い mm`).

---

## Source: `README_v5.12.1.md`

# Universe Engine Mechanical Modeler v5.12.1

## Reference Mate / Explicit Snap

- 建材に限らず任意のCADオブジェクトで基準一致を利用可能。
- Creatorパレットの「🔗 基準一致」から開始。
- 移動元の基準をクリックし、次に移動先の基準をクリック。
- 対応基準: 頂点、辺中点、面中心、オブジェクト中心、X/Y/Z軸。
- 移動元マーカーはオレンジ、移動先マーカーは黄色。
- 頂点/中心は位置一致。
- 面→面は面法線を合わせて密着。
- 辺→辺、軸→軸は方向を合わせてから位置一致。
- 反転、オフセット(mm)に対応。
- 複数選択中に選択部品の基準を移動元にすると、選択グループ全体を同じ変換で移動。
- 「拘束として記録」でReference Mate履歴をプロジェクトへ保存。
- ESCで基準一致をキャンセル。

## Validation
- 全JavaScriptを node --check で確認。
- HTML ID重複なし。

---

## Source: `README_v5.12.2.md`

# Universe Engine Mechanical Modeler v5.12.2

## Property Transform / Advanced Reference Mate

### プロパティUIへ変形UIを統合
- 右プロパティパネル上部に `プロパティ / 変形` 切替ボタンを追加。
- M / MOVE は右パネルの「変形 > 移動」を開く。
- R / ROTATE は「変形 > 回転」を開く。
- SCALE / SC は「変形 > 拡縮」を開く。
- REL / ABS、XY平面ドラッグ、Z高さドラッグ、確定、戻す、完了を同じ右パネル内へ統合。
- 従来の大きな変形ダイアログを廃止し、ビューポートを隠しにくくした。

### Reference Mate 拡張
基準をオレンジ（移動元）/黄色（移動先）で明示して、以下を適用可能。
- 自動 / 一致
- 同心・同軸
- 平行
- 垂直
- 距離 (mm)
- 角度 (deg)
- 反転
- オフセット
- Mate拘束として記録

建築部材だけでなく通常部品・機械・家具・宇宙船部品など共通で利用できる。

---

## Source: `README_v5.12.3.md`

# v5.12.3 Snap / Datum / Safe Spawn / Village
- Creator Snap: master 〼 ON/OFF plus endpoint, midpoint, face, axis center, sphere/object center filters.
- Object Properties: datum add/change entry points for reference point/axis/plane editing.
- Avatar: move to selected object coordinate or entered XYZ; unsafe/water destination cancels.
- FPV: right virtual stick remains active through MobileControls view delta.
- Planet spawn: stronger dry-land search with shoreline/slope rejection and highest-land fallback.
- Spawn village: 2–3 simple houses generated around the initial dry spawn point.

---

## Source: `README_v5.12.4.md`

# Universe Engine Mechanical Modeler v5.12.4

## Fixes / additions
- Strengthened dry-land spawning with a persistent local spawn-land patch around the home normal.
- Spawn village now uses raised foundations and visible door/window elements.
- Fixed FPV right-stick camera look on spherical planets: yaw rotates the planet-forward tangent and pitch changes the look vector.
- Added always-visible Avatar Position HUD: latitude, longitude, altitude, planet XYZ and design-anchor XYZ.
- Improved ocean rendering: transparent depth handling, denser broad-wave mesh, animated procedural fine-ripple bump texture, and 30 Hz water updates.
- Keeps existing 30% target land fraction, biomes, village generation, Creator/Mate/Datum systems and marketplace features.

---

## Source: `README_v5.12.5.md`

# Universe Engine Mechanical Modeler v5.12.5

## Dry Surface / Accessible Village / Solar Water Lighting

- Fixed spawn-terrain mismatch: the selected `homeNormal` is now frozen before the landing patch is rebuilt. Avatar grounding and rendered terrain use the same direction, so changing the target spawn elevation no longer creates a floating avatar.
- `spawnElevationMm` is treated only as a terrain-search target, never as an additional avatar height.
- Spawn village houses now have an open doorway by default so the generated houses are enterable immediately.
- Planet mode disables the stationary workspace directional light. Ocean highlights now come from the simulated moving Sun instead of a fixed non-stellar light source.
- Ocean render level moved slightly inward and broad wave amplitude reduced so wave crests remain below nominal sea level, reducing apparent water overlap over dry terrain.
- Increased water mesh density and added much finer animated bump ripples plus higher-frequency geometric components.

---

## Source: `README_v5.12.6.md`

# v5.12.6 Adjustable Water Sphere Radius

- Added an explicit **Water sphere radius (mm)** setting to Planet / Terrain.
- Default water radius is 999,700 mm for the default 1,000,000 mm planet.
- Water rendering now uses the configured absolute radius directly instead of deriving it only from the planet radius plus an internal render offset.
- Added editable wave amplitude beside the water radius.
- Geometric wave displacement is centered on the configured water radius, so lowering the water sphere actually lowers the visible ocean instead of being capped back near the nominal planet radius.
- Commands: `PLANET WATERRADIUS 998000` and `PLANET WAVE 120`.
- Terrain sea-level logic remains independent, allowing visual diagnosis of whether the ocean sphere or terrain generation is causing apparent flooding.

---

## Source: `README_v5.12.7.md`

# v5.12.7 Special Object Properties

- Planet, avatar, camera, workbench, grid and celestial bodies are selectable special objects in the Object Tree.
- Special objects are grouped in collapsible categories. Ordinary models are grouped under a collapsible Model / Parts category.
- Planet water radius and terrain settings can be modified directly from the Properties panel.
- Part selection / Group selection scope toggle added.
- Global camera home/reset button added.

---

## Source: `README_v5.12.8.md`

# Universe Engine Mechanical Modeler v5.12.8

## Universal Dial / Celestial Environment Properties
- 天体プロパティに環境・回転・軌道を内包。
- 惑星: 半径、水球半径、標高差、波、陸地率、重力、大気圧、温度、自転、公転、地軸傾斜を直接編集。
- 天体: 半径、質量、重力、温度、大気圧、水面、地形、波、自転、公転、軌道傾斜を保存。
- 共通 Universal Dial を特殊オブジェクトのプロパティに追加。
- 数値ENTRY/◉選択とダイヤルを同期。中央に対象名・数値・単位を表示。
- 刻み 0.001〜1000、ホイール、±、円周ドラッグ対応。
- Time / Time Scale / Creator Scale のクイック操作を追加。

---

## Source: `README_v5.12.9.md`

# v5.12.9 — Floating Universal Dial / Panel Edge Handles

- Universal Dial をプロパティ内から分離し、ビューポート左上の常設オーバーレイへ統合。
- Universal Dial は折り畳み可能。中央に選択中の要素名・値・単位を表示。
- 特殊オブジェクトの数値ENTRY/◉を選ぶと、左上Universal Dialへ接続。
- Time / Time Scale / Creator Scaleも同じダイヤルで操作可能。
- 左/右パネルを折り畳むと画面端に → / ← の展開ハンドルを表示。
- リボン上の部品/プロパティボタンからの再展開も維持。

---

## Source: `README_v5.12.10.md`

# Universe Engine Mechanical Modeler v5.12.10

## Property Live Preview
- 通常部品の数値プロパティを `input` 中に即時プレビュー。
- 惑星・アバター・グリッド・天体の特殊プロパティを適用ボタン前にライブプレビュー。
- Universal Dial / マウスホイールによる数値変更も同じライブプレビュー経路へ接続。
- 惑星・アバターの重い再構築は短いデバウンスを入れ、連続操作時の負荷を抑制。
- 「適用」ボタンは明示的な確定操作として残す。

Base: v5.12.9a FloatingUniversalDial SyntaxFix

---

## Source: `README_v5.12.11.md`

# v5.12.11 Property Direct Edit / Auto Apply

- プロパティの数値入力欄を直接編集できない問題を修正。
- 数値入力中はプロパティパネルを再描画せず、フォーカスとカーソル位置を維持。
- 数値変更は約90msの短いデバウンス後に自動ライブ反映。
- Enter / change / checkbox / select は即時反映。
- Universal Dial / マウスホイールからの数値変更も同じ自動反映経路を使用。
- 「適用」ボタンを押さなくても3Dプレビューへ反映される。

---

## Source: `README_v5.12.12.md`

# v5.12.12 Property Full Edit

- 惑星の通常プロパティを詳細設定と同等の編集項目へ拡張。
- プロパティから惑星半径、水球半径、標高差、スポーン標高、波、陸地率、シード、地形詳細、山岳、谷、台地、崖、島、侵食、河川数、植生密度などを直接変更可能。
- 大陸、山岳、バイオーム、海、河川、植生、大気、天体名表示、惑星モードを通常プロパティからON/OFF可能。
- 数値入力・チェック変更は適用ボタン不要で自動反映。
- 詳細設定ボタンは互換・補助用として残す。

---

## Source: `README_v5.12.13.md`

# Universe Engine Mechanical Modeler v5.12.13

## Property direct edit payload fix

- Fixed normal Property panel numeric/checkbox/select edits not reaching the state updater.
- `ue:special-property` preview/apply events now send edited fields under the expected `values` payload.
- Property edits now update state and live-preview without opening the detailed settings dialog.
- Universal Dial edits use the same corrected live-preview path.

---

## Source: `README_v5.13.0.md`

# Universe Engine Mechanical Modeler v5.13.0

## Cross Play / Collaborative World 基盤

- 🌐 MULTI ダイアログを追加
- HOST / JOIN / Disconnect / Publish Now
- Room ID と Player name、Relay URL を指定可能
- PC / smartphone / tablet を同一 Room へ接続する WebSocket relay 方式
- UECAD の既存シリアライズ形式を共同編集の共有 state に再利用
- オブジェクト、CADデータ、建築、惑星設定、ワークスペース等を共有
- 変更を約450ms間隔で検出し Room へ同期
- Relay server が Room の最新 snapshot を保持し、途中参加者へ自動配布
- Room 内で snapshot に sequence 番号を付与して順序を統一
- 現段階の競合解決は Last-write-wins
- 各プレイヤーの avatar / camera controls は共有 project state から分離
- avatar position / orientation / selected object を Presence として約120ms単位で送信
- 他プレイヤーを簡易3D avatar marker として scene 内へ表示
- Players 一覧で接続人数、HOST、相手が選択中の object を表示
- HOST切断時は Relay が次の接続者へ HOST を引き継ぐ

## Relay Server

`server/` を追加。

```bash
cd server
npm install
npm start
```

Default: `ws://0.0.0.0:8787`

同一LANでは、たとえばPCが `192.168.1.10` の場合、スマホ側の Relay URL を `ws://192.168.1.10:8787` にする。
HTTPS / GitHub Pages から利用するときは relay を TLS 化して `wss://` で公開する。

## 次段階

- object 単位の soft lock / edit ownership
- 差分同期（現在は project snapshot）
- chat / voice / WebRTC data channel
- user permissions / room password
- reconnect / offline merge
- authoritative physics / NPC synchronization

---

## Source: `README_v5.14.0.md`

# Universe Engine Mechanical Modeler v5.14.0

## Terrain-follow walking
- Planet walking evaluates terrain surface radius at the new latitude/longitude every frame.
- Floors, roofs, stairs, platforms and foundations remain walkable offsets above terrain.
- Normal walk stride is fixed to 500 mm per step. Running stride defaults to 850 mm.

## Mobile game UI
- Existing left/right stick UI is retained.
- Bottom-center inventory hotbar added.
- Four action buttons added at right side.
- Action buttons are user-configurable: Jump, Use, Inventory, View, Run, Walk, hand actions, Workbench, Multiplayer.

## Cross-play / Cross-save
- Multiplayer Room can be CO-OP or VERSUS and players can choose Team A/B/C/FREE.
- Player presence includes play mode and team.
- Relay persists the latest Room project snapshot under `server/data`, enabling cross-device resume with the same Room name.
- GitHub Pages hosts the static frontend only. Public cross-play requires a separately hosted `wss://` Relay.

## GitHub Pages
- `.github/workflows/pages.yml` deploys the repository root to GitHub Pages on pushes to main.

## VR foundation
- WebXR VR entry button added to the mobile HUD.
- Renderer uses `setAnimationLoop`, compatible with immersive WebXR rendering.
- Requires HTTPS and a browser/HMD supporting `immersive-vr`.

## Current multiplayer scope
- Shared world editing, persistent room snapshots, player presence, team/mode metadata are implemented.
- Combat/damage/respawn rules for VERSUS are a next-stage system, not yet a full battle implementation.

---

## Source: `README_v5.15.0.md`

# Universe Engine Mechanical Modeler v5.15.0

## Multiplayer Gameplay Foundation

v5.15.0 extends the v5.14.0 cross-play base with first-pass cooperative and versus gameplay.

### CO-OP
- Selected objects can be marked for cooperative carry.
- One or more connected players may join the same carry target; the object follows the average world position of current participants.
- Carry participation is stored in shared project state and follows normal room/cross-save synchronization.
- Active spacecraft now expose shared multiplayer seat state: pilot and passengers.
- Cockpit/camera flags are kept local so one player's pilot camera does not force every connected client's camera.

### VERSUS
- Per-player HP / max HP / KO / death counters are sent in Presence packets.
- ATTACK targets the nearest valid opponent in front of the avatar, within the configured attack range and cone.
- Default damage: 25. Default HP: 100. Default range: 1800 mm.
- Friendly fire is disabled by default.
- HP 0 enters DOWN state and automatically respawns after 2.5 seconds; manual RESPAWN is also available.

### Mobile
- Mobile HUD displays CO-OP / VS team and HP.
- Configurable action buttons now support ATTACK, CARRY, PILOT, RIDE, EXIT and RESPAWN.

### Relay
- Added `game-event` forwarding for damage/KO events.
- Project snapshots continue to carry world/build/vehicle state, while player combat state remains Presence data.

This is a gameplay foundation rather than an authoritative competitive server. A later version should add server-side validation, object edit locks, latency compensation, weapons/projectiles, character inventories, permissions and anti-cheat rules before public competitive use.

---

## Source: `README_v5.16.0.md`

# Universe Engine Mechanical Modeler v5.16.0 — Craft / Inventory / Equipment

- クラフト → インベントリ → 左右手装備 → 使用のゲームループを追加。
- 初期テスト素材: 木10 / 石8 / 鉄6 / 繊維6。
- 初期レシピ: 木のクラブ、石のつるはし、鉄の剣、シールド、ボウ、たいまつ、包帯、木壁キット。
- 装備した武器の damage / range / cone をVERSUS攻撃へ反映。
- シールドの armor を被ダメージ軽減へ反映。
- スマホHUDにクラフトボタンを追加。Inventoryから左右手へ直接装備/解除可能。
- アイテムはCADオブジェクトを実体として保持し、Gripソケット + item/equipment/weapon/tool component を利用。
- ItemCraftingManager.customItemFromSelected() で自作CAD形状を将来のUIからアイテム化可能。
- プロジェクト保存/クロスセーブでは inventory / object metadata / avatar equipment を既存保存経路に含める。

## 次段階
- 採集（木・石・鉱石）→素材獲得
- 作業台レベル/必要工具/クラフト時間
- 防具スロット（頭・胴・脚・足）と耐久度
- 弓/銃器の投射体、弾薬、リロード（ゲーム表現）
- CADで作成した任意形状をUIから「アイテム化」「武器化」

---

## Source: `README_v5.17.0.md`

# Universe Engine Mechanical Modeler v5.17.0

## Survival Resource Loop
- 惑星上に採取可能な資源ノードを追加: 木 / 岩 / 鉄鉱床 / 繊維植物
- 各資源は HP・枯渇状態・再生成時刻を持ち、プロジェクト/クロスセーブ対象
- HARVEST アクションで近くの資源を採取
- 道具相性: 石の斧=木、石のつるはし=岩/鉄鉱床。適正外でも低効率で採取可能
- スマホの4アクションボタンへ HARVEST / CRAFT を割当可能

## Processing / Workbench
- 石の斧を追加
- 作業台加工: 木→木材、石→石材、鉄鉱石→鉄、鉄+木材→機械部品
- 作業台を展開していない場合、加工レシピは無効
- 手押しカートキットのクラフト基盤を追加

## Save / Multiplayer
- survival.resourceNodes を .uecad に保存
- Roomスナップショットにも含まれるため、採取済み資源が共同ワールド/クロスセーブで維持される

---

## Source: `README_v5.18.0.md`

# Universe Engine Mechanical Modeler v5.18.0 — World Physics Foundation

## Added / changed
- Avatar wall/CAD-solid collision using a capsule-like body check. Movement into solid walls is rejected.
- Planet grounding now raycasts the actual rendered `PlanetTerrain` mesh, reducing visible floating caused by analytic-height vs mesh interpolation differences.
- Walking stride is unit-correct: normal step is 500 mm and is converted through `workspace.unitScaleMm` before locomotion.
- Existing walkable floors/roofs/stairs remain support surfaces while walls/columns/general solids block horizontal movement.
- Spawn/home terrain gets a broader gentle flattening blend so settlements and early civilization building have a usable starting area.
- New projectile physics layer for bows: arrows are visible world objects with velocity, gravity, ballistic arc, object/terrain collision, sticking, and multiplayer hit damage.
- Planet projectile gravity points toward the planet center and uses `surfaceGravityMS2` (default Earth-like gravity when unspecified).
- Ranged weapons now route the existing ATTACK action through projectile firing instead of instant cone damage.

## Test notes
- Equip `ボウ`, switch MULTI to VERSUS, then use ATTACK. The arrow should visibly arc and can hit remote players or world solids.
- Walk into a building wall: the avatar should stop rather than pass through it.
- Walk over planet terrain: feet should track the rendered mesh more closely than v5.17.0.

---

## Source: `README_v5.19.0.md`

# Universe Engine Mechanical Modeler v5.19.0 — Surface Placement / Floor Plan / Paint

- Unified planet surface resolver for CAD/building placement.
- Creator mode uses raycast against the rendered PlanetTerrain before fallback placement.
- Building re-ground now resolves each object against actual curved terrain.
- Water default uses 99.8% of planet radius (99,800 mm when planet radius is 100,000 mm; 998,000 mm at the current 1,000,000 mm default).
- Vegetation density now includes biome, water margin, slope and spawn/civilization clearing conditions.
- Floor-plan-to-building mode: `RoomName,X,Y,Width,Depth` lines generate floors and perimeter walls.
- Surface Paint / Signage: background color, text and uploaded illustration are stored on model metadata and rendered as a CanvasTexture; suitable as a future advertising surface.
