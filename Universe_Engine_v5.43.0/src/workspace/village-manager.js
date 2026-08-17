const clone=v=>JSON.parse(JSON.stringify(v));
const vid=()=>`VILLAGE-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*46656).toString(36).toUpperCase()}`;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

const JOBS=[
  ['村長','mayor','#6d79a8'],['農民','farmer','#70904e'],['木こり','lumberjack','#8a6846'],['鍛冶屋','blacksmith','#555d69'],
  ['商人','merchant','#9b6b45'],['大工','builder','#b08252'],['鉱夫','miner','#6f7278'],['狩人','hunter','#596b49'],['司祭','priest','#776b8f']
];

export class VillageManager{
  constructor({state,addPart,npcManager,shopManager,groundResolver=null,onStatus=()=>{}}={}){
    this.state=state;this.addPart=addPart;this.npcManager=npcManager;this.shopManager=shopManager;this.groundResolver=groundResolver;this.onStatus=onStatus;this.ensureState();this.repairVillageStructures();this.repairGrounding();
  }
  ensureState(){
    this.state.gameMode=this.state.gameMode||'survival';
    this.state.villages=Array.isArray(this.state.villages)?this.state.villages:[];
    for(const v of this.state.villages){v.residents=Array.isArray(v.residents)?v.residents:[];v.buildingIds=Array.isArray(v.buildingIds)?v.buildingIds:[];v.ownerId=v.ownerId||v.id;}
    for(const n of this.state.characters||[]){this.ensureRelation(n);}
    return this.state.villages;
  }
  ensureRelation(n){
    n.social=n.social||{};n.social.friendship=clamp(n.social.friendship??0,-100,100);n.social.trust=clamp(n.social.trust??0,0,100);n.social.faith=clamp(n.social.faith??0,0,100);n.social.family=!!n.social.family;n.social.companion=!!n.social.companion;n.social.gifts=Number(n.social.gifts)||0;n.social.events=Number(n.social.events)||0;return n.social;
  }
  _ground(p){try{return this.groundResolver?this.groundResolver(p):p}catch{return p}}
  _atGround(x,y,z=0){
    // Surface anchors must never inherit a stale/floating Z value.
    // X/Y identify the tangent-plane location; terrain resolves the authoritative Z.
    const g=this._ground([Number(x)||0,Number(y)||0,0]);
    return [Number(g?.[0])||0,Number(g?.[1])||0,Number(g?.[2])||0];
  }
  _centerOnGround(x,y,zHint,height){const g=this._atGround(x,y,zHint);return [g[0],g[1],g[2]+Math.max(0,Number(height)||0)/2]}
  _houseLayout(count=6){
    const n=Math.max(6,Number(count)||6),out=[],rings=Math.ceil(n/6);
    for(let i=0;i<n;i++){const ring=Math.floor(i/6),slot=i%6,ang=(slot/6)*Math.PI*2+(ring%2)*Math.PI/6,r=5600+ring*4300;out.push([Math.cos(ang)*r,Math.sin(ang)*r]);}
    return out;
  }

  repairVillageStructures(){
    for(const v of this.state.villages||[]){
      const residentCount=Math.max(6,(v.residents||[]).length),housePos=this._houseLayout(residentCount);
      const actual=(this.state.objects||[]).filter(o=>o?.metadata?.villageId===v.id);
      const mains=actual.filter(o=>o?.metadata?.villageRole==='house-floor');
      const existingHomeIds=new Set(mains.map(o=>o?.metadata?.homeId).filter(Boolean));
      for(let i=0;i<residentCount;i++){
        const label=`家 ${i+1}`,homeId=`${v.id}-${label}`;
        if(existingHomeIds.has(homeId))continue;
        const q=housePos[i],base=v.position||[0,0,0];
        this._house(v,[Number(base[0]||0)+q[0],Number(base[1]||0)+q[1],Number(base[2]||0)],label);
      }
      // Migrate v5.40-and-earlier solid-box houses into enterable wall shells.
      for(let i=0;i<residentCount;i++){
        const label=`家 ${i+1}`,homeId=`${v.id}-${label}`;
        const parts=(this.state.objects||[]).filter(o=>o?.metadata?.villageId===v.id&&o?.metadata?.homeId===homeId);
        const floor=parts.find(o=>o?.metadata?.villageRole==='house-floor');
        const hasWalls=parts.some(o=>String(o?.metadata?.villageRole||'').startsWith('house-wall'));
        if(!floor||hasWalls)continue;
        for(const old of parts.filter(o=>o?.metadata?.villageRole==='house')){old.visible=false;old.metadata=old.metadata||{};old.metadata.noCollision=true;old.metadata.migratedSolidHouse=true;if(old.mesh)old.mesh.visible=false;}
        const fz=(Number(floor.position?.[2])||0)-(Number(floor.params?.height)||160)/2;
        this._houseShell(v,{x:Number(floor.position?.[0])||0,y:Number(floor.position?.[1])||0,floorZ:fz,label,homeId});
      }
      v.buildingIds=[...new Set((this.state.objects||[]).filter(o=>o?.metadata?.villageId===v.id).map(o=>o.id))];
      const residents=(v.residents||[]).map(id=>(this.state.characters||[]).find(n=>n.id===id)).filter(Boolean);
      residents.forEach((n,i)=>{const idx=i%housePos.length,label=`家 ${idx+1}`,homeId=`${v.id}-${label}`,base=v.position||[0,0,0],q=housePos[idx],g=this._atGround(Number(base[0]||0)+q[0],Number(base[1]||0)+q[1],0),door=this._atGround(g[0],g[1]-1950,0);n.homeId=homeId;n.life=n.life||{};n.life.home=[...g];n.life.homeInside=[...g];n.life.homeDoor=[...door];n.life.homeName=`${v.name} ${label}`;});
    }
  }
  repairGrounding(){
    const objects=this.state.objects||[];
    const roleOffset=(o,role)=>{const h=Math.max(0,Number(o?.params?.height)||0);if(role==='roof')return 2460+Math.max(0,h/2-130);if(role==='house')return 160+h/2;return h/2};
    for(const o of objects){
      const m=o?.metadata||{};if(!m.villageBuilding)continue;const role=String(m.villageRole||'');
      // v5.38+ houses already carry a corner-sampled Surface Anchor and foundation piers.
      // Do not flatten those back to the center terrain sample during the generic repair pass.
      if(m.surfaceAnchored&&['house-floor','house','roof','foundation'].includes(role))continue;
      if(!['plaza','well','warehouse','workshop','market','house-floor','house','roof'].includes(role))continue;
      const x=Number(o.position?.[0])||0,y=Number(o.position?.[1])||0,g=this._atGround(x,y,0);
      o.position=[g[0],g[1],g[2]+roleOffset(o,role)];
      if(o.mesh){o.mesh.position.set(o.position[0],o.position[2],o.position[1]);o.mesh.updateMatrixWorld?.(true)}
    }
  }
  repairHouseSurfaceAnchors(){
    // Authoritative late-pass for village homes. Houses can be created before PlanetTerrain
    // and the work-coordinate frame are finalized, so a previous `surfaceAnchored` flag is
    // NOT proof that their stored Z is valid. Re-sample center + four support points now.
    const objects=this.state.objects||[];
    for(const v of this.state.villages||[]){
      const homes=this._houseLayout(Math.max(6,(v.residents||[]).length));
      for(let i=0;i<homes.length;i++){
        const label=`家 ${i+1}`,homeId=`${v.id}-${label}`,q=homes[i],base=v.position||[0,0,0];
        const x=(Number(base[0])||0)+q[0],y=(Number(base[1])||0)+q[1];
        const center=this._atGround(x,y,0),supports=[[-1900,-1500],[1900,-1500],[-1900,1500],[1900,1500]].map(([dx,dy])=>this._atGround(x+dx,y+dy,0));
        // Keep the house level. The underside of the floor sits just above the highest sampled terrain;
        // individual piers extend down to the remaining support points.
        // Keep homes visually attached to the local ground.  Using the absolute highest
        // corner could lift an entire house metres into the air on a noisy triangle.
        // Start at the centre surface and only accept a modest uphill correction; the
        // four foundation piers absorb the remaining slope independently.
        // Sink the slab thickness into the terrain so the FLOOR TOP is flush with local ground.
        // This removes the step that previously stopped avatars at the doorway.
        const floorBottom=center[2]-160;
        const parts=objects.filter(o=>o?.metadata?.villageId===v.id && (o?.metadata?.homeId===homeId || String(o?.name||'').startsWith(`${v.name} ${label} `)));
        for(const o of parts){
          o.metadata=o.metadata||{};o.metadata.homeId=homeId;o.metadata.surfaceAnchored=true;
          const role=String(o.metadata.villageRole||'');
          if(role==='house-floor')o.position=[center[0],center[1],floorBottom+(Number(o.params?.height)||160)/2];
          else if(role==='house'){o.visible=false;o.metadata.noCollision=true;if(o.mesh)o.mesh.visible=false;}
          else if(role.startsWith('house-wall')){const lx=Number(o.metadata.houseLocalX)||0,ly=Number(o.metadata.houseLocalY)||0;o.position=[center[0]+lx,center[1]+ly,floorBottom+160+(Number(o.params?.height)||2300)/2];}
          else if(role==='roof')o.position=[center[0],center[1],floorBottom+160+2300+(Number(o.params?.height)||260)/2];
          else if(role==='foundation'){
            let fi=Number(o.metadata.foundationIndex);if(!Number.isFinite(fi)){const m=String(o.name||'').match(/基礎(\d+)/);fi=m?Math.max(0,Number(m[1])-1):0;}fi=Math.max(0,Math.min(3,fi));
            const c=supports[fi],h=Math.max(80,floorBottom-c[2]);o.params=o.params||{};o.params.height=h;o.position=[c[0],c[1],c[2]+h/2];o.metadata.foundationIndex=fi;
          }
        }
      }
    }
    return true;
  }
  repairAllSurfaceAnchors(){
    // Run after PlanetTerrain + work-coordinate frame exist. This is the authoritative
    // late pass that brings previously saved/floating village structures back to ground.
    this.repairVillageStructures();
    this.repairHouseSurfaceAnchors();
    this.repairGrounding();
    for(const v of this.state.villages||[]){
      const base=v.position||[0,0,0],g=this._atGround(base[0],base[1],0);
      v.position=[g[0],g[1],g[2]];
      const homes=this._houseLayout(Math.max(6,(v.residents||[]).length));
      (v.residents||[]).forEach((id,i)=>{
        const n=(this.state.characters||[]).find(x=>x.id===id);if(!n)return;
        const q=homes[i%homes.length],hg=this._atGround(g[0]+q[0],g[1]+q[1],0);
        n.homeId=`${v.id}-家 ${i+1}`;n.life=n.life||{};n.life.home=[...hg];n.life.homeInside=[...hg];n.life.homeDoor=[...this._atGround(hg[0],hg[1]-1950,0)];n.life.homeName=`${v.name} 家 ${i+1}`;
      });
    }
    return true;
  }
  list(){return this.ensureState()}
  get(id){return this.ensureState().find(v=>v.id===id)||null}
  setMode(mode){this.state.gameMode=mode==='creator'?'creator':'survival';this.onStatus(`ゲームモード: ${this.state.gameMode==='creator'?'CREATOR':'SURVIVAL'}`,'command');return this.state.gameMode}
  canModifyObject(o){if(!o)return true;if(this.state.gameMode==='creator'||this.state.creator?.enabled)return true;const m=o.metadata||{};if(!m.ownerId&&!m.protectedOwner)return true;return m.ownerId==='PLAYER'||m.ownerUserId===this.state.marketplace?.currentUserId;}
  _part(v,type,data){
    const metadata={...(data.metadata||{}),villageId:v.id,ownerId:v.ownerId,protectedOwner:true,villageBuilding:true};
    const o=this.addPart(type,{...data,entityKind:'building',metadata,components:{...(data.components||{}),ownership:{enabled:true,ownerId:v.ownerId,protected:true},village:{enabled:true,villageId:v.id}}},false);if(o)v.buildingIds.push(o.id);return o;
  }
  createVillage({name='はじまりの村',position=[0,0,0],population=8}={}){
    const p=this._ground([Number(position[0])||0,Number(position[1])||0,Number(position[2])||0]);
    const v={id:vid(),name,position:[...p],ownerId:null,residents:[],buildingIds:[],foundedAt:new Date().toISOString(),culture:{name:'開拓文化',traditions:[]},treasury:3000};v.ownerId=v.id;this.state.villages.push(v);
    const z=p[2];
    // Every village structure samples its OWN terrain point. This prevents floating on sloped/noisy terrain.
    this._part(v,'cylinder',{name:`${name} 広場`,params:{radius:3200,height:120},position:this._centerOnGround(p[0],p[1],z,120),color:0xb8a98b,metadata:{walkable:true,villageRole:'plaza'}});
    this._part(v,'cylinder',{name:`${name} 井戸`,params:{radius:650,height:850},position:this._centerOnGround(p[0],p[1],z,850),color:0x77736c,metadata:{villageRole:'well'}});
    const warehouseGround=this._atGround(p[0]+2200,p[1]-900,z);
    this._part(v,'box',{name:`${name} 共同倉庫`,params:{width:3000,height:1900,depth:2400},position:[warehouseGround[0],warehouseGround[1],warehouseGround[2]+950],color:0x9a7b55,metadata:{villageRole:'warehouse',warehouse:true}});
    const workshopGround=this._atGround(p[0]+3600,p[1]+1500,z);
    this._part(v,'box',{name:`${name} 工房`,params:{width:3300,height:2100,depth:2700},position:[workshopGround[0],workshopGround[1],workshopGround[2]+1050],color:0x7d6858,metadata:{villageRole:'workshop',workshop:true}});
    const marketGround=this._atGround(p[0]+900,p[1]+300,z);
    this._part(v,'box',{name:`${name} 市場`,params:{width:3600,height:180,depth:2600},position:[marketGround[0],marketGround[1],marketGround[2]+90],color:0xb39b72,metadata:{villageRole:'market',marketSquare:true,walkable:true}});
    const count=Math.max(6,Math.min(16,Number(population)||8)),housePos=this._houseLayout(count);
    housePos.forEach((q,i)=>this._house(v,[p[0]+q[0],p[1]+q[1],z],`家 ${i+1}`));
    // shop guaranteed inside village
    const shop=this.shopManager?.createShop?.({name:`${name} 雑貨店`,position:[p[0]+7200,p[1]+200,z],yaw:90});if(shop){shop.villageId=v.id;shop.ownerId=v.id;}
    for(let i=0;i<count;i++){const [occupation,role,body]=JOBS[i%JOBS.length],a=(i/count)*Math.PI*2,r=2200+(i%3)*700;const n=this.npcManager?.create?.({name:`${occupation} ${String(i+1).padStart(2,'0')}`,position:this._ground([p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r,z+5]),yaw:(a*180/Math.PI+180)%360,occupation,role,villageId:v.id,body,hair:i%2?'#2b1d18':'#4a3326',dialogue:[`こんにちは。${name}へようこそ。`,`私は${occupation}です。`]});if(n){this.ensureRelation(n);n.social.friendship=5;n.social.trust=0;n.social.faith=0;n.homeId=`${v.id}-家 ${i+1}`;const hg=this._atGround(p[0]+housePos[i][0],p[1]+housePos[i][1],0),hd=this._atGround(hg[0],hg[1]-1950,0);n.life={...(n.life||{}),home:[...hg],homeInside:[...hg],homeDoor:[...hd],homeName:`${name} 家 ${i+1}`};v.residents.push(n.id)}}
    this.onStatus(`🏘 ${name} を生成: ${count}人 / ${v.buildingIds.length}建築`,'command');return v;
  }
  _houseShell(v,{x,y,floorZ,label,homeId}={}){
    const wallH=2300,wallT=180,width=4200,depth=3400,doorW=1100,frontSeg=(width-doorW)/2;
    const wall=(name,w,d,px,py,role='house-wall')=>this._part(v,'box',{
      name:`${v.name} ${label} ${name}`,params:{width:w,height:wallH,depth:d},position:[px,py,floorZ+160+wallH/2],color:0xd1b68c,
      metadata:{villageRole:role,homeId,surfaceAnchored:true,houseLocalX:px-x,houseLocalY:py-y,houseFloorBase:true},
      components:{building:{enabled:true,primitive:'wall',layer:'wall'}}
    });
    wall('壁 奥',width,wallT,x,y+depth/2-wallT/2);
    wall('壁 左',wallT,depth-wallT*2,x-width/2+wallT/2,y);
    wall('壁 右',wallT,depth-wallT*2,x+width/2-wallT/2,y);
    wall('壁 正面左',frontSeg,wallT,x-(doorW+frontSeg)/2,y-depth/2+wallT/2,'house-wall-front');
    wall('壁 正面右',frontSeg,wallT,x+(doorW+frontSeg)/2,y-depth/2+wallT/2,'house-wall-front');
    // The doorway is intentionally empty geometry: avatar/NPCs can walk straight through it.
    // A small lintel keeps the facade looking like a house without blocking head clearance.
    this._part(v,'box',{name:`${v.name} ${label} 入口上`,params:{width:doorW,height:260,depth:wallT},position:[x,y-depth/2+wallT/2,floorZ+160+wallH-130],color:0xd1b68c,
      metadata:{villageRole:'house-wall-lintel',homeId,surfaceAnchored:true,houseLocalX:0,houseLocalY:-depth/2+wallT/2,houseFloorBase:true},components:{building:{enabled:true,primitive:'wall',layer:'wall'}}});
  }
  _house(v,pos,label){
    const x=Number(pos?.[0])||0,y=Number(pos?.[1])||0,homeId=`${v.id}-${label}`,g=this._atGround(x,y,0),z=g[2];
    const corners=[[-1900,-1500],[1900,-1500],[-1900,1500],[1900,1500]].map(([dx,dy])=>this._atGround(x+dx,y+dy,0));
    // The 160 mm slab is embedded into terrain: its TOP surface is exactly at local ground Z.
    // Avatars/NPCs therefore cross the doorway without having to climb a step.
    const floorZ=z-160;
    this._part(v,'box',{name:`${v.name} ${label} 床`,params:{width:4200,height:160,depth:3400},position:[g[0],g[1],floorZ+80],color:0x8d795f,
      metadata:{walkable:true,villageRole:'house-floor',homeId,surfaceAnchored:true},components:{building:{enabled:true,primitive:'floor',layer:'floor'}}});
    this._houseShell(v,{x:g[0],y:g[1],floorZ,label,homeId});
    this._part(v,'box',{name:`${v.name} ${label} 屋根`,params:{width:4500,height:260,depth:3700},position:[g[0],g[1],floorZ+2590],color:0x6b4937,
      metadata:{villageRole:'roof',homeId,surfaceAnchored:true},components:{building:{enabled:true,primitive:'roof',layer:'roof'}}});
    corners.forEach((c,i)=>{const gap=Math.max(80,floorZ-c[2]),dx=i%2?1900:-1900,dy=i>1?1500:-1500;this._part(v,'box',{
      name:`${v.name} ${label} 基礎${i+1}`,params:{width:360,height:gap,depth:360},position:[x+dx,y+dy,c[2]+gap/2],color:0x77756f,
      metadata:{villageRole:'foundation',homeId,foundationIndex:i,gravityFoundation:true,surfaceAnchored:true},components:{building:{enabled:true,primitive:'foundation',layer:'foundation'}}
    })});
  }
  social(npcId){const n=(this.state.characters||[]).find(x=>x.id===npcId);return n?this.ensureRelation(n):null}
  adjust(npcId,{friendship=0,trust=0,faith=0,event=''}={}){const n=(this.state.characters||[]).find(x=>x.id===npcId);if(!n)return null;const s=this.ensureRelation(n);s.friendship=clamp(s.friendship+friendship,-100,100);s.trust=clamp(s.trust+trust,0,100);s.faith=clamp(s.faith+faith,0,100);if(event)s.lastEvent=event;this._unlock(n);return s}
  talk(id){const s=this.adjust(id,{friendship:2,trust:1,event:'talk'});this.onStatus(`💬 会話: 友好 ${s?.friendship??0} / 信頼 ${s?.trust??0}`,'command');return s}
  gift(id,value=10){const n=(this.state.characters||[]).find(x=>x.id===id);if(!n)return null;const s=this.ensureRelation(n);s.gifts++;return this.adjust(id,{friendship:Math.max(2,Math.round(value/4)),trust:2,event:'gift'})}
  event(id,kind='help'){const map={help:{friendship:8,trust:8},festival:{friendship:5,faith:4},betrayal:{friendship:-25,trust:-30}};const d=map[kind]||map.help;const s=this.adjust(id,{...d,event:kind});if(s)s.events++;return s}
  _unlock(n){const s=this.ensureRelation(n);if(!s.companion&&s.friendship>=35&&s.trust>=25){s.companion=true;this.onStatus(`🤝 ${n.name} が仲間になりました`,'command')}if(!s.family&&s.companion&&s.friendship>=75&&s.trust>=65){s.familyEligible=true}n.directControlAllowed=!!s.companion;n.rtsControlAllowed=!!s.companion&&(s.trust>=50||s.faith>=50);}
  makeFamily(id){const n=(this.state.characters||[]).find(x=>x.id===id);if(!n)return false;const s=this.ensureRelation(n);if(!(s.companion&&s.friendship>=75&&s.trust>=65))throw new Error('家族になるには高い友好度と信頼度が必要です');s.family=true;s.familyEligible=true;this.onStatus(`🏠 ${n.name} が家族になりました`,'command');return true}
  directControl(id){const n=(this.state.characters||[]).find(x=>x.id===id);if(!n?.directControlAllowed)throw new Error('仲間になった村人だけ直接操作できます');this.state.avatar.controlledNpcId=id;this.state.avatar._playerRestore=this.state.avatar._playerRestore||clone({name:this.state.avatar.name,position:this.state.avatar.position,yaw:this.state.avatar.yaw,appearance:this.state.avatar.appearance});this.state.avatar.name=n.name;this.state.avatar.position=[...n.position];this.state.avatar.yaw=n.yaw||0;this.state.avatar.appearance={...(this.state.avatar.appearance||{}),skin:n.skin,body:n.body,hair:n.hair};n.controlled=true;this.onStatus(`🎮 ${n.name} を直接操作`,'command');return n}
  releaseControl(){const id=this.state.avatar?.controlledNpcId;if(!id)return false;const n=(this.state.characters||[]).find(x=>x.id===id);if(n){n.position=[...(this.state.avatar.position||n.position)];n.yaw=this.state.avatar.yaw||n.yaw;n.controlled=false}const r=this.state.avatar._playerRestore;if(r){Object.assign(this.state.avatar,clone(r));delete this.state.avatar._playerRestore}delete this.state.avatar.controlledNpcId;this.onStatus('🎮 プレイヤー操作へ戻りました','command');return true}
  command(id,command,target=null){const n=(this.state.characters||[]).find(x=>x.id===id);if(!n?.rtsControlAllowed)throw new Error('RTS命令には信頼度または信仰度50以上が必要です');n.task={command,target,issuedAt:Date.now()};this.onStatus(`🖱 ${n.name}: ${command}`,'command');return n.task}
}
