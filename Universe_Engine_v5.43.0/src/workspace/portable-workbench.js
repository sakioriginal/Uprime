import * as THREE from 'three';

function disposeObject(o){o.traverse?.(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m?.dispose?.());else c.material?.dispose?.()})}

function stablePlanetQuaternion(normal,yawDeg=0){
  const up=normal.clone().normalize();
  let forward=new THREE.Vector3(0,0,-1).projectOnPlane(up);
  if(forward.lengthSq()<1e-8)forward=new THREE.Vector3(1,0,0).projectOnPlane(up);
  forward.normalize();
  const yawQ=new THREE.Quaternion().setFromAxisAngle(up,(Number(yawDeg)||0)*Math.PI/180);
  forward.applyQuaternion(yawQ).projectOnPlane(up).normalize();
  const right=new THREE.Vector3().crossVectors(forward,up).normalize();
  const back=forward.clone().negate();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));
}

export class PortableWorkbenchManager{
  constructor(state,scene,workspace,avatar,planet){
    this.state=state;this.scene=scene;this.workspace=workspace;this.avatar=avatar;this.planet=planet;
    this.group=new THREE.Group();this.group.name='portable-workbenches';scene.scene.add(this.group);this.meshes=new Map();this.ensureState();if(!this.state.workbenches.some(w=>w.active)&&this.state.workbenches[0])this.state.workbenches[0].active=true;this.rebuild();this.updateWorkOrigin();
  }
  ensureState(){
    this.state.inventory=this.state.inventory||{items:[]};
    this.state.workbenches=this.state.workbenches||[];
    if(!this.state.workbenches.length){const wb=this.create('Workbench 01',{location:'planet',position:[0,0,0],stored:true});wb.stored=true;wb.active=false;if(!this.state.inventory.items.some(x=>x.refId===wb.id))this.state.inventory.items.push({type:'workbench',refId:wb.id,name:wb.name});this.rebuildOne(wb)}
    return this.state.workbenches;
  }
  dimensions(){const h=Math.max(80,Number(this.state.avatar?.height)||170);return{height:h/2,width:h,depth:h}}
  create(name='Workbench',opts={}){
    const d=this.dimensions(),id=`WB-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*999).toString().padStart(3,'0')}`;
    const wb={id,name,stored:opts.stored===true,active:opts.active===true,location:opts.location||'workspace',position:opts.position||[0,0,0],planetNormal:opts.planetNormal||[0,1,0],yaw:opts.yaw||0,dimensions:d,grid:{enabled:true,majorDivisions:10,minorDivisions:5}};
    this.state.workbenches.push(wb);this.rebuildOne(wb);return wb;
  }
  _makeBench(wb){
    const root=new THREE.Group();root.name=wb.id;root.userData={portableWorkbench:true,workbenchId:wb.id};
    const d=wb.dimensions||this.dimensions(),mat=new THREE.MeshStandardMaterial({color:0x65717a,roughness:.72,metalness:.18});
    const topT=Math.max(3,d.height*.055),top=new THREE.Mesh(new THREE.BoxGeometry(d.width,topT,d.depth),mat);top.position.y=d.height;top.userData={portableWorkbench:true,workbenchId:wb.id,placementSurface:true};root.add(top);this.scene.workspaceColliders=this.scene.workspaceColliders||[];this.scene.workspacePlacementSurfaces=this.scene.workspacePlacementSurfaces||[];this.scene.workspaceColliders.push(top);this.scene.workspacePlacementSurfaces.push(top);
    const legMat=new THREE.MeshStandardMaterial({color:0x46515a,roughness:.8,metalness:.22}),legW=Math.max(4,d.width*.045);for(const sx of [-1,1])for(const sz of [-1,1]){const leg=new THREE.Mesh(new THREE.BoxGeometry(legW,d.height,legW),legMat);leg.position.set(sx*(d.width/2-legW),d.height/2,sz*(d.depth/2-legW));root.add(leg)}
    const grid=new THREE.GridHelper(d.width,20,0x7fc9ff,0x365368);grid.name='WorkbenchGrid';grid.position.y=d.height+topT/2+.3;grid.scale.z=d.depth/d.width;root.add(grid);root.userData.topY=d.height+topT/2;
    return root;
  }
  rebuild(){for(const o of [...this.group.children]){this.group.remove(o);disposeObject(o)}this.meshes.clear();for(const wb of this.ensureState())this.rebuildOne(wb)}
  rebuildOne(wb){const old=this.meshes.get(wb.id);if(old){this.group.remove(old);disposeObject(old)}if(wb.stored)return null;const root=this._makeBench(wb);this.group.add(root);this.meshes.set(wb.id,root);this.syncOne(wb);return root}
  syncOne(wb){const root=this.meshes.get(wb.id);if(!root)return;if(wb.location==='planet'&&this.planet){const n=new THREE.Vector3(...(wb.planetNormal||[0,1,0])).normalize(),radius=this.planet.surfaceRadius(n);root.position.copy(n.clone().multiplyScalar(radius));root.quaternion.copy(stablePlanetQuaternion(n,wb.yaw));root.updateMatrixWorld(true)}else{const p=wb.position||[0,0,0];root.position.set(p[0],p[2]||0,p[1]);root.rotation.set(0,-(Number(wb.yaw)||0)*Math.PI/180,0)}root.visible=!wb.stored}
  active(){return this.state.workbenches.find(w=>w.active&&!w.stored)||this.state.workbenches.find(w=>!w.stored)||null}
  setActive(id){for(const w of this.state.workbenches)w.active=w.id===id;const wb=this.state.workbenches.find(w=>w.id===id);if(wb)this.updateWorkOrigin(wb);return wb}
  designFrame(wb=this.active()){
    if(!wb)return null;const root=this.meshes.get(wb.id);if(!root)return null;
    root.updateMatrixWorld(true);
    const d=wb.dimensions||this.dimensions(),topY=Number(root.userData?.topY)||Number(d.height)||0;
    const offsetWorkspace=(Number(this.state.workspace?.workOriginOffsetMm)||100)/(Number(this.state.workspace?.unitScaleMm)||10);
    const origin=root.localToWorld(new THREE.Vector3(0,topY+offsetWorkspace,0));
    const q=new THREE.Quaternion();root.getWorldQuaternion(q);
    return {workbench:wb,originWorld:origin,quaternion:q,up:new THREE.Vector3(0,1,0).applyQuaternion(q).normalize()};
  }
  updateWorkOrigin(wb=this.active()){
    if(!wb)return null;const frame=this.designFrame(wb);if(!frame)return null;
    const w=frame.originWorld;this.state.workspace.workOriginWorld=[w.x,w.y,w.z];this.state.workspace.workOrigin=[0,0,0];
    const root=this.meshes.get(wb.id),d=wb.dimensions||this.dimensions(),topY=root?Number(root.userData&&root.userData.topY)||Number(d.height)||0:Number(d.height)||0;
    const unitScaleMm=Math.max(1e-9,Number(this.state.workspace&&this.state.workspace.unitScaleMm)||10),offsetMm=Number(this.state.workspace&&this.state.workspace.workOriginOffsetMm)||100;
    this.state.workspace.groundBaseCadZ=-(topY*unitScaleMm+offsetMm);this.state.workspace.baseReference=wb.location==='planet'?'planet-ground':'workspace-floor';
    return this.state.workspace.workOrigin;
  }
  store(id=null){const wb=this.state.workbenches.find(w=>w.id===(id||this.active()?.id));if(!wb)return false;wb.stored=true;wb.active=false;this.state.inventory.items=this.state.inventory.items.filter(x=>x.refId!==wb.id);this.state.inventory.items.push({type:'workbench',refId:wb.id,name:wb.name});this.rebuildOne(wb);this.avatar?.recoverToTerrainGround?.();return true}
  deploy(id=null){let wb=this.state.workbenches.find(w=>w.id===id)||this.state.workbenches.find(w=>w.stored);if(!wb)return false;wb.stored=false;this.state.inventory.items=this.state.inventory.items.filter(x=>x.refId!==wb.id);if(this.state.avatar?.onPlanet&&this.planet){
      wb.location='planet';
      // Deploy in front of the avatar instead of at the avatar's center.
      const n=new THREE.Vector3(...(this.state.avatar.planetNormal||[0,1,0])).normalize();
      const yaw=Number(this.state.avatar.yaw)||0;
      let forward=new THREE.Vector3(0,0,-1).projectOnPlane(n);
      if(forward.lengthSq()<1e-8)forward=new THREE.Vector3(1,0,0).projectOnPlane(n);
      forward.normalize().applyQuaternion(new THREE.Quaternion().setFromAxisAngle(n,yaw*Math.PI/180)).projectOnPlane(n).normalize();
      const radius=Math.max(1e-6,this.planet.surfaceRadius(n));
      const distanceScene=this.planet.mmToScene?this.planet.mmToScene(2500):250;
      const angle=Math.min(.25,distanceScene/radius);
      const target=n.clone().multiplyScalar(Math.cos(angle)).add(forward.multiplyScalar(Math.sin(angle))).normalize();
      wb.planetNormal=target.toArray();wb.yaw=yaw
    }else{wb.location='workspace';const p=this.state.avatar?.position||[0,0,0],yaw=(Number(this.state.avatar?.yaw)||0)*Math.PI/180;wb.position=[p[0]+Math.sin(yaw)*120,p[1]-Math.cos(yaw)*120,p[2]||0];wb.yaw=Number(this.state.avatar?.yaw)||0}this.rebuildOne(wb);this.setActive(wb.id);return wb}
  list(){return this.state.workbenches.map(w=>({id:w.id,name:w.name,stored:w.stored,location:w.location,active:w.active,dimensions:w.dimensions}))}
}
