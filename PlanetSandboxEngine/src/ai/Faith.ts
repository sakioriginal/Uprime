export function raiseFaith(current: number, amount = 1): number {
  return Math.min(100, current + amount);
}
