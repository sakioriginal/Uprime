export class Mind {
  memories: string[] = [];

  constructor(
    public name: string,
    public loyalty = 40,
    public faith = 10,
    public memory = 6
  ) {}

  remember(text: string): void {
    this.memories.unshift(text);
    this.memories = this.memories.slice(0, this.memory);
  }

  canDirectControl(): boolean {
    return this.loyalty >= 70 || this.faith >= 70;
  }
}
