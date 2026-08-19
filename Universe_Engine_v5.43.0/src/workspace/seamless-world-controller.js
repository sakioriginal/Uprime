import * as THREE from "three";

function smoothstep(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)}

export class SeamlessWorldController{
  constructor(state,scene,workspaceManager,planetManager,avatarManager,infiniteScale){
    this.state=state;this.scene=scene;this.workspaceManager=workspaceManager;this.planetManager=planetManager;this.avatarManager=avatarManager;this.scale=infiniteScale;this.transition=null;this.ensureState();this.syncVisibility();
  }
  ensureState(){
    this.state.seamless={mode:'workspace',workbenchActive:false,lastWorld:'workspace',returnAvatarMode:'tpv',returnPlanetNormal:[0,1,0],returnPlanetForward:[0,0,-1],transitionSeconds:.48,...(this.state.seamless||{})};
    return this.state.seamless;
  }
  _cameraSnapshot(){return{position:this.scene.camera.position.clone(),target:this.scene.controls.target.clone(),up:this.scene.camera.up.clone()}}
  _animateCamera(position,target,up=null,duration=null,onDone=null){const from=this._cameraSnapshot();this.transition={from,to:{position:position.clone(),target:target.clone(),up:(up||from.up).clone()},elapsed:0,duration:Number(duration)||this.ensureState().transitionSeconds,onDone}}
  update(dt){if(!this.transition)return;const tr=this.transition;tr.elapsed+=Math.max(0,Number(dt)||0);const t=smoothstep(tr.elapsed/Math.max(.01,tr.duration));this.scene.camera.position.lerpVectors(tr.from.position,tr.to.position,t);this.scene.controls.target.lerpVectors(tr.from.target,tr.to.target,t);this.scene.camera.up.copy(tr.from.up).lerp(tr.to.up,t).normalize();this.scene.controls.update();if(t>=1){const done=tr.onDone;this.transition=null;done?.()}}
  syncVisibility(){const s=this.ensureState(),planet=s.mode==='planet';if(this.workspaceManager?.group)this.workspaceManager.group.visible=!planet;if(this.workspaceManager?.workOriginMarker)this.workspaceManager.workOriginMarker.visible=!planet;if(this.scene.grid)this.scene.grid.visible=!planet;if(this.planetManager?.group)this.planetManager.group.visible=planet&&!!this.state.planet?.enabled;}
  enterWorkbench(){
    const s=this.ensureState();if(s.workbenchActive)return false;
    s.lastWorld=s.mode;s.returnAvatarMode=this.state.avatar?.mode||'tpv';s.returnPlanetNormal=[...(this.state.avatar?.planetNormal||[0,1,0])];s.returnPlanetForward=[...(this.state.avatar?.planetForward||[0,0,-1])];s.workbenchActive=true;s.mode='workspace';
    this.scale?.pushContext?.('workbench',{from:s.lastWorld});this.scale?.setLevel?.('mm');this.scale?.applyToScene?.();
    if(this.planetManager)this.planetManager.setEnabled(false,false);this.workspaceManager.group.visible=true;this.workspaceManager.workOriginMarker.visible=true;if(this.scene.grid)this.scene.grid.visible=true;
    const o=this.state.workspace?.workOrigin||[0,0,10],world=new THREE.Vector3(Number(o[0])||0,Number(o[2])||0,Number(o[1])||0),eye=world.clone().add(new THREE.Vector3(145,110,165));this.avatarManager?.setMode?.('orbit');
    this._animateCamera(eye,world,new THREE.Vector3(0,1,0));return true;
  }
  leaveWorkbench(){
    const s=this.ensureState();if(!s.workbenchActive)return false;s.workbenchActive=false;this.scale?.popContext?.();this.scale?.applyToScene?.();
    if(s.lastWorld==='planet'){s.mode='planet';this.state.planet.enabled=true;this.planetManager?.setEnabled?.(true,false);this.workspaceManager.group.visible=false;this.workspaceManager.workOriginMarker.visible=false;if(this.scene.grid)this.scene.grid.visible=false;this.state.avatar.planetNormal=[...s.returnPlanetNormal];this.state.avatar.planetForward=[...s.returnPlanetForward];this.state.avatar.onPlanet=true;this.avatarManager?.sync?.();this.avatarManager?.setMode?.(s.returnAvatarMode==='fpv'?'fpv':'tpv');}
    else{s.mode='workspace';this.planetManager?.setEnabled?.(false,false);this.workspaceManager.group.visible=true;this.workspaceManager.workOriginMarker.visible=true;if(this.scene.grid)this.scene.grid.visible=true;this.avatarManager?.setMode?.(s.returnAvatarMode||'tpv')}
    return true;
  }
  goOutside(mode=null){
    const s=this.ensureState();if(s.workbenchActive)this.leaveWorkbench();s.mode='planet';s.lastWorld='planet';this.scale?.setContext?.('planet');this.state.planet.enabled=true;
    this.planetManager?.setEnabled?.(true,false);this.workspaceManager.group.visible=false;this.workspaceManager.workOriginMarker.visible=false;if(this.scene.grid)this.scene.grid.visible=false;
    if(!this.state.avatar?.onPlanet)this.avatarManager?.enterPlanet?.(new THREE.Vector3(...(this.state.planet?.homeNormal||[0,1,0])));this.avatarManager?.setMode?.(mode||((this.state.avatar?.mode==='fpv')?'fpv':'tpv'));return true;
  }
  returnInterior(){const s=this.ensureState();s.mode='workspace';s.lastWorld='workspace';this.scale?.setContext?.('workspace');this.planetManager?.setEnabled?.(false,false);this.avatarManager?.leavePlanet?.();this.workspaceManager.group.visible=true;this.workspaceManager.workOriginMarker.visible=true;if(this.scene.grid)this.scene.grid.visible=true;this.avatarManager?.setMode?.('tpv');return true}
  toggleWorkbench(){return this.ensureState().workbenchActive?this.leaveWorkbench():this.enterWorkbench()}
  modeLabel(){const s=this.ensureState();return s.workbenchActive?'WORKBENCH':s.mode==='planet'?'PLANET / FPV-TPV':'INTERIOR'}
}
