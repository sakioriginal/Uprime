import * as THREE from 'three';
import {OrbitalMechanics,STANDARD_GRAVITY} from './orbital-mechanics.js';

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
const AU_M=149597870700;
const SOLAR_MU=1.32712440018e20;
const SOLAR_ORBITS_M={
  'SOL-P01':.387098*AU_M,'SOL-P02':.723332*AU_M,'SOL-P03':1*AU_M,'PLANET-HOME-0001':1*AU_M,
  'SOL-P04':1.523679*AU_M,'SOL-P05':5.2044*AU_M,'SOL-P06':9.5826*AU_M,'SOL-P07':19.2184*AU_M,'SOL-P08':30.11*AU_M,
  'PLANET-NEIGHBOR-0002':1.523679*AU_M
};

export class SpacecraftFlightManager{
  constructor(state,scene,parts,onUpdate=null){
    this.state=state;this.scene=scene;this.parts=parts;this.onUpdate=onUpdate;this.ensureState();this._last=0;
    this.exhaustGroup=new THREE.Group();this.exhaustGroup.name='SpacecraftExhaust';this.scene?.scene?.add?.(this.exhaustGroup);this.exhaustMeshes=new Map();
    this.raycaster=new THREE.Raycaster();
    scene&&scene.addLoopHook&&scene.addLoopHook(now=>{const dt=this._last?Math.min(.1,Math.max(0,(Number(now)-this._last)/1000)):.016;this._last=Number(now)||0;this.update(dt)})
  }
  ensureState(){
    this.state.spacecraft=this.state.spacecraft&&typeof this.state.spacecraft==='object'?this.state.spacecraft:{crafts:[],activeId:null,nextId:1};
    const s=this.state.spacecraft;s.crafts=Array.isArray(s.crafts)?s.crafts:[];s.nextId=Number(s.nextId)||1;if(!Number.isFinite(Number(s.transferDaysPerSecond)))s.transferDaysPerSecond=20;
    if(!s.controlKeys)s.controlKeys={};if(s.enginePlume===undefined)s.enginePlume=true;
    for(const c of s.crafts){if(!c.cameraMode)c.cameraMode='cockpit';if(!c.cameraOrbit)c.cameraOrbit={yaw:35,pitch:20,distance:420};if(!c.control)c.control={pitch:0,yaw:0,roll:0};if(c.walkMode===undefined)c.walkMode=false;if(c.modifyMode===undefined)c.modifyMode=false}
    return s
  }
  active(){const s=this.ensureState();return s.crafts.find(c=>c.id===s.activeId)||null}
  _partMeta(p){return p&&p.components&&p.components.spacecraftPart?p.components.spacecraftPart:(p&&p.metadata&&p.metadata.spacecraftPart?p.metadata.spacecraftPart:{})}
  _craftStats(parts){
    let dry=0,fuel=0,thrust=0,weightedIsp=0;
    for(const p of parts){const k=this.parts.kindOf(p),m=this._partMeta(p);if(k==='engine'){dry+=320;thrust+=n(m.thrustN,220000);weightedIsp+=n(m.thrustN,220000)*n(m.ispSec,300)}else if(k==='tank'){dry+=180;fuel+=n(m.fuelKg,850)}else if(k==='seat')dry+=120;else if(k==='landing')dry+=80;else if(k==='parachute')dry+=45;else if(k==='rcs'){dry+=35;thrust+=n(m.thrustN,1200);weightedIsp+=n(m.thrustN,1200)*n(m.ispSec,220)}else dry+=100}
    return{dryMassKg:Math.max(1,dry),fuelKg:Math.max(0,fuel),thrustN:Math.max(0,thrust),ispSec:thrust>0?weightedIsp/thrust:300}
  }
  _planetPhysics(){const p=this.state.planet||{},radiusM=Math.max(1,n(p.radiusMm,1000000)/1000),g=Math.max(.01,n(p.surfaceGravityMS2,STANDARD_GRAVITY)),mu=OrbitalMechanics.muFromSurfaceGravity(radiusM,g);return{radiusM,g,mu}}
  _homeNormal(){const a=this.state.planet&&Array.isArray(this.state.planet.homeNormal)?this.state.planet.homeNormal:[0,1,0];const v=new THREE.Vector3(n(a[0],0),n(a[1],1),n(a[2],0));return v.lengthSq()>.0001?v.normalize():new THREE.Vector3(0,1,0)}
  _initialTangent(normal){const axis=Math.abs(normal.y)<.92?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);return new THREE.Vector3().crossVectors(axis,normal).normalize()}
  assembleSelected(){
    const selected=this.state.selectedObjects?this.state.selectedObjects():[];if(!selected.length)throw new Error('宇宙船にする部品を選択してください');const kinds=selected.map(p=>this.parts.kindOf(p)).filter(Boolean),stats=this._craftStats(selected),id=`CRAFT-${String(this.state.spacecraft.nextId++).padStart(3,'0')}`,body=this._planetPhysics(),normal=this._homeNormal(),r=body.radiusM;
    const pos=normal.clone().multiplyScalar(r),vel=new THREE.Vector3(),craft={id,name:id,partIds:selected.map(p=>p.id),stage:'landed',pilot:false,walkMode:false,modifyMode:false,cameraMode:'cockpit',cameraOrbit:{yaw:35,pitch:20,distance:420},control:{pitch:0,yaw:0,roll:0},altitudeMm:0,orbitAltitudeMm:200000,throttle:1,targetCelestialId:null,transferProgress:0,transferPlan:null,transferElapsedDays:0,fuelKg:stats.fuelKg,dryMassKg:stats.dryMassKg,thrustN:stats.thrustN,ispSec:stats.ispSec,kinds,centralBodyId:'PLANET-HOME-0001',physics:{positionM:pos.toArray(),velocityMS:vel.toArray(),lastVisualPositionM:pos.toArray(),mu:body.mu,radiusM:body.radiusM,surfaceGravityMS2:body.g}};
    this.state.spacecraft.crafts.push(craft);this.state.spacecraft.activeId=id;this.onUpdate&&this.onUpdate(craft);return craft
  }
  board(){
    const c=this.active();if(!c)throw new Error('宇宙船を組み立ててください');if(!c.kinds.includes('seat'))throw new Error('運転席がありません');
    c.walkMode=false;c.pilot=true;c.cameraMode='cockpit';c.cameraOrbit={yaw:0,pitch:0,distance:n(c.cameraOrbit&&c.cameraOrbit.distance,420)};
    if(this.state.avatar){c._avatarRestore={enabled:this.state.avatar.enabled!==false,mode:this.state.avatar.mode,onPlanet:!!this.state.avatar.onPlanet};this.state.avatar.enabled=false;this.state.avatar.onPlanet=false;this.state.avatar.mode='fpv'}
    this._syncPilotCamera(c,true);this.onUpdate&&this.onUpdate(c);return c
  }
  unboard(){
    const c=this.active();if(!c)return null;c.pilot=false;c.walkMode=false;
    if(this.state.avatar){this.state.avatar.enabled=c._avatarRestore?c._avatarRestore.enabled:true;this.state.avatar.mode=c._avatarRestore&&c._avatarRestore.mode?c._avatarRestore.mode:'tpv';if(c._avatarRestore)this.state.avatar.onPlanet=!!c._avatarRestore.onPlanet}
    c._avatarRestore=null;this.onUpdate&&this.onUpdate(c);return c
  }
  enterWalkMode(mode='tpv'){
    const c=this.active();if(!c)throw new Error('宇宙船がありません');const center=this._craftVisualCenter(c);if(!center)throw new Error('宇宙船の表示位置を取得できません');
    c.pilot=false;c.walkMode=true;c.cameraMode='interior';
    const a=this.state.avatar||{};if(!c._avatarRestore)c._avatarRestore={enabled:a.enabled!==false,mode:a.mode,onPlanet:!!a.onPlanet};a.enabled=true;a.onPlanet=false;a.mode=mode==='fpv'?'fpv':'tpv';
    const deckY=this._deckHeight(c,center.y);a.position=[center.x,center.z,deckY];a.yaw=Number(a.yaw)||0;this.onUpdate&&this.onUpdate(c);return c
  }
  exitWalkMode(){const c=this.active();if(!c)return null;c.walkMode=false;return this.board()}
  setModifyMode(enabled=true){const c=this.active();if(!c)throw new Error('宇宙船がありません');c.modifyMode=!!enabled;if(c.modifyMode){this.state.creator=this.state.creator||{};this.state.creator.enabled=true}this.onUpdate&&this.onUpdate(c);return c.modifyMode}
  setCameraMode(mode){const c=this.active();if(!c)throw new Error('宇宙船がありません');const m=String(mode||'cockpit').toLowerCase();c.cameraMode=['cockpit','chase','orbit','interior'].includes(m)?m:'cockpit';if(c.cameraMode==='orbit'&&Math.abs(n(c.cameraOrbit&&c.cameraOrbit.yaw,0))<.001&&Math.abs(n(c.cameraOrbit&&c.cameraOrbit.pitch,0))<.001)c.cameraOrbit={yaw:35,pitch:20,distance:n(c.cameraOrbit&&c.cameraOrbit.distance,420)};if(c.cameraMode!=='interior')c.pilot=true;this._syncPilotCamera(c,true);this.onUpdate&&this.onUpdate(c);return c.cameraMode}
  cycleCameraMode(){const c=this.active();if(!c)return null;const seq=['cockpit','chase','orbit'];const i=Math.max(0,seq.indexOf(c.cameraMode));return this.setCameraMode(seq[(i+1)%seq.length])}
  applyCameraOrbitDelta(dx,dy){const c=this.active();if(!c)return;c.cameraOrbit=c.cameraOrbit||{yaw:35,pitch:20,distance:420};c.cameraOrbit.yaw=(n(c.cameraOrbit.yaw,35)+n(dx,0))%360;c.cameraOrbit.pitch=clamp(n(c.cameraOrbit.pitch,20)+n(dy,0),-75,80)}
  setControlInput(yaw=0,pitch=0,roll=0){const c=this.active();if(!c)return;c.control={yaw:clamp(n(yaw,0),-1,1),pitch:clamp(n(pitch,0),-1,1),roll:clamp(n(roll,0),-1,1)}}
  handleKey(event,pressed){const c=this.active();if(!c||!c.pilot||c.walkMode)return false;const k=String(event.key||'').toUpperCase(),keys=this.state.spacecraft.controlKeys||(this.state.spacecraft.controlKeys={});if(['W','S','A','D','Q','E'].includes(k)){keys[k]=!!pressed;this._syncKeyControls();return true}if(pressed&&k==='SHIFT'){this.setThrottle(clamp(n(c.throttle,0)+.05,0,1));return true}if(pressed&&(k==='CONTROL'||k==='CTRL')){this.setThrottle(clamp(n(c.throttle,0)-.05,0,1));return true}if(pressed&&k==='C'){this.cycleCameraMode();return true}return false}
  _syncKeyControls(){const k=this.state.spacecraft.controlKeys||{};this.setControlInput((k.D?1:0)-(k.A?1:0),(k.W?1:0)-(k.S?1:0),(k.E?1:0)-(k.Q?1:0))}
  _partByKind(c,kind){for(const id of c.partIds||[]){const part=this.state.object&&this.state.object(id);if(part&&this.parts.kindOf(part)===kind)return part}return null}
  _craftVisualCenter(c){let sum=new THREE.Vector3(),count=0;for(const id of c.partIds||[]){const part=this.state.object&&this.state.object(id);if(part&&part.mesh){part.mesh.updateMatrixWorld(true);const q=new THREE.Vector3();part.mesh.getWorldPosition(q);sum.add(q);count++}}return count?sum.multiplyScalar(1/count):null}
  _craftBounds(c){const box=new THREE.Box3(),tmp=new THREE.Box3();let any=false;for(const id of c.partIds||[]){const part=this.state.object&&this.state.object(id);if(part&&part.mesh){part.mesh.updateMatrixWorld(true);tmp.setFromObject(part.mesh);if(!tmp.isEmpty()){box.union(tmp);any=true}}}return any?box:null}
  _deckHeight(c,fallback=0){const box=this._craftBounds(c);return box?box.min.y+Math.max(2,(box.max.y-box.min.y)*.08):fallback}
  _syncPilotCamera(c,force=false){
    if(!c||!c.pilot||!this.scene||!this.scene.camera)return;const seat=this._partByKind(c,'seat'),center=this._craftVisualCenter(c);if(!center)return;
    const pv=this._vectors(c),up=pv.p.lengthSq()>.001?pv.p.clone().normalize():new THREE.Vector3(0,1,0),forward=pv.v.lengthSq()>.01?pv.v.clone().normalize():this._initialTangent(up),right=new THREE.Vector3().crossVectors(forward,up).normalize();
    const cam=this.scene.camera,target=this.scene.controls.target;
    if(c.cameraMode==='cockpit'){
      let eye=center.clone();if(seat&&seat.mesh){seat.mesh.updateMatrixWorld(true);seat.mesh.getWorldPosition(eye)}eye.add(up.clone().multiplyScalar(5));cam.position.lerp(eye,force?1:.35);cam.up.copy(up);const o=c.cameraOrbit||{yaw:0,pitch:0,distance:420},yaw=THREE.MathUtils.degToRad(n(o.yaw,0)),pitch=THREE.MathUtils.degToRad(n(o.pitch,0)),look=forward.clone().applyAxisAngle(up,yaw),lookRight=new THREE.Vector3().crossVectors(look,up).normalize();look.applyAxisAngle(lookRight,pitch).normalize();target.copy(cam.position).add(look.multiplyScalar(100));
    }else if(c.cameraMode==='chase'){
      const box=this._craftBounds(c),size=box?box.getSize(new THREE.Vector3()).length():180,eye=center.clone().add(forward.clone().multiplyScalar(-Math.max(140,size*1.8))).add(up.clone().multiplyScalar(Math.max(60,size*.6)));cam.position.lerp(eye,force?1:.18);cam.up.copy(up);target.copy(center).add(forward.clone().multiplyScalar(size*.2));
    }else{
      const o=c.cameraOrbit||{yaw:35,pitch:20,distance:420},box=this._craftBounds(c),size=box?Math.max(80,box.getSize(new THREE.Vector3()).length()):160,dist=Math.max(size*1.4,n(o.distance,420)),yaw=THREE.MathUtils.degToRad(n(o.yaw,35)),pitch=THREE.MathUtils.degToRad(n(o.pitch,20));
      const horiz=forward.clone().multiplyScalar(-Math.cos(yaw)).add(right.clone().multiplyScalar(Math.sin(yaw))).normalize().multiplyScalar(Math.cos(pitch)*dist),vert=up.clone().multiplyScalar(Math.sin(pitch)*dist),eye=center.clone().add(horiz).add(vert);cam.position.lerp(eye,force?1:.22);cam.up.copy(up);target.copy(center)
    }
    this.scene.controls.enabled=true;this.scene.controls.update()
  }
  positionInfo(){
    const c=this.active();if(!c)return null;if(c.stage==='transfer'&&c.transferPlan){return{mode:'transfer',centralBodyId:c.centralBodyId,targetId:c.targetCelestialId,progress:c.transferProgress||0,elapsedDays:c.transferElapsedDays||0,totalDays:n(c.transferPlan.timeDays,0)}}
    const {p}=this._vectors(c),r=p.length(),bodyR=n(c.physics&&c.physics.radiusM,this._planetPhysics().radiusM),lat=Math.asin(clamp(p.y/Math.max(1e-9,r),-1,1))*180/Math.PI,lon=Math.atan2(p.z,p.x)*180/Math.PI;
    return{mode:'local',centralBodyId:c.centralBodyId,xM:p.x,yM:p.y,zM:p.z,radiusM:r,altitudeM:r-bodyR,latitudeDeg:lat,longitudeDeg:lon}
  }
  setThrottle(v){const c=this.active();if(!c)throw new Error('宇宙船がありません');c.throttle=clamp(n(v,1),0,1);return c.throttle}
  launch(){const c=this.active();if(!c)throw new Error('宇宙船がありません');if(!c.pilot)throw new Error('先に運転席へ搭乗してください');if(!c.kinds.includes('engine'))throw new Error('エンジンがありません');if(!c.kinds.includes('tank')||c.fuelKg<=0)throw new Error('燃料タンクまたは燃料がありません');c.stage='ascent';c.throttle=Math.max(.05,n(c.throttle,1));this.onUpdate&&this.onUpdate(c);return c}
  _vectors(c){const ph=c.physics||(c.physics={});return{p:new THREE.Vector3().fromArray(ph.positionM||[0,1,0]),v:new THREE.Vector3().fromArray(ph.velocityMS||[0,0,0])}}
  _saveVectors(c,p,v){c.physics.positionM=p.toArray();c.physics.velocityMS=v.toArray();const bodyR=n(c.physics.radiusM,this._planetPhysics().radiusM);c.altitudeMm=Math.max(0,(p.length()-bodyR)*1000)}
  _consumeDeltaV(c,dv){const need=OrbitalMechanics.rocketFuelForDeltaV(Math.abs(dv),n(c.dryMassKg,1),n(c.fuelKg,0),n(c.ispSec,300));if(need>c.fuelKg+.000001)throw new Error('要求Δvに対して燃料が不足しています');c.fuelKg=Math.max(0,c.fuelKg-need);return need}
  setOrbit(altitudeMm=null){
    const c=this.active();if(!c)throw new Error('宇宙船がありません');const body=this._planetPhysics();if(altitudeMm!==null&&altitudeMm!==undefined)c.orbitAltitudeMm=Math.max(1000,n(altitudeMm,c.orbitAltitudeMm));const radius=body.radiusM+c.orbitAltitudeMm/1000,{p,v}=this._vectors(c),radial=p.lengthSq()>.001?p.clone().normalize():this._homeNormal();p.copy(radial).multiplyScalar(radius);const tangent=OrbitalMechanics.tangentAt(p,this._initialTangent(radial)),desired=tangent.multiplyScalar(OrbitalMechanics.circularVelocity(radius,body.mu)),dv=desired.clone().sub(v).length();if(dv>0)this._consumeDeltaV(c,dv);v.copy(desired);c.stage='orbit';c.centralBodyId='PLANET-HOME-0001';c.physics.mu=body.mu;c.physics.radiusM=body.radiusM;this._saveVectors(c,p,v);this._syncVisual(c,p);this.onUpdate&&this.onUpdate(c);return c
  }
  burn(direction='prograde',deltaVMS=1){
    const c=this.active();if(!c)throw new Error('宇宙船がありません');if(!['orbit','ascent','coast'].includes(c.stage))throw new Error('局所軌道飛行中に使用してください');const dv=n(deltaVMS,0);if(!dv)return c;this._consumeDeltaV(c,dv);const {p,v}=this._vectors(c),radial=p.clone().normalize(),pro=v.lengthSq()>.0001?v.clone().normalize():OrbitalMechanics.tangentAt(p),normal=new THREE.Vector3().crossVectors(radial,pro).normalize();let dir=pro;if(String(direction).toLowerCase()==='retrograde')dir=pro.clone().negate();else if(String(direction).toLowerCase()==='radial')dir=radial;else if(String(direction).toLowerCase()==='antiradial')dir=radial.clone().negate();else if(String(direction).toLowerCase()==='normal')dir=normal;else if(String(direction).toLowerCase()==='antinormal')dir=normal.clone().negate();v.addScaledVector(dir,Math.abs(dv));this._saveVectors(c,p,v);this.onUpdate&&this.onUpdate(c);return c
  }
  transfer(targetId){
    const c=this.active();if(!c)throw new Error('宇宙船がありません');if(c.stage!=='orbit')throw new Error('まず軌道投入してください');const target=targetId||'SOL-P04',r1=SOLAR_ORBITS_M['SOL-P03'],r2=SOLAR_ORBITS_M[target]||SOLAR_ORBITS_M['SOL-P04'],plan=OrbitalMechanics.hohmann(SOLAR_MU,r1,r2);c.stage='transfer';c.centralBodyId='STAR-SOL-0001';c.targetCelestialId=target;c.transferProgress=0;c.transferElapsedDays=0;c.transferPlan={...plan,timeDays:plan.timeSec/86400};this.onUpdate&&this.onUpdate(c);return c
  }
  land(){const c=this.active();if(!c)throw new Error('宇宙船がありません');if(c.stage==='transfer')throw new Error('航行中です。到着軌道まで待ってください');if(c.stage==='arrival-orbit'){c.centralBodyId=c.targetCelestialId||'PLANET-HOME-0001'}c.stage='descent';this.onUpdate&&this.onUpdate(c);return c}
  _syncVisual(c,currentPositionM){
    if(!currentPositionM)return;const ph=c.physics||(c.physics={}),prev=new THREE.Vector3().fromArray(ph.lastVisualPositionM||currentPositionM.toArray()),delta=currentPositionM.clone().sub(prev).multiplyScalar(1000);ph.lastVisualPositionM=currentPositionM.toArray();if(delta.lengthSq()<1e-12)return;
    for(const id of c.partIds){const part=this.state.object&&this.state.object(id);if(!part||!Array.isArray(part.position))continue;part.position[0]+=delta.x;part.position[1]+=delta.y;part.position[2]+=delta.z;this.scene&&this.scene.sync&&this.scene.sync(part)}
    if(c.walkMode&&this.state.avatar&&Array.isArray(this.state.avatar.position)){this.state.avatar.position[0]+=delta.x;this.state.avatar.position[1]+=delta.z;this.state.avatar.position[2]+=delta.y}
  }
  _localIntegrate(c,dt,extraA=null){const {p,v}=this._vectors(c),mu=n(c.physics&&c.physics.mu,this._planetPhysics().mu);OrbitalMechanics.integrate(p,v,dt,mu,extraA);this._saveVectors(c,p,v);this._syncVisual(c,p);return{p,v}}
  _controlAcceleration(c,p,v){
    const ctrl=c.control||{},mag=Math.hypot(n(ctrl.pitch,0),n(ctrl.yaw,0));if(mag<.001)return new THREE.Vector3();const radial=p.clone().normalize(),pro=v.lengthSq()>.001?v.clone().normalize():this._initialTangent(radial),right=new THREE.Vector3().crossVectors(pro,radial).normalize(),steer=radial.clone().multiplyScalar(n(ctrl.pitch,0)).add(right.multiplyScalar(n(ctrl.yaw,0)));if(steer.lengthSq()<.001)return new THREE.Vector3();const rcs=c.kinds.includes('rcs')?Math.max(2,n(c.thrustN,0)*.015):Math.max(1,n(c.thrustN,0)*.003),mass=Math.max(1,n(c.dryMassKg,1)+n(c.fuelKg,0));return steer.normalize().multiplyScalar(rcs/mass)
  }
  _updateWalkableAvatar(c){
    if(!c.walkMode||!this.state.avatar||!Array.isArray(this.state.avatar.position))return;const a=this.state.avatar,world=new THREE.Vector3(a.position[0],a.position[2]+500,a.position[1]),meshes=[];for(const id of c.partIds||[]){const part=this.state.object&&this.state.object(id);if(part&&part.mesh)meshes.push(part.mesh)}if(!meshes.length)return;this.raycaster.set(world,new THREE.Vector3(0,-1,0));this.raycaster.far=1200;const hits=this.raycaster.intersectObjects(meshes,true);if(hits.length){const y=hits[0].point.y;a.position[2]=y}
  }
  _ensureExhaust(c){
    const engines=(c.partIds||[]).map(id=>this.state.object&&this.state.object(id)).filter(p=>p&&this.parts.kindOf(p)==='engine'&&p.mesh);const keep=new Set();
    for(const p of engines){keep.add(p.id);if(this.exhaustMeshes.has(p.id))continue;const g=new THREE.Group();const cone=new THREE.Mesh(new THREE.ConeGeometry(11,70,14,1,true),new THREE.MeshBasicMaterial({color:0xff9b45,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));cone.rotation.x=-Math.PI/2;cone.position.z=35;const core=new THREE.Mesh(new THREE.ConeGeometry(5,48,12,1,true),new THREE.MeshBasicMaterial({color:0xc7efff,transparent:true,opacity:.72,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));core.rotation.x=-Math.PI/2;core.position.z=24;g.add(cone,core);g.visible=false;this.exhaustGroup.add(g);this.exhaustMeshes.set(p.id,g)}
    for(const [id,g] of this.exhaustMeshes){if(!keep.has(id)){g.removeFromParent();this.exhaustMeshes.delete(id)}}
  }
  _updateExhaust(c){
    this._ensureExhaust(c);const active=this.state.spacecraft.enginePlume!==false&&['ascent','orbit','coast','descent'].includes(c.stage)&&n(c.throttle,0)>.001&&n(c.fuelKg,0)>0;
    for(const [id,g] of this.exhaustMeshes){const p=this.state.object&&this.state.object(id);if(!p||!p.mesh){g.visible=false;continue}p.mesh.updateMatrixWorld(true);p.mesh.getWorldPosition(g.position);p.mesh.getWorldQuaternion(g.quaternion);const pulse=.88+Math.sin(performance.now()*.018+id.length)*.12,th=clamp(n(c.throttle,0),0,1);g.scale.set(1,1,Math.max(.15,th*1.5*pulse));g.visible=active}
  }
  update(dt){
    const c=this.active();if(!c)return;const step=clamp(n(dt,.016),0,.1),body=this._planetPhysics();
    if(c.stage==='ascent'){
      const {p,v}=this._vectors(c),radial=p.lengthSq()>.001?p.clone().normalize():this._homeNormal(),mass=Math.max(1,n(c.dryMassKg,1)+n(c.fuelKg,0)),throttle=clamp(n(c.throttle,1),0,1),thrust=Math.max(0,n(c.thrustN,0))*throttle,fuelFlow=thrust>0?thrust/(Math.max(1,n(c.ispSec,300))*STANDARD_GRAVITY):0,burn=Math.min(c.fuelKg,fuelFlow*step);c.fuelKg=Math.max(0,c.fuelKg-burn);const thrustA=radial.multiplyScalar(thrust/mass).add(this._controlAcceleration(c,p,v));this._localIntegrate(c,step,thrustA);if(c.fuelKg<=0)c.stage='coast';this.onUpdate&&this.onUpdate(c)
    }else if(c.stage==='orbit'||c.stage==='coast'){
      const {p,v}=this._vectors(c),steer=this._controlAcceleration(c,p,v),out=this._localIntegrate(c,step,steer);if(out.p.length()<=body.radiusM){out.p.normalize().multiplyScalar(body.radiusM);const vv=new THREE.Vector3();this._saveVectors(c,out.p,vv);c.stage='landed'}this.onUpdate&&this.onUpdate(c)
    }else if(c.stage==='transfer'){
      const daysPerSec=Math.max(.01,n(this.state.spacecraft.transferDaysPerSecond,20));c.transferElapsedDays+=step*daysPerSec;const total=Math.max(.0001,n(c.transferPlan&&c.transferPlan.timeDays,1));c.transferProgress=clamp(c.transferElapsedDays/total,0,1);if(c.transferProgress>=1){c.stage='arrival-orbit';c.centralBodyId=c.targetCelestialId;c.altitudeMm=c.orbitAltitudeMm}this.onUpdate&&this.onUpdate(c)
    }else if(c.stage==='descent'){
      const {p,v}=this._vectors(c),radial=p.clone().normalize(),alt=Math.max(0,p.length()-body.radiusM),parachute=c.kinds.includes('parachute');let drag=new THREE.Vector3();if(parachute&&alt<5000&&v.lengthSq()>.001){const terminal=12;const speed=v.length();if(speed>terminal)drag=v.clone().normalize().multiplyScalar(-(speed-terminal)*1.8)}const thrustA=(c.fuelKg>0&&c.kinds.includes('engine'))?radial.clone().multiplyScalar(Math.max(0,n(c.thrustN,0))*.18/Math.max(1,n(c.dryMassKg,1)+n(c.fuelKg,0))):new THREE.Vector3();const extra=drag.add(thrustA).add(this._controlAcceleration(c,p,v));this._localIntegrate(c,step,extra);const vv=this._vectors(c);if(vv.p.length()<=body.radiusM){vv.p.normalize().multiplyScalar(body.radiusM);vv.v.set(0,0,0);this._saveVectors(c,vv.p,vv.v);this._syncVisual(c,vv.p);c.stage='landed'}this.onUpdate&&this.onUpdate(c)
    }
    this._updateExhaust(c);if(c.walkMode)this._updateWalkableAvatar(c);if(c.pilot)this._syncPilotCamera(c,false)
  }
  telemetry(){const c=this.active();if(!c||!c.physics)return null;const {p,v}=this._vectors(c),mu=n(c.physics.mu,this._planetPhysics().mu),el=OrbitalMechanics.elementsFromState(p,v,mu),bodyR=n(c.physics.radiusM,this._planetPhysics().radiusM);return{...el,altitudeM:el.radiusM-bodyR,circularMS:OrbitalMechanics.circularVelocity(el.radiusM,mu),escapeMS:OrbitalMechanics.escapeVelocity(el.radiusM,mu),availableDeltaVMS:OrbitalMechanics.availableDeltaV(n(c.dryMassKg,1),n(c.fuelKg,0),n(c.ispSec,300))}}
  status(){const c=this.active();if(!c)return'宇宙船未登録';const t=this.telemetry(),local=t?`高度 ${Math.max(0,t.altitudeM).toFixed(1)} m / 速度 ${t.speedMS.toFixed(2)} m/s / e=${t.eccentricity.toFixed(3)} / Δv残 ${t.availableDeltaVMS.toFixed(1)} m/s`:'';const transfer=c.transferPlan?` / 遷移 ${(c.transferProgress*100).toFixed(1)}% / Hohmann ${n(c.transferPlan.timeDays,0).toFixed(1)}日 / Δv ${n(c.transferPlan.totalDeltaVMS,0).toFixed(0)} m/s`:'';return`${c.name} / ${c.stage}${c.pilot?' / 操縦中':''}${c.walkMode?' / 船内歩行':''}${c.modifyMode?' / 改造モード':''} / Camera:${c.cameraMode} / ${local} / 燃料 ${n(c.fuelKg,0).toFixed(1)} kg${c.targetCelestialId?` / 目標 ${c.targetCelestialId}`:''}${transfer}`}
}
