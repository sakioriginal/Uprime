import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const hud = document.getElementById("hud");
const dialog = document.getElementById("dialog");
const settings = document.getElementById("settings");

let scene, camera, renderer, clock;
let planet, player, clouds, atmosphere;
let npcs = [], resources = [], buildings = [], celestials = [];
let yaw = 0, pitch = -0.16, zoom = 16;
let keys = {}, moveInput = {x:0,y:0}, lookInput = {x:0,y:0};
let commandTarget = null, selected = null;
let wood = 140, stone = 90, ore = 0, faith = 0;
let teachingMode = false, teachingLog = [];
const R = 95;

const buttonMap = { A:"context", B:"cancel", X:"gather", Y:"build" };

class Mind{
  constructor(name, role="村人"){
    this.name = name;
    this.role = role;
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
animate();

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101c);
  scene.fog = new THREE.Fog(0x07101c, 160, 850);

  camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2500);
  renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x93a8c8, .8));
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.7);
  sunLight.position.set(170, 220, 120); scene.add(sunLight);

  createPlanet();
  createSky();
  createPlayer();
  createNPCs(20);
  createResources(70);
  createCelestials();
  createStars();
  setupEvents();
  setupStick("moveStick", moveInput);
  setupStick("lookStick", lookInput);
  setupUI();
  showDialog("PSE v0.1 起動。＋−またはホイールでFPV/TPV/RTSへズームできます。", 2800);
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

function createPlayer(){
  player = new THREE.Mesh(
    new THREE.CapsuleGeometry(1,3,8,14),
    new THREE.MeshStandardMaterial({color:0xffdd66})
  );
  player.position.set(0,R+4,0);
  player.userData = {type:"player", name:"主人公", mind:new Mind("主人公","導き手"), command:null};
  player.userData.mind.loyalty = 100; player.userData.mind.faith = 100; player.userData.mind.memory = 24;
  scene.add(player);
}

function createNPCs(n){
  const names = ["アオ","レン","ミナ","ユイ","タク","ソラ","リク","ハナ","ケイ","ナナ","ジン","レイ","マコ","トウマ","サナ","イオ","カイ","ノア","ミオ","シン"];
  for(let i=0;i<n;i++){
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.25)d.y=Math.abs(d.y); d.normalize();
    const npc = new THREE.Mesh(
      new THREE.CapsuleGeometry(.85,2.5,8,12),
      new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.52 + Math.random()*.18, .7, .6)})
    );
    npc.position.copy(d.multiplyScalar(surfaceRadius(d)+3));
    npc.userData = {type:"npc", name:names[i%names.length], mind:new Mind(names[i%names.length]), command:null, wanderTimer:Math.random()*4};
    scene.add(npc); npcs.push(npc);
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
  const sun = new THREE.Mesh(new THREE.SphereGeometry(13,32,16), new THREE.MeshBasicMaterial({color:0xffdd55}));
  sun.position.set(410,220,260); scene.add(sun);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(8,32,16), new THREE.MeshStandardMaterial({color:0xd4d4d4, roughness:.9}));
  moon.position.set(-260,160,-310); scene.add(moon);
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

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .033);
  updatePlayer(dt);
  updateNPCs(dt);
  updateCamera(dt);
  if(clouds) clouds.rotation.y += dt*.022;
  for(let i=0;i<celestials.length;i++) celestials[i].rotation.y += dt*(.2+i*.05);
  renderer.render(scene,camera);
}

function updatePlayer(dt){
  const up = player.position.clone().normalize();
  yaw -= lookInput.x*dt*2.6;
  pitch -= lookInput.y*dt*1.1;
  pitch = Math.max(-.85, Math.min(.62, pitch));

  const ix = (keys.d?1:0) - (keys.a?1:0) + moveInput.x;
  const iy = (keys.w?1:0) - (keys.s?1:0) - moveInput.y;
  const forward = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).projectOnPlane(up).normalize();
  const right = new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)).projectOnPlane(up).normalize();
  let moved=false;

  const mv = forward.clone().multiplyScalar(iy).add(right.clone().multiplyScalar(ix));
  if(mv.length()>.01){
    player.position.add(mv.normalize().multiplyScalar(23*dt));
    commandTarget=null; moved=true;
  }
  if(commandTarget){
    const dir = commandTarget.clone().sub(player.position).projectOnPlane(up);
    if(dir.length()<.85){ commandTarget=null; }
    else{
      player.position.add(dir.normalize().multiplyScalar(18*dt));
      yaw = lerpAngle(yaw, Math.atan2(dir.x, dir.z), .14);
      moved=true;
    }
  }
  const d = player.position.clone().normalize();
  player.position.copy(d.multiplyScalar(surfaceRadius(d)+3));
  player.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d);
  if(moved && zoom>2 && zoom<34){ /* TPVは進行方向が画面上へ寄る */ }
}

function updateNPCs(dt){
  for(const npc of npcs){
    const up = npc.position.clone().normalize();
    npc.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);
    npc.userData.wanderTimer -= dt;
    if(!npc.userData.command && npc.userData.wanderTimer<=0){
      npc.userData.wanderTimer = 3 + Math.random()*8;
      const wander = new THREE.Vector3().randomDirection().projectOnPlane(up).normalize();
      const target = npc.position.clone().add(wander.multiplyScalar(12+Math.random()*18)).normalize();
      npc.userData.command = target.multiplyScalar(surfaceRadius(target)+3);
    }
    if(npc.userData.command){
      const dir = npc.userData.command.clone().sub(npc.position).projectOnPlane(up);
      if(dir.length()<.7) npc.userData.command=null;
      else{
        npc.position.add(dir.normalize().multiplyScalar(7.5*dt));
        const nd=npc.position.clone().normalize();
        npc.position.copy(nd.multiplyScalar(surfaceRadius(nd)+3));
      }
    }
  }
}

function updateCamera(){
  const up = player.position.clone().normalize();
  const forward = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).projectOnPlane(up).normalize();
  let label = zoom<2 ? "FPV" : zoom<35 ? "TPV" : zoom<125 ? "RTS" : "PLANET";

  if(zoom<2){
    const desired = player.position.clone().add(up.clone().multiplyScalar(2.35));
    camera.position.lerp(desired,.38);
    const look = forward.clone().multiplyScalar(Math.cos(pitch)).add(up.clone().multiplyScalar(Math.sin(pitch))).normalize();
    camera.lookAt(camera.position.clone().add(look));
  }else if(zoom<35){
    const desired = player.position.clone().add(up.clone().multiplyScalar(zoom*.42+4)).add(forward.clone().multiplyScalar(-zoom));
    camera.position.lerp(desired,.24);
    camera.lookAt(player.position.clone().add(up.clone().multiplyScalar(2.3)).add(forward.clone().multiplyScalar(4.5)));
  }else{
    const desired = player.position.clone().add(up.clone().multiplyScalar(zoom*.58+12)).add(forward.clone().multiplyScalar(-zoom));
    camera.position.lerp(desired,.055);
    camera.lookAt(player.position);
  }
  hud.innerHTML = `PSE v0.1 / Scale:${label}<br>木:${wood} 石:${stone} 鉱:${ore} 信仰:${faith}<br>NPC:${npcs.length} 建物:${buildings.length}<br>A:${buttonMap.A} B:${buttonMap.B} X:${buttonMap.X} Y:${buttonMap.Y}<br>${selected?.userData?.name?"選択:"+selected.userData.name:"クリック/タップで移動・会話"}`;
}

function setupEvents(){
  addEventListener("resize",()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  addEventListener("keydown",e=>{ keys[e.key.toLowerCase()]=true; if(e.key===" ") jump(); });
  addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);
  addEventListener("wheel",e=>{ zoom*=e.deltaY>0?1.12:.89; zoom=clamp(zoom,.35,290); },{passive:true});
  addEventListener("mousemove",e=>{
    if(document.pointerLockElement===renderer.domElement){ yaw-=e.movementX*.003; pitch-=e.movementY*.002; pitch=clamp(pitch,-.85,.62); }
  });
  renderer.domElement.addEventListener("click",e=>{ if(zoom<35) renderer.domElement.requestPointerLock?.(); handleTap(e.clientX,e.clientY); });
  renderer.domElement.addEventListener("pointerdown",e=>{ if(e.pointerType==="touch") handleTap(e.clientX,e.clientY); });
}

function handleTap(x,y){
  const mouse = new THREE.Vector2(x/innerWidth*2-1, -(y/innerHeight)*2+1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(mouse,camera);
  const hitNpc = ray.intersectObjects(npcs)[0];
  if(hitNpc){ selected=hitNpc.object; talkTo(selected); return; }
  const hitRes = ray.intersectObjects(resources)[0];
  if(hitRes){ selected=hitRes.object; commandTarget=hitRes.object.position.clone(); showDialog("資源へ移動開始。近づいたらAまたはXで採集。",1800); return; }
  const hitHouse = ray.intersectObjects(buildings,true)[0];
  if(hitHouse){ showDialog("建物：屋内シームレス化は次版で実装。",1800); return; }
  const hitPlanet = ray.intersectObject(planet)[0];
  if(hitPlanet){ const d=hitPlanet.point.clone().normalize(); commandTarget=d.multiplyScalar(surfaceRadius(d)+3); }
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
  scene.remove(near); resources = resources.filter(r=>r!==near);
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

function findNearestNPC(){ let near=null,dist=999; for(const n of npcs){ const d=player.position.distanceTo(n.position); if(d<dist){dist=d;near=n;} } return dist<15?near:null; }
function jump(){ showDialog("ジャンプ/物理エンジンは次のRapier統合で強化予定。",1200); }
function press(actionButton){
  const a = buttonMap[actionButton];
  if(a==="context"){ if(selected?.userData?.type==="npc") talkTo(selected); else gatherNearest(); }
  else if(a==="talk"){ const npc=findNearestNPC(); npc?talkTo(npc):showDialog("近くに会話相手がいません。",1400); }
  else if(a==="gather") gatherNearest();
  else if(a==="build") buildHouse();
  else if(a==="teach") teachNearest();
  else if(a==="cancel"){ selected=null; commandTarget=null; teachingMode=false; showDialog("キャンセル",1000); }
  else if(a==="jump") jump();
  else showDialog(`${a} は次版で実装。`,1200);
}

function setupUI(){
  document.getElementById("settingsBtn").onclick=()=>settings.classList.toggle("hidden");
  document.getElementById("zoomInBtn").onclick=()=>{ zoom*=.82; zoom=clamp(zoom,.35,290); };
  document.getElementById("zoomOutBtn").onclick=()=>{ zoom*=1.22; zoom=clamp(zoom,.35,290); };
  document.getElementById("houseBtn").onclick=buildHouse;
  document.getElementById("teachBtn").onclick=teachNearest;
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

function showDialog(html, ms=3000){ dialog.innerHTML=html; dialog.classList.remove("hidden"); clearTimeout(dialog.timer); dialog.timer=setTimeout(()=>dialog.classList.add("hidden"),ms); }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function lerpAngle(a,b,t){ const d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; return a+d*t; }
