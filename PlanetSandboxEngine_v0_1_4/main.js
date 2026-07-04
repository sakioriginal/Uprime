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

let scene, camera, renderer, clock;
let planet, player, clouds, atmosphere;
let npcs = [], creatures = [], resources = [], buildings = [], celestials = [], projectiles = [];
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
let inventory = { wood:0, stone:0, ore:0, food:3, water:3 };
let regenQueue = [];
let panelRefreshTimer = 0;
const playerStats = { hp:100, stamina:100, hunger:18, thirst:12, spirit:82 };
let sunMesh = null, moonMesh = null, sunLight = null;
const R = 95;
const HUMANOID_GROUND_OFFSET = 0.82;
const CREATURE_GROUND_OFFSET = 0.55;
let inputProfile = "SMARTPHONE"; // SMARTPHONE / PC / VR / MR
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
  createNPCs(24);
  createCreatures(16);
  createResources(190);
  createCelestials();
  createStars();
  setupEvents();
  setupStick("moveStick", moveInput);
  setupStick("lookStick", lookInput);
  setupUI();
  activeUnit = player;
  updateLists();
  showDialog("PSE v0.1.8 起動。VR装備：背中の弓・矢筒、腰の鞘、抜刀/納刀、矢を抜いてつがえる動作を追加。", 3600);
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
    npc.userData = {type:"npc", name:names[i%names.length], mind, command:null, commandKind:null, target:null, wanderTimer:Math.random()*4, parts:visualParts,
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
    if(npc.userData.commandKind !== "attack") updateRoutineCommand(npc);

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
  scene.add(arrow); projectiles.push(arrow);
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
  scene.add(arrow); projectiles.push(arrow);
  showFloatingText(`VR 🏹 ${Math.round(speed)}`, attacker.position);
}

function updateProjectiles(dt){
  for(const arrow of [...projectiles]){
    const gravity = arrow.position.clone().normalize().multiplyScalar(-22); // 惑星中心方向へ落下
    arrow.userData.velocity.add(gravity.multiplyScalar(dt));
    arrow.position.add(arrow.userData.velocity.clone().multiplyScalar(dt));
    if(arrow.userData.velocity.lengthSq()>0.001) arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), arrow.userData.velocity.clone().normalize());
    arrow.userData.life -= dt;
    const target = arrow.userData.target;
    if(arrow.userData.free){
      for(const c of creatures){
        if((c.userData.stats?.hp ?? 0)<=0) continue;
        if(arrow.position.distanceTo(c.position)<1.35){
          applyDamage(arrow.userData.attacker, c, arrow.userData.damage, "vr_arrow");
          scene.remove(arrow); projectiles = projectiles.filter(a=>a!==arrow);
          awardSkill(arrow.userData.attacker, "弓術", 8);
          continue;
        }
      }
      if(!projectiles.includes(arrow)) continue;
    }else if(target && target.parent && (target.userData.stats?.hp ?? 100)>0 && arrow.position.distanceTo(target.position)<1.45){
      applyDamage(arrow.userData.attacker, target, arrow.userData.damage, "arrow");
      scene.remove(arrow); projectiles = projectiles.filter(a=>a!==arrow); continue;
    }
    const groundDir = arrow.position.clone().normalize();
    if(arrow.position.length() < surfaceRadius(groundDir)+.6 || arrow.userData.life<=0){
      scene.remove(arrow); projectiles = projectiles.filter(a=>a!==arrow);
    }
  }
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
  const pts = [];
  for(let i=0;i<=28;i++){
    const t = i/28;
    const y = (t-.5) * 1.25 * scale;
    const curve = Math.sin((t-.5)*Math.PI) * .22 * scale;
    pts.push(new THREE.Vector3(curve, y, 0));
  }
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, .018*scale, 8, false);
  const body = new THREE.Mesh(tube, wood);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.035*scale,.035*scale,.22*scale,8), dark);
  grip.rotation.x = Math.PI/2;
  const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,-.62*scale,0), new THREE.Vector3(0,.62*scale,0)]);
  const string = new THREE.Line(stringGeo, stringMat);
  string.name = "bowString";
  bow.add(body, grip, string);
  bow.userData.string = string;
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

function setupXRHands(){
  xr.left = renderer.xr.getController(0);
  xr.right = renderer.xr.getController(1);
  xr.leftGrip = renderer.xr.getControllerGrip(0);
  xr.rightGrip = renderer.xr.getControllerGrip(1);
  scene.add(xr.left, xr.right, xr.leftGrip, xr.rightGrip);

  xr.bow = makeBowModel(1.0);
  xr.bow.position.set(0,0,-.08);
  xr.bow.visible = false;
  xr.left.add(xr.bow);
  xr.bowString = xr.bow.userData.string;

  xr.bowArrow = makeArrowModel();
  xr.bowArrow.visible = false;
  xr.right.add(xr.bowArrow);
  xr.bowArrow.position.set(0,0,-.18);

  xr.sword = makeSwordModel();
  xr.sword.position.set(0,0,-.12);
  xr.sword.visible = false;
  xr.right.add(xr.sword);

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

function updateXRHands(dt){
  if(!renderer.xr.isPresenting) return;
  inputProfile = "VR";
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
  const midZ = draw ? -.18 - draw*.28 : 0;
  const points = [new THREE.Vector3(0,-.62*scale,0), new THREE.Vector3(0,0,midZ), new THREE.Vector3(0,.62*scale,0)];
  xr.bowString.geometry.dispose();
  xr.bowString.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function releaseVRBow(){
  if(!renderer.xr.isPresenting || !xr.drawing) return;
  xr.drawing = false;
  if(!xr.bowInHand || !xr.arrowInHand){ showVRHint("矢がつがえられていない"); return; }
  const bowPos = getWorldPos(xr.left);
  const handPos = getWorldPos(xr.right);
  const draw = clamp(bowPos.distanceTo(handPos), .08, .92);
  // 弓は左手、弦と矢は右手。右手→左手方向に矢を飛ばす。
  let dir = bowPos.clone().sub(handPos).normalize();
  if(dir.lengthSq()<.001) dir = getWorldDir(xr.left);
  const speed = 16 + draw * 66;
  const dmg = 7 + draw * 25 + (player.userData.stats.level-1)*2;
  spawnArrowFree(player, bowPos, dir, speed, dmg);
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
  hud.innerHTML = `PSE v0.1.4 / Scale:${label} / Input:${inputProfile}<br>Lv:${player.userData.stats.level} XP:${player.userData.stats.xp}/${xpToNext(player.userData.stats.level)} 撃破:${player.userData.stats.kills||0}<br>木:${wood} 石:${stone} 鉱:${ore} 信仰:${faith}<br>NPC:${npcs.length} クリーチャー:${creatures.length} 建物:${buildings.length}<br>A:${buttonMap.A} B:${buttonMap.B} X:${buttonMap.X} Y:${buttonMap.Y}<br>${selected?.userData?.name?"選択:"+selected.userData.name:"${dangerAlert} / クリックで移動・会話"}`;
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
  scene.remove(near); resources = resources.filter(r=>r!==near);
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
  if(a==="context"){ if(selected?.userData?.type==="npc") talkTo(selected); else gatherNearest(); }
  else if(a==="talk"){ const npc=findNearestNPC(); npc?talkTo(npc):showDialog("近くに会話相手がいません。",1400); }
  else if(a==="gather") gatherNearest();
  else if(a==="attack") attackNearest();
  else if(a==="build") buildHouse();
  else if(a==="teach") teachNearest();
  else if(a==="storage") openStorageCommand();
  else if(a==="cancel"){ selected=null; commandTarget=null; teachingMode=false; showDialog("キャンセル",1000); }
  else if(a==="jump") jump();
  else showDialog(`${a} は次版で実装。`,1200);
}

function setupUI(){
  document.getElementById("settingsBtn").onclick=()=>settings.classList.toggle("hidden");
  document.getElementById("zoomInBtn").onclick=()=>{ inputProfile="SMARTPHONE"; zoom*=.82; zoom=clamp(zoom,.35,290); };
  document.getElementById("zoomOutBtn").onclick=()=>{ inputProfile="SMARTPHONE"; zoom*=1.22; zoom=clamp(zoom,.35,290); };
  document.getElementById("houseBtn").onclick=buildHouse;
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
  const place = places.find(p=>p.id === item[2]);
  if((mind.role === "狩人" || mind.role === "衛兵") && (mind.currentRoutine.includes("狩") || mind.currentRoutine.includes("警"))){
    const threat = findNearestThreat(npc.position, mind.role === "狩人" ? 42 : 32);
    if(threat){ npc.userData.target = threat; npc.userData.commandKind = "attack"; return; }
  }
  if(place && !npc.userData.command && npc.position.distanceTo(place.pos) > 8){
    npc.userData.command = place.pos.clone();
    npc.userData.commandKind = "routine";
  }
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
  commandPopup.innerHTML = `<button class="close" onclick="closeCommandPopup()">×</button><h3>👤${m.name} / ${m.role}</h3>忠誠:${m.loyalty} 信仰:${m.faith}<br>ルーチン:${m.currentRoutine}<br>武器:${selectedCompanion?.userData.weapon?.name || npc.userData.weapon?.name} 防具:${npc.userData.armor?.name}(${Math.max(0,Math.round(npc.userData.armor?.hp??0))})<br><button onclick="controlSelectedCompanion()">操作切替</button><button onclick="talkSelectedCompanion()">💬会話</button><button onclick="teachSelectedCompanion()">⏺️覚える/教える</button><button onclick="showSelectedSchedule()">📅予定</button><button onclick="commandSelectedToPlayer()">こちらへ来る</button><button onclick="commandSelectedAttack()">⚔️近くの敵を攻撃</button><button onclick="commandSelectedGuard()">🛡️この場所を警備</button>`;
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
function showInventory(){ showDialog(`<b>🎒インベントリ</b><br>木:${inventory.wood} 石:${inventory.stone} 鉱:${inventory.ore}<br>食料:${inventory.food} 水:${inventory.water}`,3000); }
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
function showDialog(html, ms=3000){ dialog.innerHTML=html; dialog.classList.remove("hidden"); clearTimeout(dialog.timer); dialog.timer=setTimeout(()=>dialog.classList.add("hidden"),ms); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerpAngle(a,b,t){ const d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; return a+d*t; }
