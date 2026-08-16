import * as THREE from 'three';

export class ProjectileManager{
  constructor({state,scene,planet=null,multiplayer=null,itemCrafting=null,onStatus=()=>{}}={}){
    this.state=state;this.scene=scene;this.planet=planet;this.multiplayer=multiplayer;this.itemCrafting=itemCrafting;this.onStatus=onStatus;
    this.root=new THREE.Group();this.root.name='projectiles';scene.scene.add(this.root);this.items=[];this.last=performance.now();
    scene.addLoopHook?.((now)=>this.update(now));
  }
  mmToScene(mm){return Number(mm||0)/Math.max(1e-9,Number(this.state.workspace?.unitScaleMm)||10)}
  _avatarPose(){const g=window.__UE_AVATAR_GROUP__;if(!g)return null;const p=g.getWorldPosition(new THREE.Vector3()),q=g.getWorldQuaternion(new THREE.Quaternion());let f=new THREE.Vector3(0,0,-1).applyQuaternion(q).normalize();const up=this.state.avatar?.onPlanet?p.clone().normalize():new THREE.Vector3(0,1,0);f.projectOnPlane(up).normalize();if(f.lengthSq()<.001)f.set(0,0,-1);return{p,q,f,up}}
  fireBow({draw=1}={}){
    const stats=this.itemCrafting?.combatStats?.()||{},weapon=stats.weapon;if(!weapon?.stats?.ranged){this.onStatus('弓などの遠距離武器を装備してください','error');return false}
    const pose=this._avatarPose();if(!pose)return false;draw=THREE.MathUtils.clamp(Number(draw)||1,.15,1);
    const length=this.mmToScene(700),radius=this.mmToScene(7),geo=new THREE.CylinderGeometry(radius,radius,length,8),mat=new THREE.MeshStandardMaterial({color:0x6f4b2a,roughness:.8}),mesh=new THREE.Mesh(geo,mat);
    mesh.rotation.x=Math.PI/2;mesh.position.copy(pose.p).add(pose.up.clone().multiplyScalar(this.mmToScene(1350))).add(pose.f.clone().multiplyScalar(this.mmToScene(500)));this.root.add(mesh);
    const speed=this.mmToScene(26000*draw); // ~26 m/s at full draw
    const vel=pose.f.clone().multiplyScalar(speed).add(pose.up.clone().multiplyScalar(speed*.06));
    this.items.push({mesh,velocity:vel,age:0,life:12,damage:Math.max(1,Number(stats.damage)||28),owner:this.multiplayer?.clientId||'local',stuck:false});
    this.onStatus(`🏹 発射 ${Math.round(draw*100)}%`,'command');return true;
  }
  _gravityAt(pos){
    if(this.state.avatar?.onPlanet&&this.planet){const g=Math.max(.01,Number(this.state.planet?.surfaceGravityMS2)||9.80665),sceneG=this.mmToScene(g*1000);return pos.clone().normalize().multiplyScalar(-sceneG)}
    const g=this.state.physics?.gravity||[0,0,-9.80665];return new THREE.Vector3(this.mmToScene((g[0]||0)*1000),this.mmToScene((g[2]||0)*1000),this.mmToScene((g[1]||0)*1000))
  }
  _terrainHit(pos){if(!this.planet?.terrain)return false;const n=pos.clone().normalize(),r=pos.length(),ground=this.planet.surfaceRadius(n);return r<=ground+this.mmToScene(20)}
  _solidHit(a,b){const dir=b.clone().sub(a),dist=dir.length();if(dist<1e-8)return null;dir.normalize();const ray=this.scene.raycaster;ray.set(a,dir);ray.near=0;ray.far=dist;const meshes=[];for(const o of (this.state.objects||[])){if(o.visible===false||!o.mesh||o.metadata?.noCollision===true)continue;meshes.push(o.mesh)}for(const m of this.scene.workspaceColliders||[])meshes.push(m);return meshes.length?ray.intersectObjects(meshes,true)?.[0]||null:null}
  _peerHit(a,b,p){const ab=b.clone().sub(a),len2=ab.lengthSq();if(len2<1e-9)return false;const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/len2,0,1),c=a.clone().add(ab.multiplyScalar(t));return c.distanceTo(p)<=this.mmToScene(450)}
  _damagePeer(a,b,item){if(!this.multiplayer?.connected)return false;for(const peer of this.multiplayer.peers?.values?.()||[]){if(peer.dead)continue;if(!this.state.multiplayer?.friendlyFire&&peer.team===this.multiplayer.team)continue;const v=this.multiplayer.remoteVisuals?.get(peer.clientId);if(!v)continue;const p=v.getWorldPosition(new THREE.Vector3());if(this._peerHit(a,b,p)){this.multiplayer.sendGameEvent?.('damage',{targetClientId:peer.clientId,damage:item.damage,attackerClientId:this.multiplayer.clientId,attackerName:this.multiplayer.name,team:this.multiplayer.team,projectile:'arrow'});this.onStatus(`🏹 HIT ${peer.name} (${item.damage})`,'command');return true}}return false}
  _stick(item,point){item.stuck=true;item.velocity.set(0,0,0);if(point)item.mesh.position.copy(point);setTimeout(()=>{if(item.mesh.parent)this.root.remove(item.mesh);item.dead=true;item.mesh.geometry?.dispose?.();item.mesh.material?.dispose?.()},5000)}
  update(now=performance.now()){
    let dt=Math.min(.033,Math.max(0,(Number(now)-this.last)/1000));this.last=Number(now)||performance.now();if(!dt)return;
    for(const item of this.items){if(item.dead||item.stuck)continue;item.age+=dt;if(item.age>item.life){item.dead=true;this.root.remove(item.mesh);continue}const a=item.mesh.position.clone();item.velocity.add(this._gravityAt(a).multiplyScalar(dt));const b=a.clone().add(item.velocity.clone().multiplyScalar(dt));
      if(this._damagePeer(a,b,item)){this._stick(item,b);continue}const hit=this._solidHit(a,b);if(hit){this._stick(item,hit.point);continue}if(this._terrainHit(b)){this._stick(item,b);continue}item.mesh.position.copy(b);const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),item.velocity.clone().normalize());item.mesh.quaternion.copy(q);
    }
    this.items=this.items.filter(x=>!x.dead)
  }
}
