import * as THREE from 'three';
import type { Command } from './Command';

export type EntityKind = 'player' | 'npc' | 'creature' | 'resource' | 'building' | 'planet' | 'celestial';

export interface MindLike {
  name: string;
  loyalty: number;
  faith: number;
  memory: number;
  memories: string[];
}

export interface Entity {
  id: string;
  kind: EntityKind;
  name: string;
  object: THREE.Object3D;
  command?: Command | null;
  mind?: MindLike;
  tags: Set<string>;
}

let nextId = 1;

export function createEntity(kind: EntityKind, name: string, object: THREE.Object3D): Entity {
  return {
    id: `${kind}-${nextId++}`,
    kind,
    name,
    object,
    command: null,
    tags: new Set()
  };
}
