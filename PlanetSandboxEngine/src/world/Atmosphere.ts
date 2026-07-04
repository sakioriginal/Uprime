import * as THREE from 'three';
import { PLANET_RADIUS } from './Planet';

export function createAtmosphere(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS + 9, 96, 48),
    new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.12, side: THREE.BackSide })
  );
}
