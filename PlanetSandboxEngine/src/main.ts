import * as THREE from 'three';
import { CameraRig } from './engine/CameraRig';
import { InputState } from './engine/Input';
import { HUD } from './ui/HUD';
import { MobileUI } from './ui/MobileUI';
import { Command } from './engine/Command';
import { createPlanet, surfaceRadius } from './world/Planet';
import { createOcean } from './world/Ocean';
import { createAtmosphere } from './world/Atmosphere';
import { createClouds } from './world/Cloud';
import { createCelestials, createStars } from './world/Celestial';
import { createPlayer } from './character/Player';
import { createNPC } from './character/NPC';
import { talk } from './ai/Conversation';
import type { Entity } from './engine/Entity';

const app = document.getElementById('app')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101c);
scene.fog = new THREE.Fog(0x07101c, 150, 700);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x9bb0d0, 0.8));
const sunLight = new THREE.DirectionalLight(0xffffff, 2.6);
sunLight.position.set(150, 180, 100);
scene.add(sunLight);

const planet = createPlanet();
scene.add(planet);
scene.add(createOcean());
scene.add(createAtmosphere());
const clouds = createClouds();
scene.add(clouds);
createCelestials(scene);
scene.add(createStars());

const input = new InputState();
const hud = new HUD();
const rig = new CameraRig(camera);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

const player = createPlayer();
scene.add(player.object);

const npcs: Entity[] = [];
for (let i = 0; i < 12; i++) {
  const npc = createNPC(i);
  npcs.push(npc);
  scene.add(npc.object);
}

const resources: Entity[] = [];
for (let i = 0; i < 40; i++) {
  const d = new THREE.Vector3().randomDirection();
  if (d.y < -0.25) d.y = Math.abs(d.y);
  d.normalize();
  const ore = i % 5 === 0;
  const mesh = new THREE.Mesh(
    ore ? new THREE.DodecahedronGeometry(1.6) : new THREE.ConeGeometry(1.2, 4, 8),
    new THREE.MeshStandardMaterial({ color: ore ? 0x888899 : 0x145c2c })
  );
  mesh.position.copy(d.multiplyScalar(surfaceRadius(d) + 1.8));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mesh.position.clone().normalize());
  resources.push({ id: `res-${i}`, kind: 'resource', name: ore ? '鉱石' : '木', object: mesh, tags: new Set([ore ? 'ore' : 'tree']) });
  scene.add(mesh);
}

let selected: Entity | null = null;
let wood = 120;
let stone = 80;
const buildings: THREE.Group[] = [];

const dialog = document.createElement('div');
dialog.id = 'dialog';
document.body.appendChild(dialog);

new MobileUI(input, {
  zoomIn: () => rig.zoomIn(),
  zoomOut: () => rig.zoomOut(),
  build: () => buildHouse(),
  A: () => contextAction(),
  B: () => { player.command = null; showDialog('キャンセル'); },
  X: () => gatherNearest(),
  Y: () => buildHouse()
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

addEventListener('keydown', e => input.keys.add(e.key.toLowerCase()));
addEventListener('keyup', e => input.keys.delete(e.key.toLowerCase()));

addEventListener('wheel', e => {
  if (e.deltaY > 0) rig.zoomOut(); else rig.zoomIn();
}, { passive: true });

addEventListener('mousemove', e => {
  if (document.pointerLockElement === renderer.domElement) {
    rig.yaw -= e.movementX * 0.003;
    rig.pitch -= e.movementY * 0.002;
    rig.pitch = THREE.MathUtils.clamp(rig.pitch, -0.85, 0.6);
  }
});

renderer.domElement.addEventListener('click', e => {
  if (rig.scale < 35) renderer.domElement.requestPointerLock?.();
  handleTap(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') handleTap(e.clientX, e.clientY);
});

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  updatePlayer(dt);
  updateNPCs(dt);
  rig.update(player.object, dt);
  clouds.rotation.y += dt * 0.025;
  hud.set(`PSE v0.0.1<br>Scale:${rig.label}<br>木:${wood} 石:${stone}<br>NPC:${npcs.length} 建物:${buildings.length}<br>A:会話/採集 X:採集 Y/🏠:建築`);
  renderer.render(scene, camera);
}

function updatePlayer(dt: number): void {
  const up = player.object.position.clone().normalize();
  rig.yaw -= input.look.x * dt * 2.5;
  rig.pitch -= input.look.y * dt * 1.1;
  rig.pitch = THREE.MathUtils.clamp(rig.pitch, -0.85, 0.6);

  const ix = (input.keys.has('d') ? 1 : 0) - (input.keys.has('a') ? 1 : 0) + input.move.x;
  const iy = (input.keys.has('w') ? 1 : 0) - (input.keys.has('s') ? 1 : 0) - input.move.y;
  const forward = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)).projectOnPlane(up).normalize();
  const right = new THREE.Vector3(Math.cos(rig.yaw), 0, -Math.sin(rig.yaw)).projectOnPlane(up).normalize();
  const move = forward.clone().multiplyScalar(iy).add(right.clone().multiplyScalar(ix));

  if (move.length() > 0.01) {
    player.object.position.add(move.normalize().multiplyScalar(22 * dt));
    player.command = null;
  }

  if (player.command?.type === 'move' && player.command.targetPosition) {
    const dir = player.command.targetPosition.clone().sub(player.object.position).projectOnPlane(up);
    if (dir.length() < 0.8) player.command = null;
    else {
      player.object.position.add(dir.normalize().multiplyScalar(18 * dt));
      rig.yaw = lerpAngle(rig.yaw, Math.atan2(dir.x, dir.z), 0.12);
    }
  }

  const d = player.object.position.clone().normalize();
  player.object.position.copy(d.multiplyScalar(surfaceRadius(d) + 3));
  player.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
}

function updateNPCs(dt: number): void {
  for (const npc of npcs) {
    const up = npc.object.position.clone().normalize();
    npc.object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    if (!npc.command && Math.random() < 0.003) {
      const d = npc.object.position.clone().normalize();
      const wander = new THREE.Vector3().randomDirection().projectOnPlane(d).normalize();
      const target = npc.object.position.clone().add(wander.multiplyScalar(12)).normalize();
      npc.command = new Command('move', null, target.multiplyScalar(surfaceRadius(target) + 3));
    }
    if (npc.command?.type === 'move' && npc.command.targetPosition) {
      const dir = npc.command.targetPosition.clone().sub(npc.object.position).projectOnPlane(up);
      if (dir.length() < 0.7) npc.command = null;
      else {
        npc.object.position.add(dir.normalize().multiplyScalar(8 * dt));
        const nd = npc.object.position.clone().normalize();
        npc.object.position.copy(nd.multiplyScalar(surfaceRadius(nd) + 3));
      }
    }
  }
}

function handleTap(x: number, y: number): void {
  pointer.x = x / innerWidth * 2 - 1;
  pointer.y = -(y / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const npcHit = raycaster.intersectObjects(npcs.map(n => n.object))[0];
  if (npcHit) {
    selected = npcs.find(n => n.object === npcHit.object) ?? null;
    if (selected) showDialog(talk(selected));
    return;
  }

  const resHit = raycaster.intersectObjects(resources.map(r => r.object))[0];
  if (resHit) {
    selected = resources.find(r => r.object === resHit.object) ?? null;
    player.command = new Command('move', selected, resHit.object.position.clone());
    showDialog('資源へ移動開始。近づいたらXまたはAで採集。');
    return;
  }

  const ground = raycaster.intersectObject(planet)[0];
  if (ground) {
    const d = ground.point.clone().normalize();
    player.command = new Command('move', null, d.multiplyScalar(surfaceRadius(d) + 3));
  }
}

function contextAction(): void {
  const npc = nearestNPC();
  if (npc) { showDialog(talk(npc)); return; }
  gatherNearest();
}

function nearestNPC(): Entity | null {
  let best: Entity | null = null;
  let dist = Infinity;
  for (const npc of npcs) {
    const d = player.object.position.distanceTo(npc.object.position);
    if (d < dist) { dist = d; best = npc; }
  }
  return dist < 14 ? best : null;
}

function gatherNearest(): void {
  let best: Entity | null = null;
  let dist = Infinity;
  for (const r of resources) {
    const d = player.object.position.distanceTo(r.object.position);
    if (d < dist) { dist = d; best = r; }
  }
  if (!best || dist > 10) { showDialog('近くに資源がない'); return; }
  if (best.tags.has('tree')) { wood += 20; showDialog('木材 +20'); }
  else { stone += 15; showDialog('石 +15'); }
  scene.remove(best.object);
  resources.splice(resources.indexOf(best), 1);
}

function buildHouse(): void {
  if (wood < 40 || stone < 20) { showDialog('建築資源不足：木40 石20'); return; }
  wood -= 40;
  stone -= 20;

  const up = player.object.position.clone().normalize();
  const forward = new THREE.Vector3(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)).projectOnPlane(up).normalize();
  const pos = player.object.position.clone().add(forward.multiplyScalar(8)).normalize();
  pos.multiplyScalar(surfaceRadius(pos) + 2.8);

  const house = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 7), new THREE.MeshStandardMaterial({ color: 0x9b7653 }));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 3, 4), new THREE.MeshStandardMaterial({ color: 0x884433 }));
  roof.position.y = 3.5;
  roof.rotation.y = Math.PI / 4;
  house.add(base, roof);
  house.position.copy(pos);
  house.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  scene.add(house);
  buildings.push(house);
  showDialog('建売住宅を建築した。スマホ建築なので少し割高。');
}

function showDialog(text: string): void {
  dialog.textContent = text;
  dialog.style.display = 'block';
  window.clearTimeout((showDialog as unknown as { timer?: number }).timer);
  (showDialog as unknown as { timer?: number }).timer = window.setTimeout(() => { dialog.style.display = 'none'; }, 3500);
}

function lerpAngle(a: number, b: number, t: number): number {
  const d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

animate();
