import * as THREE from 'three';

export type ScaleLabel = 'FPV' | 'TPV' | 'RTS' | 'PLANET';

export class CameraRig {
  public yaw = 0;
  public pitch = -0.15;
  public scale = 14;

  constructor(private camera: THREE.PerspectiveCamera) {}

  zoomIn(): void {
    this.scale = THREE.MathUtils.clamp(this.scale * 0.82, 0.35, 260);
  }

  zoomOut(): void {
    this.scale = THREE.MathUtils.clamp(this.scale * 1.22, 0.35, 260);
  }

  get label(): ScaleLabel {
    if (this.scale < 2) return 'FPV';
    if (this.scale < 35) return 'TPV';
    if (this.scale < 120) return 'RTS';
    return 'PLANET';
  }

  update(target: THREE.Object3D, dt: number): void {
    const pos = target.position;
    const up = pos.clone().normalize();
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).projectOnPlane(up).normalize();

    if (this.scale < 2) {
      const desired = pos.clone().add(up.clone().multiplyScalar(2.4));
      this.camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
      const look = forward.clone().multiplyScalar(Math.cos(this.pitch)).add(up.clone().multiplyScalar(Math.sin(this.pitch))).normalize();
      this.camera.lookAt(this.camera.position.clone().add(look));
      return;
    }

    const follow = this.scale < 35 ? 0.22 : 0.055;
    const desired = pos.clone()
      .add(up.clone().multiplyScalar(this.scale * (this.scale < 35 ? 0.45 : 0.55) + 4))
      .add(forward.clone().multiplyScalar(-this.scale));

    this.camera.position.lerp(desired, follow);
    this.camera.lookAt(pos.clone().add(up.clone().multiplyScalar(2.2)));
  }
}
