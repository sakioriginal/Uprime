import * as THREE from 'three';
import type { Entity } from './Entity';

export type CommandType = 'idle' | 'move' | 'gather' | 'talk' | 'build' | 'attack' | 'follow' | 'enter' | 'launch';

export class Command {
  constructor(
    public type: CommandType,
    public targetEntity: Entity | null = null,
    public targetPosition: THREE.Vector3 | null = null
  ) {}

  clone(): Command {
    return new Command(
      this.type,
      this.targetEntity,
      this.targetPosition ? this.targetPosition.clone() : null
    );
  }
}
