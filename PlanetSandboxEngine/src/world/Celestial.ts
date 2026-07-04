import * as THREE from 'three';

export function createCelestials(scene: THREE.Scene): void {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.MeshBasicMaterial({ color: 0xffdd55 }));
  sun.position.set(360, 180, 220);
  scene.add(sun);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 16), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
  moon.position.set(-220, 130, -260);
  scene.add(moon);

  for (let i = 0; i < 4; i++) {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(6 + i * 2, 32, 16),
      new THREE.MeshStandardMaterial({ color: [0xaa6644, 0x44aa88, 0x8888ff, 0xaa88cc][i] })
    );
    body.position.set(-420 + i * 170, 220 + i * 20, -420 - i * 80);
    scene.add(body);
  }
}

export function createStars(): THREE.Points {
  const g = new THREE.BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 1600; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(900);
    pts.push(v.x, v.y, v.z);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1 }));
}
