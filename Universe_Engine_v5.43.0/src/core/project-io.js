const RUNTIME_KEYS=new Set(["mesh","edge","datumGroup","material","geometry","parent","children","quaternion","matrix","matrixWorld","modelViewMatrix","normalMatrix"]);

function clean(value,seen=new WeakSet()){
  if(value==null||typeof value==="string"||typeof value==="number"||typeof value==="boolean")return value;
  if(typeof value==="function"||typeof value==="symbol")return undefined;
  if(Array.isArray(value))return value.map(v=>clean(v,seen)).filter(v=>v!==undefined);
  if(typeof value!=="object")return undefined;
  if(seen.has(value))return undefined;
  seen.add(value);
  const out={};
  for(const [key,val] of Object.entries(value)){
    if(RUNTIME_KEYS.has(key)||key.startsWith("_three"))continue;
    const c=clean(val,seen);if(c!==undefined)out[key]=c;
  }
  seen.delete(value);return out;
}

export function serializeProject(state){
  return {
    format:"UECAD",
    version:"5.30.0",
    savedAt:new Date().toISOString(),
    counters:{nextId:state.nextId,nextObjectCode:state.nextObjectCode},
    entitySchemaVersion:1,
    objects:clean(state.objects)||[],
    groups:clean(state.groups)||[],
    assemblyConstraints:clean(state.assemblyConstraints)||[],
    referenceMates:clean(state.referenceMates)||[],
    sketches:clean(state.sketches)||[],
    spreadsheet:clean(state.spreadsheet)||{name:"Sheet1",rows:20,cols:10,cells:{}},
    motionBindings:clean(state.motionBindings)||[],
    commandAliases:clean(state.commandAliases)||{},
    workspace:clean(state.workspace)||{preset:"studio"},
    workspaceItems:clean(state.workspaceItems)||[],
    inventory:clean(state.inventory)||{items:[]},
    workbenches:clean(state.workbenches)||[],
    controls:clean(state.controls)||{},
    characters:clean(state.characters)||[],
    avatar:clean(state.avatar)||{enabled:true,mode:"orbit",height:170,position:[-220,-180,0],yaw:0},
    physics:clean(state.physics)||{enabled:false,gravity:[0,0,-9.80665]},
    planet:clean(state.planet)||{enabled:false,radius:650,terrainAmplitude:42,seed:7},
    infiniteScale:clean(state.infiniteScale)||{enabled:true,level:"mm",metersPerUnit:1e-3,visualScale:1,floatingOrigin:[0,0,0],worldOffset:[0,0,0]},
    creator:clean(state.creator)||{enabled:false,scaleMm:1,focusMarker:true,gridOpacity:.18,gridVisible:true},
    seamless:clean(state.seamless)||{mode:"workspace",workbenchActive:false,lastWorld:"workspace"},
    mechanical:clean(state.mechanical)||{running:false,time:0,links:[],motors:[]},
    manufacturing:clean(state.manufacturing)||{materialLibrary:[],blueprints:[],recipes:[]},
    buildingAssist:clean(state.buildingAssist)||{mode:"snap",columnSpacing:3000,columnCount:4,axis:"X"},
    spacecraft:clean(state.spacecraft)||{crafts:[],activeId:null,nextId:1},
    survival:clean(state.survival)||{resourceNodes:[]},
    multiplayer:clean(state.multiplayer)||{playMode:"coop",team:"A",friendlyFire:false},
    vr:clean(state.vr)||{enabled:false,locomotion:"stick",snapTurnDeg:30},
    marketplace:clean(state.marketplace)||{currentUserId:"PLAYER",platformContributionRate:1,platformFund:0,adRevenuePool:0,markets:[],listings:[],purchases:[],ratings:[],ledger:[],wallets:{}},
    shops:clean(state.shops)||[],
    villages:clean(state.villages)||[],
    lifeSim:clean(state.lifeSim)||{},
    civilization:clean(state.civilization)||{},
    gameMode:state.gameMode||"survival",
    settings:{coordinateMode:state.coordinateMode,datumVisibility:clean(state.datumVisibility)||{}}
  };
}

export function downloadProject(state,filename="UniverseEngine_Project.uecad"){
  const blob=new Blob([JSON.stringify(serializeProject(state),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export async function readProjectFile(file){
  const text=await file.text();const data=JSON.parse(text);
  if(!data||data.format!=="UECAD"||!Array.isArray(data.objects))throw new Error("UECADプロジェクトとして読み込めません");
  return data;
}
