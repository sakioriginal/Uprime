# Universe Engine History — v5.30 to v5.39

This file consolidates the original per-version README files without intentionally removing their historical content.


---

## Source: `README_v5.30.0.md`

# Universe Engine v5.30.0 — Living Society Foundation

## Added
- Villager life stats: HP, stamina, hunger, thirst, age, life expectancy, alive/dead state.
- Intelligence and command memory capacity. Learned RTS commands are limited by intelligence.
- Personal inventory, cash/assets, debts/claims placeholders.
- Family/lineage model: spouse, parents, children, inheritable gene values.
- Daily village AI: sleep → work → market → leisure, using planet simulation time.
- Occupational production: agriculture, forestry, metallurgy, trade, construction, governance, culture.
- Village resources, wealth, prices, taxes, technology levels, territory, diplomacy.
- Shared PT and village-local currency schema for future independent currencies/exchange rates.
- Death/old age foundation and grave/memorial records.
- Marriage API and birth/genetics data foundation (birth simulation remains disabled by default).
- NPC transforms now follow live profile positions, allowing life AI movement without rebuilding all NPC meshes.

## Roadmap hooks
- Birth, inheritance, visible aging, weddings/funerals and physical graves.
- Monsters, wildlife/prey, hostile and allied factions.
- Technology discovery and user-designed technology/blueprints.
- Supply/demand markets, multiple currencies, FX, banking, loans, deposits, securities and taxation.

---

## Source: `README_v5.31.0.md`

# Universe Engine Mechanical Modeler v5.31.0

## Living Production & Logistics Economy

- 職業村人の生産を「即時の数値加算」から実物流へ変更。
- 農民・木こり・狩人は仕事場で生産し、荷物を持って共同倉庫まで運搬する。
- 鍛冶屋は村の鉄を消費して工具を生産、大工は木材＋石材から建築部品を生産する。
- 村に共同倉庫オブジェクトを追加。新規村では実際の運搬先になる。
- 商人/店番は不足している店頭資源を倉庫から取り出し、店まで運んで在庫補充する。
- NPCが運搬中は簡易カーゴを手元に表示。
- 村の食料は人口に応じて消費される。
- 店頭在庫・村倉庫在庫・需要/供給から資源価格を自動変動。
- プレイヤーの購入で需要、売却で供給シグナルが増え、時間とともに減衰。
- VILLAGE画面に倉庫在庫、工具/建築部品、現在価格、累計配送量、店補充量を表示。
- 生産・配送・価格・在庫・物流履歴は既存のプロジェクト保存/クロスセーブ対象。

### 現在の生産フロー

農地/森林/狩場 → 村人が生産 → 手持ちカーゴ → 共同倉庫 → 商人がピックアップ → 店 → プレイヤー購入

次段階では畑・木・鉱脈そのものを職業AIの作業対象にし、荷車・道路・工房・市場を使った物流へ拡張可能。

---

## Source: `README_v5.32.0.md`

# Universe Engine Mechanical Modeler v5.32.0

## Resource AI / Roads / Carts / Inter-Village Trade

- 村の初期人口を9人へ拡張し、職業「鉱夫」を追加。
- 村ごとに共同農地・伐採地・採掘場・工房・市場のworksite情報を保持。
- 共同農地・採掘場・村内道路をワールド上に簡易可視化。
- 木こりはSurvivalResourceManagerの実際のtreeノードを探索し、そこまで歩いて伐採する。
- 鉱夫は実際のoreノードを探索して採掘する。採掘済みノードはプレイヤーと共通の枯渇/再生状態を使用。
- 農民は共同農地へ出勤して食料を生産し、共同倉庫へ運ぶ。
- まとまった貨物ではNPCが荷車を使用。NPCモデルにも簡易荷車を表示。
- 荷車利用時は運搬速度を少し上げ、村の物流統計に荷車運行回数を記録。
- 村が2つ以上ある場合、商人が村間の在庫差を比較し、余剰資源を不足村へ運搬。
- 村間交易は送出元在庫を減らし、到着先共同倉庫在庫を増やす実物流方式。
- 複数村の間に交易路を簡易表示。
- VILLAGE画面に荷車運行回数と村間交易量を追加。
- worksite / roads / cartTrips / interVillageTransfers / NPC resourceTarget は既存のプロジェクト保存・クロスセーブ対象。

### 現在の物流フロー

実資源ノード/共同農地 → 職業NPCが探索・作業 → 荷物/荷車 → 共同倉庫 → 商人 → 店舗 または 他村共同倉庫 → 市場価格へ反映

### 次段階候補

- 道路の経路探索と道路上の移動速度補正
- 荷車の物理的な積載量・複数箱表示・破損
- 馬/牛などの牽引動物、荷馬車
- 工房ごとの加工設備と製造キュー
- 交易契約・関税・通貨交換・隊商
- 山賊/モンスターによる交易路リスクと護衛

---

## Source: `README_v5.33.0.md`

# Universe Engine Mechanical Modeler v5.33.0

## Grounding / Village placement fixes
- NPC render root now follows the CAD/work-coordinate root instead of raw world coordinates.
- Removed the extra half-body height added during NPC terrain-follow movement.
- Village resident and shopkeeper spawn positions are terrain-grounded.
- Village center, warehouse, worksites and road endpoints are re-grounded through the active PlanetTerrain resolver.
- Farm/mine infrastructure geometry now uses the CAD-to-world scale instead of raw millimeter values in world space.

## Roads / transport / production
- Villagers receive a movement speed bonus while traveling along village roads.
- Cargo selects handcart / ox-cart / horse-cart according to load and trip type.
- NPC cart visuals now include a draft animal for ox/horse carts.
- Blacksmith and builder output now enters a workshop manufacturing queue before becoming village goods.

## Caravan / trade foundation
- Inter-village trade creates caravan IDs.
- Available hunter/companion villagers may escort trading merchants.
- Destination-village tariffs are collected during trade delivery.
- Village currency exchange-to-PT values are retained as the basis for cross-currency settlement.
- Village UI shows workshop queue length, tariff rate and currency/exchange rate.

---

## Source: `README_v5.34.0.md`

# Universe Engine Mechanical Modeler v5.34.0

## Surface Anchor / Village Scale Fix

- Village buildings sample terrain height at each individual building center instead of reusing the village-center Z.
- Farm and mine infrastructure align their local Y axis to the planet surface normal, fixing the 90-degree tilt.
- Farm rows inherit the same surface quaternion and are offset along the local tangent frame.
- NPC visual height now converts the character height value through the workspace mm scale so villagers match the player avatar scale.
- Existing logistics/worksite positions continue to be re-grounded through PlanetTerrain.
- Existing saved village buildings are migrated/re-grounded on load, not only newly created villages.
- NPC visuals now live in world space like the player avatar; their CAD positions are converted to world positions each frame and their local up axis follows the planet radial normal.

---

## Source: `README_v5.35.0.md`

# Universe Engine Mechanical Modeler v5.35.0

## Living Village Motion / Housing Repair / Conversation

- Existing villages automatically repair missing housing: six village houses (floor/body/roof) are recreated when their house objects are absent.
- Village building IDs are rebuilt from actual village-owned objects after housing migration.
- NPC normal walking speed increased to about 900 mm/s; carts use about 650 mm/s before road multipliers.
- NPC visual locomotion now includes arm/leg swing and subtle body motion while walking.
- Leisure NPCs choose a new nearby destination after arriving, making the village visibly active outside work hours.
- NPCs can be clicked/tapped directly in the 3D viewport to open a conversation panel.
- Conversation panel supports free text and quick topics: greeting, occupation, village, gift, and trade.
- Conversation responses use NPC name, occupation, current activity, village and simple keyword context.
- Talking changes friendship/trust using the existing relationship system.
- Existing VILLAGE resident list conversation button now opens the same direct conversation UI.

---

## Source: `README_v5.36.0.md`

# v5.36.0 Living Homes / Active Villagers / NPC Status Tree

- 村人ごとに住宅を割り当て。既存村も住民数に応じて不足住宅を自動補修。
- 住宅は村の周囲にリング配置し、各村人へ homeId / homeName / home座標を保存。
- 睡眠時間でも村人が自宅まで実際に歩いて帰るよう修正。
- 生活サイクル: 睡眠 / 仕事 / 市場 / 交流 / 余暇 / 配送。
- 19:00〜20:30は広場で交流し、近くの村人同士が簡易会話する生活行動を追加。
- 3D村人クリック/タップ、VILLAGE画面、オブジェクトリストの💬から会話画面を開ける。
- オブジェクトリスト「特殊オブジェクト > 村人 / NPC」に職業、現在行動、HP、目的地、所属村を表示。
- NPC状態表示は約1.5秒ごとに更新。

---

## Source: `README_v5.37.0.md`

# v5.37.0 Grounded Village Homes

- Village homes now discard stale saved Z when resolving terrain height.
- House floor/body/roof anchors use X/Y only, then resolve authoritative Z from PlanetTerrain.
- Added `repairAllSurfaceAnchors()` late pass after PlanetTerrain and the planet work-coordinate frame are ready.
- Existing saved villages are re-grounded after planet initialization/project load.
- Villager home destinations are regenerated from the same grounded house layout.
- Village building meshes are resynced after late grounding.

---

## Source: `README_v5.38.0.md`

# v5.38.0 Grounded Living Village

- Removed the legacy decorative 3-house spawn village whenever a Living Village exists, preventing duplicate/floating houses.
- Living Village houses now sample center/corners and create four terrain-reaching foundation piers.
- Planet vegetation uses the rendered terrain surface and density is increased.
- Survival resource nodes expanded to 120 with more trees; nodes use rendered terrain for exact ground contact.
- Lumberjacks seek real tree resource nodes, walk to them, visibly chop, harvest wood and deliver it to the warehouse.
- Shared farmland expanded to about 10m x 6.5m with crop rows/markers.
- Farmers walk to the field, visibly work, harvest food and deliver it.
- Living Society frame timing now derives a real delta from the render timestamp and clears stale NPC controlled flags.
- NPC work animations added for farming, chopping and mining.

---

## Source: `README_v5.39.0.md`

# Universe Engine Mechanical Modeler v5.39.0 — Authoritative Grounded Homes Fix

- Village homes are re-grounded after PlanetTerrain and the work-coordinate frame are finalized.
- A stale `surfaceAnchored` flag no longer prevents the authoritative house grounding pass.
- Each home samples center + four corners from the rendered terrain.
- Floor underside is placed just above the highest support sample; house body and roof stack from that datum.
- Four foundations are resized and positioned from each terrain support point to the floor datum.
- `homeId` and foundation index metadata are now stored on floor/body/roof/foundations for stable repair, save/load and cloning.
- Existing saved villages are migrated by inferring house groups from their names when older metadata is absent.
