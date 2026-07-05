import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { VRButton } from "https://unpkg.com/three@0.160.0/examples/jsm/webxr/VRButton.js";

const hud = document.getElementById("hud");
const dialog = document.getElementById("dialog");
const settings = document.getElementById("settings");
const infoPanel = document.getElementById("infoPanel");
const statusPanel = document.getElementById("statusPanel");
const allyList = document.getElementById("allyList");
const placeList = document.getElementById("placeList");
const commandPopup = document.getElementById("commandPopup");
const homeScreen = document.getElementById("homeScreen");
const editorPanel = document.getElementById("editorPanel");
const marketPanel = document.getElementById("marketPanel");
const libraryPanel = document.getElementById("libraryPanel");
const cosmosPanel = document.getElementById("cosmosPanel");
const marketList = document.getElementById("marketList");
const libraryList = document.getElementById("libraryList");

let scene, camera, renderer, clock;
let worldRoot = null;
let xrWasPresenting = false;
let xrReticle = null;
let planet, player, clouds, atmosphere;
let npcs = [], creatures = [], resources = [], buildings = [], celestials = [], projectiles = [], archeryTargets = [];
let yaw = 0, pitch = -0.16, zoom = 16;
let keys = {}, moveInput = {x:0,y:0}, lookInput = {x:0,y:0};
let commandTarget = null, selected = null;
let wood = 220, stone = 140, ore = 35, faith = 0;
let dangerAlert = "平穏";
let teachingMode = false, teachingLog = [];
let worldMinutes = 6 * 60;
let dayCount = 1;
let activeUnit = null;
let selectedCompanion = null;
let selectedPlace = null;
let places = [];
let inventory = { wood:0, stone:0, ore:0, food:3, water:3, coin:120 };

const materialCatalog = {
  wood:   {label:"木", density:500, resource:"wood", color:0x9b6b35},
  stone:  {label:"石", density:2500, resource:"stone", color:0x8c8c8c},
  iron:   {label:"鉄", density:7870, resource:"ore", color:0x787878},
  bronze: {label:"青銅", density:8800, resource:"ore", color:0xa86d33},
  gold:   {label:"金", density:19300, resource:"ore", color:0xd6b23f}
};
let editorBlueprintParts = [];
let savedBlueprints = JSON.parse(localStorage.getItem("pse_blueprints_v1") || "[]");
let lastBlueprintDraft = null;

const marketItems = [
  {id:"farm_house_set", cat:"building", icon:"🏠", name:"中世農家セット", author:"PSE標準", cost:50, uses:10, tags:["家","畑","収納"], desc:"小さな農家・柵・畑の設計図。サバイバルでは木120/石30を消費。"},
  {id:"training_yard", cat:"building", icon:"🎯", name:"射撃演習場", author:"PSE標準", cost:80, uses:8, tags:["弓術","的","経験値"], desc:"10m/25m/50mの的を含む訓練場。的中で弓術経験値。"},
  {id:"smart_storage", cat:"furniture", icon:"📦", name:"名前付き収納箱", author:"PSE標準", cost:25, uses:20, tags:["物流","収納","命令"], desc:"『木材を20入れる/取り出す』命令の対象になる収納箱。"},
  {id:"farmer_ai_v1", cat:"ai", icon:"👨‍🌾", name:"農夫AI v1", author:"PSE標準", cost:40, uses:999, tags:["水やり","収穫","市場"], desc:"天候・乾燥・成熟を見て畑作業を行う基本AIロジック。"},
  {id:"guard_ai_v1", cat:"ai", icon:"🛡️", name:"衛兵AI v1", author:"PSE標準", cost:45, uses:999, tags:["巡回","迎撃","警報"], desc:"脅威発見、仲間招集、警備地点の巡回を行う。知能で判断精度が変化。"},
  {id:"vr_bow_motion", cat:"motion", icon:"🏹", name:"VR弓術モーション", author:"PSE標準", cost:70, uses:30, tags:["背中の弓","矢筒","射撃"], desc:"弓を取る、矢をつがえる、引く、放つ動作を教材として登録。"},
  {id:"interstellar_probe", cat:"space", icon:"📡", name:"人格通信プロトコル草案", author:"デウス研究所", cost:100, uses:3, tags:["共同宇宙","星系","時間差"], desc:"受信機のある星系へ人格データを送る将来機能の設計図。"},
  {id:"meteor_event_pack", cat:"space", icon:"☄️", name:"隕石資源イベント", author:"PSE標準", cost:55, uses:15, tags:["隕鉄","未知鉱物","資源循環"], desc:"小惑星帯や恒星間天体由来の資源イベントを追加する土台。"}
];
let libraryItems = JSON.parse(localStorage.getItem("pse_library_v1") || "[]");
let regenQueue = [];
let panelRefreshTimer = 0;
const playerStats = { hp:100, stamina:100, hunger:18, thirst:12, spirit:82 };
let sunMesh = null, moonMesh = null, sunLight = null;
const R = 95;
const HUMANOID_GROUND_OFFSET = 0.82;
const CREATURE_GROUND_OFFSET = 0.55;
let inputProfile = "SMARTPHONE"; // SMARTPHONE / PC / VR / MR
let gameMode = "HOME"; // HOME / PLAY / EDITOR
let xr = { left:null, right:null, leftGrip:null, rightGrip:null, bow:null, sword:null, bowString:null, bowArrow:null, sword:null, backBow:null, quiver:null, waistSheath:null, drawing:false, bowInHand:false, arrowInHand:false, arrowNocked:false, swordInHand:false, drawStart:0, lastRightPos:new THREE.Vector3(), rightVelocity:new THREE.Vector3(), lastSwordHitAt:0, lastTrigger:false, lastGrip:false, lastLeftGrip:false };

const buttonMap = { A:"gather", B:"talk", X:"attack", Y:"storage" };

class Mind{
  constructor(name, role="村人"){
    this.name = name;
    this.role = role;
    this.schedule = makeSchedule(role);
    this.homePlaceId = null;
    this.workPlaceId = null;
    this.currentRoutine = "待機";
    this.loyalty = 25 + Math.floor(Math.random()*45);
    this.faith = Math.floor(Math.random()*25);
    this.memory = 3 + Math.floor(Math.random()*7);
    this.commands = [];
    this.personality = ["穏やか","勇敢","慎重","陽気","商人気質","研究好き"][Math.floor(Math.random()*6)];
    this.memories = [];
    this.senses = {
      vision: 20 + Math.random()*25,
      hearing: 20 + Math.random()*35,
      smell: 8 + Math.random()*22,
      touch: 30 + Math.random()*30,
      taste: 30 + Math.random()*30
    };
    // 知能は単なるIQではなく、AIロジックを動かす「判断性能」。
    this.intelligence = {
      reactionSpeed: 0.35 + Math.random()*0.65, // 高いほど判断が早い
      accuracy: 0.45 + Math.random()*0.5,       // 高いほど場所/行動選択ミスが少ない
      memory: this.memory,
      learning: 0.35 + Math.random()*0.65,
      focus: 0.35 + Math.random()*0.65,
      creativity: Math.random()*0.6
    };
    this.thinkCooldown = Math.random()*2;
    this.lastDecision = "";
  }
  canControl(){ return this.loyalty >= 70 || this.faith >= 70; }
  remember(text){ this.memories.unshift(text); this.memories = this.memories.slice(0,this.memory); }
  learn(cmd){ if(this.commands.length < this.memory){ this.commands.push(cmd); return true; } return false; }
}

init();
renderer?.setAnimationLoop?.(()=>animateFrame());

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101c);
  scene.fog = new THREE.Fog(0x07101c, 160, 850);

  camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2500);
  renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  renderer.xr.enabled = true;
  document.body.appendChild(VRButton.createButton(renderer));
  setupXRHands();
  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x93a8c8, .8));
  sunLight = new THREE.DirectionalLight(0xffffff, 2.7);
  sunLight.position.set(170, 220, 120); scene.add(sunLight);

  createPlanet();
  createSky();
  createPlayer();
  createPlaces();
  createArcheryRange();
  createNPCs(24);
  createCreatures(16);
  createResources(190);
  createCelestials();
  createStars();
  setupWorldRoot();
  setupEvents();
  setupStick("moveStick", moveInput);
  setupStick("lookStick", lookInput);
  setupUI();
  activeUnit = player;
  updateLists();
  showDialog("PSE v0.2.4 起動。ホーム画面、エディタ/プレイ選択、知能による判断速度/精度の土台を追加。", 3600);
}

function createPlanet(){
  const g = new THREE.SphereGeometry(R, 144, 72);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++){
    const v = new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
    const n = v.clone().normalize();
    const h = heightAt(n);
    v.copy(n.multiplyScalar(R + h));
    p.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();
  planet = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:0x2f8e58, roughness:.95}));
  scene.add(planet);

  const ocean = new THREE.Mesh(
    new THREE.SphereGeometry(R-0.8, 128, 64),
    new THREE.MeshStandardMaterial({color:0x226cff, transparent:true, opacity:.42, roughness:.55})
  );
  scene.add(ocean);

  for(let i=-18;i<=18;i++){
    const a = i * 0.032;
    const dir = new THREE.Vector3(Math.sin(a), .2, Math.cos(a)).normalize();
    const river = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, .2, 8),
      new THREE.MeshBasicMaterial({color:0x2aa7ff, transparent:true, opacity:.72})
    );
    river.position.copy(dir.multiplyScalar(R+1.1));
    river.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), river.position.clone().normalize());
    scene.add(river);
  }
}

function heightAt(n){
  const base = Math.sin(n.x*8)*2.4 + Math.sin(n.y*12+1.4)*1.6 + Math.sin(n.z*10-.7)*2.2 + Math.sin((n.x+n.z)*18)*.8;
  const mountain = Math.max(0, Math.sin(n.x*5+n.z*4)-.24)*8.5;
  return base + mountain;
}
function surfaceRadius(dir){ return R + heightAt(dir.clone().normalize()); }

function createSky(){
  atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(R+13, 96, 48),
    new THREE.MeshBasicMaterial({color:0x6cb6ff, transparent:true, opacity:.13, side:THREE.BackSide})
  );
  scene.add(atmosphere);

  clouds = new THREE.Group();
  for(let i=0;i<42;i++){
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.15)d.y=Math.abs(d.y); d.normalize();
    const group = new THREE.Group();
    for(let j=0;j<3+Math.floor(Math.random()*3);j++){
      const c = new THREE.Mesh(
        new THREE.SphereGeometry(1.8+Math.random()*2.4, 12, 8),
        new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.38})
      );
      c.position.set((Math.random()-.5)*5, (Math.random()-.5)*1.5, (Math.random()-.5)*3);
      group.add(c);
    }
    group.position.copy(d.multiplyScalar(R+11+Math.random()*5));
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), group.position.clone().normalize());
    clouds.add(group);
  }
  scene.add(clouds);
}


function makeHumanoid(color=0xffdd66, hairColor=0x2b1a10, role="村人"){
  const g = new THREE.Group();
  g.userData.visualKind = "humanoid";
  const skin = new THREE.MeshStandardMaterial({color:0xffd6ad, roughness:.85});
  const cloth = new THREE.MeshStandardMaterial({color, roughness:.9});
  const dark = new THREE.MeshBasicMaterial({color:0x111111});
  const hairMat = new THREE.MeshStandardMaterial({color:hairColor, roughness:.8});
  const mouthMat = new THREE.MeshBasicMaterial({color:0x7b2020});
  const browMat = new THREE.MeshBasicMaterial({color:hairColor});

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.62,1.25,6,12), cloth); torso.position.y=1.55; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.46,18,12), skin); head.position.y=2.65; g.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.18,.22,.25,10), skin); neck.position.y=2.27; g.add(neck);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(.48,14,10), cloth); pelvis.scale.set(1.15,.55,.8); pelvis.position.y=.78; g.add(pelvis);

  // 目・鼻・口・耳・眉・髪。低ポリだけどキャラメイク拡張の土台。
  for(const x of [-.16,.16]){
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.045,8,6), dark); eye.position.set(x,2.73,.41); g.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(.14,.025,.025), browMat); brow.position.set(x,2.84,.42); brow.rotation.z = x<0?.12:-.12; g.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(.08,8,6), skin); ear.scale.set(.55,1.15,.35); ear.position.set(x*3.35,2.64,.03); g.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(.055,.16,8), skin); nose.position.set(0,2.66,.46); nose.rotation.x=Math.PI/2; g.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(.22,.025,.025), mouthMat); mouth.position.set(0,2.50,.43); g.add(mouth);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.49,18,8), hairMat); hair.scale.set(1,.55,1); hair.position.y=2.92; g.add(hair);
  if(role === "狩人"){
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.48,.25,12), hairMat); cap.position.y=3.05; g.add(cap);
  }

  const limbMat = skin;
  g.userData.parts = { leftArm:[], rightArm:[], leftLeg:[], rightLeg:[], hands:[], feet:[] };
  for(const side of [-1,1]){
    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(.13,.65,5,8), limbMat); upperArm.position.set(side*.72,1.73,.02); upperArm.rotation.z=side*.18; g.add(upperArm);
    const foreArm = new THREE.Mesh(new THREE.CapsuleGeometry(.12,.62,5,8), limbMat); foreArm.position.set(side*.86,1.16,.08); foreArm.rotation.z=side*.10; g.add(foreArm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.13,8,6), skin); hand.position.set(side*.88,.78,.1); g.add(hand);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(.16,.74,5,8), cloth); thigh.position.set(side*.25,.34,.02); g.add(thigh);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(.14,.72,5,8), limbMat); shin.position.set(side*.25,-.28,.03); g.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.25,.12,.48), cloth); foot.position.set(side*.25,-.72,.17); g.add(foot);
    const armSet = side < 0 ? g.userData.parts.leftArm : g.userData.parts.rightArm;
    const legSet = side < 0 ? g.userData.parts.leftLeg : g.userData.parts.rightLeg;
    armSet.push(upperArm, foreArm);
    legSet.push(thigh, shin);
    g.userData.parts.hands.push(hand);
    g.userData.parts.feet.push(foot);
  }
  return g;
}

function makeCreatureModel(kind){
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:kind.color, roughness:.9});
  const dark = new THREE.MeshBasicMaterial({color:0x111111});
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.42,1.2,6,10), mat); body.rotation.x=Math.PI/2; body.position.y=.55; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.32,12,8), mat); head.position.set(0,.68,.82); g.add(head);
  for(const x of [-.12,.12]){ const eye=new THREE.Mesh(new THREE.SphereGeometry(.035,6,4), dark); eye.position.set(x,.75,1.09); g.add(eye); }
  for(const x of [-.22,.22]){ const ear=new THREE.Mesh(new THREE.ConeGeometry(.08,.25,6), mat); ear.position.set(x,.99,.78); g.add(ear); }
  g.userData.parts = { legs:[] };
  for(const x of [-.28,.28]) for(const z of [-.35,.45]){ const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.07,.5,4,6), mat); leg.position.set(x,.18,z); g.add(leg); g.userData.parts.legs.push(leg); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.08,.45,8), mat); tail.position.set(0,.65,-.92); tail.rotation.x=-Math.PI/2; g.add(tail);
  return g;
}

function createPlayer(){
  player = makeHumanoid(0xffdd66, 0x2b1a10, "主人公");
  player.position.copy(new THREE.Vector3(0,1,0).multiplyScalar(surfaceRadius(new THREE.Vector3(0,1,0))+HUMANOID_GROUND_OFFSET));
  const visualParts = player.userData.parts;
  player.userData.forward = new THREE.Vector3(0,0,1);
  player.userData = {type:"player", name:"主人公", mind:new Mind("主人公","導き手"), command:null, target:null, parts:visualParts,
    inventory:{wood:0,stone:0,ore:0,food:2,water:2},
    stats:{hp:100,maxHp:100,stamina:100,xp:0,level:1,kills:0},
    armor:{name:"布の服", hp:18, maxHp:18, absorb:.35},
    weapon:{name:"短剣", kind:"melee", range:4.2, atk:10},
    combat:{atk:10, range:4.2, courage:90, defense:1}};
  player.userData.mind.loyalty = 100; player.userData.mind.faith = 100; player.userData.mind.memory = 24;
  addVisibleEquipment(player);
  scene.add(player);
}

function createNPCs(n){
  const names = ["アオ","レン","ミナ","ユイ","タク","ソラ","リク","ハナ","ケイ","ナナ","ジン","レイ","マコ","トウマ","サナ","イオ","カイ","ノア","ミオ","シン"];
  for(let i=0;i<n;i++){
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.25)d.y=Math.abs(d.y); d.normalize();
    const role = i < 5 ? "農夫" : i < 8 ? "商人" : i < 12 ? "木こり" : i < 16 ? "狩人" : i < 20 ? "衛兵" : "村人";
    const npcColor = role === "衛兵" ? 0x4466aa : role === "狩人" ? 0x3f7a3f : role === "農夫" ? 0x6fa35f : role === "商人" ? 0xaa8844 : 0x66ccff;
    const npc = makeHumanoid(npcColor, [0x21160f,0x3b2416,0x6b4a2f,0x111111][i%4], role);
    npc.position.copy(d.multiplyScalar(surfaceRadius(d)+HUMANOID_GROUND_OFFSET));
    const visualParts = npc.userData.parts;
    npc.userData.forward = new THREE.Vector3(0,0,1);
    const mind = new Mind(names[i%names.length], role);
    mind.homePlaceId = "home_base";
    mind.workPlaceId = role === "農夫" ? "field_1" : role === "商人" ? "market_1" : role === "木こり" ? "forest_1" : "square_1";
    const combat = role === "衛兵" ? {atk:16, range:5.8, patrol:22, courage:88, defense:4} : role === "狩人" ? {atk:13, range:34, patrol:30, courage:74, defense:2} : {atk:4, range:4.0, patrol:8, courage:35, defense:0};
    const weapon = role === "狩人" ? {name:"狩弓", kind:"bow", range:34, atk:12, arrowSpeed:42} : role === "衛兵" ? {name:"槍", kind:"melee", range:5.8, atk:15} : {name:"作業ナイフ", kind:"melee", range:3.8, atk:4};
    const armor = role === "衛兵" ? {name:"革鎧", hp:38, maxHp:38, absorb:.58} : role === "狩人" ? {name:"狩人服", hp:24, maxHp:24, absorb:.36} : {name:"普段着", hp:12, maxHp:12, absorb:.2};
    npc.userData = {type:"npc", name:names[i%names.length], mind, command:null, commandKind:null, target:null, wanderTimer:Math.random()*4, aiThinkTimer:Math.random()*2, parts:visualParts,
      inventory:{wood:0,stone:0,ore:0,food:1,water:1},
      stats:{hp:100,maxHp:100,stamina:100,hunger:20,thirst:15,spirit:70,xp:0,level:1,kills:0}, armor, weapon, combat};
    scene.add(npc); npcs.push(npc);
  }
}


function createCreatures(n){
  const kinds = [
    {name:"野兎", color:0xc9b28a, hp:24, atk:0, hostile:false, speed:3.2, naturalArmor:.02},
    {name:"鹿", color:0xb47a42, hp:46, atk:0, hostile:false, speed:4.0, naturalArmor:.04},
    {name:"犬", color:0xd9c29c, hp:52, atk:5, hostile:false, speed:4.8, naturalArmor:.05},
    {name:"馬", color:0x8b5a2b, hp:90, atk:2, hostile:false, speed:6.0, naturalArmor:.08},
    {name:"狼", color:0x6f7780, hp:58, atk:9, hostile:true, speed:4.4, naturalArmor:.1},
    {name:"猪", color:0x5b3d2e, hp:72, atk:11, hostile:true, speed:3.2, naturalArmor:.16}
  ];
  for(let i=0;i<n;i++){
    const kind = kinds[i % kinds.length];
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.18)d.y=Math.abs(d.y); d.normalize();
    const body = makeCreatureModel(kind);
    body.position.copy(d.multiplyScalar(surfaceRadius(d)+CREATURE_GROUND_OFFSET));
    const visualParts = body.userData.parts;
    body.userData.forward = new THREE.Vector3(0,0,1);
    body.userData = {type:"creature", name:kind.name, kind, command:null, target:null, wanderTimer:Math.random()*5, parts:visualParts,
      stats:{hp:kind.hp, maxHp:kind.hp, xp:0, level:1},
      armor:{name:"天然装甲", hp:9999, maxHp:9999, absorb:kind.naturalArmor},
      weapon:{name:"牙/突進", kind:"melee", range:3.5, atk:kind.atk},
      combat:{atk:kind.atk, range:3.5, hostile:kind.hostile, speed:kind.speed, defense:Math.round(kind.naturalArmor*10)}};
    orientEntity(body, body.position.clone().normalize(), getLocalBasis(body.position.clone().normalize(), yaw).forward);
    scene.add(body); creatures.push(body);
  }
}

function createResources(n){
  for(let i=0;i<n;i++){
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.25)d.y=Math.abs(d.y); d.normalize();
    const oreNode = i%5===0;
    const mesh = new THREE.Mesh(
      oreNode ? new THREE.DodecahedronGeometry(1.7) : new THREE.ConeGeometry(1.25,4.2,8),
      new THREE.MeshStandardMaterial({color: oreNode ? 0x8d8fa0 : 0x145c2c})
    );
    mesh.position.copy(d.multiplyScalar(surfaceRadius(d)+1.8));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), mesh.position.clone().normalize());
    mesh.userData = {type:oreNode?"ore":"tree", sound:oreNode?"硬い石の匂い":"若い木の香り"};
    scene.add(mesh); resources.push(mesh);
  }
}

function createCelestials(){
  sunMesh = new THREE.Mesh(new THREE.SphereGeometry(13,32,16), new THREE.MeshBasicMaterial({color:0xffdd55}));
  sunMesh.position.set(410,220,260); scene.add(sunMesh);
  moonMesh = new THREE.Mesh(new THREE.SphereGeometry(8,32,16), new THREE.MeshStandardMaterial({color:0xd4d4d4, roughness:.9}));
  moonMesh.position.set(-260,160,-310); scene.add(moonMesh);
  const colors=[0xaa6644,0x44aa88,0x8888ff,0xaa88cc,0xddaa77];
  for(let i=0;i<5;i++){
    const body = new THREE.Mesh(new THREE.SphereGeometry(5+i*1.6,32,16), new THREE.MeshStandardMaterial({color:colors[i]}));
    body.position.set(-520+i*180, 250+i*24, -460-i*90);
    body.userData={type:"celestial", name:"開拓候補惑星"+(i+1)};
    scene.add(body); celestials.push(body);
  }
}

function createStars(){
  const g = new THREE.BufferGeometry(), pts=[];
  for(let i=0;i<2200;i++){
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1100+Math.random()*450);
    pts.push(v.x,v.y,v.z);
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:0xffffff, size:1})));
}

function animateFrame(){
  const dt = Math.min(clock.getDelta(), .033);
  updateTime(dt);
  updatePlayer(dt);
  updateNPCs(dt);
  updateCreatures(dt);
  updateXRWorldAnchor();
  updateXRHands(dt);
  updateCombat(dt);
  updateProjectiles(dt);
  updateCamera(dt);
  updateWeather(dt);
  updateCelestialMotion(dt);
  updateResourceRegen(dt);
  updatePanels();
  for(let i=0;i<celestials.length;i++) celestials[i].rotation.y += dt*(.2+i*.05);
  renderer.render(scene,camera);
}

function updatePlayer(dt){
  const up = player.position.clone().normalize();

  yaw -= lookInput.x*dt*2.6;
  pitch -= lookInput.y*dt*1.1;
  pitch = clamp(pitch,-.85,.62);

  const ix = (keys.d?1:0) - (keys.a?1:0) + moveInput.x;
  const iy = (keys.w?1:0) - (keys.s?1:0) - moveInput.y;
  const basis = getLocalBasis(up, yaw);
  let moved=false;

  const mv = basis.forward.clone().multiplyScalar(iy).add(basis.right.clone().multiplyScalar(ix));
  if(mv.length()>.01){
    const dir = mv.normalize();
    player.userData.forward = dir.clone();
    player.position.add(dir.clone().multiplyScalar(getMoveSpeed(player, 3.8)*dt));
    yaw = lerpAngle(yaw, basis.yawFromDir(dir), .08);
    commandTarget=null; moved=true;
  }
  if(commandTarget){
    const dir = commandTarget.clone().sub(player.position).projectOnPlane(up);
    if(dir.length()<.85){ commandTarget=null; }
    else{
      const moveDir = dir.normalize();
      player.userData.forward = moveDir.clone();
      player.position.add(moveDir.clone().multiplyScalar(getMoveSpeed(player, 3.2)*dt));
      yaw = lerpAngle(yaw, basis.yawFromDir(moveDir), .18);
      moved=true;
    }
  }
  const d = player.position.clone().normalize();
  player.position.copy(d.multiplyScalar(surfaceRadius(d)+HUMANOID_GROUND_OFFSET));

  player.userData.forward = (player.userData.forward || getLocalBasis(d,yaw).forward).clone().projectOnPlane(d).normalize();
  if(player.userData.forward.lengthSq()<0.001) player.userData.forward = getLocalBasis(d,yaw).forward;
  orientEntity(player, d, player.userData.forward);
  updateBodyAnimation(player, dt);
  // TPV/FPVでは進行方向が画面上に来るよう、CameraRigがこのyawを追う
}

function updateNPCs(dt){
  for(const npc of npcs){
    if((npc.userData.stats?.hp ?? 100) <= 0) continue;
    const up = npc.position.clone().normalize();
    const role = npc.userData.mind.role;
    const nearestThreat = findNearestThreat(npc.position, role === "衛兵" ? 28 : role === "狩人" ? 22 : 10);
    if(nearestThreat && (role === "衛兵" || role === "狩人" || npc.userData.combat.courage > 70)){
      npc.userData.target = nearestThreat;
      npc.userData.commandKind = "attack";
      dangerAlert = `${npc.userData.name}が${nearestThreat.userData.name}を警戒`;
    }

    npc.userData.wanderTimer -= dt;
    if(npc.userData.commandKind !== "attack") {
      npc.userData.aiThinkTimer -= dt;
      if(npc.userData.aiThinkTimer <= 0){
        updateRoutineCommand(npc);
        npc.userData.aiThinkTimer = nextThinkInterval(npc.userData.mind);
      }
    }

    if(npc.userData.target){
      const target = npc.userData.target;
      if(!target.parent || target.userData.stats.hp <= 0){ npc.userData.target=null; npc.userData.commandKind=null; }
      else{
        const dir = target.position.clone().sub(npc.position).projectOnPlane(up);
        if(dir.length() > npc.userData.combat.range * .75){
          npc.userData.command = target.position.clone();
        }else{
          npc.userData.command = null;
        }
      }
    }

    if(!npc.userData.command && !npc.userData.target && npc.userData.wanderTimer<=0){
      npc.userData.wanderTimer = 3 + Math.random()*8;
      const wander = new THREE.Vector3().randomDirection().projectOnPlane(up).normalize();
      const target = npc.position.clone().add(wander.multiplyScalar(12+Math.random()*18)).normalize();
      npc.userData.command = target.multiplyScalar(surfaceRadius(target)+HUMANOID_GROUND_OFFSET);
    }
    if(npc.userData.command){
      const dir = npc.userData.command.clone().sub(npc.position).projectOnPlane(up);
      if(dir.length()<.7) npc.userData.command=null;
      else{
        const moveDir = dir.normalize();
        npc.userData.forward = moveDir.clone();
        npc.position.add(moveDir.clone().multiplyScalar(getMoveSpeed(npc, role === "狩人" ? 1.9 : role === "衛兵" ? 1.7 : 1.45)*dt));
        const nd=npc.position.clone().normalize();
        npc.position.copy(nd.multiplyScalar(surfaceRadius(nd)+HUMANOID_GROUND_OFFSET));
      }
    }
    const nd2 = npc.position.clone().normalize();
    npc.userData.forward = (npc.userData.forward || getLocalBasis(nd2,yaw).forward).clone().projectOnPlane(nd2).normalize();
    if(npc.userData.forward.lengthSq()<0.001) npc.userData.forward = getLocalBasis(nd2,yaw).forward;
    orientEntity(npc, nd2, npc.userData.forward);
    updateBodyAnimation(npc, dt);
  }
}

function updateCreatures(dt){
  for(const c of [...creatures]){
    if(c.userData.stats.hp <= 0){
      scene.remove(c); creatures = creatures.filter(x=>x!==c); wood += 0; inventory.food += c.userData.kind.hostile ? 1 : 2;
      continue;
    }
    const up = c.position.clone().normalize();
    c.userData.wanderTimer -= dt;
    if(c.userData.combat.hostile){
      const prey = findNearestVillageUnit(c.position, 18);
      if(prey){ c.userData.target = prey; }
    }
    if(c.userData.target){
      const t = c.userData.target;
      if(!t.parent || (t.userData.stats?.hp ?? 100)<=0){ c.userData.target=null; }
      else{
        const dir=t.position.clone().sub(c.position).projectOnPlane(up);
        if(dir.length()>c.userData.combat.range*.55){ const moveDir=dir.normalize(); c.userData.forward=moveDir.clone(); c.position.add(moveDir.clone().multiplyScalar(getMoveSpeed(c, c.userData.combat.speed * 0.42)*dt)); }
      }
    }else if(c.userData.wanderTimer<=0){
      c.userData.wanderTimer=2+Math.random()*5;
      const wander=new THREE.Vector3().randomDirection().projectOnPlane(up).normalize();
      c.userData.command=c.position.clone().add(wander.multiplyScalar(6+Math.random()*18)).normalize();
      c.userData.command.multiplyScalar(surfaceRadius(c.userData.command)+CREATURE_GROUND_OFFSET);
    }
    if(c.userData.command && !c.userData.target){
      const dir=c.userData.command.clone().sub(c.position).projectOnPlane(up);
      if(dir.length()<.8)c.userData.command=null;
      else { const moveDir=dir.normalize(); c.userData.forward=moveDir.clone(); c.position.add(moveDir.clone().multiplyScalar(getMoveSpeed(c, c.userData.kind.speed * 0.42)*dt)); }
    }
    const nd=c.position.clone().normalize(); c.position.copy(nd.multiplyScalar(surfaceRadius(nd)+CREATURE_GROUND_OFFSET));
    c.userData.forward = (c.userData.forward || getLocalBasis(nd,yaw).forward).clone().projectOnPlane(nd).normalize();
    if(c.userData.forward.lengthSq()<0.001) c.userData.forward = getLocalBasis(nd,yaw).forward;
    orientEntity(c, nd, c.userData.forward);
    updateCreatureAnimation(c, dt);
  }
}

function updateCombat(dt){
  // 近接は「物理的に届く」時だけ命中。狩人の弓は矢オブジェクトを発射し、重力で落下する。
  for(const unit of [player, ...npcs]){
    if((unit.userData.stats?.hp ?? 100)<=0) continue;
    const target = unit.userData.target;
    if(target && target.parent && (target.userData.stats?.hp ?? 100)>0){
      const weapon = unit.userData.weapon || {kind:"melee", range:4, atk:unit.userData.combat?.atk ?? 5};
      const dist = unit.position.distanceTo(target.position);
      unit.userData.attackCooldown = (unit.userData.attackCooldown ?? 0) - dt;
      if(weapon.kind === "bow"){
        if(dist < weapon.range && unit.userData.attackCooldown <= 0){
          unit.userData.attackCooldown = 1.55;
          spawnArrow(unit, target, weapon);
        }
      }else if(dist < weapon.range && unit.userData.attackCooldown <= 0){
        unit.userData.attackCooldown = .95;
        const facingOk = isFacingTarget(unit, target, .35);
        if(facingOk || inputProfile !== "VR") applyDamage(unit, target, weapon.atk + (unit.userData.stats.level-1)*2, "melee");
        else showFloatingText("空振り", unit.position);
      }
    }
  }
  for(const c of creatures){
    const target=c.userData.target;
    if(target && target.parent && (target.userData.stats?.hp ?? 100)>0 && c.position.distanceTo(target.position)<c.userData.combat.range){
      c.userData.attackCooldown=(c.userData.attackCooldown??0)-dt;
      if(c.userData.attackCooldown<=0){
        c.userData.attackCooldown=1.25;
        applyDamage(c, target, c.userData.combat.atk, "bite");
        dangerAlert = `${c.userData.name}が襲撃中`;
      }
    }
  }
}

function spawnArrow(attacker, target, weapon){
  const up = attacker.position.clone().normalize();
  const start = attacker.position.clone().add(up.multiplyScalar(1.8));
  const to = target.position.clone().sub(start);
  const dir = to.clone().normalize();
  const arrow = new THREE.Mesh(
    new THREE.CylinderGeometry(.045,.045,1.2,6),
    new THREE.MeshBasicMaterial({color:0xd8c28a})
  );
  arrow.position.copy(start);
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
  arrow.userData = {type:"projectile", attacker, target, damage:weapon.atk + (attacker.userData.stats.level-1)*2, velocity:dir.multiplyScalar(weapon.arrowSpeed || 42), life:4.0};
  (worldRoot || scene).add(arrow); projectiles.push(arrow);
  showFloatingText(`${attacker.userData.name} 🏹`, attacker.position);
}
function spawnArrowFree(attacker, start, dir, speed, damage){
  const arrow = new THREE.Mesh(
    new THREE.CylinderGeometry(.045,.045,1.35,6),
    new THREE.MeshBasicMaterial({color:0xffe1a3})
  );
  const aim = dir.clone().normalize();
  arrow.position.copy(start.clone().add(aim.clone().multiplyScalar(.35)));
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), aim);
  arrow.userData = {type:"projectile", attacker, target:null, free:true, damage, velocity:aim.multiplyScalar(speed), life:5.2};
  (worldRoot || scene).add(arrow); projectiles.push(arrow);
  showFloatingText(`VR 🏹 ${Math.round(speed)}`, attacker.position);
}

function updateProjectiles(dt){
  for(const arrow of [...projectiles]){
    const prev = arrow.position.clone();
    const gravity = arrow.position.clone().normalize().multiplyScalar(-22); // 惑星中心方向へ落下
    arrow.userData.velocity.add(gravity.multiplyScalar(dt));
    arrow.position.add(arrow.userData.velocity.clone().multiplyScalar(dt));
    if(arrow.userData.velocity.lengthSq()>0.001) arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), arrow.userData.velocity.clone().normalize());
    arrow.userData.life -= dt;
    const target = arrow.userData.target;

    // 高速な矢がすり抜けないよう、点判定ではなく「前フレーム位置→現在位置」の線分で当たり判定
    if(arrow.userData.free){
      let consumed = false;

      // 演習場の的。中心に近いほど経験値が増える。
      for(const t of archeryTargets){
        const center = t.localToWorld(new THREE.Vector3(0,1.75,.08));
        const d = distancePointToSegment(center, prev, arrow.position);
        if(d < .92){
          const bull = d < .24;
          awardSkill(arrow.userData.attacker, "弓術", bull ? 3 : 1);
          showFloatingText(bull ? "🎯 中心命中 +3" : "🎯 的中 +1", center);
          removeProjectile(arrow);
          consumed = true;
          break;
        }
      }
      if(consumed) continue;

      for(const c of creatures){
        if((c.userData.stats?.hp ?? 0)<=0 || !c.parent) continue;
        const hitPoint = c.position.clone().add(c.position.clone().normalize().multiplyScalar(.7));
        if(distancePointToSegment(hitPoint, prev, arrow.position)<1.35){
          applyDamage(arrow.userData.attacker, c, arrow.userData.damage, "vr_arrow");
          removeProjectile(arrow);
          awardSkill(arrow.userData.attacker, "弓術", 8);
          consumed = true;
          break;
        }
      }
      if(consumed) continue;
    }else if(target && target.parent && (target.userData.stats?.hp ?? 100)>0){
      const hitPoint = target.position.clone().add(target.position.clone().normalize().multiplyScalar(.7));
      if(distancePointToSegment(hitPoint, prev, arrow.position)<1.45){
        applyDamage(arrow.userData.attacker, target, arrow.userData.damage, "arrow");
        removeProjectile(arrow);
        continue;
      }
    }
    const groundDir = arrow.position.clone().normalize();
    if(arrow.position.length() < surfaceRadius(groundDir)+.6 || arrow.userData.life<=0){
      removeProjectile(arrow);
    }
  }
}

function removeProjectile(arrow){
  arrow.removeFromParent();
  projectiles = projectiles.filter(a=>a!==arrow);
}

function distancePointToSegment(point, a, b){
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq();
  if(lenSq < 1e-8) return point.distanceTo(a);
  const t = clamp(point.clone().sub(a).dot(ab) / lenSq, 0, 1);
  return point.distanceTo(a.clone().add(ab.multiplyScalar(t)));
}

function applyDamage(attacker, target, baseDamage, method){
  if(!target.userData.stats) return;
  const back = isBackAttack(attacker, target);
  let damage = baseDamage * (back ? 1.65 : 1.0);
  if(inputProfile === "VR" && method !== "arrow") damage *= 1.15; // VRは急所狙いの拡張余地
  const armor = target.userData.armor;
  if(armor && armor.hp > 0){
    const absorbed = Math.min(armor.hp, damage * (armor.absorb ?? .35));
    armor.hp -= absorbed;
    damage -= absorbed;
  }
  const defense = target.userData.combat?.defense ?? 0;
  damage = Math.max(0, damage - defense*.35);
  target.userData.stats.hp -= damage;
  const label = back ? "背面!" : method === "arrow" ? "矢" : "命中";
  showFloatingText(`${attacker.userData.name}→${target.userData.name} ${label} -${Math.round(damage)}`, attacker.position);
  if(target.userData.stats.hp <= 0){
    target.userData.stats.hp = 0;
    awardXP(attacker, target);
    target.userData.dead = true;
    handleDefeat(target);
  }
}

function handleDefeat(target){
  if(!target || !target.parent) return;
  showFloatingText(`${target.userData.name || "対象"} 撃破`, target.position);
  // 敵・獲物は倒れたらすぐ非表示。将来は死体/解体/剥ぎ取りEntityに置き換える。
  if(target.userData.type === "creature"){
    const rewardFood = target.userData.kind?.hostile ? 1 : 2;
    inventory.food = (inventory.food || 0) + rewardFood;
    target.visible = false;
    target.removeFromParent();
    creatures = creatures.filter(c=>c!==target);
    selected = selected === target ? null : selected;
  }
}

function isFacingTarget(unit, target, threshold=.2){
  const up = unit.position.clone().normalize();
  const forward = new THREE.Vector3(0,0,1).applyQuaternion(unit.quaternion).projectOnPlane(up).normalize();
  const to = target.position.clone().sub(unit.position).projectOnPlane(up).normalize();
  return forward.dot(to) > threshold;
}
function isBackAttack(attacker, target){
  const up = target.position.clone().normalize();
  const targetForward = new THREE.Vector3(0,0,1).applyQuaternion(target.quaternion).projectOnPlane(up).normalize();
  const fromTargetToAttacker = attacker.position.clone().sub(target.position).projectOnPlane(up).normalize();
  return targetForward.dot(fromTargetToAttacker) < -0.45;
}
function awardXP(attacker, target){
  if(!attacker?.userData?.stats) return;
  const s = attacker.userData.stats;
  const gained = 18 + Math.round((target.userData.stats?.maxHp ?? 40)/5);
  s.xp = (s.xp ?? 0) + gained;
  s.kills = (s.kills ?? 0) + 1;
  let need = xpToNext(s.level ?? 1);
  while(s.xp >= need){
    s.xp -= need; s.level = (s.level ?? 1) + 1;
    if(attacker.userData.combat) { attacker.userData.combat.atk += 1.5; attacker.userData.combat.defense = (attacker.userData.combat.defense ?? 0) + .7; }
    if(attacker.userData.stats.maxHp){ attacker.userData.stats.maxHp += 4; attacker.userData.stats.hp = Math.min(attacker.userData.stats.maxHp, attacker.userData.stats.hp + 10); }
    showDialog(`${attacker.userData.name} Lv.${s.level}！ 攻撃/防御が上昇。`,1800);
    need = xpToNext(s.level);
  }
}
function xpToNext(level){ return 45 + level*30; }

function getInventoryWeight(unit){
  const inv = unit.userData.inventory || {};
  return (inv.wood||0)*0.7 + (inv.stone||0)*1.3 + (inv.ore||0)*1.8 + (inv.food||0)*0.35 + (inv.water||0)*0.6;
}
function getMoveSpeed(unit, base){
  let speed = base;
  const role = unit.userData.mind?.role;
  const kind = unit.userData.kind?.name;
  if(role === "狩人") speed *= 1.08;
  if(role === "衛兵") speed *= 0.94;
  if(kind === "犬") speed *= 1.25;
  if(kind === "馬") speed *= 1.45;
  if(kind === "猪") speed *= 0.95;
  const weight = getInventoryWeight(unit);
  const loadFactor = clamp(1 - weight/180, .45, 1);
  return speed * loadFactor;
}


function updateBodyAnimation(unit, dt){
  if(!unit.userData._lastAnimPos) unit.userData._lastAnimPos = unit.position.clone();
  const moved = unit.position.distanceTo(unit.userData._lastAnimPos);
  unit.userData._lastAnimPos.copy(unit.position);
  const speed = moved / Math.max(dt, 0.001);
  const parts = unit.userData.parts;
  if(!parts) return;
  unit.userData.walkPhase = (unit.userData.walkPhase || 0) + speed * dt * 4.2;
  const swing = Math.min(0.75, speed * 0.16) * Math.sin(unit.userData.walkPhase);
  for(const part of parts.leftArm || []) part.rotation.x = swing;
  for(const part of parts.rightArm || []) part.rotation.x = -swing;
  for(const part of parts.leftLeg || []) part.rotation.x = -swing;
  for(const part of parts.rightLeg || []) part.rotation.x = swing;
  for(const hand of parts.hands || []) hand.position.z = 0.1 + Math.sin(unit.userData.walkPhase) * 0.025;
  for(const foot of parts.feet || []) foot.rotation.x = Math.sin(unit.userData.walkPhase) * 0.18;
}

function updateCreatureAnimation(creature, dt){
  if(!creature.userData._lastAnimPos) creature.userData._lastAnimPos = creature.position.clone();
  const moved = creature.position.distanceTo(creature.userData._lastAnimPos);
  creature.userData._lastAnimPos.copy(creature.position);
  const speed = moved / Math.max(dt, 0.001);
  const parts = creature.userData.parts;
  if(!parts) return;
  creature.userData.walkPhase = (creature.userData.walkPhase || 0) + speed * dt * 5.0;
  const swing = Math.min(0.55, speed * 0.12);
  (parts.legs || []).forEach((leg, i)=>{ leg.rotation.x = Math.sin(creature.userData.walkPhase + i*Math.PI/2) * swing; });
}

function makeBowModel(scale=1){
  const bow = new THREE.Group();
  const wood = new THREE.MeshBasicMaterial({color:0x8b5a2b});
  const dark = new THREE.MeshBasicMaterial({color:0x3a2415});
  const stringMat = new THREE.LineBasicMaterial({color:0xf4f4f4});

  // Ω字寄りの弓：左右にうねらない対称カーブ。中央が手元、両端がしなやかに戻る。
  const pts = [];
  for(let i=0;i<=36;i++){
    const t = i/36;
    const y = (t-.5) * 1.35 * scale;
    const x = (.22 * (1 - 4*(t-.5)*(t-.5)) - .06) * scale;
    pts.push(new THREE.Vector3(x, y, 0));
  }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 44, .018*scale, 8, false);
  const body = new THREE.Mesh(tube, wood);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.035*scale,.035*scale,.25*scale,8), dark);
  grip.rotation.z = Math.PI/2;
  grip.position.x = .15*scale;

  const stringGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-.06*scale,-.675*scale,0),
    new THREE.Vector3(-.06*scale,.675*scale,0)
  ]);
  const string = new THREE.Line(stringGeo, stringMat);
  string.name = "bowString";
  // 要望：弦はZ軸時計回り90°相当の位相補正。弓グループ内で補正値として保持。
  string.userData.zAxisClockwise90 = true;

  const tipTop = new THREE.Mesh(new THREE.SphereGeometry(.035*scale,8,6), dark);
  tipTop.position.set(-.06*scale,.675*scale,0);
  const tipBot = tipTop.clone(); tipBot.position.y = -.675*scale;
  bow.add(body, grip, string, tipTop, tipBot);
  bow.userData.string = string;
  bow.userData.stringBaseX = -.06*scale;
  return bow;
}

function makeArrowModel(){
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.75,6), new THREE.MeshBasicMaterial({color:0xd8c28a}));
  shaft.rotation.x = Math.PI/2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(.035,.12,8), new THREE.MeshBasicMaterial({color:0xcfd4dc}));
  head.position.z = -.44; head.rotation.x = -Math.PI/2;
  const feather = new THREE.Mesh(new THREE.BoxGeometry(.09,.025,.08), new THREE.MeshBasicMaterial({color:0xffffff}));
  feather.position.z = .39;
  g.add(shaft, head, feather);
  return g;
}

function makeSwordModel(){
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(.045,.035,.85), new THREE.MeshBasicMaterial({color:0xdfe8ff}));
  blade.position.z = -.48;
  const hilt = new THREE.Mesh(new THREE.BoxGeometry(.24,.04,.04), new THREE.MeshBasicMaterial({color:0x553311}));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.25,8), new THREE.MeshBasicMaterial({color:0x2b1a10}));
  grip.rotation.x = Math.PI/2; grip.position.z = .13;
  g.add(blade,hilt,grip);
  return g;
}

function addVisibleEquipment(unit){
  const backBow = makeBowModel(.78);
  backBow.position.set(-.48,1.7,-.42);
  backBow.rotation.z = Math.PI/2.8;
  backBow.rotation.y = -.65;
  unit.add(backBow);
  const quiver = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,.8,10), new THREE.MeshStandardMaterial({color:0x4b2c17, roughness:.9}));
  tube.rotation.x = Math.PI/2;
  quiver.add(tube);
  for(let i=0;i<6;i++){
    const a=makeArrowModel(); a.scale.setScalar(.55); a.position.set((i-2.5)*.035,.03,.34); quiver.add(a);
  }
  quiver.position.set(.48,1.52,-.46); quiver.rotation.y=.42; unit.add(quiver);
  const sheath = new THREE.Mesh(new THREE.CylinderGeometry(.045,.055,.78,8), new THREE.MeshStandardMaterial({color:0x2c1b12,roughness:.9}));
  sheath.rotation.z = -.55; sheath.position.set(.55,.88,.22); unit.add(sheath);
  unit.userData.equipmentVisual = {backBow, quiver, sheath};
}

function makeVRReticle(){
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({color:0x66ff88, transparent:true, opacity:.95});
  const h = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.08,0,0), new THREE.Vector3(.08,0,0)]);
  const v = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.08,0), new THREE.Vector3(0,.08,0)]);
  g.add(new THREE.Line(h,mat), new THREE.Line(v,mat));
  return g;
}

function setupXRHands(){
  xr.left = renderer.xr.getController(0);
  xr.right = renderer.xr.getController(1);
  xr.leftGrip = renderer.xr.getControllerGrip(0);
  xr.rightGrip = renderer.xr.getControllerGrip(1);
  scene.add(xr.left, xr.right, xr.leftGrip, xr.rightGrip);

  xr.bow = makeBowModel(1.0);
  // 左手の内側に自然に来るように位置・向きを調整
  xr.bow.position.set(.045,-.035,-.12);
  xr.bow.rotation.set(0,0,0);
  xr.bow.visible = false;
  xr.left.add(xr.bow);
  xr.bowString = xr.bow.userData.string;

  xr.bowArrow = makeArrowModel();
  xr.bowArrow.visible = false;
  xr.right.add(xr.bowArrow);
  xr.bowArrow.position.set(0,-.02,-.22);
  xr.bowArrow.rotation.set(-Math.PI/2,0,0); // X軸反時計回り90°

  xr.sword = makeSwordModel();
  xr.sword.position.set(.02,-.04,-.18);
  xr.sword.rotation.set(-Math.PI/2,0,0); // X軸反時計回り90°
  xr.sword.visible = false;
  xr.right.add(xr.sword);

  xrReticle = makeVRReticle();
  xrReticle.visible = false;
  xr.left.add(xrReticle);
  xrReticle.position.set(0, 0, -2.2);

  // VR開始時、弓は背中・剣は鞘。必要な時にグリップで取り出す。
  xr.left.addEventListener('squeezestart',()=>{ toggleVRBow(); });
  xr.right.addEventListener('squeezestart',()=>{ handleRightGripStart(); });
  xr.right.addEventListener('selectstart',()=>{ startVRDraw(); });
  xr.right.addEventListener('selectend',()=>{ releaseVRBow(); });
}

function toggleVRBow(){
  xr.bowInHand = !xr.bowInHand;
  if(xr.bow) xr.bow.visible = xr.bowInHand;
  if(player?.userData?.equipmentVisual?.backBow) player.userData.equipmentVisual.backBow.visible = !xr.bowInHand;
  if(!xr.bowInHand){ xr.arrowInHand=false; xr.arrowNocked=false; xr.drawing=false; if(xr.bowArrow) xr.bowArrow.visible=false; }
  showVRHint(xr.bowInHand ? "🏹 背中から弓を取った" : "🏹 弓を背中に戻した");
}

function handleRightGripStart(){
  if(xr.bowInHand && !xr.swordInHand){
    if(!xr.arrowInHand){
      xr.arrowInHand = true;
      xr.arrowNocked = false;
      if(xr.bowArrow) xr.bowArrow.visible = true;
      showVRHint("矢筒から矢を取り出した。弓へ近づけてトリガーでつがえる");
      return;
    }
  }
  xr.swordInHand = !xr.swordInHand;
  if(xr.sword) xr.sword.visible = xr.swordInHand;
  if(player?.userData?.equipmentVisual?.sheath) player.userData.equipmentVisual.sheath.visible = !xr.swordInHand;
  showVRHint(xr.swordInHand ? "⚔️ 抜刀" : "⚔️ 納刀");
}

function startVRDraw(){
  if(!xr.bowInHand) { showVRHint("左手グリップで背中の弓を取る"); return; }
  if(!xr.arrowInHand){ showVRHint("右手グリップで矢筒から矢を取る"); return; }
  xr.arrowNocked = true;
  xr.drawing = true;
  xr.drawStart = performance.now();
}

function getXRButton(controller, index){
  const session = renderer.xr.getSession?.();
  if(!session) return false;
  for(const source of session.inputSources){
    if(!source.gamepad) continue;
    // handednessの対応が端末で入れ替わる場合があるので、controllerの行列位置で主に判定せず緩めに扱う
  }
  const sources = Array.from(session.inputSources || []);
  const handed = controller === xr.right ? "right" : "left";
  const src = sources.find(s=>s.handedness===handed && s.gamepad) || sources.find(s=>s.gamepad);
  return !!src?.gamepad?.buttons?.[index]?.pressed;
}

function getWorldPos(obj){
  const v = new THREE.Vector3();
  obj.getWorldPosition(v);
  return v;
}

function getWorldDir(obj){
  const q = new THREE.Quaternion();
  obj.getWorldQuaternion(q);
  return new THREE.Vector3(0,0,-1).applyQuaternion(q).normalize();
}


function setupWorldRoot(){
  // WebXRではカメラが現実空間の原点に固定されるため、
  // 惑星世界全体をプレイヤー位置へ合わせて動かすための親を作る。
  if(worldRoot) return;
  worldRoot = new THREE.Group();
  worldRoot.name = "PSE_WorldRoot";
  const children = scene.children.slice();
  scene.add(worldRoot);
  for(const child of children){
    if(child === worldRoot) continue;
    if(child.isLight) continue;
    // XRコントローラは現実空間側なので移動しない
    if(child === xr.left || child === xr.right || child === xr.leftGrip || child === xr.rightGrip) continue;
    worldRoot.add(child);
  }
}

function updateXRWorldAnchor(){
  if(!worldRoot || !player) return;
  const presenting = renderer.xr.isPresenting;
  if(!presenting){
    if(xrWasPresenting){
      worldRoot.position.set(0,0,0);
      worldRoot.quaternion.identity();
      worldRoot.scale.set(1,1,1);
      player.visible = true;
      xrWasPresenting = false;
    }
    return;
  }
  xrWasPresenting = true;
  // VRでは自分自身の巨大な身体が視界に入るとスケール感が壊れるので、主人公モデルは非表示。
  // 世界全体を地表基準でVR原点へアンカーし、惑星中心スポーンを防ぐ。
  player.visible = false;
  const playerUp = player.position.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(playerUp, new THREE.Vector3(0,1,0));
  worldRoot.quaternion.copy(q);
  worldRoot.scale.set(1,1,1);
  const desiredPlayerWorld = new THREE.Vector3(0,-1.58,-0.45); // 目線1.6m程度、足元が地面
  const rotatedPlayer = player.position.clone().applyQuaternion(q);
  worldRoot.position.copy(desiredPlayerWorld.sub(rotatedPlayer));
}

function xrWorldToSim(v){
  if(!worldRoot) return v.clone();
  return worldRoot.worldToLocal(v.clone());
}

function xrDirWorldToSim(dir){
  if(!worldRoot) return dir.clone().normalize();
  const inv = worldRoot.quaternion.clone().invert();
  return dir.clone().applyQuaternion(inv).normalize();
}


function getXRGamepad(handed){
  const session = renderer.xr.getSession?.();
  if(!session) return null;
  const src = Array.from(session.inputSources || []).find(s=>s.handedness===handed && s.gamepad);
  return src?.gamepad || null;
}
function updateVRStickMovement(dt){
  // Quest系：左スティックで移動、右スティックで視点/旋回。
  // 地面法線の接平面上だけに投影するので、惑星中心へ落ちたり浮いたりしにくい。
  const leftPad = getXRGamepad('left');
  const rightPad = getXRGamepad('right');
  const lx = leftPad?.axes?.[2] ?? leftPad?.axes?.[0] ?? 0;
  const ly = leftPad?.axes?.[3] ?? leftPad?.axes?.[1] ?? 0;
  const rx = rightPad?.axes?.[2] ?? rightPad?.axes?.[0] ?? 0;
  const ry = rightPad?.axes?.[3] ?? rightPad?.axes?.[1] ?? 0;
  if(Math.abs(rx)>.18) yaw -= rx * dt * 1.8;
  if(Math.abs(ry)>.18) pitch = clamp(pitch - ry * dt * .9, -.85, .62);
  if(Math.hypot(lx,ly) < .18) return;
  const up = player.position.clone().normalize();
  const basis = getLocalBasis(up, yaw);
  const move = basis.right.clone().multiplyScalar(lx).add(basis.forward.clone().multiplyScalar(-ly));
  if(move.lengthSq() < .001) return;
  const dir = move.normalize();
  player.userData.forward = dir.clone();
  player.position.add(dir.multiplyScalar(getMoveSpeed(player, 2.05)*dt));
  const d = player.position.clone().normalize();
  player.position.copy(d.multiplyScalar(surfaceRadius(d)+HUMANOID_GROUND_OFFSET));
  orientEntity(player, d, player.userData.forward);
  commandTarget = null;
}

function updateXRHands(dt){
  if(!renderer.xr.isPresenting) return;
  inputProfile = "VR";
  updateVRStickMovement(dt);
  const rightPos = getWorldPos(xr.right);
  xr.rightVelocity.copy(rightPos).sub(xr.lastRightPos).multiplyScalar(1/Math.max(dt,.001));
  xr.lastRightPos.copy(rightPos);

  const trigger = getXRButton(xr.right,0);
  const grip = getXRButton(xr.right,1);
  if(trigger && !xr.lastTrigger) startVRDraw();
  if(!trigger && xr.lastTrigger && xr.drawing) releaseVRBow();
  xr.lastTrigger = trigger;

  // 矢を持っていて、弓に近づいたら「つがえる」感じに右手の矢を弦へ向ける
  if(xr.arrowInHand && xr.bowArrow){
    xr.bowArrow.visible = true;
    const bowPos = getWorldPos(xr.left);
    const handPos = getWorldPos(xr.right);
    const d = bowPos.distanceTo(handPos);
    if(d < .55 && xr.bowInHand) xr.arrowNocked = true;
  }

  if(xrReticle) xrReticle.visible = !!(xr.bowInHand && (xr.arrowNocked || xr.drawing));

  if(xr.drawing){
    const bowPos = getWorldPos(xr.left);
    const handPos = getWorldPos(xr.right);
    const draw = clamp(bowPos.distanceTo(handPos), .08, .92);
    updateBowStringVisual(draw, bowPos, handPos);
    showVRHint(`🏹 引き絞り ${Math.round(draw*100)} / トリガーを離して発射`);
  }else{
    updateBowStringVisual(0);
  }

  if(xr.swordInHand && xr.rightVelocity.length() > 2.15 && performance.now()-xr.lastSwordHitAt > 430){
    const hit = findSwordHitTarget();
    if(hit){
      xr.lastSwordHitAt = performance.now();
      const power = clamp(xr.rightVelocity.length()*5.0, 10, 46);
      applyDamage(player, hit, power + (player.userData.stats.level-1)*2, "vr_sword");
      awardSkill(player, "剣術", 6);
      showVRHint(`⚔️ 斬撃 ${Math.round(power)}`);
    }else{
      showVRHint("⚔️ 空振り");
    }
  }
  xr.lastGrip = grip;
}

function updateBowStringVisual(draw, bowPos=null, handPos=null){
  if(!xr.bowString) return;
  const scale = 1.0;
  const baseX = xr.bow?.userData?.stringBaseX ?? -.06;
  // 弦の中央が右手側へ引かれる。位相ズレ防止のため弓ローカルZ方向にだけたわませる。
  const midZ = draw ? -.18 - draw*.30 : 0;
  const points = [
    new THREE.Vector3(baseX,-.675*scale,0),
    new THREE.Vector3(baseX,0,midZ),
    new THREE.Vector3(baseX,.675*scale,0)
  ];
  xr.bowString.geometry.dispose();
  xr.bowString.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function releaseVRBow(){
  if(!renderer.xr.isPresenting || !xr.drawing) return;
  xr.drawing = false;
  if(!xr.bowInHand || !xr.arrowInHand){ showVRHint("矢がつがえられていない"); return; }
  const bowWorld = getWorldPos(xr.left);
  const handWorld = getWorldPos(xr.right);
  const draw = clamp(bowWorld.distanceTo(handWorld), .08, .92);
  // 弓は左手、弦と矢は右手。VR空間→惑星シミュレーション座標へ変換して発射。
  let worldDir = bowWorld.clone().sub(handWorld).normalize();
  if(worldDir.lengthSq()<.001) worldDir = getWorldDir(xr.left);
  const start = xrWorldToSim(bowWorld);
  const dir = xrDirWorldToSim(worldDir);
  const speed = 16 + draw * 66;
  const dmg = 7 + draw * 25 + (player.userData.stats.level-1)*2;
  spawnArrowFree(player, start, dir, speed, dmg);
  awardSkill(player, "弓術", 4);
  xr.arrowInHand = false;
  xr.arrowNocked = false;
  if(xr.bowArrow) xr.bowArrow.visible = false;
  showVRHint(`🏹 発射：速度${Math.round(speed)} / 矢筒から次の矢を取れる`);
}

function findSwordHitTarget(){
  const swordTip = getWorldPos(xr.right).add(getWorldDir(xr.right).multiplyScalar(.75));
  let near=null, dist=999;
  for(const c of creatures){
    if((c.userData.stats?.hp ?? 0)<=0) continue;
    const d = c.position.distanceTo(swordTip);
    if(d<dist){ dist=d; near=c; }
  }
  return dist < 2.1 ? near : null;
}

function awardSkill(unit, skill, xp){
  const s = unit.userData.skills || (unit.userData.skills = {});
  const rec = s[skill] || (s[skill] = {xp:0, level:1});
  rec.xp += xp;
  const need = rec.level * 30;
  if(rec.xp >= need){ rec.xp -= need; rec.level++; showDialog(`${unit.userData.name}の${skill} Lv.${rec.level}`,1600); }
}

function showVRHint(text){
  // VR中はHUDが見えづらいので通常ダイアログにも短時間表示
  if(!showVRHint._t || performance.now()-showVRHint._t > 250){
    showVRHint._t = performance.now();
    hud.dataset.vr = text;
  }
}

function vrShootArrow(){
  const target = selected?.userData?.type === "creature" ? selected : findNearestThreat(player.position, 60);
  const weapon = {name:"VR練習弓", kind:"bow", range:65, atk:12, arrowSpeed:48};
  if(target){ spawnArrow(player, target, weapon); showDialog("VR弓：狙って射撃。的中で弓術経験値。", 1400); }
  else {
    const up = player.position.clone().normalize();
    const dir = player.userData.forward?.clone().projectOnPlane(up).normalize() || getLocalBasis(up,yaw).forward;
    const dummy = { position: player.position.clone().add(dir.multiplyScalar(45)), parent:true, userData:{stats:{hp:1}} };
    spawnArrow(player, dummy, weapon); showDialog("VR弓：前方へ射撃。", 1200);
  }
}

function vrSwordSlash(){
  const target = selected?.userData?.type === "creature" ? selected : findNearestThreat(player.position, 6);
  if(!target){ showDialog("VR剣：届く距離に対象がいません。", 1100); return; }
  const forwardOk = isFacingTarget(player, target, -0.1);
  if(player.position.distanceTo(target.position) < 5.2 && forwardOk){
    applyDamage(player, target, 14 + (player.userData.stats.level-1)*2, "vr_sword");
    showDialog("VR剣：斬撃命中。角度と距離が重要。", 1100);
  }else showDialog("VR剣：空振り。身体の向きと距離が合っていません。", 1100);
}

function updateCamera(){
  if(renderer.xr.isPresenting) return;
  const up = player.position.clone().normalize();
  const basis = getLocalBasis(up, yaw);
  const forward = basis.forward;
  let label = zoom<2 ? "FPV" : zoom<35 ? "TPV" : zoom<125 ? "RTS" : "PLANET";

  if(zoom<2){
    // FPV: すぐに身体の向きへ追従。視線は地面接線方向＋ピッチ。
    const desired = player.position.clone().add(up.clone().multiplyScalar(2.35));
    camera.position.lerp(desired,.42);
    const look = forward.clone().multiplyScalar(Math.cos(pitch)).add(up.clone().multiplyScalar(Math.sin(pitch))).normalize();
    camera.lookAt(camera.position.clone().add(look));
  }else if(zoom<35){
    // TPV: 背面追従を強め、進行方向が画面上に来る。
    const desired = player.position.clone().add(up.clone().multiplyScalar(zoom*.42+4)).add(forward.clone().multiplyScalar(-zoom));
    camera.position.lerp(desired,.32);
    camera.lookAt(player.position.clone().add(up.clone().multiplyScalar(2.3)).add(forward.clone().multiplyScalar(5.0)));
  }else{
    // RTS/Planet: デッドゾーン追従。少し進んでからカメラが追いかける。
    const desired = player.position.clone().add(up.clone().multiplyScalar(zoom*.58+12)).add(forward.clone().multiplyScalar(-zoom));
    const dead = zoom < 125 ? 10 : 25;
    if(camera.position.distanceTo(desired) > dead) camera.position.lerp(desired,.045);
    camera.lookAt(player.position);
  }
  hud.innerHTML = `PSE v0.2.4 <span class="mode-badge">${gameMode}</span> / Scale:${label} / Input:${inputProfile}<br>Lv:${player.userData.stats.level} XP:${player.userData.stats.xp}/${xpToNext(player.userData.stats.level)} 撃破:${player.userData.stats.kills||0}<br>木:${wood} 石:${stone} 鉱:${ore} 信仰:${faith}<br>NPC:${npcs.length} クリーチャー:${creatures.length} 建物:${buildings.length}<br>A:${buttonMap.A} B:${buttonMap.B} X:${buttonMap.X} Y:${buttonMap.Y}<br>${selected?.userData?.name?"選択:"+selected.userData.name:"${dangerAlert} / クリックで移動・会話"}`;
}

function setupEvents(){
  addEventListener("resize",()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true; inputProfile="PC"; if(e.key===" ") jump(); if(e.key.toLowerCase()==="q") zoom*=1.12; if(e.key.toLowerCase()==="e") zoom*=.89; zoom=clamp(zoom,.35,290); });
  addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
  addEventListener("wheel",e=>{ inputProfile="PC"; zoom*=e.deltaY>0?1.12:.89; zoom=clamp(zoom,.35,290); },{passive:true});
  addEventListener("mousemove",e=>{
    if(document.pointerLockElement===renderer.domElement){ inputProfile="PC"; yaw-=e.movementX*.003; pitch-=e.movementY*.002; pitch=clamp(pitch,-.85,.62); }
  });
  renderer.domElement.addEventListener("click",e=>{ if(zoom<35) renderer.domElement.requestPointerLock?.(); handleTap(e.clientX,e.clientY); });
  renderer.domElement.addEventListener("pointerdown",e=>{ if(e.pointerType==="touch") handleTap(e.clientX,e.clientY); });
}

function handleTap(x,y){
  const mouse = new THREE.Vector2(x/innerWidth*2-1, -(y/innerHeight)*2+1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(mouse,camera);
  const hitNpc = ray.intersectObjects(npcs)[0];
  if(hitNpc){ selected=hitNpc.object; talkTo(selected); return; }
  const hitCreature = ray.intersectObjects(creatures)[0];
  if(hitCreature){ selected=hitCreature.object; showDialog(`${selected.userData.name} HP:${Math.max(0,Math.round(selected.userData.stats.hp))}/${selected.userData.stats.maxHp}<br>速度:${selected.userData.kind.speed} 防御:${selected.userData.combat.defense}<br>X/⚔️で攻撃、狩人・衛兵に指示できます。`,2400); return; }
  const hitRes = ray.intersectObjects(resources)[0];
  if(hitRes){ selected=hitRes.object; commandTarget=hitRes.object.position.clone(); showDialog("資源へ移動開始。近づいたらAまたはXで採集。",1800); return; }
  const hitHouse = ray.intersectObjects(buildings,true)[0];
  if(hitHouse){ showDialog("建物：屋内シームレス化は次版で実装。",1800); return; }
  const hitPlanet = ray.intersectObject(planet)[0];
  if(hitPlanet){ const d=hitPlanet.point.clone().normalize(); commandTarget=d.multiplyScalar(surfaceRadius(d)+HUMANOID_GROUND_OFFSET); }
}

function talkTo(npc){
  const m = npc.userData.mind;
  const last = m.memories[0] ? `前に「${m.memories[0]}」を覚えています。` : "今日は風が穏やかですね。";
  m.loyalty = Math.min(100, m.loyalty + 7);
  m.faith = Math.min(100, m.faith + 3);
  faith += 1;
  m.remember("主人公と話した");
  const tone = m.loyalty>80 ? "お帰りなさい。あなたの指示なら喜んで動きます。" : m.loyalty>55 ? "こんにちは。何か手伝いましょうか。" : "……何の用でしょう。";
  showDialog(`${m.name}（${m.personality}）<br>「${tone}<br>${last}」<br>忠誠:${m.loyalty} 信仰:${m.faith} 記憶:${m.commands.length}/${m.memory}<br>${m.canControl()?"直接操作可能":"忠誠/信仰70で直接操作可能"}`,4200);
}

function gatherNearest(){
  let near=null,dist=999;
  for(const r of resources){ const d=player.position.distanceTo(r.position); if(d<dist){dist=d; near=r;} }
  if(!near || dist>11){ showDialog("近くに採集できる資源がありません。",1600); return; }
  if(near.userData.type==="tree"){ wood+=22; showDialog("木材 +22。木を切る音が周囲に広がった。",1600); }
  else{ stone+=13; ore+=5; showDialog("石 +13 / 鉱 +5。硬い音が響いた。",1600); }
  const posForRegen = near.position.clone(); const typeForRegen = near.userData.type;
  near.removeFromParent(); resources = resources.filter(r=>r!==near);
  if(typeForRegen === "tree") regenQueue.push({type:"tree", pos:posForRegen, time:80+Math.random()*80});
  if(teachingMode) teachingLog.push({type:"gather", target:near.userData.type});
}

function buildHouse(){
  if(wood<45 || stone<22){ showDialog("建売住宅には木45・石22が必要。",1800); return; }
  wood-=45; stone-=22;
  const up=player.position.clone().normalize();
  const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).projectOnPlane(up).normalize();
  const dir=player.position.clone().add(forward.multiplyScalar(9)).normalize();
  const pos=dir.clone().multiplyScalar(surfaceRadius(dir)+3.2);
  const house=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(7,4,7), new THREE.MeshStandardMaterial({color:0x9b7653}));
  const roof=new THREE.Mesh(new THREE.ConeGeometry(5.9,3,4), new THREE.MeshStandardMaterial({color:0x884433}));
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.4,.18), new THREE.MeshStandardMaterial({color:0x3b2315}));
  roof.position.y=3.5; roof.rotation.y=Math.PI/4; door.position.set(0,-.8,3.6);
  house.add(body,roof,door);
  house.position.copy(pos); house.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);
  house.userData={type:"house", name:"建売住宅"};
  scene.add(house); buildings.push(house);
  if(teachingMode) teachingLog.push({type:"build", target:"house"});
  showDialog("建売住宅を建築。スマホ建築なのでDIYより割高。",2200);
}


const buildRecipes = {
  fence:{icon:"🚧", name:"柵", wood:6, stone:0, place:true},
  field:{icon:"🌾", name:"畑", wood:12, stone:2, place:true},
  house:{icon:"🏠", name:"小屋", wood:45, stone:22, place:true},
  chest:{icon:"📦", name:"収納箱", wood:16, stone:0, place:true, storage:true},
  torch:{icon:"🔥", name:"たいまつ", wood:3, stone:0, place:true, light:true},
  campfire:{icon:"🪵", name:"焚火", wood:8, stone:6, place:true, light:true},
  bed:{icon:"🛌", name:"ベッド", wood:18, stone:0, place:true, rest:true}
};

function openBuildMenu(){
  const buttons = Object.keys(buildRecipes).map(k=>{
    const r=buildRecipes[k];
    return `<button onclick="buildObject('${k}')">${r.icon} ${r.name}<br><small>木${r.wood} 石${r.stone}</small></button>`;
  }).join("");
  commandPopup.innerHTML = `<button class="close" onclick="closeCommandPopup()">×</button><h3>🧱 建築・家具配置</h3><small>現在は建売式。PC/VRでは後でDIY配置へ拡張。</small><div class="build-grid">${buttons}</div>`;
  commandPopup.classList.remove("hidden");
}

function buildObject(type){
  const r = buildRecipes[type];
  if(!r) return;
  if(wood < r.wood || stone < r.stone){ showDialog(`${r.name}には木${r.wood}・石${r.stone}が必要。`,1700); return; }
  wood -= r.wood; stone -= r.stone;
  const up=player.position.clone().normalize();
  const basis=getLocalBasis(up,yaw);
  const dir=player.position.clone().add(basis.forward.multiplyScalar(type==='fence'?5.5:7.5)).normalize();
  const pos=dir.clone().multiplyScalar(surfaceRadius(dir)+HUMANOID_GROUND_OFFSET+.02);
  const obj=makeBuildObject(type);
  obj.position.copy(pos);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);
  // 前面をプレイヤーの向きに近づける
  const forward=basis.forward.clone().projectOnPlane(up).normalize();
  orientEntity(obj, up, forward);
  obj.userData = {type:type==='field'?'field':type==='chest'?'storage':type, name:r.name, recipe:type, inventory:{wood:0,stone:0,ore:0,food:0,water:0}};
  scene.add(obj); buildings.push(obj);
  const placeId = `built_${type}_${buildings.length}`;
  places.push({id:placeId,name:r.name,icon:r.icon,pos:pos.clone(),dir:dir.clone(),inventory:obj.userData.inventory || {wood:0,stone:0,ore:0,food:0,water:0}, object:obj});
  updateLists();
  showDialog(`${r.icon} ${r.name}を配置。場所リストから移動/収納/名称変更できます。`,2000);
  closeCommandPopup();
}

function makeBuildObject(type){
  const g=new THREE.Group();
  const woodMat=new THREE.MeshStandardMaterial({color:0x8b5a2b,roughness:.9});
  const darkWood=new THREE.MeshStandardMaterial({color:0x4b2c17,roughness:.9});
  const stoneMat=new THREE.MeshStandardMaterial({color:0x777777,roughness:.95});
  const soilMat=new THREE.MeshStandardMaterial({color:0x4a2b17,roughness:1});
  const clothMat=new THREE.MeshStandardMaterial({color:0x3355aa,roughness:.8});
  if(type==='fence'){
    for(const x of [-1.2,1.2]){ const post=new THREE.Mesh(new THREE.BoxGeometry(.18,1.25,.18),woodMat); post.position.set(x,.62,0); g.add(post); }
    for(const y of [.45,.9]){ const rail=new THREE.Mesh(new THREE.BoxGeometry(2.8,.16,.14),woodMat); rail.position.set(0,y,0); g.add(rail); }
  }else if(type==='field'){
    const soil=new THREE.Mesh(new THREE.BoxGeometry(5,.10,4),soilMat); soil.position.y=.05; g.add(soil);
    for(let i=-2;i<=2;i++){ const row=new THREE.Mesh(new THREE.BoxGeometry(.08,.12,3.5),new THREE.MeshStandardMaterial({color:0x2e8b57})); row.position.set(i*.85,.18,0); g.add(row); }
  }else if(type==='house'){
    const body=new THREE.Mesh(new THREE.BoxGeometry(6,3.4,6),woodMat); body.position.y=1.7; g.add(body);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(5.2,2.4,4),new THREE.MeshStandardMaterial({color:0x773322})); roof.position.y=4; roof.rotation.y=Math.PI/4; g.add(roof);
    const door=new THREE.Mesh(new THREE.BoxGeometry(1.2,2,.12),darkWood); door.position.set(0,1,3.05); g.add(door);
  }else if(type==='chest'){
    const box=new THREE.Mesh(new THREE.BoxGeometry(1.6,.9,1.1),darkWood); box.position.y=.45; g.add(box);
    const lid=new THREE.Mesh(new THREE.BoxGeometry(1.72,.18,1.2),woodMat); lid.position.y=.98; g.add(lid);
    const band=new THREE.Mesh(new THREE.BoxGeometry(.16,1.05,1.24),stoneMat); band.position.y=.55; g.add(band);
  }else if(type==='torch'){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,1.8,8),woodMat); pole.position.y=.9; pole.rotation.z=.18; g.add(pole);
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:0xffaa22})); flame.position.set(.18,1.78,0); g.add(flame);
    const light=new THREE.PointLight(0xffaa55,1.2,18); light.position.copy(flame.position); g.add(light);
  }else if(type==='campfire'){
    for(let i=0;i<5;i++){ const log=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.2,8),woodMat); log.rotation.z=Math.PI/2; log.rotation.y=i*Math.PI/5; log.position.y=.16; g.add(log); }
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.35,.75,12),new THREE.MeshBasicMaterial({color:0xff7a22,transparent:true,opacity:.85})); flame.position.y=.65; g.add(flame);
    const light=new THREE.PointLight(0xff8844,1.6,22); light.position.y=1.0; g.add(light);
  }else if(type==='bed'){
    const frame=new THREE.Mesh(new THREE.BoxGeometry(2.2,.35,3.2),woodMat); frame.position.y=.25; g.add(frame);
    const mat=new THREE.Mesh(new THREE.BoxGeometry(2,.25,2.7),clothMat); mat.position.y=.58; g.add(mat);
    const pillow=new THREE.Mesh(new THREE.BoxGeometry(1.5,.22,.55),new THREE.MeshStandardMaterial({color:0xffffff})); pillow.position.set(0,.82,1.0); g.add(pillow);
  }
  return g;
}
window.openBuildMenu=openBuildMenu;
window.buildObject=buildObject;

function findNearestBuildingByType(type, range=12){
  let near=null, dist=999;
  for(const b of buildings){
    if(type && b.userData?.type !== type && b.userData?.recipe !== type) continue;
    const d = player.position.distanceTo(b.position);
    if(d < dist && d < range){ dist=d; near=b; }
  }
  return near;
}

function enterNearestHouse(){
  if(indoorState){
    exitIndoor();
    return true;
  }
  const house = findNearestBuildingByType("house", 13);
  if(!house){ showDialog("近くに入れる家がありません。", 1300); return false; }
  indoorState = { building:house, returnPos:player.position.clone(), oldZoom:zoom };
  zoom = Math.min(zoom, 8);
  // 現段階では「半透明室内モード」。本格的な屋内シーンはv0.3で部屋Frame化。
  house.traverse(o=>{
    if(o.material){
      o.userData._oldTransparent = o.material.transparent;
      o.userData._oldOpacity = o.material.opacity;
      o.material.transparent = true;
      o.material.opacity = Math.min(o.material.opacity ?? 1, .32);
    }
  });
  const up = house.position.clone().normalize();
  const inside = house.position.clone().add(up.clone().multiplyScalar(1.9));
  player.position.copy(inside);
  showDialog(`🏠 ${house.userData.name || "家"} に入りました。A/💬で外へ出ます。`, 1800);
  return true;
}

function exitIndoor(){
  if(!indoorState) return false;
  const house = indoorState.building;
  house?.traverse(o=>{
    if(o.material){
      o.material.transparent = o.userData._oldTransparent ?? false;
      o.material.opacity = o.userData._oldOpacity ?? 1;
    }
  });
  const up = house.position.clone().normalize();
  const forward = new THREE.Vector3(0,0,1).applyQuaternion(house.quaternion).projectOnPlane(up).normalize();
  const out = house.position.clone().add(forward.multiplyScalar(6)).normalize();
  player.position.copy(out.multiplyScalar(surfaceRadius(out)+HUMANOID_GROUND_OFFSET));
  zoom = indoorState.oldZoom ?? zoom;
  indoorState = null;
  showDialog("外へ出ました。", 1200);
  return true;
}

function teachNearest(){
  const npc = findNearestNPC();
  if(!npc){ showDialog("近くに教える相手がいません。",1600); return; }
  if(!teachingMode){ teachingMode=true; teachingLog=[]; showDialog(`${npc.userData.name}に教える開始。採集や建築を見せてください。`,2200); }
  else{
    teachingMode=false;
    const m=npc.userData.mind; let learned=0;
    for(const cmd of teachingLog){ if(m.learn(cmd)) learned++; }
    m.loyalty=Math.min(100,m.loyalty+learned*4+5);
    showDialog(`${m.name}は${learned}個の行動を覚えた。<br>忠誠:${m.loyalty} 記憶:${m.commands.length}/${m.memory}`,2600);
  }
}


function attackNearest(){
  if(inputProfile === "VR"){
    const t = selected?.userData?.type === "creature" ? selected : findNearestThreat(player.position, 60);
    if(t && player.position.distanceTo(t.position) > 7) return vrShootArrow();
    return vrSwordSlash();
  }
  let target = selected?.userData?.type === "creature" ? selected : findNearestThreat(player.position, 18);
  if(!target){ showDialog("近くに攻撃対象がいません。",1400); return; }
  player.userData.target = target;
  player.userData.combat = player.userData.combat || {atk:10, range:4.2, courage:80, defense:1};
  player.userData.weapon = player.userData.weapon || {name:"短剣", kind:"melee", range:4.2, atk:10};
  commandTarget = target.position.clone();
  showDialog(`${target.userData.name}へ攻撃開始。衛兵/狩人にも指示できます。`,1800);
}

function findNearestThreat(pos, range){
  let near=null, dist=999;
  for(const c of creatures){
    if((c.userData.stats?.hp ?? 0)<=0) continue;
    if(!c.userData.combat.hostile && range < 20) continue;
    const d=pos.distanceTo(c.position);
    if(d<dist && d<range){dist=d; near=c;}
  }
  return near;
}

function findNearestVillageUnit(pos, range){
  let near=null, dist=999;
  for(const u of [player, ...npcs]){
    if((u.userData.stats?.hp ?? 100)<=0) continue;
    const d=pos.distanceTo(u.position);
    if(d<dist && d<range){dist=d; near=u;}
  }
  return near;
}

function commandCombatRole(role, mode){
  let count=0;
  for(const n of npcs){
    if(n.userData.mind.role !== role) continue;
    const threat = findNearestThreat(n.position, mode === "hunt" ? 40 : 28);
    if(threat){ n.userData.target = threat; n.userData.commandKind = "attack"; count++; }
    else if(selectedPlace){ n.userData.command = selectedPlace.pos.clone(); n.userData.commandKind = mode; count++; }
  }
  showDialog(`${role} ${count}人へ${mode === "hunt" ? "狩猟" : "警備"}指示。`,1800);
}

function showFloatingText(text, pos){
  // 軽量化のため現版ではHUD通知だけ。将来3D吹き出し化。
  if(Math.random()<.35) showDialog(text,700);
}

function findNearestNPC(){ let near=null,dist=999; for(const n of npcs){ const d=player.position.distanceTo(n.position); if(d<dist){dist=d;near=n;} } return dist<15?near:null; }
function jump(){ showDialog("ジャンプ/物理エンジンは次のRapier統合で強化予定。",1200); }
function press(actionButton){
  const a = buttonMap[actionButton];
  if(a==="context"){ if(indoorState) exitIndoor(); else if(selected?.userData?.type==="npc") talkTo(selected); else if(findNearestBuildingByType("house", 10)) enterNearestHouse(); else gatherNearest(); }
  else if(a==="talk"){ const npc=findNearestNPC(); npc?talkTo(npc):showDialog("近くに会話相手がいません。",1400); }
  else if(a==="gather") gatherNearest();
  else if(a==="attack") attackNearest();
  else if(a==="build") openBuildMenu();
  else if(a==="teach") teachNearest();
  else if(a==="storage") openStorageCommand();
  else if(a==="cancel"){ selected=null; commandTarget=null; teachingMode=false; showDialog("キャンセル",1000); }
  else if(a==="jump") jump();
  else showDialog(`${a} は次版で実装。`,1200);
}

function setupUI(){
  document.getElementById("playBtn")?.addEventListener("click", startPlayMode);
  document.getElementById("editorBtn")?.addEventListener("click", startEditorMode);
  document.getElementById("marketBtn")?.addEventListener("click", openMarketplace);
  document.getElementById("libraryBtn")?.addEventListener("click", openLibrary);
  document.getElementById("cosmosBtn")?.addEventListener("click", openCosmos);
  document.getElementById("marketCloseBtn")?.addEventListener("click", ()=>marketPanel.classList.add("hidden"));
  document.getElementById("libraryCloseBtn")?.addEventListener("click", ()=>libraryPanel.classList.add("hidden"));
  document.getElementById("cosmosCloseBtn")?.addEventListener("click", ()=>cosmosPanel.classList.add("hidden"));
  document.querySelectorAll("[data-market-cat]").forEach(btn=>btn.addEventListener("click",()=>renderMarketplace(btn.dataset.marketCat)));
  document.getElementById("editorCloseBtn")?.addEventListener("click", ()=>editorPanel.classList.add("hidden"));
  document.querySelectorAll("[data-primitive]").forEach(btn=>btn.addEventListener("click",()=>createPrimitive(btn.dataset.primitive)));
  document.getElementById("saveBlueprintBtn")?.addEventListener("click", saveBlueprintDraft);
  document.getElementById("loadBlueprintBtn")?.addEventListener("click", showBlueprintLibrary);
  ["bpName","bpCategory","bpMaterial","bpX","bpY","bpZ","bpR","holdX","holdY","holdZ","rotX","rotY","rotZ"].forEach(id=>{
    document.getElementById(id)?.addEventListener("input", updateBlueprintCalc);
    document.getElementById(id)?.addEventListener("change", updateBlueprintCalc);
  });
  document.getElementById("settingsBtn").onclick=()=>settings.classList.toggle("hidden");
  document.getElementById("zoomInBtn").onclick=()=>{ inputProfile="SMARTPHONE"; zoom*=.82; zoom=clamp(zoom,.35,290); };
  document.getElementById("zoomOutBtn").onclick=()=>{ inputProfile="SMARTPHONE"; zoom*=1.22; zoom=clamp(zoom,.35,290); };
  document.getElementById("houseBtn").onclick=()=>buildObject("house");
  document.getElementById("buildMenuBtn").onclick=openBuildMenu;
  document.getElementById("teachBtn").onclick=teachNearest;
  document.getElementById("inventoryBtn").onclick=()=>showInventory();
  document.getElementById("btnA").onclick=()=>press("A");
  document.getElementById("btnB").onclick=()=>press("B");
  document.getElementById("btnX").onclick=()=>press("X");
  document.getElementById("btnY").onclick=()=>press("Y");
  document.querySelectorAll("select[data-bind]").forEach(sel=>sel.onchange=()=>buttonMap[sel.dataset.bind]=sel.value);
}

function setupStick(id,out){
  const el=document.getElementById(id), knob=el.querySelector(".knob");
  let active=false,pid=null,cx=0,cy=0;
  el.addEventListener("pointerdown",e=>{ active=true; pid=e.pointerId; el.setPointerCapture(pid); const r=el.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2; update(e); });
  el.addEventListener("pointermove",e=>{ if(active && e.pointerId===pid) update(e); });
  el.addEventListener("pointerup",reset); el.addEventListener("pointercancel",reset);
  function update(e){ let dx=e.clientX-cx, dy=e.clientY-cy; const max=45, len=Math.hypot(dx,dy); if(len>max){dx=dx/len*max; dy=dy/len*max;} out.x=dx/max; out.y=dy/max; knob.style.transform=`translate(${dx}px,${dy}px)`; }
  function reset(){ active=false; pid=null; out.x=0; out.y=0; knob.style.transform="translate(0,0)"; }
}



function createArcheryRange(){
  const rangeDir = new THREE.Vector3(.28,.92,.18).normalize();
  addPlace("archery_range", "演習場", "🎯", rangeDir);
  const up = rangeDir.clone();
  const basis = getLocalBasis(up, 0.6);
  const origin = rangeDir.clone().multiplyScalar(surfaceRadius(rangeDir)+HUMANOID_GROUND_OFFSET+.15);
  const distances = [10, 25, 50];
  distances.forEach((dist, i)=>{
    const posDir = origin.clone().add(basis.forward.clone().multiplyScalar(dist)).normalize();
    const pos = posDir.clone().multiplyScalar(surfaceRadius(posDir)+1.25);
    const target = makeArcheryTarget(i);
    target.position.copy(pos);
    orientEntity(target, posDir, basis.forward.clone().projectOnPlane(posDir).normalize());
    target.userData = {type:"archeryTarget", name:`的 ${dist}m`, distance:dist};
    scene.add(target);
    archeryTargets.push(target);
  });
}

function makeArcheryTarget(index=0){
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,2.2,8), new THREE.MeshStandardMaterial({color:0x6b4423}));
  pole.position.y = .95;
  g.add(pole);
  const board = new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,.10,32), new THREE.MeshStandardMaterial({color:0xffffff, roughness:.7}));
  board.position.set(0,1.75,.04);
  board.rotation.x = Math.PI/2;
  g.add(board);
  const red = new THREE.Mesh(new THREE.CylinderGeometry(.56,.56,.115,32), new THREE.MeshBasicMaterial({color:0xdd3333}));
  red.position.copy(board.position); red.rotation.copy(board.rotation); g.add(red);
  const bull = new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.13,32), new THREE.MeshBasicMaterial({color:0xffdd33}));
  bull.position.copy(board.position); bull.rotation.copy(board.rotation); g.add(bull);
  return g;
}

function createPlaces(){
  const base = new THREE.Vector3(0,1,0).normalize();
  addPlace("home_base", "拠点の家", "🏠", base);
  addPlace("field_1", "第一農園", "🌾", new THREE.Vector3(.13,.98,.05).normalize());
  addPlace("market_1", "市場", "🛒", new THREE.Vector3(-.08,.99,.09).normalize());
  addPlace("forest_1", "東の森", "🌲", new THREE.Vector3(.18,.96,-.06).normalize());
  addPlace("square_1", "中央広場", "🏳️", new THREE.Vector3(.04,.999,-.03).normalize());
  addPlace("north_gate", "北門", "🛡️", new THREE.Vector3(-.12,.985,-.05).normalize());
  addPlace("hunting_1", "狩場", "🏹", new THREE.Vector3(.22,.94,.16).normalize());
}
function addPlace(id, name, icon, dir){
  const pos = dir.clone().multiplyScalar(surfaceRadius(dir)+HUMANOID_GROUND_OFFSET);
  places.push({id,name,icon,pos,dir:dir.clone(), inventory:{wood:0,stone:0,ore:0,food:10,water:10}});
}
function makeSchedule(role){
  if(role === "農夫") return [
    [360,"起床", "home_base"], [420,"朝食", "home_base"], [480,"畑へ移動", "field_1"],
    [540,"作物の世話", "field_1"], [720,"昼食", "home_base"], [780,"作物の世話", "field_1"],
    [1020,"帰宅", "home_base"], [1080,"夕食", "home_base"], [1140,"余暇", "square_1"], [1320,"睡眠", "home_base"]
  ];
  if(role === "商人") return [[420,"朝食","home_base"],[510,"市場へ移動","market_1"],[540,"売買","market_1"],[720,"昼食","market_1"],[780,"売買","market_1"],[1080,"夕食","home_base"],[1320,"睡眠","home_base"]];
  if(role === "木こり") return [[420,"朝食","home_base"],[500,"森へ移動","forest_1"],[540,"伐採","forest_1"],[720,"昼食","home_base"],[780,"伐採","forest_1"],[1080,"夕食","home_base"],[1320,"睡眠","home_base"]];
  if(role === "狩人") return [[360,"起床","home_base"],[420,"朝食","home_base"],[480,"狩場へ移動","hunting_1"],[540,"狩猟/索敵","hunting_1"],[720,"昼食","home_base"],[780,"狩猟/罠確認","hunting_1"],[1020,"獲物を市場へ","market_1"],[1080,"夕食","home_base"],[1320,"睡眠","home_base"]];
  if(role === "衛兵") return [[360,"起床","home_base"],[420,"朝食","home_base"],[480,"北門へ移動","north_gate"],[540,"巡回警備","north_gate"],[720,"交代休憩","square_1"],[780,"巡回警備","north_gate"],[1080,"夕食","home_base"],[1140,"夜警","north_gate"],[1320,"睡眠","home_base"]];
  return [[420,"朝食","home_base"],[540,"仕事","square_1"],[720,"昼食","square_1"],[1080,"夕食","home_base"],[1320,"睡眠","home_base"]];
}
function getScheduleNow(mind){
  let item = mind.schedule[0];
  for(const s of mind.schedule){ if(worldMinutes >= s[0]) item = s; }
  return item;
}
function updateRoutineCommand(npc){
  const mind = npc.userData.mind;
  const item = getScheduleNow(mind);
  if(!item) return;
  mind.currentRoutine = item[1];
  let place = places.find(p=>p.id === item[2]);

  // 判断精度が低いと、たまに近い別の場所や広場へ向かう。知能差が行動に出る土台。
  const acc = mind.intelligence?.accuracy ?? 0.7;
  if(place && Math.random() > acc){
    const alternatives = places.filter(p => p.id !== place.id);
    place = alternatives[Math.floor(Math.random()*alternatives.length)] || place;
    mind.lastDecision = `判断ミス: ${item[2]}ではなく${place.id}`;
  }else{
    mind.lastDecision = `判断: ${item[1]}`;
  }

  if((mind.role === "狩人" || mind.role === "衛兵") && (mind.currentRoutine.includes("狩") || mind.currentRoutine.includes("警"))){
    const threat = findNearestThreat(npc.position, mind.role === "狩人" ? 42 : 32);
    // 注意力が低いと発見が遅れる。高いとすぐ反応。
    if(threat && Math.random() < (mind.intelligence?.focus ?? .7)){
      npc.userData.target = threat;
      npc.userData.commandKind = "attack";
      mind.lastDecision = "脅威を発見して迎撃";
      return;
    }
  }
  if(place && !npc.userData.command && npc.position.distanceTo(place.pos) > 8){
    npc.userData.command = place.pos.clone();
    npc.userData.commandKind = "routine";
  }
}
function nextThinkInterval(mind){
  // 簡単判断: 0.5〜3秒程度。反応速度が高いほど短い。
  const speed = mind?.intelligence?.reactionSpeed ?? .6;
  const focus = mind?.intelligence?.focus ?? .6;
  return clamp(2.8 - speed*2.0 + (1-focus)*0.8, 0.45, 3.2);
}
function updateTime(dt){
  worldMinutes += dt * 4; // 1秒=4分
  if(worldMinutes >= 1440){ worldMinutes -= 1440; dayCount++; }
  playerStats.hunger = clamp(playerStats.hunger + dt*.025,0,100);
  playerStats.thirst = clamp(playerStats.thirst + dt*.035,0,100);
  playerStats.stamina = clamp(playerStats.stamina + dt*(commandTarget?-.18:.12),0,100);
}
function updateWeather(dt){
  if(!clouds) return;
  for(const c of clouds.children){
    const altitude = c.position.length() - R;
    c.rotateY(dt * (0.012 + Math.max(0,18-altitude)*0.0006));
  }
  clouds.rotation.y += dt*.008;
}
function updateCelestialMotion(dt){
  const a = (worldMinutes/1440) * Math.PI*2;
  const sunPos = new THREE.Vector3(Math.cos(a)*430, Math.sin(a)*430, 180);
  const moonPos = new THREE.Vector3(Math.cos(a+Math.PI)*330, Math.sin(a+Math.PI)*330, -230);
  if(sunMesh) sunMesh.position.copy(sunPos);
  if(moonMesh) moonMesh.position.copy(moonPos);
  if(sunLight){ sunLight.position.copy(sunPos); sunLight.intensity = Math.max(.25, Math.sin(a)*2.7); }
}
function updateResourceRegen(dt){
  for(const item of regenQueue) item.time -= dt;
  const ready = regenQueue.filter(i=>i.time<=0);
  regenQueue = regenQueue.filter(i=>i.time>0);
  for(const r of ready) spawnResourceAt(r.type, r.pos.clone().normalize());
}
function spawnResourceAt(type, dir){
  const oreNode = type === "ore";
  const mesh = new THREE.Mesh(
    oreNode ? new THREE.DodecahedronGeometry(1.7) : new THREE.ConeGeometry(1.25,4.2,8),
    new THREE.MeshStandardMaterial({color: oreNode ? 0x8d8fa0 : 0x145c2c})
  );
  mesh.position.copy(dir.multiplyScalar(surfaceRadius(dir)+1.8));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), mesh.position.clone().normalize());
  mesh.userData = {type:oreNode?"ore":"tree"};
  scene.add(mesh); resources.push(mesh);
}
function updatePanels(){
  panelRefreshTimer++; if(panelRefreshTimer%20===0) updateLists();
  const dir = player.position.clone().normalize();
  const lat = THREE.MathUtils.radToDeg(Math.asin(dir.y));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(dir.z, dir.x));
  const alt = Math.max(0, player.position.length()-R);
  const hour = Math.floor(worldMinutes/60), min = Math.floor(worldMinutes%60);
  const temp = Math.round(26 - Math.abs(lat)*0.35 - alt*0.12 + Math.sin(worldMinutes/1440*Math.PI*2)*5);
  infoPanel.innerHTML = `Day ${dayCount} ${String(hour).padStart(2,"0")}:${String(min).padStart(2,"0")}<br>緯度:${lat.toFixed(2)}° 経度:${lon.toFixed(2)}°<br>標高:${alt.toFixed(1)}m 気温:${temp}℃`;
  statusPanel.innerHTML = gauge("HP",playerStats.hp,"hp")+gauge("STA",playerStats.stamina,"sta")+gauge("空腹",100-playerStats.hunger,"food")+gauge("渇き",100-playerStats.thirst,"water")+gauge("精神",playerStats.spirit,"spirit");
}
function gauge(label,val,cls){ return `<div class="gauge"><span>${label}</span><div class="bar"><div class="fill ${cls}" style="width:${clamp(val,0,100)}%"></div></div><span>${Math.round(val)}</span></div>`; }
function updateLists(){
  allyList.innerHTML = npcs.slice(0,16).map((n,i)=>{ const role=n.userData.mind.role; const icon=role==="狩人"?"🏹":role==="衛兵"?"🛡️":role==="農夫"?"👨‍🌾":role==="商人"?"🧺":role==="木こり"?"🪓":"👤"; return `<button class="list-row" data-npc="${i}">${icon}${n.userData.name} <small>${role}/${n.userData.mind.currentRoutine||"待機"} Lv.${n.userData.stats.level} HP:${Math.max(0,Math.round(n.userData.stats.hp))}</small></button>`}).join("");
  allyList.querySelectorAll("button[data-npc]").forEach(btn=>btn.onclick=()=>openNPCCommand(npcs[+btn.dataset.npc]));
  placeList.innerHTML = places.map((p,i)=>`<button class="list-row" data-place="${i}">${p.icon}${p.name}<br><small>${placeCoords(p)}</small></button>`).join("");
  placeList.querySelectorAll("button[data-place]").forEach(btn=>btn.onclick=()=>openPlaceCommand(places[+btn.dataset.place]));
}
function placeCoords(p){ const d=p.dir; return `${THREE.MathUtils.radToDeg(Math.asin(d.y)).toFixed(2)}°, ${THREE.MathUtils.radToDeg(Math.atan2(d.z,d.x)).toFixed(2)}°`; }
function openNPCCommand(npc){
  selectedCompanion = npc; selected = npc;
  const m=npc.userData.mind;
  commandPopup.innerHTML = `<button class="close" onclick="closeCommandPopup()">×</button><h3>👤${m.name} / ${m.role}</h3>忠誠:${m.loyalty} 信仰:${m.faith}<br>知能: 反応${Math.round(m.intelligence.reactionSpeed*100)} 判断${Math.round(m.intelligence.accuracy*100)} 記憶${m.memory}<br>ルーチン:${m.currentRoutine}<br>判断:${m.lastDecision||"未判断"}<br>武器:${selectedCompanion?.userData.weapon?.name || npc.userData.weapon?.name} 防具:${npc.userData.armor?.name}(${Math.max(0,Math.round(npc.userData.armor?.hp??0))})<br><button onclick="controlSelectedCompanion()">操作切替</button><button onclick="talkSelectedCompanion()">💬会話</button><button onclick="teachSelectedCompanion()">⏺️覚える/教える</button><button onclick="showSelectedSchedule()">📅予定</button><button onclick="commandSelectedToPlayer()">こちらへ来る</button><button onclick="commandSelectedAttack()">⚔️近くの敵を攻撃</button><button onclick="commandSelectedGuard()">🛡️この場所を警備</button>`;
  commandPopup.classList.remove("hidden");
}
function openPlaceCommand(place){
  selectedPlace = place;
  commandPopup.innerHTML = `<button class="close" onclick="closeCommandPopup()">×</button><h3>${place.icon}${place.name}</h3>${placeCoords(place)}<br><button onclick="movePlayerToSelectedPlace()">いどう🚶</button><button onclick="sendSelectedCompanionToPlace()">仲間を送る</button><button onclick="renameSelectedPlace()">名称変更</button><button onclick="showPlaceStorage()">📦収納</button>`;
  commandPopup.classList.remove("hidden");
}
function closeCommandPopup(){ commandPopup.classList.add("hidden"); }
function controlSelectedCompanion(){ if(!selectedCompanion)return; if(selectedCompanion.userData.mind.canControl()){ activeUnit=selectedCompanion; player=selectedCompanion; showDialog(`${selectedCompanion.userData.name}へ操作切替。`,1600);} else showDialog("忠誠または信仰が70以上必要。",1600); closeCommandPopup(); }
function talkSelectedCompanion(){ if(selectedCompanion) talkTo(selectedCompanion); closeCommandPopup(); }
function teachSelectedCompanion(){ teachNearest(); closeCommandPopup(); }
function showSelectedSchedule(){ if(!selectedCompanion)return; const m=selectedCompanion.userData.mind; showDialog(`<b>${m.name}の予定</b><br>`+m.schedule.map(s=>`${Math.floor(s[0]/60)}:${String(s[0]%60).padStart(2,"0")} ${s[1]}`).join("<br>"),6000); }
function commandSelectedToPlayer(){ if(selectedCompanion){ selectedCompanion.userData.command = player.position.clone(); selectedCompanion.userData.commandKind="follow"; showDialog(`${selectedCompanion.userData.name}に集合指示。`,1500); } closeCommandPopup(); }
function commandSelectedAttack(){ if(selectedCompanion){ const threat=findNearestThreat(selectedCompanion.position,45); if(threat){ selectedCompanion.userData.target=threat; selectedCompanion.userData.commandKind="attack"; showDialog(`${selectedCompanion.userData.name}へ攻撃指示。`,1600); } else showDialog("近くに敵がいません。",1400); } closeCommandPopup(); }
function commandSelectedGuard(){ if(selectedCompanion){ const p = selectedPlace?.pos || selectedCompanion.position; selectedCompanion.userData.command=p.clone(); selectedCompanion.userData.commandKind="guard"; showDialog(`${selectedCompanion.userData.name}へ警備指示。`,1600); } closeCommandPopup(); }
function movePlayerToSelectedPlace(){ if(selectedPlace){ commandTarget=selectedPlace.pos.clone(); showDialog(`${selectedPlace.name}へ移動開始。`,1500); } closeCommandPopup(); }
function sendSelectedCompanionToPlace(){ if(selectedCompanion && selectedPlace){ selectedCompanion.userData.command=selectedPlace.pos.clone(); selectedCompanion.userData.commandKind="move"; showDialog(`${selectedCompanion.userData.name}を${selectedPlace.name}へ。`,1800); } else showDialog("先に仲間を選択してください。",1500); closeCommandPopup(); }
function renameSelectedPlace(){ if(!selectedPlace)return; const name=prompt("場所名", selectedPlace.name); if(name){ selectedPlace.name=name; updateLists(); } closeCommandPopup(); }
function showPlaceStorage(){ if(!selectedPlace)return; const inv=selectedPlace.inventory; showDialog(`<b>${selectedPlace.name}の収納</b><br>木:${inv.wood} 石:${inv.stone} 鉱:${inv.ore} 食料:${inv.food} 水:${inv.water}<br>「○○を何個入れる/取り出す」は次版で命令化。`,4000); closeCommandPopup(); }
function showInventory(){ showDialog(`<b>🎒インベントリ</b><br>木:${inventory.wood} 石:${inventory.stone} 鉱:${inventory.ore}<br>食料:${inventory.food} 水:${inventory.water} Coin:${inventory.coin}`,3000); }
window.closeCommandPopup=closeCommandPopup; window.controlSelectedCompanion=controlSelectedCompanion; window.talkSelectedCompanion=talkSelectedCompanion; window.teachSelectedCompanion=teachSelectedCompanion; window.showSelectedSchedule=showSelectedSchedule; window.commandSelectedToPlayer=commandSelectedToPlayer; window.commandSelectedAttack=commandSelectedAttack; window.commandSelectedGuard=commandSelectedGuard; window.movePlayerToSelectedPlace=movePlayerToSelectedPlace; window.sendSelectedCompanionToPlace=sendSelectedCompanionToPlace; window.renameSelectedPlace=renameSelectedPlace; window.showPlaceStorage=showPlaceStorage;

function getLocalBasis(up, yawValue){
  // 惑星上の任意地点で安定する接線基底。
  // これで赤道・極付近でも「前進」が必ず地面と平行になる。
  const ref = Math.abs(up.dot(new THREE.Vector3(0,1,0))) > .92 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(0,1,0);
  const baseForward = ref.clone().projectOnPlane(up).normalize();
  const q = new THREE.Quaternion().setFromAxisAngle(up, yawValue);
  const forward = baseForward.clone().applyQuaternion(q).normalize();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  return {
    forward,
    right,
    yawFromDir(dir){
      const d = dir.clone().projectOnPlane(up).normalize();
      const x = d.dot(right);
      const y = d.dot(forward);
      return yawValue + Math.atan2(x, y);
    }
  };
}

function orientEntity(obj, up, forward){
  // 横倒し防止：ローカルY軸=地面法線、ローカルZ軸=進行方向。
  // forwardが不安定な時は前回方向または安全な接線方向へフォールバックする。
  const y = up.clone().normalize();
  let z = (forward || obj.userData.forward || getLocalBasis(y,0).forward).clone().projectOnPlane(y);
  if(z.lengthSq() < 0.0001) z = getLocalBasis(y,0).forward;
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const z2 = new THREE.Vector3().crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z2);
  obj.quaternion.setFromRotationMatrix(m);
}

function findEntityRoot(obj){
  let o = obj;
  while(o && !o.userData?.type && o.parent) o = o.parent;
  return o;
}

function setInputProfile(profile){
  inputProfile = profile;
  showDialog(`${profile}操作仕様に切替<br>PC: WASD/マウス/ホイール/QE<br>VR: 左グリップで背中の弓を取る/戻す。右グリップで矢筒から矢を取り出す、または剣を抜刀/納刀。右トリガーで弦を引き、離して射る<br>MR: 卓上RTS/手元UI/空間配置`, 2600);
}
window.setInputProfile = setInputProfile;

function openStorageCommand(){ showInventory(); }


function openMarketplace(){
  marketPanel?.classList.remove("hidden");
  libraryPanel?.classList.add("hidden");
  cosmosPanel?.classList.add("hidden");
  renderMarketplace("building");
}
function renderMarketplace(cat="building"){
  document.querySelectorAll("[data-market-cat]").forEach(b=>b.classList.toggle("active", b.dataset.marketCat===cat));
  const items = marketItems.filter(i=>i.cat===cat);
  marketList.innerHTML = items.map(item=>`<div class="market-card"><h3>${item.icon} ${item.name}</h3><small>作者:${item.author}</small><br><span class="limited">${item.cost} Coin / 利用${item.uses}回</span><p>${item.desc}</p>${item.tags.map(t=>`<span class="tag">${t}</span>`).join("")}<br><button onclick="buyMarketItem('${item.id}')">導入する</button></div>`).join("");
}
function buyMarketItem(id){
  const item = marketItems.find(i=>i.id===id);
  if(!item) return;
  if(inventory.coin < item.cost){ showDialog("Coinが足りません。", 1500); return; }
  inventory.coin -= item.cost;
  const owned = {...item, installedAt:Date.now(), remainingUses:item.uses};
  libraryItems.push(owned);
  localStorage.setItem("pse_library_v1", JSON.stringify(libraryItems));
  showDialog(`${item.icon} ${item.name} をライブラリへ導入しました。`, 2200);
  renderLibrary();
}
function openLibrary(){
  libraryPanel?.classList.remove("hidden");
  marketPanel?.classList.add("hidden");
  cosmosPanel?.classList.add("hidden");
  renderLibrary();
}
function renderLibrary(){
  if(!libraryItems.length){ libraryList.innerHTML = `<div class="market-card">まだ導入済み作品がありません。マーケットから追加してください。</div>`; return; }
  libraryList.innerHTML = libraryItems.map((item,idx)=>`<div class="market-card"><h3>${item.icon} ${item.name}</h3><small>${item.cat} / 作者:${item.author}</small><p>${item.desc}</p><span class="limited">残り利用:${item.remainingUses}</span><br><button onclick="useLibraryItem(${idx})">使う/教える</button></div>`).join("");
}
function useLibraryItem(idx){
  const item = libraryItems[idx];
  if(!item) return;
  if(item.remainingUses <= 0){ showDialog("ライセンス利用回数が残っていません。", 1800); return; }
  item.remainingUses--;
  localStorage.setItem("pse_library_v1", JSON.stringify(libraryItems));
  if(item.cat==="building" || item.cat==="furniture") showDialog(`${item.name} の設計図を使用。サバイバルでは素材消費して配置します。`, 2500);
  else if(item.cat==="ai") showDialog(`${item.name} を選択中の村人へ教える土台を実行。知能・記憶容量で習得率が変わります。`, 2800);
  else if(item.cat==="motion") showDialog(`${item.name} をモーション教材として登録。⏺️覚えるシステムへ接続予定。`, 2800);
  else showDialog(`${item.name} を共同宇宙/研究ライブラリへ登録。`, 2500);
  renderLibrary();
}
function openCosmos(){
  cosmosPanel?.classList.remove("hidden");
  marketPanel?.classList.add("hidden");
  libraryPanel?.classList.add("hidden");
}
window.buyMarketItem = buyMarketItem;
window.useLibraryItem = useLibraryItem;

function startPlayMode(){
  gameMode = "PLAY";
  homeScreen?.classList.add("hidden");
  editorPanel?.classList.add("hidden");
  showDialog("▶️ プレイ開始。サバイバル資源消費・仲間AI・建築を使うモードです。", 2600);
}
function startEditorMode(){
  gameMode = "EDITOR";
  homeScreen?.classList.add("hidden");
  editorPanel?.classList.remove("hidden");
  showDialog("🛠️ エディタ開始。自由モデリングの土台です。", 2600);
}
function editorParamNumber(id, fallback){
  const el = document.getElementById(id);
  const v = Number(el?.value);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function editorParamText(id, fallback){ return document.getElementById(id)?.value || fallback; }
function calcPrimitiveVolume(type, dims){
  const x = dims.x, y = dims.y, z = dims.z, r = dims.r;
  if(type === "sphere") return 4/3 * Math.PI * Math.pow(r,3);
  if(type === "cylinder") return Math.PI * r * r * y;
  if(type === "cone") return Math.PI * r * r * y / 3;
  if(type === "plane") return x * z * 0.04;
  return x * y * z;
}
function getEditorParams(type="box"){
  const dims = {
    x: editorParamNumber("bpX", 1),
    y: editorParamNumber("bpY", 1),
    z: editorParamNumber("bpZ", 1),
    r: editorParamNumber("bpR", .5)
  };
  const materialId = editorParamText("bpMaterial", "wood");
  const mat = materialCatalog[materialId] || materialCatalog.wood;
  const volume = calcPrimitiveVolume(type, dims);
  const weight = volume * mat.density;
  const category = editorParamText("bpCategory", "item");
  const baseStamina = category === "weapon" ? 2.5 : 1.0;
  const weaponFactor = category === "weapon" ? 0.45 : 0.08;
  const staminaCost = baseStamina + weight * weaponFactor;
  return {dims, materialId, material:mat, volume, weight, category, staminaCost};
}
function updateBlueprintCalc(){
  const type = editorBlueprintParts.at(-1)?.shape || "box";
  const p = getEditorParams(type);
  const el = document.getElementById("bpCalc");
  if(!el) return;
  el.innerHTML = `素材:${p.material.label} 密度:${p.material.density}kg/m³<br>推定体積:${p.volume.toFixed(3)}m³ 重量:${p.weight.toFixed(1)}kg<br>使用スタミナ:${p.staminaCost.toFixed(1)} / 必要資源:${p.material.resource} ${Math.ceil(p.weight)}`;
}
function createGeometryFromParams(type, dims){
  if(type === "sphere") return new THREE.SphereGeometry(dims.r, 18, 12);
  if(type === "cylinder") return new THREE.CylinderGeometry(dims.r, dims.r, dims.y, 18);
  if(type === "cone") return new THREE.ConeGeometry(dims.r, dims.y, 18);
  if(type === "plane") return new THREE.BoxGeometry(dims.x, .04, dims.z);
  return new THREE.BoxGeometry(dims.x, dims.y, dims.z);
}
function createPrimitive(type){
  const params = getEditorParams(type);
  const need = Math.ceil(params.weight);
  if(gameMode !== "EDITOR"){
    const res = params.material.resource;
    if(res === "wood" && wood < need){ showDialog(`素材不足：木 ${need}`, 1800); return; }
    if(res === "stone" && stone < need){ showDialog(`素材不足：石 ${need}`, 1800); return; }
    if(res === "ore" && ore < need){ showDialog(`素材不足：鉱 ${need}`, 1800); return; }
    if(res === "wood") wood -= need;
    if(res === "stone") stone -= need;
    if(res === "ore") ore -= need;
  }
  const up = player.position.clone().normalize();
  const basis = getLocalBasis(up, yaw);
  const pos = player.position.clone().add(basis.forward.clone().multiplyScalar(5)).normalize();
  pos.multiplyScalar(surfaceRadius(pos)+1.2);
  const geo = createGeometryFromParams(type, params.dims);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:params.material.color, roughness:.85}));
  mesh.position.copy(pos);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);
  const part = {
    id:`part_${Date.now()}_${Math.floor(Math.random()*9999)}`,
    shape:type,
    size:{x:params.dims.x, y:params.dims.y, z:params.dims.z, r:params.dims.r},
    material:params.materialId,
    volume:params.volume,
    weight:params.weight,
    staminaCost:params.staminaCost,
    transform:{position:{x:mesh.position.x,y:mesh.position.y,z:mesh.position.z}, rotation:{x:0,y:0,z:0}, scale:1}
  };
  editorBlueprintParts.push(part);
  mesh.userData = {type:"primitive", primitive:type, part, blueprint:false};
  scene.add(mesh);
  buildings.push(mesh);
  places.push({id:`model_${buildings.length}`, name:`${type}モデル`, icon:"🧩", pos:mesh.position.clone(), dir:mesh.position.clone().normalize(), inventory:{wood:0,stone:0,ore:0,food:0,water:0}});
  updateLists();
  updateBlueprintCalc();
  showDialog(`${type}を配置。体積${params.volume.toFixed(3)}m³ / 重量${params.weight.toFixed(1)}kg。${gameMode === "EDITOR" ? "素材消費なし。" : "素材を消費。"}`, 2600);
}
function makeBlueprintDraft(){
  const name = editorParamText("bpName", "無名設計図");
  const category = editorParamText("bpCategory", "item");
  const parts = editorBlueprintParts.length ? editorBlueprintParts : [{shape:"box", ...getEditorParams("box")}].map((p,i)=>({
    id:`part_${i}`, shape:p.shape || "box", size:{x:p.dims.x,y:p.dims.y,z:p.dims.z,r:p.dims.r}, material:p.materialId, volume:p.volume, weight:p.weight, staminaCost:p.staminaCost
  }));
  const totalVolume = parts.reduce((a,p)=>a+(p.volume||0),0);
  const totalWeight = parts.reduce((a,p)=>a+(p.weight||0),0);
  const requiredMaterials = {};
  for(const part of parts){
    const mat = materialCatalog[part.material] || materialCatalog.wood;
    const key = mat.resource;
    requiredMaterials[key] = (requiredMaterials[key]||0) + Math.ceil(part.weight || 0);
  }
  const holdPose = {
    hand:"right",
    position:{x:Number(document.getElementById("holdX")?.value||0), y:Number(document.getElementById("holdY")?.value||0), z:Number(document.getElementById("holdZ")?.value||0)},
    rotation:{x:Number(document.getElementById("rotX")?.value||0), y:Number(document.getElementById("rotY")?.value||0), z:Number(document.getElementById("rotZ")?.value||0)},
    scale:1
  };
  const blueprint = {
    id:`bp_${Date.now()}`,
    name,
    category,
    version:"0.3.1",
    parts,
    totalVolume,
    totalWeight,
    requiredMaterials,
    stats:{
      attack: category === "weapon" ? Math.max(1, Math.round(totalWeight*1.8)) : 0,
      defense: category === "weapon" ? 0 : Math.round(totalWeight*.12),
      staminaCost: Number((2 + totalWeight * (category === "weapon" ? .45 : .08)).toFixed(1)),
      durability: Math.max(10, Math.round(totalWeight*8))
    },
    holdPose,
    carryPose:{attachTo:"back", position:{x:.12,y:.25,z:.18}, rotation:{x:15,y:0,z:-25}, scale:1},
    sheathPose:{attachTo:"waist_left", position:{x:-.25,y:-.15,z:.08}, rotation:{x:-20,y:0,z:35}, scale:1},
    license:{uses:999, author:"local", marketplaceReady:false},
    createdAt:new Date().toISOString()
  };
  lastBlueprintDraft = blueprint;
  return blueprint;
}
function saveBlueprintDraft(){
  const blueprint = makeBlueprintDraft();
  savedBlueprints.push(blueprint);
  localStorage.setItem("pse_blueprints_v1", JSON.stringify(savedBlueprints));
  showDialog(`<b>📜 設計図保存</b><br>${blueprint.name}<br>体積:${blueprint.totalVolume.toFixed(3)}m³ 重量:${blueprint.totalWeight.toFixed(1)}kg<br>スタミナ消費:${blueprint.stats.staminaCost}<br>握り位相 rot(${blueprint.holdPose.rotation.x},${blueprint.holdPose.rotation.y},${blueprint.holdPose.rotation.z})`, 5200);
}
function showBlueprintLibrary(){
  savedBlueprints = JSON.parse(localStorage.getItem("pse_blueprints_v1") || "[]");
  if(!savedBlueprints.length){ showDialog("保存済み設計図はまだありません。", 1800); return; }
  const html = `<div class="blueprint-list"><b>📚 保存済み設計図</b><br>` + savedBlueprints.map((b,i)=>`<div class="market-card"><b>${b.name}</b> / ${b.category}<br>重量:${b.totalWeight.toFixed(1)}kg 体積:${b.totalVolume.toFixed(3)}m³<br>スタミナ:${b.stats.staminaCost} 攻撃:${b.stats.attack}<br><button onclick="loadBlueprintInfo(${i})">詳細</button></div>`).join("") + `</div>`;
  showDialog(html, 9000);
}
function loadBlueprintInfo(i){
  const b = savedBlueprints[i];
  if(!b) return;
  showDialog(`<b>${b.name}</b><br>素材:${Object.entries(b.requiredMaterials).map(([k,v])=>`${k}:${v}`).join(" ")}<br>手持ち位相 pos(${b.holdPose.position.x},${b.holdPose.position.y},${b.holdPose.position.z}) rot(${b.holdPose.rotation.x},${b.holdPose.rotation.y},${b.holdPose.rotation.z})<br>この情報を使って、VRで手に持った時の角度・腰/背中装備を補正できます。`, 8000);
}
window.loadBlueprintInfo = loadBlueprintInfo;

function showDialog(html, ms=3000){ dialog.innerHTML=html; dialog.classList.remove("hidden"); clearTimeout(dialog.timer); dialog.timer=setTimeout(()=>dialog.classList.add("hidden"),ms); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerpAngle(a,b,t){ const d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; return a+d*t; }
