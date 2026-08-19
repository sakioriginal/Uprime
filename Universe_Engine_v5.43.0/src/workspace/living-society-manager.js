import * as THREE from 'three';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const rnd=(a,b)=>a+Math.random()*(b-a);
const clone=v=>JSON.parse(JSON.stringify(v));
const dist2=(a,b)=>Math.hypot((a?.[0]||0)-(b?.[0]||0),(a?.[1]||0)-(b?.[1]||0));

const JOB_WORK={
  mayor:[0,900],farmer:[-4200,1400],lumberjack:[-5200,-700],blacksmith:[3600,1300],merchant:[7200,200],builder:[2900,-2800],miner:[-6500,2600],hunter:[-2500,-4300],priest:[0,2600],shopkeeper:[7200,200]
};
const JOB_SKILLS={mayor:'governance',farmer:'agriculture',lumberjack:'forestry',blacksmith:'metallurgy',merchant:'trade',builder:'construction',miner:'mining',hunter:'hunting',priest:'culture',shopkeeper:'trade'};
const PRODUCE={farmer:{resource:'food',qty:4,icon:'🥕'},lumberjack:{resource:'wood',qty:4,icon:'🪵'},hunter:{resource:'food',qty:2,icon:'🥩'}};

export class LivingSocietyManager{
  constructor({state,scene,npcManager,villageManager,resourceManager=null,groundResolver=null,onStatus=()=>{}}={}){
    this.state=state;this.scene=scene;this.npcManager=npcManager;this.villageManager=villageManager;this.resourceManager=resourceManager;this.groundResolver=groundResolver;this.onStatus=onStatus;this.acc=0;this.marketAcc=0;this.tradeAcc=0;this._lastFrameNow=0;this.infrastructureGroup=new THREE.Group();this.infrastructureGroup.name='living-economy-infrastructure';scene?.scene?.add?.(this.infrastructureGroup);this.ensureState();this.seedAll();this.rebuildInfrastructure();this.infrastructureVillageCount=(this.state.villages||[]).length;scene?.addLoopHook?.((dt)=>this.update(dt));
  }
  _ground(p){try{const q=this.groundResolver?this.groundResolver([Number(p?.[0])||0,Number(p?.[1])||0,Number(p?.[2])||0]):p;return Array.isArray(q)?[Number(q[0])||0,Number(q[1])||0,Number(q[2])||0]:[Number(p?.[0])||0,Number(p?.[1])||0,Number(p?.[2])||0]}catch{return [Number(p?.[0])||0,Number(p?.[1])||0,Number(p?.[2])||0]}}
  _worldPerCadMm(){try{const a=this.scene?.cadPointToWorld?.([0,0,0]),b=this.scene?.cadPointToWorld?.([1000,0,0]);if(a&&b)return Math.max(1e-9,a.distanceTo(b)/1000)}catch{}return 1}
  _groundVillageInfrastructure(v){
    const px=Number(v.position?.[0]||0),py=Number(v.position?.[1]||0),pz=Number(v.position?.[2]||0);
    v.position=this._ground([px,py,pz]);
    const z=v.position[2],g=(pos)=>this._ground([Number(pos?.[0])||0,Number(pos?.[1])||0,z]);
    if(v.logistics?.warehouse)v.logistics.warehouse.position=g(v.logistics.warehouse.position);
    for(const site of Object.values(v.logistics?.worksites||{}))if(site?.position)site.position=g(site.position);
    for(const r of v.logistics?.roads||[]){r.from=g(r.from);r.to=g(r.to)}
    return v;
  }
  ensureState(){
    this.state.lifeSim={enabled:true,aging:true,dayLengthMinutes:15,secondsPerSimYear:900,deathEnabled:true,birthEnabled:false,...(this.state.lifeSim||{})};
    this.state.civilization=this.state.civilization||{};
    const c=this.state.civilization;
    c.commonCurrency=c.commonCurrency||{code:'PT',name:'Common Point'};
    c.technologies=Array.isArray(c.technologies)?c.technologies:[
      {id:'fire',name:'火',level:1},{id:'agriculture',name:'農耕',level:1},{id:'woodworking',name:'木工',level:1},{id:'metallurgy',name:'金属加工',level:0},{id:'trade',name:'交易',level:1}
    ];
    c.factions=Array.isArray(c.factions)?c.factions:[];c.markets=Array.isArray(c.markets)?c.markets:[];c.financialInstitutions=Array.isArray(c.financialInstitutions)?c.financialInstitutions:[];
    for(const v of this.state.villages||[])this.ensureVillage(v);
    return c;
  }
  ensureVillage(v){
    v.territory=v.territory||{radiusMm:14000,claimed:true};
    v.currency=v.currency||{code:'PT',name:'Common Point',exchangeToPT:1,independent:false};
    v.resources=v.resources||{food:200,wood:120,stone:100,iron:35};
    v.goods=v.goods||{tools:8,buildingParts:12};
    v.economy=v.economy||{};
    v.economy.wealth=Number.isFinite(Number(v.economy.wealth))?Number(v.economy.wealth):Number(v.treasury)||3000;
    v.economy.prices=v.economy.prices||{food:4,wood:7,stone:6,iron:18};
    v.economy.production=v.economy.production||{};v.economy.consumption=v.economy.consumption||{};v.economy.demand=v.economy.demand||{};v.economy.supply=v.economy.supply||{};v.economy.taxRate=Number(v.economy.taxRate??.05);
    v.technology=v.technology||{agriculture:1,forestry:1,construction:1,metallurgy:0,trade:1,culture:1,governance:1};
    v.diplomacy=v.diplomacy||{allies:[],enemies:[],neutral:[]};v.culture=v.culture||{name:'開拓文化',traditions:[]};
    v.logistics=v.logistics||{};
    v.logistics.warehouse=v.logistics.warehouse||{name:`${v.name} 共同倉庫`,position:[Number(v.position?.[0]||0)+2200,Number(v.position?.[1]||0)-900,Number(v.position?.[2]||0)],capacity:2000};
    v.logistics.flows=Array.isArray(v.logistics.flows)?v.logistics.flows:[];v.logistics.delivered=Number(v.logistics.delivered)||0;v.logistics.shopTransfers=Number(v.logistics.shopTransfers)||0;
    const px=Number(v.position?.[0]||0),py=Number(v.position?.[1]||0),pz=Number(v.position?.[2]||0);
    v.logistics.worksites=v.logistics.worksites||{farm:{name:'共同農地',position:[px-4200,py+1400,pz]},forest:{name:'伐採地',position:[px-5200,py-700,pz]},mine:{name:'採掘場',position:[px-6500,py+2600,pz]},workshop:{name:'工房',position:[px+3600,py+1500,pz]},market:{name:'市場',position:[px+900,py+300,pz]}};
    v.logistics.roads=Array.isArray(v.logistics.roads)?v.logistics.roads:[
      {id:`${v.id}-R1`,from:[px,py,pz],to:v.logistics.warehouse.position,type:'village'},
      {id:`${v.id}-R2`,from:[px,py,pz],to:v.logistics.worksites.farm.position,type:'farm'},
      {id:`${v.id}-R3`,from:[px,py,pz],to:v.logistics.worksites.workshop.position,type:'workshop'},
      {id:`${v.id}-R4`,from:[px,py,pz],to:v.logistics.worksites.market.position,type:'market'}
    ];
    v.logistics.cartCapacity=Number(v.logistics.cartCapacity)||24;v.logistics.cartTrips=Number(v.logistics.cartTrips)||0;v.logistics.interVillageTransfers=Number(v.logistics.interVillageTransfers)||0;
    v.logistics.roadSpeedMultiplier=Number(v.logistics.roadSpeedMultiplier)||1.55;
    v.logistics.transport=v.logistics.transport||{handcart:2,oxCart:1,horseCart:1};
    v.industry=v.industry||{workshopQueue:[],completed:0};v.industry.workshopQueue=Array.isArray(v.industry.workshopQueue)?v.industry.workshopQueue:[];
    v.economy.tariffRate=Number.isFinite(Number(v.economy.tariffRate))?Number(v.economy.tariffRate):0.04;
    return this._groundVillageInfrastructure(v);
  }
  cadWorld(p){try{return this.scene?.cadPointToWorld?this.scene.cadPointToWorld(p):new THREE.Vector3(Number(p?.[0])||0,Number(p?.[2])||0,Number(p?.[1])||0)}catch{return new THREE.Vector3(Number(p?.[0])||0,Number(p?.[2])||0,Number(p?.[1])||0)}}
  surfaceNormalAtCad(p){
    try{const w=this.cadWorld(p),n=w.clone().normalize();if(n.lengthSq()>.5)return n}catch{}
    try{const a=this.scene?.cadPointToWorld?.([0,0,0]),b=this.scene?.cadPointToWorld?.([0,0,1]);if(a&&b)return b.sub(a).normalize()}catch{}
    return new THREE.Vector3(0,1,0);
  }
  orientYToSurface(object,cadPos){
    if(!object)return object;const n=this.surfaceNormalAtCad(cadPos),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),n);object.quaternion.copy(q);return object;
  }
  offsetAlongSurface(object,cadPos,mm=0){
    if(!object)return object;const n=this.surfaceNormalAtCad(cadPos);object.position.addScaledVector(n,Math.max(0,Number(mm)||0)*this._worldPerCadMm());return object;
  }
  rebuildInfrastructure(){
    if(!this.infrastructureGroup)return;while(this.infrastructureGroup.children.length){const o=this.infrastructureGroup.children.pop();o.traverse?.(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m?.dispose?.());else c.material?.dispose?.()})}
    const k=this._worldPerCadMm(),roadMat=new THREE.LineBasicMaterial({color:0x9b8768,transparent:true,opacity:.72});
    for(const raw of this.state.villages||[]){const v=this.ensureVillage(raw),ws=v.logistics.worksites;
      for(const r of v.logistics.roads||[]){const a=this.cadWorld(r.from),b=this.cadWorld(r.to),g=new THREE.BufferGeometry().setFromPoints([a,b]),line=new THREE.Line(g,roadMat.clone());line.name=`road:${r.id}`;line.userData={villageId:v.id,roadId:r.id};this.infrastructureGroup.add(line)}
      const farmCad=this._ground(ws.farm.position),farmPos=this.cadWorld(farmCad),farm=new THREE.Mesh(new THREE.BoxGeometry(10000*k,24*k,6500*k),new THREE.MeshStandardMaterial({color:0x6d793f,roughness:1}));farm.position.copy(farmPos);this.orientYToSurface(farm,farmCad);this.offsetAlongSurface(farm,farmCad,9);farm.name=`farm:${v.id}`;this.infrastructureGroup.add(farm);
      const farmUp=this.surfaceNormalAtCad(farmCad),farmRight=new THREE.Vector3(1,0,0).applyQuaternion(farm.quaternion),farmForward=new THREE.Vector3(0,0,1).applyQuaternion(farm.quaternion);
      for(let i=0;i<11;i++){const row=new THREE.Mesh(new THREE.BoxGeometry(9200*k,18*k,150*k),new THREE.MeshStandardMaterial({color:0x8b6d45,roughness:1}));row.position.copy(farmPos).addScaledVector(farmUp,20*k).addScaledVector(farmForward,(i-5)*520*k);row.quaternion.copy(farm.quaternion);this.infrastructureGroup.add(row)}
      for(let ix=-4;ix<=4;ix++)for(let iz=-4;iz<=4;iz++){const crop=new THREE.Mesh(new THREE.ConeGeometry(90*k,420*k,5),new THREE.MeshStandardMaterial({color:0x5f8d3e,roughness:1}));crop.position.copy(farmPos).addScaledVector(farmUp,220*k).addScaledVector(farmRight,ix*950*k).addScaledVector(farmForward,iz*600*k);crop.quaternion.copy(farm.quaternion);this.infrastructureGroup.add(crop)}
      const mineCad=this._ground(ws.mine.position),minePos=this.cadWorld(mineCad),mine=new THREE.Mesh(new THREE.CylinderGeometry(520*k,720*k,260*k,12),new THREE.MeshStandardMaterial({color:0x5d5b58,roughness:1}));mine.position.copy(minePos);this.orientYToSurface(mine,mineCad);this.offsetAlongSurface(mine,mineCad,130);mine.name=`mine:${v.id}`;this.infrastructureGroup.add(mine);
    }
    const villages=this.state.villages||[];for(let i=0;i<villages.length;i++)for(let j=i+1;j<villages.length;j++){const a=this.cadWorld(this._ground(villages[i].position)),b=this.cadWorld(this._ground(villages[j].position)),g=new THREE.BufferGeometry().setFromPoints([a,b]),line=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xb39a73,transparent:true,opacity:.48}));line.name=`trade-road:${villages[i].id}:${villages[j].id}`;this.infrastructureGroup.add(line)}
  }
  seedAll(){for(const n of this.state.characters||[])this.ensurePerson(n)}
  ensurePerson(n){
    n.vitals=n.vitals||{};const x=n.vitals;
    x.maxHp=Number(x.maxHp)||100;x.hp=clamp(x.hp??x.maxHp,0,x.maxHp);x.stamina=clamp(x.stamina??100,0,100);x.hunger=clamp(x.hunger??10,0,100);x.thirst=clamp(x.thirst??8,0,100);
    x.ageYears=Number.isFinite(Number(x.ageYears))?Number(x.ageYears):Math.round(rnd(18,58));x.lifeExpectancyYears=Number(x.lifeExpectancyYears)||Math.round(rnd(70,92));x.alive=x.alive!==false;x.causeOfDeath=x.causeOfDeath||null;
    n.mind=n.mind||{};n.mind.intelligence=clamp(n.mind.intelligence??Math.round(rnd(35,85)),1,100);n.mind.commandCapacity=Number(n.mind.commandCapacity)||Math.max(2,Math.round(n.mind.intelligence/10));n.mind.learnedCommands=Array.isArray(n.mind.learnedCommands)?n.mind.learnedCommands:['FOLLOW','WAIT'];
    n.inventory=n.inventory||{items:[]};n.assets=n.assets||{cash:Math.round(rnd(40,350)),propertyIds:[],debts:[],claims:[]};
    n.family=n.family||{spouseId:null,parentIds:[],childrenIds:[],lineageId:n.id,genes:{height:Number(n.height)||170,intelligence:n.mind.intelligence,longevity:x.lifeExpectancyYears}};
    if(n.controlled&&this.state.avatar?.controlledNpcId!==n.id)n.controlled=false;
    n.life=n.life||{state:'idle',home:[...(n.position||[0,0,0])],work:null,lastStateChange:0,sleeping:false};n.life.workProgress=Number(n.life.workProgress)||0;n.life.cargo=n.life.cargo||null;n.life.cart=n.life.cart||{active:false,capacity:0};n.life.resourceTarget=n.life.resourceTarget||null;n.life.activityLabel=n.life.activityLabel||'待機';n.life.destinationLabel=n.life.destinationLabel||'';n.life.lastSocialAt=Number(n.life.lastSocialAt)||0;
    const v=(this.state.villages||[]).find(q=>q.id===n.villageId);if(v){this.ensureVillage(v);const key=n.role==='farmer'?'farm':n.role==='lumberjack'?'forest':n.role==='miner'?'mine':n.role==='merchant'||n.role==='shopkeeper'?'market':'workshop',site=v.logistics?.worksites?.[key];if(site?.position)n.life.work=[...site.position];else{const off=JOB_WORK[n.role]||[0,0];n.life.work=this._ground([Number(v.position?.[0]||0)+off[0],Number(v.position?.[1]||0)+off[1],Number(v.position?.[2]||0)]);}}
    return n;
  }
  villageFor(n){const v=(this.state.villages||[]).find(q=>q.id===n.villageId);return v?this.ensureVillage(v):null}
  shopForVillage(v){return (this.state.shops||[]).find(s=>s.villageId===v?.id)||(this.state.shops||[]).find(s=>dist2(s.position,v?.position)<12000)||null}
  simHour(){return ((Number(this.state.planet?.simTimeHours)||0)%24+24)%24}
  stateLabel(state){return ({dead:'死亡',controlled:'操作中',deliver:'運搬中',sleep:'睡眠',work:'仕事',market:'買い物/市場',leisure:'余暇',social:'交流',escort:'護衛',idle:'待機'})[state]||String(state||'待機')}
  desiredState(n,h){if(!n.vitals?.alive)return 'dead';if(n.controlled)return 'controlled';if(n.life?.cargo?.qty>0)return 'deliver';if(h>=22||h<6)return 'sleep';if(h>=7&&h<17)return 'work';if(h>=17&&h<19)return 'market';if(h>=19&&h<20.5)return 'social';return 'leisure'}
  targetFor(n,state){const v=this.villageFor(n);if(!v)return n.position||[0,0,0];const p=v.position||[0,0,0];if(state==='sleep'){const home=n.life.homeInside||n.life.home||n.position,door=n.life.homeDoor;if(door&&dist2(n.position,door)>220)return [...door];return [...home];}if(state==='work'){if(n.life.resourceTarget?.position)return [...n.life.resourceTarget.position];const key=n.role==='farmer'?'farm':n.role==='lumberjack'?'forest':n.role==='miner'?'mine':n.role==='merchant'||n.role==='shopkeeper'?'market':'workshop',site=v.logistics?.worksites?.[key]?.position;if(site){n.life.work=[...site];return [...site]}return n.life.work||p}if(state==='deliver')return n.life.cargo?.destination||v.logistics.warehouse.position;if(state==='market')return v.logistics?.worksites?.market?.position||[p[0]+900,p[1]+300,p[2]];if(state==='social')return this._ground([p[0]+rnd(-650,650),p[1]+rnd(-650,650),p[2]]);if(state==='leisure')return this._ground([p[0]+rnd(-1300,1300),p[1]+rnd(-1300,1300),p[2]]);return n.position||p}
  _pointSegDistance(p,a,b){const px=Number(p?.[0])||0,py=Number(p?.[1])||0,ax=Number(a?.[0])||0,ay=Number(a?.[1])||0,bx=Number(b?.[0])||0,by=Number(b?.[1])||0,dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;if(l2<1e-9)return Math.hypot(px-ax,py-ay);const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/l2));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))}
  roadMultiplier(n){const v=this.villageFor(n);if(!v)return 1;const p=n.position||[0,0,0];for(const r of v.logistics.roads||[])if(this._pointSegDistance(p,r.from,r.to)<550)return Number(v.logistics.roadSpeedMultiplier)||1.55;return 1}
  moveToward(n,target,dt){if(!target||n.controlled)return;const p=n.position||[0,0,0],dx=target[0]-p[0],dy=target[1]-p[1],d=Math.hypot(dx,dy);if(d<80){n.life.arrivedAt=Date.now();return}const road=this.roadMultiplier(n),base=n.life?.cart?.active?650:900,speed=base*road*dt,step=Math.min(d,speed);const next=[p[0]+dx/d*step,p[1]+dy/d*step,target[2]??p[2]];try{const g=this._ground(next);n.position=[g[0],g[1],g[2]]}catch{n.position=next}n.yaw=(Math.atan2(dx,-dy)*180/Math.PI+360)%360}
  startCargo(n,{resource,qty,icon='📦',destination,type='warehouse'}={}){if(!resource||!(qty>0))return false;n.life.cargo={resource,qty,icon,destination:[...(destination||this.villageFor(n)?.logistics?.warehouse?.position||n.position)],type,createdAt:Date.now()};const v=this.villageFor(n);n.life.cart={active:qty>=4||type==='trade',capacity:Number(v?.logistics?.cartCapacity)||24,kind:type==='trade'?'horse-cart':qty>=10?'ox-cart':'handcart'};n.life.state='deliver';n.life.target=[...n.life.cargo.destination];return true}
  resourceWorkTick(n,v,dt){
    const type=n.role==='lumberjack'?'tree':n.role==='miner'?'ore':null;n.life.workMotion=null;if(!type||!this.resourceManager)return false;
    let t=n.life.resourceTarget;if(!t||t.type!==type){const key=type==='tree'?'forest':'mine',site=v.logistics?.worksites?.[key]?.position||n.position;let hit=this.resourceManager.nearestToCad?.(site,{types:[type],maxMm:32000});if(!hit)hit=this.resourceManager.nearestToCad?.(n.position,{types:[type],maxMm:42000});if(!hit){n.life.activityLabel=type==='tree'?'伐採できる木を探索中':'鉱床を探索中';n.life.target=[...site];return false}t=n.life.resourceTarget={nodeId:hit.node.id,type,position:this._ground(hit.position)};n.life.target=[...t.position];n.life.activityLabel=type==='tree'?'木へ移動中':'鉱床へ移動中';return true}
    const live=this.resourceManager.state?.survival?.resourceNodes?.find?.(x=>x.id===t.nodeId);if(!live||live.depleted){n.life.resourceTarget=null;n.life.target=this.targetFor(n,'work');return true}
    if(dist2(n.position,t.position)>420){n.life.target=[...t.position];n.life.activityLabel=n.role==='lumberjack'?'木へ移動中':'鉱床へ移動中';return true}
    n.life.workMotion=n.role==='lumberjack'?'chop':'mine';n.life.activityLabel=n.role==='lumberjack'?'木を伐採中':'採掘中';
    n.life.workProgress+=dt*(.9+n.mind.intelligence/130);if(n.life.workProgress<2.5)return true;n.life.workProgress=0;const out=this.resourceManager.harvestNodeForNpc?.(t.nodeId,{power:n.role==='miner'?1.2:1});if(!out||out.depleted){n.life.resourceTarget=null;if(out?.qty){const resource=out.resource==='ironOre'?'iron':out.resource;this.startCargo(n,{resource,qty:Math.min(out.qty,12),icon:n.role==='miner'?'⛏️':'🪵',destination:v.logistics.warehouse.position,type:'warehouse'})}return true}return true;
  }
  farmTick(n,v,dt){const farm=v.logistics.worksites.farm;let t=n.life.resourceTarget;if(!t||t.type!=='farm'){const spread=(String(n.id||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0)%9)-4,spread2=(String(n.id||'').length*3%7)-3,pos=this._ground([farm.position[0]+spread*720,farm.position[1]+spread2*620,farm.position[2]]);t=n.life.resourceTarget={nodeId:`farm:${v.id}:${n.id}`,type:'farm',position:pos};n.life.target=[...pos]}n.life.workMotion=null;if(dist2(n.position,t.position)>500){n.life.target=[...t.position];n.life.activityLabel='畑へ移動中';return true}n.life.workMotion='farm';n.life.activityLabel='農作業中';n.life.workProgress+=dt*(.8+n.mind.intelligence/140);if(n.life.workProgress>=5){n.life.workProgress=0;n.life.resourceTarget=null;this.startCargo(n,{resource:'food',qty:6,icon:'🥕',destination:v.logistics.warehouse.position,type:'warehouse'})}return true}
  enqueueWorkshop(v,job){this.ensureVillage(v);const q=v.industry.workshopQueue;if(q.length>20)return false;q.push({id:`JOB-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,progress:0,...job});return true}
  processWorkshopQueue(v,dt){const q=v.industry?.workshopQueue||[],job=q[0];if(!job)return;job.progress=(Number(job.progress)||0)+dt;if(job.progress<(Number(job.seconds)||8))return;q.shift();const qty=Number(job.qty)||1;if(job.resource in v.resources)v.resources[job.resource]=(Number(v.resources[job.resource])||0)+qty;else v.goods[job.resource]=(Number(v.goods[job.resource])||0)+qty;v.industry.completed=(Number(v.industry.completed)||0)+qty;this.recordFlow(v,{kind:'manufacture',resource:job.resource,qty,to:'warehouse'})}
  productionTick(n,dt){const v=this.villageFor(n);if(!v)return;const skill=JOB_SKILLS[n.role]||'culture';v.economy.production[skill]=(Number(v.economy.production[skill])||0)+dt;const gain=dt*.022*(.65+n.mind.intelligence/200);v.economy.wealth+=gain;n.assets.cash+=gain*.35;
    if(n.role==='farmer'){this.farmTick(n,v,dt);return}
    if(n.role==='lumberjack'||n.role==='miner'){this.resourceWorkTick(n,v,dt);return}
    if(dist2(n.position,n.life.work)>500)return;
    if(n.role==='merchant'||n.role==='shopkeeper'){this.merchantTick(n,v,dt);return}
    n.life.workProgress+=dt*(.7+n.mind.intelligence/120);
    const threshold=7;if(n.life.workProgress<threshold)return;n.life.workProgress=0;
    const prod=PRODUCE[n.role];if(prod){this.startCargo(n,{...prod,destination:v.logistics.warehouse.position,type:'warehouse'});return}
    if(n.role==='blacksmith'&&Number(v.resources.iron)>=1){v.resources.iron-=1;this.enqueueWorkshop(v,{resource:'tools',qty:1,seconds:7,workerId:n.id});v.technology.metallurgy=Math.min(10,v.technology.metallurgy+.003);return}
    if(n.role==='builder'&&Number(v.resources.wood)>=1&&Number(v.resources.stone)>=1){v.resources.wood-=1;v.resources.stone-=1;this.enqueueWorkshop(v,{resource:'buildingParts',qty:1,seconds:8,workerId:n.id});v.technology.construction=Math.min(10,v.technology.construction+.002);return}
    if(n.role==='mayor')v.economy.wealth+=.5;if(n.role==='priest')v.technology.culture=Math.min(10,v.technology.culture+.001);
  }
  merchantTick(n,v,dt){n.life.workProgress+=dt;if(n.life.workProgress<5)return;n.life.workProgress=0;const shop=this.shopForVillage(v);if(!shop)return;const candidates=(shop.stock||[]).filter(l=>l.kind==='resource'&&Number(l.quantity)<22&&Number(v.resources?.[l.resource])>2).sort((a,b)=>Number(a.quantity)-Number(b.quantity));const line=candidates[0];if(!line)return;const qty=Math.min(6,Math.floor(Number(v.resources[line.resource])||0));if(qty<=0)return;v.resources[line.resource]-=qty;this.startCargo(n,{resource:line.resource,qty,icon:'📦',destination:shop.position,type:'shop',shopId:shop.id,sku:line.sku});this.recordFlow(v,{kind:'dispatch',actor:n.id,resource:line.resource,qty,to:'shop'});}
  deliverTick(n){const c=n.life?.cargo,v=this.villageFor(n);if(!c||!v)return false;if(dist2(n.position,c.destination)>180)return false;if(c.type==='shop'){const shop=(this.state.shops||[]).find(s=>s.id===c.shopId)||this.shopForVillage(v);const line=shop?.stock?.find(l=>l.sku===c.sku||l.resource===c.resource);if(line){line.quantity=(Number(line.quantity)||0)+c.qty;v.logistics.shopTransfers+=c.qty;this.recordFlow(v,{kind:'shop',actor:n.id,resource:c.resource,qty:c.qty,to:shop.id});}}
    else if(c.type==='trade'){const dest=(this.state.villages||[]).find(x=>x.id===c.destinationVillageId);if(dest){this.ensureVillage(dest);if(c.resource in dest.resources)dest.resources[c.resource]=(Number(dest.resources[c.resource])||0)+c.qty;else dest.goods[c.resource]=(Number(dest.goods[c.resource])||0)+c.qty;const rate=Math.max(0,Number(dest.economy?.tariffRate)||0),unit=Number(dest.economy?.prices?.[c.resource])||1,ptValue=c.qty*unit*(Number(v.currency?.exchangeToPT)||1),tariff=ptValue*rate;dest.economy.wealth=(Number(dest.economy.wealth)||0)+tariff;v.economy.wealth=Math.max(0,(Number(v.economy.wealth)||0)-tariff);v.logistics.interVillageTransfers+=c.qty;v.logistics.cartTrips++;this.recordFlow(v,{kind:'trade',actor:n.id,resource:c.resource,qty:c.qty,to:dest.id});}}
    else{if(c.resource in v.resources)v.resources[c.resource]=(Number(v.resources[c.resource])||0)+c.qty;else v.goods[c.resource]=(Number(v.goods[c.resource])||0)+c.qty;v.logistics.delivered+=c.qty;if(n.life.cart?.active)v.logistics.cartTrips++;this.recordFlow(v,{kind:'warehouse',actor:n.id,resource:c.resource,qty:c.qty,to:'warehouse'});}
    n.life.cargo=null;n.life.cart={active:false,capacity:n.life.cart?.capacity||24,kind:n.life.cart?.kind||'handcart'};n.life.resourceTarget=null;n.life.state='work';n.life.target=this.targetFor(n,'work');return true
  }
  consumeVillage(v,dt){const people=(v.residents||[]).length||1;const foodUse=people*dt*.0008;v.resources.food=Math.max(0,Number(v.resources.food)-foodUse);v.economy.consumption.food=(Number(v.economy.consumption.food)||0)+foodUse;if(v.resources.food<20)v.economy.demand.food=(Number(v.economy.demand.food)||0)+dt*.04;}
  interVillageTradeTick(){
    const villages=(this.state.villages||[]).map(v=>this.ensureVillage(v));if(villages.length<2)return;
    for(const src of villages){const merchant=(this.state.characters||[]).find(n=>n.villageId===src.id&&(n.role==='merchant'||n.role==='shopkeeper')&&n.vitals?.alive!==false&&!n.life?.cargo);if(!merchant)continue;
      const dst=villages.filter(v=>v.id!==src.id).sort((a,b)=>dist2(src.position,a.position)-dist2(src.position,b.position))[0];if(!dst)continue;
      const resources=['food','wood','stone','iron'];let best=null,score=0;for(const r of resources){const surplus=(Number(src.resources[r])||0)-(Number(dst.resources[r])||0);if(surplus>score){score=surplus;best=r}}if(!best||score<35)continue;
      const qty=Math.min(12,Math.floor(score/3),Math.floor(Number(src.resources[best])||0));if(qty<=0)continue;src.resources[best]-=qty;this.startCargo(merchant,{resource:best,qty,icon:'🛒',destination:dst.logistics.warehouse.position,type:'trade'});merchant.life.cargo.destinationVillageId=dst.id;merchant.life.cargo.caravanId=`CARAVAN-${Date.now()}-${merchant.id}`;const guard=(this.state.characters||[]).find(n=>n.villageId===src.id&&n.id!==merchant.id&&(n.role==='hunter'||n.social?.companion)&&n.vitals?.alive!==false&&!n.life?.cargo);if(guard){guard.life=guard.life||{};guard.life.escortTargetId=merchant.id;guard.life.state='escort';guard.life.target=[...(merchant.position||src.position)]}this.recordFlow(src,{kind:'trade-dispatch',actor:merchant.id,resource:best,qty,to:dst.id});
    }
  }
  marketTick(){for(const raw of this.state.villages||[]){const v=this.ensureVillage(raw),shop=this.shopForVillage(v);if(!shop)continue;this.consumeVillage(v,1);for(const line of shop.stock||[]){if(line.kind!=='resource')continue;line.basePrice=Number(line.basePrice)||Number(line.price)||10;line.baseBuyPrice=Number(line.baseBuyPrice)||Number(line.buyPrice)||Math.max(1,line.basePrice*.45);const target=30,warehouse=Number(v.resources?.[line.resource])||0,store=Number(line.quantity)||0,effective=store+Math.min(target,warehouse*.2),shortage=clamp((target-effective)/target,-1,1),demand=Number(v.economy.demand?.[line.resource])||0,supply=Number(v.economy.supply?.[line.resource])||0;const factor=clamp(1+shortage*.55+(demand-supply)*.015,.55,2.4);line.price=Math.max(1,Math.round(line.basePrice*factor));line.buyPrice=Math.max(1,Math.round(line.price*.45));v.economy.prices[line.resource]=line.price;v.economy.demand[line.resource]=demand*.94;v.economy.supply[line.resource]=supply*.94;}}
  }
  agingTick(n,dt){if(!this.state.lifeSim.aging||!n.vitals.alive)return;const secPerYear=Math.max(60,Number(this.state.lifeSim.secondsPerSimYear)||900);n.vitals.ageYears+=dt/secPerYear;n.vitals.hunger=clamp(n.vitals.hunger+dt*.018,0,100);n.vitals.thirst=clamp(n.vitals.thirst+dt*.025,0,100);if(n.vitals.hunger>85||n.vitals.thirst>90)n.vitals.hp=clamp(n.vitals.hp-dt*.15,0,n.vitals.maxHp);if(this.state.lifeSim.deathEnabled&&(n.vitals.hp<=0||n.vitals.ageYears>=n.vitals.lifeExpectancyYears)){this.die(n,n.vitals.hp<=0?'衰弱':'老衰')}}
  die(n,cause='不明'){if(!n.vitals?.alive)return;n.vitals.alive=false;n.vitals.hp=0;n.vitals.causeOfDeath=cause;n.life.state='dead';n.life.diedAt=new Date().toISOString();const v=this.villageFor(n);if(v){v.memorials=Array.isArray(v.memorials)?v.memorials:[];v.memorials.push({personId:n.id,name:n.name,cause,age:Math.floor(n.vitals.ageYears),type:'grave',createdAt:new Date().toISOString()})}this.onStatus(`🪦 ${n.name} が${cause}で亡くなりました`,'info')}
  learnCommand(id,command){const n=(this.state.characters||[]).find(x=>x.id===id);if(!n)return false;this.ensurePerson(n);const a=n.mind.learnedCommands;if(a.includes(command))return true;if(a.length>=n.mind.commandCapacity)throw new Error(`${n.name} はこれ以上コマンドを覚えられません`);a.push(command);return true}
  marry(aId,bId){const a=(this.state.characters||[]).find(x=>x.id===aId),b=(this.state.characters||[]).find(x=>x.id===bId);if(!a||!b)throw new Error('婚姻対象が見つかりません');this.ensurePerson(a);this.ensurePerson(b);a.family.spouseId=b.id;b.family.spouseId=a.id;return {a:a.id,b:b.id,event:'marriage'} }
  economySummary(villageId){const v=(this.state.villages||[]).find(x=>x.id===villageId);if(!v)return null;this.ensureVillage(v);return clone({currency:v.currency,resources:v.resources,goods:v.goods,economy:v.economy,logistics:v.logistics,technology:v.technology,diplomacy:v.diplomacy})}
  update(dt=0){if(!this.state.lifeSim?.enabled)return;let raw=Number(dt)||0;if(raw>10){const now=raw;raw=this._lastFrameNow?Math.max(0,Math.min(.25,(now-this._lastFrameNow)/1000)):1/60;this._lastFrameNow=now}else raw=Math.max(0,Math.min(.25,raw));const vc=(this.state.villages||[]).length;if(vc!==this.infrastructureVillageCount){this.rebuildInfrastructure();this.infrastructureVillageCount=vc;this.seedAll()}const step=Math.min(.12,raw||1/60);this.acc+=step;this.marketAcc+=step;this.tradeAcc+=step;if(this.marketAcc>=2){this.marketTick();this.marketAcc=0}if(this.tradeAcc>=8){this.interVillageTradeTick();this.tradeAcc=0}if(this.acc<.12)return;const t=this.acc;this.acc=0;const h=this.simHour();for(const v of this.state.villages||[])this.processWorkshopQueue(this.ensureVillage(v),t);for(const e of this.state.characters||[]){if(e.life?.escortTargetId){const m=(this.state.characters||[]).find(x=>x.id===e.life.escortTargetId&&x.life?.cargo?.type==='trade');if(m){e.life.target=[...(m.position||e.position)];e.life.activityLabel='隊商を護衛';this.moveToward(e,e.life.target,t)}else{delete e.life.escortTargetId;e.life.state='work'}}}for(const raw of this.state.characters||[]){const n=this.ensurePerson(raw);this.agingTick(n,t);if(!n.vitals.alive){n.life.activityLabel='死亡';continue}const s=this.desiredState(n,h);if(n.life.state!==s){n.life.state=s;n.life.target=this.targetFor(n,s);n.life.lastStateChange=Date.now();n.life.sleeping=s==='sleep';n.life.arrivedAt=0}n.life.activityLabel=this.stateLabel(s);if(s!=='work')n.life.workMotion=null;const v=this.villageFor(n);if(!n.life.target||Date.now()-(n.life.lastTargetRefresh||0)>2200){if(s!=='deliver'&&s!=='controlled'){n.life.target=this.targetFor(n,s);n.life.lastTargetRefresh=Date.now();n.life.arrivedAt=0}}if(s==='sleep')n.life.destinationLabel=n.life.homeName||'自宅';else if(s==='work')n.life.destinationLabel=(v?.logistics?.worksites?.[n.role==='farmer'?'farm':n.role==='miner'?'mine':n.role==='lumberjack'?'forest':n.role==='merchant'||n.role==='shopkeeper'?'market':'workshop']?.name)||'仕事場';else if(s==='market')n.life.destinationLabel='市場';else if(s==='social'||s==='leisure')n.life.destinationLabel='広場';else if(s==='deliver')n.life.destinationLabel='配送先';else n.life.destinationLabel='';if(s==='sleep'){this.moveToward(n,n.life.target,t);let d=dist2(n.position,n.life.target);if(n.life.homeDoor&&dist2(n.life.target,n.life.homeDoor)<80&&d<180){n.life.target=[...(n.life.homeInside||n.life.home||n.position)];n.life.activityLabel='家の中へ移動中';this.moveToward(n,n.life.target,t);d=dist2(n.position,n.life.target);}if(d<140){n.vitals.stamina=clamp(n.vitals.stamina+t*.45,0,100);n.vitals.hunger=clamp(n.vitals.hunger-t*.04,0,100);n.vitals.thirst=clamp(n.vitals.thirst-t*.03,0,100)}}else{n.vitals.stamina=clamp(n.vitals.stamina-t*.025,0,100);this.moveToward(n,n.life.target,t);if((s==='leisure'||s==='social')&&n.life.arrivedAt&&Date.now()-n.life.arrivedAt>2200){if(s==='social'&&Date.now()-n.life.lastSocialAt>6000){const peers=(v?.residents||[]).map(id=>(this.state.characters||[]).find(x=>x.id===id)).filter(x=>x&&x.id!==n.id&&dist2(x.position,n.position)<1400);if(peers.length){const peer=peers[Math.floor(Math.random()*peers.length)];n.life.activityLabel=`${peer.name}と会話`;n.life.lastSocialAt=Date.now();const a=n.social||(n.social={});a.friendship=clamp((a.friendship||0)+.15,-100,100)}}n.life.target=this.targetFor(n,s);n.life.arrivedAt=0}if(s==='deliver')this.deliverTick(n);else if(s==='work')this.productionTick(n,t)}}}
}
