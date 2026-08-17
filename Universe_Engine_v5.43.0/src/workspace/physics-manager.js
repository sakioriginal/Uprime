export class PhysicsManager{
  constructor(state,scene,onChange=()=>{}){
    this.state=state;this.scene=scene;this.onChange=onChange;this.last=performance.now();
    this.ensureState();
    scene.addLoopHook?.((now)=>this.tick(now));
  }
  ensureState(){
    this.state.physics={enabled:false,gravity:[0,0,-9.80665],timeScale:1,floorZ:0,autoSleep:true,...(this.state.physics||{})};
  }
  ensurePart(part){
    part.physics={enabled:false,bodyType:'static',mass:1,velocity:[0,0,0],restitution:.08,friction:.6,sleeping:false,...(part.physics||{})};
    if(!Array.isArray(part.physics.velocity))part.physics.velocity=[0,0,0];
    return part.physics;
  }
  setEnabled(value){this.ensureState();this.state.physics.enabled=!!value;this.last=performance.now();}
  setGravityPreset(name){
    const presets={earth:[0,0,-9.80665],moon:[0,0,-1.62],mars:[0,0,-3.71],zero:[0,0,0]};
    const v=presets[String(name||'').toLowerCase()];if(v)this.state.physics.gravity=[...v];return this.state.physics.gravity;
  }
  freeze(part){const p=this.ensurePart(part);p.bodyType='static';p.velocity=[0,0,0];p.sleeping=true;}
  unfreeze(part){const p=this.ensurePart(part);p.enabled=true;p.bodyType='dynamic';p.sleeping=false;}
  aabb(part){
    const b=this.scene.partBounds(part),s=part.scale||[1,1,1],p=part.position||[0,0,0];
    return {min:b.min.map((v,i)=>p[i]+v*(s[i]||1)),max:b.max.map((v,i)=>p[i]+v*(s[i]||1))};
  }
  supportTop(part,movingBox){
    let top=Number(this.state.physics.floorZ)||0;
    for(const env of (this.scene.workspaceColliders||[])){
      env.geometry.computeBoundingBox?.();env.updateMatrixWorld?.(true);const bb=env.geometry.boundingBox?.clone?.();if(bb){bb.applyMatrix4(env.matrixWorld);const b=this.scene.worldBoxToCad?this.scene.worldBoxToCad(bb):{min:[bb.min.x,bb.min.z,bb.min.y],max:[bb.max.x,bb.max.z,bb.max.y]};const overlapX=movingBox.max[0]>b.min[0]&&movingBox.min[0]<b.max[0];const overlapY=movingBox.max[1]>b.min[1]&&movingBox.min[1]<b.max[1];if(overlapX&&overlapY&&movingBox.min[2]>=b.max[2]-12)top=Math.max(top,b.max[2]);}
    }
    for(const other of this.state.objects){
      if(other===part||other.visible===false)continue;const po=this.ensurePart(other);if(!po.enabled||po.bodyType==='dynamic')continue;
      const b=this.aabb(other);
      const overlapX=movingBox.max[0]>b.min[0]&&movingBox.min[0]<b.max[0];
      const overlapY=movingBox.max[1]>b.min[1]&&movingBox.min[1]<b.max[1];
      if(overlapX&&overlapY&&movingBox.min[2]>=b.max[2]-8)top=Math.max(top,b.max[2]);
    }
    return top;
  }
  tick(now=performance.now()){
    this.ensureState();const cfg=this.state.physics;if(!cfg.enabled){this.last=now;return}
    let dt=Math.min(.033,Math.max(0,(now-this.last)/1000))*(Number(cfg.timeScale)||1);this.last=now;if(!dt)return;
    const g=cfg.gravity||[0,0,-9.80665];let changed=false;
    for(const part of this.state.objects){
      const ph=this.ensurePart(part);if(!ph.enabled||ph.bodyType!=='dynamic'||ph.sleeping)continue;
      ph.velocity[0]+=(Number(g[0])||0)*dt*1000;ph.velocity[1]+=(Number(g[1])||0)*dt*1000;ph.velocity[2]+=(Number(g[2])||0)*dt*1000;
      part.position[0]+=ph.velocity[0]*dt;part.position[1]+=ph.velocity[1]*dt;part.position[2]+=ph.velocity[2]*dt;
      let box=this.aabb(part),support=this.supportTop(part,box);
      if(box.min[2]<support&&ph.velocity[2]<=0){part.position[2]+=support-box.min[2];ph.velocity[2]=-ph.velocity[2]*(Number(ph.restitution)||0);ph.velocity[0]*=.86;ph.velocity[1]*=.86;if(cfg.autoSleep&&Math.hypot(...ph.velocity)<4){ph.velocity=[0,0,0];ph.sleeping=true}}
      this.scene.sync(part);changed=true;
    }
    if(changed)this.onChange(false);
  }
}
