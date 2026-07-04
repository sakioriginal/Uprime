import * as THREE from 'three';
import { PLANET_RADIUS } from './Planet';

export function createOcean(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS - 0.9, 96, 48),
    new THREE.MeshStandardMaterial({ color: 0x226cff, transparent: true, opacity: 0.42 })
  );
}
