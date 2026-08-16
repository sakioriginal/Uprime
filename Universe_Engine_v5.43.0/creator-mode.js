import * as THREE from "three";

const AU_MM=149597870700000;
const LY_MM=9460730472000000000;
const MIN_MM=0.001;
const MAX_MM=LY_MM;
const LOG_MIN=Math.log10(MIN_MM);
const LOG_MAX=Math.log10(MAX_MM);

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function finite(v,f=1){const n=Number(v);return Number.isFinite(n)?n:f}
function formatScaleMm(mm){
  mm=finite(mm,1);
  if(mm>=LY_MM*.01)return `${(mm/LY_MM).toPrecision(5)} ly`;
  if(mm>=AU_MM*.01)return `${(mm/AU_MM).toPrecision(5)} AU`;
  if(mm>=1e6)return `${(mm/1e6).toPrecision(5)} km`;
  if(mm>=1e3)return `${(mm/1e3).toPrecision(5)} m`;
  if(mm>=1)return `${mm.toPrecision(6)} mm`;
  if(mm>=1e-3)return `${(mm*1e3).toPrecision(5)} µm`;
  if(mm>=1e-6)return `${(mm*1e6).toPrecision(5)} nm`;
  return `${(mm*1e9).toPrecision(5)} pm`;
}
function epochMs(state){const raw=state.planet&&state.planet.calendarEpoch||'2026-01-01T00:00:00Z';const ms=Date.parse(raw);return Number.isFinite(ms)?ms:Date.UTC(2026,0,1)}
function simulatedDate(state){return new Date(epochMs(state)+(Number(state.planet&&state.planet.simTimeHours)||0)*3600000)}
function isoDateUTC(d){return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`}

export class CreatorModeController{
  constructor(state,scene,infiniteScale,root,{onChange=null,workbench=null,planet=null,avatar=null}={}){
    this.state=state;this.scene=scene;this.infiniteScale=infiniteScale;this.root=root;this.onChange=onChange;this.workbench=workbench;this.planet=planet;this.avatar=avatar;
    this.dragDial=null;this.ensureState();this.bind();this.apply();
    this.scene?.addLoopHook?.(()=>{this.applyDesignAnchor(false);if(this.ensureState().enabled&&this.scene?.grid)this.scene.grid.visible=!!this.ensureState().gridVisible;this.updateFocusMarker()});
  }
  ensureState(){
    const c=this.state.creator=this.state.creator&&typeof this.state.creator==='object'?this.state.creator:{};
    c.enabled=c.enabled===true;c.scaleMm=clamp(finite(c.scaleMm,(this.state.infiniteScale?.metersPerUnit||1e-3)*1000),MIN_MM,MAX_MM);
    c.focusMarker=c.focusMarker!==false;c.gridOpacity=clamp(finite(c.gridOpacity,.14),.03,.6);c.gridVisible=c.gridVisible!==false;
    c.panelVisible=true;c.panelCollapsed=c.panelCollapsed===true;const originModes=['view','avatar','aim','workbench','custom'];c.createOrigin=originModes.includes(c.createOrigin)?c.createOrigin:'view';c.customOrigin=Array.isArray(c.customOrigin)&&c.customOrigin.length>=3?c.customOrigin.slice(0,3).map(v=>finite(v,0)):[0,0,0];c.anchorToWorkbench=c.anchorToWorkbench!==false;c.partPlacementAssist=c.partPlacementAssist!==false;c.cameraTool=c.cameraTool==='pan'?'pan':'rotate';c.reachMm=Math.max(100,Math.min(20000,finite(c.reachMm,1200)));c.workbenchBoundedPlacement=c.workbenchBoundedPlacement!==false;
    // Persist the planet design anchor so reloads / mode changes do not silently move buildings.
    if(c.planetDesignAnchorDir&&!Array.isArray(c.planetDesignAnchorDir))c.planetDesignAnchorDir=null;
    return c;
  }
  $(id){return this.root?.querySelector?.(id)||document.querySelector(id)}
  bind(){
    const btn=this.$('#creatorModeBtn'),panel=this.$('#creatorScalePanel'),slider=this.$('#creatorScaleSlider'),input=this.$('#creatorScaleMm'),minus=this.$('#creatorScaleMinus'),plus=this.$('#creatorScalePlus'),dial=this.$('#creatorScaleDial'),focus=this.$('#focusMarkerToggle'),grid=this.$('#creatorGridToggle'),origin=this.$('#creatorOriginSelect'),originX=this.$('#creatorOriginX'),originY=this.$('#creatorOriginY'),originZ=this.$('#creatorOriginZ'),originCapture=this.$('#creatorOriginCapture'),anchor=this.$('#creatorWorkbenchAnchor'),collapse=this.$('#creatorScaleCollapse'),pan=this.$('#creatorCameraPan'),rotate=this.$('#creatorCameraRotate'),reset=this.$('#creatorCameraReset'),partAssist=this.$('#creatorPartAssist'),reach=this.$('#creatorReachMm'),benchBound=this.$('#creatorWorkbenchBounded'),timeDial=this.$('#creatorTimeDial'),calendar=this.$('#creatorCalendarDate'),dayPrev=this.$('#creatorDayPrev'),dayNext=this.$('#creatorDayNext'),reference=this.$('#creatorReferenceFrame');
    if(btn)btn.onclick=()=>this.setEnabled(!this.ensureState().enabled);
    if(slider){slider.min=LOG_MIN;slider.max=LOG_MAX;slider.step=.001;slider.oninput=()=>this.setScaleMm(Math.pow(10,finite(slider.value,0)),false);}
    if(input){input.onchange=()=>this.setScaleMm(finite(input.value,1));input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur()}};}
    if(minus)minus.onclick=()=>this.stepDecade(-1);if(plus)plus.onclick=()=>this.stepDecade(1);
    if(focus)focus.onchange=()=>{this.ensureState().focusMarker=!!focus.checked;this.updateFocusMarker(true)};
    if(grid)grid.onchange=()=>{this.ensureState().gridVisible=!!grid.checked;if(this.scene?.grid)this.scene.grid.visible=!!grid.checked};
    if(origin)origin.onchange=()=>{const c=this.ensureState();c.createOrigin=['view','avatar','aim','workbench','custom'].includes(origin.value)?origin.value:'view';this.syncUi();this.onChange?.(c)};const saveCustom=()=>{const c=this.ensureState();c.customOrigin=[finite(originX?.value,0),finite(originY?.value,0),finite(originZ?.value,0)];c.createOrigin='custom';this.syncUi();this.onChange?.(c)};[originX,originY,originZ].forEach(el=>{if(el)el.onchange=saveCustom});if(originCapture)originCapture.onclick=()=>{const c=this.ensureState(),p=this._aimPositionCad()||this.scene?.worldPointToCad?.(this.scene?.controls?.target)||[0,0,0];c.customOrigin=[...p];c.createOrigin='custom';this.syncUi();this.onChange?.(c)};
    if(anchor)anchor.onchange=()=>{this.ensureState().anchorToWorkbench=!!anchor.checked;this.applyDesignAnchor(true);this.onChange?.(this.ensureState())};
    if(collapse)collapse.onclick=()=>{const c=this.ensureState();c.panelCollapsed=!c.panelCollapsed;this.syncUi()};
    if(pan)pan.onclick=()=>{const c=this.ensureState();c.cameraTool='pan';this.scene?.setPanMode?.(true);this.syncUi()};
    if(rotate)rotate.onclick=()=>{const c=this.ensureState();c.cameraTool='rotate';this.scene?.setPanMode?.(false);this.syncUi()};
    if(reset)reset.onclick=()=>this.resetCamera();
    if(partAssist)partAssist.onchange=()=>{this.ensureState().partPlacementAssist=!!partAssist.checked;this.onChange?.(this.ensureState())};
    if(reach){reach.onchange=()=>{this.ensureState().reachMm=Math.max(100,Math.min(20000,finite(reach.value,1200)));this.syncUi();this.onChange?.(this.ensureState())};reach.onkeydown=e=>{if(e.key==='Enter')reach.blur()}}
    if(benchBound)benchBound.onchange=()=>{this.ensureState().workbenchBoundedPlacement=!!benchBound.checked;this.onChange?.(this.ensureState())};
    const wheelTarget=e=>{if(!this.ensureState().enabled)return;e.preventDefault();const factor=Math.pow(10,(e.deltaY>0?1:-1)*.1);this.setScaleMm(this.ensureState().scaleMm*factor)};
    panel?.addEventListener('wheel',wheelTarget,{passive:false});
    dial?.addEventListener('wheel',wheelTarget,{passive:false});
    const pointerAngle=(el,e)=>{const r=el.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;return Math.atan2(e.clientY-cy,e.clientX-cx);};
    const wrapDelta=d=>{while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;};
    dial?.addEventListener('pointerdown',e=>{
      const a=pointerAngle(dial,e);
      this.dragDial={id:e.pointerId,lastAngle:a,logValue:Math.log10(this.ensureState().scaleMm)};
      dial.setPointerCapture?.(e.pointerId);e.preventDefault();
    });
    dial?.addEventListener('pointermove',e=>{
      if(!this.dragDial||this.dragDial.id!==e.pointerId)return;
      const a=pointerAngle(dial,e),delta=wrapDelta(a-this.dragDial.lastAngle);
      this.dragDial.lastAngle=a;
      // One complete rotary turn = one decade (x10 / x0.1).
      this.dragDial.logValue+=delta/(Math.PI*2);
      this.setScaleMm(Math.pow(10,this.dragDial.logValue),false);e.preventDefault();
    });

    timeDial?.addEventListener('pointerdown',e=>{const a=pointerAngle(timeDial,e);this.dragTimeDial={id:e.pointerId,lastAngle:a};timeDial.setPointerCapture?.(e.pointerId);e.preventDefault()});
    timeDial?.addEventListener('pointermove',e=>{if(!this.dragTimeDial||this.dragTimeDial.id!==e.pointerId)return;const a=pointerAngle(timeDial,e),delta=wrapDelta(a-this.dragTimeDial.lastAngle);this.dragTimeDial.lastAngle=a;this.planet?.addSimHours?.(delta/(Math.PI*2)*24);this.syncUi();e.preventDefault()});
    const endTime=e=>{if(this.dragTimeDial?.id===e.pointerId)this.dragTimeDial=null};timeDial?.addEventListener('pointerup',endTime);timeDial?.addEventListener('pointercancel',endTime);
    if(calendar)calendar.addEventListener('change',()=>{const d=Date.parse(calendar.value+'T00:00:00Z');if(!Number.isFinite(d))return;const current=simulatedDate(this.state),tod=(current.getUTCHours()+current.getUTCMinutes()/60+current.getUTCSeconds()/3600);this.planet?.setSimTimeHours?.((d-epochMs(this.state))/3600000+tod);this.syncUi()});
    if(dayPrev)dayPrev.addEventListener('click',()=>{this.planet?.addSimHours?.(-24);this.syncUi()});
    if(dayNext)dayNext.addEventListener('click',()=>{this.planet?.addSimHours?.(24);this.syncUi()});if(reference)reference.addEventListener('click',()=>{this.planet?.toggleReferenceFrame?.();this.syncUi()});
    const end=e=>{if(this.dragDial?.id===e.pointerId){this.dragDial=null;this.onChange?.(this.ensureState())}};
    dial?.addEventListener('pointerup',end);dial?.addEventListener('pointercancel',end);
  }
  setEnabled(enabled){const c=this.ensureState();c.enabled=!!enabled;this.applyDesignAnchor(true);this.apply();return c.enabled}
  setAnchorToWorkbench(enabled){this.ensureState().anchorToWorkbench=!!enabled;this.applyDesignAnchor(true);this.syncUi();return this.ensureState().anchorToWorkbench}
  applyDesignAnchor(force=false){
    const c=this.ensureState();if(!c.anchorToWorkbench)return false;

    // IMPORTANT: the work-coordinate frame is the parent transform of CAD/building
    // objects. Recomputing it from the avatar every frame makes already-created
    // buildings appear to follow the player. Anchor the frame once and keep it
    // fixed until an explicit re-anchor is requested.
    if(this._designAnchorLocked&&!force)return true;

    let frame=null;
    const wb=this.workbench&&this.workbench.active?this.workbench.active():null;
    if(wb&&this.workbench&&this.workbench.designFrame){
      frame=this.workbench.designFrame(wb);
    }

    // With no deployed workbench, capture the current planet tangent frame ONCE.
    // Moving the avatar afterwards must never move the CAD/building root.
    if(!frame&&this.planet&&this.state.avatar&&this.state.avatar.onPlanet){
      // Use the saved anchor direction when it exists. The avatar normal is only
      // sampled the first time (or after an explicit re-anchor).
      let dir=Array.isArray(c.planetDesignAnchorDir)?new THREE.Vector3(...c.planetDesignAnchorDir):null;
      if(!dir||dir.lengthSq()<.5){
        dir=new THREE.Vector3(...(this.state.avatar.planetNormal||[0,1,0])).normalize();
        c.planetDesignAnchorDir=dir.toArray();
      }else dir.normalize();
      const surface=this.planet.surfaceFrame(dir);
      frame={originWorld:surface.point.clone(),quaternion:surface.quaternion.clone(),up:surface.normal.clone(),ground:true};
      this.state.workspace.groundBaseCadZ=0;
      this.state.workspace.baseReference='planet-ground';
    }

    if(!frame)return false;
    const p=frame.originWorld,q=frame.quaternion;
    this.scene?.setWorkCoordinateFrame?.({originWorld:p,quaternion:q,unitScaleMm:Number(this.state.workspace?.unitScaleMm)||10});
    this.infiniteScale?.applyToScene?.();
    this._lastAnchor={x:p.x,y:p.y,z:p.z,qx:q.x,qy:q.y,qz:q.z,qw:q.w,source:wb?wb.id:'planet-ground'};
    this._designAnchorLocked=true;
    return true;
  }

  reanchorDesignSpace(){
    // Explicit operation: the current avatar location becomes the new planet anchor.
    const c=this.ensureState();
    if(this.state.avatar?.onPlanet)c.planetDesignAnchorDir=[...(this.state.avatar.planetNormal||[0,1,0])];
    this._designAnchorLocked=false;
    return this.applyDesignAnchor(true);
  }
  _cameraRay(){
    const camera=this.scene?.camera;if(!camera)return null;const origin=camera.position.clone(),direction=new THREE.Vector3();camera.getWorldDirection(direction);return{origin,direction:direction.normalize()}
  }
  _workbenchRayPosition(wb){
    if(!wb||!this.workbench?.designFrame)return null;const frame=this.workbench.designFrame(wb),ray=this._cameraRay();if(!frame||!ray)return null;
    const denom=ray.direction.dot(frame.up);if(Math.abs(denom)<1e-6)return[0,0,0];const t=frame.originWorld.clone().sub(ray.origin).dot(frame.up)/denom;if(t<=0)return[0,0,0];
    const hit=ray.origin.clone().add(ray.direction.clone().multiplyScalar(t)),cad=this.scene.worldPointToCad(hit),c=this.ensureState();
    if(c.workbenchBoundedPlacement!==false){const d=wb.dimensions||this.workbench.dimensions?.()||{width:170,depth:170},mmPerUnit=Math.max(1e-9,Number(this.state.workspace?.unitScaleMm)||10),halfW=Number(d.width||170)*mmPerUnit*.5,halfD=Number(d.depth||170)*mmPerUnit*.5;cad[0]=clamp(cad[0],-halfW,halfW);cad[1]=clamp(cad[1],-halfD,halfD)}
    cad[2]=0;return cad;
  }
  _reachSpherePosition(){
    const ray=this._cameraRay(),avatar=this.avatar?.root||this.avatar?.group;if(!ray||!avatar)return null;const center=new THREE.Vector3();avatar.getWorldPosition?.(center);
    const unitMm=Math.max(1e-9,Number(this.state.workspace?.unitScaleMm)||10),r=this.ensureState().reachMm/unitMm,oc=ray.origin.clone().sub(center),b=oc.dot(ray.direction),c=oc.lengthSq()-r*r,disc=b*b-c;
    if(disc<0)return null;const root=Math.sqrt(disc),t0=-b-root,t1=-b+root,t=t0>0?t0:t1>0?t1:null;if(t===null)return null;return this.scene.worldPointToCad(ray.origin.clone().add(ray.direction.clone().multiplyScalar(t)));
  }

  _avatarFrontPosition(){
    const avatar=this.avatar?.root||this.avatar?.group;if(!avatar)return null;const center=new THREE.Vector3();avatar.getWorldPosition?.(center);let forward=new THREE.Vector3(0,0,-1);if(this.state.avatar?.onPlanet&&this.avatar?._planetFrame){try{forward=this.avatar._planetFrame().f.clone()}catch{avatar.getWorldDirection?.(forward)}}else avatar.getWorldDirection?.(forward);const unitMm=Math.max(1e-9,Number(this.state.workspace?.unitScaleMm)||10),dist=this.ensureState().reachMm/unitMm,world=center.add(forward.normalize().multiplyScalar(dist));let cad=this.scene.worldPointToCad(world);if(this.planet&&this.state.avatar?.onPlanet)cad=this.planet.groundCadPoint?.(this.scene,cad)||cad;return cad;
  }
  _aimPositionCad(){
    if(this.planet&&this.state.avatar?.onPlanet){const hit=this.planet.raycastSurfaceFromCamera?.(this.scene);if(hit)return this.scene.worldPointToCad(hit)}
    const ray=this._cameraRay();if(!ray)return null;const target=this.scene?.controls?.target;if(target){const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0),target),hit=new THREE.Vector3();if(ray.direction.dot(plane.normal)!==0&&new THREE.Ray(ray.origin,ray.direction).intersectPlane(plane,hit))return this.scene.worldPointToCad(hit)}
    return this._reachSpherePosition();
  }
  creationPositionCad(){
    const c=this.ensureState();this.applyDesignAnchor(false);const wb=this.workbench?.active?.();
    // While a workbench is deployed, modeling is intentionally contained on its top plane.
    if(wb&&c.anchorToWorkbench){const p=this._workbenchRayPosition(wb);if(p){c.lastCreatePosition=[...p];return p}}
    if(c.createOrigin==='workbench')return[0,0,0];
    if(c.createOrigin==='custom'){c.lastCreatePosition=[...c.customOrigin];return[...c.customOrigin]}
    if(c.createOrigin==='avatar'){const p=this._avatarFrontPosition();if(p){c.lastCreatePosition=[...p];return p}}
    if(c.createOrigin==='aim'){const p=this._aimPositionCad();if(p){c.lastCreatePosition=[...p];return p}}
    // Planet surface is authoritative for world generation. Intersect the ACTUAL rendered terrain
    // before using the old reach sphere. This removes camera/anchor dependent height drift.
    if(this.planet&&this.state.avatar?.onPlanet){const hit=this.planet.raycastSurfaceFromCamera?.(this.scene);if(hit){const cad=this.scene.worldPointToCad(hit);c.lastCreatePosition=[...cad];return cad}}
    // World/FPV/TPV fallback uses the camera centre ray intersecting a configurable reach sphere.
    const reach=this._reachSpherePosition();if(reach){if(this.planet&&this.state.avatar?.onPlanet){const grounded=this.planet.groundCadPoint?.(this.scene,reach)||reach;c.lastCreatePosition=[...grounded];return grounded}c.lastCreatePosition=[...reach];return reach}
    const target=this.scene?.controls?.target;if(target){const cad=this.scene.worldPointToCad(target);c.lastCreatePosition=[...cad];return cad}
    return[0,0,Number(this.state.workspace?.groundBaseCadZ)||0];
  }
  setScaleMm(mm,commit=true){const c=this.ensureState();c.scaleMm=clamp(finite(mm,c.scaleMm),MIN_MM,MAX_MM);this.infiniteScale?.setMetersPerUnit?.(c.scaleMm/1000);const stellar=c.scaleMm>=LY_MM*.04,solar=!stellar&&c.scaleMm>=AU_MM*.35;this.planet?.setScaleOverview?.(stellar?'stellar':solar?'solar':'surface',{camera:this.scene?.camera,controls:this.scene?.controls});if(!solar&&!stellar)this.infiniteScale?.applyToScene?.();this.syncUi();if(commit)this.onChange?.(c);return c.scaleMm}
  stepDecade(direction){return this.setScaleMm(this.ensureState().scaleMm*Math.pow(10,direction>0?1:-1))}
  syncUi(){
    const c=this.ensureState(),btn=this.$('#creatorModeBtn'),panel=this.$('#creatorScalePanel'),slider=this.$('#creatorScaleSlider'),input=this.$('#creatorScaleMm'),readout=this.$('#creatorScaleReadout'),dial=this.$('#creatorScaleDial'),dialReadout=this.$('#creatorDialReadout'),focus=this.$('#focusMarkerToggle'),grid=this.$('#creatorGridToggle'),origin=this.$('#creatorOriginSelect'),originX=this.$('#creatorOriginX'),originY=this.$('#creatorOriginY'),originZ=this.$('#creatorOriginZ'),anchor=this.$('#creatorWorkbenchAnchor'),collapse=this.$('#creatorScaleCollapse'),pan=this.$('#creatorCameraPan'),rotate=this.$('#creatorCameraRotate'),partAssist=this.$('#creatorPartAssist'),reach=this.$('#creatorReachMm'),benchBound=this.$('#creatorWorkbenchBounded'),timeDial=this.$('#creatorTimeDial'),timeReadout=this.$('#creatorTimeReadout'),calendar=this.$('#creatorCalendarDate'),calendarReadout=this.$('#creatorCalendarReadout'),reference=this.$('#creatorReferenceFrame'),referenceLabel=this.$('#creatorReferenceLabel');
    btn?.classList.toggle('active',c.enabled);if(btn)btn.setAttribute('aria-pressed',String(c.enabled));panel?.classList.toggle('show',c.panelVisible);panel?.classList.toggle('collapsed',c.panelCollapsed);if(collapse)collapse.textContent=c.panelCollapsed?'▾':'▴';pan?.classList.toggle('active',c.cameraTool==='pan');rotate?.classList.toggle('active',c.cameraTool==='rotate');
    if(slider)slider.value=String(Math.log10(c.scaleMm));if(input&&document.activeElement!==input)input.value=String(Number(c.scaleMm.toPrecision(12)));if(readout)readout.textContent=formatScaleMm(c.scaleMm);
    if(dial){const turns=Math.log10(c.scaleMm/MIN_MM);const angle=((turns%1)+1)%1*360;dial.style.setProperty('--dial-angle',`${angle}deg`)}if(dialReadout)dialReadout.textContent=formatScaleMm(c.scaleMm)
    if(focus)focus.checked=!!c.focusMarker;if(grid)grid.checked=!!c.gridVisible;if(origin)origin.value=c.createOrigin;const co=c.customOrigin||[0,0,0];if(originX&&document.activeElement!==originX)originX.value=String(Number(co[0]||0).toFixed(3));if(originY&&document.activeElement!==originY)originY.value=String(Number(co[1]||0).toFixed(3));if(originZ&&document.activeElement!==originZ)originZ.value=String(Number(co[2]||0).toFixed(3));if(anchor)anchor.checked=!!c.anchorToWorkbench;if(partAssist)partAssist.checked=!!c.partPlacementAssist;if(reach&&document.activeElement!==reach)reach.value=String(Math.round(c.reachMm));if(benchBound)benchBound.checked=c.workbenchBoundedPlacement!==false;const h=Number(this.state.planet?.simTimeHours)||0,d=simulatedDate(this.state),hh=((h%24)+24)%24;if(timeDial)timeDial.style.setProperty('--dial-angle',`${hh/24*360}deg`);if(timeReadout)timeReadout.textContent=`${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;if(calendar&&document.activeElement!==calendar)calendar.value=isoDateUTC(d);if(calendarReadout)calendarReadout.textContent=d.toLocaleDateString('ja-JP',{timeZone:'UTC',year:'numeric',month:'short',day:'numeric',weekday:'short'});const rf=this.state.planet?.referenceFrame||'avatar';reference?.classList.toggle('active',rf==='stellar');if(referenceLabel)referenceLabel.textContent=rf==='stellar'?'恒星基準':'アバター基準';
  }
  apply(){const c=this.ensureState();this.setScaleMm(c.scaleMm,false);this.applyDesignAnchor(true);this.scene?.setGridAppearance?.(c.gridOpacity,c.gridVisible);this.syncUi();this.updateFocusMarker(true)}
  updateFocusMarker(force=false){
    const c=this.ensureState(),marker=this.$('#cameraFocusMarker');if(!marker)return;
    marker.classList.toggle('show',!!c.focusMarker&&(c.enabled||this.scene?.panMode));if(!marker.classList.contains('show')&&!force)return;
    const target=this.scene?.controls?.target;if(!target||!this.scene?.camera||!this.scene?.canvas)return;
    const p=target.clone().project(this.scene.camera),rect=this.scene.canvas.getBoundingClientRect();
    const x=(p.x*.5+.5)*rect.width,y=(-p.y*.5+.5)*rect.height;marker.style.left=`${x}px`;marker.style.top=`${y}px`;
  }
  resetCamera(){const target=this.scene?.controls?.target;if(!target||!this.scene?.camera)return false;const frame=this.workbench?.designFrame?.();if(frame){const up=frame.up||new THREE.Vector3(0,1,0),forward=new THREE.Vector3(0,0,-1).applyQuaternion(frame.quaternion||new THREE.Quaternion()).projectOnPlane(up).normalize();this.scene.controls.target.copy(frame.originWorld);this.scene.camera.position.copy(frame.originWorld).add(up.clone().multiplyScalar(180)).add(forward.clone().multiplyScalar(-260));}else{const avatar=this.avatar?.root||this.avatar?.group;if(avatar){const p=new THREE.Vector3();avatar.getWorldPosition?.(p);this.scene.controls.target.copy(p);this.scene.camera.position.copy(p).add(new THREE.Vector3(160,110,180));}else this.scene.camera.position.set(150,120,170);}this.scene.controls.update?.();return true}
  describe(){const c=this.ensureState();return{...c,label:formatScaleMm(c.scaleMm)}}
}

export {AU_MM,LY_MM,MIN_MM,MAX_MM,formatScaleMm};
