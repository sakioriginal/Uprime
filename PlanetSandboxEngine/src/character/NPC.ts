import * as THREE from 'three';
import { createEntity, type Entity } from '../engine/Entity';
import { Mind } from '../ai/Mind';
import { surfaceRadius } from '../world/Planet';

const names = ['アオ', 'レン', 'ミナ', 'ユイ', 'タク', 'ソラ', 'リク', 'ハナ', 'ケイ', 'ナナ', 'ジン', 'レイ'];

export function createNPC(index: number): Entity {
  const d = new THREE.Vector3().randomDirection();
  if (d.y < -0.25) d.y = Math.abs(d.y);
  d.normalize();

  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.85, 2.5, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x66ccff })
  );
  mesh.position.copy(d.multiplyScalar(surfaceRadius(d) + 3));

  const name = names[index % names.length];
  const npc = createEntity('npc', name, mesh);
  npc.mind = new Mind(name, 30 + Math.floor(Math.random() * 40), Math.floor(Math.random() * 25), 3 + Math.floor(Math.random() * 6));
  return npc;
}
