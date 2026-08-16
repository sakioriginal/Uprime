import * as THREE from 'three';

function num(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function centerOf(o){return o&&Array.isArray(o.position)?o.position:[0,0,0]}
function sizeOf(o){const p=o&&o.params?o.params:{};return {w:Math.abs(num(p.width!==undefined?p.width:p.w,1000))||1000,d:Math.abs(num(p.depth!==undefined?p.depth:p.d,100))||100,h:Math.abs(num(p.height!==undefined?p.height:p.h,1000))||1000}}
function buildingOf(o){return o&&o.components&&o.components.building?o.components.building:null}

export class LiveBuildingPlacementController{
  constructor(state,scene,canvas,addPart,removePart,onChange){
    this.state=state;this.scene=scene;this.canvas=canvas;this.addPart=addPart;this.removePart=removePart;this.onChange=onChange||function(){};
    this.tool='off';this.ghost=null;this.firstPoint=null;this.lastPoint=null;this.snapped=false;this.collision=false;this.groupGhost=null;this.lastPointerTs=0;
    this._move=e=>this.pointerMove(e);this._down=e=>this.pointerDown(e);
    canvas.addEventListener('pointermove',this._move,true);canvas.addEventListener('pointerdown',this._down,true);
    this.ensureState();
  }
  ensureState(){
    const b=this.state.buildingAssist||(this.state.buildingAssist={});
    if(b.liveTool===undefined)b.liveTool='off';if(b.snapGrid===undefined)b.snapGrid=250;if(b.snapRadius===undefined)b.snapRadius=450;if(b.liveSnap===undefined)b.liveSnap=true;
    return b;
  }
  active(){return this.tool!=='off'||!!this.groupGhost}
  startGroupPlacement(objects,{label='建築',ground=true}={}){
    this.cancelGroupPlacement(false);this.cancelGhost();this.firstPoint=null;this.tool='off';
    const items=(objects||[]).filter(Boolean);if(!items.length)return false;
    const positions=items.map(o=>(o.position||[0,0,0]).slice());
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity;
    for(const o of items){const p=o.position||[0,0,0],s=sizeOf(o);minX=Math.min(minX,p[0]-s.w/2);maxX=Math.max(maxX,p[0]+s.w/2);minY=Math.min(minY,p[1]-s.d/2);maxY=Math.max(maxY,p[1]+s.d/2);minZ=Math.min(minZ,p[2]-s.h/2)}
    const anchor=[(minX+maxX)/2,(minY+maxY)/2,minZ];
    this.groupGhost={items,positions,anchor,label,ground,lastCad:null,angleDeg:0};
    for(const o of items){o.opacity=.26;o.physics=o.physics||{};o.physics.enabled=false;o.components=o.components||{};o.components.building=o.components.building||{};o.components.building.ghostPreview=true;o.components.building.previewState='placement';if(o.mesh?.material){o.mesh.material.transparent=true;o.mesh.material.opacity=.26;o.mesh.material.depthWrite=false;o.mesh.material.color?.set?.(0x55d7ff)}}
    this.canvas.style.cursor='crosshair';this.onChange('group-start',{label,items});this.update(0,true);return true;
  }
  _groupMoveTo(cad){const g=this.groupGhost;if(!g)return;let target=cad.slice();if(g.ground){const snap=this.snapCad(target);target=snap.p;this.snapped=snap.snapped}
    const a=THREE.MathUtils.degToRad(Number(g.angleDeg)||0),ca=Math.cos(a),sa=Math.sin(a),dz=target[2]-g.anchor[2];
    for(let i=0;i<g.items.length;i++){const o=g.items[i],p=g.positions[i],rx=p[0]-g.anchor[0],ry=p[1]-g.anchor[1];o.position=[target[0]+rx*ca-ry*sa,target[1]+rx*sa+ry*ca,p[2]+dz];const baseRot=(o.rotation||[0,0,0]).slice();if(o.__placementBaseRotation===undefined)o.__placementBaseRotation=baseRot;o.rotation=[o.__placementBaseRotation[0]||0,o.__placementBaseRotation[1]||0,(o.__placementBaseRotation[2]||0)+(Number(g.angleDeg)||0)];this.scene.sync(o)}g.lastCad=target;this.onChange('group-move',{label:g.label,point:target,angleDeg:g.angleDeg,items:g.items});}
  rotateGroup(deltaDeg){const g=this.groupGhost;if(!g)return false;g.angleDeg=(Number(g.angleDeg)||0)+(Number(deltaDeg)||0);if(g.lastCad)this._groupMoveTo(g.lastCad);return true}
  commitGroupPlacement(){const g=this.groupGhost;if(!g)return[];for(const o of g.items){delete o.__placementBaseRotation;o.opacity=1;o.physics=o.physics||{};o.physics.enabled=false;if(o.components?.building){o.components.building.ghostPreview=false;o.components.building.previewState='committed'}if(o.mesh?.material){o.mesh.material.transparent=false;o.mesh.material.opacity=1;o.mesh.material.depthWrite=true;o.mesh.material.color?.set?.(o.color||0x88a9bf)}}this.groupGhost=null;this.canvas.style.cursor='';this.state.selectedIds=g.items.map(o=>o.id);this.state.primaryId=g.items.at(-1)?.id||null;this.onChange('group-commit',{label:g.label,items:g.items});return g.items}
  cancelGroupPlacement(remove=true){const g=this.groupGhost;if(!g)return 0;this.groupGhost=null;this.canvas.style.cursor='';if(remove){for(const o of g.items){delete o.__placementBaseRotation;if(this.removePart)this.removePart(o);else this.state.objects=this.state.objects.filter(x=>x!==o)}}else{for(let i=0;i<g.items.length;i++){delete g.items[i].__placementBaseRotation;g.items[i].position=g.positions[i];this.scene.sync(g.items[i])}}this.onChange('group-cancel',{label:g.label,items:g.items});return g.items.length}
  setTool(kind){
    const k=String(kind||'off').toLowerCase();this.cancelGhost();this.firstPoint=null;this.tool=['column','wall','floor','roof'].includes(k)?k:'off';
    this.ensureState().liveTool=this.tool;this.canvas.style.cursor=this.active()?'crosshair':'';this.onChange('tool',this.tool);return this.tool;
  }
  stop(){return this.setTool('off')}
  cancelStage(){if(!this.active())return false;if(this.groupGhost){this.cancelGroupPlacement(true);return true}if(this.firstPoint){this.firstPoint=null;this.cancelGhost();this.onChange('cancel-stage',this.tool);return true}this.stop();return true}
  avatarHeightMm(){const workspaceScale=num(this.state.workspace&&this.state.workspace.unitScaleMm,10);return Math.max(800,num(this.state.avatar&&this.state.avatar.height,170)*workspaceScale)}
  ghostData(kind){
    const H=this.avatarHeightMm(),cfg=this.ensureState(),section=Math.max(60,H*.07),wallT=Math.max(10,num(cfg.wallThickness,120)),floorT=Math.max(10,num(cfg.floorThickness,150)),roofT=Math.max(10,num(cfg.roofThickness,120));
    if(kind==='column')return {name:'👻 柱',params:{width:section,height:H,depth:section},position:[0,0,H/2],rotation:[0,0,0]};
    if(kind==='wall')return {name:'👻 壁',params:{width:500,height:H,depth:wallT},position:[0,0,H/2],rotation:[0,0,0]};
    if(kind==='floor')return {name:'👻 床',params:{width:500,height:floorT,depth:500},position:[0,0,-floorT/2],rotation:[0,0,0]};
    return {name:'👻 屋根',params:{width:500,height:roofT,depth:500},position:[0,0,roofT/2],rotation:[0,num(cfg.roofPitch,20),0]};
  }
  createGhost(){
    if(this.ghost)return this.ghost;const d=this.ghostData(this.tool);
    this.ghost=this.addPart('box',{...d,opacity:.3,color:0x55d7ff,visible:true,entityKind:'building',physics:{enabled:false,bodyType:'static'},components:{building:{enabled:true,primitive:this.tool,layer:this.tool,assist:true,liveGhost:true,previewState:'candidate'}}},false);
    this.styleGhost(0x55d7ff,.3);return this.ghost;
  }
  cancelGhost(){if(!this.ghost)return;const g=this.ghost;this.ghost=null;if(this.removePart)this.removePart(g);else this.state.objects=this.state.objects.filter(o=>o!==g)}
  styleGhost(color,opacity){const g=this.ghost;if(!g)return;g.color=color;g.opacity=opacity;if(g.mesh&&g.mesh.material){g.mesh.material.transparent=true;g.mesh.material.opacity=opacity;g.mesh.material.depthWrite=false;if(g.mesh.material.color&&g.mesh.material.color.set)g.mesh.material.color.set(color)}}
  pointerWorld(event){
    this.scene.updatePointer(event);const targets=[];
    for(const s of this.scene.workspacePlacementSurfaces||[])if(s)targets.push(s);
    const groupSet=new Set(this.groupGhost?.items||[]);for(const o of this.state.objects||[]){if(o===this.ghost||groupSet.has(o)||o.visible===false)continue;if(o.mesh)targets.push(o.mesh)}
    const hit=this.scene.raycaster.intersectObjects(targets,true)[0];if(hit)return hit.point.clone();
    const base=this.scene.cadPointToWorld([0,0,0]),up=this.scene.cadPointToWorld([0,0,1]).sub(base).normalize(),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(up,base),out=new THREE.Vector3();
    return this.scene.raycaster.ray.intersectPlane(plane,out)?out:null;
  }
  cameraAimWorld(){const cam=this.scene?.camera;if(!cam)return null;const dir=new THREE.Vector3();cam.getWorldDirection(dir);const targets=[];for(const s of this.scene.workspacePlacementSurfaces||[])if(s)targets.push(s);const groupSet=new Set(this.groupGhost?.items||[]);for(const o of this.state.objects||[]){if(o===this.ghost||groupSet.has(o)||o.visible===false)continue;if(o.mesh)targets.push(o.mesh)}const ray=new THREE.Raycaster(cam.position.clone(),dir.normalize(),0,1000000),hit=ray.intersectObjects(targets,true)[0];if(hit?.point)return hit.point.clone();return cam.position.clone().add(dir.multiplyScalar(300))}
  update(dt=0,force=false){if(!this.groupGhost)return;const now=performance.now();const mode=String(this.state.avatar?.mode||'').toLowerCase(),aimMode=mode==='fpv'||mode==='tpv'||mode==='firstperson'||mode==='thirdperson';if(!force&&!aimMode&&now-this.lastPointerTs<500)return;const world=this.cameraAimWorld();if(!world)return;this._groupMoveTo(this.scene.worldPointToCad(world))}
  anchors(){
    const out=[];
    for(const o of this.state.objects||[]){if(o===this.ghost||o.visible===false)continue;const b=buildingOf(o);if(!b||b.liveGhost||b.ghostPreview)continue;const p=centerOf(o),s=sizeOf(o),r=num(o.rotation&&o.rotation[2],0)*Math.PI/180;
      if(b.primitive==='column'){
        out.push({p:[p[0],p[1],p[2]-s.h/2],type:'column-base',id:o.id});out.push({p:[p[0],p[1],p[2]+s.h/2],type:'column-top',id:o.id});
      }else if(b.primitive==='wall'){
        const dx=Math.cos(r)*s.w/2,dy=Math.sin(r)*s.w/2;out.push({p:[p[0]-dx,p[1]-dy,p[2]-s.h/2],type:'wall-end',id:o.id});out.push({p:[p[0]+dx,p[1]+dy,p[2]-s.h/2],type:'wall-end',id:o.id});
      }else if(b.primitive==='floor'||b.primitive==='roof'){
        const z=b.primitive==='floor'?p[2]+s.h/2:p[2]-s.h/2;for(const sx of [-1,1])for(const sy of [-1,1])out.push({p:[p[0]+sx*s.w/2,p[1]+sy*s.d/2,z],type:b.primitive+'-corner',id:o.id});
      }
    }
    return out;
  }
  snapCad(cad){
    const cfg=this.ensureState(),p=[num(cad[0]),num(cad[1]),num(cad[2])],grid=Math.max(.001,num(cfg.snapGrid,250));let snapped=false,anchor=null;
    if(cfg.liveSnap!==false&&cfg.mode!=='off'){
      const radius=Math.max(1,num(cfg.snapRadius,450));let best=radius;
      for(const a of this.anchors()){const d=Math.hypot(a.p[0]-p[0],a.p[1]-p[1],a.p[2]-p[2]);if(d<best){best=d;anchor=a}}
      if(anchor){p[0]=anchor.p[0];p[1]=anchor.p[1];p[2]=anchor.p[2];snapped=true}
      else {p[0]=Math.round(p[0]/grid)*grid;p[1]=Math.round(p[1]/grid)*grid;snapped=true}
    }
    return {p,snapped,anchor};
  }
  hasDuplicate(kind,p){
    const threshold=Math.max(20,num(this.ensureState().snapGrid,250)*.15);
    return (this.state.objects||[]).some(o=>{const b=buildingOf(o);if(!b||b.liveGhost||b.ghostPreview||b.primitive!==kind)return false;const q=centerOf(o);return Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])<threshold});
  }
  updateGhostAt(pointInfo){
    const g=this.createGhost(),p=pointInfo.p;this.snapped=!!pointInfo.snapped;const H=this.avatarHeightMm();
    if(this.tool==='column'){
      g.position=[p[0],p[1],p[2]+H/2];
    }else if(this.tool==='wall'){
      const a=this.firstPoint||p,dx=p[0]-a[0],dy=p[1]-a[1],dist=Math.max(1,Math.hypot(dx,dy)),h=H;g.params.width=dist;g.params.height=h;g.position=[(a[0]+p[0])/2,(a[1]+p[1])/2,Math.min(a[2],p[2])+h/2];g.rotation=[0,0,Math.atan2(dy,dx)*180/Math.PI];
    }else if(this.tool==='floor'||this.tool==='roof'){
      const a=this.firstPoint||p,dx=p[0]-a[0],dy=p[1]-a[1],w=Math.max(1,Math.abs(dx)),d=Math.max(1,Math.abs(dy)),t=this.tool==='floor'?Math.max(10,num(this.ensureState().floorThickness,150)):Math.max(10,num(this.ensureState().roofThickness,120));g.params.width=w;g.params.depth=d;g.params.height=t;g.position=[(a[0]+p[0])/2,(a[1]+p[1])/2,this.tool==='floor'?Math.min(a[2],p[2])-t/2:Math.max(a[2],p[2])+t/2];
    }
    this.collision=this.tool==='column'&&this.hasDuplicate('column',g.position);this.styleGhost(this.collision?0xff5b5b:(this.snapped?0xffd166:0x55d7ff),.32);this.scene.sync(g);this.lastPoint=p.slice();this.onChange('move',{tool:this.tool,point:p,snapped:this.snapped,collision:this.collision,anchor:pointInfo.anchor});
  }
  pointerMove(event){if(!this.active())return;this.lastPointerTs=performance.now();const world=this.pointerWorld(event);if(!world)return;const cad=this.scene.worldPointToCad(world);if(this.groupGhost)this._groupMoveTo(cad);else{const sp=this.snapCad(cad);this.updateGhostAt(sp)}event.preventDefault();event.stopImmediatePropagation()}
  pointerDown(event){
    if(!this.active()||event.button!==0)return;const world=this.pointerWorld(event);if(!world)return;if(this.groupGhost){const mode=String(this.state.avatar?.mode||'').toLowerCase(),aimMode=mode==='fpv'||mode==='tpv'||mode==='firstperson'||mode==='thirdperson',placeWorld=aimMode?(this.cameraAimWorld()||world):world;this._groupMoveTo(this.scene.worldPointToCad(placeWorld));event.preventDefault();event.stopImmediatePropagation();this.commitGroupPlacement();return}const sp=this.snapCad(this.scene.worldPointToCad(world));this.updateGhostAt(sp);event.preventDefault();event.stopImmediatePropagation();
    if(this.collision){this.onChange('blocked',{tool:this.tool,point:sp.p});return}
    if((this.tool==='wall'||this.tool==='floor'||this.tool==='roof')&&!this.firstPoint){this.firstPoint=sp.p.slice();this.onChange('first-point',{tool:this.tool,point:this.firstPoint});return}
    this.commitGhost();
  }
  commitGhost(){
    const g=this.ghost;if(!g)return null;g.opacity=1;g.color=0x88a9bf;g.physics=g.physics||{};g.physics.enabled=false;g.components=g.components||{};g.components.building=g.components.building||{};g.components.building.liveGhost=false;g.components.building.previewState='committed';if(g.mesh&&g.mesh.material){g.mesh.material.transparent=false;g.mesh.material.opacity=1;g.mesh.material.depthWrite=true;if(g.mesh.material.color&&g.mesh.material.color.set)g.mesh.material.color.set(g.color)}
    this.ghost=null;this.firstPoint=null;this.state.selectedIds=[g.id];this.state.primaryId=g.id;this.onChange('commit',g);return g;
  }
}
