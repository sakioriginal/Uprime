export class HUD {
  private el: HTMLDivElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    document.body.appendChild(this.el);
  }

  set(html: string): void { this.el.innerHTML = html; }
}
