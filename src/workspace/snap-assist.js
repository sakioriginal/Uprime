import * as THREE from 'three';

const TYPE_LABEL={vertex:'端点',edge:'中点',face:'面',center:'中心',axis:'軸中心'};
const TYPE_PRIORITY={vertex:0,edge:1,face:2,axis:3,center:4};

export class SnapAssist{
  constructor(state,scene,canvas,marker){
    this.state=state;this.scene=scene;this.canvas=canvas;this.marker=marker;this.current=null;
    this.ensureState();
  }
  ensureState(){
    const c=this.state.creator||(this.state.creator={});
    if(c.smartSnap===undefined)c.smartSnap=true;
    if(!c.smartSnapTypes)c.smartSnapTypes={vertex:true,edge:true,face:true,center:true,axis:true};
    if(c.smartSnapPixels===undefined)c.smartSnapPixels=24;
    return c;
  }
  enabled(){return this.ensureState().smartSnap!==false}
  types(){return this.ensureState().smartSnapTypes||{}}
  clear(){this.current=null;if(this.marker){this.marker.classList.remove('show');this.marker.textContent='';}}
  _bbox(part){
    const g=part?.mesh?.geometry;if(!g)return null;
    if(!g.boundingBox)g.computeBoundingBox();return g.boundingBox?.clone()||null;
  }
  _push(list,part,type,local,label,extra={}){
    if(this.types()[type]===false)return;
    const world=part.mesh.localToWorld(local.clone());
    const out={partId:part.id,partName:part.name||part.objectId||part.id,type,label:label||TYPE_LABEL[type],world,cad:this.scene.worldPointToCad(world)};
    if(extra.normalLocal){out.normalLocal=extra.normalLocal.clone();out.normalWorld=extra.normalLocal.clone().transformDirection(part.mesh.matrixWorld).normalize();}
    if(extra.directionLocal){out.directionLocal=extra.directionLocal.clone();out.directionWorld=extra.directionLocal.clone().transformDirection(part.mesh.matrixWorld).normalize();}
    list.push(out);
  }
  candidatesForPart(part){
    const b=this._bbox(part);if(!b||!part?.mesh)return [];
    const min=b.min,max=b.max,c=min.clone().add(max).multiplyScalar(.5),out=[];
    const xs=[min.x,max.x],ys=[min.y,max.y],zs=[min.z,max.z];
    for(const x of xs)for(const y of ys)for(const z of zs)this._push(out,part,'vertex',new THREE.Vector3(x,y,z),'頂点');
    const xm=c.x,ym=c.y,zm=c.z;
    for(const x of xs)for(const y of ys)this._push(out,part,'edge',new THREE.Vector3(x,y,zm),'辺中点',{directionLocal:new THREE.Vector3(0,0,1)});
    for(const x of xs)for(const z of zs)this._push(out,part,'edge',new THREE.Vector3(x,ym,z),'辺中点',{directionLocal:new THREE.Vector3(0,1,0)});
    for(const y of ys)for(const z of zs)this._push(out,part,'edge',new THREE.Vector3(xm,y,z),'辺中点',{directionLocal:new THREE.Vector3(1,0,0)});
    this._push(out,part,'face',new THREE.Vector3(min.x,ym,zm),'面中心',{normalLocal:new THREE.Vector3(-1,0,0)});this._push(out,part,'face',new THREE.Vector3(max.x,ym,zm),'面中心',{normalLocal:new THREE.Vector3(1,0,0)});
    this._push(out,part,'face',new THREE.Vector3(xm,min.y,zm),'面中心',{normalLocal:new THREE.Vector3(0,-1,0)});this._push(out,part,'face',new THREE.Vector3(xm,max.y,zm),'面中心',{normalLocal:new THREE.Vector3(0,1,0)});
    this._push(out,part,'face',new THREE.Vector3(xm,ym,min.z),'面中心',{normalLocal:new THREE.Vector3(0,0,-1)});this._push(out,part,'face',new THREE.Vector3(xm,ym,max.z),'面中心',{normalLocal:new THREE.Vector3(0,0,1)});
    this._push(out,part,'center',c,part.type==='sphere'?'球の中心':'オブジェクト中心');
    this._push(out,part,'axis',c,'X軸',{directionLocal:new THREE.Vector3(1,0,0)});
    this._push(out,part,'axis',c,'Y軸',{directionLocal:new THREE.Vector3(0,1,0)});
    this._push(out,part,'axis',c,'Z軸',{directionLocal:new THREE.Vector3(0,0,1)});
    return out;
  }
  candidates(excludeIds=[]){
    const ex=new Set(excludeIds||[]),out=[];
    for(const p of this.state.objects||[]){if(ex.has(p.id)||p.visible===false||!p.mesh)continue;out.push(...this.candidatesForPart(p));}
    return out;
  }
  _screen(candidate){
    const v=candidate.world.clone().project(this.scene.camera),r=this.canvas.getBoundingClientRect();
    return {x:r.left+(v.x*.5+.5)*r.width,y:r.top+(-v.y*.5+.5)*r.height,z:v.z};
  }
  pick(event,excludeIds=[]){
    if(!this.enabled()){this.clear();return null;}
    const maxPx=Math.max(8,Number(this.ensureState().smartSnapPixels)||24);let best=null;
    for(const c of this.candidates(excludeIds)){
      const s=this._screen(c);if(s.z<-1||s.z>1)continue;const dx=s.x-event.clientX,dy=s.y-event.clientY,d=Math.hypot(dx,dy);if(d>maxPx)continue;
      const score=d+(TYPE_PRIORITY[c.type]||0)*.8;if(!best||score<best.score)best={...c,screen:s,distancePx:d,score};
    }
    if(!best){this.clear();return null;}this.current=best;this.show(best);return best;
  }
  show(c){
    if(!this.marker)return;const r=this.canvas.getBoundingClientRect(),host=this.canvas.parentElement.getBoundingClientRect();
    this.marker.style.left=`${c.screen.x-host.left}px`;this.marker.style.top=`${c.screen.y-host.top}px`;
    this.marker.dataset.type=c.type;this.marker.textContent=`${c.label} · ${c.partName}`;this.marker.classList.add('show');
  }
  movingCandidates(parts){const out=[];for(const p of parts||[])if(p?.mesh)out.push(...this.candidatesForPart(p));return out;}
  snapSelection(parts,target){
    if(!target||!parts?.length)return false;const srcs=this.movingCandidates(parts);if(!srcs.length)return false;let src=null,best=Infinity;
    for(const s of srcs){const d=Math.hypot(s.cad[0]-target.cad[0],s.cad[1]-target.cad[1],s.cad[2]-target.cad[2]);if(d<best){best=d;src=s;}}
    if(!src)return false;const delta=[target.cad[0]-src.cad[0],target.cad[1]-src.cad[1],target.cad[2]-src.cad[2]];
    for(const p of parts){p.position=[Number(p.position?.[0]||0)+delta[0],Number(p.position?.[1]||0)+delta[1],Number(p.position?.[2]||0)+delta[2]];this.scene.sync(p);}
    return {source:src,target,delta};
  }
}
