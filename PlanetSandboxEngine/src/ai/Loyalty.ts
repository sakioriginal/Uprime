export function canDirectControl(loyalty: number, faith: number): boolean {
  return loyalty >= 70 || faith >= 70;
}
