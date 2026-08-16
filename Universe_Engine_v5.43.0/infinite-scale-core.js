import * as THREE from "three";

// Physical size represented by one design-scale unit.  The renderer stays in a
// numerically comfortable local band while this value can range from picometres
// to astronomical units.
const LEVELS=[
  {id:"pm",label:"pm",meters:1e-12,category:"micro"},
  {id:"nm",label:"nm",meters:1e-9,category:"micro"},
  {id:"um",label:"µm",meters:1e-6,category:"micro"},
  {id:"mm",label:"mm",meters:1e-3,category:"part"},
  {id:"cm",label:"cm",meters:1e-2,category:"part"},
  {id:"m",label:"m",meters:1,category:"human"},
  {id:"10m",label:"10 m",meters:10,category:"building"},
  {id:"100m",label:"100 m",meters:100,category:"building"},
  {id:"km",label:"km",meters:1e3,category:"terrain"},
  {id:"100km",label:"100 km",meters:1e5,category:"terrain"},
  {id:"planet",label:"Planet",meters:1e7,category:"planet"},
  {id:"solar",label:"AU / Solar",meters:1.495978707e11,category:"solar"},
  {id:"stellar",label:"ly / Stellar",meters:9.460730472e15,category:"stellar"}
];

function finite3(v,f=[0,0,0]){const a=Array.isArray(v)?v:f;return a.slice(0,3).map((n,i)=>Number.isFinite(Number(n))?Number(n):f[i]||0)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function nearestLevel(meters){let best=LEVELS[0],score=Infinity;const x=Math.log10(Math.max(1e-18,meters));for(const l of LEVELS){const s=Math.abs(Math.log10(l.meters)-x);if(s<score){score=s;best=l}}return best}

export class InfiniteScaleCore{
  constructor(state,scene,{rebaseThreshold=1e6}={}){this.state=state;this.scene=scene;this.rebaseThreshold=rebaseThreshold;this._appliedMetersPerUnit=null;this.ensureState()}
  static levels(){return LEVELS.map(x=>({...x}))}
  ensureState(){
    const s=this.state.infiniteScale=this.state.infiniteScale&&typeof this.state.infiniteScale==="object"?this.state.infiniteScale:{};
    s.level=s.level||"mm";
    const level=LEVELS.find(x=>x.id===s.level)||LEVELS[3];
    s.metersPerUnit=Number.isFinite(+s.metersPerUnit)&&+s.metersPerUnit>0?+s.metersPerUnit:level.meters;
    s.visualScale=Number.isFinite(+s.visualScale)?+s.visualScale:1;
    s.floatingOrigin=finite3(s.floatingOrigin);s.worldOffset=finite3(s.worldOffset);s.enabled=s.enabled!==false;
    s.context=s.context||"workspace";s.contextStack=Array.isArray(s.contextStack)?s.contextStack:[];
    s.portalStack=Array.isArray(s.portalStack)?s.portalStack:[];
    s.continuousZoom=s.continuousZoom!==false;s.lastScaleCategory=s.lastScaleCategory||level.category;
    return s;
  }
  currentLevel(){const s=this.ensureState();return nearestLevel(s.metersPerUnit)}
  setContext(context){const s=this.ensureState();s.context=String(context||"workspace");return s.context}
  pushContext(context,meta={}){const s=this.ensureState();s.contextStack.push({context:s.context,level:s.level,metersPerUnit:s.metersPerUnit,visualScale:s.visualScale,meta});s.context=String(context||s.context);return s.context}
  popContext(){const s=this.ensureState(),prev=s.contextStack.pop();if(prev){s.context=prev.context;s.level=prev.level;s.metersPerUnit=prev.metersPerUnit;s.visualScale=prev.visualScale}return prev||null}
  setLevel(id){const level=LEVELS.find(x=>x.id===id)||LEVELS[3],s=this.ensureState();s.level=level.id;s.metersPerUnit=level.meters;s.lastScaleCategory=level.category;return level}
  setMetersPerUnit(meters){const s=this.ensureState();s.metersPerUnit=clamp(Number(meters)||1e-3,1e-15,1e18);const n=nearestLevel(s.metersPerUnit);s.level=n.id;s.lastScaleCategory=n.category;return s.metersPerUnit}
  setVisualScale(scale){const s=this.ensureState();s.visualScale=clamp(Number(scale)||1,1e-6,1e6);return s.visualScale}
  zoomBy(factor){return this.setVisualScale(this.ensureState().visualScale*(Number(factor)||1))}
  // Positive wheel delta zooms out (larger physical scale), negative zooms in.
  zoomContinuous(wheelDelta){const s=this.ensureState();const decades=clamp(Number(wheelDelta)||0,-240,240)/720;this.setMetersPerUnit(s.metersPerUnit*Math.pow(10,decades));return this.currentLevel()}
  stepLevel(direction){const current=this.currentLevel(),i=LEVELS.findIndex(x=>x.id===current.id),next=LEVELS[clamp(i+(direction>0?1:-1),0,LEVELS.length-1)];return this.setLevel(next.id)}
  toWorldMeters(mm){return Number(mm||0)/1000}
  toLocalMm(meters){return Number(meters||0)*1000}
  universePosition(localMm){const s=this.ensureState();const p=finite3(localMm);return p.map((v,i)=>v+(s.worldOffset[i]||0)+(s.floatingOrigin[i]||0))}
  localPosition(universeMm){const s=this.ensureState();const p=finite3(universeMm);return p.map((v,i)=>v-(s.worldOffset[i]||0)-(s.floatingOrigin[i]||0))}
  maybeRebase(cameraPositionMm){const s=this.ensureState();if(!s.enabled)return false;const p=new THREE.Vector3(...finite3(cameraPositionMm));if(p.length()<this.rebaseThreshold)return false;const delta=[p.x,p.y,p.z];s.floatingOrigin=s.floatingOrigin.map((v,i)=>v+delta[i]);for(const o of this.state.objects||[]){if(Array.isArray(o.position))o.position=o.position.map((v,i)=>v-delta[i]);this.scene?.sync?.(o)}return true}
  // Creator scale is a VIEW scale, not an object-only transform.  CAD objects,
  // avatar, workbench and planet keep their physical proportions; the camera
  // moves through scale space instead of resizing only scene.root.
  sceneBandMultiplier(){const s=this.ensureState();const unitMm=Math.max(1e-12,s.metersPerUnit*1000);return clamp((1/unitMm)*s.visualScale,1e-6,1e6)}
  viewScaleFactor(meters=this.ensureState().metersPerUnit){
    const mm=Math.max(1e-12,Number(meters)||1e-3)*1000;
    // Compress the enormous pm-to-AU range into a usable camera-distance range.
    return clamp(Math.pow(mm,.46),.12,2e10);
  }
  applyToScene(){
    const s=this.ensureState(),base=Math.max(1e-12,Number(this.state.workspace?.unitScaleMm)||10);
    const workScale=Number(this.scene?.workCoordinate?.scale)||1/base;
    // Preserve the work-coordinate conversion. Do not resize CAD independently.
    if(this.scene?.root)this.scene.root.scale.setScalar(workScale);
    if(this.scene?.datumGroup)this.scene.datumGroup.scale.setScalar(workScale);
    if(this.scene?.grid)this.scene.grid.scale.setScalar(workScale);
    const current=Math.max(1e-15,s.metersPerUnit),previous=this._appliedMetersPerUnit;
    if(previous&&this.scene?.camera&&this.scene?.controls?.target){
      const ratio=clamp(this.viewScaleFactor(current)/this.viewScaleFactor(previous),.05,20);
      const target=this.scene.controls.target,off=this.scene.camera.position.clone().sub(target);
      if(off.lengthSq()>1e-12)this.scene.camera.position.copy(target).add(off.multiplyScalar(ratio));
    }
    this._appliedMetersPerUnit=current;
    if(this.scene?.camera){
      const vf=this.viewScaleFactor(current);
      this.scene.camera.near=clamp(.01/vf,1e-7,10);
      this.scene.camera.far=clamp(2e6*vf,1e5,1e16);
      this.scene.camera.updateProjectionMatrix();
      this.scene.controls?.update?.();
    }
    return workScale;
  }
  enterEntity(entity,entryScale=1){if(!entity)return null;const s=this.ensureState();s.portalStack.push({entityId:entity.id,visualScale:s.visualScale,level:s.level,metersPerUnit:s.metersPerUnit,context:s.context});s.context="entity";this.setVisualScale(entryScale);return entity}
  leaveEntity(){const s=this.ensureState();const prev=s.portalStack.pop();if(prev){s.visualScale=prev.visualScale;s.level=prev.level;s.metersPerUnit=prev.metersPerUnit;s.context=prev.context||"workspace"}return prev||null}
  describe(){const s=this.ensureState(),n=this.currentLevel();return{context:s.context,level:n.id,label:n.label,category:n.category,metersPerUnit:s.metersPerUnit,visualScale:s.visualScale}}
}
