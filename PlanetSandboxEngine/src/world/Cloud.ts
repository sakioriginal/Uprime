import * as THREE from 'three';
import { PLANET_RADIUS } from './Planet';

export function createClouds(): THREE.Group {
  const clouds = new THREE.Group();
  for (let i = 0; i < 30; i++) {
    const d = new THREE.Vector3().randomDirection();
    if (d.y < -0.2) d.y = Math.abs(d.y);
    const c = new THREE.Mesh(
      new THREE.SphereGeometry(2 + Math.random() * 2, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })
    );
    c.position.copy(d.normalize().multiplyScalar(PLANET_RADIUS + 10 + Math.random() * 3));
    clouds.add(c);
  }
  return clouds;
}
