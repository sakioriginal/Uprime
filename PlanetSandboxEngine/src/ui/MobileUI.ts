import type { InputState } from '../engine/Input';

export class MobileUI {
  buttonMap = { A: 'context', B: 'cancel', X: 'gather', Y: 'build' } as Record<string, string>;

  constructor(private input: InputState, private actions: Record<string, () => void>) {
    this.installStyle();
    this.createTopButtons();
    this.createStick('moveStick', this.input.move, 'left:25px');
    this.createStick('lookStick', this.input.look, 'right:25px');
    this.createPad();
  }

  private installStyle(): void {
    const style = document.createElement('style');
    style.textContent = `
      html,body{margin:0;overflow:hidden;background:#07101c;color:white;font-family:sans-serif;touch-action:none}
      #hud{position:fixed;top:10px;left:10px;background:#0009;padding:10px;border-radius:10px;z-index:10;font-size:13px;line-height:1.5;max-width:60vw}
      .top-ui{position:fixed;top:10px;right:10px;z-index:20;display:flex;gap:6px}
      button{border:0;border-radius:12px;background:#22384f;color:white;font-size:16px;padding:9px 12px}
      .stick{position:fixed;bottom:25px;width:130px;height:130px;border-radius:50%;background:#ffffff22;border:1px solid #ffffff55;z-index:20}
      .knob{position:absolute;left:38px;top:38px;width:54px;height:54px;border-radius:50%;background:#ffffff88}
      #pad{position:fixed;right:28px;bottom:165px;width:150px;height:150px;z-index:25}
      .act{position:absolute;width:54px;height:54px;border-radius:50%;background:#2d4568}
      #A{left:48px;bottom:0;background:#2f6cff}#B{right:0;top:48px}#X{left:0;top:48px}#Y{left:48px;top:0}
      #dialog{position:fixed;left:50%;bottom:170px;transform:translateX(-50%);background:#000c;padding:12px;border-radius:12px;z-index:50;display:none;max-width:80vw;white-space:pre-line}
    `;
    document.head.appendChild(style);
  }

  private createTopButtons(): void {
    const top = document.createElement('div');
    top.className = 'top-ui';
    top.innerHTML = `<button id="zoomMinus">－</button><button id="zoomPlus">＋</button><button id="buildBtn">🏠</button>`;
    document.body.appendChild(top);
    document.getElementById('zoomMinus')!.onclick = this.actions.zoomOut;
    document.getElementById('zoomPlus')!.onclick = this.actions.zoomIn;
    document.getElementById('buildBtn')!.onclick = this.actions.build;
  }

  private createPad(): void {
    const pad = document.createElement('div');
    pad.id = 'pad';
    pad.innerHTML = `<button id="Y" class="act">Y</button><button id="X" class="act">X</button><button id="B" class="act">B</button><button id="A" class="act">A</button>`;
    document.body.appendChild(pad);
    for (const k of ['A', 'B', 'X', 'Y']) {
      document.getElementById(k)!.onclick = () => this.actions[k]?.();
    }
  }

  private createStick(id: string, out: {x:number;y:number}, sideStyle: string): void {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'stick';
    el.setAttribute('style', sideStyle);
    el.innerHTML = `<div class="knob"></div>`;
    document.body.appendChild(el);
    const knob = el.querySelector('.knob') as HTMLDivElement;
    let active = false, pid: number | null = null, cx = 0, cy = 0;
    const update = (e: PointerEvent) => {
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = 45, len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      out.x = dx / max; out.y = dy / max;
      knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    const reset = () => { active = false; pid = null; out.x = 0; out.y = 0; knob.style.transform = 'translate(0,0)'; };
    el.addEventListener('pointerdown', e => { active = true; pid = e.pointerId; el.setPointerCapture(pid); const r = el.getBoundingClientRect(); cx = r.left+r.width/2; cy = r.top+r.height/2; update(e); });
    el.addEventListener('pointermove', e => { if (active && e.pointerId === pid) update(e); });
    el.addEventListener('pointerup', reset);
    el.addEventListener('pointercancel', reset);
  }
}
