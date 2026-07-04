import * as THREE from 'three';

export const PLANET_RADIUS = 90;

export function surfaceRadius(dir: THREE.Vector3): number {
  const n = dir.clone().normalize();
  const h = Math.sin(n.x * 8) * 2.4 + Math.sin(n.y * 12) * 1.5 + Math.sin(n.z * 10) * 2.0;
  const m = Math.max(0, Math.sin(n.x * 5 + n.z * 4) - 0.25) * 7;
  return PLANET_RADIUS + h + m;
}

export function createPlanet(): THREE.Mesh {
  const g = new THREE.SphereGeometry(PLANET_RADIUS, 128, 64);
  const p = g.attributes.position;

  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const n = v.clone().normalize();
    v.copy(n.multiplyScalar(surfaceRadius(n)));
    p.setXYZ(i, v.x, v.y, v.z);
  }

  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.95 }));
}
