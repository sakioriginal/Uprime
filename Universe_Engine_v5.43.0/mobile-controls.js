import * as THREE from 'three';
export class MobileControls{
  constructor(state,avatar,scene,root){this.state=state;this.avatar=avatar;this.scene=scene;this.root=root;this.spacecraftFlight=null;this.move={x:0,y:0};this.look={x:0,y:0};this.active={};this.ensureState();this.installSticks();this.installMouseLook();this.installMobileLayout();this.installConsolePanel()}
  setSpacecraftFlight(manager){this.spacecraftFlight=manager;return this}

  installMobileLayout(){
    const isLandscape=()=>{
      const angle=Number(screen?.orientation?.angle);
      const byAngle=Number.isFinite(angle)&&(Math.abs(angle)%180===90);
      const vv=window.visualViewport;
      const w=vv?.width||window.innerWidth,h=vv?.height||window.innerHeight;
      return byAngle||w>h;
    };
    const update=()=>{
      const coarse=matchMedia?.('(pointer: coarse)')?.matches??false,land=isLandscape(),active=!!(coarse&&land);
      document.body.classList.toggle('mobileLandscapeGame',active);
      document.documentElement.style.setProperty('--mobile-vw',`${window.visualViewport?.width||innerWidth}px`);
      document.documentElement.style.setProperty('--mobile-vh',`${window.visualViewport?.height||innerHeight}px`);
      if(active){
        const dial=document.querySelector('#universalDialOverlay');
        if(dial&&!dial.dataset.mobileCollapsed){dial.classList.add('collapsed');dial.dataset.mobileCollapsed='1'}
        if(!document.body.dataset.mobileConsoleInit){document.body.classList.remove('consoleMobileOpen');document.body.dataset.mobileConsoleInit='1'}
      }
    };
    update();
    window.addEventListener('resize',update,{passive:true});
    window.visualViewport?.addEventListener?.('resize',update,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(update,80),{passive:true});
    screen?.orientation?.addEventListener?.('change',()=>setTimeout(update,40));
  }
  installConsolePanel(){
    const panel=document.querySelector('#consolePanel'),toggle=document.querySelector('#consoleToggle'),handle=document.querySelector('#consoleResizeHandle');
    if(!panel||!toggle)return;
    let desktopHeight=Math.max(72,Number(localStorage.getItem('ue.consoleHeight'))||104);
    let mobileHeight=Math.max(88,Number(localStorage.getItem('ue.mobileConsoleHeight'))||128);
    document.documentElement.style.setProperty('--console-height',`${desktopHeight}px`);
    document.documentElement.style.setProperty('--mobile-console-height',`${mobileHeight}px`);
    const sync=()=>{
      const mobile=document.body.classList.contains('mobileLandscapeGame');
      const collapsed=mobile?!document.body.classList.contains('consoleMobileOpen'):document.body.classList.contains('consoleCollapsed');
      toggle.textContent=collapsed?'⇧':'⇩';
      toggle.title=collapsed?'Consoleを復帰':'Consoleを折り畳む';
    };
    toggle.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      if(document.body.classList.contains('mobileLandscapeGame'))document.body.classList.toggle('consoleMobileOpen');
      else document.body.classList.toggle('consoleCollapsed');
      sync();setTimeout(()=>window.dispatchEvent(new Event('resize')),20);
    });
    let pid=null,startY=0,startH=0;
    const move=e=>{
      if(pid!==e.pointerId)return;
      const mobile=document.body.classList.contains('mobileLandscapeGame');
      const max=Math.max(100,(window.visualViewport?.height||innerHeight)*.46);
      const h=Math.max(mobile?88:54,Math.min(max,startH+(startY-e.clientY)));
      if(mobile){mobileHeight=h;document.documentElement.style.setProperty('--mobile-console-height',`${h}px`)}
      else{desktopHeight=h;document.documentElement.style.setProperty('--console-height',`${h}px`)}
      e.preventDefault();window.dispatchEvent(new Event('resize'));
    };
    handle?.addEventListener('pointerdown',e=>{pid=e.pointerId;startY=e.clientY;startH=document.body.classList.contains('mobileLandscapeGame')?mobileHeight:desktopHeight;handle.setPointerCapture?.(pid);handle.classList.add('dragging');e.preventDefault()});
    handle?.addEventListener('pointermove',move);
    const end=e=>{if(pid!==e.pointerId)return;pid=null;handle?.classList.remove('dragging');localStorage.setItem('ue.consoleHeight',String(Math.round(desktopHeight)));localStorage.setItem('ue.mobileConsoleHeight',String(Math.round(mobileHeight)))};
    handle?.addEventListener('pointerup',end);handle?.addEventListener('pointercancel',end);
    new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});sync();
  }
  ensureState(){this.state.controls={leftStick:true,rightStick:true,mouseLook:'drag',lookSensitivity:.13,stickSensitivity:.52,stickDeadzone:.22,stickCurve:2.15,rightStickSensitivity:.78,avatarTurnRate:95,movementReference:'avatar',...(this.state.controls||{})};this.state.avatar.pitch=Number(this.state.avatar.pitch)||0}
  bindStick(el,kind){if(!el)return;const knob=el.querySelector('.stickKnob');let pid=null;const reset=()=>{pid=null;this[kind].x=0;this[kind].y=0;knob.style.transform='translate(-50%,-50%)'};const move=e=>{if(pid!==e.pointerId)return;const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.34,len=Math.hypot(dx,dy)||1,scale=Math.min(1,max/len),x=dx*scale/max,y=dy*scale/max;this[kind].x=x;this[kind].y=y;knob.style.transform=`translate(calc(-50% + ${x*max}px),calc(-50% + ${y*max}px))`;e.preventDefault()};el.addEventListener('pointerdown',e=>{pid=e.pointerId;el.setPointerCapture?.(pid);move(e)});el.addEventListener('pointermove',move);el.addEventListener('pointerup',reset);el.addEventListener('pointercancel',reset)}
  installSticks(){this.bindStick(this.root?.querySelector?.('#leftStick'),'move');this.bindStick(this.root?.querySelector?.('#rightStick'),'look')}
  installMouseLook(){const canvas=this.scene?.canvas;if(!canvas)return;let mode=null,lastX=0,lastY=0;canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button!==1&&e.button!==2)return;mode=e.button===1?'pan':'rotate';lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopPropagation()});window.addEventListener('pointermove',e=>{if(!mode)return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;if(mode==='rotate'){this.applyLook(dx*(this.state.controls.lookSensitivity||.16),dy*(this.state.controls.lookSensitivity||.16));return}const cam=this.scene.camera,ctl=this.scene.controls;if(!cam||!ctl)return;const dist=Math.max(.01,cam.position.distanceTo(ctl.target)),right=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld,1),shift=right.multiplyScalar(-dx*dist/700).add(up.multiplyScalar(dy*dist/700));cam.position.add(shift);ctl.target.add(shift);ctl.update?.()});window.addEventListener('pointerup',e=>{if((e.button===1&&mode==='pan')||(e.button===2&&mode==='rotate'))mode=null})}
  applyLook(dx,dy){const c=this.spacecraftFlight?.active?.();if(c&&c.pilot&&!c.walkMode){this.spacecraftFlight.applyCameraOrbitDelta?.(dx,dy);return}this.avatar?.applyViewDelta?.(dx,dy)}
  _curve(v){const c=this.state.controls||{},dead=Math.max(0,Math.min(.6,Number(c.stickDeadzone)||.18)),a=Math.abs(v);if(a<=dead)return 0;const n=(a-dead)/(1-dead),expo=Math.max(1,Number(c.stickCurve)||1.7),gain=Math.max(.1,Number(c.stickSensitivity)||.62);return Math.sign(v)*Math.pow(n,expo)*gain}
  update(dt){const m=this.move,l=this.look,dead=.10,lookGain=Math.max(.2,Number(this.state.controls?.rightStickSensitivity)||.78),craft=this.spacecraftFlight?.active?.();
    if(craft&&craft.pilot&&!craft.walkMode){
      const yaw=this._curve(m.x),pitch=-this._curve(m.y);this.spacecraftFlight.setControlInput?.(yaw,pitch,0);
      if(Math.abs(l.x)>dead||Math.abs(l.y)>dead)this.spacecraftFlight.applyCameraOrbitDelta?.(l.x*55*dt*lookGain,l.y*45*dt*lookGain);
      this.avatar?.setAnalogMove?.(0,0);return;
    }
    if(Math.abs(l.x)>dead||Math.abs(l.y)>dead)this.applyLook(l.x*78*dt*lookGain,l.y*66*dt*lookGain);
    if(this.avatar?.isControlMode?.())this.avatar.setAnalogMove?.(this._curve(m.x),this._curve(m.y));
    else this.avatar?.setAnalogMove?.(0,0);
  }
}
