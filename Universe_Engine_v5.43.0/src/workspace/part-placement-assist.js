import * as THREE from 'three';

function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function decadeSnap(scaleMm){const s=Math.max(.001,num(scaleMm,1));const p=Math.pow(10,Math.floor(Math.log10(s)));return Math.max(.001,p)}

export class PartPlacementAssist{
  constructor(state,scene,canvas,addPart,removePart,onChange=null){
    this.state=state;this.scene=scene;this.canvas=canvas;this.addPart=addPart;this.removePart=removePart;this.onChange=onChange;
    this.ghost=null;this.kind=null;this._move=e=>this.pointerMove(e);this._down=e=>this.pointerDown(e);
    canvas.addEventListener('pointermove',this._move,true);canvas.addEventListener('pointerdown',this._down,true);
    this.ensureState();
  }
  ensureState(){const c=this.state.creator||(this.state.creator={});if(c.partPlacementAssist===undefined)c.partPlacementAssist=true;if(c.partSnapMm===undefined)c.partSnapMm=0;return c}
  enabled(){return this.ensureState().partPlacementAssist!==false}
  begin(kind,data={}){
    if(!this.enabled())return this.addPart(kind,data,true);
    this.cancel();this.kind=kind;
    const merged={...data,opacity:.28,physics:{enabled:false,bodyType:'static',mass:1},components:{...(data.components||{}),placementGhost:{enabled:true}}};
    this.ghost=this.addPart(kind,merged,false);this.ghost._placementOriginalOpacity=data.opacity===undefined?1:Number(data.opacity);this.style(0x58d5ff,.28);this.canvas.style.cursor='crosshair';this.onChange?.('begin',this.ghost);return this.ghost;
  }
  active(){return !!this.ghost}
  style(color,opacity){const g=this.ghost;if(!g)return;g.opacity=opacity;if(g.mesh&&g.mesh.material){g.mesh.material.transparent=true;g.mesh.material.opacity=opacity;g.mesh.material.depthWrite=false;if(g.mesh.material.color&&g.mesh.material.color.set)g.mesh.material.color.set(color)}}
  pointerWorld(event){
    this.scene.updatePointer(event);const targets=[];
    for(const s of this.scene.workspacePlacementSurfaces||[])if(s)targets.push(s);
    for(const o of this.state.objects||[]){if(o===this.ghost||o.visible===false)continue;if(o.mesh)targets.push(o.mesh)}
    const hit=this.scene.raycaster.intersectObjects(targets,true)[0];if(hit)return hit.point.clone();
    const base=this.scene.cadPointToWorld([0,0,0]),up=this.scene.cadPointToWorld([0,0,1]).sub(base).normalize(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(up,base),out=new THREE.Vector3();
    return this.scene.raycaster.ray.intersectPlane(plane,out)?out:null;
  }
  snap(cad){const c=this.ensureState(),step=c.partSnapMm>0?c.partSnapMm:decadeSnap(c.scaleMm);return [Math.round(num(cad[0])/step)*step,Math.round(num(cad[1])/step)*step,Math.round(num(cad[2])/step)*step]}
  pointerMove(event){if(!this.ghost)return;const w=this.pointerWorld(event);if(!w)return;const p=this.snap(this.scene.worldPointToCad(w));this.ghost.position=p;this.scene.sync(this.ghost);this.onChange?.('move',{ghost:this.ghost,position:p});event.preventDefault();event.stopImmediatePropagation()}
  pointerDown(event){if(!this.ghost||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();this.commit()}
  commit(){const g=this.ghost;if(!g)return null;g.opacity=g._placementOriginalOpacity===undefined?1:g._placementOriginalOpacity;delete g._placementOriginalOpacity;if(g.components&&g.components.placementGhost)delete g.components.placementGhost;if(g.mesh&&g.mesh.material){g.mesh.material.transparent=g.opacity<1;g.mesh.material.opacity=g.opacity;g.mesh.material.depthWrite=g.opacity>=1}this.ghost=null;this.kind=null;this.canvas.style.cursor='';this.state.selectedIds=[g.id];this.state.primaryId=g.id;this.scene.sync(g);this.onChange?.('commit',g);return g}
  cancel(){if(!this.ghost)return false;const g=this.ghost;this.ghost=null;this.kind=null;this.canvas.style.cursor='';if(this.removePart)this.removePart(g);this.onChange?.('cancel',g);return true}
}
