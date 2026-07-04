import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const R = 90;
const hud = document.getElementById('hud');
const dialog = document.getElementById('dialog');
const settingsPanel = document.getElementById('settingsPanel');

let scene, camera, renderer, clock;
let planet, player, clouds;
let npcs = [], resources = [], buildings = [], celestials = [];
let yaw = 0, pitch = -0.12, zoom = 14;
let keys = {}, moveInput = {x:0,y:0}, lookInput = {x:0,y:0};
let commandTarget = null, selected = null;
let wood = 120, stone = 80, faith = 0;
let buttonMap = { A:'context', B:'cancel', X:'gather', Y:'build' };

class Mind{
  constructor(name){
    this.name = name;
    this.loyalty = 30 + Math.floor(Math.random()*40);
    this.faith = Math.floor(Math.random()*25);
    this.memory = 3 + Math.floor(Math.random()*6);
    this.mood = ['穏やか','勇敢','慎重','陽気','職人気質'][Math.floor(Math.random()*5)];
  }
  canControl(){ return this.loyalty >= 70 || this.faith >= 70; }
}

init();
animate();

function init(){
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101c);
  scene.fog = new THREE.Fog(0x07101c, 150, 720);
  camera = new THREE.PerspectiveCamera(70, innerWidth/innerHeight, 0.1, 2200);
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  clock = new THREE.Clock();

  scene.add(new THREE.AmbientLight(0x95aee0, .8));
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
  sunLight.position.set(160,180,100);
  scene.add(sunLight);

  createPlanet();
  createSky();
  createPlayer();
  createNPCs(16);
  createResources(48);
  createCelestials();
  createStars();
  setupEvents();
  setupStick('moveStick', moveInput);
  setupStick('lookStick', lookInput);
  showDialog('PSE Static v0.1 起動。GitHub Pages用・ビルド不要版です。');
}

function createPlanet(){
  const g = new THREE.SphereGeometry(R,128,64);
  const p = g.attributes.position;
  for(let i=0;i<p.count;i++){
    const v = new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
    const n = v.clone().normalize();
    const h = Math.sin(n.x*8)*2.4 + Math.sin(n.y*12+1.3)*1.5 + Math.sin(n.z*10-.4)*2.0;
    const m = Math.max(0, Math.sin(n.x*5+n.z*4)-.25)*7;
    v.copy(n.multiplyScalar(R+h+m));
    p.setXYZ(i,v.x,v.y,v.z);
  }
  g.computeVertexNormals();
  planet = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:0x2e8b57, roughness:.95}));
  scene.add(planet);
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(R-.9,96,48), new THREE.MeshStandardMaterial({color:0x226cff,transparent:true,opacity:.42,roughness:.55}));
  scene.add(ocean);
}

function surfaceRadius(dir){
  const n = dir.clone().normalize();
  const h = Math.sin(n.x*8)*2.4 + Math.sin(n.y*12+1.3)*1.5 + Math.sin(n.z*10-.4)*2.0;
  const m = Math.max(0, Math.sin(n.x*5+n.z*4)-.25)*7;
  return R+h+m;
}

function createSky(){
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R+10,96,48), new THREE.MeshBasicMaterial({color:0x66aaff,transparent:true,opacity:.12,side:THREE.BackSide}));
  scene.add(atmosphere);
  clouds = new THREE.Group();
  for(let i=0;i<34;i++){
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.25)d.y=Math.abs(d.y); d.normalize();
    const c = new THREE.Mesh(new THREE.SphereGeometry(1.8+Math.random()*2.6,12,8), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45}));
    c.position.copy(d.multiplyScalar(R+10+Math.random()*5));
    clouds.add(c);
  }
  scene.add(clouds);
}

function createPlayer(){
  player = new THREE.Mesh(new THREE.CapsuleGeometry(1,3,6,12), new THREE.MeshStandardMaterial({color:0xffdd66}));
  player.position.set(0,R+4,0);
  player.userData = {type:'player', name:'主人公', mind:new Mind('主人公')};
  player.userData.mind.loyalty=100; player.userData.mind.faith=100;
  scene.add(player);
}

function createNPCs(n){
  const names = ['アオ','レン','ミナ','ユイ','タク','ソラ','リク','ハナ','ケイ','ナナ','ジン','レイ','ミオ','カイ','フミ','リオ'];
  for(let i=0;i<n;i++){
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.25)d.y=Math.abs(d.y); d.normalize();
    const npc = new THREE.Mesh(new THREE.CapsuleGeometry(.85,2.5,6,12), new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(i/n,.55,.58)}));
    npc.position.copy(d.multiplyScalar(surfaceRadius(d)+3));
    npc.userData = {type:'npc', name:names[i%names.length], mind:new Mind(names[i%names.length]), command:null};
    scene.add(npc); npcs.push(npc);
  }
}

function createResources(n){
  for(let i=0;i<n;i++){
    const d = new THREE.Vector3().randomDirection(); if(d.y<-.25)d.y=Math.abs(d.y); d.normalize();
    const ore = i%5===0;
    const mesh = new THREE.Mesh(ore?new THREE.DodecahedronGeometry(1.6):new THREE.ConeGeometry(1.2,4,8), new THREE.MeshStandardMaterial({color:ore?0x888899:0x145c2c}));
    mesh.position.copy(d.multiplyScalar(surfaceRadius(d)+1.8));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), mesh.position.clone().normalize());
    mesh.userData = {type:ore?'ore':'tree'};
    scene.add(mesh); resources.push(mesh);
  }
}

function createCelestials(){
  const sun = new THREE.Mesh(new THREE.SphereGeometry(12,32,16), new THREE.MeshBasicMaterial({color:0xffdd55}));
  sun.position.set(360,190,220); scene.add(sun);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(8,32,16), new THREE.MeshStandardMaterial({color:0xcccccc}));
  moon.position.set(-230,130,-270); scene.add(moon);
  for(let i=0;i<4;i++){
    const body = new THREE.Mesh(new THREE.SphereGeometry(6+i*1.7,32,16), new THREE.MeshStandardMaterial({color:[0xaa6644,0x44aa88,0x8888ff,0xaa88cc][i]}));
    body.position.set(-430+i*170,220+i*20,-430-i*80);
    body.userData = {type:'planet', name:'開拓候補惑星'+(i+1)};
    scene.add(body); celestials.push(body);
  }
}

function createStars(){
  const g = new THREE.BufferGeometry(), pts=[];
  for(let i=0;i<1800;i++){ const v = new THREE.Vector3().randomDirection().multiplyScalar(980); pts.push(v.x,v.y,v.z); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:1})));
}

function animate(){
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .033);
  updatePlayer(dt); updateNPCs(dt); updateCamera(dt);
  if(clouds) clouds.rotation.y += dt*.025;
  renderer.render(scene,camera);
}

function updatePlayer(dt){
  const up = player.position.clone().normalize();
  yaw -= lookInput.x*dt*2.5;
  pitch -= lookInput.y*dt*1.1;
  pitch = Math.max(-.85, Math.min(.6, pitch));
  const ix = (keys.d?1:0)-(keys.a?1:0)+moveInput.x;
  const iy = (keys.w?1:0)-(keys.s?1:0)-moveInput.y;
  const forward = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).projectOnPlane(up).normalize();
  const right = new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)).projectOnPlane(up).normalize();
  const mv = forward.clone().multiplyScalar(iy).add(right.clone().multiplyScalar(ix));
  if(mv.length()>.01){ player.position.add(mv.normalize().multiplyScalar(22*dt)); commandTarget=null; }
  if(commandTarget){
    const dir = commandTarget.clone().sub(player.position).projectOnPlane(up);
    if(dir.length()<.8) commandTarget=null;
    else { player.position.add(dir.normalize().multiplyScalar(18*dt)); yaw = lerpAngle(yaw,Math.atan2(dir.x,dir.z),.15); }
  }
  const d = player.position.clone().normalize();
  player.position.copy(d.multiplyScalar(surfaceRadius(d)+3));
  player.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d);
}

function updateNPCs(dt){
  for(const npc of npcs){
    const up = npc.position.clone().normalize();
    npc.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up);
    if(!npc.userData.command && Math.random()<.003){
      const wander = new THREE.Vector3().randomDirection().projectOnPlane(up).normalize();
      const t = npc.position.clone().add(wander.multiplyScalar(12)).normalize();
      npc.userData.command = t.multiplyScalar(surfaceRadius(t)+3);
    }
    if(npc.userData.command){
      const dir = npc.userData.command.clone().sub(npc.position).projectOnPlane(up);
      if(dir.length()<.7) npc.userData.command=null;
      else { npc.position.add(dir.normalize().multiplyScalar(8*dt)); const d=npc.position.clone().normalize(); npc.position.copy(d.multiplyScalar(surfaceRadius(d)+3)); }
    }
  }
}

function updateCamera(){
  const up = player.position.clone().normalize();
  const forward = new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).projectOnPlane(up).normalize();
  const label = zoom<2?'FPV':zoom<35?'TPV':zoom<120?'RTS':'PLANET';
  if(zoom<2){
    camera.position.lerp(player.position.clone().add(up.clone().multiplyScalar(2.4)), .35);
    const look = forward.clone().multiplyScalar(Math.cos(pitch)).add(up.clone().multiplyScalar(Math.sin(pitch))).normalize();
    camera.lookAt(camera.position.clone().add(look));
  } else if(zoom<35){
    const desired = player.position.clone().add(up.clone().multiplyScalar(zoom*.45+4)).add(forward.clone().multiplyScalar(-zoom));
    camera.position.lerp(desired,.24);
    camera.lookAt(player.position.clone().add(up.clone().multiplyScalar(2.3)).add(forward.clone().multiplyScalar(4)));
  } else {
    const desired = player.position.clone().add(up.clone().multiplyScalar(zoom*.55+12)).add(forward.clone().multiplyScalar(-zoom));
    camera.position.lerp(desired,.055);
    camera.lookAt(player.position);
  }
  hud.innerHTML = `PSE Static v0.1<br>Scale:${label} / 木:${wood} 石:${stone} 信仰:${faith}<br>NPC:${npcs.length} 建物:${buildings.length}<br>A:${buttonMap.A} B:${buttonMap.B} X:${buttonMap.X} Y:${buttonMap.Y}`;
}

function handleTap(x,y){
  const mouse = new THREE.Vector2(x/innerWidth*2-1, -(y/innerHeight)*2+1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(mouse,camera);
  const hitNpc = ray.intersectObjects(npcs)[0];
  if(hitNpc){ selected=hitNpc.object; talkTo(selected); return; }
  const hitRes = ray.intersectObjects(resources)[0];
  if(hitRes){ selected=hitRes.object; commandTarget=hitRes.object.position.clone(); showDialog('資源へ移動開始。近づいたらX/Aで採集。'); return; }
  const hitPlanet = ray.intersectObject(planet)[0];
  if(hitPlanet){ const d=hitPlanet.point.clone().normalize(); commandTarget=d.multiplyScalar(surfaceRadius(d)+3); }
}

function talkTo(npc){
  const m = npc.userData.mind;
  m.loyalty = Math.min(100,m.loyalty+8); m.faith = Math.min(100,m.faith+3); faith++;
  const lines = [
    `${m.name}「今日は雲の流れが速いですね。遠い星にも、いつか行ける気がします。」`,
    `${m.name}「あなたの動きを見ていました。私も少し覚えられそうです。」`,
    `${m.name}「村に家が増えると、人の声も増えますね。」`,
    `${m.name}「昨日より、この世界が少し広く見えます。」`
  ];
  showDialog(`${lines[Math.floor(Math.random()*lines.length)]}<br>性格:${m.mood} / 忠誠:${m.loyalty} 信仰:${m.faith}<br>${m.canControl()?'直接操作可能':'忠誠70以上で直接操作可能'}`);
}

function gatherNearest(){
  let near=null, dist=999;
  for(const r of resources){ const d=player.position.distanceTo(r.position); if(d<dist){dist=d; near=r;} }
  if(!near || dist>10){ showDialog('近くに採集できる資源がありません。'); return; }
  if(near.userData.type==='tree'){ wood+=20; showDialog('木材 +20'); } else { stone+=15; showDialog('石 +15'); }
  scene.remove(near); resources = resources.filter(r=>r!==near);
}

function buildHouse(){
  if(wood<40 || stone<20){ showDialog('建築資源不足：木40 石20'); return; }
  wood-=40; stone-=20;
  const up=player.position.clone().normalize();
  const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).projectOnPlane(up).normalize();
  const pos=player.position.clone().add(forward.multiplyScalar(8)).normalize(); pos.multiplyScalar(surfaceRadius(pos)+2.8);
  const house=new THREE.Group();
  const base=new THREE.Mesh(new THREE.BoxGeometry(7,4,7),new THREE.MeshStandardMaterial({color:0x9b7653}));
  const roof=new THREE.Mesh(new THREE.ConeGeometry(5.8,3,4),new THREE.MeshStandardMaterial({color:0x884433}));
  roof.position.y=3.5; roof.rotation.y=Math.PI/4; house.add(base,roof);
  house.position.copy(pos); house.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),up); house.userData={type:'house'};
  scene.add(house); buildings.push(house); showDialog('建売住宅を建築。スマホ建築なので少し割高。');
}

function press(btn){
  const a=buttonMap[btn];
  if(a==='context'){ if(selected?.userData?.type==='npc') talkTo(selected); else gatherNearest(); }
  if(a==='talk'){ const n=findNearestNPC(); n?talkTo(n):showDialog('近くに会話相手がいません。'); }
  if(a==='gather') gatherNearest();
  if(a==='build') buildHouse();
  if(a==='cancel'){ selected=null; commandTarget=null; showDialog('キャンセル'); }
  if(a==='jump') showDialog('ジャンプは次版で実装予定。');
}
function findNearestNPC(){ let near=null,dist=999; for(const n of npcs){ const d=player.position.distanceTo(n.position); if(d<dist){dist=d; near=n;} } return dist<14?near:null; }
function zoomIn(){ zoom*=.82; zoom=Math.max(.35,Math.min(260,zoom)); }
function zoomOut(){ zoom*=1.22; zoom=Math.max(.35,Math.min(260,zoom)); }
function toggleSettings(){ settingsPanel.style.display = settingsPanel.style.display==='block'?'none':'block'; }
function showDialog(text){ dialog.innerHTML=text; dialog.style.display='block'; clearTimeout(showDialog.timer); showDialog.timer=setTimeout(()=>dialog.style.display='none',3600); }
function lerpAngle(a,b,t){ const d=((b-a+Math.PI*3)%(Math.PI*2))-Math.PI; return a+d*t; }

function setupEvents(){
  addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
  addEventListener('keydown',e=>keys[e.key.toLowerCase()]=true); addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
  addEventListener('wheel',e=>{ zoom*=e.deltaY>0?1.12:.89; zoom=Math.max(.35,Math.min(260,zoom)); },{passive:true});
  addEventListener('mousemove',e=>{ if(document.pointerLockElement===renderer.domElement){ yaw-=e.movementX*.003; pitch-=e.movementY*.002; pitch=Math.max(-.85,Math.min(.6,pitch)); }});
  renderer.domElement.addEventListener('click',e=>{ if(zoom<35) renderer.domElement.requestPointerLock?.(); handleTap(e.clientX,e.clientY); });
  renderer.domElement.addEventListener('pointerdown',e=>{ if(e.pointerType==='touch') handleTap(e.clientX,e.clientY); });
  document.getElementById('zoomInBtn').onclick=zoomIn; document.getElementById('zoomOutBtn').onclick=zoomOut; document.getElementById('settingsBtn').onclick=toggleSettings; document.getElementById('buildBtn').onclick=buildHouse;
  document.querySelectorAll('[data-press]').forEach(b=>b.onclick=()=>press(b.dataset.press));
  document.querySelectorAll('[data-bind]').forEach(s=>s.onchange=()=>buttonMap[s.dataset.bind]=s.value);
}
function setupStick(id,out){
  const el=document.getElementById(id), knob=el.querySelector('.knob'); let active=false,pid=null,cx=0,cy=0;
  el.addEventListener('pointerdown',e=>{ active=true; pid=e.pointerId; el.setPointerCapture(pid); const r=el.getBoundingClientRect(); cx=r.left+r.width/2; cy=r.top+r.height/2; update(e); });
  el.addEventListener('pointermove',e=>{ if(active&&e.pointerId===pid) update(e); }); el.addEventListener('pointerup',reset); el.addEventListener('pointercancel',reset);
  function update(e){ let dx=e.clientX-cx,dy=e.clientY-cy,max=45,len=Math.hypot(dx,dy); if(len>max){dx=dx/len*max;dy=dy/len*max;} out.x=dx/max; out.y=dy/max; knob.style.transform=`translate(${dx}px,${dy}px)`; }
  function reset(){ active=false; pid=null; out.x=0; out.y=0; knob.style.transform='translate(0,0)'; }
}
