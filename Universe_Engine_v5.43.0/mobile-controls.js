import * as THREE from 'three';
export class MobileControls{
  constructor(state,avatar,scene,root){this.state=state;this.avatar=avatar;this.scene=scene;this.root=root;this.spacecraftFlight=null;this.move={x:0,y:0};this.look={x:0,y:0};this.active={};this.ensureState();this.installSticks();this.installMouseLook()}
  setSpacecraftFlight(manager){this.spacecraftFlight=manager;return this}
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
