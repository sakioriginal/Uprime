import * as THREE from 'three';

export function planetUp(position: THREE.Vector3): THREE.Vector3 {
  return position.clone().normalize();
}
