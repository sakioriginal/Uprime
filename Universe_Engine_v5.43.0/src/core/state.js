import {EntityRegistry} from "./entity-system.js";

export class AppState {
  constructor(){
    this.objects=[];
    this.groups=[];
    this.assemblyConstraints=[];
    this.referenceMates=[];
    this.selectedIds=[];
    this.primaryId=null;
    this.clipboard=[];
    this.nextId=1;
    this.nextObjectCode=parseInt("16AZ",36);
    this.commandAliases={m:"MOVE",r:"ROTATE",s:"SCALE",mc:"MIRRORCOPY",ex:"EXTRUDE",dim:"DIMENSION",tr:"TRIM",off:"OFFSET",sel:"SELECT",u:"UNION",sub:"DIFFERENCE",ix:"INTERSECTION",ma:"MOTIONAXIS",sock:"SOCKET",ac:"ASSEMBLY"};
    this.coordinateMode="relative";
    this.transformSnapshot=null;
    this.selectionMode="body";
    this.selectionScope="part";
    this.specialSelection=null;
    this.subSelections=[];
    this.sketchMode=false;
    this.sketches=[];
    this.datumVisibility={origin:true,xAxis:true,yAxis:true,zAxis:true,xyPlane:false,xzPlane:false,yzPlane:false};
    this.selectedDatumId=null;
    this.motionBindings=[];
    this.motionClock={running:false,simTime:0,speed:1,useRealTime:false,lastTick:performance.now()};
    this.spreadsheet={name:"Sheet1",rows:20,cols:10,cells:{}};
    this.workspace={preset:"studio",unitScaleMm:10,designScale:"1:1"};
    this.workspaceItems=[];
    this.inventory={items:[]};
    this.workbenches=[];
    this.controls={leftStick:true,rightStick:true,mouseLook:"drag",lookSensitivity:.16,movementReference:"avatar",mobileHud:true,mobileActions:[{label:'JUMP',action:'jump'},{label:'USE',action:'interact'},{label:'INV',action:'inventory'},{label:'VIEW',action:'view'}]};
    this.characters=[];
    this.infiniteScale={enabled:true,level:"mm",metersPerUnit:1e-3,visualScale:1,floatingOrigin:[0,0,0],worldOffset:[0,0,0],portalStack:[],context:"workspace"};
    this.seamless={mode:"workspace",workbenchActive:false,lastWorld:"workspace"};
    this.physics={enabled:false,gravity:[0,0,-9.80665],timeScale:1,floorZ:0,autoSleep:true};
    this.avatar={enabled:true,mode:"tpv",height:170,position:[-220,-180,0],yaw:0,name:"Player",controlEnabled:true,locomotion:{walkStepMm:500,runStepMm:850}};
    this.planet={enabled:true,radiusMm:1000000,terrainAmplitudeMm:10000,waterLevelMm:0,waterRadiusMm:998000,waterRenderOffsetMm:-2000,waveAmplitudeMm:220,waveSpeed:.55,spawnElevationMm:1000,seed:7,subdivisions:5,water:true,atmosphere:true,celestialBodies:true,landFractionTarget:.30,celestialLabelsVisible:true,celestialCatalog:{},continents:true,mountains:true,biomes:true,vegetation:true,vegetationDensity:180,rivers:true,riverCount:7};
    this.spacecraft={crafts:[],activeId:null,nextId:1};
    this.multiplayer={playMode:'coop',team:'A',friendlyFire:false,gameplay:{hp:100,maxHp:100,dead:false,attackDamage:25,attackRangeMm:1800,attackConeDeg:70,respawnDelayMs:2500,deaths:0,kos:0}};
    this.vr={enabled:false,locomotion:'stick',snapTurnDeg:30};
    this.creator={enabled:false,scaleMm:1,focusMarker:true,gridOpacity:.14,gridVisible:true,panelVisible:true,createOrigin:"view",anchorToWorkbench:true};
    this.buildingAssist={mode:"snap",columnSpacing:3000,columnCount:4,axis:"X",wallThickness:120,floorThickness:150,roofThickness:120,roofPitch:20};
    this.marketplace={currentUserId:"PLAYER",platformContributionRate:1,platformFund:0,adRevenuePool:0,adDistributionRate:30,ratingReward:1,markets:[],listings:[],purchases:[],ratings:[],ledger:[],wallets:{PLAYER:{balance:1000,earned:0,spent:0}}};
    this.entityRegistry=new EntityRegistry(this);
  }

  uid(){return `part-${this.nextId++}`}

  publicId(){
    let code;
    do{ code=(this.nextObjectCode++).toString(36).toUpperCase().padStart(4,"0"); }
    while(this.objects.some(o=>o.objectId===code));
    return code;
  }

  objectByPublicId(code){
    const key=String(code||"").trim().toUpperCase();
    return this.entityRegistry?.byObjectId?.get(key)||this.objects.find(o=>String(o.objectId||"").toUpperCase()===key)||null;
  }

  selectedObjects(){
    const ids=new Set(this.selectedIds);
    for(const g of this.groups){
      if(g.memberIds.some(id=>ids.has(id)))g.memberIds.forEach(id=>ids.add(id));
    }
    return this.objects.filter(o=>ids.has(o.id));
  }

  object(id){return this.objects.find(o=>o.id===id)||null}
  primary(){return this.object(this.primaryId)}

  clearSubSelection(){
    this.subSelections=[];
    this.sketchMode=false;
  }

  selectedSubElements(){
    return [...this.subSelections];
  }
}
