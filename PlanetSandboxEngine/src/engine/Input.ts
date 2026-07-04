export interface StickInput { x: number; y: number }

export class InputState {
  keys = new Set<string>();
  move: StickInput = { x: 0, y: 0 };
  look: StickInput = { x: 0, y: 0 };
}
