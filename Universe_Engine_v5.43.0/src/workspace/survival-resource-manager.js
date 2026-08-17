import * as THREE from 'three';

const fract=x=>x-Math.floor(x);
const rand=(seed,i)=>fract(Math.sin(seed*91.17+i*133.31)*43758.5453);
const clone=v=>JSON.parse(JSON.stringify(v));

const NODE_DEFS={
  tree:{name:'木',icon:'🌲',hp:4,resource:'wood',yield:[2,4],tool:'axe',color:0x6c4c32},
  rock:{name:'岩',icon:'🪨',hp:5,resource:'stone',yield:[2,4],tool:'pickaxe',color:0x777b80},
  ore:{name:'鉄鉱床',icon:'⛏️',hp:7,resource:'ironOre',yield:[1,3],tool:'pickaxe',color:0x7f6557},
  fiber:{name:'繊維植物',icon:'🌿',hp:2,resource:'fiber',yield:[2,4],tool:null,color:0x4c8b4f}
};

export class SurvivalResourceManager{
  constructor({state,scene,planet,avatar,itemCrafting,onStatus=()=>{}}={}){this.state=state;this.scene=scene;this.planet=planet;this.avatar=avatar;this.itemCrafting=itemCrafting;this.onStatus=onStatus;this.group=new THREE.Group();this.group.name='survival-resource-nodes';scene.scene.add(this.group);this.meshes=new Map();this.ensureState();this.rebuild();}
  mmPerUnit(){return Math.max(1e-9,Number(this.state.workspace?.unitScaleMm)||10)}
  mmToScene(mm){return Number(mm||0)/this.mmPerUnit()}
  ensureState(){
    this.state.survival=this.state.survival||{};const s=this.state.survival;
    s.resourceNodes=Array.isArray(s.resourceNodes)?s.resourceNodes:[];s.harvestRangeMm=Number(s.harvestRangeMm)||1800;s.resourceRespawnMs=Number(s.resourceRespawnMs)||120000;
    if(!s.resourceNodes.length)this.generate(120);else if(s.resourceNodes.length<90)this.generate(120);return s;
  }
  generate(count=120){
    const s=this.state.survival||(this.state.survival={}),seed=Number(this.state.planet?.seed)||7,home=new THREE.Vector3(...(this.state.planet?.homeNormal||[0,1,0])).normalize();let tangent=new THREE.Vector3(1,0,0).projectOnPlane(home).normalize();if(tangent.lengthSq()<.01)tangent=new THREE.Vector3(0,0,1).projectOnPlane(home).normalize();const bitangent=new THREE.Vector3().crossVectors(home,tangent).normalize();const nodes=[];
    for(let i=0;i<count;i++){
      const angle=rand(seed+3001,i)*Math.PI*2,distMm=3500+rand(seed+3101,i)*26000,offset=tangent.clone().multiplyScalar(Math.cos(angle)*distMm/Math.max(1000,Number(this.state.planet?.radiusMm)||1000000)).add(bitangent.clone().multiplyScalar(Math.sin(angle)*distMm/Math.max(1000,Number(this.state.planet?.radiusMm)||1000000))),dir=home.clone().add(offset).normalize();
      const q=rand(seed+3201,i),type=q<.55?'tree':q<.73?'rock':q<.86?'ore':'fiber',def=NODE_DEFS[type];nodes.push({id:`RES-${seed}-${i+1}`,type,dir:dir.toArray(),hp:def.hp,maxHp:def.hp,depleted:false,depletedAt:0});
    }
    s.resourceNodes=nodes;return nodes;
  }
  _clear(){while(this.group.children.length){const o=this.group.children.pop();o.traverse?.(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m?.dispose?.());else c.material?.dispose?.()})}this.meshes.clear()}
  _nodeWorld(node){const dir=new THREE.Vector3(...node.dir).normalize();const rendered=this.planet?.renderedSurfacePoint?.(dir,0);if(rendered?.isVector3)return rendered.clone();const r=this.planet?.radiusScene?.()||this.mmToScene(Number(this.state.planet?.radiusMm)||1000000),h=this.planet?.heightAtDirection?.(dir)||0;return dir.multiplyScalar(r+h)}
  _makeNode(node){const def=NODE_DEFS[node.type]||NODE_DEFS.rock,pos=this._nodeWorld(node),normal=pos.clone().normalize(),up=new THREE.Vector3(0,1,0),q=new THREE.Quaternion().setFromUnitVectors(up,normal),g=new THREE.Group();g.name=node.id;g.userData={resourceNodeId:node.id,resourceType:node.type};const scale=this.mmToScene(node.type==='tree'?900:node.type==='fiber'?450:600);
    if(node.type==='tree'){
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(scale*.08,scale*.11,scale*.7,8),new THREE.MeshStandardMaterial({color:0x6c4c32,roughness:.95}));trunk.position.y=scale*.35;const crown=new THREE.Mesh(new THREE.ConeGeometry(scale*.34,scale*.85,9),new THREE.MeshStandardMaterial({color:0x397446,roughness:.95}));crown.position.y=scale*.9;g.add(trunk,crown);
    }else if(node.type==='fiber'){
      for(let i=0;i<5;i++){const stem=new THREE.Mesh(new THREE.ConeGeometry(scale*.08,scale*.6,5),new THREE.MeshStandardMaterial({color:def.color,roughness:.95}));stem.position.set((i-2)*scale*.08,scale*.3,(i%2)*scale*.06);stem.rotation.z=(i-2)*.08;g.add(stem)}
    }else{
      const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(scale*.34,node.type==='ore'?1:0),new THREE.MeshStandardMaterial({color:def.color,roughness:.92,metalness:node.type==='ore'?.18:0}));mesh.position.y=scale*.25;mesh.scale.set(1.2,.75,1);g.add(mesh);if(node.type==='ore'){const vein=new THREE.Mesh(new THREE.BoxGeometry(scale*.08,scale*.35,scale*.08),new THREE.MeshStandardMaterial({color:0xc28b67,metalness:.7,roughness:.4}));vein.position.set(scale*.1,scale*.35,scale*.18);g.add(vein)}}
    g.position.copy(pos);g.quaternion.copy(q);g.visible=!node.depleted;this.group.add(g);this.meshes.set(node.id,g);return g;
  }
  rebuild(){this.ensureState();this._clear();for(const n of this.state.survival.resourceNodes)this._makeNode(n);this.group.visible=!!this.state.planet?.enabled;}
  update(){const now=Date.now(),resp=Number(this.state.survival?.resourceRespawnMs)||120000;let changed=false;for(const n of this.state.survival?.resourceNodes||[]){if(n.depleted&&n.depletedAt&&now-n.depletedAt>=resp){const d=NODE_DEFS[n.type]||NODE_DEFS.rock;n.depleted=false;n.hp=d.hp;n.maxHp=d.hp;n.depletedAt=0;changed=true;const m=this.meshes.get(n.id);if(m)m.visible=true}}return changed}
  nodeCadPosition(node){
    if(!node)return null;const w=this._nodeWorld(node);
    try{return this.scene?.worldPointToCad?this.scene.worldPointToCad(w):[w.x,w.z,w.y]}catch{return [w.x,w.z,w.y]}
  }
  nearestToCad(position,{types=null,maxMm=12000}={}){
    this.update();const allowed=types?new Set(Array.isArray(types)?types:[types]):null;let best=null,bestD=Infinity;
    for(const n of this.state.survival?.resourceNodes||[]){if(n.depleted||allowed&&!allowed.has(n.type))continue;const p=this.nodeCadPosition(n);if(!p)continue;const d=Math.hypot((p[0]||0)-(position?.[0]||0),(p[1]||0)-(position?.[1]||0),(p[2]||0)-(position?.[2]||0));if(d<bestD&&d<=maxMm){best=n;bestD=d}}
    return best?{node:best,position:this.nodeCadPosition(best),distanceMm:bestD}:null;
  }
  harvestNodeForNpc(nodeId,{power=1}={}){
    const n=(this.state.survival?.resourceNodes||[]).find(x=>x.id===nodeId);if(!n||n.depleted)return null;const def=NODE_DEFS[n.type]||NODE_DEFS.rock;n.hp=Math.max(0,Number(n.hp||def.hp)-Math.max(.25,Number(power)||1));if(n.hp>0)return {depleted:false,type:n.type,resource:def.resource,qty:0,hp:n.hp};
    const amount=Math.max(def.yield[0],Math.floor((def.yield[0]+def.yield[1])/2));n.depleted=true;n.depletedAt=Date.now();const m=this.meshes.get(n.id);if(m)m.visible=false;return {depleted:true,type:n.type,resource:def.resource,qty:amount,hp:0};
  }
  nearest(maxMm=null){const root=this.avatar?.root||this.avatar?.group;if(!root)return null;const p=new THREE.Vector3();root.getWorldPosition?.(p);let best=null,bestD=Infinity,limit=this.mmToScene(maxMm||this.state.survival?.harvestRangeMm||1800);for(const n of this.state.survival?.resourceNodes||[]){if(n.depleted)continue;const np=this._nodeWorld(n),d=p.distanceTo(np);if(d<bestD&&d<=limit){best=n;bestD=d}}return best?{node:best,distanceMm:bestD*this.mmPerUnit()}:null}
  harvestNearest(){this.update();const hit=this.nearest();if(!hit){this.onStatus('採取できる資源が近くにありません','info');return false}const n=hit.node,def=NODE_DEFS[n.type]||NODE_DEFS.rock,eq=this.itemCrafting?.equippedItem?.('right')||this.itemCrafting?.equippedItem?.('left'),tool=eq?.stats?.tool||null,power=Math.max(1,Number(eq?.stats?.power)||1);let damage=1;
    if(def.tool){if(tool===def.tool)damage=power;else if(n.type==='tree'&&eq?.type==='weapon')damage=1;else damage=.35}
    n.hp=Math.max(0,Number(n.hp||def.hp)-damage);this.onStatus(`${def.icon} ${def.name}: ${Math.ceil(n.hp)}/${n.maxHp} HP${def.tool&&tool!==def.tool?'（適した道具で効率UP）':''}`,'command');
    if(n.hp<=0){const seed=(Number(this.state.planet?.seed)||7)+String(n.id).length,lo=def.yield[0],hi=def.yield[1],amount=Math.floor(lo+rand(seed,Date.now()%997)*(hi-lo+1));this.itemCrafting?.addResource?.(def.resource,amount);n.depleted=true;n.depletedAt=Date.now();const m=this.meshes.get(n.id);if(m)m.visible=false;this.onStatus(`${def.icon} ${def.name}を採取: ${def.resource} +${amount}`,'command')}
    return true;
  }
  snapshot(){return clone(this.state.survival)}
}
