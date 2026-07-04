import * as THREE from 'three';
import { createEntity, type Entity } from '../engine/Entity';
import { Mind } from '../ai/Mind';
import { PLANET_RADIUS } from '../world/Planet';

export function createPlayer(): Entity {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(1, 3, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xffdd66 })
  );
  mesh.position.set(0, PLANET_RADIUS + 4, 0);
  const player = createEntity('player', '主人公', mesh);
  player.mind = new Mind('主人公', 100, 100, 20);
  return player;
}
