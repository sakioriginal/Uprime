import * as THREE from 'three';

function fract(x){return x-Math.floor(x)}
function hash3(x,y,z,seed){return fract(Math.sin(x*127.1+y*311.7+z*74.7+seed*19.19)*43758.5453123)}
function smoothNoise(n,seed){
  const a=Math.sin(n.x*3.1+seed*.17)*Math.cos(n.y*4.3-seed*.11)*Math.sin(n.z*5.7+seed*.07);
  const b=Math.sin((n.x+n.z)*8.2+seed*.31)*Math.cos(n.y*7.1-seed*.13);
  const c=(hash3(Math.round(n.x*17),Math.round(n.y*17),Math.round(n.z*17),seed)-.5)*.45;
  return a*.52+b*.30+c*.18;
}
function fbm(n,seed){let sum=0,amp=.58,f=1;for(let i=0;i<4;i++){sum+=smoothNoise(n.clone().multiplyScalar(f),seed+i*17)*amp;f*=2.07;amp*=.48}return sum}
function clamp01(v){return Math.max(0,Math.min(1,v))}
function rand(seed,i){return fract(Math.sin(seed*91.17+i*133.31)*43758.5453)}

function makeWaterRippleTexture(detail=2.4){
  const c=document.createElement('canvas');c.width=256;c.height=256;const x=c.getContext('2d'),img=x.createImageData(256,256),d=img.data;
  for(let j=0;j<256;j++)for(let i=0;i<256;i++){
    // Multi-frequency directional ripples.  Geometry handles the broad swell; this
    // texture supplies metre/sub-metre surface detail without requiring millions of vertices.
    const a=Math.sin(i*.31+j*.10)+Math.sin(i*.77-j*.43)*.50+Math.sin(i*1.43+j*1.07)*.24+Math.sin(i*2.19-j*1.71)*.12;
    const v=Math.max(0,Math.min(255,128+a*30)),k=(j*256+i)*4;d[k]=d[k+1]=d[k+2]=v;d[k+3]=255
  }
  x.putImageData(img,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;
  const rep=Math.max(256,Math.min(4096,Math.round(620*Math.max(.5,Number(detail)||2.4))));t.repeat.set(rep,Math.round(rep*.5));t.colorSpace=THREE.NoColorSpace;return t
}

function makeTextSprite(text){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,128);ctx.font='600 42px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(8,15,22,.72)';ctx.fillRect(0,20,512,88);ctx.strokeStyle='rgba(255,255,255,.3)';ctx.strokeRect(1,21,510,86);ctx.fillStyle='#eef7ff';ctx.fillText(String(text),256,64);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false,depthTest:false});const sp=new THREE.Sprite(mat);sp.scale.set(110,27.5,1);sp.renderOrder=50;sp.userData.labelTexture=tex;return sp
}

export class PlanetManager{
  constructor(state,scene,workspaceManager=null){this.state=state;this.scene=scene;this.workspaceManager=workspaceManager;this.group=new THREE.Group();this.group.name='planet-system';scene.scene.add(this.group);this._waveClock=0;this._waveAccumulator=0;this._lastLoopNow=0;this.ensureState();this.build();this.setEnabled(!!this.state.planet.enabled,false);this.scene?.addLoopHook?.((now)=>{const dt=this._lastLoopNow?Math.max(0,Math.min(.1,(Number(now)-this._lastLoopNow)/1000)):.016;this._lastLoopNow=Number(now)||0;this.update(dt)})}
  mmPerUnit(){return Math.max(1e-9,Number(this.state.workspace&&this.state.workspace.unitScaleMm)||10)}
  mmToScene(mm){return Number(mm||0)/this.mmPerUnit()}
  sceneToMm(v){return Number(v||0)*this.mmPerUnit()}
  ensureState(){
    const old=this.state.planet||{};
    this.state.planet={enabled:false,radiusMm:1000000,terrainAmplitudeMm:10000,waterLevelMm:0,waterRadiusMm:998000,waterRenderOffsetMm:-2000,waveAmplitudeMm:220,waveSpeed:.85,spawnElevationMm:1000,seed:7,subdivisions:5,water:true,atmosphere:true,celestialBodies:true,stars:true,starCount:1800,simTimeHours:12,timeScale:60,rotationPeriodHours:24,orbitPeriodDays:365.25,axialTiltDeg:23.4,calendarEpoch:'2026-01-01T00:00:00Z',solarOverview:false,stellarOverview:false,referenceFrame:'avatar',stellarReachLy:12,landFractionTarget:.30,terrainDetailStrength:.72,terrainRoughness:.82,mountainSharpness:2.25,spawnFlatRadiusMm:28000,spawnFlatStrength:.78,continentScale:0.72,valleyStrength:.65,plateauStrength:.45,cliffStrength:.35,islandStrength:.30,erosionStrength:.55,celestialLabelsVisible:true,celestialCatalog:{},continents:true,mountains:true,biomes:true,vegetation:true,vegetationDensity:180,rivers:true,riverCount:7,spawnVillage:true,spawnVillageCount:3,spawnLandPatchActive:false,spawnLandPatchMm:2200,spawnLandPatchRadiusMm:15000,waveDetail:2.4,homeNormal:[0,1,0],...old};
    // Migrate legacy workspace-unit values only when explicit millimetre values are absent.
    if(old.radiusMm===undefined&&old.radius!==undefined)this.state.planet.radiusMm=Number(old.radius)*this.mmPerUnit();
    if(old.terrainAmplitudeMm===undefined&&old.terrainAmplitude!==undefined)this.state.planet.terrainAmplitudeMm=Number(old.terrainAmplitude)*this.mmPerUnit();
    if(old.waterLevelMm===undefined&&old.waterLevel!==undefined)this.state.planet.waterLevelMm=Number(old.waterLevel)*this.mmPerUnit();
    if(old.waterRenderOffsetMm===-120||old.waterRenderOffsetMm===-250)this.state.planet.waterRenderOffsetMm=-300;
    if(old.waveAmplitudeMm===120||old.waveAmplitudeMm===350)this.state.planet.waveAmplitudeMm=220;
    if(!Number.isFinite(Number(old.waterRadiusMm)))this.state.planet.waterRadiusMm=Math.max(1000,Math.round((Number(this.state.planet.radiusMm)||1000000)*.998));
    // v5.19: water uses a stable 99.8% radius default.  For a 100,000 mm planet this is 99,800 mm;
    // for the current 1,000,000 mm default it becomes 998,000 mm. Explicit user values are preserved.
    if(old.waveSpeed===.55)this.state.planet.waveSpeed=.85;
    this.state.planet.radius=this.radiusScene();
    this.state.planet.terrainAmplitude=this.amplitudeScene();
    this.state.planet.waterLevel=this.waterLevelScene();
    return this.state.planet;
  }
  radiusScene(){return Math.max(10,this.mmToScene(Number(this.state.planet&&this.state.planet.radiusMm)||1000000))}
  amplitudeScene(){return Math.max(0,this.mmToScene(Number(this.state.planet&&this.state.planet.terrainAmplitudeMm)||10000))}
  waterLevelScene(){return this.mmToScene(Number(this.state.planet&&this.state.planet.waterLevelMm)||0)}
  spawnElevationScene(){return this.mmToScene(Number(this.state.planet&&this.state.planet.spawnElevationMm)||1000)}
  _rawBroad(dir,seed){const k=Math.max(.25,Math.min(2.5,Number(this.state.planet.continentScale)||.72));return fbm(dir.clone().normalize().multiplyScalar(k),seed+3)}
  _calibrateContinents(){
    const target=Math.max(.05,Math.min(.85,Number(this.state.planet.landFractionTarget)||.30)),seed=Number(this.state.planet.seed)||1,vals=[];
    for(let i=0;i<3072;i++){const z=rand(seed+1201,i)*2-1,a=rand(seed+1301,i)*Math.PI*2,q=Math.sqrt(Math.max(0,1-z*z)),n=new THREE.Vector3(Math.cos(a)*q,z,Math.sin(a)*q);vals.push(this._rawBroad(n,seed))}
    vals.sort((a,b)=>a-b);this._continentThreshold=vals[Math.max(0,Math.min(vals.length-1,Math.floor((1-target)*vals.length)))]||0;
    // A second calibration pass uses the FINAL terrain signal.  This keeps the visible
    // land/ocean split near the requested percentage even after mountains, valleys,
    // islands and detail are added.
    const heights=[];
    for(let i=0;i<4096;i++){const z=rand(seed+2201,i)*2-1,a=rand(seed+2301,i)*Math.PI*2,q=Math.sqrt(Math.max(0,1-z*z)),n=new THREE.Vector3(Math.cos(a)*q,z,Math.sin(a)*q);heights.push(this._heightUnbiased(n))}
    heights.sort((a,b)=>a-b);this._terrainSeaBias=heights[Math.max(0,Math.min(heights.length-1,Math.floor((1-target)*heights.length)))]||0;
  }
  _celestialRecord(id,type='star'){this.ensureState();const cat=this.state.planet.celestialCatalog||(this.state.planet.celestialCatalog={});if(!cat[id])cat[id]={id,type,name:id,labelVisible:false};return cat[id]}
  setCelestialName(id,name){const r=this._celestialRecord(id);r.name=String(name||id).trim()||id;this.refreshCelestialLabels();return r}
  setCelestialLabelVisible(id,visible){const r=this._celestialRecord(id);r.labelVisible=!!visible;this.refreshCelestialLabels();return r}
  setAllCelestialLabelsVisible(visible){this.ensureState();this.state.planet.celestialLabelsVisible=!!visible;this.refreshCelestialLabels()}
  _decorateCelestial(object,id,type){if(!object)return;const r=this._celestialRecord(id,type);object.userData=object.userData||{};object.userData.celestialId=id;object.userData.celestialType=type;object.userData.celestialRecord=r}
  _ensureObjectLabel(object,id){if(!object)return;const rec=this._celestialRecord(id,object.userData&&object.userData.celestialType||'star'),visible=this.state.planet.celestialLabelsVisible!==false&&rec.labelVisible;if(!visible){if(object.userData&&object.userData.celestialLabel){object.remove(object.userData.celestialLabel);object.userData.celestialLabel.material.map.dispose();object.userData.celestialLabel.material.dispose();object.userData.celestialLabel=null}return}if(object.userData.celestialLabel&&object.userData.celestialLabel.userData.text===rec.name)return;if(object.userData.celestialLabel){object.remove(object.userData.celestialLabel);object.userData.celestialLabel.material.map.dispose();object.userData.celestialLabel.material.dispose()}const sp=makeTextSprite(rec.name);sp.userData.text=rec.name;sp.position.set(0,18,0);object.add(sp);object.userData.celestialLabel=sp}
  refreshCelestialLabels(){const groups=[this.group,this.solarOverviewGroup,this.stellarOverviewGroup];for(const g of groups){g&&g.traverse&&g.traverse(o=>{if(o.userData&&o.userData.celestialId)this._ensureObjectLabel(o,o.userData.celestialId)})}if(this.starField){const cat=this.state.planet.celestialCatalog||{},pos=this.starField.geometry.attributes.position;this.skyLabels=this.skyLabels||new Map();for(const [id,sp] of [...this.skyLabels.entries()]){const r=cat[id];if(!r||!r.labelVisible||this.state.planet.celestialLabelsVisible===false){this.starField.remove(sp);sp.material.map.dispose();sp.material.dispose();this.skyLabels.delete(id)}}for(const id of Object.keys(cat)){if(!/^SKY-/.test(id))continue;const r=cat[id];if(!r.labelVisible||this.state.planet.celestialLabelsVisible===false||this.skyLabels.has(id))continue;const idx=Math.max(0,Number(id.split('-')[1])-1);if(idx>=pos.count)continue;const sp=makeTextSprite(r.name);sp.position.fromBufferAttribute(pos,idx);sp.scale.multiplyScalar(this.radiusScene()*.003);this.starField.add(sp);this.skyLabels.set(id,sp)}}}
  celestialRecordFromHit(hit){if(!hit)return null;if(hit.object===this.starField&&Number.isInteger(hit.index)){const id=`SKY-${String(hit.index+1).padStart(6,'0')}`;return this._celestialRecord(id,'star')}const id=hit.object&&hit.object.userData&&hit.object.userData.celestialId;return id?this._celestialRecord(id,hit.object.userData.celestialType||'object'):null}
  pickCelestial(event){if(!this.scene||!this.scene.raycaster)return null;this.scene.updatePointer&&this.scene.updatePointer(event);const objs=[];for(const g of [this.group,this.solarOverviewGroup,this.stellarOverviewGroup])if(g&&g.visible)g.traverse(o=>{if(o.userData&&o.userData.celestialSelectable===false)return;if((o.isMesh||o.isPoints)&&((o.userData&&o.userData.celestialId)||o===this.starField))objs.push(o)});const old=this.scene.raycaster.params.Points.threshold;this.scene.raycaster.params.Points.threshold=Math.max(.5,this.radiusScene()*.004);const hits=this.scene.raycaster.intersectObjects(objs,true);this.scene.raycaster.params.Points.threshold=old;for(const h of hits){const rec=this.celestialRecordFromHit(h);if(rec)return{record:rec,hit:h}}return null}
  terrainSignals(dir){
    this.ensureState();const n=dir.clone().normalize(),seed=Number(this.state.planet.seed)||1;
    const broad=this._rawBroad(n,seed);
    const threshold=Number.isFinite(this._continentThreshold)?this._continentThreshold:.04;
    const continent=this.state.planet.continents===false?0:Math.tanh((broad-threshold)*3.25);
    const rough=Math.max(.2,Math.min(3,Number(this.state.planet.terrainRoughness)||1));
    const ridged=1-Math.abs(fbm(n.clone().multiplyScalar(2.25*rough),seed+71));
    const mountainMask=clamp01((continent+.18)*1.25);
    const sharp=Math.max(1,Math.min(6,Number(this.state.planet.mountainSharpness)||2.25));
    const mountains=this.state.planet.mountains===false?0:Math.pow(clamp01(ridged),sharp)*mountainMask;
    const detailStrength=Math.max(0,Math.min(2.5,Number(this.state.planet.terrainDetailStrength)||1));
    const detail=(fbm(n.clone().multiplyScalar(4.7*rough),seed+131)*.18+fbm(n.clone().multiplyScalar(13.5*rough),seed+257)*.055)*detailStrength;
    const erosionBase=(1-Math.abs(fbm(n.clone().multiplyScalar(7.5),seed+401)))*.035*mountainMask;
    const erosion=erosionBase*Math.max(0,Math.min(2,Number(this.state.planet.erosionStrength)||.55));
    const valleyNoise=1-Math.abs(fbm(n.clone().multiplyScalar(3.8*rough),seed+523));
    const valley=Math.pow(clamp01(valleyNoise),2.1)*clamp01((continent+.05)*1.4)*Math.max(0,Math.min(2,Number(this.state.planet.valleyStrength)||.65));
    const plateauNoise=fbm(n.clone().multiplyScalar(1.7),seed+607),plateauBand=clamp01((plateauNoise+.22)*1.55)*mountainMask;
    const plateau=Math.round(plateauBand*5)/5*Math.max(0,Math.min(2,Number(this.state.planet.plateauStrength)||.45));
    const cliffNoise=Math.abs(fbm(n.clone().multiplyScalar(5.9*rough),seed+709));
    const cliff=Math.pow(clamp01((cliffNoise-.32)*1.8),3)*mountainMask*Math.max(0,Math.min(2,Number(this.state.planet.cliffStrength)||.35));
    const islandNoise=fbm(n.clone().multiplyScalar(6.2),seed+811),coastMask=clamp01(1-Math.abs(continent)*3.5);
    const islands=Math.max(0,islandNoise-.18)*coastMask*Math.max(0,Math.min(2,Number(this.state.planet.islandStrength)||.30));
    return{continent,mountains,detail,erosion,valley,plateau,cliff,islands};
  }
  _heightUnbiased(dir){const amp=this.amplitudeScene(),s=this.terrainSignals(dir);return(s.continent*.70+s.mountains*.76+s.detail-s.erosion-s.valley*.20+s.plateau*.10+s.cliff*.18+s.islands*.34)*amp}
  heightAtDirection(dir){
    const n=dir.clone().normalize();let h=this._heightUnbiased(n)-(Number(this._terrainSeaBias)||0);
    if(this.state.planet.spawnLandPatchActive&&Array.isArray(this.state.planet.homeNormal)){
      const home=new THREE.Vector3(...this.state.planet.homeNormal).normalize(),dot=THREE.MathUtils.clamp(n.dot(home),-1,1),ang=Math.acos(dot),rad=Math.max(1e-6,(Number(this.state.planet.spawnLandPatchRadiusMm)||15000)/Math.max(1,Number(this.state.planet.radiusMm)||1000000));
      if(ang<rad){const q=1-ang/rad,t=q*q*(3-2*q),lift=this.mmToScene(Number(this.state.planet.spawnLandPatchMm)||2200)*t;h=Math.max(h,this.waterLevelScene()+lift)}
      // Create a broad, gently graded civilization-friendly area around the home/spawn point.
      const flatRad=Math.max(rad,(Number(this.state.planet.spawnFlatRadiusMm)||28000)/Math.max(1,Number(this.state.planet.radiusMm)||1000000));
      if(ang<flatRad){const q=1-ang/flatRad,t=q*q*(3-2*q),strength=THREE.MathUtils.clamp(Number(this.state.planet.spawnFlatStrength)||.78,0,1),target=Math.max(this.waterLevelScene()+this.mmToScene(Number(this.state.planet.spawnElevationMm)||1000),0);h=THREE.MathUtils.lerp(h,target,t*strength)}
    }
    return h
  }
  elevationMmAtDirection(dir){return this.sceneToMm(this.heightAtDirection(dir)-this.waterLevelScene())}
  surfaceRadius(dir){return this.radiusScene()+this.heightAtDirection(dir)}
  surfacePoint(dir,offsetMm=0){const n=dir.clone().normalize();return n.multiplyScalar(this.surfaceRadius(n)+this.mmToScene(offsetMm))}
  surfaceFrame(dir){const n=dir.clone().normalize();let forward=new THREE.Vector3(0,0,-1).projectOnPlane(n).normalize();if(forward.lengthSq()<.01)forward=new THREE.Vector3(1,0,0).projectOnPlane(n).normalize();const right=new THREE.Vector3().crossVectors(forward,n).normalize(),back=forward.clone().negate(),m=new THREE.Matrix4().makeBasis(right,n,back),q=new THREE.Quaternion().setFromRotationMatrix(m);return{normal:n,forward,right,quaternion:q,point:this.surfacePoint(n)}}
  renderedSurfacePoint(dir,offsetMm=0){const n=dir.clone().normalize();let p=null;if(this.terrain){const amp=this.mmToScene(Math.max(1000,Math.abs(Number(this.state.planet?.terrainAmplitudeMm)||10000))),outer=this.radiusScene()+amp*3+this.mmToScene(5000),ray=new THREE.Raycaster(n.clone().multiplyScalar(outer),n.clone().negate(),0,outer*2),hit=ray.intersectObject(this.terrain,false)[0];if(hit?.point)p=hit.point.clone()}if(!p)p=this.surfacePoint(n,0);if(offsetMm)p.add(n.clone().multiplyScalar(this.mmToScene(offsetMm)));return p}
  groundCadPoint(scene,cadPoint=[0,0,0],offsetMm=0){
    // Authoritative building/CAD surface resolver. Prefer the ACTUAL rendered
    // PlanetTerrain mesh so foundations, buildings and the avatar agree visually.
    if(!scene?.cadPointToWorld||!scene?.worldPointToCad)return [...cadPoint];
    const world=scene.cadPointToWorld(cadPoint),dir=world.clone().normalize();
    if(dir.lengthSq()<.5)return [...cadPoint];
    let surface=null;
    if(this.terrain){
      const amp=this.mmToScene(Math.max(1000,Math.abs(Number(this.state.planet?.terrainAmplitudeMm)||10000)));
      const outer=this.radiusScene()+amp*3+this.mmToScene(5000);
      const ray=new THREE.Raycaster(dir.clone().multiplyScalar(outer),dir.clone().negate(),0,outer*2);
      const hit=ray.intersectObject(this.terrain,false)[0];
      if(hit?.point)surface=hit.point.clone();
    }
    if(!surface)surface=this.surfacePoint(dir,0);
    if(offsetMm)surface.add(dir.clone().multiplyScalar(this.mmToScene(offsetMm)));
    const cad=scene.worldPointToCad(surface);
    // Preserve the designed tangent-plane X/Y. Only height is resolved from terrain.
    return [Number(cadPoint[0])||0,Number(cadPoint[1])||0,Number(cad[2])||0];
  }
  raycastSurfaceFromCamera(scene){
    if(!this.terrain||!scene?.camera)return null;
    const origin=scene.camera.position.clone(),direction=new THREE.Vector3();scene.camera.getWorldDirection(direction);
    const ray=new THREE.Raycaster(origin,direction.normalize(),0,Math.max(this.radiusScene()*4,10000));
    const hit=ray.intersectObject(this.terrain,false)[0];
    return hit?hit.point.clone():null;
  }
  findSpawnNormal(){
    const sea=this.waterLevelScene(),target=sea+this.spawnElevationScene(),seed=Number(this.state.planet.seed)||1;let best=null,bestScore=Infinity;
    // Spawn must be visibly dry, not merely one numerical epsilon above sea level.
    const dryMargin=this.mmToScene(Math.max(300,Math.min(900,Number(this.state.planet.spawnElevationMm)||1000)*.35));
    for(let i=0;i<16384;i++){
      const z=rand(seed+880,i)*2-1,a=rand(seed+991,i)*Math.PI*2,q=Math.sqrt(Math.max(0,1-z*z)),n=new THREE.Vector3(Math.cos(a)*q,z,Math.sin(a)*q).normalize(),h=this.heightAtDirection(n);
      if(h<=sea+dryMargin)continue;
      // Reject steep/local shoreline points by probing four nearby directions.
      const t1=new THREE.Vector3(0,1,0).cross(n);if(t1.lengthSq()<.01)t1.set(1,0,0).cross(n);t1.normalize();const t2=new THREE.Vector3().crossVectors(n,t1).normalize();
      const eps=.006,hs=[t1,t1.clone().negate(),t2,t2.clone().negate()].map(t=>this.heightAtDirection(n.clone().addScaledVector(t,eps).normalize()));
      if(hs.some(v=>v<=sea+dryMargin*.55))continue;
      const rough=Math.max(...hs.map(v=>Math.abs(v-h))),score=Math.abs(h-target)+rough*2.5;
      if(score<bestScore){best=n;bestScore=score;if(Math.abs(h-target)<this.mmToScene(80)&&rough<this.mmToScene(120))break}
    }
    if(best)return best;
    // Last resort: choose the highest sampled land point; never silently return a sea pole.
    let high=new THREE.Vector3(0,1,0),highH=-Infinity;for(let i=0;i<8192;i++){const z=rand(seed+1880,i)*2-1,a=rand(seed+1991,i)*Math.PI*2,q=Math.sqrt(Math.max(0,1-z*z)),n=new THREE.Vector3(Math.cos(a)*q,z,Math.sin(a)*q),h=this.heightAtDirection(n);if(h>highH){highH=h;high=n}}return high.normalize();
  }
  buildSpawnVillage(normal){
    if(this.spawnVillageGroup){this.group.remove(this.spawnVillageGroup);this.spawnVillageGroup.traverse(o=>{o.geometry?.dispose?.();if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose?.())}})}
    if(this.state.planet.spawnVillage===false)return;
    // Living Village owns the real houses. Do not stack the old decorative 3-house spawn village above it.
    if(Array.isArray(this.state.villages)&&this.state.villages.length)return;
    const root=new THREE.Group();root.name='SpawnVillage';root.userData.planet=true;const frame=this.surfaceFrame(normal),count=Math.max(2,Math.min(3,Math.round(Number(this.state.planet.spawnVillageCount)||3)));
    const wallMat=new THREE.MeshStandardMaterial({color:0xb9a98d,roughness:.9}),roofMat=new THREE.MeshStandardMaterial({color:0x6e5142,roughness:.95}),doorMat=new THREE.MeshStandardMaterial({color:0x79533a,roughness:.88}),glassMat=new THREE.MeshStandardMaterial({color:0x91c8df,transparent:true,opacity:.48,roughness:.2,metalness:.05,depthWrite:false}),baseMat=new THREE.MeshStandardMaterial({color:0x77756f,roughness:.98});
    const box=(w,h,d,mat,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat.clone());m.position.set(x,y,z);return m};
    for(let i=0;i<count;i++){
      const side=(i-1)*this.mmToScene(3300),ahead=this.mmToScene(4200+(i%2)*1900),dir=normal.clone().addScaledVector(frame.right,side/this.radiusScene()).addScaledVector(frame.forward,ahead/this.radiusScene()).normalize();if(this.heightAtDirection(dir)<=this.waterLevelScene()+this.mmToScene(650))continue;
      const f=this.surfaceFrame(dir),house=new THREE.Group(),w=this.mmToScene(2600),d=this.mmToScene(2200),h=this.mmToScene(1900),th=this.mmToScene(120),foundation=this.mmToScene(350),doorW=this.mmToScene(780),doorH=this.mmToScene(1550),winW=this.mmToScene(650),winH=this.mmToScene(620);
      // Spawn houses are not CAD parts, so sample the ACTUAL rendered terrain here too.
      // The house stays level in its local tangent frame while four radial support piers reach the ground.
      const centerSurface=this.renderedSurfacePoint(dir),back=f.forward.clone().negate(),samples=[];
      for(const sx of [-1,1])for(const sz of [-1,1]){const lx=sx*w*.48,lz=sz*d*.48,cornerDir=dir.clone().addScaledVector(f.right,lx/Math.max(1,this.radiusScene())).addScaledVector(back,lz/Math.max(1,this.radiusScene())).normalize(),sp=this.renderedSurfacePoint(cornerDir),rel=sp.clone().sub(centerSurface).dot(f.normal);samples.push({lx,lz,rel})}
      const high=Math.max(0,...samples.map(v=>v.rel)),clearance=this.mmToScene(120);house.position.copy(centerSurface).addScaledVector(f.normal,high+clearance);house.quaternion.copy(f.quaternion);
      const pierW=this.mmToScene(420);for(const s of samples){const gap=Math.max(this.mmToScene(40),high+clearance-s.rel),pier=box(pierW,gap,pierW,baseMat,s.lx,-gap/2,s.lz);pier.userData={villageFoundation:true,gravityFoundation:true,walkObstacle:true};house.add(pier)}
      house.add(box(w+th*2,foundation,d+th*2,baseMat,0,foundation/2,0));house.add(box(w,this.mmToScene(120),d,baseMat,0,foundation+this.mmToScene(60),0));
      const wallY=foundation+h/2,frontZ=d/2;
      house.add(box(w,h,th,wallMat,0,wallY,-d/2));house.add(box(th,h,d,wallMat,-w/2,wallY,0));house.add(box(th,h,d,wallMat,w/2,wallY,0));
      const sideW=(w-doorW)/2;house.add(box(sideW,h,th,wallMat,-(doorW+sideW)/2,wallY,frontZ));house.add(box(sideW,h,th,wallMat,(doorW+sideW)/2,wallY,frontZ));house.add(box(doorW,h-doorH,th,wallMat,0,foundation+doorH+(h-doorH)/2,frontZ));
      const door=box(doorW*.92,doorH*.96,th*.55,doorMat,-doorW*.46,foundation+doorH*.48,frontZ-doorW*.46);door.rotation.y=Math.PI/2;door.userData={villageDoor:true,open:true,walkObstacle:false};house.add(door);
      const wy=foundation+h*.58;for(const sx of [-1,1]){const wx=sx*w*.29,glass=box(winW,winH,th*.35,glassMat,wx,wy,-d/2-th*.2);house.add(glass)}
      const roof=new THREE.Mesh(new THREE.ConeGeometry(w*.78,h*.55,4),roofMat.clone());roof.position.y=foundation+h+h*.27;roof.rotation.y=Math.PI/4;house.add(roof);
      house.userData={planet:true,village:true,walkObstacle:true,hasDoor:true,hasWindows:true,terrainSupported:true};root.add(house)
    }
    this.spawnVillageGroup=root;this.group.add(root);
  }
  biomeAt(dir,height){
    const n=dir.clone().normalize(),amp=Math.max(1,this.amplitudeScene()),sea=this.waterLevelScene(),lat=Math.abs(n.y),seed=Number(this.state.planet.seed)||1,moisture=fbm(n.clone().multiplyScalar(3.15),seed+211);
    if(height<sea)return'ocean';
    const rel=(height-sea)/amp;
    if(rel<.055&&moisture>.08)return'wetland';
    if(rel<.035)return'coast';
    if(lat>.86||rel>.67)return'snowfield';
    if(rel>.40)return'mountain';
    if(lat>.72)return'tundra';
    if(moisture<-.28)return'desert';
    if(moisture>.22)return'forest';
    return'plain';
  }
  biomeColor(name){const map={ocean:0x385b66,coast:0xb9a66f,wetland:0x476b51,snowfield:0xe8eef0,mountain:0x81796f,tundra:0x8a947b,desert:0xc39a58,forest:0x315f36,plain:0x6f914b};return new THREE.Color(map[name]===undefined?0x66824f:map[name])}
  _clear(){if(this.terrain&&this.scene.workspacePlacementSurfaces)this.scene.workspacePlacementSurfaces=this.scene.workspacePlacementSurfaces.filter(x=>x!==this.terrain);while(this.group.children.length){const o=this.group.children.pop();if(o&&o.traverse)o.traverse(c=>{if(c.geometry&&c.geometry.dispose)c.geometry.dispose();if(Array.isArray(c.material))c.material.forEach(m=>m&&m.dispose&&m.dispose());else if(c.material&&c.material.dispose)c.material.dispose()})}this.terrain=this.water=this.atmosphere=this.vegetationMesh=this.celestialGroup=this.starField=this.sunLight=this.axisVisual=this.primeMeridian=null;if(this.stellarOverviewGroup){this.scene.scene.remove(this.stellarOverviewGroup);this.stellarOverviewGroup.traverse?.(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m?.dispose?.());else c.material?.dispose?.()});this.stellarOverviewGroup=null}if(this.solarOverviewGroup){this.scene.scene.remove(this.solarOverviewGroup);this.solarOverviewGroup.traverse?.(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m?.dispose?.());else c.material?.dispose?.()});this.solarOverviewGroup=null}}
  build(){
    this.ensureState();this._calibrateContinents();this._clear();const radius=this.radiusScene(),detail=Math.max(2,Math.min(6,Math.round(Number(this.state.planet.subdivisions)||5))),geo=new THREE.IcosahedronGeometry(radius,detail),pos=geo.attributes.position,colors=[],tmp=new THREE.Vector3();
    for(let i=0;i<pos.count;i++){tmp.fromBufferAttribute(pos,i).normalize();const h=this.heightAtDirection(tmp),r=radius+h;pos.setXYZ(i,tmp.x*r,tmp.y*r,tmp.z*r);const col=this.state.planet.biomes===false?new THREE.Color(0x66824f):this.biomeColor(this.biomeAt(tmp,h));colors.push(col.r,col.g,col.b)}
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const terrain=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0,flatShading:false}));terrain.name='PlanetTerrain';terrain.userData.planet=true;terrain.userData.groundSurface=true;terrain.userData.celestialSelectable=false;this._decorateCelestial(terrain,'PLANET-HOME-0001','planet');this.group.add(terrain);this.terrain=terrain;this.scene.workspacePlacementSurfaces=this.scene.workspacePlacementSurfaces||[];this.scene.workspacePlacementSurfaces.push(terrain);
    if(this.state.planet.water){const wr=this.mmToScene(Math.max(1000,Number(this.state.planet.waterRadiusMm)||((Number(this.state.planet.radiusMm)||1000000)+(Number(this.state.planet.waterRenderOffsetMm)||-300)))),wgeo=new THREE.SphereGeometry(wr,320,192),wpos=wgeo.attributes.position,dirs=new Float32Array(wpos.count*3),v=new THREE.Vector3();for(let i=0;i<wpos.count;i++){v.fromBufferAttribute(wpos,i).normalize();dirs[i*3]=v.x;dirs[i*3+1]=v.y;dirs[i*3+2]=v.z}wgeo.userData.baseDirections=dirs;wgeo.userData.baseRadius=wr;const ripple=makeWaterRippleTexture(this.state.planet.waveDetail),wmat=new THREE.MeshPhysicalMaterial({color:0x286890,transparent:true,opacity:.48,roughness:.22,metalness:0,depthWrite:true,side:THREE.FrontSide,clearcoat:.28,clearcoatRoughness:.24,bumpMap:ripple,bumpScale:.55});const water=new THREE.Mesh(wgeo,wmat);water.name='PlanetWater';water.userData.planet=true;water.userData.rippleTexture=ripple;water.userData.seaRadius=wr;water.renderOrder=0;this.group.add(water);this.water=water}
    if(this.state.planet.atmosphere){const atm=new THREE.Mesh(new THREE.SphereGeometry(radius*1.035,64,40),new THREE.MeshBasicMaterial({color:0x8bc9ff,transparent:true,opacity:.07,side:THREE.BackSide,depthWrite:false}));atm.name='PlanetAtmosphere';this.group.add(atm);this.atmosphere=atm}
    if(this.state.planet.rivers!==false)this._buildRivers();if(this.state.planet.vegetation!==false)this._buildVegetation();if(this.state.planet.stars!==false)this._buildStars();if(this.state.planet.celestialBodies!==false)this._buildCelestials();this._buildAxisVisual();this._buildSolarOverview();this._buildStellarOverview();this.group.visible=!!this.state.planet.enabled&&!this.state.planet.solarOverview;if(this.solarOverviewGroup)this.solarOverviewGroup.visible=!!this.state.planet.enabled&&!!this.state.planet.solarOverview;
  }
  _buildStars(){
    const radius=this.radiusScene(),count=Math.max(200,Math.min(6000,Math.round(Number(this.state.planet.starCount)||1800))),geo=new THREE.BufferGeometry(),arr=new Float32Array(count*3);
    for(let i=0;i<count;i++){const z=rand(1234,i)*2-1,a=rand(4321,i)*Math.PI*2,r=radius*(80+rand(8181,i)*60),q=Math.sqrt(Math.max(0,1-z*z));arr[i*3]=Math.cos(a)*q*r;arr[i*3+1]=z*r;arr[i*3+2]=Math.sin(a)*q*r;this._celestialRecord(`SKY-${String(i+1).padStart(6,'0')}`,'star')}
    geo.setAttribute('position',new THREE.BufferAttribute(arr,3));const stars=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size:Math.max(.35,radius*.0022),sizeAttenuation:true,transparent:true,opacity:.92,depthWrite:false}));stars.name='StarField';stars.userData.celestialPointField=true;this.group.add(stars);this.starField=stars;this.refreshCelestialLabels();
  }
  _buildAxisVisual(){
    const r=this.radiusScene(),tilt=THREE.MathUtils.degToRad(Number(this.state.planet.axialTiltDeg)||23.4),axis=new THREE.Vector3(Math.sin(tilt),Math.cos(tilt),0).normalize();
    const axisGeo=new THREE.BufferGeometry().setFromPoints([axis.clone().multiplyScalar(-r*1.35),axis.clone().multiplyScalar(r*1.35)]),axisLine=new THREE.Line(axisGeo,new THREE.LineBasicMaterial({color:0x9fd8ff,transparent:true,opacity:.55,depthWrite:false}));axisLine.name='PlanetAxis';this.group.add(axisLine);this.axisVisual=axisLine;
    const pts=[];for(let i=0;i<160;i++){const a=i/160*Math.PI*2;pts.push(new THREE.Vector3(0,Math.cos(a)*r*1.012,Math.sin(a)*r*1.012))}const pm=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xffd18a,transparent:true,opacity:.28,depthWrite:false}));pm.name='PrimeMeridian';this.group.add(pm);this.primeMeridian=pm;
  }
  _buildSolarOverview(){
    const g=new THREE.Group();g.name='SolarSystemOverview';g.visible=false;this.scene.scene.add(g);this.solarOverviewGroup=g;
    const star=new THREE.Mesh(new THREE.SphereGeometry(55,32,20),new THREE.MeshBasicMaterial({color:0xffdf93}));star.name='OverviewSun';this._decorateCelestial(star,'STAR-SOL-0001','star');g.add(star);
    const orbitR=[135,190,270,360,475,625,805,1010],radii=[3.8,5.4,6.1,5.2,18,15,12,11],cols=[0x9b8b7c,0xd7b08a,0x4f82d1,0xc2684a,0xd6b078,0xd8c99a,0x7eb6c8,0x527dc0];this.overviewPlanets=[];this.overviewOrbits=[];
    for(let i=0;i<orbitR.length;i++){const rr=orbitR[i],line=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:180},(_,k)=>{const a=k/180*Math.PI*2;return new THREE.Vector3(Math.cos(a)*rr,0,Math.sin(a)*rr)})),new THREE.LineBasicMaterial({color:0x7891a3,transparent:true,opacity:.18,depthWrite:false}));g.add(line);this.overviewOrbits.push(line);const p=new THREE.Mesh(new THREE.SphereGeometry(radii[i],18,12),new THREE.MeshStandardMaterial({color:cols[i],roughness:.9,emissive:i===2?0x061120:0x000000,emissiveIntensity:i===2?.65:0}));p.name=i===2?'HomePlanet_PaleBlueDot':`Planet${i+1}`;this._decorateCelestial(p,`SOL-P${String(i+1).padStart(2,'0')}`,'planet');g.add(p);this.overviewPlanets.push(p)}
    const axis=new THREE.AxesHelper(70);axis.name='SolarOverviewAxes';axis.material?.setValues?.({transparent:true,opacity:.18});g.add(axis);
    this._updateSolarOverviewPositions();
  }
  _updateSolarOverviewPositions(){if(!this.solarOverviewGroup||!this.overviewPlanets)return;const hours=Number(this.state.planet.simTimeHours)||0,day=hours/24,year=Math.max(1,Number(this.state.planet.orbitPeriodDays)||365.25),base=day/year*Math.PI*2,periods=[88,224.7,365.25,687,4332.6,10759,30687,60190],orbits=[135,190,270,360,475,625,805,1010];for(let i=0;i<this.overviewPlanets.length;i++){const a=day/periods[i]*Math.PI*2+(i*.73);this.overviewPlanets[i].position.set(Math.cos(a)*orbits[i],Math.sin(i*.11)*orbits[i]*.025,Math.sin(a)*orbits[i])}}
  setSolarOverview(enabled,ctx={}){return this.setScaleOverview(enabled?'solar':'surface',ctx)}

  _buildStellarOverview(){
    const g=new THREE.Group();g.name='LocalStellarNeighborhood';g.visible=false;this.scene.scene.add(g);this.stellarOverviewGroup=g;
    const stars=[
      ['Sol',0,0,0,0xffe29a,9],['Alpha Centauri',4.37,.8,-.35,0xffd3a1,7],['Barnard',5.96,-1.1,.55,0xff8b68,5],['Sirius',8.60,.45,1.35,0xdcecff,8],['Epsilon Eridani',10.5,-1.4,-.8,0xffc277,6],['Procyon',11.46,1.25,-1.05,0xfff0c7,7],['Tau Ceti',11.9,-.7,1.55,0xffd18b,6]
    ];this.stellarSystems=[];
    for(let i=0;i<stars.length;i++){const [name,ly,y,z,color,size]=stars[i],a=i*2.399963,rr=ly*82,p=new THREE.Vector3(i?Math.cos(a)*rr:0,y*42,i?Math.sin(a)*rr:0);p.y=z*42;const mesh=new THREE.Mesh(new THREE.SphereGeometry(size,16,10),new THREE.MeshBasicMaterial({color}));mesh.position.copy(p);mesh.name='StarSystem_'+name;mesh.userData={starSystem:true,astronomyName:name,distanceLy:ly,reachable:true};this._decorateCelestial(mesh,`SYS-${String(i+1).padStart(4,'0')}`,'star-system');g.add(mesh);this.stellarSystems.push(mesh);if(i){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),p.clone()]),new THREE.LineBasicMaterial({color:0x54728a,transparent:true,opacity:.12,depthWrite:false}));g.add(line)}}
    const dustGeo=new THREE.BufferGeometry(),arr=new Float32Array(2400*3);for(let i=0;i<2400;i++){const r=450+rand(981,i)*900,a=rand(982,i)*Math.PI*2,z=(rand(983,i)-.5)*420;arr[i*3]=Math.cos(a)*r;arr[i*3+1]=z;arr[i*3+2]=Math.sin(a)*r}dustGeo.setAttribute('position',new THREE.BufferAttribute(arr,3));g.add(new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xbfd8ff,size:1.7,transparent:true,opacity:.6,depthWrite:false})));
  }
  setScaleOverview(mode,{camera=null,controls=null}={}){
    this.ensureState();const stellar=mode==='stellar',solar=mode==='solar';this.state.planet.stellarOverview=stellar;this.state.planet.solarOverview=solar;this.group.visible=!!this.state.planet.enabled&&!solar&&!stellar;if(this.solarOverviewGroup)this.solarOverviewGroup.visible=!!this.state.planet.enabled&&solar;if(this.stellarOverviewGroup)this.stellarOverviewGroup.visible=!!this.state.planet.enabled&&stellar;if(camera&&controls){controls.target.set(0,0,0);if(stellar)camera.position.set(0,1150,2150);else if(solar)camera.position.set(0,720,1500);camera.near=.1;camera.far=100000;camera.updateProjectionMatrix();controls.update?.()}return mode
  }
  setReferenceFrame(mode){this.ensureState();this.state.planet.referenceFrame=mode==='stellar'?'stellar':'avatar';return this.state.planet.referenceFrame}
  toggleReferenceFrame(){return this.setReferenceFrame(this.state.planet.referenceFrame==='stellar'?'avatar':'stellar')}

  _buildCelestials(){
    const radius=this.radiusScene(),g=new THREE.Group();g.name='PlanetCelestials';g.userData.planet=true;
    const sunR=Math.max(radius*.42,30),sun=new THREE.Mesh(new THREE.SphereGeometry(sunR,32,20),new THREE.MeshBasicMaterial({color:0xffe39a}));sun.name='Sun';this._decorateCelestial(sun,'STAR-SOL-0001','star');g.add(sun);this.sun=sun;
    const light=new THREE.DirectionalLight(0xfff1cf,2.7);light.name='SunDirectionalLight';g.add(light);this.sunLight=light;
    const moonR=Math.max(radius*.11,12),moon=new THREE.Mesh(new THREE.SphereGeometry(moonR,24,16),new THREE.MeshStandardMaterial({color:0xbfc8d0,roughness:.98}));moon.name='Moon';this._decorateCelestial(moon,'MOON-0001','moon');g.add(moon);this.moon=moon;
    const planet2=new THREE.Mesh(new THREE.SphereGeometry(Math.max(radius*.18,16),24,16),new THREE.MeshStandardMaterial({color:0xd8895f,roughness:.9}));planet2.name='NeighborPlanet';this._decorateCelestial(planet2,'PLANET-NEIGHBOR-0002','planet');g.add(planet2);this.neighborPlanet=planet2;
    const ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:128},(_,i)=>{const a=i/128*Math.PI*2;return new THREE.Vector3(Math.cos(a)*radius*18,0,Math.sin(a)*radius*18)})),new THREE.LineBasicMaterial({color:0x667788,transparent:true,opacity:.13}));ring.rotation.x=.12;ring.name='OrbitGuide';g.add(ring);
    this.group.add(g);this.celestialGroup=g;this._updateCelestialPositions();
  }
  setSimTimeHours(hours){this.ensureState();this.state.planet.simTimeHours=Number(hours)||0;this._updateCelestialPositions();return this.state.planet.simTimeHours}
  addSimHours(delta){return this.setSimTimeHours((Number(this.state.planet.simTimeHours)||0)+(Number(delta)||0))}
  _updateCelestialPositions(){
    if(!this.celestialGroup)return;const r=this.radiusScene(),hours=Number(this.state.planet.simTimeHours)||0,day=hours/24,year=Math.max(1,Number(this.state.planet.orbitPeriodDays)||365.25),orbit=(day/year)*Math.PI*2,spin=(hours/Math.max(.001,Number(this.state.planet.rotationPeriodHours)||24))*Math.PI*2,tilt=(Number(this.state.planet.axialTiltDeg)||23.4)*Math.PI/180;
    // Surface coordinates are kept stable for gameplay.  The apparent sun direction rotates once per day,
    // while its seasonal declination follows the annual orbit.  This produces a visible day/night terminator.
    const localSolarAngle=orbit-spin,sunDist=r*42,decl=Math.sin(orbit)*tilt;
    this.sun?.position.set(Math.cos(localSolarAngle)*Math.cos(decl)*sunDist,Math.sin(decl)*sunDist,Math.sin(localSolarAngle)*Math.cos(decl)*sunDist);if(this.sunLight){this.sunLight.position.copy(this.sun.position);this.sunLight.target.position.set(0,0,0);if(!this.sunLight.target.parent)this.celestialGroup.add(this.sunLight.target)}
    const moonA=day/27.3*Math.PI*2-spin;this.moon?.position.set(Math.cos(moonA)*r*5.2,Math.sin(moonA*.73)*r*.8,Math.sin(moonA)*r*5.2);const pA=orbit*.53+1.2;this.neighborPlanet?.position.set(Math.cos(pA)*r*18,-r*1.8,Math.sin(pA)*r*18);
    if(this.primeMeridian){const axis=new THREE.Vector3(Math.sin(tilt),Math.cos(tilt),0).normalize(),qTilt=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),axis),qSpin=new THREE.Quaternion().setFromAxisAngle(axis,spin);this.primeMeridian.quaternion.copy(qSpin.multiply(qTilt))}
    this._updateSolarOverviewPositions();if(this.starField){const sidereal=spin+orbit*.00274;this.starField.rotation.y=this.state.planet.referenceFrame==='avatar'?-sidereal:0;this.starField.rotation.z=this.state.planet.referenceFrame==='avatar'?tilt:0}this.state.planet.rotationAngle=spin;this.state.planet.orbitAngle=orbit;
  }
  update(dt=.016){
    if(!this.group.visible)return;const step=Math.min(.1,Math.max(0,Number(dt)||.016));this._waveClock+=step;this._waveAccumulator+=step;this.state.planet.simTimeHours=(Number(this.state.planet.simTimeHours)||0)+step*(Number(this.state.planet.timeScale)||0)/3600;this._updateCelestialPositions();
    if(this.water&&this._waveAccumulator>=1/30){this._waveAccumulator=0;if(this.water.userData?.rippleTexture){const rt=this.water.userData.rippleTexture;rt.offset.x=(rt.offset.x+step*.018*(Number(this.state.planet.waveSpeed)||.85))%1;rt.offset.y=(rt.offset.y+step*.011*(Number(this.state.planet.waveSpeed)||.85))%1;}const geo=this.water.geometry,dirs=geo.userData.baseDirections,pos=geo.attributes.position,base=Number(geo.userData.baseRadius)||this.radiusScene(),amp=this.mmToScene(Number(this.state.planet.waveAmplitudeMm)||220),speed=Number(this.state.planet.waveSpeed)||.85,t=this._waveClock*speed,seaR=Number(this.water.userData.seaRadius)||this.radiusScene()+this.waterLevelScene();for(let i=0;i<pos.count;i++){const x=dirs[i*3],y=dirs[i*3+1],z=dirs[i*3+2],phase=(x*13.7+y*19.3+z*29.1)*Math.PI,phase2=(x*71+y*97+z*131)*Math.PI,phase3=(x*173-y*211+z*257)*Math.PI;const wave=(Math.sin(phase+t*1.9)*.46+Math.sin(phase*1.61-t*1.27)*.23+Math.sin(phase2+t*3.9)*.18+Math.sin(phase3-t*5.4)*.13)*amp;const r=Math.max(this.mmToScene(1000),base+wave);pos.setXYZ(i,x*r,y*r,z*r)}pos.needsUpdate=true;geo.computeVertexNormals()}
  }
  _buildVegetation(){
    const density=Math.max(0,Math.min(1000,Number(this.state.planet.vegetationDensity)||180));
    // Density is no longer a blind tree count.  It is an ecological density index, then filtered by
    // biome, dry-ground margin, local slope and the civilization/spawn clearing.
    const count=Math.max(0,Math.min(1800,Math.round(density*3.2))),radius=this.radiusScene(),sea=this.waterLevelScene(),seed=Number(this.state.planet.seed)||1;if(!count)return;
    const trunkGeo=new THREE.CylinderGeometry(1,1,1,6),leafGeo=new THREE.ConeGeometry(1,1,7),trunkMat=new THREE.MeshStandardMaterial({color:0x62452f,roughness:.95}),leafMat=new THREE.MeshStandardMaterial({color:0x2f6938,roughness:.95});
    const trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,count),leaves=new THREE.InstancedMesh(leafGeo,leafMat,count),up=new THREE.Vector3(0,1,0),q=new THREE.Quaternion(),m=new THREE.Matrix4(),scale=new THREE.Vector3(),p=new THREE.Vector3(),n=new THREE.Vector3();let used=0;const avatarH=Math.max(80,Number(this.state.avatar&&this.state.avatar.height)||170),home=Array.isArray(this.state.planet.homeNormal)?new THREE.Vector3(...this.state.planet.homeNormal).normalize():null;
    const biomeChance={forest:1,plain:.42,wetland:.12};
    for(let i=0;i<count*30&&used<count;i++){
      const z=rand(seed+12,i)*2-1,a=rand(seed+44,i)*Math.PI*2,sq=Math.sqrt(Math.max(0,1-z*z));n.set(Math.cos(a)*sq,z,Math.sin(a)*sq).normalize();const h=this.heightAtDirection(n),biome=this.biomeAt(n,h),chance=biomeChance[biome]||0;if(!chance)continue;
      if(h<=sea+this.mmToScene(180))continue; // no submerged / shoreline trees
      if(home){const ang=Math.acos(THREE.MathUtils.clamp(n.dot(home),-1,1)),clearRad=(Number(this.state.planet.spawnFlatRadiusMm)||28000)/Math.max(1,Number(this.state.planet.radiusMm)||1000000);if(ang<clearRad*.72)continue}
      // slope estimate using a nearby tangent probe; reject steep hills/cliffs.
      let tangent=new THREE.Vector3(0,1,0).cross(n);if(tangent.lengthSq()<.01)tangent.set(1,0,0).cross(n);tangent.normalize();const eps=.0018,h2=this.heightAtDirection(n.clone().addScaledVector(tangent,eps).normalize()),rise=Math.abs(h2-h),run=Math.max(1e-6,radius*eps),slopeDeg=Math.atan2(rise,run)*180/Math.PI;if(slopeDeg>22)continue;
      const normalized=Math.min(1,density/240);if(rand(seed+901,i)>chance*normalized)continue;
      const treeH=avatarH*(1+rand(seed+201,i)*2),trunkH=treeH*.30,crownH=treeH*.74,trunkR=Math.max(1,treeH*.035),crownR=treeH*(.16+rand(seed+231,i)*.05);q.setFromUnitVectors(up,n);
      // Use the rendered terrain, not only the analytic height field, so trunks start exactly on visible ground.
      const ground=this.renderedSurfacePoint(n,0);
      p.copy(ground).addScaledVector(n,trunkH*.5);scale.set(trunkR,trunkH,trunkR);m.compose(p,q,scale);trunks.setMatrixAt(used,m);
      p.copy(ground).addScaledVector(n,trunkH+crownH*.5);scale.set(crownR,crownH,crownR);m.compose(p,q,scale);leaves.setMatrixAt(used,m);used++;
    }
    trunks.count=used;leaves.count=used;trunks.name='PlanetVegetationTrunks';leaves.name='PlanetVegetationLeaves';trunks.userData.planet=leaves.userData.planet=true;this.group.add(trunks,leaves);this.vegetationMesh={trunks,leaves};
  }
  _buildRivers(){
    const count=Math.max(0,Math.min(32,Math.round(Number(this.state.planet.riverCount)||7))),radius=this.radiusScene(),seed=Number(this.state.planet.seed)||1,mat=new THREE.LineBasicMaterial({color:0x4ba7dc,transparent:true,opacity:.9});
    for(let ri=0;ri<count;ri++){const a0=rand(seed+301,ri)*Math.PI*2,z0=rand(seed+401,ri)*1.5-.75,s0=Math.sqrt(1-z0*z0),start=new THREE.Vector3(Math.cos(a0)*s0,z0,Math.sin(a0)*s0).normalize();if(this.heightAtDirection(start)<this.mmToScene(500))continue;const axis=new THREE.Vector3(rand(seed+501,ri)-.5,rand(seed+601,ri)-.5,rand(seed+701,ri)-.5).normalize(),pts=[];let n=start.clone();for(let j=0;j<28;j++){const tangent=new THREE.Vector3().crossVectors(axis,n).normalize().multiplyScalar(.045),downProbe=n.clone().add(tangent).normalize(),sideProbe=n.clone().add(new THREE.Vector3().crossVectors(n,tangent).normalize().multiplyScalar(.025)).normalize();let next=downProbe;if(this.heightAtDirection(sideProbe)<this.heightAtDirection(next))next=sideProbe;n=next;const h=this.heightAtDirection(n);if(h<=this.waterLevelScene()+this.mmToScene(100))break;pts.push(n.clone().multiplyScalar(radius+h+this.mmToScene(30)))}if(pts.length>3){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat.clone());line.name=`PlanetRiver${ri+1}`;line.userData.planet=true;this.group.add(line)}}
  }
  estimateLandFraction(samples=4096){let land=0;const seed=Number(this.state.planet.seed)||1;for(let i=0;i<samples;i++){const z=rand(seed+1701,i)*2-1,a=rand(seed+1801,i)*Math.PI*2,q=Math.sqrt(Math.max(0,1-z*z)),n=new THREE.Vector3(Math.cos(a)*q,z,Math.sin(a)*q);if(this.heightAtDirection(n)>this.waterLevelScene())land++}return land/Math.max(1,samples)}
  setEnabled(enabled,focus=true){this.ensureState();this.state.planet.enabled=!!enabled;this.group.visible=!!enabled&&!this.state.planet.solarOverview&&!this.state.planet.stellarOverview;if(this.solarOverviewGroup)this.solarOverviewGroup.visible=!!enabled&&!!this.state.planet.solarOverview;if(this.stellarOverviewGroup)this.stellarOverviewGroup.visible=!!enabled&&!!this.state.planet.stellarOverview;if(this.workspaceManager){this.workspaceManager.group.visible=!enabled;this.workspaceManager.workOriginMarker.visible=!enabled}if(this.scene.grid)this.scene.grid.visible=!enabled;
    // Workspace key lights used to create a stationary white reflection on the ocean.
    // In planet mode the moving Sun is the only directional source; retain only a faint sky fill.
    if(this.scene.baseHemisphereLight)this.scene.baseHemisphereLight.intensity=enabled?.16:2.2;
    if(this.scene.baseDirectionalLight)this.scene.baseDirectionalLight.intensity=enabled?0:2;
    if(enabled&&focus&&!this.state.planet.solarOverview)this.focus();return enabled}
  focus(){const r=this.radiusScene();this.scene.camera.far=Math.max(this.scene.camera.far,r*8);this.scene.camera.updateProjectionMatrix();this.scene.camera.position.set(r*1.55,r*.9,r*1.55);this.scene.controls.target.set(0,0,0);this.scene.controls.enabled=true;this.scene.controls.update()}
  rebuild(){this.build();this.setEnabled(!!this.state.planet.enabled,false)}
  spawnAvatar(avatarManager){
    // Pick the natural landing direction first.  spawnElevationMm is a SEARCH target,
    // never an extra avatar height.  Then build the dry landing patch around that SAME
    // direction and keep it fixed so visual terrain and collision/heightAtDirection agree.
    this.state.planet.spawnLandPatchActive=false;this.build();
    const safe=this.findSpawnNormal();this.state.planet.homeNormal=safe.toArray();this.state.planet.spawnLandPatchActive=true;this.build();
    this.buildSpawnVillage(safe);this.setEnabled(true,false);
    if(avatarManager){avatarManager.enterPlanet(safe);avatarManager.setMode('tpv');avatarManager.toTPV()}
    return true
  }
  leaveAvatar(avatarManager){if(avatarManager)avatarManager.leavePlanet();this.setEnabled(false,true)}
}
