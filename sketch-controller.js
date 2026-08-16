import * as THREE from "three";
import {SketchModel} from "./sketch-model.js";

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const normAng=a=>{a%=TAU;if(a<0)a+=TAU;return a};

export class SketchController{
  constructor(state,scene,onChange){
    this.state=state;this.scene=scene;this.onChange=onChange;this.activeSketch=null;
    this.activeTool="select";this.gridEnabled=true;this.snapEnabled=true;
    this.pendingPoint=null;this.previewPoint=null;this.lastPointerPoint=null;this.selectedEntityId=null;this.previousSelectedEntityId=null;
    this.freehandPoints=[];this.freehandActive=false;this.arcStage=0;this.arcCenter=null;this.arcStart=null;this.splinePoints=[];
    this.root=new THREE.Group();this.scene.scene.add(this.root);this.gridHelper=null;
  }
  createSketch({plane,gridSize,ownerPartId=null}){const sketch=new SketchModel({id:`sketch-${Date.now()}`,name:`Sketch ${this.state.sketches.length+1}`,plane,gridSize,ownerPartId});this.state.sketches.push(sketch);this.activeSketch=sketch;this.enterEditMode(sketch);return sketch}
  enterEditMode(sketch){this.activeSketch=sketch;sketch.ensureEntityCodes?.();this.state.sketchMode=true;this.pendingPoint=null;this.selectedEntityId=null;this.showPlane(sketch.plane);this.rebuild();this.onChange()}
  finishEdit(){if(!this.activeSketch)return;this.finishSpline();this.activeSketch.updateProfiles();this.state.sketchMode=false;this.previewPoint=null;this.clearVisuals();this.scene.controls.enabled=true;this.scene.controls.enableRotate=true;this.scene.controls.enablePan=true;this.scene.controls.enableZoom=true;this.onChange()}
  showPlane(plane){const t=new THREE.Vector3();if(plane==="XY"){this.scene.camera.position.set(0,0,250);this.scene.camera.up.set(0,1,0)}else if(plane==="XZ"){this.scene.camera.position.set(0,250,0);this.scene.camera.up.set(0,0,-1)}else{this.scene.camera.position.set(250,0,0);this.scene.camera.up.set(0,1,0)}this.scene.controls.target.copy(t);this.scene.camera.lookAt(t);this.scene.controls.enabled=true;this.scene.controls.enableRotate=false;this.scene.controls.enablePan=true;this.scene.controls.enableZoom=true;this.scene.camera.updateProjectionMatrix()}
  setTool(tool){if(this.activeTool==='spline'&&tool!=='spline')this.finishSpline();this.activeTool=tool;this.pendingPoint=null;this.previewPoint=null;this.freehandActive=false;this.freehandPoints=[];this.arcStage=0;this.arcCenter=null;this.arcStart=null;if(tool!=='spline')this.splinePoints=[];this.onChange()}
  planeObject(){const p=this.activeSketch?.plane||"XY";if(p==="XY")return new THREE.Plane(new THREE.Vector3(0,0,1),0);if(p==="XZ")return new THREE.Plane(new THREE.Vector3(0,1,0),0);return new THREE.Plane(new THREE.Vector3(1,0,0),0)}
  worldToSketch(p){const plane=this.activeSketch.plane;return plane==="XY"?{x:p.x,y:p.y}:plane==="XZ"?{x:p.x,y:p.z}:{x:p.z,y:p.y}}
  sketchToWorld(p){const plane=this.activeSketch.plane;return plane==="XY"?new THREE.Vector3(p.x,p.y,0):plane==="XZ"?new THREE.Vector3(p.x,0,p.y):new THREE.Vector3(0,p.y,p.x)}
  screenToPlane(event){const r=this.scene.canvas.getBoundingClientRect(),ndc=new THREE.Vector2(((event.clientX-r.left)/r.width)*2-1,-((event.clientY-r.top)/r.height)*2+1),ray=new THREE.Raycaster(),world=new THREE.Vector3();ray.setFromCamera(ndc,this.scene.camera);if(!ray.ray.intersectPlane(this.planeObject(),world))return null;const point=this.worldToSketch(world);return this.activeTool==="freehand"?point:(this.snapEnabled?this.snapPoint(point):point)}
  snapPoint(point){const size=Math.max(.001,Number(this.activeSketch.gridSize||10));let best={x:Math.round(point.x/size)*size,y:Math.round(point.y/size)*size},d=size*.35;for(const e of this.activeSketch.entities)for(const p of this.snapPoints(e)){const dist=Math.hypot(point.x-p.x,point.y-p.y);if(dist<d){d=dist;best={...p}}}return best}
  snapPoints(e){if(e.type==="point")return[e.point];if(e.type==="line"||e.type==='centerline')return[e.start,e.end];if(e.type==="rectangle")return[e.a,{x:e.b.x,y:e.a.y},e.b,{x:e.a.x,y:e.b.y}];if(e.type==="circle")return[e.center];if(e.type==='arc'){const pts=this.entityPolyline(e,24);return[e.center,pts[0],pts.at(-1)]}if(e.type==='spline'||e.type==='freehand'){const pts=e.points||[];return pts.length?[pts[0],pts.at(-1)]:[]}return[]}

  handlePointer(event){
    const p=this.screenToPlane(event);if(!p)return;this.lastPointerPoint={...p};this.previewPoint=null;
    if(this.activeTool==="freehand"){this.freehandActive=true;this.freehandPoints=[{...p}];this.rebuild();return}
    if(this.activeTool==="select"){this.selectNearest(p);return}
    if(this.activeTool==="point"){this.activeSketch.addEntity("point",{point:p});this.rebuild();this.onChange();return}
    if(this.activeTool==='arc'){
      if(this.arcStage===0){this.arcCenter={...p};this.arcStage=1}
      else if(this.arcStage===1){this.arcStart={...p};this.arcStage=2}
      else{const radius=Math.hypot(this.arcStart.x-this.arcCenter.x,this.arcStart.y-this.arcCenter.y);if(radius>.001){const startAngle=Math.atan2(this.arcStart.y-this.arcCenter.y,this.arcStart.x-this.arcCenter.x),endAngle=Math.atan2(p.y-this.arcCenter.y,p.x-this.arcCenter.x);this.activeSketch.addEntity('arc',{center:{...this.arcCenter},radius,startAngle,endAngle,clockwise:false})}this.arcStage=0;this.arcCenter=null;this.arcStart=null;this.rebuild();this.onChange()}return;
    }
    if(this.activeTool==='spline'){
      if(!this.splinePoints.length)this.splinePoints=[{...p}];else this.splinePoints.push({...p});
      if(event.detail>=2&&this.splinePoints.length>=3)this.finishSpline();else this.rebuild();return;
    }
    if(!this.pendingPoint){this.pendingPoint=p;return}
    if(this.activeTool==="line"){this.activeSketch.addEntity("line",{start:this.pendingPoint,end:p});this.pendingPoint=p}
    if(this.activeTool==="rectangle"){this.activeSketch.addEntity("rectangle",{a:this.pendingPoint,b:p});this.pendingPoint=null}
    if(this.activeTool==="circle"){const radius=Math.hypot(p.x-this.pendingPoint.x,p.y-this.pendingPoint.y);if(radius>.001)this.activeSketch.addEntity("circle",{center:this.pendingPoint,radius});this.pendingPoint=null}
    this.rebuild();this.onChange()
  }
  handlePointerMove(event){
    if(!this.activeSketch||!this.state.sketchMode)return;const p=this.screenToPlane(event);if(!p)return;this.lastPointerPoint={...p};this.previewPoint=(this.pendingPoint||this.arcStage||this.splinePoints.length)?{...p}:null;
    if(this.activeTool==="freehand"&&this.freehandActive){const last=this.freehandPoints.at(-1),minStep=Math.max(.15,Number(this.activeSketch.gridSize||10)*.04);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=minStep)this.freehandPoints.push({...p});this.rebuild()}
    const hud=document.getElementById("sketchHud");if(hud){let text=`X ${p.x.toFixed(3)}  Y ${p.y.toFixed(3)}`;const base=this.pendingPoint||this.arcStart||this.splinePoints.at(-1);if(base){const dx=p.x-base.x,dy=p.y-base.y,len=Math.hypot(dx,dy),ang=Math.atan2(dy,dx)*180/Math.PI;text+=`  |  L ${len.toFixed(3)}  ∠ ${ang.toFixed(2)}°`}hud.textContent=text}
    if(this.pendingPoint||this.arcStage||this.splinePoints.length)this.rebuild();
  }
  finishSpline(){if(this.splinePoints.length<2){this.splinePoints=[];return false}let pts=this.splinePoints.map(p=>({...p}));this.splinePoints=[];const tol=Math.max(.8,Number(this.activeSketch?.gridSize||10)*.35),closed=pts.length>=3&&Math.hypot(pts[0].x-pts.at(-1).x,pts[0].y-pts.at(-1).y)<=tol;if(closed){pts.at(-1).x=pts[0].x;pts.at(-1).y=pts[0].y;pts=pts.slice(0,-1)}this.activeSketch.addEntity('spline',{points:pts,closed});this.rebuild();this.onChange();return true}

  fitCircle(points){if(points.length<5)return null;let sx=0,sy=0;for(const p of points){sx+=p.x;sy+=p.y}const cx=sx/points.length,cy=sy/points.length;let r=0;for(const p of points)r+=Math.hypot(p.x-cx,p.y-cy);r/=points.length;if(r<1e-6)return null;let err=0;for(const p of points)err+=Math.abs(Math.hypot(p.x-cx,p.y-cy)-r);err/=points.length;return{center:{x:cx,y:cy},radius:r,error:err/r}}
  lineFitError(points){const a=points[0],b=points.at(-1),dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;let max=0;for(const p of points)max=Math.max(max,Math.abs(dy*p.x-dx*p.y+b.x*a.y-b.y*a.x)/l);return max/l}
  simplify(points,eps){const dist=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(!l)return Math.hypot(p.x-a.x,p.y-a.y);const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1);return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))};const rdp=arr=>{if(arr.length<3)return arr;let max=0,idx=0;for(let i=1;i<arr.length-1;i++){const d=dist(arr[i],arr[0],arr.at(-1));if(d>max){max=d;idx=i}}if(max<=eps)return[arr[0],arr.at(-1)];const l=rdp(arr.slice(0,idx+1)),r=rdp(arr.slice(idx));return[...l.slice(0,-1),...r]};return rdp(points)}
  finishFreehand(){
    if(!this.freehandActive)return false;this.freehandActive=false;const pts=this.freehandPoints;this.freehandPoints=[];if(pts.length<2){this.rebuild();return false}
    const simple=this.simplify(pts,Math.max(.25,Number(this.activeSketch.gridSize||10)*.05)),span=Math.hypot(pts.at(-1).x-pts[0].x,pts.at(-1).y-pts[0].y),box=Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y)),closeTol=Math.max(1,box*.025),closed=span<=closeTol;
    if(!closed&&this.lineFitError(pts)<.015){this.activeSketch.addEntity('line',{start:{...pts[0]},end:{...pts.at(-1)},freehand:true})}
    else{const fit=this.fitCircle(pts);if(fit&&fit.error<.055){if(closed)this.activeSketch.addEntity('circle',{center:fit.center,radius:fit.radius,freehand:true});else{const sa=Math.atan2(pts[0].y-fit.center.y,pts[0].x-fit.center.x),ea=Math.atan2(pts.at(-1).y-fit.center.y,pts.at(-1).x-fit.center.x);this.activeSketch.addEntity('arc',{center:fit.center,radius:fit.radius,startAngle:sa,endAngle:ea,clockwise:false,freehand:true})}}
      else{let s=simple;if(closed&&Math.hypot(s[0].x-s.at(-1).x,s[0].y-s.at(-1).y)<closeTol)s=s.slice(0,-1);this.activeSketch.addEntity('spline',{points:s,closed,freehand:true})}}
    this.activeSketch.updateProfiles();this.rebuild();this.onChange();return true
  }

  entityPolyline(e,quality=64){
    if(e.type==='line'||e.type==='centerline')return[{...e.start},{...e.end}];
    if(e.type==='rectangle')return[e.a,{x:e.b.x,y:e.a.y},e.b,{x:e.a.x,y:e.b.y},e.a].map(p=>({...p}));
    if(e.type==='circle'){const out=[];for(let i=0;i<=quality;i++){const a=i/quality*TAU;out.push({x:e.center.x+Math.cos(a)*e.radius,y:e.center.y+Math.sin(a)*e.radius})}return out}
    if(e.type==='arc'){let a0=e.startAngle||0,a1=e.endAngle||0,d=normAng(a1)-normAng(a0);if(e.clockwise){if(d>=0)d-=TAU}else if(d<=0)d+=TAU;const n=Math.max(8,Math.ceil(Math.abs(d)/TAU*quality)),out=[];for(let i=0;i<=n;i++){const a=a0+d*i/n;out.push({x:e.center.x+Math.cos(a)*e.radius,y:e.center.y+Math.sin(a)*e.radius})}return out}
    if(e.type==='spline'||e.type==='freehand'){const p=e.points||[];if(p.length<3)return p.map(q=>({...q}));const out=[];const src=e.closed?[p.at(-1),...p,p[0],p[1]]:[p[0],...p,p.at(-1)],spans=e.closed?p.length:p.length-1,steps=8;const cat=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return{x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)}};for(let i=0;i<spans;i++){const k=i+1;for(let s=0;s<steps;s++)out.push(cat(src[k-1],src[k],src[k+1],src[k+2],s/steps))}out.push(e.closed?{...out[0]}:{...p.at(-1)});return out}
    return[];
  }
  segmentIntersection(a,b,c,d,infiniteA=false,infiniteB=false){const x1=a.x,y1=a.y,x2=b.x,y2=b.y,x3=c.x,y3=c.y,x4=d.x,y4=d.y,den=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4);if(Math.abs(den)<1e-9)return null;const t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/den,u=-((x1-x2)*(y1-y3)-(y1-y2)*(x1-x3))/den;if((!infiniteA&&(t<0||t>1))||(!infiniteB&&(u<0||u>1)))return null;return{x:x1+t*(x2-x1),y:y1+t*(y2-y1),t,u}}
  intersectionsBetween(a,b){const pa=this.entityPolyline(a,96),pb=this.entityPolyline(b,96),hits=[];for(let i=0;i<pa.length-1;i++)for(let j=0;j<pb.length-1;j++){const h=this.segmentIntersection(pa[i],pa[i+1],pb[j],pb[j+1]);if(h)hits.push({...h,ia:i,ib:j,ta:(i+h.t)/(pa.length-1),tb:(j+h.u)/(pb.length-1)})}return hits}
  _convertRectangleToLines(e){const c=[e.a,{x:e.b.x,y:e.a.y},e.b,{x:e.a.x,y:e.b.y}],made=[];for(let i=0;i<4;i++)made.push(this.activeSketch.addEntity('line',{start:{...c[i]},end:{...c[(i+1)%4]},sourceRectangle:e.code}));this.activeSketch.removeEntity(e.id);return made}
  _replaceWithSpline(e,points,closed=false){const code=e.code;this.activeSketch.removeEntity(e.id);const n=this.activeSketch.addEntity('spline',{points:points.map(p=>({...p})),closed,trimmedFrom:code});return n}
  trimSelected(){
    let e=this.selectedEntity();if(!e)throw new Error('トリムするスケッチ要素を選択してください');const click=this.lastPointerPoint||this.entityLabelPoint(e)||{x:0,y:0};
    if(e.type==='rectangle'){const lines=this._convertRectangleToLines(e);lines.sort((a,b)=>this.distance(a,click)-this.distance(b,click));this.selectedEntityId=lines[0].id;return this.trimSelected()}
    const all=[];for(const o of this.activeSketch.entities){if(o.id===e.id||o.visible===false)continue;all.push(...this.intersectionsBetween(e,o).map(h=>({...h,other:o})))}if(!all.length)throw new Error('トリム境界となる交点がありません');
    const path=this.entityPolyline(e,128);if(path.length<2)throw new Error('この要素はトリムできません');const metric=(p)=>Math.hypot(p.x-click.x,p.y-click.y);all.sort((a,b)=>metric(a)-metric(b));
    if(e.type==='circle'){
      if(all.length<2)throw new Error('円のトリムには2つ以上の交点が必要です');const uniq=[];for(const h of all.sort((a,b)=>a.ta-b.ta))if(!uniq.some(q=>Math.abs(q.ta-h.ta)<1e-3))uniq.push(h);if(uniq.length<2)throw new Error('円のトリムには異なる2交点が必要です');let best=null;for(let i=0;i<uniq.length;i++){const a=uniq[i],b=uniq[(i+1)%uniq.length],mid=(a.ta+((b.ta<a.ta)?b.ta+1:b.ta))/2%1,mp=path[Math.min(path.length-1,Math.round(mid*(path.length-1)))],d=metric(mp);if(!best||d<best.d)best={a,b,d}}const keepStart=best.b.ta,keepEnd=best.a.ta+(best.a.ta<=best.b.ta?1:0);const sa=keepStart*TAU,ea=(keepEnd%1)*TAU;this.activeSketch.removeEntity(e.id);const n=this.activeSketch.addEntity('arc',{center:{...e.center},radius:e.radius,startAngle:sa,endAngle:ea,clockwise:false,trimmedFrom:e.code});this.selectedEntityId=n.id;
    }else if(e.type==='arc'){
      const h=all[0],a0=e.startAngle||0,d=(()=>{let x=normAng(e.endAngle||0)-normAng(a0);if(e.clockwise){if(x>=0)x-=TAU}else if(x<=0)x+=TAU;return x})(),clickA=Math.atan2(click.y-e.center.y,click.x-e.center.x),clickT=clamp((clickA-a0)/d,0,1);const hitA=Math.atan2(h.y-e.center.y,h.x-e.center.x);if(clickT<.5)e.startAngle=hitA;else e.endAngle=hitA;
    }else if(e.type==='line'||e.type==='centerline'){
      const h=all[0],ds=metric(e.start),de=metric(e.end);if(ds<de)e.start={x:h.x,y:h.y};else e.end={x:h.x,y:h.y};
    }else if(e.type==='spline'||e.type==='freehand'){
      const hits=all.sort((a,b)=>a.ta-b.ta),tClick=this.closestPathT(path,click);let lo=0,hi=1;for(const h of hits){if(h.ta<tClick)lo=Math.max(lo,h.ta);if(h.ta>tClick){hi=Math.min(hi,h.ta);break}}const keep=tClick<.5?path.slice(Math.round(hi*(path.length-1))):path.slice(0,Math.round(lo*(path.length-1))+1);if(keep.length<2)throw new Error('トリム後の曲線が短すぎます');const n=this._replaceWithSpline(e,this.simplify(keep,Math.max(.1,this.activeSketch.gridSize*.02)),false);this.selectedEntityId=n.id;
    }else throw new Error(`${e.type} のトリムには未対応です`);
    this.activeSketch.updateProfiles();this.rebuild();this.onChange();return true;
  }
  closestPathT(path,p){let best={d:Infinity,t:0};for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0,d=Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));if(d<best.d)best={d,t:(i+t)/(path.length-1)}}return best.t}
  extendSelected(){const e=this.selectedEntity();if(!e||!['line','centerline'].includes(e.type))throw new Error('延長は現在、線分・中心線に対応しています');const click=this.lastPointerPoint||e.end,hits=[];for(const o of this.activeSketch.entities){if(o.id===e.id)continue;const pb=this.entityPolyline(o,96);for(let j=0;j<pb.length-1;j++){const h=this.segmentIntersection(e.start,e.end,pb[j],pb[j+1],true,false);if(h&&(h.t<0||h.t>1))hits.push(h)}}if(!hits.length)throw new Error('延長先となる交点がありません');hits.sort((a,b)=>Math.hypot(a.x-click.x,a.y-click.y)-Math.hypot(b.x-click.x,b.y-click.y));const h=hits[0];if(h.t<0)e.start={x:h.x,y:h.y};else e.end={x:h.x,y:h.y};this.activeSketch.updateProfiles();this.rebuild();this.onChange();return true}

  distance(e,p){if(e.type==='point')return Math.hypot(p.x-e.point.x,p.y-e.point.y);const poly=this.entityPolyline(e,96);if(poly.length<2)return Infinity;let min=Infinity;for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;min=Math.min(min,Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy)))}return min}
  selectNearest(p){let best=null;for(const e of this.activeSketch.entities){const d=this.distance(e,p);if(!best||d<best.d)best={e,d}}this.previousSelectedEntityId=this.selectedEntityId;this.selectedEntityId=best&&best.d<=Math.max(2,this.activeSketch.gridSize*.35)?best.e.id:null;this.rebuild();this.onChange()}
  selectedEntity(){return this.activeSketch?.entity(this.selectedEntityId)||null}
  selectEntityByCode(code){const e=this.activeSketch?.entity(code);if(!e)return false;this.previousSelectedEntityId=this.selectedEntityId;this.selectedEntityId=e.id;this.rebuild();this.onChange();return true}
  updateSelected(data){const e=this.selectedEntity();if(!e)return false;Object.assign(e,structuredClone(data));this.activeSketch.updateProfiles();this.rebuild();this.onChange();return true}
  deleteSelected(){if(!this.selectedEntityId)return false;this.activeSketch.removeEntity(this.selectedEntityId);this.selectedEntityId=null;this.rebuild();this.onChange();return true}
  clearVisuals(){while(this.root.children.length){const c=this.root.children.pop();c.geometry?.dispose?.();c.material?.dispose?.()}if(this.gridHelper){this.scene.scene.remove(this.gridHelper);this.gridHelper.geometry?.dispose?.();this.gridHelper.material?.dispose?.();this.gridHelper=null}}
  rebuild(){this.clearVisuals();if(!this.activeSketch||!this.state.sketchMode)return;if(this.gridEnabled){this.gridHelper=new THREE.GridHelper(Math.max(100,this.activeSketch.gridSize*40),40,0x43728e,0x263c49);if(this.activeSketch.plane==='XY')this.gridHelper.rotation.x=Math.PI/2;else if(this.activeSketch.plane==='YZ')this.gridHelper.rotation.z=Math.PI/2;this.scene.scene.add(this.gridHelper)}for(const e of this.activeSketch.entities)this.draw(e);this.drawPreview();this.drawConstraintsAndDimensions()}
  drawConstraintsAndDimensions(){const sketch=this.activeSketch;if(!sketch)return;for(const c of sketch.constraints||[]){const e=sketch.entity(c.entityId||c.entityA);if(!e)continue;const p=this.entityLabelPoint(e);if(!p)continue;const text={Horizontal:'H',Vertical:'V',Fixed:'F',Coincident:'●',Parallel:'//',Perpendicular:'⊥',EqualLength:'=',Concentric:'◎',Midpoint:'M'}[c.type]||c.type;this.addTextSprite(text,this.sketchToWorld({x:p.x+2,y:p.y+2}),c.status==='conflict'?0xff5964:0xb9c3ff)}for(const d of sketch.dimensions||[]){const e=sketch.entity(d.entityId);if(!e)continue;const p=this.entityLabelPoint(e);if(!p)continue;const label=d.type==='Radius'?`R ${Number(d.value).toFixed(3)}`:d.type==='Diameter'?`⌀ ${Number(d.value).toFixed(3)}`:d.type==='Angle'?`${Number(d.value).toFixed(2)}°`:d.type==='Horizontal'?`X ${Number(d.value).toFixed(3)}`:d.type==='Vertical'?`Y ${Number(d.value).toFixed(3)}`:`${Number(d.value).toFixed(3)}`;this.addTextSprite(label,this.sketchToWorld({x:p.x,y:p.y-4}),d.status==='conflict'?0xff5964:0xe7f4ff)}}
  entityLabelPoint(e){if(e.type==='line'||e.type==='centerline')return{x:(e.start.x+e.end.x)/2,y:(e.start.y+e.end.y)/2};if(e.type==='circle'||e.type==='arc')return{x:e.center.x+e.radius,y:e.center.y};if(e.type==='point')return e.point;if((e.type==='spline'||e.type==='freehand')&&e.points?.length)return e.points[Math.floor(e.points.length/2)];if(e.type==='rectangle')return{x:(e.a.x+e.b.x)/2,y:(e.a.y+e.b.y)/2};return null}
  addTextSprite(text,position,color){const canvas=document.createElement('canvas');canvas.width=192;canvas.height=48;const ctx=canvas.getContext('2d');ctx.font='24px sans-serif';ctx.fillStyle='#0d1720';ctx.fillRect(0,0,192,48);ctx.fillStyle=`#${color.toString(16).padStart(6,'0')}`;ctx.fillText(text,8,32);const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}),sprite=new THREE.Sprite(material);sprite.position.copy(position);sprite.scale.set(24,6,1);sprite.renderOrder=70;this.root.add(sprite)}
  drawPreview(){
    if(this.activeTool==='freehand'&&this.freehandActive&&this.freehandPoints.length>1){const pts=this.freehandPoints.map(p=>this.sketchToWorld(p)),g=new THREE.BufferGeometry().setFromPoints(pts),m=new THREE.LineBasicMaterial({color:0xffd166,depthTest:false}),l=new THREE.Line(g,m);l.renderOrder=90;this.root.add(l);return}
    let pts=[];const b=this.previewPoint;
    if(this.activeTool==='spline'&&this.splinePoints.length){const p=[...this.splinePoints,...(b?[b]:[])];pts=p.map(q=>this.sketchToWorld(q))}
    else if(this.activeTool==='arc'&&this.arcStage===1&&b)pts=[this.sketchToWorld(this.arcCenter),this.sketchToWorld(b)];
    else if(this.activeTool==='arc'&&this.arcStage===2&&b){const r=Math.hypot(this.arcStart.x-this.arcCenter.x,this.arcStart.y-this.arcCenter.y),sa=Math.atan2(this.arcStart.y-this.arcCenter.y,this.arcStart.x-this.arcCenter.x),ea=Math.atan2(b.y-this.arcCenter.y,b.x-this.arcCenter.x),tmp={center:this.arcCenter,radius:r,startAngle:sa,endAngle:ea,clockwise:false};pts=this.entityPolyline(tmp,64).map(q=>this.sketchToWorld(q))}
    else if(this.pendingPoint&&b){const a=this.pendingPoint;if(this.activeTool==='line')pts.push(this.sketchToWorld(a),this.sketchToWorld(b));else if(this.activeTool==='rectangle')pts.push(...[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y},a].map(p=>this.sketchToWorld(p)));else if(this.activeTool==='circle'){const r=Math.hypot(b.x-a.x,b.y-a.y);for(let i=0;i<=72;i++){const q=i/72*TAU;pts.push(this.sketchToWorld({x:a.x+Math.cos(q)*r,y:a.y+Math.sin(q)*r}))}}
    }
    if(!pts.length)return;const g=new THREE.BufferGeometry().setFromPoints(pts),m=new THREE.LineDashedMaterial({color:0xffd166,dashSize:3,gapSize:2,depthTest:false}),l=new THREE.Line(g,m);l.computeLineDistances();l.renderOrder=90;this.root.add(l)
  }
  draw(e){const color=e.id===this.selectedEntityId?0xffc34d:0x59c7ff,mat=new THREE.LineBasicMaterial({color,depthTest:false});if(e.type==='point'){const m=new THREE.Mesh(new THREE.SphereGeometry(1.5,12,8),new THREE.MeshBasicMaterial({color,depthTest:false}));m.position.copy(this.sketchToWorld(e.point));this.root.add(m);return}const poly=this.entityPolyline(e,96);if(poly.length<2)return;const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(poly.map(p=>this.sketchToWorld(p))),mat);line.renderOrder=50;this.root.add(line);if(e.id===this.selectedEntityId&&e.code){const lp=this.entityLabelPoint(e);if(lp)this.addTextSprite(e.code,this.sketchToWorld({x:lp.x+3,y:lp.y+3}),0xffc34d)}}
  summary(){if(!this.activeSketch)return null;return{name:this.activeSketch.name,plane:this.activeSketch.plane,entities:this.activeSketch.entities.length,profiles:this.activeSketch.profileCount,tool:this.activeTool}}
}
