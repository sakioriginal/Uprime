import type { Entity } from '../engine/Entity';
import type { Command } from '../engine/Command';

export interface Gambit {
  name: string;
  condition: (self: Entity) => boolean;
  command: Command;
}
