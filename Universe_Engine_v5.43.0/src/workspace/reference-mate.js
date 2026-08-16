import * as THREE from 'three';

function toDeg(r){return THREE.MathUtils.radToDeg(r)}

export class ReferenceMateController{
  constructor(state,scene,canvas,snapAssist,markers={}){
    this.state=state;this.scene=scene;this.canvas=canvas;this.snapAssist=snapAssist;
    this.sourceMarker=markers.source||null;this.targetMarker=markers.target||null;
    this.active=false;this.source=null;this.target=null;this.flip=false;this.offsetMm=0;this.keep=false;
    this.type='auto';this.value=0;this.onChange=null;
    this.ensureState();
  }
  ensureState(){if(!Array.isArray(this.state.referenceMates))this.state.referenceMates=[];return this.state.referenceMates;}
  begin(){this.active=true;this.source=null;this.target=null;this.clearMarkers();this.emit();}
  cancel(){this.active=false;this.source=null;this.target=null;this.clearMarkers();this.snapAssist?.clear?.();this.emit();}
  resetPick(){this.source=null;this.target=null;this.clearMarkers();this.emit();}
  setOptions({type,value,flip,offsetMm,keep}={}){
    if(type!==undefined)this.type=String(type||'auto');
    if(value!==undefined)this.value=Number(value)||0;
    if(flip!==undefined)this.flip=!!flip;
    if(offsetMm!==undefined)this.offsetMm=Number(offsetMm)||0;
    if(keep!==undefined)this.keep=!!keep;
    this.emit();
  }
  emit(){try{this.onChange?.(this.describe())}catch{} }
  describe(){return {active:this.active,source:this.source,target:this.target,flip:this.flip,offsetMm:this.offsetMm,keep:this.keep,type:this.type,value:this.value};}
  clearMarkers(){for(const m of [this.sourceMarker,this.targetMarker])if(m){m.classList.remove('show');m.textContent='';}}
  _show(marker,candidate,kind){
    if(!marker||!candidate)return;
    const host=this.canvas.parentElement.getBoundingClientRect();const s=candidate.screen||this.snapAssist?._screen?.(candidate);
    if(!s)return;marker.style.left=`${s.x-host.left}px`;marker.style.top=`${s.y-host.top}px`;marker.dataset.type=candidate.type;marker.dataset.kind=kind;
    marker.textContent=`${kind==='source'?'移動元':'移動先'}: ${candidate.label} · ${candidate.partName}`;marker.classList.add('show');
  }
  _pickNear(event,excludeIds=[]){const c=this.snapAssist?.pick?.(event,excludeIds)||null;if(c)this.snapAssist?.clear?.();return c;}
  handlePointerDown(event){
    if(!this.active||event.button!==0)return false;
    if(!this.source){const c=this._pickNear(event,[]);if(!c)return true;this.source={...c};this._show(this.sourceMarker,this.source,'source');const selected=this.state.selectedIds||[];this.source.moveIds=selected.includes(c.partId)&&selected.length?[...selected]:[c.partId];this.emit();return true;}
    if(!this.target){const c=this._pickNear(event,this.source.moveIds||[this.source.partId]);if(!c)return true;this.target={...c};this._show(this.targetMarker,this.target,'target');this.emit();return true;}
    return true;
  }
  handlePointerMove(event){
    if(!this.active)return false;
    if(this.source&&!this.target){const c=this._pickNear(event,this.source.moveIds||[this.source.partId]);if(c)this._show(this.targetMarker,c,'target');else if(this.targetMarker)this.targetMarker.classList.remove('show');}
    else if(!this.source){const c=this._pickNear(event,[]);if(c)this._show(this.sourceMarker,c,'source');else if(this.sourceMarker)this.sourceMarker.classList.remove('show');}
    return true;
  }
  _axisFor(c){if(c?.normalWorld?.isVector3)return c.normalWorld.clone().normalize();if(c?.directionWorld?.isVector3)return c.directionWorld.clone().normalize();return null;}
  _scaleMm(){const a=this.scene.cadPointToWorld([0,0,0]),b=this.scene.cadPointToWorld([0,0,1]);return Math.max(1e-12,a.distanceTo(b));}
  _desiredAxis(){
    const a=this._axisFor(this.source),b=this._axisFor(this.target);if(!a||!b)return null;
    const type=this.type||'auto';
    if(type==='perpendicular'){
      // Use the source's current component perpendicular to target when possible,
      // otherwise pick a stable world axis and project it to target's normal plane.
      let d=a.clone().sub(b.clone().multiplyScalar(a.dot(b)));
      if(d.lengthSq()<1e-10){d=(Math.abs(b.x)<.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).sub(b.clone().multiplyScalar((Math.abs(b.x)<.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).dot(b)));}
      return d.normalize().multiplyScalar(this.flip?-1:1);
    }
    if(type==='angle'){
      const angle=THREE.MathUtils.degToRad(Number(this.value)||0);
      let axis=new THREE.Vector3().crossVectors(a,b);
      if(axis.lengthSq()<1e-10)axis=(Math.abs(b.x)<.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).cross(b);
      axis.normalize();
      const q=new THREE.Quaternion().setFromAxisAngle(axis,angle*(this.flip?-1:1));
      return b.clone().applyQuaternion(q).normalize();
    }
    let desired=b.clone();
    if(type==='auto'&&this.source.type==='face'&&this.target.type==='face')desired.multiplyScalar(this.flip?1:-1);
    else if(this.flip)desired.multiplyScalar(-1);
    return desired;
  }
  _rotationQuaternion(){
    const a=this._axisFor(this.source),desired=this._desiredAxis();if(!a||!desired)return null;
    if(a.dot(desired)<-0.999999){const ortho=Math.abs(a.x)<.8?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);ortho.cross(a).normalize();return new THREE.Quaternion().setFromAxisAngle(ortho,Math.PI);}
    return new THREE.Quaternion().setFromUnitVectors(a,desired);
  }
  _writePartRotationFromMesh(part){const e=part.mesh.rotation;part.rotation=[toDeg(e.x),-toDeg(e.z),toDeg(e.y)];}
  _rotateMoving(moving,pivot,qDelta){
    if(!qDelta)return;
    for(const p of moving){
      p.mesh.updateMatrixWorld(true);const pos=p.mesh.getWorldPosition(new THREE.Vector3());const rel=pos.sub(pivot).applyQuaternion(qDelta);const newWorld=pivot.clone().add(rel);
      const parent=p.mesh.parent;const local=parent?parent.worldToLocal(newWorld.clone()):newWorld;p.mesh.position.copy(local);
      const qWorld=p.mesh.getWorldQuaternion(new THREE.Quaternion());qWorld.premultiply(qDelta);if(parent){const parentQ=parent.getWorldQuaternion(new THREE.Quaternion());qWorld.premultiply(parentQ.invert());}
      p.mesh.quaternion.copy(qWorld);p.mesh.updateMatrixWorld(true);p.position=this.scene.worldPointToCad(p.mesh.getWorldPosition(new THREE.Vector3()));this._writePartRotationFromMesh(p);this.scene.sync(p);
    }
  }
  apply({persist=this.keep}={}){
    if(!this.source||!this.target)return {ok:false,message:'移動元と移動先の基準を選択してください'};
    const moving=(this.source.moveIds||[this.source.partId]).map(id=>this.state.object(id)).filter(Boolean);if(!moving.length)return {ok:false,message:'移動元オブジェクトがありません'};
    const sourcePart=this.state.object(this.source.partId);if(!sourcePart?.mesh)return {ok:false,message:'移動元オブジェクトがありません'};
    const type=this.type||'auto';const beforeWorld=this.source.world.clone();const qDelta=this._rotationQuaternion();
    const rotateTypes=new Set(['auto','coaxial','parallel','perpendicular','angle']);
    if(rotateTypes.has(type)&&qDelta){
      this._rotateMoving(moving,beforeWorld,qDelta);
      const fresh=this.snapAssist.candidatesForPart(sourcePart).filter(x=>x.type===this.source.type);if(fresh.length){let best=fresh[0],d=Infinity;for(const x of fresh){const dd=x.world.distanceTo(beforeWorld);if(dd<d){d=dd;best=x;}}this.source={...this.source,...best};}
    }
    let doTranslate=!['parallel','perpendicular','angle'].includes(type);
    let target=this.target.world.clone();const axis=this._axisFor(this.target);
    const mm=this._scaleMm();
    if(type==='distance'){
      if(axis)target.add(axis.clone().multiplyScalar((Number(this.value)||0)*mm));
      else target.add(this.target.world.clone().sub(this.source.world).normalize().multiplyScalar((Number(this.value)||0)*mm));
    }
    if(axis&&Math.abs(this.offsetMm)>1e-12)target.add(axis.clone().multiplyScalar(this.offsetMm*mm));
    if(doTranslate){const sourceNow=this.source.world.clone(),deltaWorld=target.clone().sub(sourceNow);for(const p of moving){const wp=p.mesh.getWorldPosition(new THREE.Vector3()).add(deltaWorld);p.position=this.scene.worldPointToCad(wp);this.scene.sync(p);}}
    const record={id:`MATE-${Date.now().toString(36).toUpperCase()}`,type,sourcePartId:this.source.partId,targetPartId:this.target.partId,sourceType:this.source.type,targetType:this.target.type,sourceLabel:this.source.label,targetLabel:this.target.label,value:Number(this.value)||0,offsetMm:this.offsetMm,flip:this.flip,createdAt:new Date().toISOString()};
    if(persist)this.ensureState().push(record);
    this.active=false;this.clearMarkers();this.emit();return {ok:true,record,moved:moving.map(p=>p.id)};
  }
}
