import * as THREE from 'three';
import type { Entity } from '../engine/Entity';

export type SenseType = 'vision' | 'hearing' | 'smell' | 'taste' | 'touch' | 'thermal' | 'magic' | 'radiation';

export interface Stimulus {
  type: SenseType;
  source: Entity | null;
  position: THREE.Vector3;
  strength: number;
  label: string;
}

export class Sensor {
  constructor(
    public type: SenseType,
    public range: number,
    public sensitivity: number,
    public angle = Math.PI * 2
  ) {}

  canSense(owner: Entity, stimulus: Stimulus): boolean {
    if (stimulus.type !== this.type) return false;
    const d = owner.object.position.distanceTo(stimulus.position);
    return d <= this.range && stimulus.strength / Math.max(1, d) >= this.sensitivity;
  }
}
