import * as THREE from "three";

import {AppState} from "./core/state.js";
import {SceneController} from "./core/scene.js";
import {SelectionController} from "./core/selection.js";
import {GeometrySelectionController} from "./core/selection-core.js";
import {TransformController} from "./core/transform.js";
import {FeatureTreeController} from "./core/feature-tree.js";
import {EdgeFeatureVisualizer} from "./cad/edge-features.js";
import {SketchController} from "./cad/sketch-controller.js";
import {SketchModel} from "./cad/sketch-model.js";
import {SketchConstraintEngine} from "./cad/sketch-constraints.js";
import {buildSketchProfiles} from "./cad/sketch-profiles.js";
import {BooleanCore,BooleanVisualizer} from "./cad/boolean-core.js";
import {BRepCore} from "./cad/brep-core.js";
import {FaceKernel,FaceKernelVisualizer} from "./cad/face-kernel.js";
import {EdgeKernel,EdgeKernelVisualizer} from "./cad/edge-kernel.js";
import {ParametricRebuildEngine} from "./core/rebuild-engine.js";
import {defaults} from "./cad/geometry.js";
import {renderTree} from "./ui/tree.js";
import {renderProperties,renderSpecialProperties} from "./ui/properties.js";
import {copy,paste,serializable} from "./core/clipboard.js";
import {createGroup,ungroup} from "./core/groups.js";
import {downloadProject,readProjectFile,serializeProject} from "./core/project-io.js";
import {WorkspaceManager} from "./workspace/workspace-manager.js";
import {PhysicsManager} from "./workspace/physics-manager.js";
import {SpatialPanelManager} from "./workspace/spatial-panels.js";
import {GeneratorWorkbench} from "./workspace/generator.js";
import {AvatarManager} from "./workspace/avatar-manager.js";
import {PlacementManager} from "./workspace/placement-manager.js";
import {NPCManager} from "./workspace/npc-manager.js";
import {PlanetManager} from "./workspace/planet-manager.js";
import {ensureComponents,setComponent,classifyEntity} from "./core/component-system.js";
import {ensureMotionAxes,addMotionAxis,removeMotionAxis,applyMotionAxis,resetMotionBase} from "./core/motion-axis.js";
import {ensureSockets,addSocket,removeSocket} from "./core/sockets.js";
import {ensureAssemblyState,addAssemblyConstraint,applyAssemblyConstraint,applyAllAssemblyConstraints} from "./core/assembly.js";
import {createPrototypeInstance,syncPrototypeInstances} from "./core/prototypes.js";
import {ensureEntity,syncEntityKind} from "./core/entity-system.js";
import {InfiniteScaleCore} from "./core/infinite-scale-core.js";
import {SeamlessWorldController} from "./workspace/seamless-world-controller.js";
import {LivingCharacterCore} from "./character/living-character-core.js";
import {MechanicalSolver,ensureMechanical} from "./core/mechanical-solver.js";
import {ManufacturingCore,ensureManufacturingState,ensureManufacturingPart} from "./core/manufacturing-core.js";
import {FactoryManager} from "./factory/factory-manager.js";
import {CamCore} from "./cam/cam-core.js";
import {PortableWorkbenchManager} from "./workspace/portable-workbench.js";
import {MobileControls} from "./workspace/mobile-controls.js";
import {MobileGameUI} from "./workspace/mobile-game-ui.js";
import {VRManager} from "./workspace/vr-manager.js";
import {BuildingPrimitiveManager} from "./workspace/building-primitives.js";
import {BuildingAccessManager} from "./workspace/building-access.js";
import {CreatorModeController} from "./workspace/creator-mode.js";
import {BuildingAssistManager} from "./workspace/building-assist.js";
import {LiveBuildingPlacementController} from "./workspace/live-building-placement.js";
import {RecipeBlueprintManager} from "./core/recipe-blueprint.js";
import {HandEquipmentManager} from "./workspace/hand-equipment.js";
import {ItemCraftingManager} from "./workspace/item-crafting-manager.js";
import {SurvivalResourceManager} from "./workspace/survival-resource-manager.js";
import {PartPlacementAssist} from "./workspace/part-placement-assist.js";
import {SnapAssist} from "./workspace/snap-assist.js";
import {ReferenceMateController} from "./workspace/reference-mate.js";
import {SpacecraftPartsManager} from "./workspace/spacecraft-parts.js";
import {SpacecraftFlightManager} from "./workspace/spacecraft-flight.js";
import {MarketplaceManager} from "./core/marketplace.js";
import {MultiplayerManager} from "./network/multiplayer-manager.js";
import {NetworkGameplayManager} from "./network/gameplay-manager.js";
import {ProjectileManager} from "./workspace/projectile-manager.js";
import {ShopManager} from "./workspace/shop-manager.js";
import {VillageManager} from "./workspace/village-manager.js";
import {LivingSocietyManager} from "./workspace/living-society-manager.js";
import QRCode from "./vendor/qrcode/index.js";

const missingUiSelectors=new Set();
const $=selector=>{
  const element=document.querySelector(selector);
  if(element)return element;
  if(!missingUiSelectors.has(selector)){
    missingUiSelectors.add(selector);
    console.warn(`[UI compatibility] 要素 ${selector} が見つかりません。index.html と app.js のキャッシュ不一致の可能性があります。`);
  }
  if(selector==="#canvas")throw new Error("#canvas が見つかりません。index.html を v3.2.4 のものへ更新してください。");
  const fallback=document.createElement("div");
  fallback.dataset.missingSelector=selector;
  return fallback;
};
const $$=selector=>[...document.querySelectorAll(selector)];

const state=new AppState();
const scene=new SceneController($("#canvas"));
const workspaceManager=new WorkspaceManager(state,scene);
let physicsManager=null,spatialPanels=null,generatorWorkbench=null,avatarManager=null,placementManager=null,npcManager=null,planetManager=null,projectileManager=null;
let infiniteScaleCore=null,seamlessWorld=null,livingCharacterCore=null,mechanicalSolver=null,manufacturingCore=null,factoryManager=null,camCore=null,portableWorkbench=null,mobileControls=null,buildingPrimitives=null,buildingAccess=null,creatorMode=null,buildingAssist=null,liveBuildingPlacement=null,recipeBlueprint=null,handEquipment=null,itemCrafting=null,survivalResources=null,partPlacementAssist=null,spacecraftParts=null,spacecraftFlight=null,marketplace=null,shopManager=null,villageManager=null,livingSociety=null,multiplayer=null,networkGameplay=null,mobileGameUI=null,vrManager=null;
for(const [id,visible] of Object.entries(state.datumVisibility))scene.setDatumVisibility(id,visible);
const commandEntries=[];
function appendCommandHistory(text,type="info"){
  if(!text)return;commandEntries.push({text:String(text),type,time:new Date().toLocaleTimeString("ja-JP",{hour12:false})});if(commandEntries.length>120)commandEntries.shift();
  const root=$("#commandHistory");if(root?.dataset?.missingSelector)return;root.innerHTML=commandEntries.map(e=>`<div class="commandEntry ${e.type}"><span>${e.time}</span> ${escapeHtml(e.text)}</div>`).join("");root.scrollTop=root.scrollHeight;
}
function escapeHtml(v){return String(v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
const status=(text,type="info")=>{$("#status").textContent=text;appendCommandHistory(text,type)};

let geometrySelection;

const refresh=()=>{
  if(!state||!scene)return;
  renderTree($("#tree"),state,{
    select:(id,additive)=>{
      state.specialSelection=null;
      state.selectedDatumId=null;scene.selectDatum(null);
      if(state.selectionScope==='group'){const g=state.groups.find(g=>g.memberIds.includes(id));if(g){state.selectedIds=[...g.memberIds];state.primaryId=g.memberIds.at(-1)||null;selection.paint();}else selection.select(id,additive);}else selection.select(id,additive);
      geometrySelection.clear();
    },
    selectSpecial:id=>{state.specialSelection=id;state.selectedIds=[];state.primaryId=null;state.selectedDatumId=null;geometrySelection.clear();scene.selectDatum(null);refresh();},
    toggle:object=>{
      object.visible=object.visible===false;
      scene.sync(object);
      refresh();
    },
    selectDatum:id=>{
      state.selectedDatumId=id;state.selectedIds=[];state.primaryId=null;geometrySelection.clear();scene.selectDatum(id);
      status(`基準要素を選択: ${id}`);refresh();
    },
    toggleDatum:id=>{
      state.datumVisibility[id]=state.datumVisibility[id]===false;scene.setDatumVisibility(id,state.datumVisibility[id]);
      status(`${id}を${state.datumVisibility[id]?'表示':'非表示'}にしました`);refresh();
    },
    selectPartDatum:(part,datum)=>{for(const d of part.datums||[])d.selected=d===datum;scene.rebuildPartDatums(part);status(`部品基準を選択: ${datum.name}`);refresh();},
    togglePartDatum:(part,datum)=>{datum.visible=datum.visible===false;scene.rebuildPartDatums(part);status(`${datum.name}を${datum.visible?"表示":"非表示"}`);refresh();},
    selectMotionAxis:(part,axis)=>{state.selectedIds=[part.id];state.primaryId=part.id;selection.paint();refreshMotionAxisDialog(axis.id);$("#motionAxisDialog").classList.add("show");},
    selectSocket:(part,socket)=>{state.selectedIds=[part.id];state.primaryId=part.id;selection.paint();refreshSocketDialog(socket.id);$("#socketDialog").classList.add("show");},
    editSurfaceArt:part=>{state.specialSelection=null;state.selectedIds=[part.id];state.primaryId=part.id;selection.paint();openSurfaceArtEditor(part);refresh();},
    openNpc:id=>{openNpcTalkDialog(id);},
    editSketch:sketch=>{sketchController.enterEditMode(sketch);status(`${sketch.name}を編集開始: ${sketch.plane}平面`);refresh();},
    selectGroup:group=>{
      state.selectedIds=[...group.memberIds];
      state.primaryId=group.memberIds.at(-1)||null;
      selection.paint();
      geometrySelection.clear();
      refresh();
    }
  });

  const summary=geometrySelection?.summary?.()||{
    mode:state.selectionMode,
    count:0
  };

  if(!renderSpecialProperties($("#properties"),state,state.specialSelection))renderProperties(
    $("#properties"),
    state,
    {
      ...scene,
      rebuild(object){
        scene.rebuild(object);
        geometrySelection.invalidate(object);
        geometrySelection.clear();
      },
      sync(object){
        scene.sync(object);
        geometrySelection.rebuildOverlays();
      }
    },
    refresh,
    summary
  );

  $("#selectionHud").textContent=state.selectedIds.length
    ? `ボディ ${state.selectedIds.length}`
    : "選択なし";

  const modeLabels={
    body:"Body",
    face:"Face",
    edge:"Edge",
    vertex:"Vertex"
  };

  $("#subSelectionHud").textContent=
    `${modeLabels[state.selectionMode]} ${summary.count||0}`;

  $$('.selectionScope').forEach(button=>button.onclick=()=>{state.selectionScope=button.dataset.scope||'part';$$('.selectionScope').forEach(b=>b.classList.toggle('active',b===button));status(state.selectionScope==='group'?'グループ選択':'部品選択','command')});

$$(".selectionMode").forEach(button=>{
    button.classList.toggle(
      "active",
      button.dataset.mode===state.selectionMode
    );
  });

  const sketchActive=!!(state.sketchMode&&sketchController?.activeSketch);
  $("#sketchToolbar").classList.toggle("show",sketchActive);
  $("#sketchHud").classList.toggle("show",sketchActive);
  if(sketchActive){
    const labels={select:"SELECT",point:"P (POINT)",line:"L (LINE)",rectangle:"REC (RECTANGLE)",circle:"C (CIRCLE)",arc:"ARC",spline:"SPL (SPLINE)",freehand:"FH (FREEHAND)"};
    $("#activeSketchToolName").textContent=labels[sketchController.activeTool]||String(sketchController.activeTool||"SELECT").toUpperCase();
  }
};

let sketchController=null;
let sketchConstraints=null;
let selectedProfileId=null;
let booleanVisualizer=null;
let booleanCore=null;
let brepCore=null;
let faceKernel=null;
let faceKernelVisualizer=null;
let edgeKernel=null;
let edgeKernelVisualizer=null;
let rebuildEngine=null;
let pendingEdgeFeatureType="Fillet";
let defaultChamferRule={enabled:false,size:.2};

const selection=new SelectionController(state,scene,refresh);
geometrySelection=new GeometrySelectionController(state,scene,refresh);
const transform=new TransformController(state,scene);
const edgeVisualizer=new EdgeFeatureVisualizer(scene);
const featureTree=new FeatureTreeController(state,scene,refresh,edgeVisualizer);
sketchController=new SketchController(state,scene,refresh);
sketchConstraints=new SketchConstraintEngine(sketchController);
booleanVisualizer=new BooleanVisualizer(scene);
booleanCore=new BooleanCore(
  state,
  scene,
  featureTree,
  booleanVisualizer,
  refresh
);
brepCore=new BRepCore();
faceKernelVisualizer=new FaceKernelVisualizer(scene);
faceKernel=new FaceKernel(
  state,
  scene,
  brepCore,
  featureTree,
  refresh
);
edgeKernelVisualizer=new EdgeKernelVisualizer(scene);
edgeKernel=new EdgeKernel(
  state,
  scene,
  brepCore,
  featureTree,
  edgeVisualizer,
  refresh
);
rebuildEngine=new ParametricRebuildEngine(
  state,
  scene,
  brepCore,
  geometrySelection,
  edgeVisualizer,
  booleanVisualizer,
  refresh
);
setTimeout(()=>rebuildEngine.snapshot("Initial"),0);

function defaultPartDatums(partId){
  const base=id=>`${partId}:datum:${id}`;
  return [
    {id:base("origin"),type:"point",name:"原点",orientation:"",position:[0,0,0],visible:false,system:true,reference:{kind:"localOrigin"}},
    {id:base("xAxis"),type:"axis",name:"X基準軸",orientation:"X",position:[0,0,0],visible:false,system:true,reference:{kind:"primaryAxis",axis:"X"}},
    {id:base("yAxis"),type:"axis",name:"Y基準軸",orientation:"Y",position:[0,0,0],visible:false,system:true,reference:{kind:"primaryAxis",axis:"Y"}},
    {id:base("zAxis"),type:"axis",name:"Z基準軸",orientation:"Z",position:[0,0,0],visible:false,system:true,reference:{kind:"primaryAxis",axis:"Z"}},
    {id:base("xyPlane"),type:"plane",name:"XY基準面",orientation:"XY",position:[0,0,0],visible:false,system:true,reference:{kind:"primaryPlane",plane:"XY"}},
    {id:base("xzPlane"),type:"plane",name:"XZ基準面",orientation:"XZ",position:[0,0,0],visible:false,system:true,reference:{kind:"primaryPlane",plane:"XZ"}},
    {id:base("yzPlane"),type:"plane",name:"YZ基準面",orientation:"YZ",position:[0,0,0],visible:false,system:true,reference:{kind:"primaryPlane",plane:"YZ"}}
  ];
}
function ensurePartDatums(part){
  const existing=Array.isArray(part.datums)?part.datums:[];
  const byKey=new Map(existing.map(d=>[d.id?.split(':').at(-1),d]));
  const primary=defaultPartDatums(part.id).map(d=>byKey.get(d.id.split(':').at(-1))||d);
  const secondary=existing.filter(d=>!d.system&&!['origin','xAxis','yAxis','zAxis','xyPlane','xzPlane','yzPlane'].includes(d.id?.split(':').at(-1)));
  part.datums=[...primary,...secondary];
  return part.datums;
}
function partReferenceOptions(part){
  ensureComponents(part);part.entityKind=classifyEntity(part);
  ensurePartDatums(part);
  ensureMotionAxes(part);ensureSockets(part);
  const options=[];
  for(const d of part.datums)options.push({value:`datum:${d.id}`,label:`基準: ${d.name}`});
  options.push(
    {value:'face:X-',label:'外形面: X最小'},{value:'face:X+',label:'外形面: X最大'},
    {value:'face:Y-',label:'外形面: Y最小'},{value:'face:Y+',label:'外形面: Y最大'},
    {value:'face:Z-',label:'外形面: Z最小'},{value:'face:Z+',label:'外形面: Z最大'},
    {value:'mid:X',label:'中間面: X方向'},{value:'mid:Y',label:'中間面: Y方向'},{value:'mid:Z',label:'中間面: Z方向'}
  );
  const holes=(part.features||[]).filter(f=>/hole/i.test(f.type||f.name||''));
  holes.forEach((h,i)=>options.push({value:`hole:${h.id||i}`,label:`穴中心: ${h.name||`Hole ${i+1}`}`}));
  return options;
}
function addPart(type,data={},shouldSelect=true){
  const implicitCreatorPosition=(data.position==null&&state.creator?.enabled&&creatorMode)?creatorMode.creationPositionCad?.():null;
  if(implicitCreatorPosition&&state.creator)state.creator.lastCreatePosition=[...implicitCreatorPosition];
  const part={
    id:data.id||state.uid(),
    objectId:data.objectId||state.publicId(),
    type,
    bodyKind:data.bodyKind||"solid",
    name:data.name||({
      box:"Block",
      cylinder:"Cylinder",
      sphere:"Sphere",
      extrusion:"Extrusion",
      revolution:"Revolution"
    }[type]||"Part"),
    params:structuredClone(data.params||defaults(type)),
    position:[...(data.position||implicitCreatorPosition||[0,0,0])],
    rotation:[...(data.rotation||[0,0,0])],
    scale:[...(data.scale||[1,1,1])],
    visible:data.visible!==false,
    opacity:Number(data.opacity??1),
    color:data.color||0x88a9bf,
    groupId:data.groupId||null,
    groupCode:data.groupCode||null,
    features:structuredClone(data.features||null),
    rollbackIndex:data.rollbackIndex??0,
    baseState:data.baseState?structuredClone(data.baseState):null,
    metadata:structuredClone(data.metadata||{}),
    datums:structuredClone(data.datums||[]),
    geometryConstraints:structuredClone(data.geometryConstraints||[]),
    physics:structuredClone(data.physics||{enabled:false,bodyType:"static",mass:1,velocity:[0,0,0],restitution:.08,friction:.6,sleeping:false}),
    components:structuredClone(data.components||{}),
    motionAxes:structuredClone(data.motionAxes||[]),
    sockets:structuredClone(data.sockets||[]),
    motionBase:data.motionBase?structuredClone(data.motionBase):null,
    entityKind:data.entityKind||"object"
  };

  ensurePartDatums(part);
  ensureMotionAxes(part);ensureSockets(part);
  ensureEntity(part);syncEntityKind(part,part.entityKind);
  state.objects.push(part);state.entityRegistry?.register?.(part);
  scene.makeMesh(part);
  featureTree.ensure(part);
  if(!part.baseState){
    part.baseState={
      position:[...part.position],
      rotation:[...part.rotation],
      scale:[...part.scale],
      params:structuredClone(part.params)
    };
  }
  part.rollbackIndex=part.features.length-1;
  geometrySelection?.invalidate?.(part);
  brepCore?.build?.(part);

  if(shouldSelect)selection.select(part.id);
  else refresh();

  return part;
}

physicsManager=new PhysicsManager(state,scene,(doRefresh=true)=>{if(doRefresh)refresh()});
spatialPanels=new SpatialPanelManager(state,scene,$("#viewport"),()=>{});
generatorWorkbench=new GeneratorWorkbench(state,addPart);
avatarManager=new AvatarManager(state,scene);
planetManager=new PlanetManager(state,scene,workspaceManager);avatarManager.setPlanetManager(planetManager);handEquipment=new HandEquipmentManager(state,scene,avatarManager);
placementManager=new PlacementManager(state,scene,$("#canvas"),doRefresh=>{if(doRefresh)status("配置を確定","command");refresh()});
npcManager=new NPCManager(state,scene);
infiniteScaleCore=new InfiniteScaleCore(state,scene);
seamlessWorld=new SeamlessWorldController(state,scene,workspaceManager,planetManager,avatarManager,infiniteScaleCore);
infiniteScaleCore.applyToScene();
livingCharacterCore=new LivingCharacterCore(state);
mechanicalSolver=new MechanicalSolver(state,scene);
manufacturingCore=new ManufacturingCore(state);
factoryManager=new FactoryManager(state);
camCore=new CamCore(state);
portableWorkbench=new PortableWorkbenchManager(state,scene,workspaceManager,avatarManager,planetManager);
buildingPrimitives=new BuildingPrimitiveManager(state,addPart);
buildingAccess=new BuildingAccessManager(state,addPart,scene);
spacecraftParts=new SpacecraftPartsManager(state,addPart);
spacecraftFlight=new SpacecraftFlightManager(state,scene,spacecraftParts,()=>updateSpacecraftStatus?.());
buildingAssist=new BuildingAssistManager(state,addPart,(object)=>{scene.remove(object);state.objects=state.objects.filter(o=>o.id!==object.id);});
liveBuildingPlacement=new LiveBuildingPlacementController(state,scene,$("#canvas"),addPart,(object)=>{scene.remove(object);state.objects=state.objects.filter(o=>o.id!==object.id);},(event,payload)=>{if(event==="commit"){refresh();status(`建築配置確定: ${payload.name}`,"command")}else if(event==="group-commit"){const r=buildingAssist?.normalizeGroupFoundations?.(payload.items);for(const o of payload.items||[])scene.sync(o);refresh();status(`${payload.label||"建築"} 配置確定 / 地表基礎補正 ${r?.foundations?.length||0}基`,"command")}else if(event==="group-start")status(`${payload.label||"建築"} ゴースト配置: 照準/カーソルで移動 → クリック確定 / ESC取消`,"command");else if(event==="blocked")status("同じ位置に同種部材があります","error");else if(event==="first-point")status("始点を確定。終点をクリックしてください","command");});
recipeBlueprint=new RecipeBlueprintManager(state,addPart);
itemCrafting=new ItemCraftingManager({state,scene,addPart,handEquipment,workbench:portableWorkbench,avatar:avatarManager,onStatus:(t,type)=>status(t,type)});
survivalResources=new SurvivalResourceManager({state,scene,planet:planetManager,avatar:avatarManager,itemCrafting,onStatus:(t,type)=>status(t,type)});
marketplace=new MarketplaceManager(state,addPart,recipeBlueprint);
mobileControls=new MobileControls(state,avatarManager,scene,document);mobileControls.setSpacecraftFlight?.(spacecraftFlight);
mobileGameUI=new MobileGameUI(state,{root:document,onStatus:(t,type)=>status(t,type),itemCrafting,resourceManager:survivalResources});vrManager=new VRManager(state,scene,{onStatus:(t,type)=>status(t,type)});
creatorMode=new CreatorModeController(state,scene,infiniteScaleCore,$("#viewport"),{onChange:()=>updateScaleHud?.(),workbench:portableWorkbench,planet:planetManager,avatar:avatarManager});
buildingPrimitives.getPlacementOrigin=()=>creatorMode?.creationPositionCad?.()||null;buildingAssist.groundResolver=(p)=>planetManager?.groundCadPoint?.(scene,p)||p;
shopManager=new ShopManager({state,scene,addPart,npcManager,itemCrafting,marketplace,groundResolver:(p)=>planetManager?.groundCadPoint?.(scene,p)||p,onStatus:(t,type)=>status(t,type)});
villageManager=new VillageManager({state,addPart,npcManager,shopManager,groundResolver:(p)=>planetManager?.groundCadPoint?.(scene,p)||p,onStatus:(t,type)=>status(t,type)});livingSociety=new LivingSocietyManager({state,scene,npcManager,villageManager,resourceManager:survivalResources,groundResolver:(p)=>planetManager?.groundCadPoint?.(scene,p)||p,onStatus:(t,type)=>status(t,type)});
installShopUi();
if(!villageManager.list().length){const a=state.avatar?.position||[0,0,0];villageManager.createVillage({name:'はじまりの村',position:[Number(a[0]||0)+9000,Number(a[1]||0)+5000,Number(a[2]||0)],population:9});}
else if(!shopManager.list().length){const v=villageManager.list()[0];shopManager.ensureStarterShop([v.position[0]+6500,v.position[1],v.position[2]]);}
// Village creation can happen after manager construction.  Perform one authoritative
// late surface pass now, then sync every village part before the first rendered frame.
villageManager?.repairAllSurfaceAnchors?.();for(const o of state.objects||[])if(o?.metadata?.villageBuilding)scene.sync?.(o);livingSociety?.seedAll?.();livingSociety?.rebuildInfrastructure?.();npcManager?.rebuild?.();
partPlacementAssist=new PartPlacementAssist(state,scene,$("#canvas"),addPart,(object)=>{scene.remove(object);state.objects=state.objects.filter(o=>o.id!==object.id);refresh();},(event,payload)=>{if(event==='commit'){refresh();status(`配置確定: ${payload.name}`,'command')}else if(event==='begin')status('ゴーストを配置位置へ移動しクリックで確定 / ESCで取消','command')});
window.__UE_AVATAR_GROUP__=avatarManager?.group||null;
const snapAssist=new SnapAssist(state,scene,$("#canvas"),$("#smartSnapMarker"));
const referenceMate=new ReferenceMateController(state,scene,$("#canvas"),snapAssist,{source:$("#referenceMateSourceMarker"),target:$("#referenceMateTargetMarker")});


function installShopUi(){
  if(document.getElementById('ueShopButton'))return;
  const style=document.createElement('style');style.textContent=`
  #ueShopButton{position:fixed;right:18px;bottom:156px;z-index:75;border:1px solid #3b6680;background:#102431;color:#e7f7ff;border-radius:14px;padding:10px 14px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px #0007}
  #ueShopDialog{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:180;background:#061018aa;backdrop-filter:blur(4px)}#ueShopDialog.show{display:flex}
  .ueShopCard{width:min(760px,94vw);max-height:84vh;overflow:auto;background:#10202b;color:#e9f6ff;border:1px solid #48748c;border-radius:18px;padding:16px;box-shadow:0 20px 70px #000a}.ueShopHead{display:flex;gap:10px;align-items:center;justify-content:space-between}.ueShopHead h2{margin:0;font-size:20px}.ueShopWallet{opacity:.9}.ueShopGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:10px;margin-top:12px}.ueShopItem{border:1px solid #315367;border-radius:12px;padding:10px;background:#0b1821}.ueShopItem b{font-size:15px}.ueShopMeta{font-size:12px;opacity:.75;margin:5px 0 9px}.ueShopItem button,.ueShopActions button{border:1px solid #4d7d96;background:#163548;color:#eefaff;border-radius:9px;padding:7px 10px;cursor:pointer}.ueShopActions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.ueShopSell{border-top:1px solid #29495a;margin-top:14px;padding-top:12px}.ueShopKeeper{font-size:13px;opacity:.85;margin-top:4px}
  `;document.head.appendChild(style);
  const btn=document.createElement('button');btn.id='ueShopButton';btn.textContent='🏪 SHOP';document.body.appendChild(btn);
  const dlg=document.createElement('div');dlg.id='ueShopDialog';dlg.innerHTML=`<div class="ueShopCard"><div class="ueShopHead"><div><h2 id="ueShopTitle">🏪 店</h2><div class="ueShopKeeper" id="ueShopKeeper"></div></div><div><span class="ueShopWallet" id="ueShopWallet"></span> <button id="ueShopClose">×</button></div></div><div class="ueShopActions"><button id="ueShopCreate">＋ 店を作る</button><button id="ueShopRestock">📦 補充</button></div><div id="ueShopGrid" class="ueShopGrid"></div><div class="ueShopSell"><b>素材を売る</b><div class="ueShopActions" id="ueShopSellActions"></div></div></div>`;document.body.appendChild(dlg);
  btn.onclick=()=>openShopDialog();dlg.querySelector('#ueShopClose').onclick=()=>dlg.classList.remove('show');dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.classList.remove('show')});
  dlg.querySelector('#ueShopCreate').onclick=()=>{const base=creatorMode?.creationPositionCad?.()||state.avatar?.position||[5000,-2500,0];shopManager?.createShop?.({name:`雑貨店 ${shopManager.list().length+1}`,position:[base[0]+2200,base[1]-1800,base[2]||0]});refresh();renderShopDialog(shopManager.list().at(-1)?.id)};
  dlg.querySelector('#ueShopRestock').onclick=()=>{const id=dlg.dataset.shopId;if(id){shopManager?.restock?.(id);renderShopDialog(id)}};
}
function openShopDialog(shopId=null){
  if(!shopManager)return;let shops=shopManager.list();if(!shops.length){const a=state.avatar?.position||[0,0,0];shopManager.ensureStarterShop([Number(a[0]||0)+6000,Number(a[1]||0)-2500,Number(a[2]||0)]);shops=shopManager.list();refresh()}
  renderShopDialog(shopId||shops[0]?.id);document.getElementById('ueShopDialog')?.classList.add('show');
}
function renderShopDialog(shopId){
  const dlg=document.getElementById('ueShopDialog');if(!dlg||!shopManager)return;const shop=shopManager.get(shopId)||shopManager.list()[0];if(!shop)return;dlg.dataset.shopId=shop.id;
  const keeper=(state.characters||[]).find(c=>c.id===shop.keeperId);dlg.querySelector('#ueShopTitle').textContent=`🏪 ${shop.name}`;dlg.querySelector('#ueShopKeeper').textContent=`${keeper?.name||'店番'}: 「いらっしゃいませ！」 / 店資金 ${Math.round(shop.cash)}pt`;dlg.querySelector('#ueShopWallet').textContent=`所持 ${Math.round(shopManager.wallet()?.balance||0)}pt`;
  dlg.querySelector('#ueShopGrid').innerHTML=(shop.stock||[]).map(x=>`<div class="ueShopItem"><div><span style="font-size:24px">${x.icon||'◆'}</span> <b>${escapeHtml(x.name)}</b></div><div class="ueShopMeta">販売 ${x.price}pt / 在庫 ${x.quantity}</div><button data-buy="${escapeHtml(x.sku)}">購入</button></div>`).join('');
  dlg.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{try{shopManager.buy(shop.id,b.dataset.buy,1);renderShopDialog(shop.id);refresh()}catch(e){status(e.message||String(e),'error')}});
  const sellable=(shop.stock||[]).filter(x=>x.kind==='resource');dlg.querySelector('#ueShopSellActions').innerHTML=sellable.map(x=>`<button data-sell="${escapeHtml(x.resource)}">${x.icon} ${escapeHtml(x.name)} +${x.buyPrice}pt</button>`).join('');dlg.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{try{shopManager.sellResource(shop.id,b.dataset.sell,1);renderShopDialog(shop.id);refresh()}catch(e){status(e.message||String(e),'error')}});
}
window.addEventListener('ue:open-shop',e=>openShopDialog(e.detail?.shopId||null));

function resetProjectState(){
  sketchController?.finishEdit?.();
  for(const object of [...state.objects])scene.remove(object);
  state.objects=[];state.entityRegistry?.rebuild?.();state.groups=[];state.assemblyConstraints=[];state.referenceMates=[];state.selectedIds=[];state.primaryId=null;state.sketches=[];state.motionBindings=[];
  state.spreadsheet={name:"Sheet1",rows:20,cols:10,cells:{}};state.workspace={preset:"studio",unitScaleMm:10,designScale:"1:1"};state.workspaceItems=[];state.inventory={items:[]};state.workbenches=[];state.controls={leftStick:true,rightStick:true,mouseLook:"drag",lookSensitivity:.16,movementReference:"avatar",mobileHud:true,mobileActions:[{label:"JUMP",action:"jump"},{label:"USE",action:"interact"},{label:"INV",action:"inventory"},{label:"VIEW",action:"view"}]};state.characters=[];state.avatar={enabled:true,mode:"tpv",height:170,position:[-220,-180,0],yaw:0,name:"Player",locomotion:{walkStepMm:500,runStepMm:850},appearance:{skin:"#c28b6d",body:"#5ea6d6",pants:"#25384d",hair:"#2b1d18",eye:"#4c7695"}};state.physics={enabled:false,gravity:[0,0,-9.80665],timeScale:1,floorZ:0,autoSleep:true};state.infiniteScale={enabled:true,level:"mm",metersPerUnit:1e-3,visualScale:1,floatingOrigin:[0,0,0],worldOffset:[0,0,0],portalStack:[],context:"workspace"};state.seamless={mode:"workspace",workbenchActive:false,lastWorld:"workspace"};state.creator={enabled:false,scaleMm:1,focusMarker:true,gridOpacity:.14,gridVisible:true,panelVisible:true,panelCollapsed:false,createOrigin:'view',anchorToWorkbench:true,partPlacementAssist:true,cameraTool:'rotate',reachMm:1200,workbenchBoundedPlacement:true,smartSnap:true,smartSnapPixels:24,smartSnapTypes:{vertex:true,edge:true,face:true,center:true,axis:true}};state.mechanical={running:false,time:0,links:[],motors:[]};state.manufacturing={materialLibrary:[],blueprints:[],recipes:[]};state.buildingAssist={mode:"snap",columnSpacing:3000,columnCount:4,axis:"X",wallThickness:120,floorThickness:150,roofThickness:120,roofPitch:20,snapGrid:250,snapRadius:450,liveSnap:true,liveTool:"off"};state.buildingAccess={doorWidth:900,doorHeight:2100,windowWidth:1200,windowHeight:1000,stairRise:2800,stairRun:4200,stairWidth:1100,ladderHeight:2800};state.planet={enabled:true,radiusMm:1000000,terrainAmplitudeMm:10000,waterLevelMm:0,waterRadiusMm:998000,waterRenderOffsetMm:-2000,waveAmplitudeMm:220,waveSpeed:.85,spawnElevationMm:1000,seed:7,subdivisions:5,water:true,atmosphere:true,celestialBodies:true,landFractionTarget:.30,celestialLabelsVisible:true,celestialCatalog:{},continents:true,mountains:true,biomes:true,vegetation:true,vegetationDensity:180,rivers:true,riverCount:7};state.spacecraft={crafts:[],activeId:null,nextId:1};state.survival={resourceNodes:[],harvestRangeMm:1800,resourceRespawnMs:120000};state.multiplayer={playMode:"coop",team:"A",friendlyFire:false,gameplay:{hp:100,maxHp:100,dead:false,attackDamage:25,attackRangeMm:1800,attackConeDeg:70,respawnDelayMs:2500,deaths:0,kos:0}};state.vr={enabled:false,locomotion:"stick",snapTurnDeg:30};state.marketplace={currentUserId:"PLAYER",platformContributionRate:1,platformFund:0,adRevenuePool:0,adDistributionRate:30,ratingReward:1,markets:[],listings:[],purchases:[],ratings:[],ledger:[],wallets:{PLAYER:{balance:1000,earned:0,spent:0}}};state.shops=[];state.villages=[];state.lifeSim={enabled:true,aging:true,dayLengthMinutes:15,secondsPerSimYear:900,deathEnabled:true,birthEnabled:false};state.civilization={};state.gameMode='survival';state.nextId=1;state.nextObjectCode=parseInt("16AZ",36);
  workspaceManager.apply("studio");infiniteScaleCore?.ensureState?.();infiniteScaleCore?.applyToScene?.();seamlessWorld?.ensureState?.();seamlessWorld?.syncVisibility?.();planetManager?.ensureState?.();planetManager?.rebuild?.();survivalResources?.ensureState?.();survivalResources?.rebuild?.();planetManager?.spawnAvatar?.(avatarManager);villageManager?.repairAllSurfaceAnchors?.();for(const o of state.objects||[])if(o?.metadata?.villageBuilding)scene.sync?.(o);avatarManager?.ensureState?.();avatarManager?.build?.();avatarManager?.setMode?.('tpv');avatarManager?.sync?.();npcManager?.rebuild?.();portableWorkbench?.ensureState?.();portableWorkbench?.rebuild?.();creatorMode?.ensureState?.();creatorMode?.apply?.();spatialPanels?.render?.();
  geometrySelection?.clear?.();scene.selectDatum(null);refresh();
}
function hydrateSketch(raw){
  const sketch=new SketchModel({id:raw.id,name:raw.name,plane:raw.plane||"XY",gridSize:raw.gridSize||10,ownerPartId:raw.ownerPartId||null});
  sketch.entities=structuredClone(raw.entities||[]);sketch.constraints=structuredClone(raw.constraints||[]);sketch.dimensions=structuredClone(raw.dimensions||[]);
  sketch.visible=raw.visible!==false;sketch.profileCount=Number(raw.profileCount||0);sketch.nextEntityId=Number(raw.nextEntityId||1);sketch.entityCounters=structuredClone(raw.entityCounters||{});sketch.ensureEntityCodes();sketch.updateProfiles();return sketch;
}
async function loadProjectData(data){
  resetProjectState();
  state.commandAliases={...state.commandAliases,...(data.commandAliases||{})};
  state.coordinateMode=data.settings?.coordinateMode||"relative";state.datumVisibility={...state.datumVisibility,...(data.settings?.datumVisibility||{})};
  state.spreadsheet=structuredClone(data.spreadsheet||{name:"Sheet1",rows:20,cols:10,cells:{}});state.motionBindings=structuredClone(data.motionBindings||[]);
  state.workspace=structuredClone(data.workspace||{preset:"studio",unitScaleMm:10,designScale:"1:1"});state.workspaceItems=structuredClone(data.workspaceItems||[]);state.inventory=structuredClone(data.inventory||{items:[]});state.workbenches=structuredClone(data.workbenches||[]);state.controls=structuredClone(data.controls||state.controls||{});state.characters=structuredClone(data.characters||[]);state.avatar=structuredClone(data.avatar||{enabled:true,mode:"orbit",height:170,position:[-220,-180,0],yaw:0});state.physics=structuredClone(data.physics||{enabled:false,gravity:[0,0,-9.80665],timeScale:1,floorZ:0,autoSleep:true});state.planet=structuredClone(data.planet||{enabled:true,radiusMm:1000000,terrainAmplitudeMm:10000,waterLevelMm:0,waterRadiusMm:998000,waterRenderOffsetMm:-2000,waveAmplitudeMm:220,waveSpeed:.85,spawnElevationMm:1000,seed:7,subdivisions:5,water:true,atmosphere:true,celestialBodies:true,landFractionTarget:.30,celestialLabelsVisible:true,celestialCatalog:{},continents:true,mountains:true,biomes:true,vegetation:true,vegetationDensity:180,rivers:true,riverCount:7});state.spacecraft=structuredClone(data.spacecraft||{crafts:[],activeId:null,nextId:1});state.survival=structuredClone(data.survival||state.survival||{resourceNodes:[]});state.multiplayer=structuredClone(data.multiplayer||state.multiplayer||{playMode:"coop",team:"A",friendlyFire:false});state.vr=structuredClone(data.vr||state.vr||{enabled:false,locomotion:"stick",snapTurnDeg:30});state.marketplace=structuredClone(data.marketplace||state.marketplace||{currentUserId:"PLAYER",platformContributionRate:1,platformFund:0,adRevenuePool:0,markets:[],listings:[],purchases:[],ratings:[],ledger:[],wallets:{}});state.shops=structuredClone(data.shops||[]);state.villages=structuredClone(data.villages||[]);state.lifeSim=structuredClone(data.lifeSim||state.lifeSim||{});state.civilization=structuredClone(data.civilization||state.civilization||{});state.gameMode=data.gameMode||'survival';state.infiniteScale=structuredClone(data.infiniteScale||state.infiniteScale||{});state.creator=structuredClone(data.creator||state.creator||{enabled:false,scaleMm:1,focusMarker:true,gridOpacity:.14,gridVisible:true,panelVisible:true,panelCollapsed:false,createOrigin:'view',anchorToWorkbench:true,partPlacementAssist:true,cameraTool:'rotate',reachMm:1200,workbenchBoundedPlacement:true,smartSnap:true,smartSnapPixels:24,smartSnapTypes:{vertex:true,edge:true,face:true,center:true,axis:true}});state.seamless=structuredClone(data.seamless||state.seamless||{mode:"workspace",workbenchActive:false});state.mechanical=structuredClone(data.mechanical||state.mechanical||{});state.manufacturing=structuredClone(data.manufacturing||state.manufacturing||{});state.buildingAssist=structuredClone(data.buildingAssist||state.buildingAssist||{});
  state.sketches=(data.sketches||[]).map(hydrateSketch);
  for(const raw of data.objects||[])addPart(raw.type,raw,false);
  state.entityRegistry?.rebuild?.();
  state.groups=structuredClone(data.groups||[]);state.assemblyConstraints=structuredClone(data.assemblyConstraints||[]);state.referenceMates=structuredClone(data.referenceMates||[]);
  state.nextId=Math.max(Number(data.counters?.nextId||1),state.objects.length+1);state.nextObjectCode=Math.max(Number(data.counters?.nextObjectCode||parseInt("16AZ",36)),state.nextObjectCode);
  workspaceManager.apply(state.workspace?.preset||"studio");workspaceManager.setDesignScale?.(state.workspace?.designScale||"1:1");infiniteScaleCore?.ensureState?.();infiniteScaleCore?.applyToScene?.();seamlessWorld=new SeamlessWorldController(state,scene,workspaceManager,planetManager,avatarManager,infiniteScaleCore);ensureMechanical(state);ensureManufacturingState(state);mechanicalSolver=new MechanicalSolver(state,scene);manufacturingCore=new ManufacturingCore(state);
factoryManager=new FactoryManager(state);
camCore=new CamCore(state);
portableWorkbench=new PortableWorkbenchManager(state,scene,workspaceManager,avatarManager,planetManager);
buildingPrimitives=new BuildingPrimitiveManager(state,addPart);
spacecraftParts=new SpacecraftPartsManager(state,addPart);
spacecraftFlight=new SpacecraftFlightManager(state,scene,spacecraftParts,()=>updateSpacecraftStatus?.());
buildingAssist=new BuildingAssistManager(state,addPart,(object)=>{scene.remove(object);state.objects=state.objects.filter(o=>o.id!==object.id);});
liveBuildingPlacement=new LiveBuildingPlacementController(state,scene,$("#canvas"),addPart,(object)=>{scene.remove(object);state.objects=state.objects.filter(o=>o.id!==object.id);},(event,payload)=>{if(event==="commit"){refresh();status(`建築配置確定: ${payload.name}`,"command")}else if(event==="group-commit"){const r=buildingAssist?.normalizeGroupFoundations?.(payload.items);for(const o of payload.items||[])scene.sync(o);refresh();status(`${payload.label||"建築"} 配置確定 / 地表基礎補正 ${r?.foundations?.length||0}基`,"command")}else if(event==="group-start")status(`${payload.label||"建築"} ゴースト配置: 照準/カーソルで移動 → クリック確定 / ESC取消`,"command");else if(event==="blocked")status("同じ位置に同種部材があります","error");else if(event==="first-point")status("始点を確定。終点をクリックしてください","command");});
recipeBlueprint=new RecipeBlueprintManager(state,addPart);
itemCrafting=new ItemCraftingManager({state,scene,addPart,handEquipment,workbench:portableWorkbench,avatar:avatarManager,onStatus:(t,type)=>status(t,type)});
survivalResources=new SurvivalResourceManager({state,scene,planet:planetManager,avatar:avatarManager,itemCrafting,onStatus:(t,type)=>status(t,type)});
marketplace=new MarketplaceManager(state,addPart,recipeBlueprint);
mobileControls=new MobileControls(state,avatarManager,scene,document);spacecraftParts=new SpacecraftPartsManager(state,addPart);spacecraftFlight=new SpacecraftFlightManager(state,scene,spacecraftParts,()=>updateSpacecraftStatus?.());mobileControls?.setSpacecraftFlight?.(spacecraftFlight);creatorMode=new CreatorModeController(state,scene,infiniteScaleCore,$("#viewport"),{onChange:()=>updateScaleHud?.(),workbench:portableWorkbench,planet:planetManager,avatar:avatarManager});buildingPrimitives.getPlacementOrigin=()=>creatorMode?.creationPositionCad?.()||null;buildingAssist.groundResolver=(p)=>planetManager?.groundCadPoint?.(scene,p)||p;partPlacementAssist=new PartPlacementAssist(state,scene,$("#canvas"),addPart,(object)=>{scene.remove(object);state.objects=state.objects.filter(o=>o.id!==object.id);refresh();});planetManager?.rebuild?.();avatarManager?.ensureState?.();avatarManager?.setPlanetManager?.(planetManager);if(state.planet?.enabled)avatarManager?.enterPlanet?.(new THREE.Vector3(...(state.avatar?.planetNormal||[0,1,0])));planetManager?.setEnabled?.(!!state.planet?.enabled,false);avatarManager?.build?.();avatarManager?.sync?.();handEquipment=new HandEquipmentManager(state,scene,avatarManager);handEquipment.restore();if(itemCrafting){itemCrafting.handEquipment=handEquipment;itemCrafting.workbench=portableWorkbench;itemCrafting.avatar=avatarManager;itemCrafting.ensureState?.()}if(survivalResources){survivalResources.avatar=avatarManager;survivalResources.planet=planetManager;survivalResources.itemCrafting=itemCrafting;survivalResources.rebuild?.()}shopManager=new ShopManager({state,scene,addPart,npcManager,itemCrafting,marketplace,groundResolver:(p)=>planetManager?.groundCadPoint?.(scene,p)||p,onStatus:(t,type)=>status(t,type)});villageManager=new VillageManager({state,addPart,npcManager,shopManager,groundResolver:(p)=>planetManager?.groundCadPoint?.(scene,p)||p,onStatus:(t,type)=>status(t,type)});villageManager?.repairAllSurfaceAnchors?.();for(const o of state.objects||[])if(o?.metadata?.villageBuilding)scene.sync?.(o);livingSociety=new LivingSocietyManager({state,scene,npcManager,villageManager,resourceManager:survivalResources,groundResolver:(p)=>planetManager?.groundCadPoint?.(scene,p)||p,onStatus:(t,type)=>status(t,type)});if(mobileGameUI){mobileGameUI.itemCrafting=itemCrafting;mobileGameUI.resourceManager=survivalResources}npcManager?.rebuild?.();portableWorkbench?.ensureState?.();portableWorkbench?.rebuild?.();spatialPanels?.render?.();physicsManager?.ensureState?.();mobileGameUI?.ensureState?.();mobileGameUI?.render?.();vrManager?.ensureState?.();
  for(const [id,visible] of Object.entries(state.datumVisibility))scene.setDatumVisibility(id,visible);
  rebuildEngine?.snapshot?.("Project loaded");scene.fit?.(state.objects);refresh();status(`プロジェクトを読み込みました: ${state.objects.length} objects / ${state.sketches.length} sketches`,"command");
}
async function applyNetworkProject(snapshot){
  const localAvatar=structuredClone(state.avatar||{}),localControls=structuredClone(state.controls||{}),localCreator=structuredClone(state.creator||{});
  const localCraftControl=new Map((state.spacecraft?.crafts||[]).map(c=>[c.id,{pilot:!!c.pilot,walkMode:!!c.walkMode,cameraMode:c.cameraMode,cameraOrbit:structuredClone(c.cameraOrbit||{}),control:structuredClone(c.control||{}),modifyMode:!!c.modifyMode,_avatarRestore:structuredClone(c._avatarRestore||null)}]));
  const data=structuredClone(snapshot||{});
  data.avatar=localAvatar;data.controls=localControls;
  if(data.spacecraft?.crafts)for(const c of data.spacecraft.crafts){const l=localCraftControl.get(c.id);if(l)Object.assign(c,l)}
  data.creator={...(data.creator||{}),enabled:localCreator.enabled,panelVisible:localCreator.panelVisible,panelCollapsed:localCreator.panelCollapsed,cameraTool:localCreator.cameraTool};
  await loadProjectData(data);
  window.__UE_AVATAR_GROUP__=avatarManager?.group||null;if(networkGameplay){networkGameplay.avatar=avatarManager;networkGameplay.spacecraft=spacecraftFlight;networkGameplay.itemCrafting=itemCrafting;networkGameplay.ensureState?.();if(survivalResources){survivalResources.avatar=avatarManager;survivalResources.planet=planetManager;survivalResources.itemCrafting=itemCrafting;survivalResources.rebuild?.()}}
}
function defaultRelayUrl(){
  const params=new URLSearchParams(location.search);const fromQuery=String(params.get('relay')||'').trim();
  if(fromQuery){try{localStorage.setItem('ueRelayUrl',fromQuery)}catch{}return fromQuery}
  const configured=String(window.UNIVERSE_ENGINE_CONFIG?.relayUrl||'').trim();if(configured)return configured;
  try{const saved=String(localStorage.getItem('ueRelayUrl')||'').trim();if(saved)return saved}catch{}
  // GitHub Pagesは静的ホスティングなので同一host:8787にはRelayが存在しない。
  if(location.hostname.endsWith('.github.io'))return '';
  const secure=location.protocol==='https:';const host=(location.hostname&&location.hostname!=='localhost')?location.hostname:'localhost';return `${secure?'wss':'ws'}://${host}:8787`;
}
function rememberRelayUrl(){const value=String($("#multiplayerRelayUrl")?.value||'').trim();if(value)try{localStorage.setItem('ueRelayUrl',value)}catch{}return value}
function multiplayerInviteUrl(){
  const base=new URL(location.href);base.hash='';
  const relay=String($("#multiplayerRelayUrl")?.value||defaultRelayUrl()||'').trim();
  const room=String($("#multiplayerRoom")?.value||'UNIVERSE-001').trim()||'UNIVERSE-001';
  const mode=String($("#multiplayerPlayMode")?.value||'coop');const team=String($("#multiplayerTeam")?.value||'A');
  ['relay','room','mode','team','invite'].forEach(k=>base.searchParams.delete(k));
  if(relay)base.searchParams.set('relay',relay);base.searchParams.set('room',room);base.searchParams.set('mode',mode);base.searchParams.set('team',team);base.searchParams.set('invite','1');
  return base.toString();
}
function drawInviteQr(text){
  const canvas=$("#multiplayerQrCanvas");if(!canvas||canvas.dataset?.missingSelector)return false;
  try{
    const qr=new QRCode(0,0);qr.addData(String(text));qr.make();const count=qr.getModuleCount(),quiet=4,size=280,dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1));
    canvas.width=size*dpr;canvas.height=size*dpr;canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);
    const cell=size/(count+quiet*2);ctx.fillStyle='#000';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect((c+quiet)*cell,(r+quiet)*cell,Math.ceil(cell+.15),Math.ceil(cell+.15));
    return true;
  }catch(error){console.error('[QR]',error);multiplayerUiStatus(`QR生成失敗: ${error.message}`,'error');return false}
}
function showMultiplayerQr(){
  const url=multiplayerInviteUrl(),box=$("#multiplayerQrBox"),field=$("#multiplayerInviteUrl");if(field&&!field.dataset?.missingSelector)field.value=url;
  if(box&&!box.dataset?.missingSelector)box.hidden=false;drawInviteQr(url);
  if(location.protocol==='file:')multiplayerUiStatus('QRは生成しました。別端末から開くにはGitHub Pages等の公開URLで使用してください','error');
  else multiplayerUiStatus('招待QRを生成しました。スマホで読み取ると同じRoom設定を開けます','ok');
}
async function copyMultiplayerInvite(){const url=multiplayerInviteUrl();try{await navigator.clipboard.writeText(url);multiplayerUiStatus('招待リンクをコピーしました','ok')}catch{const f=$("#multiplayerInviteUrl");if(f){f.value=url;f.select?.()}multiplayerUiStatus('招待URLを選択しました。コピーしてください','info')}}
async function shareMultiplayerInvite(){const url=multiplayerInviteUrl();if(navigator.share){try{await navigator.share({title:'Universe Engine Multiplayer',text:`Universe Engine / ${$("#multiplayerRoom")?.value||'Room'}`,url});return}catch(error){if(error?.name==='AbortError')return}}await copyMultiplayerInvite()}
function applyMultiplayerInviteFromUrl(){
  const q=new URLSearchParams(location.search);if(q.get('room')&&$("#multiplayerRoom"))$("#multiplayerRoom").value=q.get('room');if(q.get('relay')&&$("#multiplayerRelayUrl"))$("#multiplayerRelayUrl").value=q.get('relay');
  if(q.get('mode')&&$("#multiplayerPlayMode"))$("#multiplayerPlayMode").value=q.get('mode');if(q.get('team')&&$("#multiplayerTeam"))$("#multiplayerTeam").value=q.get('team');
  if(q.get('invite')==='1')setTimeout(()=>{openMultiplayerDialog();multiplayerUiStatus(`招待リンクを読み込みました / Room: ${q.get('room')||'UNIVERSE-001'}。Player名を確認してJOINしてください`,'ok')},250);
}

function renderMultiplayerPeers(peers=[]){
  const root=$("#multiplayerPeers");if(!root||root.dataset?.missingSelector)return;
  const selfName=multiplayer?.name||state.avatar?.name||'Player';
  root.innerHTML=`<div class="multiPeer self"><b>● ${escapeHtml(selfName)}</b><span>自分 ${multiplayer?.isHost?' / HOST':''}</span></div>`+peers.map(p=>`<div class="multiPeer"><b>● ${escapeHtml(p.name||'Player')}</b><span>${p.isHost?'HOST / ':''}${p.playMode==='versus'?`VS ${escapeHtml(p.team||'')} / HP ${Number(p.hp??100)}/${Number(p.maxHp??100)}${p.dead?' / DOWN':''}`:'CO-OP'} / ${p.vehicleSeat?`${escapeHtml(p.vehicleSeat.role||'seat')} ${escapeHtml(p.vehicleSeat.craftId||'')}`:(p.carryIds?.length?`共同運搬 ${p.carryIds.length}`:(p.primaryId?`編集中 ${escapeHtml(p.primaryId)}`:'接続中'))}</span></div>`).join('');
  $("#multiplayerCount").textContent=`${peers.length+1}人`;
}
function openMultiplayerDialog(){
  if(!$("#multiplayerRelayUrl").value)$("#multiplayerRelayUrl").value=defaultRelayUrl();
  $("#multiplayerPlayerName").value=multiplayer?.name||state.avatar?.name||'Player';
  const mp=state.multiplayer||{};if($('#multiplayerPlayMode'))$('#multiplayerPlayMode').value=mp.playMode||'coop';if($('#multiplayerTeam'))$('#multiplayerTeam').value=mp.team||'A';renderMultiplayerPeers(multiplayer?[...multiplayer.peers.values()]:[]);$("#multiplayerDialog").classList.add('show');
}
function multiplayerUiStatus(text,type='info'){
  const el=$("#multiplayerStatus");if(el&&!el.dataset?.missingSelector){el.textContent=text;el.dataset.type=type}status(`[MULTI] ${text}`,type==='error'?'error':'command');
}
multiplayer=new MultiplayerManager({state,scene,serializeProject,applyProject:applyNetworkProject,onStatus:multiplayerUiStatus,onPeers:renderMultiplayerPeers,onGameEvent:(msg)=>networkGameplay?.handleGameEvent?.(msg)});
networkGameplay=new NetworkGameplayManager({state,scene,multiplayer,avatar:avatarManager,spacecraft:spacecraftFlight,itemCrafting,onStatus:status});
projectileManager=new ProjectileManager({state,scene,planet:planetManager,multiplayer,itemCrafting,onStatus:status});
networkGameplay.projectiles=projectileManager;
window.__UE_PROJECTILES__=projectileManager;
window.__UE_NETWORK_GAMEPLAY__=networkGameplay;
scene?.addLoopHook?.(()=>survivalResources?.update?.());

function saveCurrentProject(){downloadProject(state,`UniverseEngine_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.uecad`);status("UECADプロジェクトを保存しました","command")}

function removeSelected(){
  const targets=state.selectedObjects();
  const blocked=targets.filter(o=>villageManager&&!villageManager.canModifyObject(o));
  if(blocked.length){status(`🔒 サバイバルでは所有者のいる建物を削除できません (${blocked[0].name})`,"error");return;}
  targets.forEach(object=>scene.remove(object));
  const ids=new Set(targets.map(object=>object.id));

  state.objects=state.objects.filter(object=>!ids.has(object.id));
  state.groups=state.groups
    .map(group=>({
      ...group,
      memberIds:group.memberIds.filter(id=>!ids.has(id))
    }))
    .filter(group=>group.memberIds.length>1);

  state.selectedIds=[];
  state.primaryId=null;
  geometrySelection.clear();
  refresh();
  status(`${targets.length}個削除`);
}

const TRANSFORM_DEFS=[
  {group:"移動 (mm)",key:"px",label:"X",kind:"position",axis:0,hint:"平面"},
  {group:"移動 (mm)",key:"py",label:"Y",kind:"position",axis:1,hint:"平面"},
  {group:"移動 (mm)",key:"pz",label:"Z",kind:"position",axis:2,hint:"高さ"},
  {group:"回転 (°)",key:"rx",label:"RX",kind:"rotation",axis:0},
  {group:"回転 (°)",key:"ry",label:"RY",kind:"rotation",axis:1},
  {group:"回転 (°)",key:"rz",label:"RZ",kind:"rotation",axis:2},
  {group:"拡縮 (倍率)",key:"sx",label:"SX",kind:"scale",axis:0},
  {group:"拡縮 (倍率)",key:"sy",label:"SY",kind:"scale",axis:1},
  {group:"拡縮 (倍率)",key:"sz",label:"SZ",kind:"scale",axis:2}
];
const TICK_VALUES=[.001,.01,.1,1,10,100,1000];
let transformDragMode="xy";
let dragSession=null;

function defaultTransformValue(def){return def.kind==="scale"?1:0}
function snapValue(value,step){return Math.round(value/step)*step}
function formatValue(value,step){const decimals=Math.min(6,Math.max(0,Math.ceil(-Math.log10(step))));return Number(value.toFixed(decimals))}
function buildTransformControls(){
  const host=$("#transformControls");host.innerHTML="";host.dataset.tool=host.dataset.tool||"move";let lastGroup="";
  for(const def of TRANSFORM_DEFS){
    if(def.group!==lastGroup){const title=document.createElement("div");title.className="transformGroupTitle";title.textContent=def.group;host.append(title);lastGroup=def.group}
    const group=document.createElement("div");group.className="transformGroup";group.dataset.kind=def.kind;
    const label=document.createElement("label");label.className="transformRowLabel";label.innerHTML=`${def.label} <span class="axisHint">${def.hint||""}</span>`;
    const range=document.createElement("input");range.type="range";range.className="transformSlider";range.id=`${def.key}Range`;range.min=def.kind==="scale"?.01:-100;range.max=def.kind==="scale"?3:100;range.step=.001;range.value=defaultTransformValue(def);
    const number=document.createElement("input");number.type="number";number.className="transformNumber";number.id=def.key;number.value=defaultTransformValue(def);number.step=.001;
    const select=document.createElement("select");select.className="tickSelect";select.id=`${def.key}Tick`;select.innerHTML=TICK_VALUES.map(v=>`<option value="${v}" ${v===1?"selected":""}>${v}</option>`).join("");
    const update=(raw,preview=true)=>{const step=Number(select.value);const value=formatValue(snapValue(Number(raw)||0,step),step);number.value=value;range.value=Math.max(Number(range.min),Math.min(Number(range.max),value));if(preview)transform.apply(transformValues())};
    range.addEventListener("input",()=>update(range.value));number.addEventListener("input",()=>update(number.value));
    select.addEventListener("change",()=>update(number.value));
    for(const el of [range,number])el.addEventListener("wheel",event=>{event.preventDefault();const step=Number(select.value);update((Number(number.value)||0)+(event.deltaY<0?step:-step))},{passive:false});
    number.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();update(number.value)}});
    group.append(label,range,number,select);host.append(group);
  }
}
function resetTransformControls(){
  const primary=state.primary();
  for(const def of TRANSFORM_DEFS){
    let value=defaultTransformValue(def);
    if(transform.mode==="absolute"&&primary){value=def.kind==="position"?primary.position[def.axis]:def.kind==="rotation"?primary.rotation[def.axis]:primary.scale[def.axis]}
    const input=$("#"+def.key),range=$("#"+def.key+"Range");if(input)input.value=value;if(range)range.value=Math.max(Number(range.min),Math.min(Number(range.max),value));
  }
}
function openTransform(mode,tool=null){
  if(!state.selectedObjects().length){status("部品を選択してください");return}
  if(!$("#transformControls").children.length)buildTransformControls();
  transform.capture();transform.mode=mode||"relative";resetTransformControls();
  setPropertyPanelMode("transform");
  if(tool){$("#transformControls").dataset.tool=tool;document.querySelectorAll('.transformTool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));}
  status("プロパティ内の変形モード: XY平面またはZ高さ方向へドラッグできます");
}
function transformValues(){
  const get=id=>{const el=$(id);return !el||el.value===""?null:Number(el.value)};
  return {position:[get("#px"),get("#py"),get("#pz")],rotation:[get("#rx"),get("#ry"),get("#rz")],scale:[get("#sx"),get("#sy"),get("#sz")]};
}
function closeDialog(selector){const el=$(selector);if(el)el.classList.remove("show");}
let propertyPanelMode="properties";
function setPropertyPanelMode(mode,{capture=false}={}){
  propertyPanelMode=mode==="transform"?"transform":"properties";
  const prop=$("#properties"),tp=$("#propertyTransformPanel");
  if(prop)prop.classList.toggle("active",propertyPanelMode==="properties");
  if(tp)tp.classList.toggle("active",propertyPanelMode==="transform");
  $("#propertyModeProperties")?.classList.toggle("active",propertyPanelMode==="properties");
  $("#propertyModeTransform")?.classList.toggle("active",propertyPanelMode==="transform");
  if(propertyPanelMode==="transform"){
    if(typeof setPanelCollapsed==="function")setPanelCollapsed("right",false);
    $("#rightPanel")?.classList.add("show");
    if(!$("#transformControls")?.children.length)buildTransformControls();
    if(capture&&state.selectedObjects().length){transform.capture();resetTransformControls();}
  }
}

function setSelectionMode(mode){
  state.selectionMode=mode;
  geometrySelection.setMode(mode);
  status(`選択モード: ${mode}`);
}






function rebuildStatusCounts(){
  const features=state.objects.flatMap(part=>part.features||[]);
  return {
    clean:features.filter(feature=>feature.rebuildState==="clean").length,
    dirty:features.filter(feature=>feature.dirty||feature.rebuildState==="dirty").length,
    error:features.filter(feature=>feature.rebuildState==="error").length
  };
}

function renderRebuildDialog(){
  const counts=rebuildStatusCounts();
  const total=state.objects.reduce(
    (sum,part)=>sum+(part.features?.length||0),
    0
  );

  $("#rebuildSummary").innerHTML=`
    <div class="rebuildStats">
      <div>Body</div><strong>${state.objects.length}</strong>
      <div>Feature</div><strong>${total}</strong>
      <div>Clean</div><strong class="statusClean">${counts.clean}</strong>
      <div>Dirty</div><strong class="statusDirty">${counts.dirty}</strong>
      <div>Error</div><strong class="statusError">${counts.error}</strong>
    </div>`;

  const rows=(rebuildEngine?.log||[]).slice(0,60);

  $("#rebuildLog").innerHTML=rows.length
    ?rows.map(entry=>`
      <div class="rebuildEntry ${entry.state}">
        <div>
          <strong>${entry.partName} / ${entry.featureName}</strong><br>
          <span class="help">${entry.featureType}${entry.error?` / ${entry.error}`:""}</span>
        </div>
        <div>${entry.state}</div>
        <div>${Number(entry.elapsed||0).toFixed(3)} ms</div>
      </div>`).join("")
    :'<div class="empty">再構築ログはまだありません。</div>';
}

function openRebuildDialog(){
  renderRebuildDialog();
  $("#rebuildDialog").classList.add("show");
}

function runDirtyRebuild(){
  rebuildEngine.snapshot("Before dirty rebuild");
  rebuildEngine.rebuildAll({dirtyOnly:true});
  rebuildEngine.snapshot("After dirty rebuild");
  renderRebuildDialog();
  status("Dirty Featureを再構築しました");
}

function runFullRebuild(){
  rebuildEngine.snapshot("Before full rebuild");
  for(const part of state.objects){
    rebuildEngine.markAllDirty(part,"manual full rebuild");
  }
  rebuildEngine.rebuildAll({dirtyOnly:false});
  rebuildEngine.snapshot("After full rebuild");
  renderRebuildDialog();
  status("全Featureを再構築しました");
}

function renderHistoryDialog(){
  const history=rebuildEngine?.history||[];
  $("#historyList").innerHTML=history.length
    ?history.map((item,index)=>`
      <div class="historyItem ${index===rebuildEngine.historyIndex?"current":""}">
        <strong>${index}. ${item.label}</strong><br>
        <span class="help">${item.timestamp} / Body ${item.objects.length}</span>
      </div>`).join("")
    :'<div class="empty">履歴はありません。</div>';
}

function openHistoryDialog(){
  renderHistoryDialog();
  $("#historyDialog").classList.add("show");
}

function selectedEdgeForKernel(){
  return state.subSelections.find(item=>item.mode==="edge")||null;
}

function renderEdgeKernelInfo(){
  const part=state.primary();
  const selectionRecord=selectedEdgeForKernel();
  const edge=edgeKernel.resolve(part,selectionRecord);

  if(!part||!selectionRecord||!edge){
    $("#edgeKernelInfo").innerHTML=
      "辺選択モードでEdgeを1本選択してください";
    return;
  }

  const chain=edgeKernel.tangentChain(part,edge);

  $("#edgeKernelInfo").innerHTML=`
    <strong>${part.name}</strong><br>
    <span class="edgeId">${edge.id}</span><br>
    Curve: ${edge.curveType}<br>
    Length: ${Number(edge.length||0).toFixed(3)} mm<br>
    Face: ${edge.faceIds.length}<br>
    Tangent Chain: ${chain.length}`;
}

function renderEdgeDiagnostics(){
  const part=state.primary();
  if(!part)return;

  const issues=edgeKernel.diagnose(part);

  $("#edgeKernelDiagnostics").innerHTML=
    issues.map(issue=>`
      <div class="edgeDiagnostic ${issue.severity}">
        <strong>${issue.type}</strong><br>
        ${issue.message}
      </div>
    `).join("");
}

function openEdgeKernel(){
  const part=state.primary();
  const selectionRecord=selectedEdgeForKernel();

  if(!part||state.selectionMode!=="edge"||!selectionRecord){
    status("辺選択モードでEdgeを1本選択してください");
    return;
  }

  renderEdgeKernelInfo();
  renderEdgeDiagnostics();

  edgeKernelVisualizer.show(
    part,
    selectionRecord,
    $("#edgeKernelOperation").value
  );

  $("#edgeKernelDialog").classList.add("show");
}

function applyEdgeKernelFeature(){
  const part=state.primary();
  const selectionRecord=selectedEdgeForKernel();
  if(!part||!selectionRecord)return;

  try{
    const operation=$("#edgeKernelOperation").value;
    const ratio=Number($("#edgeSplitRatio").value)||.5;
    const size=Number($("#edgeKernelSize").value)||0;

    edgeKernel.addFeature(
      part,
      selectionRecord,
      operation,
      {ratio,size}
    );

    edgeKernelVisualizer.clear();
    geometrySelection.invalidate(part);
    geometrySelection.clear();
    brepCore.build(part);

    $("#edgeKernelDialog").classList.remove("show");
    refresh();
    status(`Edge ${operation} Featureを追加しました`);
  }catch(error){
    status(error.message);
  }
}

function selectedFaceForKernel(){
  return state.subSelections.find(item=>item.mode==="face")||null;
}

function renderFaceKernelInfo(){
  const part=state.primary();
  const selectionRecord=selectedFaceForKernel();
  const face=faceKernel.resolve(part,selectionRecord);

  if(!part||!selectionRecord||!face){
    $("#faceKernelInfo").innerHTML=
      "面選択モードでFaceを1つ選択してください";
    return;
  }

  $("#faceKernelInfo").innerHTML=`
    <strong>${part.name}</strong><br>
    <span class="faceId">${face.id}</span><br>
    Surface: ${face.surfaceType}<br>
    Area: ${Number(face.area||0).toFixed(3)} mm²<br>
    Normal: ${(face.normal||[]).map(v=>Number(v).toFixed(3)).join(", ")}<br>
    Edge: ${face.edgeIds.length} / Vertex: ${face.vertexIds.length}`;
}

function openFaceKernel(){
  const part=state.primary();
  const selectionRecord=selectedFaceForKernel();

  if(!part||state.selectionMode!=="face"||!selectionRecord){
    status("面選択モードでFaceを1つ選択してください");
    return;
  }

  renderFaceKernelInfo();
  faceKernelVisualizer.show(
    part,
    selectionRecord,
    $("#faceKernelOperation").value
  );
  $("#faceKernelDialog").classList.add("show");
}

function applyFaceKernelFeature(){
  const part=state.primary();
  const selectionRecord=selectedFaceForKernel();
  if(!part||!selectionRecord)return;

  try{
    const operation=$("#faceKernelOperation").value;
    const value=Number($("#faceOffsetValue").value)||0;

    faceKernel.addFeature(
      part,
      selectionRecord,
      operation,
      value
    );

    geometrySelection.invalidate(part);
    geometrySelection.clear();
    faceKernelVisualizer.clear();
    $("#faceKernelDialog").classList.remove("show");
    refresh();
    status(`Face ${operation} Featureを追加しました`);
  }catch(error){
    status(error.message);
  }
}

function mergeCoplanarFaces(){
  const part=state.primary();
  if(!part)return;

  faceKernel.mergeCoplanar(part);
  renderFaceKernelInfo();
  status("共面Faceを統合しました");
}

function openBRepInspector(){const part=state.primary();if(!part)return status("ボディを選択してください");const s=brepCore.build(part),m=s.massProperties,errors=s.diagnostics.filter(x=>x.severity==="error").length;$("#brepSummary").innerHTML=`<div class="brepStats"><div>Body</div><strong>${part.name}</strong><div>Solid</div><strong>${s.solidId}</strong><div>Shell</div><strong>${s.shells.length}</strong><div>Face</div><strong>${s.faces.length}</strong><div>Edge</div><strong>${s.edges.length}</strong><div>HalfEdge</div><strong>${s.halfEdges.length}</strong><div>Vertex</div><strong>${s.vertices.length}</strong><div>体積</div><strong>${m.volume.toFixed(3)} mm³</strong><div>表面積</div><strong>${m.surfaceArea.toFixed(3)} mm²</strong><div>診断</div><strong class="${errors?'brepError':'brepOk'}">${errors?errors+' error':'Valid'}</strong></div>`;$("#brepTree").innerHTML=`<div class="section"><h3>Faces</h3>${s.faces.slice(0,12).map(f=>`<div class="brepNode"><strong>${f.id}</strong><br>${f.surfaceType} / 面積 ${(+f.area).toFixed(3)} / Edge ${f.edgeIds.length}</div>`).join('')||'<div class="empty">なし</div>'}</div><div class="section"><h3>Edges</h3>${s.edges.slice(0,12).map(e=>`<div class="brepNode"><strong>${e.id}</strong><br>${e.curveType} / 長さ ${(+e.length).toFixed(3)} / Face ${e.faceIds.length}</div>`).join('')||'<div class="empty">なし</div>'}</div>`;$("#brepDialog").classList.add("show")}
function rebuildBRep(){const p=state.primary();if(!p)return;brepCore.build(p);openBRepInspector();status("B-Repを再生成しました")}
function exportBRep(){const p=state.primary();if(!p)return;const blob=new Blob([JSON.stringify(brepCore.serialize(p),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`${p.name.replace(/[^a-z0-9_-]+/gi,"_")}.brep.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status("B-Rep JSONを出力しました")}

function booleanCandidates(){
  return state.objects.filter(object=>object.visible!==false);
}

function openBooleanDialog(){
  const objects=booleanCandidates();
  if(objects.length<2){
    status("Booleanには2つ以上の表示ボディが必要です");
    return;
  }

  const selected=state.selectedObjects();
  const target=selected[0]||objects[0];
  const tool=selected.find(object=>object.id!==target.id)||
    objects.find(object=>object.id!==target.id);

  const options=objects.map(object=>
    `<option value="${object.id}">${object.name} (${object.type})</option>`
  ).join("");

  $("#booleanTarget").innerHTML=options;
  $("#booleanTool").innerHTML=options;
  $("#booleanTarget").value=target.id;
  $("#booleanTool").value=tool.id;
  updateBooleanSummary();
  $("#booleanDialog").classList.add("show");
}

function updateBooleanSummary(){
  const target=state.object($("#booleanTarget").value);
  const tool=state.object($("#booleanTool").value);
  const operation=$("#booleanOperation").value;

  if(!target||!tool){
    $("#booleanSummary").innerHTML="対象を選択してください";
    return;
  }

  const exact=booleanCore.canExactBoxOperation(
    target,
    tool,
    operation
  );

  $("#booleanSummary").innerHTML=`
    <strong>${operation.toUpperCase()}</strong><br>
    Target: ${target.name}
    <span class="bodyBadge">${target.type}</span><br>
    Tool: ${tool.name}
    <span class="bodyBadge">${tool.type}</span><br>
    Result: ${exact?"BSP実形状（和・差・交差）":"実行不可"}`;
}

function applyBoolean(){
  const target=state.object($("#booleanTarget").value);
  const tool=state.object($("#booleanTool").value);
  const operation=$("#booleanOperation").value;
  const keepTool=$("#booleanKeepTool").checked;

  if(!target||!tool||target.id===tool.id){
    status("異なるTargetとToolを選択してください");
    return;
  }

  try{
    const result=booleanCore.addFeature(
      target,
      tool,
      operation,
      keepTool
    );

    geometrySelection.invalidate(target);
    geometrySelection.clear();
    state.selectedIds=[target.id];
    state.primaryId=target.id;
    selection.paint();

    $("#booleanDialog").classList.remove("show");
    refresh();
    scene.fit([target]);

    status(
      `${operation}をBSP実形状へ反映しました`
    );
  }catch(error){
    status(error.message);
  }
}


function clonePartData(source,name,position,rotation,scale){
  const data=structuredClone(Object.fromEntries(Object.entries(source).filter(([key])=>!["mesh","edge"].includes(key))));
  data.id=state.uid();data.name=name;data.position=[...position];data.rotation=[...rotation];data.scale=[...scale];data.groupId=null;
  data.datums=(data.datums||[]).filter(d=>!d.system); // addPart creates fresh object-specific primary datums
  data.geometryConstraints=[];
  data.metadata={...(data.metadata||{}),patternSourceId:source.id};
  return addPart(data.type,data,false);
}

function mirrorReflectionMatrix(axis,offset){
  const d=Number(offset)||0;
  // CAD X/Y/Z -> Three.js X/Z/Y
  const n=axis==='X'?new THREE.Vector3(1,0,0):axis==='Y'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
  const nx=n.x,ny=n.y,nz=n.z;
  return new THREE.Matrix4().set(
    1-2*nx*nx,-2*nx*ny,-2*nx*nz,2*d*nx,
    -2*ny*nx,1-2*ny*ny,-2*ny*nz,2*d*ny,
    -2*nz*nx,-2*nz*ny,1-2*nz*nz,2*d*nz,
    0,0,0,1
  );
}
function applyMirrorToPart(part,axis,offset){
  scene.sync(part);
  part.mesh.updateMatrix();
  const matrix=mirrorReflectionMatrix(axis,offset).multiply(part.mesh.matrix.clone());
  const p=new THREE.Vector3(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
  matrix.decompose(p,q,sc);
  const e=new THREE.Euler().setFromQuaternion(q,'XYZ');
  part.position=[p.x,p.z,p.y];
  part.rotation=[THREE.MathUtils.radToDeg(e.x),THREE.MathUtils.radToDeg(-e.z),THREE.MathUtils.radToDeg(e.y)];
  part.scale=[sc.x,sc.z,sc.y];
  scene.sync(part);
}
function updateMirrorSummary(){
  const count=state.selectedObjects().length,axis=$('#mirrorPlane').value,offset=Number($('#mirrorOffset').value)||0,mode=$('#mirrorMode').value;
  $('#mirrorSummary').textContent=`${count}個を ${axis==='X'?'YZ':axis==='Y'?'XZ':'XY'}面（${axis}=${offset}）で${mode==='copy'?'ミラーコピー':'ミラー'}します。`;
}
function openMirrorDialog(mode='mirror'){
  if(!state.selectedObjects().length)return status('ミラー対象を選択してください','error');
  $('#mirrorMode').value=mode;
  $('#mirrorDialog').classList.add('show');
  updateMirrorSummary();
}
function applyMirror(){
  const selected=[...state.selectedObjects()];
  if(!selected.length)return status('ミラー対象を選択してください','error');
  const axis=$('#mirrorPlane').value,offset=Number($('#mirrorOffset').value)||0,copyMode=$('#mirrorMode').value==='copy';
  const suffix=$('#mirrorSuffix').value||' Mirror';
  const targets=[];
  if(copyMode){
    for(const source of selected){
      const data=serializable(source);
      data.id=state.uid();data.name=`${source.name}${suffix}`;data.groupId=null;
      const made=addPart(source.type,data,false);
      targets.push(made);
    }
  }else targets.push(...selected);
  targets.forEach(part=>applyMirrorToPart(part,axis,offset));
  state.selectedIds=targets.map(p=>p.id);state.primaryId=targets.at(-1)?.id||null;
  rebuildEngine.snapshot(copyMode?'Mirror Copy':'Mirror');
  selection.paint();refresh();closeDialog('#mirrorDialog');
  status(`${copyMode?'MIRRORCOPY':'MIRROR'} ${axis}=${offset} : ${targets.length}個`,'command');
}

function openPatternDialog(){
  const source=state.primary();if(!source)return status("配列元のオブジェクトを選択してください","error");
  updatePatternFields();$("#patternDialog").classList.add("show");
}
function updatePatternFields(){
  const type=$("#patternType").value;
  $("#circularPatternFields").style.display=type==="circular"?"grid":"none";
  $("#rectangularPatternFields").style.display=type==="rectangular"?"grid":"none";
  $("#matrixPatternFields").style.display=type==="matrix"?"block":"none";
  const source=state.primary();$("#patternSummary").textContent=source?`配列元: ${source.name} / 元オブジェクトを含めて生成します。`:"オブジェクト未選択";
}
function circularPoint(point,center,axis,angle){
  const p=point.map((v,i)=>v-center[i]),c=Math.cos(angle),q=Math.sin(angle);let r;
  if(axis==="X")r=[p[0],p[1]*c-p[2]*q,p[1]*q+p[2]*c];
  else if(axis==="Y")r=[p[0]*c+p[2]*q,p[1],-p[0]*q+p[2]*c];
  else r=[p[0]*c-p[1]*q,p[0]*q+p[1]*c,p[2]];
  return r.map((v,i)=>v+center[i]);
}
function applyPattern(){
  const source=state.primary();if(!source)return status("配列元のオブジェクトを選択してください","error");
  const type=$("#patternType").value,made=[];
  try{
    if(type==="circular"){
      const count=Math.max(2,Math.floor(Number($("#patternCount").value)||2)),total=Number($("#patternAngle").value)||360,axis=$("#patternAxis").value;
      const center=[$("#patternCenterX"),$("#patternCenterY"),$("#patternCenterZ")].map(x=>Number(x.value)||0),rotate=$("#patternRotateObjects").checked;
      const closed=Math.abs(total-360)<1e-6,step=THREE.MathUtils.degToRad(total/(closed?count:Math.max(1,count-1)));
      for(let i=1;i<count;i++){const a=step*i,pos=circularPoint(source.position,center,axis,a),rot=[...source.rotation];if(rotate)rot[{X:0,Y:1,Z:2}[axis]]+=THREE.MathUtils.radToDeg(a);made.push(clonePartData(source,`${source.name} Circular ${i+1}`,pos,rot,source.scale));}
    }else if(type==="rectangular"){
      const counts=[$("#patternCountX"),$("#patternCountY"),$("#patternCountZ")].map(x=>Math.max(1,Math.floor(Number(x.value)||1)));
      const pitch=[$("#patternPitchX"),$("#patternPitchY"),$("#patternPitchZ")].map(x=>Number(x.value)||0);
      for(let z=0;z<counts[2];z++)for(let y=0;y<counts[1];y++)for(let x=0;x<counts[0];x++){if(x===0&&y===0&&z===0)continue;const pos=source.position.map((v,i)=>v+[x,y,z][i]*pitch[i]);made.push(clonePartData(source,`${source.name} Rect ${x+1}-${y+1}-${z+1}`,pos,source.rotation,source.scale));}
    }else{
      const rows=$("#patternMatrix").value.split(/\r?\n/).map(r=>r.trim()).filter(r=>r&&!r.startsWith("#"));
      rows.forEach((row,index)=>{const c=row.split(",").map(v=>v.trim()),n=c.slice(0,9).map(Number);if(n.slice(0,3).some(v=>!Number.isFinite(v)))throw new Error(`マトリックス ${index+1}行目のXYZが不正です`);if(index===0&&n.slice(0,9).every((v,i)=>v===[0,0,0,0,0,0,1,1,1][i]))return;const pos=source.position.map((v,i)=>v+n[i]),rot=source.rotation.map((v,i)=>v+(Number.isFinite(n[i+3])?n[i+3]:0)),scale=source.scale.map((v,i)=>v*(Number.isFinite(n[i+6])?n[i+6]:1));made.push(clonePartData(source,c[9]||`${source.name} Matrix ${index+1}`,pos,rot,scale));});
    }
    source.metadata={...(source.metadata||{}),lastPattern:{type,count:made.length+1,date:new Date().toISOString()}};
    state.selectedIds=made.map(x=>x.id);state.primaryId=made.at(-1)?.id||source.id;selection.paint();refresh();closeDialog("#patternDialog");scene.fit([source,...made]);status(`${type} 配列: ${made.length+1}個を生成`,"command");rebuildEngine?.snapshot?.(`Pattern ${type}`);
  }catch(error){status(error.message,"error")}
}

function availableSketchProfiles(){
  const sketch=sketchController.activeSketch||state.sketches.at(-1);
  if(!sketch)return {sketch:null,profiles:[]};
  return {sketch,profiles:buildSketchProfiles(sketch)};
}


function openSketchEntityEditor(){
 const e=sketchController.selectedEntity();if(!e)return status("編集するスケッチ要素を選択してください","error");
 $("#sketchEntityInfo").innerHTML=`<strong>${e.type}</strong><br>Entity ID: <strong>${e.code||e.id}</strong><br><span class="help">内部ID: ${e.id}</span>`;
 const fields=[`<div class="field"><label>要素ID</label><input id="sketchEntityCode" value="${e.code||""}" maxlength="32"></div>`];const add=(label,key,val)=>fields.push(`<label>${label}</label><input data-key="${key}" type="number" step="0.001" value="${Number(val)||0}">`);
 if(e.type==="point"){add("X","point.x",e.point.x);add("Y","point.y",e.point.y)}
 if(e.type==="line"){add("始点X","start.x",e.start.x);add("始点Y","start.y",e.start.y);add("終点X","end.x",e.end.x);add("終点Y","end.y",e.end.y)}
 if(e.type==="rectangle"){add("A X","a.x",e.a.x);add("A Y","a.y",e.a.y);add("B X","b.x",e.b.x);add("B Y","b.y",e.b.y)}
 if(e.type==="circle"){add("中心X","center.x",e.center.x);add("中心Y","center.y",e.center.y);add("半径","radius",e.radius)}
 if(e.type==="arc"){add("中心X","center.x",e.center.x);add("中心Y","center.y",e.center.y);add("半径","radius",e.radius);add("開始角(rad)","startAngle",e.startAngle);add("終了角(rad)","endAngle",e.endAngle)}
 if(e.type==="spline"){fields.push(`<p class="help">制御点 ${e.points?.length||0} / ${e.closed?'閉':'開'}スプライン。トリム後もスプラインとして編集できます。</p>`)}
 $("#sketchEntityFields").innerHTML=fields.join("");$("#sketchEntityDialog").classList.add("show");
}
function applySketchEntityEdit(){const e=sketchController.selectedEntity();if(!e)return;try{const code=$("#sketchEntityCode")?.value;if(code)sketchController.activeSketch.setEntityCode(e,code);for(const input of $$("#sketchEntityFields input[data-key]")){const [a,b]=input.dataset.key.split('.');if(b)e[a][b]=Number(input.value);else e[a]=Number(input.value)}e&&sketchController.activeSketch.updateProfiles();sketchController.rebuild();refresh();closeDialog("#sketchEntityDialog");status(`スケッチ要素を編集: ${e.code||e.type}`,"command")}catch(error){status(error.message,"error")}}
function solidTargetOptions(selectId,sketch){
  const select=$(selectId);if(!select)return;const owner=sketch?.ownerPartId;
  const solids=state.objects.filter(o=>o.visible!==false&&o.mesh);
  select.innerHTML=solids.map(o=>`<option value="${o.id}">${o.name} [${o.objectId||o.id}]</option>`).join("");
  if(owner&&state.object(owner))select.value=owner;else if(state.primaryId&&state.object(state.primaryId))select.value=state.primaryId;
}
function finishSolidOperation(tool,operation,targetId,label){
  if(operation==='newBody'){state.selectedIds=[tool.id];state.primaryId=tool.id;selection.paint();return tool}
  const target=state.object(targetId);if(!target)throw new Error('対象ソリッドを選択してください');
  const op=operation==='join'?'join':operation==='cut'?'cut':'intersect';
  const boolResult=booleanCore.addFeature(target,tool,op,false);if(boolResult?.feature)boolResult.feature.name=label;tool.metadata={...(tool.metadata||{}),constructionTool:true};
  state.selectedIds=[target.id];state.primaryId=target.id;selection.paint();geometrySelection.invalidate(target);
  status(`${label}: ${op.toUpperCase()} を ${target.name} に適用`,'command');return target;
}
function openSketchRevolve(){const {sketch,profiles}=availableSketchProfiles();if(!sketch||!profiles.length)return status("閉じたスケッチProfileが必要です","error");selectedProfileId=profiles[0].id;renderRevolveProfiles(sketch,profiles);solidTargetOptions("#revolveTarget",sketch);$("#sketchRevolveDialog").classList.add("show")}
function renderRevolveProfiles(sketch,profiles){$("#revolveProfileList").innerHTML=profiles.map(p=>`<div class="profileItem ${p.id===selectedProfileId?'selected':''}" data-id="${p.id}"><div class="profileIcon">⟳</div><div><strong>${p.type}</strong><br><span class="help">面積 ${p.area.toFixed(3)} mm²</span></div></div>`).join('');$$("#revolveProfileList .profileItem").forEach(x=>x.onclick=()=>{selectedProfileId=x.dataset.id;renderRevolveProfiles(sketch,profiles)})}
function createRevolutionFromProfile(){
  const {sketch,profiles}=availableSketchProfiles(),profile=profiles.find(p=>p.id===selectedProfileId);if(!profile)return status("Profileを選択してください","error");
  let pts=profile.points?structuredClone(profile.points):null;if(!pts&&profile.type==="circle"){pts=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;pts.push({x:profile.center.x+Math.cos(a)*profile.radius,y:profile.center.y+Math.sin(a)*profile.radius})}}
  if(!pts||pts.length<3)return status("回転可能な輪郭がありません","error");
  const angle=Math.max(.1,Math.min(360,Number($("#revolveAngle").value)||360)),axis=$("#revolveAxis").value,segments=Math.max(3,Number($("#revolveSegments").value)||96),operation=$("#revolveOperation").value;
  try{
    const tool=addPart("revolution",{name:`${operation==='cut'?'Revolve Cut Tool':'Revolve'} ${state.objects.filter(o=>o.type==='revolution').length+1}`,params:{points:pts,axis,angle,segments,plane:sketch.plane,sourceSketchId:sketch.id,sourceProfileId:profile.id},position:[0,0,0]},operation==='newBody');
    featureTree.add(tool,operation==='cut'?"RevolveCut":"SketchRevolve",{sketchId:sketch.id,profileId:profile.id,axis,angle,segments,operation});
    const result=finishSolidOperation(tool,operation,$("#revolveTarget").value,operation==='cut'?'回転カット':'回転体');
    if(state.sketchMode)sketchController.finishEdit();closeDialog("#sketchRevolveDialog");refresh();scene.fit([result]);if(operation==='newBody')status(`回転体: ${angle}° / ${axis}軸`,`command`);
  }catch(error){status(error.message,'error')}
}

function refreshPartDatumReferenceUI(){
  const part=state.primary();if(!part)return;
  const options=partReferenceOptions(part).map(o=>`<option value="${o.value}">${o.label}</option>`).join("");
  $("#partDatumReferenceA").innerHTML=options;
  $("#partDatumReferenceB").innerHTML=`<option value="">使用しない</option>${options}`;
  const mode=$("#partDatumMode").value;
  $("#partDatumReferenceBRow").style.display=mode==='between'?'contents':'none';
}
function openPartDatum(){
  const part=state.primary();if(!part)return status("部品を選択してください","error");
  ensurePartDatums(part);
  $("#partDatumName").value=`Datum ${part.datums.filter(d=>!d.system).length+1}`;
  $("#partDatumMode").value='reference';
  refreshPartDatumReferenceUI();
  $("#partDatumDialog").classList.add("show");
}
function addPartDatum(){
  const part=state.primary();if(!part)return;
  ensurePartDatums(part);
  const mode=$("#partDatumMode").value;
  const datum={
    id:`${part.id}:datum:${Date.now()}`,type:$("#partDatumType").value,
    name:$("#partDatumName").value||"Datum",orientation:$("#partDatumOrientation").value,
    position:[$("#partDatumX"),$("#partDatumY"),$("#partDatumZ")].map(x=>Number(x.value)||0),
    offset:Number($("#partDatumOffset").value)||0,visible:true,system:false,
    reference:{kind:mode,sourceA:$("#partDatumReferenceA").value,sourceB:$("#partDatumReferenceB").value||null}
  };
  part.datums.push(datum);scene.rebuildPartDatums(part);closeDialog("#partDatumDialog");refresh();
  status(`部品基準を追加: ${datum.name} / ${mode==='between'?'2基準の中間':'参照基準'}`,"command");
}


function geometryConstraintTargetOptions(part){
  ensurePartDatums(part);
  return (part.datums||[]).filter(d=>!d.system).map(d=>({value:d.id,label:`${d.name} (${d.type})`}));
}
function refreshGeometryConstraintUI(){
  const part=state.primary();if(!part)return;
  const targets=geometryConstraintTargetOptions(part);
  $("#geometryConstraintTarget").innerHTML=targets.map(o=>`<option value="${o.value}">${o.label}</option>`).join("");
  $("#geometryConstraintReference").innerHTML=partReferenceOptions(part).map(o=>`<option value="${o.value}">${o.label}</option>`).join("");
  const type=$("#geometryConstraintType").value;
  $("#geometryConstraintValueRow").style.display=['distance','angle'].includes(type)?'contents':'none';
  $("#geometryConstraintValueLabel").textContent=type==='angle'?'角度 °':'距離 mm';
  renderGeometryConstraintList(part);
}
function renderGeometryConstraintList(part){
  const list=$("#geometryConstraintList");
  const cs=Array.isArray(part.geometryConstraints)?part.geometryConstraints:[];
  if(!cs.length){list.innerHTML='<div class="help">拘束はまだありません。</div>';return;}
  list.innerHTML=cs.map(c=>{const d=(part.datums||[]).find(x=>x.id===c.targetDatumId);return `<div class="constraintRow" data-id="${c.id}"><span>${c.type.toUpperCase()}</span><span class="name">${d?.name||'Datum'} → ${c.reference}</span><span>${['distance','angle'].includes(c.type)?c.value:''}</span><button class="mini deleteGeometryConstraint">削除</button></div>`}).join('');
  $$("#geometryConstraintList .deleteGeometryConstraint").forEach(b=>b.onclick=()=>{part.geometryConstraints=cs.filter(c=>c.id!==b.parentElement.dataset.id);scene.rebuildPartDatums(part);refreshGeometryConstraintUI();refresh();status('幾何拘束を削除','command')});
}
function openGeometryConstraint(){
  const part=state.primary();if(!part)return status('部品を選択してください','error');
  ensurePartDatums(part);part.geometryConstraints=Array.isArray(part.geometryConstraints)?part.geometryConstraints:[];
  if(!geometryConstraintTargetOptions(part).length)return status('先に二次基準点・軸・面を作成してください','error');
  refreshGeometryConstraintUI();$("#geometryConstraintDialog").classList.add('show');
}
function addGeometryConstraint(){
  const part=state.primary();if(!part)return;
  const c={id:`gc-${Date.now()}`,type:$("#geometryConstraintType").value,targetDatumId:$("#geometryConstraintTarget").value,reference:$("#geometryConstraintReference").value,value:Number($("#geometryConstraintValue").value)||0};
  part.geometryConstraints=Array.isArray(part.geometryConstraints)?part.geometryConstraints:[];
  part.geometryConstraints.push(c);scene.rebuildPartDatums(part);refreshGeometryConstraintUI();refresh();status(`幾何拘束を追加: ${c.type}`,'command');
}


function openSketchExtrude(){
  const {sketch,profiles}=availableSketchProfiles();
  if(!sketch)return status("先にスケッチを作成してください");
  if(!profiles.length)return status("長方形または円のProfileがありません");
  selectedProfileId=profiles[0].id;
  renderProfileList(sketch,profiles);
  solidTargetOptions("#sketchExtrudeTarget",sketch);
  $("#sketchExtrudeDialog").classList.add("show");
}

function renderProfileList(sketch,profiles){
  const errors=(sketch.profileErrors||[]).map(error=>
    `<div class="profileError">${error.message}</div>`
  ).join("");

  const graph=sketch.profileGraph||{vertices:0,edges:0,loops:0};

  $("#profileList").innerHTML=
  `<div class="section">
    <strong>${sketch.name}</strong> / ${sketch.plane} / Profile ${profiles.length}
    <div class="loopPreview">Graph: Vertex ${graph.vertices} / Edge ${graph.edges} / Loop ${graph.loops}</div>
  </div>${errors}`+
  profiles.map(profile=>`<div class="profileItem ${profile.id===selectedProfileId?"selected":""}" data-id="${profile.id}">
    <div class="profileIcon">${profile.type==="circle"?"○":profile.type==="polygon"?"⬡":"□"}</div>
    <div>
      <strong>${profile.type}</strong>
      ${profile.holes?.length?`<span class="profileBadge">Hole ${profile.holes.length}</span>`:""}
      <br><span class="help">面積 ${profile.area.toFixed(3)} mm²</span>
      <div class="loopPreview">${profile.id}</div>
    </div>
  </div>`).join("");
  $$(".profileItem").forEach(item=>item.onclick=()=>{selectedProfileId=item.dataset.id;renderProfileList(sketch,profiles)});
}

function createExtrusionFromProfile(){
  const {sketch,profiles}=availableSketchProfiles();
  const profile=profiles.find(p=>p.id===selectedProfileId);
  if(!sketch||!profile)return status("Profileを選択してください");
  const distance=Math.max(.001,Number($("#sketchExtrudeDistance").value)||.001);
  const direction=$("#sketchExtrudeDirection").value;
  const signedDistance=direction==="negative"?-distance:distance;
  const params={
    profileType:profile.type,
    width:profile.width||(profile.radius||1)*2,
    profileHeight:profile.height||(profile.radius||1)*2,
    radius:profile.radius||0,
    points:profile.points?structuredClone(profile.points):null,
    holes:profile.holes?structuredClone(profile.holes):[],
    profileCenter:structuredClone(profile.center),
    distance,
    plane:sketch.plane,
    sourceSketchId:sketch.id,
    sourceProfileId:profile.id,
    direction
  };
  const position=sketchController.sketchToWorld(profile.center);
  if(direction==="positive"){
    if(sketch.plane==="XY")position.z+=distance/2;
    else if(sketch.plane==="XZ")position.y+=distance/2;
    else position.x+=distance/2;
  }else if(direction==="negative"){
    if(sketch.plane==="XY")position.z-=distance/2;
    else if(sketch.plane==="XZ")position.y-=distance/2;
    else position.x-=distance/2;
  }
  const operation=$("#sketchExtrudeOperation").value;
  const body=addPart("extrusion",{
    name:`${operation==="cut"?"Extrude Cut Tool":"Extrude"} ${state.objects.filter(o=>o.type==="extrusion").length+1}`,
    params,position:position.toArray(),rotation:[0,0,0],scale:[1,1,1]
  },operation==="newBody");
  const feature=featureTree.add(body,"SketchExtrude",{
    sketchId:sketch.id,
    profileId:profile.id,
    profile:structuredClone(profile),
    distance,
    direction,
    plane:sketch.plane,
    sourceEntityIds:profile.edgeIds||[profile.entityId].filter(Boolean)
  });
  feature.name=operation==="cut"?"Extrude Cut 1":"Sketch Extrude 1";feature.parameters.operation=operation;
  body.baseState={position:[...body.position],rotation:[...body.rotation],scale:[...body.scale],params:structuredClone(body.params)};
  let resultBody=body;
  try{resultBody=finishSolidOperation(body,operation,$("#sketchExtrudeTarget").value,operation==="cut"?"押し出しカット":"押し出し")}catch(error){status(error.message,"error");return}

  // 押し出し後にスケッチ編集状態が残ると、canvas の pointerdown が
  // すべて SketchController に奪われ、選択・移動・回転ができなくなる。
  // 押し出し完了をモデリングモードへの明示的な復帰点にする。
  if(state.sketchMode){
    sketch.updateProfiles?.();
    sketchController.finishEdit();
  }
  sketchController.pendingPoint=null;
  sketchController.selectedEntityId=null;
  scene.controls.enabled=true;
  dragSession=null;

  document.querySelectorAll(".dialog.show").forEach(dialog=>dialog.classList.remove("show"));
  state.selectionMode="body";
  state.subSelections=[];
  state.selectedIds=[resultBody.id];
  state.primaryId=resultBody.id;
  selection.paint();
  geometrySelection.invalidate(resultBody);
  geometrySelection.clear();
  edgeVisualizer.rebuild(resultBody);

  refresh();
  scene.fit([resultBody]);
  status(`${profile.type} Profileを${signedDistance}mm ${operation==="cut"?"押し出しカット":operation==="join"?"追加":"押し出し"}しました。ボディ操作へ戻りました`);
}

function applySketchConstraint(type){
  try{
    if(type==="Horizontal")sketchConstraints.horizontal();
    else if(type==="Vertical")sketchConstraints.vertical();
    else if(type==="Coincident")sketchConstraints.coincident();
    else if(type==="Parallel")sketchConstraints.parallel();
    else if(type==="Perpendicular")sketchConstraints.perpendicular();
    else if(type==="EqualLength")sketchConstraints.equal();
    else if(type==="Concentric")sketchConstraints.concentric();
    else if(type==="Midpoint")sketchConstraints.midpoint();
    else if(type==="Fixed")sketchConstraints.fixed();
    status(`${type}拘束を追加しました`)
  }catch(error){status(error.message)}
}
function openSketchDiagnostics(){
  const sketch=sketchController.activeSketch;if(!sketch)return status("スケッチ編集モードで使用してください");
  const items=sketchConstraints.diagnose(sketch),errors=items.filter(i=>i.severity==="error").length,warnings=items.filter(i=>i.severity==="warning").length;
  $("#sketchDiagnosticsSummary").innerHTML=`<strong>${sketch.name}</strong><br>DOF ${sketch.dof??0} / Constraint ${sketch.constraints.length} / Dimension ${sketch.dimensions.length}<br>Error ${errors} / Warning ${warnings}`;
  $("#sketchDiagnosticsList").innerHTML=items.map(i=>`<div class="diagnosticItem ${i.severity}"><strong>${i.type}</strong><br>${i.message}</div>`).join("");
  $("#sketchDiagnosticsDialog").classList.add("show")
}
function repairSketch(){const n=sketchConstraints.repairNearEndpoints();openSketchDiagnostics();status(`${n}組の近接端点を修復しました`)}
function openDimensionDialog(){
  const sketch=sketchController.activeSketch;
  const entity=sketch?.entity(sketchController.selectedEntityId);
  if(!entity||!["line","circle"].includes(entity.type))return status("線または円を選択してください");
  const typeSel=$("#dimensionType");
  if(entity.type==="circle"){typeSel.innerHTML='<option value="Radius">半径</option><option value="Diameter">直径</option>';typeSel.value='Radius';$("#dimensionValue").value=entity.radius.toFixed(3)}
  else{typeSel.innerHTML='<option value="Length">長さ</option><option value="Horizontal">水平距離</option><option value="Vertical">垂直距離</option><option value="Angle">角度</option>';typeSel.value='Length';$("#dimensionValue").value=Math.hypot(entity.end.x-entity.start.x,entity.end.y-entity.start.y).toFixed(3)}
  $("#dimensionTarget").innerHTML=`<strong>${entity.type}</strong> / ${entity.code||entity.id}`;
  $("#dimensionValueLabel").textContent=entity.type==="circle"?"寸法 mm":"寸法";
  $("#dimensionDialog").classList.add("show")
}
function applySketchDimension(){
  try{sketchConstraints.addDimension(Number($("#dimensionValue").value),$("#dimensionType").value);$("#dimensionDialog").classList.remove("show");status("寸法を適用しました")}
  catch(error){status(error.message)}
}
function trimSketchEntity(){try{sketchController.trimSelected();status(`TRIM ${sketchController.selectedEntity()?.code||""}`,'command')}catch(error){status(error.message,'error')}}
function extendSketchEntity(){try{sketchController.extendSelected();status(`EXTEND ${sketchController.selectedEntity()?.code||""}`,'command')}catch(error){status(error.message,'error')}}
function openSketchDialog(){$("#sketchDialog").classList.add("show")}
function createNewSketch(){
  const sketch=sketchController.createSketch({plane:$("#sketchPlane").value,gridSize:Math.max(.1,Number($("#sketchGridSize").value)||10),ownerPartId:state.primaryId});
  const part=state.primary();if(part){const f=featureTree.add(part,"Sketch",{sketchId:sketch.id,plane:sketch.plane,profileCount:0});f.name=sketch.name}
  $("#sketchDialog").classList.remove("show");refresh();status(`${sketch.name}を作成しました`)
}
function finishActiveSketch(){
  const sketch=sketchController.activeSketch;if(!sketch)return;sketch.updateProfiles();
  for(const part of state.objects){const f=featureTree.ensure(part).find(x=>x.type==="Sketch"&&x.parameters?.sketchId===sketch.id);if(f){f.parameters.profileCount=sketch.profileCount;f.parameters.entities=sketch.entities.length;f.parameters.constraints=sketch.constraints.length;f.parameters.dimensions=sketch.dimensions.length;f.dirty=false}}
  sketchController.finishEdit();refresh();status(`${sketch.name}を保存しました`)
}
function selectedTopologyFaces(){return state.subSelections.filter(item=>item.mode==="face")}
function faceAxisFromNormal(normal){const v=normal.map(Math.abs),i=v.indexOf(Math.max(...v));return ["X","Y","Z"][i]}
function faceSignFromNormal(normal){const axis=faceAxisFromNormal(normal),i=["X","Y","Z"].indexOf(axis);return Number(normal[i]||1)>=0?1:-1}
function openDefaultChamfer(){
 const part=state.primary();if(!part)return status("部品を選択してください");
 const existing=featureTree.ensure(part).find(f=>f.type==="DefaultChamfer"),rule=existing?.parameters||defaultChamferRule;
 $("#defaultChamferEnabled").checked=!!rule.enabled;$("#defaultChamferSize").value=Number(rule.size??.2);$("#defaultChamferDialog").classList.add("show");
}
function saveDefaultChamfer(){
 const part=state.primary();if(!part)return;const enabled=$("#defaultChamferEnabled").checked,size=Math.max(0,Number($("#defaultChamferSize").value)||0);defaultChamferRule={enabled,size};
 let feature=featureTree.ensure(part).find(f=>f.type==="DefaultChamfer");
 if(!feature){feature=featureTree.add(part,"DefaultChamfer",{enabled,size});feature.name="Default Chamfer Rule"}else{feature.parameters={enabled,size};feature.enabled=true;featureTree.markDirtyFrom(part,feature.id)}
 featureTree.rebuild(part);geometrySelection.invalidate(part);geometrySelection.clear();edgeVisualizer.rebuild(part);$("#defaultChamferDialog").classList.remove("show");refresh();status(enabled?`未指定辺へC${size}を設定しました`:"既定C面を無効化しました");
}
function openFaceExtrude(){
 const part=state.primary(),faces=selectedTopologyFaces();if(!part)return status("部品を選択してください");if(part.type!=="box")return status("面押し出しは直方体に対応しています");if(state.selectionMode!=="face"||faces.length!==1)return status("面選択モードで面を1つ選択してください");
 const face=faces[0];$("#faceExtrudeSelection").innerHTML=`<strong>${part.name}</strong><br><span class="faceToken">${face.id}</span> 面積 ${Number(face.area||0).toFixed(3)} mm² / 法線 ${face.normal.map(v=>Number(v).toFixed(3)).join(", ")}`;$("#faceExtrudeDialog").classList.add("show");
}
function addFaceExtrude(){
 const part=state.primary(),face=selectedTopologyFaces()[0];if(!part||!face)return;const axis=faceAxisFromNormal(face.normal),faceSign=faceSignFromNormal(face.normal),distance=Number($("#faceExtrudeDistance").value)||0,direction=$("#faceExtrudeDirection").value,operation=$("#faceExtrudeOperation").value;
 const feature=featureTree.add(part,"FaceExtrude",{faceId:face.id,axis,faceSign,distance,direction,operation,normal:[...face.normal],area:face.area});feature.name=`Face Extrude ${part.features.filter(f=>f.type==="FaceExtrude").length}`;
 featureTree.rebuild(part);geometrySelection.invalidate(part);geometrySelection.clear();edgeVisualizer.rebuild(part);$("#faceExtrudeDialog").classList.remove("show");refresh();status(`${axis}面を${distance}mm押し出しました`);
}

function selectedTopologyEdges(){
  return state.subSelections.filter(item=>item.mode==="edge");
}

function openEdgeFeature(type){
  const part=state.primary();
  const edges=selectedTopologyEdges();
  if(!part)return status("部品を選択してください");
  if(state.selectionMode!=="edge"||!edges.length){
    status("辺選択モードで1本以上の辺を選択してください");
    return;
  }
  if(!edges.every(edge=>edge.partId===part.id)){
    status("同じボディの辺を選択してください");
    return;
  }

  pendingEdgeFeatureType=type;
  $("#edgeFeatureTitle").textContent=type==="Fillet"?"選択辺フィレット":"選択辺面取り";
  $("#edgeSizeLabel").textContent=type==="Fillet"?"半径 R mm":"面取り C mm";
  $("#edgeFeatureSelection").innerHTML=`
    <strong>${part.name}</strong><div>${edges.length}辺を選択</div>
    <div>${edges.map(e=>`<span class="edgeToken">${e.id} / ${Number(e.length).toFixed(3)}mm</span>`).join("")}</div>`;
  $("#edgeFeatureDialog").classList.add("show");
}

function addEdgeFeature(){
  const part=state.primary();
  const edges=selectedTopologyEdges();
  if(!part||!edges.length)return;
  const topology=geometrySelection.ensureTopology(part);
  const allEdges=part.type==="box"&&edges.length===topology.edges.length;
  const size=Math.max(.001,Number($("#edgeFeatureSize").value)||.001);
  const params={
    size,
    method:$("#edgeFeatureMethod").value,
    allEdges,
    edgeIds:edges.map(e=>e.id),
    edges:edges.map(e=>({
      id:e.id,
      localA:[...e.localA],
      localB:[...e.localB],
      length:e.length,
      adjacentFaces:[...(e.adjacentFaces||[])]
    }))
  };
  const feature=featureTree.add(part,pendingEdgeFeatureType,params);
  feature.name=`${pendingEdgeFeatureType} ${part.features.filter(f=>f.type===pendingEdgeFeatureType).length}`;
  featureTree.rebuild(part);
  geometrySelection.invalidate(part);
  geometrySelection.clear();
  edgeVisualizer.rebuild(part);
  $("#edgeFeatureDialog").classList.remove("show");
  refresh();
  status(`${pendingEdgeFeatureType} Featureを追加しました${allEdges?"（実形状反映）":"（部分辺プレビュー）"}`);
}

function featurePart(){
  return state.primary();
}

function renderFeatureDialog(){
  const part=featurePart();
  const panel=$("#featureTreePanel");
  const editor=$("#featureEditor");

  if(!part){
    panel.innerHTML='<div class="empty">部品を選択してください。</div>';
    editor.innerHTML='';
    return;
  }

  const features=featureTree.ensure(part);
  panel.innerHTML=features.map((feature,index)=>`
    <div class="featureNode
      ${featureTree.selectedFeatureId===feature.id?'selected':''}
      ${feature.enabled?'':'suppressed'}
      ${feature.dirty?'dirty':''}
      ${index===part.rollbackIndex?'rollback':''}"
      data-id="${feature.id}">
      <button class="featureToggle" ${feature.type==='Base'?'disabled':''}>${feature.enabled?'●':'○'}</button>
      <div>
        <strong>${index}. ${feature.name}</strong>
        <div class="featureStatus">${feature.type} / ${feature.status||'dirty'}</div>
      </div>
      <button class="featureUp" ${index<=1?'disabled':''}>↑</button>
      <button class="featureDown" ${index===0||index===features.length-1?'disabled':''}>↓</button>
      <button class="featureDelete" ${index===0?'disabled':''}>×</button>
    </div>
  `).join('');

  panel.querySelectorAll(".featureNode").forEach(node=>{
    const id=node.dataset.id;
    node.onclick=event=>{
      if(event.target.closest("button"))return;
      featureTree.selectedFeatureId=id;
      renderFeatureDialog();
    };
    node.querySelector(".featureToggle").onclick=()=>{
      featureTree.toggle(part,id);
      const feature=featureTree.ensure(part).find(item=>item.id===id);
      if(feature?.type==="Boolean"){
        booleanVisualizer.clearFeature(feature.id);
        if(feature.enabled!==false){
          const tool=state.object(feature.parameters.toolId);
          if(tool)booleanVisualizer.rebuildFeature(part,tool,feature);
        }
      }
      renderFeatureDialog();
    };
    node.querySelector(".featureUp").onclick=()=>{featureTree.move(part,id,-1);renderFeatureDialog()};
    node.querySelector(".featureDown").onclick=()=>{featureTree.move(part,id,1);renderFeatureDialog()};
    node.querySelector(".featureDelete").onclick=()=>{
      booleanVisualizer?.clearFeature?.(id);
      featureTree.remove(part,id);
      renderFeatureDialog();
    };
  });

  const selected=featureTree.selected(part);
  if(!selected){
    editor.innerHTML='<h3>Feature Properties</h3><div class="empty">フィーチャーを選択してください。</div>';
  }else{
    editor.innerHTML=featureEditorHtml(selected);
    bindFeatureEditor(selected);
  }

  const handle=$("#rollbackHandle");
  const denominator=Math.max(1,features.length-1);
  handle.style.left=`${(part.rollbackIndex/denominator)*100}%`;
}

function featureEditorHtml(feature){
  if(feature.type==="Move"||feature.type==="Rotate"){
    const unit=feature.type==="Move"?"mm":"°";
    return `<h3>${feature.name}</h3>
    <div class="featureEditorGrid">
      <label>X ${unit}</label><input id="fx" type="number" step="0.001" value="${feature.parameters.x||0}">
      <label>Y ${unit}</label><input id="fy" type="number" step="0.001" value="${feature.parameters.y||0}">
      <label>Z ${unit}</label><input id="fz" type="number" step="0.001" value="${feature.parameters.z||0}">
    </div>
    <div class="row" style="margin-top:8px"><button id="saveFeature">保存</button></div>`;
  }

  if(feature.type==="DefaultChamfer"){
    return `<h3>${feature.name}</h3><div class="featureEditorGrid"><label>有効</label><input id="defaultEditEnabled" type="checkbox" ${feature.parameters.enabled?"checked":""}><label>C面 mm</label><input id="defaultEditSize" type="number" min="0" step="0.01" value="${feature.parameters.size||0}"></div><div class="row" style="margin-top:8px"><button id="saveFeature">保存</button></div>`;
  }
  if(feature.type==="FaceExtrude"){
    return `<h3>${feature.name}</h3><div class="featureEditorGrid"><label>軸</label><div>${feature.parameters.axis||"Z"} / ${feature.parameters.faceId||""}</div><label>距離 mm</label><input id="faceEditDistance" type="number" step="0.1" value="${feature.parameters.distance||0}"><label>方向</label><select id="faceEditDirection"><option value="normal" ${feature.parameters.direction==="normal"?"selected":""}>面法線</option><option value="reverse" ${feature.parameters.direction==="reverse"?"selected":""}>反転</option></select></div><div class="row" style="margin-top:8px"><button id="saveFeature">保存</button></div>`;
  }
  if(feature.type==="Fillet"||feature.type==="Chamfer"){
    return `<h3>${feature.name}</h3>
    <div class="featureEditorGrid">
      <label>${feature.type==="Fillet"?"半径 R":"面取り C"} mm</label><input id="edgeEditSize" type="number" min="0.001" step="0.1" value="${feature.parameters.size||1}">
      <label>対象</label><div>${feature.parameters.allEdges?"全エッジ":`${feature.parameters.edgeIds?.length||0}辺`}</div>
    </div>
    <div class="row" style="margin-top:8px"><button id="saveFeature">保存</button></div>`;
  }

  if(feature.type==="Metadata"){
    return `<h3>${feature.name}</h3>
    <div class="featureEditorGrid">
      <label>キー</label><input id="metaKey" value="${feature.parameters.key||''}">
      <label>値</label><input id="metaValue" value="${feature.parameters.value||''}">
    </div>
    <div class="row" style="margin-top:8px"><button id="saveFeature">保存</button></div>`;
  }

  return `<h3>${feature.name}</h3><div class="help">Base geometry feature</div>`;
}

function bindFeatureEditor(feature){
  const save=$("#saveFeature");
  if(!save)return;

  save.onclick=()=>{
    if(feature.type==="Move"||feature.type==="Rotate"){
      feature.parameters={
        x:Number($("#fx").value)||0,
        y:Number($("#fy").value)||0,
        z:Number($("#fz").value)||0
      };
    }else if(feature.type==="Metadata"){
      feature.parameters={
        key:$("#metaKey").value,
        value:$("#metaValue").value
      };
    }else if(feature.type==="Fillet"||feature.type==="Chamfer"){
      feature.parameters.size=Math.max(.001,Number($("#edgeEditSize").value)||.001);
    }else if(feature.type==="DefaultChamfer"){
      feature.parameters.enabled=$("#defaultEditEnabled").checked;feature.parameters.size=Math.max(0,Number($("#defaultEditSize").value)||0);
    }else if(feature.type==="EdgeEdit"){
      feature.parameters.size=Number($("#edgeFeatureEditValue").value)||0;
    }else if(feature.type==="FaceEdit"){
      feature.parameters.value=Number($("#faceFeatureEditValue").value)||0;
    }else if(feature.type==="Boolean"){
      const part=featurePart();
      feature.parameters.operation=$("#booleanEditOperation").value;
      feature.parameters.keepTool=$("#booleanEditKeepTool").checked;
      feature.parameters.resultMode="preview";
      feature.status="preview";
      const tool=state.object(feature.parameters.toolId);
      if(tool)booleanVisualizer.rebuildFeature(part,tool,feature);
    }else if(feature.type==="SketchExtrude"){
      const part=featurePart();
      const distance=Math.max(.001,Number($("#sketchExtrudeEditDistance").value)||.001);
      feature.parameters.distance=distance;
      feature.parameters.direction=$("#sketchExtrudeEditDirection").value;
      part.params.distance=distance;
      part.params.direction=feature.parameters.direction;
      part.baseState.params.distance=distance;
      scene.rebuild(part);
      geometrySelection.invalidate(part);
    }else if(feature.type==="FaceExtrude"){
      feature.parameters.distance=Number($("#faceEditDistance").value)||0;feature.parameters.direction=$("#faceEditDirection").value;
    }
    feature.dirty=true;
    feature.rebuildState="dirty";
    const part=featurePart();
    featureTree.markDirtyFrom(part,feature.id);
    rebuildEngine?.markDirty?.(part,feature.id,"feature edited");
    renderFeatureDialog();
    status("Featureを更新しました");
  };
}

function openFeatureDialog(){
  if(!featurePart())return status("部品を選択してください");
  renderFeatureDialog();
  $("#featureDialog").classList.add("show");
}

$("#saveProject").onclick=saveCurrentProject;
$("#openProject").onclick=()=>$("#projectFileInput").click();
$("#newProject").onclick=()=>{if(state.objects.length&&!confirm("現在のプロジェクトを破棄して新規作成しますか？"))return;resetProjectState();status("新規プロジェクトを作成しました。作業台はインベントリから設置できます","command")};
$("#projectFileInput").onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{await loadProjectData(await readProjectFile(file))}catch(error){console.error(error);status(`読み込み失敗: ${error.message}`,"error")}finally{event.target.value=""}};
$("#multiplayerBtn").onclick=openMultiplayerDialog;
$("#multiplayerClose").onclick=()=>$("#multiplayerDialog").classList.remove('show');
$("#multiplayerHost").onclick=()=>{const name=$("#multiplayerPlayerName").value||'Player';state.avatar.name=name;multiplayer.connect({url:rememberRelayUrl(),room:$("#multiplayerRoom").value,name,wantsHost:true,playMode:$('#multiplayerPlayMode').value,team:$('#multiplayerTeam').value})};
$("#multiplayerJoin").onclick=()=>{const name=$("#multiplayerPlayerName").value||'Player';state.avatar.name=name;multiplayer.connect({url:rememberRelayUrl(),room:$("#multiplayerRoom").value,name,wantsHost:false,playMode:$('#multiplayerPlayMode').value,team:$('#multiplayerTeam').value})};
$("#multiplayerDisconnect").onclick=()=>multiplayer.disconnect();
$("#multiplayerQr").onclick=showMultiplayerQr;
$("#multiplayerCopyInvite").onclick=copyMultiplayerInvite;
$("#multiplayerShareInvite").onclick=shareMultiplayerInvite;
$("#multiCarryBtn").onclick=()=>{networkGameplay?.toggleCarrySelected?.();refresh()};
$("#multiAttackBtn").onclick=()=>networkGameplay?.attack?.();
$("#multiRespawnBtn").onclick=()=>networkGameplay?.respawn?.();
$("#multiPilotBtn").onclick=()=>networkGameplay?.boardActiveVehicle?.("pilot");
$("#multiPassengerBtn").onclick=()=>networkGameplay?.boardActiveVehicle?.("passenger");
$("#multiUnboardBtn").onclick=()=>networkGameplay?.unboardVehicle?.();
if($("#vrEnterBtn"))$("#vrEnterBtn").onclick=()=>vrManager?.toggle?.();

$("#multiplayerPublish").onclick=()=>{if(multiplayer.publishNow())multiplayerUiStatus('現在のワールド状態を共有しました','ok');else multiplayerUiStatus('先にルームへ接続してください','error')};
applyMultiplayerInviteFromUrl();

$("#addBox").onclick=()=>state.creator?.enabled&&partPlacementAssist?.enabled?.()?partPlacementAssist.begin("box"):addPart("box");
$("#addCylinder").onclick=()=>state.creator?.enabled&&partPlacementAssist?.enabled?.()?partPlacementAssist.begin("cylinder"):addPart("cylinder");
$("#addSphere").onclick=()=>state.creator?.enabled&&partPlacementAssist?.enabled?.()?partPlacementAssist.begin("sphere"):addPart("sphere");

$("#moveBtn").onclick=()=>openTransform("relative","move");
$("#rotateBtn").onclick=()=>openTransform("relative","rotate");

$("#copyBtn").onclick=()=>{
  status(`${copy(state)}個コピー`);
};

$("#pasteBtn").onclick=()=>{
  const made=paste(state,addPart);
  selection.paint();
  refresh();
  status(`${made.length}個貼付`);
};

$("#groupBtn").onclick=()=>{
  $("#groupDialog").classList.add("show");
};

$("#featureBtn").onclick=openFeatureDialog;
$("#filletBtn").onclick=()=>openEdgeFeature("Fillet");
$("#chamferBtn").onclick=()=>openEdgeFeature("Chamfer");
$("#extrudeFaceBtn").onclick=openFaceExtrude;
$("#defaultChamferBtn").onclick=openDefaultChamfer;
$("#sketchBtn").onclick=openSketchDialog;
$("#sketchExtrudeBtn").onclick=openSketchExtrude;
$("#sketchRevolveBtn").onclick=openSketchRevolve;
$("#partDatumBtn").onclick=openPartDatum;
$("#geometryConstraintBtn").onclick=openGeometryConstraint;
$("#panBtn").onclick=()=>{scene.setPanMode(!scene.panMode);$("#panBtn").classList.toggle("active",scene.panMode);status(scene.panMode?"パンモード: 左ドラッグ / 中・右ドラッグ":"回転モード: 左ドラッグ（パンは中・右ドラッグ）","command")};
$("#booleanBtn").onclick=openBooleanDialog;
$("#mirrorBtn").onclick=()=>openMirrorDialog("mirror");
$("#patternBtn").onclick=openPatternDialog;
$("#brepBtn").onclick=openBRepInspector;
$("#faceKernelBtn").onclick=openFaceKernel;
$("#edgeKernelBtn").onclick=openEdgeKernel;
$("#rebuildBtn").onclick=openRebuildDialog;
$("#historyBtn").onclick=openHistoryDialog;

$("#ungroupBtn").onclick=()=>{
  status(`${ungroup(state)}グループ解除`);
  refresh();
};



function npcById(id){return (state.characters||[]).find(n=>n.id===id)||null}
function npcReply(n,text=''){
  const q=String(text||'').trim(),life=n.life?.state||'idle',v=villageManager?.get?.(n.villageId),occ=n.occupation||n.role||'村人';
  if(/名前|だれ|誰/.test(q))return `私は${n.name}。${occ}をしています。`;
  if(/仕事|何して|働/.test(q))return `私は${occ}です。今は「${life}」の時間です。仕事場と倉庫を行き来しています。`;
  if(/村|ここ|場所/.test(q))return `${v?.name||'この村'}で暮らしています。広場、家、倉庫、工房、市場があります。`;
  if(/家|住/.test(q))return `私の家は村の住宅区画にあります。夜になると家へ帰ります。`;
  if(/好き|趣味/.test(q))return n.role==='farmer'?'畑の様子を見るのが好きですね。':n.role==='blacksmith'?'良い道具が仕上がる瞬間が好きです。':n.role==='merchant'?'珍しい品物と旅人の話が好きです。':'村の人と話す時間は好きですよ。';
  if(/手伝|助け/.test(q))return `ありがとう。信頼できる相手なら、一緒に仕事をしたり仲間として行動したりできます。`;
  const pool=(n.dialogue||[]).filter(Boolean);return pool.length?pool[Math.floor(Math.random()*pool.length)]:`こんにちは。私は${n.name}です。`;
}
function openNpcTalkDialog(npcId){
  const n=npcById(npcId),dlg=document.getElementById('ueNpcTalkDialog');if(!n||!dlg)return;dlg.dataset.npcId=n.id;dlg.classList.add('show');
  const s=villageManager?.ensureRelation?.(n)||n.social||{};dlg.querySelector('#ueNpcTalkTitle').textContent=`💬 ${n.name} / ${n.occupation||n.role||'村人'}`;dlg.querySelector('#ueNpcTalkStatus').textContent=`友好 ${Math.round(s.friendship||0)} / 信頼 ${Math.round(s.trust||0)} / 信仰 ${Math.round(s.faith||0)}　状態: ${n.life?.state||'idle'}`;
  const log=dlg.querySelector('#ueNpcTalkLog');log.innerHTML=`<div><b>${escapeHtml(n.name)}</b>: ${escapeHtml(npcReply(n,'こんにちは'))}</div>`;dlg.querySelector('#ueNpcTalkInput').value='';
}
function sendNpcTalk(text){
  const dlg=document.getElementById('ueNpcTalkDialog'),n=npcById(dlg?.dataset?.npcId);if(!dlg||!n)return;const q=String(text||'').trim();if(!q)return;villageManager?.talk?.(n.id);const log=dlg.querySelector('#ueNpcTalkLog');log.insertAdjacentHTML('beforeend',`<div style="margin-top:8px"><b>${escapeHtml(state.avatar?.name||'Player')}</b>: ${escapeHtml(q)}</div><div><b>${escapeHtml(n.name)}</b>: ${escapeHtml(npcReply(n,q))}</div>`);log.scrollTop=log.scrollHeight;const s=villageManager?.ensureRelation?.(n)||n.social||{};dlg.querySelector('#ueNpcTalkStatus').textContent=`友好 ${Math.round(s.friendship||0)} / 信頼 ${Math.round(s.trust||0)} / 信仰 ${Math.round(s.faith||0)}　状態: ${n.life?.state||'idle'}`;
}
window.addEventListener('ue:npc-interact',e=>openNpcTalkDialog(e.detail?.npcId));

function villageResidents(v){return (v?.residents||[]).map(id=>(state.characters||[]).find(n=>n.id===id)).filter(Boolean)}
function openVillageDialog(villageId=null){
  if(!villageManager)return;let vs=villageManager.list();if(!vs.length){const a=creatorMode?.creationPositionCad?.()||state.avatar?.position||[0,0,0];villageManager.createVillage({name:'開拓村',position:[a[0]+8000,a[1]+5000,a[2]||0],population:9});vs=villageManager.list();}
  const dlg=document.getElementById('ueVillageDialog'),v=villageManager.get(villageId)||vs[0];if(!dlg||!v)return;dlg.dataset.villageId=v.id;dlg.classList.add('show');renderVillageDialog(v.id);
}
function renderVillageDialog(id){
  const dlg=document.getElementById('ueVillageDialog'),v=villageManager?.get(id);if(!dlg||!v)return;dlg.querySelector('#ueVillageTitle').textContent=`🏘 ${v.name}`;
  dlg.querySelector('#ueVillageMode').value=(state.creator?.enabled||state.gameMode==='creator')?'creator':'survival';
  const eco=livingSociety?.economySummary?.(v.id);const rr=eco?.resources||{},gg=eco?.goods||{},pp=eco?.economy?.prices||{},lg=eco?.logistics||{};dlg.querySelector('#ueVillageSummary').textContent=`住民 ${v.residents.length}人 / 建築 ${v.buildingIds.length} / 所有者 ${v.ownerId}　｜　倉庫 🥕${Math.floor(rr.food||0)} 🪵${Math.floor(rr.wood||0)} 🪨${Math.floor(rr.stone||0)} 🔩${Math.floor(rr.iron||0)} 🔧${Math.floor(gg.tools||0)}　｜　価格 食${pp.food||'-'} 木${pp.wood||'-'} 石${pp.stone||'-'} 鉄${pp.iron||'-'} PT　｜　配送 ${Math.floor(lg.delivered||0)} / 店補充 ${Math.floor(lg.shopTransfers||0)} / 🛒荷車 ${Math.floor(lg.cartTrips||0)} / 村間交易 ${Math.floor(lg.interVillageTransfers||0)}　｜　工房待ち ${eco?.economy? (v.industry?.workshopQueue?.length||0):0} / 関税 ${Math.round((eco?.economy?.tariffRate||0)*100)}% / 通貨 ${eco?.currency?.code||'PT'} ×${Number(eco?.currency?.exchangeToPT||1).toFixed(2)}`;
  const rows=villageResidents(v).map(n=>{const s=villageManager.ensureRelation(n);const rts=!!n.rtsControlAllowed,comp=!!s.companion;return `<div class="ueShopItem"><div><b>${escapeHtml(n.name)}</b> <span class="ueShopMeta">${escapeHtml(n.occupation||n.role||'村人')}</span></div><div class="ueShopMeta">友好 ${Math.round(s.friendship)} / 信頼 ${Math.round(s.trust)} / 信仰 ${Math.round(s.faith)} ${s.family?' / 🏠家族':comp?' / 🤝仲間':''}</div><div class="ueShopMeta">❤️ ${Math.round(n.vitals?.hp??100)}/${Math.round(n.vitals?.maxHp??100)}　年齢 ${Math.floor(n.vitals?.ageYears??0)} / 寿命 ${Math.floor(n.vitals?.lifeExpectancyYears??0)}　🧠知力 ${Math.round(n.mind?.intelligence??0)} / 記憶 ${n.mind?.learnedCommands?.length||0}/${n.mind?.commandCapacity||0}　💰 ${Math.round(n.assets?.cash||0)}PT　${escapeHtml(n.life?.state||'idle')}${n.life?.cargo?.qty?`　📦${escapeHtml(n.life.cargo.resource)}×${n.life.cargo.qty}`:''}</div><div class="row"><button data-vact="talk" data-npc="${n.id}">💬会話</button><button data-vact="gift" data-npc="${n.id}">🎁贈物</button><button data-vact="event" data-npc="${n.id}">🎉イベント</button><button data-vact="control" data-npc="${n.id}" ${comp?'':'disabled'}>🎮操作</button><button data-vact="rts" data-npc="${n.id}" ${rts?'':'disabled'}>🖱RTS</button><button data-vact="family" data-npc="${n.id}" ${s.familyEligible&&!s.family?'':'disabled'}>🏠家族</button></div></div>`}).join('');
  dlg.querySelector('#ueVillageResidents').innerHTML=rows||'<div class="help">住民なし</div>';
  dlg.querySelectorAll('[data-vact]').forEach(b=>b.onclick=()=>{try{const id=b.dataset.npc,a=b.dataset.vact;if(a==='talk'){openNpcTalkDialog(id);return;}if(a==='gift')villageManager.gift(id,12);if(a==='event')villageManager.event(id,'festival');if(a==='family')villageManager.makeFamily(id);if(a==='control'){villageManager.directControl(id);avatarManager?.build?.();avatarManager?.sync?.();}if(a==='rts')villageManager.command(id,'FOLLOW',state.avatar?.position||null);renderVillageDialog(v.id);refresh()}catch(e){status(e.message||String(e),'error')}});
}
window.addEventListener('ue:open-village',e=>openVillageDialog(e.detail?.villageId||null));
setInterval(()=>{try{if(!document.hidden&&state.characters?.length)refresh()}catch{}},1500);

const ribbonIcons={creatorModeBtn:"🎨",scaleWorkbenchBtn:"∞",outsideBtn:"⇱",scaleInBtn:"＋",scaleOutBtn:"−",avatarFpvBtn:"👁",anchorBtn:"⚓",editMoveBtn:"✒",avatarWalkBtn:"🚶",newProject:"📄",openProject:"📂",saveProject:"💾",addBox:"▣",addCylinder:"◉",addSphere:"●",moveBtn:"↔",rotateBtn:"⟳",copyBtn:"⧉",pasteBtn:"▣",groupBtn:"⌘",ungroupBtn:"⌫",featureBtn:"ƒ",filletBtn:"⌒",chamferBtn:"⌞",extrudeFaceBtn:"⇧",defaultChamferBtn:"C",sketchBtn:"✎",sketchExtrudeBtn:"⇧",sketchRevolveBtn:"⟳",panBtn:"✥",partDatumBtn:"⌖",geometryConstraintBtn:"⊥",booleanBtn:"∩",mirrorBtn:"⇋",patternBtn:"▦",brepBtn:"B",faceKernelBtn:"□",edgeKernelBtn:"—",rebuildBtn:"↻",historyBtn:"◷",deleteBtn:"⌫",fitBtn:"◎",leftToggle:"☰",rightToggle:"⚙",settingsBtn:"⚙",multiplayerBtn:"🌐",villageBtn:"🏘",workspaceBtn:"⌂",physicsBtn:"⚛",createDocumentBtn:"📄",createNodeBtn:"◫",generatorBtn:"🎲",characterBtn:"人",jointEditorBtn:"☊",lifeBtn:"♡",buildingAssistBtn:"🏗",surfacePaintBtn:"🎨",recipeBtn:"📘",holdRightBtn:"✋",holdLeftBtn:"🤚",dropHandBtn:"⬇"};
for(const button of document.querySelectorAll('.top button')){const name=button.textContent.trim();button.dataset.tooltip=name;button.title=name;const icon=ribbonIcons[button.id]||({body:'◆',face:'□',edge:'—',vertex:'•'}[button.dataset.mode]||'•');button.innerHTML=`<span class="ribbonIcon">${icon}</span>`;}

function setPanelCollapsed(side,collapsed){const workspace=$("#workspace");workspace.classList.toggle(side+"Collapsed",collapsed);requestAnimationFrame(()=>scene.resize());}
$("#expandLeftHandle")?.addEventListener("click",()=>setPanelCollapsed("left",false));$("#expandRightHandle")?.addEventListener("click",()=>setPanelCollapsed("right",false));
$("#collapseLeft").onclick=()=>setPanelCollapsed("left",true);$("#collapseRight").onclick=()=>setPanelCollapsed("right",true);
$("#propertyModeProperties")?.addEventListener("click",()=>{if(propertyPanelMode==="transform"&&state.transformSnapshot){transform.apply(transformValues());transform.clear();}setPropertyPanelMode("properties");refresh();});
$("#propertyModeTransform")?.addEventListener("click",()=>{if(!state.selectedObjects().length)return status("変形する部品を選択してください","error");transform.mode=transform.mode||"relative";setPropertyPanelMode("transform",{capture:true});status("プロパティ: 変形モード","command");});
$("#leftToggle").onclick=()=>{const w=$("#workspace");if(w.classList.contains("leftCollapsed"))setPanelCollapsed("left",false);else $("#leftPanel").classList.toggle("show")};
$("#rightToggle").onclick=()=>{const w=$("#workspace");if(w.classList.contains("rightCollapsed"))setPanelCollapsed("right",false);else $("#rightPanel").classList.toggle("show")};

// v5.12.9 Floating Universal Dial: shared by properties, time and Creator Scale.
const universalDialState={kind:null,element:null,label:'数値を選択',unit:'',getter:null,setter:null,lastAngle:null};
function universalDialDigits(step){step=Math.abs(Number(step)||1);return Math.max(0,Math.min(6,Math.ceil(-Math.log10(step))));}
function syncUniversalDial(){const name=$("#globalDialTargetName"),value=$("#globalDialTargetValue"),unit=$("#globalDialTargetUnit");if(name)name.textContent=universalDialState.label||'数値を選択';if(unit)unit.textContent=universalDialState.unit||'';let v=null;if(universalDialState.kind==='element'&&universalDialState.element?.isConnected)v=universalDialState.element.value;else if(universalDialState.getter)v=universalDialState.getter();if(value)value.textContent=v==null?'—':(typeof v==='number'&&Number.isFinite(v)?Number(v.toFixed(6)).toString():String(v));}
function setUniversalDialElement(el,label,unit){if(!el)return;universalDialState.kind='element';universalDialState.element=el;universalDialState.getter=null;universalDialState.setter=null;universalDialState.label=label||el.dataset?.label||el.dataset?.key||'数値';universalDialState.unit=unit??el.dataset?.unit??'';syncUniversalDial();}
function setUniversalDialVirtual(label,unit,getter,setter){universalDialState.kind='virtual';universalDialState.element=null;universalDialState.label=label;universalDialState.unit=unit;universalDialState.getter=getter;universalDialState.setter=setter;syncUniversalDial();}
function nudgeUniversalDial(direction){const step=Number($("#globalDialStep")?.value)||1;if(universalDialState.kind==='element'){const el=universalDialState.element;if(!el?.isConnected)return;const next=(Number(el.value)||0)+direction*step;el.value=Number(next.toFixed(universalDialDigits(step)));el.dispatchEvent(new Event('input',{bubbles:true}));syncUniversalDial();return;}if(universalDialState.setter&&universalDialState.getter){const next=(Number(universalDialState.getter())||0)+direction*step;universalDialState.setter(next);syncUniversalDial();refresh();}}
window.addEventListener('ue:universal-dial-target',e=>setUniversalDialElement(e.detail?.element,e.detail?.label,e.detail?.unit));
window.addEventListener('ue:universal-dial-sync',e=>{if(e.detail?.element===universalDialState.element)syncUniversalDial()});
window.addEventListener('ue:universal-dial-nudge',e=>nudgeUniversalDial(Number(e.detail?.direction)||0));
$("#globalDialMinus")?.addEventListener('click',()=>nudgeUniversalDial(-1));$("#globalDialPlus")?.addEventListener('click',()=>nudgeUniversalDial(1));
$("#globalDialCollapse")?.addEventListener('click',()=>{const panel=$("#universalDialOverlay");panel.classList.toggle('collapsed');$("#globalDialCollapse").textContent=panel.classList.contains('collapsed')?'▾':'▴'});
for(const b of document.querySelectorAll('[data-global-dial-quick]'))b.addEventListener('click',()=>{const target=b.dataset.globalDialQuick;if(target==='time')setUniversalDialVirtual('時間','h',()=>Number(state.planet.simTimeHours)||0,v=>{state.planet.simTimeHours=v});else if(target==='timeScale')setUniversalDialVirtual('時間倍率','×',()=>Number(state.planet.timeScale)||1,v=>{state.planet.timeScale=Math.max(0,v)});else if(target==='creatorScale')setUniversalDialVirtual('Creator Scale','mm/unit',()=>Number(state.creator?.scaleMm)||1,v=>{v=Math.max(.001,v);creatorMode?.setScaleMm?.(v);creatorMode?.setScale?.(v);state.creator.scaleMm=v;updateScaleHud()});});
const globalDial=$("#globalUniversalDial");
globalDial?.addEventListener('pointerdown',e=>{globalDial.setPointerCapture(e.pointerId);const r=globalDial.getBoundingClientRect();universalDialState.lastAngle=Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2));});
globalDial?.addEventListener('pointermove',e=>{if(universalDialState.lastAngle==null||!globalDial.hasPointerCapture(e.pointerId))return;const r=globalDial.getBoundingClientRect(),a=Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2)),diff=Math.atan2(Math.sin(a-universalDialState.lastAngle),Math.cos(a-universalDialState.lastAngle));if(Math.abs(diff)>.025){nudgeUniversalDial(diff>0?1:-1);universalDialState.lastAngle=a;globalDial.style.setProperty('--dial-angle',`${a}rad`);}});
globalDial?.addEventListener('pointerup',()=>universalDialState.lastAngle=null);globalDial?.addEventListener('pointercancel',()=>universalDialState.lastAngle=null);globalDial?.addEventListener('wheel',e=>{e.preventDefault();nudgeUniversalDial(e.deltaY<0?1:-1)},{passive:false});

function installSplitter(id,side){const splitter=$(id);splitter.addEventListener('pointerdown',e=>{splitter.classList.add('dragging');splitter.setPointerCapture(e.pointerId);const move=ev=>{const rect=$("#workspace").getBoundingClientRect();const value=side==='left'?ev.clientX-rect.left:rect.right-ev.clientX;document.documentElement.style.setProperty(side==='left'?'--left-width':'--right-width',`${Math.max(150,Math.min(600,value))}px`);scene.resize()};const up=()=>{splitter.classList.remove('dragging');splitter.removeEventListener('pointermove',move);splitter.removeEventListener('pointerup',up)};splitter.addEventListener('pointermove',move);splitter.addEventListener('pointerup',up)});}
installSplitter('#leftSplitter','left');installSplitter('#rightSplitter','right');

$$('.transformTool').forEach(button=>button.onclick=()=>{$$('.transformTool').forEach(b=>b.classList.toggle('active',b===button));$('#transformControls').dataset.tool=button.dataset.tool;});

function applyDirectTransform(tool,values,absolute=false){
  if(!state.selectedObjects().length)return status("部品を選択してください","error");
  openTransform(absolute?"absolute":"relative");$("#transformControls").dataset.tool=tool;transform.mode=absolute?"absolute":"relative";
  const keys=tool==="move"?["px","py","pz"]:tool==="rotate"?["rx","ry","rz"]:["sx","sy","sz"];
  keys.forEach((key,i)=>{const input=$("#"+key);if(input)input.value=Number(values[i]??(tool==="scale"?1:0))});
  transform.apply(transformValues());transform.clear();setPropertyPanelMode("properties");refresh();
  status(`${absolute?"ABS ":""}${tool.toUpperCase()} ${values.map(v=>Number(v)).join(", ")}`,"command");
}

let pendingSurfacePaintImage=null,pendingSurfaceMediaData=null,pendingSurfaceMediaMime="";
function youtubeId(url){const raw=String(url||"").trim();if(/^[A-Za-z0-9_-]{11}$/.test(raw))return raw;try{const u=new URL(raw,location.href),h=u.hostname.replace(/^www\./,"");if(h==="youtu.be")return u.pathname.split("/").filter(Boolean)[0]||"";if(/(^|\.)youtube(?:-nocookie)?\.com$/.test(h)){const q=u.searchParams.get("v");if(q)return q;const parts=u.pathname.split("/").filter(Boolean);const i=parts.findIndex(x=>["embed","shorts","live"].includes(x));if(i>=0)return parts[i+1]||""}}catch{}const m=raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{6,})/);return m?m[1]:""}
function vimeoId(url){const raw=String(url||'').trim();if(/^\d{6,12}$/.test(raw))return raw;try{const u=new URL(raw,location.href),h=u.hostname.replace(/^www\./,'');if(h==='vimeo.com'||h.endsWith('.vimeo.com')){const parts=u.pathname.split('/').filter(Boolean);return (parts.findLast?.(x=>/^\d+$/.test(x))||parts.reverse().find(x=>/^\d+$/.test(x))||'')}}catch{}const m=raw.match(/vimeo\.com\/(?:.*\/)?(\d{6,12})/);return m?m[1]:''}
function embedInfo(type,url){type=String(type||'').toLowerCase();url=String(url||'').trim();if(type==='youtube'){const id=youtubeId(url);return id?{provider:'youtube',id}:null}if(type==='vimeo'){const id=vimeoId(url);return id?{provider:'vimeo',id}:null}if(type==='embed'){try{const u=new URL(url,location.href);if(!/^https?:$/.test(u.protocol))return null;return {provider:'embed',url:u.href}}catch{return null}}return null}

const mediaDevicePlayers=new Map();
function mediaCarrierItems(){return (state.inventory?.items||[]).filter(i=>i.stats?.mediaCarrier)}
function mediaPlayerPart(part=state.primary?.()){return part?.metadata?.mediaPlayer?.enabled?part:null}
function mediaProviderFromUrl(url=''){if(youtubeId(url))return'youtube';if(vimeoId(url))return'vimeo';try{const u=new URL(url,location.href);if(/\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test(u.pathname))return'audio';return'embed'}catch{return'audio'}}
function stopMediaDevice(part){if(!part)return false;const e=mediaDevicePlayers.get(part.id);if(e){try{e.audio?.pause?.();if(e.iframe)e.iframe.src='about:blank';e.host?.remove?.()}catch{}mediaDevicePlayers.delete(part.id)}if(part.metadata?.mediaPlayer)part.metadata.mediaPlayer.playing=false;return true}
function controlMediaDevice(part,action){const e=mediaDevicePlayers.get(part?.id);if(!e)return false;try{if(e.audio){if(action==='pause')e.audio.pause();else if(action==='play')e.audio.play().catch(()=>{});return true}const f=e.iframe?.contentWindow;if(!f)return false;if(e.provider==='youtube')f.postMessage(JSON.stringify({event:'command',func:action==='pause'?'pauseVideo':'playVideo',args:[]}),'*');else if(e.provider==='vimeo')f.postMessage({method:action==='pause'?'pause':'play'},'*');return true}catch{return false}}
function startMediaDevice(part,carrier){if(!part||!carrier)return false;stopMediaDevice(part);const mp=part.metadata.mediaPlayer||(part.metadata.mediaPlayer={enabled:true}),url=String(carrier.stats?.mediaUrl||'').trim();if(!url)return status('CD / レコードに音源URLを登録してください','error'),false;const provider=mediaProviderFromUrl(url),loop=mp.loop!==false,volume=Math.max(0,Math.min(1,Number(mp.volume)||.8));let entry={part,carrier,provider,lastVolume:-1,lastUpdate:0};if(provider==='audio'){const a=new Audio(url);a.loop=loop;a.volume=0;a.preload='auto';entry.audio=a;a.play().catch(()=>status('ブラウザの再生許可が必要です。もう一度▶再生を押してください','info'))}else{const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'-4px',top:'-4px',width:'2px',height:'2px',overflow:'hidden',opacity:'0.01',pointerEvents:'none'});const f=document.createElement('iframe');f.allow='autoplay; encrypted-media';f.style.width='1px';f.style.height='1px';f.style.border='0';const yt=youtubeId(url),vm=vimeoId(url),origin=location.protocol.startsWith('http')?`&origin=${encodeURIComponent(location.origin)}`:'';if(provider==='youtube')f.src=`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=0&loop=${loop?1:0}&playlist=${yt}&playsinline=1&controls=0&enablejsapi=1${origin}`;else if(provider==='vimeo')f.src=`https://player.vimeo.com/video/${vm}?autoplay=1&muted=0&loop=${loop?1:0}&background=1`;else f.src=url;host.appendChild(f);document.body.appendChild(host);entry.host=host;entry.iframe=f}
mediaDevicePlayers.set(part.id,entry);mp.carrierItemId=carrier.id;mp.mediaTitle=carrier.stats?.mediaTitle||carrier.name;mp.mediaUrl=url;mp.provider=provider;mp.playing=true;status(`📻 ${mp.mediaTitle} を再生`,'command');return true}
function updateMediaDeviceSpatialAudio(){const now=performance.now();for(const [id,e] of [...mediaDevicePlayers]){const part=e.part;if(!part?.mesh?.parent){stopMediaDevice(part);continue}if(now-(e.lastUpdate||0)<120)continue;e.lastUpdate=now;const mp=part.metadata?.mediaPlayer||{},pos=new THREE.Vector3();part.mesh.getWorldPosition(pos);const mmPerUnit=Math.max(1e-9,Number(state.workspace?.unitScaleMm)||10),d=scene.camera.position.distanceTo(pos)*mmPerUnit,ref=Math.max(100,Number(mp.audioRefDistanceMm)||1800),max=Math.max(ref+100,Number(mp.audioMaxDistanceMm)||25000),roll=Math.max(.1,Number(mp.audioRolloff)||1.35),edge=d>=max?0:d<=ref?1:(1/(1+roll*(d/ref-1)))*Math.sqrt(Math.max(0,(max-d)/(max-ref))),v=Math.max(0,Math.min(1,(Number(mp.volume)||.8)*edge));if(Math.abs(v-(e.lastVolume??-1))<.02)continue;e.lastVolume=v;try{if(e.audio)e.audio.volume=v;else if(e.provider==='youtube')e.iframe.contentWindow?.postMessage(JSON.stringify({event:'command',func:'setVolume',args:[Math.round(v*100)]}),'*');else if(e.provider==='vimeo')e.iframe.contentWindow?.postMessage({method:'setVolume',value:v},'*')}catch{}}}
scene.addLoopHook?.(()=>updateMediaDeviceSpatialAudio());
function renderMediaPlayerDialog(part=null,preferredItemId=null){const target=mediaPlayerPart(part)||mediaPlayerPart(state.primary?.());const carriers=mediaCarrierItems(),sel=$("#mediaCarrierSelect");sel.innerHTML=carriers.length?carriers.map(i=>`<option value="${escapeHtml(i.id)}">${escapeHtml(i.icon||'💿')} ${escapeHtml(i.stats?.mediaTitle||i.name)}</option>`).join(''):'<option value="">CD / レコードがありません</option>';if(preferredItemId&&carriers.some(i=>i.id===preferredItemId))sel.value=preferredItemId;else if(target?.metadata?.mediaPlayer?.carrierItemId&&carriers.some(i=>i.id===target.metadata.mediaPlayer.carrierItemId))sel.value=target.metadata.mediaPlayer.carrierItemId;$("#mediaPlayerTarget").textContent=target?`${target.name} (${target.id})`:'メディアのみ編集（プレイヤー未選択）';const mp=target?.metadata?.mediaPlayer||{};$("#mediaPlayerVolume").value=Number(mp.volume)||.8;$("#mediaPlayerLoop").checked=mp.loop!==false;$("#mediaPlayerRefDistance").value=Number(mp.audioRefDistanceMm)||1800;$("#mediaPlayerMaxDistance").value=Number(mp.audioMaxDistanceMm)||25000;const fill=()=>{const item=mediaCarrierItems().find(i=>i.id===sel.value);$("#mediaCarrierTitle").value=item?.stats?.mediaTitle||item?.name||'';$("#mediaCarrierUrl").value=item?.stats?.mediaUrl||''};sel.onchange=fill;fill();$("#mediaPlayerDialog").dataset.partId=target?.id||'';$("#mediaPlayerDialog").classList.add('show')}
window.addEventListener('ue:media-carrier-open',e=>renderMediaPlayerDialog(null,e.detail?.itemId));window.addEventListener('ue:media-player-placed',e=>{const p=(state.objects||[]).find(o=>o.id===e.detail?.partId);if(p)renderMediaPlayerDialog(p)});
if($("#mediaPlayerBtn"))$("#mediaPlayerBtn").onclick=()=>{const p=mediaPlayerPart();if(!p)return status('メディアプレイヤーを選択してください','error');renderMediaPlayerDialog(p)};
if($("#mediaCarrierSave"))$("#mediaCarrierSave").onclick=()=>{const item=mediaCarrierItems().find(i=>i.id===$("#mediaCarrierSelect").value);if(!item)return;item.stats=item.stats||{};item.stats.mediaTitle=$("#mediaCarrierTitle").value.trim()||item.name;item.stats.mediaUrl=$("#mediaCarrierUrl").value.trim();item.stats.provider=mediaProviderFromUrl(item.stats.mediaUrl);status(`${item.icon||'💿'} ${item.stats.mediaTitle} に音源を保存`,'command');renderMediaPlayerDialog(mediaPlayerPart((state.objects||[]).find(o=>o.id===$("#mediaPlayerDialog").dataset.partId)),item.id)};
if($("#mediaPlayerLoad"))$("#mediaPlayerLoad").onclick=()=>{const part=(state.objects||[]).find(o=>o.id===$("#mediaPlayerDialog").dataset.partId),item=mediaCarrierItems().find(i=>i.id===$("#mediaCarrierSelect").value);if(!part)return status('再生するメディアプレイヤーを選択してください','error');if(!item)return status('CD / レコードを選択してください','error');item.stats.mediaTitle=$("#mediaCarrierTitle").value.trim()||item.name;item.stats.mediaUrl=$("#mediaCarrierUrl").value.trim();const mp=part.metadata.mediaPlayer;mp.volume=Number($("#mediaPlayerVolume").value)||0;mp.loop=$("#mediaPlayerLoop").checked;mp.audioRefDistanceMm=Math.max(100,Number($("#mediaPlayerRefDistance").value)||1800);mp.audioMaxDistanceMm=Math.max(500,Number($("#mediaPlayerMaxDistance").value)||25000);startMediaDevice(part,item)};
if($("#mediaPlayerPause"))$("#mediaPlayerPause").onclick=()=>{const p=(state.objects||[]).find(o=>o.id===$("#mediaPlayerDialog").dataset.partId);controlMediaDevice(p,'pause');if(p?.metadata?.mediaPlayer)p.metadata.mediaPlayer.playing=false};if($("#mediaPlayerResume"))$("#mediaPlayerResume").onclick=()=>{const p=(state.objects||[]).find(o=>o.id===$("#mediaPlayerDialog").dataset.partId);if(!controlMediaDevice(p,'play')){const c=mediaCarrierItems().find(i=>i.id===p?.metadata?.mediaPlayer?.carrierItemId);if(p&&c)startMediaDevice(p,c)}if(p?.metadata?.mediaPlayer)p.metadata.mediaPlayer.playing=true};if($("#mediaPlayerEject"))$("#mediaPlayerEject").onclick=()=>{const p=(state.objects||[]).find(o=>o.id===$("#mediaPlayerDialog").dataset.partId);stopMediaDevice(p);if(p?.metadata?.mediaPlayer){p.metadata.mediaPlayer.carrierItemId=null;p.metadata.mediaPlayer.mediaUrl='';p.metadata.mediaPlayer.mediaTitle=''}status('⏏ メディアを取り出しました','command')};if($("#mediaPlayerClose"))$("#mediaPlayerClose").onclick=()=>$("#mediaPlayerDialog").classList.remove('show');
function openSurfaceArtEditor(o=state.primary?.()){if(!o)return status("壁・モデルを選択してください","error");const art=o.metadata?.surfaceArt||{};$("#surfacePaintBg").value=art.background||"#d8d0c2";$("#surfacePaintTextColor").value=art.textColor||"#111111";$("#surfacePaintText").value=art.text||"";$("#surfaceMediaType").value=art.mediaType||"image";$("#surfaceMediaUrl").value=art.mediaUrl||"";$("#surfaceMediaWallPlayback").checked=art.wallPlayback!==false;$("#surfaceMediaLoop").checked=art.loop!==false;$("#surfaceMediaAutoplay").checked=art.autoplay!==false;$("#surfaceMediaMuted").checked=art.muted!==false;$("#surfaceMediaVolume").value=Number.isFinite(Number(art.volume))?art.volume:.7;$("#surfaceMediaStart").value=Math.max(0,Number(art.startSeconds)||0);$("#surfaceMediaEnd").value=Math.max(0,Number(art.endSeconds)||0);$("#surfaceMediaRotation").value=String([0,90,180,270].includes(Number(art.rotationDeg))?Number(art.rotationDeg):180);$("#surfaceMediaAutoRotation").checked=art.autoRotation!==false;$("#surfaceSpatialAudio").checked=art.spatialAudio!==false;$("#surfaceAudioRefDistance").value=Math.max(100,Number(art.audioRefDistanceMm)||2000);$("#surfaceAudioMaxDistance").value=Math.max(500,Number(art.audioMaxDistanceMm)||30000);$("#surfaceAudioRolloff").value=Math.max(.1,Number(art.audioRolloff)||1.35);$("#surfaceLightMode").value=art.lightMode||"none";$("#surfaceLightColor").value=art.lightColor||"#fff1c4";$("#surfaceLightIntensity").value=Number(art.lightIntensity)||2.5;pendingSurfacePaintImage=art.imageDataUrl||null;pendingSurfaceMediaData=art.mediaDataUrl||null;pendingSurfaceMediaMime=art.mediaMime||"";$("#surfacePaintDialog").classList.add("show")};if($("#surfacePaintBtn"))$("#surfacePaintBtn").onclick=()=>openSurfaceArtEditor();
if($("#surfacePaintImage"))$("#surfacePaintImage").onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{const data=String(r.result||"");pendingSurfaceMediaData=data;pendingSurfaceMediaMime=f.type||"";if((f.type||"").startsWith("image/"))pendingSurfacePaintImage=data;if(f.type==="image/gif")$("#surfaceMediaType").value="gif";else if((f.type||"").startsWith("video/"))$("#surfaceMediaType").value="video";else if((f.type||"").startsWith("audio/"))$("#surfaceMediaType").value="audio";else if((f.type||"").startsWith("image/"))$("#surfaceMediaType").value="image"};r.readAsDataURL(f)};
if($("#surfacePaintApply"))$("#surfacePaintApply").onclick=()=>{const o=state.primary?.();if(!o)return;const mediaType=$("#surfaceMediaType").value,mediaUrl=$("#surfaceMediaUrl").value.trim(),embed=embedInfo(mediaType,mediaUrl),yt=mediaType==="youtube"?(embed?.id||""):"",vm=mediaType==="vimeo"?(embed?.id||""):"";if(["youtube","vimeo","embed"].includes(mediaType)&&!embed)return status("動画サイトURL / 埋め込みURLを確認してください","error");o.metadata=o.metadata||{};o.metadata.surfaceArt={background:$("#surfacePaintBg").value,textColor:$("#surfacePaintTextColor").value,text:$("#surfacePaintText").value,imageDataUrl:pendingSurfacePaintImage||"",mediaType,mediaUrl,mediaDataUrl:pendingSurfaceMediaData||"",mediaMime:pendingSurfaceMediaMime||"",wallPlayback:$("#surfaceMediaWallPlayback").checked,loop:$("#surfaceMediaLoop").checked,autoplay:$("#surfaceMediaAutoplay").checked,muted:$("#surfaceMediaMuted").checked,volume:Number($("#surfaceMediaVolume").value)||0,startSeconds:Math.max(0,Number($("#surfaceMediaStart").value)||0),endSeconds:Math.max(0,Number($("#surfaceMediaEnd").value)||0),rotationDeg:[0,90,180,270].includes(Number($("#surfaceMediaRotation").value))?Number($("#surfaceMediaRotation").value):180,autoRotation:$("#surfaceMediaAutoRotation").checked,autoResolvedRotationDeg:[0,90,180,270].includes(Number($("#surfaceMediaRotation").value))?Number($("#surfaceMediaRotation").value):180,spatialAudio:$("#surfaceSpatialAudio").checked,audioRefDistanceMm:Math.max(100,Number($("#surfaceAudioRefDistance").value)||2000),audioMaxDistanceMm:Math.max(500,Number($("#surfaceAudioMaxDistance").value)||30000),audioRolloff:Math.max(.1,Number($("#surfaceAudioRolloff").value)||1.35),lightMode:$("#surfaceLightMode").value,lightColor:$("#surfaceLightColor").value,lightIntensity:Number($("#surfaceLightIntensity").value)||0,youtubeId:yt,vimeoId:vm,embedUrl:mediaType==="embed"?(embed?.url||""):"",purpose:"signage-advertising-media-ready"};scene.sync(o);refresh();status(["youtube","vimeo","embed"].includes(mediaType)?"壁面動画を更新：壁内再生＋クリップ表示":"壁面メディア / ライト設定を適用","command")};
if($("#surfaceMediaPlay"))$("#surfaceMediaPlay").onclick=()=>{const part=state.primary?.(),art=part?.metadata?.surfaceArt;if(!art)return;const type=art.mediaType||"image",host=$("#surfaceMediaPlayerHost");if(host)host.replaceChildren();if(["youtube","vimeo","embed"].includes(type)&&art.mediaUrl){const info=embedInfo(type,art.mediaUrl);if(info&&host){const iframe=document.createElement("iframe");iframe.width="100%";iframe.height="100%";iframe.allow="autoplay; encrypted-media; picture-in-picture";iframe.allowFullscreen=true;const start=Math.max(0,Number(art.startSeconds)||0),end=Math.max(0,Number(art.endSeconds)||0),loop=art.loop!==false,muted=art.muted!==false;if(type==="youtube"){const originParam=location.protocol.startsWith("http")?`&origin=${encodeURIComponent(location.origin)}`:"",endParam=end>start?`&end=${Math.floor(end)}`:"";iframe.src=`https://www.youtube-nocookie.com/embed/${info.id}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&mute=${muted?1:0}&loop=${loop?1:0}&playlist=${encodeURIComponent(info.id)}&start=${Math.floor(start)}${endParam}${originParam}`}else if(type==="vimeo")iframe.src=`https://player.vimeo.com/video/${info.id}?autoplay=1&muted=${muted?1:0}&loop=${loop?1:0}`;else iframe.src=info.url;iframe.referrerPolicy="strict-origin-when-cross-origin";iframe.style.border="0";host.appendChild(iframe);$("#surfaceMediaPlayerDialog")?.classList.add("show");return}window.open(art.mediaUrl,"_blank","noopener");return}const src=art.mediaDataUrl||art.mediaUrl||art.imageDataUrl||"";if((type==="video"||type==="audio"||type==="music")&&src&&host){const el=document.createElement(type==="video"?"video":"audio");el.src=src;el.controls=true;el.autoplay=true;el.loop=art.loop!==false;el.volume=Math.max(0,Math.min(1,Number(art.volume)||0));if(type==="video"){el.style.width="100%";el.style.height="100%";el.style.objectFit="contain"}host.appendChild(el);$("#surfaceMediaPlayerDialog")?.classList.add("show");el.play().catch(()=>{});return}const el=part?.mesh?.userData?.surfaceMediaElement;if(el){el.volume=Math.max(0,Math.min(1,Number(art.volume)||0));el.paused?el.play().catch(()=>{}):el.pause();status(el.paused?"メディア停止":"メディア再生","command")}else status("壁面表示を更新しました","command")};
$("#surfaceMediaPause")?.addEventListener("click",()=>{const p=state.primary?.();if(scene?.controlWallMedia?.(p,"pause"))status("壁面動画を一時停止","command")});
$("#surfaceMediaResume")?.addEventListener("click",()=>{const p=state.primary?.();if(scene?.controlWallMedia?.(p,"play"))status("壁面動画を再生","command")});
$("#surfaceMediaMuteToggle")?.addEventListener("click",()=>{const p=state.primary?.();if(scene?.controlWallMedia?.(p,"muteToggle"))status("壁面動画のミュートを切替","command")});
$("#surfaceMediaPlayerClose")?.addEventListener("click",()=>{const host=$("#surfaceMediaPlayerHost");if(host){host.querySelectorAll("video,audio").forEach(el=>el.pause?.());host.replaceChildren()}closeDialog("#surfaceMediaPlayerDialog")});
if($("#surfacePaintClear"))$("#surfacePaintClear").onclick=()=>{const o=state.primary?.();if(!o)return;if(o.metadata)delete o.metadata.surfaceArt;pendingSurfacePaintImage=null;pendingSurfaceMediaData=null;pendingSurfaceMediaMime="";scene.sync(o);refresh();status("壁面メディアを消去","command")};
if($("#surfacePaintClose"))$("#surfacePaintClose").onclick=()=>closeDialog("#surfacePaintDialog");
window.addEventListener("ue:smartphone-open",()=>$("#smartphoneDialog")?.classList.add("show"));
$("#smartphoneClose")?.addEventListener("click",()=>closeDialog("#smartphoneDialog"));
$("#phoneInventoryBtn")?.addEventListener("click",()=>{closeDialog("#smartphoneDialog");mobileGameUI?.openInventory?.()||$("#mobileInventoryDialog")?.classList.add("show")});
$("#phoneCraftBtn")?.addEventListener("click",()=>{closeDialog("#smartphoneDialog");$("#mobileCraftDialog")?.classList.add("show");mobileGameUI?.render?.()});
$("#phoneMultiBtn")?.addEventListener("click",()=>{closeDialog("#smartphoneDialog");$("#multiplayerDialog")?.classList.add("show")});
$("#phoneMediaBtn")?.addEventListener("click",()=>{closeDialog("#smartphoneDialog");$("#surfacePaintDialog")?.classList.add("show")});
$("#buildingAssistClose").onclick=()=>closeDialog("#buildingAssistDialog");
$("#buildingAssistApply").onclick=()=>{readBuildingAssistDialog();status(`Building Assist ${state.buildingAssist.mode}`,'command')};
$("#buildingColumnLine").onclick=()=>{const c=readBuildingAssistDialog(),made=buildingAssist.createColumnLine(c);refresh();status(`柱直線配置 ${made.length}本`,'command')};
$("#buildingColumnGrid").onclick=()=>{const c=readBuildingAssistDialog(),made=buildingAssist.createColumnGrid({cols:c.columnCount,rows:c.columnRows,spacingX:c.columnSpacing,spacingY:c.columnSpacingY});refresh();status(`柱矩形配置 ${made.length}本`,'command')};
$("#buildingBrickWall").onclick=()=>{const c=readBuildingAssistDialog(),made=buildingAssist.createBrickWall({length:Number($("#buildingBrickWallLength").value)||3000,height:Number($("#buildingBrickWallHeight").value)||1700,axis:c.axis});refresh();status(`レンガ積み ${made.length}個`,'command')};
$("#buildingWallFit").onclick=()=>{try{readBuildingAssistDialog();const made=buildingAssist.wallBetweenSelected();refresh();status(`壁自動フィット ${made.length}枚`,'command')}catch(e){status(e.message,'error')}};
$("#buildingWallPerimeter").onclick=()=>{try{readBuildingAssistDialog();const made=buildingAssist.wallPerimeterFromSelection();refresh();status(`外周壁 ${made.length}枚`,'command')}catch(e){status(e.message,'error')}};
$("#buildingFloorFit").onclick=()=>{try{readBuildingAssistDialog();buildingAssist.floorFromSelection();refresh();status('床自動フィット','command')}catch(e){status(e.message,'error')}};
$("#buildingRoofFit").onclick=()=>{try{readBuildingAssistDialog();buildingAssist.roofFromSelection();refresh();status('屋根自動フィット','command')}catch(e){status(e.message,'error')}};
$("#buildingSmartCreate").onclick=()=>{try{readBuildingAssistDialog();const made=buildingAssist.createSmartBuilding({width:Number($("#buildingSmartWidth").value)||6000,depth:Number($("#buildingSmartDepth").value)||6000,floors:Number($("#buildingSmartFloors").value)||1,baysX:Number($("#buildingSmartBaysX").value)||3,baysY:Number($("#buildingSmartBaysY").value)||3,storyHeight:Number($("#buildingSmartStory").value)||2800,roofPitch:Number($("#buildingRoofPitch").value)||0});liveBuildingPlacement?.startGroupPlacement?.(made,{label:"半自動建築",ground:true});refresh();status(`半自動建築 ${made.length} objects / ゴーストを配置してください`,'command')}catch(e){status(e.message,'error')}};
if($("#buildingFloorPlanCreate"))$("#buildingFloorPlanCreate").onclick=()=>{try{readBuildingAssistDialog();buildingAssist.clearPreview?.();const made=buildingAssist.createFromFloorPlan($("#buildingFloorPlan").value,{storyHeight:Number($("#buildingSmartStory").value)||2800});liveBuildingPlacement?.startGroupPlacement?.(made,{label:"間取り建築",ground:true});refresh();status(`間取り建築 ${made.length} objects / ゴーストを配置してください`,"command")}catch(e){status(e.message,"error")}};
const ghostHud=$("#ghostPlacementHud"),ghostLabel=$("#ghostPlacementLabel");
function syncGhostPlacementHud(){const g=liveBuildingPlacement?.groupGhost;ghostHud?.classList.toggle("hidden",!g);if(g&&ghostLabel)ghostLabel.textContent=`👻 ${g.label||"建物配置"}`}
$("#ghostRotateLeft")?.addEventListener("click",()=>{liveBuildingPlacement?.rotateGroup?.(-15);syncGhostPlacementHud()});
$("#ghostRotateRight")?.addEventListener("click",()=>{liveBuildingPlacement?.rotateGroup?.(15);syncGhostPlacementHud()});
$("#ghostCommitBtn")?.addEventListener("click",()=>{liveBuildingPlacement?.commitGroupPlacement?.();syncGhostPlacementHud()});
$("#ghostCancelBtn")?.addEventListener("click",()=>{liveBuildingPlacement?.cancelGroupPlacement?.(true);syncGhostPlacementHud();refresh()});
scene.addLoopHook?.(()=>syncGhostPlacementHud());

$("#buildingAnalyze").onclick=()=>{const a=buildingAssist.analyzeSelection();status(a?`選択範囲 W${a.width.toFixed(1)} × D${a.depth.toFixed(1)} × H${a.height.toFixed(1)} mm / ${a.count} objects`:'対象を選択してください',a?'command':'error')};
$("#buildingReground").onclick=()=>{
  try{readBuildingAssistDialog();const r=buildingAssist.createFoundationsForSelection();for(const o of r.items)scene.sync(o);refresh();status(`建築を地表基礎で支持 ${r.foundations.length}基礎 / 建物持上げ ${r.lift.toFixed(1)} mm`,'command')}catch(e){status(e.message,'error')}
};
$("#buildingPreview").onclick=()=>{try{const c=readBuildingAssistDialog(),made=buildingAssist.previewSmartBuilding({width:Number($("#buildingSmartWidth").value)||6000,depth:Number($("#buildingSmartDepth").value)||6000,floors:Number($("#buildingSmartFloors").value)||1,baysX:Number($("#buildingSmartBaysX").value)||3,baysY:Number($("#buildingSmartBaysY").value)||3,storyHeight:Number($("#buildingSmartStory").value)||2800,roofPitch:Number($("#buildingRoofPitch").value)||0});refresh();status(`建築ゴースト ${made.length} objects / 確定または取消を選択`,'command')}catch(e){status(e.message,'error')}};
$("#buildingPreviewCommit").onclick=()=>{const made=buildingAssist.commitPreview();refresh();status(`建築プレビュー確定 ${made.length} objects`,'command')};
$("#buildingPreviewClear").onclick=()=>{const n=buildingAssist.clearPreview();refresh();status(`建築プレビュー取消 ${n} objects`,'command')};
["column","wall","floor","roof"].forEach(layer=>{const el=$("#layer_"+layer);if(el)el.onchange=()=>{const n=buildingAssist.setLayerVisible(layer,el.checked);state.objects.forEach(o=>scene.sync(o));refresh();status(`${layer} layer ${el.checked?'ON':'OFF'} (${n})`,'command')}});
["column","wall","floor","roof"].forEach(kind=>{const el=$("#liveBuild_"+kind);if(el)el.onclick=()=>{readBuildingAssistDialog();liveBuildingPlacement?.setTool?.(kind);status(`リアルタイム建築: ${kind} / マウス移動→クリックで配置 / ESCでキャンセル`,"command")}});
if($("#liveBuild_off"))$("#liveBuild_off").onclick=()=>{liveBuildingPlacement?.stop?.();status("リアルタイム建築 OFF","command")};
if($("#buildingSnapGrid"))$("#buildingSnapGrid").onchange=()=>{state.buildingAssist.snapGrid=Math.max(.001,Number($("#buildingSnapGrid").value)||250)};
if($("#buildingSnapRadius"))$("#buildingSnapRadius").onchange=()=>{state.buildingAssist.snapRadius=Math.max(1,Number($("#buildingSnapRadius").value)||450)};


function downscaleCanvas(sourceCanvas,width=480,height=300){
  const out=document.createElement('canvas');out.width=width;out.height=height;const ctx=out.getContext('2d');
  const sw=sourceCanvas.width||1,sh=sourceCanvas.height||1,srcAspect=sw/sh,dstAspect=width/height;let sx=0,sy=0,cw=sw,ch=sh;
  if(srcAspect>dstAspect){cw=sh*dstAspect;sx=(sw-cw)/2}else{ch=sw/dstAspect;sy=(sh-ch)/2}
  ctx.fillStyle='#0c1218';ctx.fillRect(0,0,width,height);ctx.drawImage(sourceCanvas,sx,sy,cw,ch,0,0,width,height);return out.toDataURL('image/jpeg',.82);
}
function captureRecipeScreenshot(){try{return downscaleCanvas(scene.renderer.domElement,480,300)}catch(e){console.warn('screenshot thumbnail',e);return null}}
function captureRecipeModel(objects=state.selectedObjects()){if(!objects?.length)return null;let renderer=null;try{
  const canvas=document.createElement('canvas');canvas.width=480;canvas.height=300;renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,alpha:false});renderer.setSize(480,300,false);renderer.setPixelRatio(1);
  const ps=new THREE.Scene();ps.background=new THREE.Color(0x101a22);ps.add(new THREE.HemisphereLight(0xffffff,0x273746,2.4));const dl=new THREE.DirectionalLight(0xffffff,2.2);dl.position.set(4,6,5);ps.add(dl);const group=new THREE.Group();ps.add(group);
  for(const part of objects){const src=part.mesh;if(!src?.geometry)continue;src.updateWorldMatrix(true,false);const mesh=new THREE.Mesh(src.geometry.clone(),src.material?.clone?.()||new THREE.MeshStandardMaterial({color:part.color||'#a8c6d8'}));src.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);group.add(mesh)}
  if(!group.children.length)return null;group.updateMatrixWorld(true);let box=new THREE.Box3().setFromObject(group);const center=box.getCenter(new THREE.Vector3());group.position.sub(center);group.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(group);const size=box.getSize(new THREE.Vector3()),radius=Math.max(size.x,size.y,size.z,.001)*.72;
  const camera=new THREE.PerspectiveCamera(32,480/300,.001,Math.max(100000,radius*100));camera.position.set(radius*1.55,radius*1.15,radius*1.7);camera.lookAt(0,0,0);renderer.render(ps,camera);return canvas.toDataURL('image/png');
 }catch(e){console.warn('model thumbnail',e);return null}finally{renderer?.dispose?.()}}
function refreshRecipeThumbnails(record,objects){const screenshot=captureRecipeScreenshot(),model=captureRecipeModel(objects);if(screenshot)recipeBlueprint.setThumbnail(record.id,'screenshot',screenshot);if(model)recipeBlueprint.setThumbnail(record.id,'model',model);recipeBlueprint.setThumbnailPreferred(record.id,$('#recipeThumbnailPreferred')?.value||'model');return record;}

$("#recipeClose").onclick=()=>closeDialog("#recipeDialog");
$("#recipeSave").onclick=()=>{try{const objects=state.selectedObjects();const r=recipeBlueprint.saveSelection({name:$("#recipeName").value||'Recipe',category:$("#recipeCategory").value||'その他',kind:$("#recipeKind").value||'recipe',notes:$("#recipeNotes").value||'',tags:$("#recipeTags").value||'',thumbnailPreferred:$("#recipeThumbnailPreferred").value||'model'});refreshRecipeThumbnails(r,objects);renderRecipeDialog();status(`Recipe登録 ${r.name} / サムネイル2種`,'command')}catch(e){status(e.message,'error')}};
$("#recipeCaptureScreenshot").onclick=()=>{const id=recipeBlueprint?.list?.({})?.slice?.(-1)?.[0]?.id;if(!id)return status("先にレシピを登録してください","error");const data=captureRecipeScreenshot();if(data){recipeBlueprint.setThumbnail(id,"screenshot",data);renderRecipeDialog();status("スクリーンショットサムネイル更新","command")}};
$("#recipeCaptureModel").onclick=()=>{const id=recipeBlueprint?.list?.({})?.slice?.(-1)?.[0]?.id;if(!id)return status("先にレシピを登録してください","error");const data=captureRecipeModel();if(data){recipeBlueprint.setThumbnail(id,"model",data);renderRecipeDialog();status("モデルサムネイル更新","command")}else status("モデル用オブジェクトを選択してください","error")};
$("#recipeSearch").oninput=()=>renderRecipeDialog();
$("#recipeImport").onclick=()=>$("#recipeImportFile").click();
$("#recipeImportFile").onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const r=recipeBlueprint.importJson(await f.text());renderRecipeDialog();status(`Recipe読込 ${r.name}`,'command')}catch(err){status(err.message,'error')}e.target.value=''};

$("#marketBtn").onclick=()=>{renderMarketDialog();$("#marketDialog").classList.add("show")};
$("#marketClose").onclick=()=>closeDialog("#marketDialog");
$("#marketUser").onchange=()=>{marketplace.setCurrentUser($("#marketUser").value);renderMarketDialog()};
$("#marketPlatformRate").onchange=()=>{marketplace.ensureState().platformContributionRate=Math.max(0,Math.min(10,Number($("#marketPlatformRate").value)||1));renderMarketDialog()};
$("#marketAdPool").onchange=()=>{marketplace.ensureState().adRevenuePool=Math.max(0,Number($("#marketAdPool").value)||0);renderMarketDialog()};
$("#marketAdDistributionRate").onchange=()=>{marketplace.ensureState().adDistributionRate=Math.max(0,Math.min(100,Number($("#marketAdDistributionRate").value)||0));renderMarketDialog()};
$("#marketDistributeAds").onclick=()=>{const r=marketplace.distributeAdRevenue();renderMarketDialog();status(r.total?`広告収益 ${marketMoney(r.total)} を ${r.users}アカウントへ還元`:'還元対象または広告収益がありません',r.total?'command':'info')};
$("#marketRatingReward").onchange=()=>{marketplace.ensureState().ratingReward=Math.max(0,Number($("#marketRatingReward").value)||0);renderMarketDialog()};
$("#marketCreate").onclick=()=>{try{const market=marketplace.createMarket({name:$("#marketName").value||'Market',feeRate:Number($("#marketFee").value)||0,ownerId:marketplace.ensureState().currentUserId});renderMarketDialog();$("#marketSelect").value=market.id;status(`Market作成 ${market.name}`,'command')}catch(e){status(e.message,'error')}};
$("#marketSaveSettings").onclick=()=>{try{const id=$("#marketSelect").value;if(!id)throw new Error('マーケットを選択してください');marketplace.updateMarket(id,{name:$("#marketName").value,feeRate:Number($("#marketFee").value)});renderMarketDialog();status('Market設定保存','command')}catch(e){status(e.message,'error')}};
$("#marketSelect").onchange=()=>{const x=marketplace.ensureState().markets.find(m=>m.id===$("#marketSelect").value);if(x){$("#marketName").value=x.name;$("#marketFee").value=x.feeRate}};
$("#marketPlace").onclick=()=>{try{const id=$("#marketSelect").value;if(!id)throw new Error('マーケットを選択してください');const p=creatorMode?.creationPositionCad?.()||[0,0,0];marketplace.placeMarketEntity(id,p);refresh();status('Market Entityを設置','command')}catch(e){status(e.message,'error')}};
[$("#listingMaterial"),$("#listingLabor"),$("#listingMargin")].forEach(el=>{if(el&&!el.dataset?.missingSelector)el.oninput=updateListingPrice});
$("#listingPublish").onclick=()=>{try{const recipeId=$("#marketRecipe").value,marketId=$("#marketSelect").value;if(!recipeId||!marketId)throw new Error('RecipeとMarketを選択してください');const l=marketplace.createListing(recipeId,marketId,{materialCost:Number($("#listingMaterial").value)||0,laborCost:Number($("#listingLabor").value)||0,margin:Number($("#listingMargin").value)||0,price:Number($("#listingPrice").value)||0,license:$("#listingLicense").value,sellerId:marketplace.ensureState().currentUserId});renderMarketDialog();status(`出品 ${l.title} / ${marketMoney(l.price)}`,'command')}catch(e){status(e.message,'error')}};


function marketMoney(v){return `${(Number(v)||0).toFixed(2).replace(/\.00$/,'')} P`}
function renderMarketDialog(){
  if(!marketplace)return;const m=marketplace.ensureState();
  const userInput=$("#marketUser");if(userInput&&document.activeElement!==userInput)userInput.value=m.currentUserId||'PLAYER';
  $("#marketWallet").textContent=marketMoney(marketplace.wallet(m.currentUserId).balance);$("#marketPlatformRate").value=m.platformContributionRate;$("#marketPlatformFund").textContent=marketMoney(m.platformFund);$("#marketAdPool").value=m.adRevenuePool;$("#marketAdDistributionRate").value=m.adDistributionRate;$("#marketRatingReward").value=m.ratingReward;
  const ms=$("#marketSelect"),markets=m.markets||[];ms.innerHTML=markets.length?markets.map(x=>`<option value="${x.id}">${escapeHtml(x.name)} / ${Number(x.feeRate)||0}% / ${escapeHtml(x.ownerId)}</option>`).join(''):'<option value="">マーケット未作成</option>';
  const chosen=markets.find(x=>x.id===ms.value)||markets[0];if(chosen){ms.value=chosen.id;$("#marketName").value=chosen.name;$("#marketFee").value=chosen.feeRate;}
  const recipes=recipeBlueprint?.list?.({})||[];$("#marketRecipe").innerHTML=recipes.length?recipes.map(r=>`<option value="${r.id}">${escapeHtml(r.name)} / ${escapeHtml(r.category)}</option>`).join(''):'<option value="">Recipeなし</option>';
  const list=$("#marketListingList"),rows=marketplace.listingView();
  list.innerHTML=rows.length?rows.map(l=>{const r=l.recipe||{},t=r.thumbnail||{},img=t[t.preferred||'model']||t.model||t.screenshot||'',own=l.sellerId===m.currentUserId,purchased=m.purchases.some(p=>p.listingId===l.id&&p.buyerId===m.currentUserId),canRate=marketplace.canRate(l.id,m.currentUserId),ss=l.settlement;return `<div class="recipeRow"><div>${img?`<img class="recipeThumb" src="${img}" alt="${escapeHtml(l.title)}">`:`<div class="recipeThumbEmpty">No preview</div>`}</div><div><b>${escapeHtml(l.title)}</b><small>${escapeHtml(r.category||'その他')} / Seller: ${escapeHtml(l.sellerId)} / Market: ${escapeHtml(l.market?.name||'')}</small><div><b>${marketMoney(l.price)}</b>　★${Number(l.ratingAverage||0).toFixed(1)} (${l.ratingCount||0})　販売 ${l.sales||0}</div><small>材料 ${marketMoney(l.materialCost)} + 工賃 ${marketMoney(l.laborCost)} + Margin ${marketMoney(l.margin)} / 市場手数料 ${Number(l.market?.feeRate||0)}% / UE還流 ${Number(m.platformContributionRate||0)}%</small><small>販売者受取 ${marketMoney(ss.sellerNet)} / Market受取 ${marketMoney(ss.marketNet)} / UE基金 ${marketMoney(ss.platformTotal)}</small><small>権利: ${escapeHtml(l.license||'use')}</small>${canRate?`<div data-rate-row="${l.id}">${[1,2,3,4,5].map(n=>`<button data-market-rate="${l.id}" data-stars="${n}">★${n}</button>`).join('')}</div>`:''}</div><div class="recipeActions"><button data-market-buy="${l.id}" ${own||purchased?'disabled':''}>${own?'自分の商品':purchased?'購入済':'購入'}</button></div></div>`}).join(''):'<p class="help">出品はまだありません。</p>';
  list.querySelectorAll('[data-market-buy]').forEach(b=>b.onclick=()=>{try{const purchase=marketplace.buy(b.dataset.marketBuy,m.currentUserId);renderMarketDialog();status(`購入 ${marketMoney(purchase.price)}`,'command')}catch(e){status(e.message,'error')}});
  list.querySelectorAll('[data-market-rate]').forEach(b=>b.onclick=()=>{try{const out=marketplace.rate(b.dataset.marketRate,Number(b.dataset.stars),m.currentUserId);renderMarketDialog();status(`評価 ★${b.dataset.stars}${out.reward?` / ${marketMoney(out.reward)}還元`:''}`,'command')}catch(e){status(e.message,'error')}});
}
function updateListingPrice(){const material=Math.max(0,Number($("#listingMaterial").value)||0),labor=Math.max(0,Number($("#listingLabor").value)||0),margin=Math.max(0,Number($("#listingMargin").value)||0);$("#listingPrice").value=material+labor+margin}

function setSketchCommand(tool,label){
  if(!state.sketchMode||!sketchController.activeSketch)return status("先に SKETCH でスケッチを開始するか、ツリーのスケッチを編集してください","error");
  sketchController.setTool(tool);$("#activeSketchToolName").textContent=label;status(`SKETCH ${label}`,"command");
}


function renderBuildingAssistDialog(){
  const c=buildingAssist?.ensureState?.()||state.buildingAssist||{};
  $("#buildingAssistMode").value=c.mode||"snap";if($("#buildingSnapGrid"))$("#buildingSnapGrid").value=c.snapGrid||250;if($("#buildingSnapRadius"))$("#buildingSnapRadius").value=c.snapRadius||450;$("#buildingColumnCount").value=c.columnCount||4;$("#buildingColumnSpacing").value=c.columnSpacing||3000;$("#buildingColumnAxis").value=c.axis||"X";$("#buildingColumnRows").value=c.columnRows||3;$("#buildingColumnSpacingY").value=c.columnSpacingY||3000;$("#buildingWallThickness").value=c.wallThickness||120;$("#buildingFloorThickness").value=c.floorThickness||150;if($("#buildingAutoFoundation"))$("#buildingAutoFoundation").checked=c.autoFoundation!==false;if($("#buildingFoundationWidth"))$("#buildingFoundationWidth").value=c.foundationWidth||320;if($("#buildingFoundationMinHeight"))$("#buildingFoundationMinHeight").value=c.foundationMinHeight||250;$("#buildingRoofPitch").value=c.roofPitch||20;$("#buildingSmartWidth").value=c.smartWidth||6000;$("#buildingSmartDepth").value=c.smartDepth||6000;$("#buildingSmartFloors").value=c.smartFloors||1;$("#buildingSmartBaysX").value=c.smartBaysX||3;$("#buildingSmartBaysY").value=c.smartBaysY||3;$("#buildingSmartStory").value=c.smartStory||2800;
}
function readBuildingAssistDialog(){const c=buildingAssist.ensureState();c.mode=$("#buildingAssistMode").value;c.snapGrid=Math.max(.001,Number($("#buildingSnapGrid").value)||250);c.snapRadius=Math.max(1,Number($("#buildingSnapRadius").value)||450);c.columnCount=Number($("#buildingColumnCount").value)||4;c.columnSpacing=Number($("#buildingColumnSpacing").value)||3000;c.axis=$("#buildingColumnAxis").value;c.columnRows=Number($("#buildingColumnRows").value)||3;c.columnSpacingY=Number($("#buildingColumnSpacingY").value)||3000;c.wallThickness=Number($("#buildingWallThickness").value)||120;c.floorThickness=Number($("#buildingFloorThickness").value)||150;c.roofPitch=Number($("#buildingRoofPitch").value)||20;c.smartWidth=Number($("#buildingSmartWidth").value)||6000;c.smartDepth=Number($("#buildingSmartDepth").value)||6000;c.smartFloors=Number($("#buildingSmartFloors").value)||1;c.smartBaysX=Number($("#buildingSmartBaysX").value)||3;c.smartBaysY=Number($("#buildingSmartBaysY").value)||3;c.smartStory=Number($("#buildingSmartStory").value)||2800;if($("#buildingAutoFoundation"))c.autoFoundation=$("#buildingAutoFoundation").checked;if($("#buildingFoundationWidth"))c.foundationWidth=Math.max(60,Number($("#buildingFoundationWidth").value)||320);if($("#buildingFoundationMinHeight"))c.foundationMinHeight=Math.max(20,Number($("#buildingFoundationMinHeight").value)||250);return c}
function renderRecipeDialog(){
  const list=$("#recipeList"),query=$("#recipeSearch")?.value||'',rows=recipeBlueprint?.list?.({query})||[];
  list.innerHTML=rows.length?rows.map(r=>{const t=r.thumbnail||{},mode=t.preferred||'model',img=t[mode]||t.model||t.screenshot||'';return `<div class="recipeRow" data-recipe-row="${r.id}">${img?`<img class="recipeThumb" src="${img}" alt="${escapeHtml(r.name)} thumbnail">`:`<div class="recipeThumbEmpty">No preview</div>`}<div><b>${escapeHtml(r.name)}</b><small>${escapeHtml(r.category)} / ${escapeHtml(r.kind)} / ${r.objects.length} objects${r.tags&&r.tags.length?` / ${escapeHtml(r.tags.join(', '))}`:''}</small><div style="margin-top:6px"><button class="thumbMode ${mode==='screenshot'?'active':''}" data-thumb-mode="screenshot" data-id="${r.id}" ${t.screenshot?'':'disabled'}>📷スクショ</button><button class="thumbMode ${mode==='model'?'active':''}" data-thumb-mode="model" data-id="${r.id}" ${t.model?'':'disabled'}>🧊モデル</button><button class="thumbMode" data-thumb-refresh="screenshot" data-id="${r.id}">↻📷</button><button class="thumbMode" data-thumb-refresh="model" data-id="${r.id}">↻🧊</button></div></div><div class="recipeActions"><button data-recipe-fav="${r.id}">${r.favorite?"★":"☆"}</button><button data-recipe-place="${r.id}">配置</button><button data-recipe-dup="${r.id}">複製</button><button data-recipe-export="${r.id}">JSON</button><button data-recipe-delete="${r.id}">削除</button></div></div>`}).join(''):'<p class="help">該当するレシピはありません。</p>';
  list.querySelectorAll('[data-thumb-mode]').forEach(b=>b.onclick=()=>{recipeBlueprint.setThumbnailPreferred(b.dataset.id,b.dataset.thumbMode);renderRecipeDialog()});
  list.querySelectorAll('[data-thumb-refresh]').forEach(b=>b.onclick=()=>{const type=b.dataset.thumbRefresh,data=type==='screenshot'?captureRecipeScreenshot():captureRecipeModel();if(!data)return status(type==='model'?'モデル用オブジェクトを選択してください':'撮影できませんでした','error');recipeBlueprint.setThumbnail(b.dataset.id,type,data);renderRecipeDialog();status(`${type==='model'?'モデル':'スクリーンショット'}サムネイル更新`,'command')});
  list.querySelectorAll('[data-recipe-fav]').forEach(b=>b.onclick=()=>{recipeBlueprint.toggleFavorite(b.dataset.recipeFav);renderRecipeDialog()});
  list.querySelectorAll('[data-recipe-place]').forEach(b=>b.onclick=()=>{const origin=creatorMode?.creationPositionCad?.()||[0,0,0];const made=recipeBlueprint.instantiate(b.dataset.recipePlace,origin);refresh();status(`Recipe配置 ${made.length} objects`,'command')});
  list.querySelectorAll('[data-recipe-dup]').forEach(b=>b.onclick=()=>{recipeBlueprint.duplicate(b.dataset.recipeDup);renderRecipeDialog();status('Recipe複製','command')});
  list.querySelectorAll('[data-recipe-export]').forEach(b=>b.onclick=()=>{const text=recipeBlueprint.exportJson(b.dataset.recipeExport),blob=new Blob([text],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${b.dataset.recipeExport}.uerecipe.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
  list.querySelectorAll('[data-recipe-delete]').forEach(b=>b.onclick=()=>{recipeBlueprint.remove(b.dataset.recipeDelete);renderRecipeDialog();status('Recipe削除','command')});
}

// ---- v3.4.1 Spreadsheet Motion / Real Time / Safe Clipboard ----
const motionProperties=["X","Y","Z","RX","RY","RZ","SX","SY","SZ","VISIBLE"];
function ensureMotionState(){
  if(!Array.isArray(state.motionBindings))state.motionBindings=[];
  if(!state.motionClock)state.motionClock={running:false,simTime:0,speed:1,useRealTime:false,lastTick:performance.now()};
  if(!state.spreadsheet)state.spreadsheet={name:"Sheet1",rows:20,cols:10,cells:{}};
}

function sheetColName(n){let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s}
let activeSheetCell='A1';
function renderSpreadsheet(){
  ensureMotionState(); const grid=$('#sheetGrid'); if(!grid||grid.dataset?.missingSelector)return;
  const sh=state.spreadsheet; let html='<thead><tr><th></th>';
  for(let c=0;c<sh.cols;c++)html+=`<th>${sheetColName(c)}</th>`; html+='</tr></thead><tbody>';
  for(let r=1;r<=sh.rows;r++){html+=`<tr><th class="rowHead">${r}</th>`;for(let c=0;c<sh.cols;c++){const a=sheetColName(c)+r;html+=`<td><input class="sheetCell" data-cell="${a}" value="${escapeHtml(sh.cells[a]??'')}"></td>`}html+='</tr>'} html+='</tbody>';grid.innerHTML=html;
  grid.querySelectorAll('.sheetCell').forEach(inp=>{
    inp.onfocus=()=>{activeSheetCell=inp.dataset.cell;$('#sheetCellName').textContent=activeSheetCell;$('#sheetFormula').value=state.spreadsheet.cells[activeSheetCell]??''};
    inp.onchange=()=>{state.spreadsheet.cells[inp.dataset.cell]=inp.value;$('#sheetFormula').value=inp.value};
    inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();inp.blur()}};
  });
}
function cellRaw(name){return state.spreadsheet?.cells?.[String(name).toUpperCase()]??0}
function cellValue(name,ctx,stack=new Set()){
  name=String(name).toUpperCase(); if(stack.has(name))throw new Error(`循環参照 ${name}`);stack.add(name);
  const raw=cellRaw(name); if(raw===''||raw==null)return 0;if(typeof raw==='number')return raw;
  const text=String(raw).trim(); if(!text.startsWith('=')){const n=Number(text);return Number.isFinite(n)?n:text}
  let src=text.slice(1).replace(/\b([A-Z]{1,3}[1-9]\d*)\b/g,(m)=>JSON.stringify(cellValue(m,ctx,new Set(stack))));
  return evaluateMotionExpression('='+src,ctx);
}
function replaceSheetRefs(expr,ctx){
  return String(expr||'').replace(/(?:Sheet1!)?\$?([A-Z]{1,3})\$?([1-9]\d*)/gi,(m,c,r)=>JSON.stringify(cellValue(c.toUpperCase()+r,ctx)));
}
function motionObjectOptions(selected=""){
  return state.objects.map(o=>`<option value="${escapeHtml(o.id)}" ${o.id===selected?'selected':''}>${escapeHtml(o.name)} (${escapeHtml(o.id)})</option>`).join("");
}
function renderMotionRows(){
  ensureMotionState();
  const body=$("#motionRows"); if(body?.dataset?.missingSelector)return;
  body.innerHTML=state.motionBindings.map((b,i)=>`<tr data-motion-row="${i}">
    <td><input class="mEnabled" type="checkbox" ${b.enabled!==false?'checked':''}></td>
    <td><select class="mObject">${motionObjectOptions(b.objectId)}</select></td>
    <td><select class="mProp">${motionProperties.map(p=>`<option ${p===b.property?'selected':''}>${p}</option>`).join('')}</select></td>
    <td><input class="mExpr expr" value="${escapeHtml(b.expression||'=0')}"></td>
    <td><select class="mSpace"><option value="world" ${b.space!=='local'?'selected':''}>World</option><option value="local" ${b.space==='local'?'selected':''}>Local</option></select></td>
    <td class="mStatus">待機</td><td><button class="mDelete">×</button></td></tr>`).join('');
  body.querySelectorAll('tr').forEach((tr,i)=>{
    const b=state.motionBindings[i];
    tr.querySelector('.mEnabled').onchange=e=>b.enabled=e.target.checked;
    tr.querySelector('.mObject').onchange=e=>b.objectId=e.target.value;
    tr.querySelector('.mProp').onchange=e=>b.property=e.target.value;
    tr.querySelector('.mExpr').onchange=e=>b.expression=e.target.value;
    tr.querySelector('.mSpace').onchange=e=>b.space=e.target.value;
    tr.querySelector('.mDelete').onclick=()=>{state.motionBindings.splice(i,1);renderMotionRows()};
  });
}
function addMotionBinding(data={}){
  ensureMotionState(); const o=state.primary()||state.objects[0];
  state.motionBindings.push({enabled:true,objectId:data.objectId||o?.id||'',property:data.property||'X',expression:data.expression||'=TIME*10',space:data.space||'world'});
  renderMotionRows();
}
function buildMotionContext(now){
  const d=new Date(now); const c=state.motionClock;
  const ctx={TIME:c.simTime,SIM_TIME:c.simTime,NOW:now,YEAR:d.getFullYear(),MONTH:d.getMonth()+1,DAY:d.getDate(),HOUR:d.getHours(),MINUTE:d.getMinutes(),SECOND:d.getSeconds()+d.getMilliseconds()/1000,WEEKDAY:d.getDay(),PI:Math.PI};
  for(const o of state.objects){
    const safe=(o.name||o.id).replace(/[^A-Za-z0-9_$]/g,'_');
    ctx[safe]={X:o.position[0],Y:o.position[1],Z:o.position[2],RX:o.rotation[0],RY:o.rotation[1],RZ:o.rotation[2],SX:o.scale[0],SY:o.scale[1],SZ:o.scale[2],VISIBLE:o.visible!==false};
  }
  return ctx;
}
function normalizeFormula(expr){
  let s=String(expr||'0').trim().replace(/^=/,'');
  s=s.replace(/\bAND\b/gi,'&&').replace(/\bOR\b/gi,'||').replace(/\bNOT\b/gi,'!');
  s=s.replace(/\bIF\s*\(/gi,'IF(').replace(/\bSIND\s*\(/gi,'SIND(').replace(/\bCOSD\s*\(/gi,'COSD(').replace(/\bTAND\s*\(/gi,'TAND(');
  return s;
}
function evaluateMotionExpression(expr,ctx){
  const source=normalizeFormula(replaceSheetRefs(expr,ctx));
  const names=Object.keys(ctx),values=Object.values(ctx);
  const fn=new Function(...names,'IF','SIND','COSD','TAND','MIN','MAX','ABS','ROUND','FLOOR','CEIL',`"use strict"; return (${source});`);
  return fn(...values,(c,a,b)=>c?a:b,x=>Math.sin(x*Math.PI/180),x=>Math.cos(x*Math.PI/180),x=>Math.tan(x*Math.PI/180),Math.min,Math.max,Math.abs,Math.round,Math.floor,Math.ceil);
}
function applyMotionBinding(binding,ctx,rowStatus=null){
  const o=state.object(binding.objectId); if(!o)throw new Error('対象オブジェクトなし');
  const value=evaluateMotionExpression(binding.expression,ctx); const p=binding.property;
  const map={X:['position',0],Y:['position',1],Z:['position',2],RX:['rotation',0],RY:['rotation',1],RZ:['rotation',2],SX:['scale',0],SY:['scale',1],SZ:['scale',2]};
  if(p==='VISIBLE')o.visible=!!value; else if(map[p]){const [k,n]=map[p];o[k][n]=Number(value)||0}else throw new Error(`未対応変数 ${p}`);
  scene.sync(o); if(rowStatus){rowStatus.textContent=typeof value==='number'?Number(value).toFixed(3):String(value);rowStatus.className='mStatus motionOk'};
}
function applyAllMotionBindings(showStatus=false){
  ensureMotionState(); const ctx=buildMotionContext(Date.now());
  state.motionBindings.forEach((b,i)=>{if(b.enabled===false)return;const cell=showStatus?document.querySelector(`[data-motion-row="${i}"] .mStatus`):null;try{applyMotionBinding(b,ctx,cell)}catch(err){if(cell){cell.textContent=err.message;cell.className='mStatus motionError'}}});
  if(showStatus)refresh();
}
function openMotionDialog(){ensureMotionState();renderSpreadsheet();renderMotionRows();$('#motionTime').value=state.motionClock.simTime.toFixed(3);$('#motionSpeed').value=String(state.motionClock.speed);$('#motionRealToggle').checked=!!state.motionClock.useRealTime;$('#motionDialog').classList.add('show');updateMotionClockLabel()}
function updateMotionClockLabel(){const n=$('#motionNow');if(n&&!n.dataset?.missingSelector)n.textContent=`REAL ${new Date().toLocaleString('ja-JP')} / SIM ${state.motionClock.simTime.toFixed(3)} s`}
function updateScaleHud(){
  const hud=$("#scaleHud");if(!hud||hud.dataset?.missingSelector)return;
  const d=infiniteScaleCore?.describe?.()||{label:"mm",metersPerUnit:1e-3,context:"workspace"};
  const mode=seamlessWorld?.modeLabel?.()||String(d.context||"").toUpperCase();
  const m=Number(d.metersPerUnit)||1e-3;
  const text=m>=1e9?`${(m/1.495978707e11).toPrecision(3)} AU/unit`:m>=1e3?`${(m/1e3).toPrecision(3)} km/unit`:m>=1?`${m.toPrecision(3)} m/unit`:m>=1e-3?`${(m*1e3).toPrecision(3)} mm/unit`:m>=1e-6?`${(m*1e6).toPrecision(3)} µm/unit`:m>=1e-9?`${(m*1e9).toPrecision(3)} nm/unit`:`${(m*1e12).toPrecision(3)} pm/unit`;
  const cd=creatorMode?.describe?.();
  hud.innerHTML=`<b>∞ ${d.label}</b><span>${text}</span><span>${mode}</span>${cd?.enabled?`<span>🎨 ${cd.label}</span>`:""}<small>Ctrl+Wheel: seamless scale</small>`;
}
function updateAvatarPositionHud(){
  const hud=document.querySelector('#avatarPositionHud');if(!hud)return;
  const av=state.avatar||{};
  if(av.onPlanet&&planetManager){
    const n=new THREE.Vector3(...(av.planetNormal||[0,1,0])).normalize();
    const lat=THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(n.y,-1,1))),lon=THREE.MathUtils.radToDeg(Math.atan2(n.z,n.x));
    const alt=planetManager.elevationMmAtDirection(n)+(Number(av.surfaceOffset)||0)*planetManager.mmPerUnit();
    const wp=avatarManager?.group?.position?.clone?.()||n.clone().multiplyScalar(planetManager.surfaceRadius(n));
    const xyz=[planetManager.sceneToMm(wp.x),planetManager.sceneToMm(wp.y),planetManager.sceneToMm(wp.z)];
    const cad=scene?.worldPointToCad?.(wp)||[0,0,0];
    const ns=lat>=0?'N':'S',ew=lon>=0?'E':'W';
    hud.innerHTML=`<b>AVATAR POSITION</b><div class="coordRow"><span>LAT / LON</span><span>${Math.abs(lat).toFixed(5)}°${ns} / ${Math.abs(lon).toFixed(5)}°${ew}</span></div><div class="coordRow"><span>ALT</span><span>${alt>=0?'+':''}${alt.toFixed(0)} mm</span></div><div class="coordRow coordMuted"><span>PLANET XYZ</span><span>${xyz.map(v=>v.toFixed(0)).join(', ')} mm</span></div><div class="coordRow coordMuted"><span>DESIGN XYZ</span><span>${cad.map(v=>Number(v).toFixed(1)).join(', ')}</span></div>`;
  }else{
    const p=Array.isArray(av.position)?av.position:[0,0,0];hud.innerHTML=`<b>AVATAR POSITION</b><div class="coordRow"><span>XYZ</span><span>${p.map(v=>Number(v).toFixed(1)).join(', ')}</span></div>`;
  }
}
function motionTick(ts){
  ensureMotionState(); const c=state.motionClock; const dt=Math.min(.1,Math.max(0,(ts-c.lastTick)/1000));c.lastTick=ts;
  if(c.running)c.simTime+=dt*c.speed;
  if(c.running||c.useRealTime)applyAllMotionBindings(false);
  mobileControls?.update?.(dt);
  avatarManager?.update?.(dt,ts/1000);
  liveBuildingPlacement?.update?.(dt);
  seamlessWorld?.update?.(dt);
  mechanicalSolver?.step?.(dt*c.speed);
  factoryManager?.update?.(dt*c.speed);
  if(document.querySelector('#motionDialog.show')){$('#motionTime').value=c.simTime.toFixed(3);updateMotionClockLabel()}
  requestAnimationFrame(motionTick);updateScaleHud();updateAvatarPositionHud();
}
requestAnimationFrame(motionTick);
$('#motionBtn').onclick=openMotionDialog;$('#settingsBtn').onclick=openAliasSettings;$('#aliasAddRow').onclick=()=>{$('#aliasRows').insertAdjacentHTML('beforeend','<tr><td><input class="aliasKey"></td><td><input class="aliasCmd"></td></tr>')};$('#aliasSave').onclick=saveAliasSettings;$('#aliasClose').onclick=()=>$('#aliasDialog').classList.remove('show');
document.querySelectorAll('.motionTab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.motionTab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.motionPane').forEach(x=>x.classList.toggle('active',x.id===b.dataset.pane));if(b.dataset.pane==='sheetPane')renderSpreadsheet()});
$('#sheetApplyCell').onclick=()=>{ensureMotionState();state.spreadsheet.cells[activeSheetCell]=$('#sheetFormula').value;renderSpreadsheet();status(`${activeSheetCell} を更新`)};
$('#sheetFormula').onkeydown=e=>{if(e.key==='Enter')$('#sheetApplyCell').click()};
$('#sheetClear').onclick=()=>{if(confirm('シート内容を消去しますか？')){state.spreadsheet.cells={};renderSpreadsheet();status('スプレッドシートを消去')}};
$('#motionAddRow').onclick=()=>addMotionBinding();
$('#motionApply').onclick=()=>{applyAllMotionBindings(true);status('表計算モーション式を適用しました')};
$('#motionPlay').onclick=()=>{state.motionClock.running=true;state.motionClock.lastTick=performance.now();status('SIM_TIME 再生')};
$('#motionPause').onclick=()=>{state.motionClock.running=false;status('SIM_TIME 停止')};
$('#motionReset').onclick=()=>{state.motionClock.simTime=0;applyAllMotionBindings(true);status('SIM_TIME = 0')};
$('#motionTime').onchange=e=>{state.motionClock.simTime=Number(e.target.value)||0;applyAllMotionBindings(true)};
$('#motionSpeed').onchange=e=>state.motionClock.speed=Number(e.target.value)||1;
$('#motionRealToggle').onchange=e=>{state.motionClock.useRealTime=e.target.checked;status(`現実時間連動 ${e.target.checked?'ON':'OFF'}`)};
$('#motionClose').onclick=()=>$('#motionDialog').classList.remove('show');

function commandObjectTargets(token){
 const key=String(token||"").trim(); if(!key)return [];
 if(key.startsWith("@")){const g=key.slice(1).toUpperCase();return state.objects.filter(o=>String(o.groupCode||"").toUpperCase()===g)}
 if(key.includes("*")){const re=new RegExp("^"+key.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*")+"$","i");return state.objects.filter(o=>re.test(o.objectId||"")||re.test(o.name||""))}
 const obj=state.objectByPublicId?.(key)||state.object(key)||state.objects.find(o=>o.name===key);return obj?[obj]:[];
}
function selectCommandTargets(targets){state.selectedIds=targets.map(o=>o.id);state.primaryId=targets[0]?.id||null;refresh()}
function parseVectorToken(v){const a=String(v||"").split(",").map(Number);return a.length===3&&a.every(Number.isFinite)?a:null}
function normalizeCommandAlias(cmd){const map=state.commandAliases||{};return String(map[String(cmd||"").toLowerCase()]||cmd||"").toUpperCase()}

function openAliasSettings(){
 const rows=Object.entries(state.commandAliases||{}).sort().map(([a,c])=>`<tr><td><input class="aliasKey" value="${a}"></td><td><input class="aliasCmd" value="${c}"></td></tr>`).join('');
 $('#aliasRows').innerHTML=rows;$('#aliasDialog').classList.add('show');
}
function saveAliasSettings(){const next={};document.querySelectorAll('#aliasRows tr').forEach(r=>{const a=r.querySelector('.aliasKey').value.trim().toLowerCase(),c=r.querySelector('.aliasCmd').value.trim().toUpperCase();if(a&&c)next[a]=c});state.commandAliases=next;localStorage.setItem('ue-command-aliases',JSON.stringify(next));$('#aliasDialog').classList.remove('show');status('コマンドエイリアスを保存しました')}
try{const saved=JSON.parse(localStorage.getItem('ue-command-aliases')||'null');if(saved&&typeof saved==='object')state.commandAliases=saved}catch{}

function csv3(text,fallback=[0,0,0]){const a=String(text||'').split(',').map(Number);return a.length===3&&a.every(Number.isFinite)?a:fallback}
function currentPartOrWarn(){const p=state.primary();if(!p)status('オブジェクトを選択してください','error');return p}
function refreshMotionAxisDialog(selectId=null){const p=state.primary();if(!p)return;const axes=ensureMotionAxes(p);$('#motionAxisPart').innerHTML=`<strong>${p.name}</strong> / ${p.objectId}`;$('#motionAxisSelect').innerHTML='<option value="">新規</option>'+axes.map(a=>`<option value="${a.id}">${a.id} ${a.name}</option>`).join('');if(selectId)$('#motionAxisSelect').value=selectId;const a=axes.find(x=>x.id===$('#motionAxisSelect').value);if(a){$('#motionAxisName').value=a.name;$('#motionAxisType').value=a.type;$('#motionAxisOrigin').value=a.origin.join(',');$('#motionAxisDirection').value=a.direction.join(',');$('#motionAxisMin').value=a.min;$('#motionAxisMax').value=a.max;$('#motionAxisValue').value=a.value;$('#motionAxisPitch').value=a.pitch??1}}
function openMotionAxisDialog(){const p=currentPartOrWarn();if(!p)return;refreshMotionAxisDialog();$('#motionAxisDialog').classList.add('show')}
function saveMotionAxis(){const p=currentPartOrWarn();if(!p)return;let a=ensureMotionAxes(p).find(x=>x.id===$('#motionAxisSelect').value);if(!a)a=addMotionAxis(p,{});Object.assign(a,{name:$('#motionAxisName').value||a.name,type:$('#motionAxisType').value,origin:csv3($('#motionAxisOrigin').value),direction:csv3($('#motionAxisDirection').value,[0,0,1]),min:Number($('#motionAxisMin').value)||0,max:Number($('#motionAxisMax').value)||0,value:Number($('#motionAxisValue').value)||0,pitch:Number($('#motionAxisPitch').value)||1});if(!p.motionBase)resetMotionBase(p);applyMotionAxis(p,a,scene);refreshMotionAxisDialog(a.id);refresh();status(`MotionAxis ${a.id} ${a.type} = ${a.value}`,'command')}
function deleteMotionAxis(){const p=currentPartOrWarn();if(!p)return;const id=$('#motionAxisSelect').value;if(id){removeMotionAxis(p,id);refreshMotionAxisDialog();refresh();status(`MotionAxis ${id} deleted`,'command')}}
function refreshSocketDialog(selectId=null){const p=state.primary();if(!p)return;const list=ensureSockets(p);$('#socketPart').innerHTML=`<strong>${p.name}</strong> / ${p.objectId}`;$('#socketSelect').innerHTML='<option value="">新規</option>'+list.map(a=>`<option value="${a.id}">${a.id} ${a.name}</option>`).join('');if(selectId)$('#socketSelect').value=selectId;const a=list.find(x=>x.id===$('#socketSelect').value);if(a){$('#socketName').value=a.name;$('#socketType').value=a.type;$('#socketHand').value=a.hand||'either';$('#socketPosition').value=a.position.join(',');$('#socketRotation').value=a.rotation.join(',')}}
function openSocketDialog(){const p=currentPartOrWarn();if(!p)return;refreshSocketDialog();$('#socketDialog').classList.add('show')}
function saveSocket(){const p=currentPartOrWarn();if(!p)return;let a=ensureSockets(p).find(x=>x.id===$('#socketSelect').value);if(!a)a=addSocket(p,{});Object.assign(a,{name:$('#socketName').value||a.name,type:$('#socketType').value,hand:$('#socketHand').value,position:csv3($('#socketPosition').value),rotation:csv3($('#socketRotation').value)});refreshSocketDialog(a.id);refresh();status(`Socket ${a.id} ${a.type}`,'command')}
function deleteSocket(){const p=currentPartOrWarn();if(!p)return;const id=$('#socketSelect').value;if(id){removeSocket(p,id);refreshSocketDialog();refresh();status(`Socket ${id} deleted`,'command')}}
function axisOptions(part){const axes=ensureMotionAxes(part);return '<option value="">部品基準Z</option>'+axes.map(a=>`<option value="${a.id}">${a.id} ${a.name}</option>`).join('')}
function refreshAssemblyDialog(){ensureAssemblyState(state);const opts=state.objects.map(o=>`<option value="${o.id}">${o.objectId} ${o.name}</option>`).join('');$('#assemblySource').innerHTML=opts;$('#assemblyTarget').innerHTML=opts;const sel=state.selectedObjects();if(sel[0])$('#assemblySource').value=sel[0].id;if(sel[1])$('#assemblyTarget').value=sel[1].id;const sync=()=>{$('#assemblySourceAxis').innerHTML=axisOptions(state.object($('#assemblySource').value));$('#assemblyTargetAxis').innerHTML=axisOptions(state.object($('#assemblyTarget').value))};sync();$('#assemblySource').onchange=sync;$('#assemblyTarget').onchange=sync;$('#assemblyList').innerHTML=state.assemblyConstraints.map(c=>`<div>${c.id} ${c.type}: ${(state.object(c.sourceId)?.objectId||'?')} → ${(state.object(c.targetId)?.objectId||'?')} ${c.value||''}</div>`).join('')||'拘束なし'}
function openAssemblyDialog(){if(state.objects.length<2)return status('組立拘束には2部品以上必要です','error');refreshAssemblyDialog();$('#assemblyDialog').classList.add('show')}
function addAssemblyFromDialog(){const c=addAssemblyConstraint(state,{type:$('#assemblyType').value,sourceId:$('#assemblySource').value,targetId:$('#assemblyTarget').value,sourceAxisId:$('#assemblySourceAxis').value||null,targetAxisId:$('#assemblyTargetAxis').value||null,value:Number($('#assemblyValue').value)||0});applyAssemblyConstraint(state,c,scene);refreshAssemblyDialog();refresh();status(`Assembly ${c.id} ${c.type}`,'command')}
function booleanDirect(op,targetToken=null,toolToken=null){let target=targetToken?commandObjectTargets(targetToken)[0]:state.selectedObjects()[0],tool=toolToken?commandObjectTargets(toolToken)[0]:state.selectedObjects()[1];if(!target||!tool||target===tool)throw new Error(`${op.toUpperCase()} <target> <tool> または2部品を選択`);const r=booleanCore.addFeature(target,tool,op,true);geometrySelection.invalidate(target);state.selectedIds=[target.id];state.primaryId=target.id;refresh();scene.fit([target]);status(`${op.toUpperCase()} ${target.objectId} ${tool.objectId}`,'command');return r}
function makePrototype(){const p=currentPartOrWarn();if(!p)return;const inst=createPrototypeInstance(state,p,addPart);state.selectedIds=[inst.id];state.primaryId=inst.id;refresh();status(`Prototype instance ${inst.objectId} ← ${p.objectId}`,'command')}
function syncPrototypes(){const n=syncPrototypeInstances(state,scene);refresh();status(`Prototype sync ${n} instance(s)`,'command')}

function executeCommand(raw){
 const tokens=raw.trim().match(/"[^"]*"|\S+/g)||[];let cmd=normalizeCommandAlias(tokens.shift()||"");const args=tokens.map(v=>v.replace(/^"|"$/g,""));if(!cmd)return;appendCommandHistory(`> ${raw}`,"command");
 const n=args.map(Number),has3=n.length>=3&&n.slice(0,3).every(Number.isFinite);
 const explicitTarget=(cmd==='MOVE'||cmd==='ROTATE'||cmd==='SCALE')&&args.length>=3?commandObjectTargets(args[0]):[];
 const explicitMode=String(args[1]||'').toLowerCase(); const explicitVector=parseVectorToken(args[2]);
 if(explicitTarget.length&&['rel','abs'].includes(explicitMode)&&explicitVector){selectCommandTargets(explicitTarget);applyDirectTransform(cmd==='MOVE'?'move':cmd==='ROTATE'?'rotate':'scale',explicitVector,explicitMode==='abs');}
 else if((cmd==='SELECT')&&args[0]){if(state.sketchMode&&sketchController.selectEntityByCode(args[0]))status(`SELECT ${args[0]}`,'command');else{const t=commandObjectTargets(args[0]);if(t.length){selectCommandTargets(t);status(`SELECT ${args[0]}`,'command')}else status(`対象がありません: ${args[0]}`,'error')}}
 else if((cmd==='DIMENSION'||cmd==='DIM')&&args.length>=2&&state.sketchMode){if(!sketchController.selectEntityByCode(args[0]))status(`スケッチ要素がありません: ${args[0]}`,'error');else{try{sketchConstraints.addDimension(Number(args[1]));status(`DIM ${args[0]} = ${args[1]}`,'command')}catch(e){status(e.message,'error')}}}
 else if((cmd==='MOVE'||cmd==='M')&&has3)applyDirectTransform('move',n.slice(0,3),false);
 else if(cmd==='MOVE'||cmd==='M'){openTransform('relative','move')}
 else if((cmd==='ROTATE'||cmd==='RO')&&has3)applyDirectTransform('rotate',n.slice(0,3),false);
 else if(cmd==='ROTATE'||cmd==='RO'){openTransform('relative','rotate')}
 else if((cmd==='SCALE'||cmd==='SC')&&has3)applyDirectTransform('scale',n.slice(0,3),false);
 else if(cmd==='SCALE'||cmd==='SC'){openTransform('relative','scale')}
 else if(cmd==='AMOVE'&&has3)applyDirectTransform('move',n.slice(0,3),true);
 else if(cmd==='AROTATE'&&has3)applyDirectTransform('rotate',n.slice(0,3),true);
 else if(cmd==='ASCALE'&&has3)applyDirectTransform('scale',n.slice(0,3),true);
 else if(cmd==='SAVE'){saveCurrentProject()}
 else if(cmd==='OPEN'){$('#projectFileInput').click();status('ファイル選択を開きました','command')}
 else if(cmd==='NEW'){if(!state.objects.length||confirm('現在のプロジェクトを破棄して新規作成しますか？')){$('#newProject').click()}}
 else if(cmd==='COLOR'){const target=commandObjectTargets(args[0]||'');const hex=String(args[1]||'').replace('#','');if(!/^[0-9a-f]{6}$/i.test(hex))throw new Error('COLOR <ObjectID> <#RRGGBB>');for(const o of target){o.color=parseInt(hex,16);scene.sync(o)}refresh();status(`COLOR ${target.length} object(s) #${hex.toUpperCase()}`,'command')}
 else if(cmd==='BOX'){addPart('box',{name:args[0]||'Box'});refresh();status('BOXを作成しました','command')}
 else if(cmd==='MIRROR')openMirrorDialog('mirror')
 else if(cmd==='MIRRORCOPY'||cmd==='MCOPY')openMirrorDialog('copy')
 else if(cmd==='PATTERN'||cmd==='ARRAY')openPatternDialog()
 else if(cmd==='CYLINDER'||cmd==='CYL'){addPart('cylinder',{name:args[0]||'Cylinder'});refresh();status('CYLINDERを作成しました','command')}
 else if(cmd==='SPHERE'||cmd==='SPH'){addPart('sphere',{name:args[0]||'Sphere'});refresh();status('SPHEREを作成しました','command')}
 else if(cmd==='SKETCH'||cmd==='SK'){openSketchDialog();status('SKETCH: 平面と目盛を選択してください','command')}
 else if(cmd==='L'||cmd==='LINE')setSketchCommand('line','L (LINE)');
 else if(cmd==='POLY'||cmd==='PL'||cmd==='POLYLINE')setSketchCommand('line','POLY (連続線)');
 else if(cmd==='C'||cmd==='CIRCLE')setSketchCommand('circle','C (CIRCLE)');
 else if(cmd==='REC'||cmd==='RECTANGLE')setSketchCommand('rectangle','REC (RECTANGLE)');
 else if(cmd==='P'||cmd==='POINT')setSketchCommand('point','P (POINT)');
 else if(cmd==='ARC')setSketchCommand('arc','ARC');
 else if(cmd==='SPL'||cmd==='SPLINE')setSketchCommand('spline','SPL (SPLINE)');
 else if(cmd==='FH'||cmd==='FREEHAND')setSketchCommand('freehand','FH (FREEHAND)');
 else if(cmd==='SELECT'||cmd==='ESC')setSketchCommand('select','SELECT');
 else if(cmd==='FINISH'||cmd==='FINISHSKETCH'||cmd==='FS')finishActiveSketch();
 else if(cmd==='REVOLVE'||cmd==='REV'){if(Number.isFinite(n[0]))$('#revolveAngle').value=n[0];openSketchRevolve()}
 else if(cmd==='PAN'){scene.setPanMode(!scene.panMode);$('#panBtn').classList.toggle('active',scene.panMode);status(scene.panMode?'PAN ON':'PAN OFF','command')}
 else if(cmd==='DATUM'){openPartDatum()}
 else if(cmd==='GCONSTRAINT'||cmd==='GEOCO'||cmd==='GC'){openGeometryConstraint()}
 else if(cmd==='EDITSKETCH'||cmd==='SEDIT'){openSketchEntityEditor()}
 else if(cmd==='DELSKETCH'||cmd==='SDEL'){if(sketchController.deleteSelected())status('スケッチ要素を削除','command')}
 else if(cmd==='TRIM'||cmd==='TR'){trimSketchEntity()}
 else if(cmd==='EXTEND'||cmd==='EXT'){extendSketchEntity()}
 else if(cmd==='EXTRUDECUT'||cmd==='EC'){ $('#sketchExtrudeOperation').value='cut'; openSketchExtrude()}
 else if(cmd==='REVOLVE'||cmd==='REV'){openSketchRevolve()}
 else if(cmd==='REVOLVECUT'||cmd==='RC'){openSketchRevolve(); $('#revolveOperation').value='cut'}
 else if(cmd==='EXTRUDE'||cmd==='E'){if(Number.isFinite(n[0])){$('#sketchExtrudeDistance').value=n[0];openSketchExtrude()}else openSketchExtrude()}
 else if(cmd==='FIT'){scene.fit(state.objects.filter(o=>o.visible!==false));status('FIT','command')}
 else if(cmd==='DELETE'||cmd==='DEL'){removeSelected()}
 else if(cmd==='ABS'){transform.mode='absolute';$$('.coord').forEach(b=>b.classList.toggle('active',b.dataset.mode==='absolute'));resetTransformControls();status('ABS: 絶対座標モード','command')}
 else if(cmd==='REL'){transform.mode='relative';$$('.coord').forEach(b=>b.classList.toggle('active',b.dataset.mode==='relative'));resetTransformControls();status('REL: 相対変化量モード','command')}
 else if(cmd==='MOTION'||cmd==='SHEET'||cmd==='SPREADSHEET')openMotionDialog()
 else if(cmd==='PLAY'){state.motionClock.running=true;state.motionClock.lastTick=performance.now();status('SIM_TIME 再生','command')}
 else if(cmd==='PAUSE'||cmd==='STOP'){state.motionClock.running=false;status('SIM_TIME 停止','command')}
 else if(cmd==='SEEK'){state.motionClock.simTime=Number(args[0])||0;applyAllMotionBindings(true);status(`SIM_TIME = ${state.motionClock.simTime}`,'command')}
 else if(cmd==='SPEED'){state.motionClock.speed=Number(args[0])||1;status(`速度 = ${state.motionClock.speed}x`,'command')}
 else if(cmd==='REALTIME'){state.motionClock.useRealTime=!/^(0|OFF|FALSE)$/i.test(args[0]||'ON');status(`現実時間連動 ${state.motionClock.useRealTime?'ON':'OFF'}`,'command')}
 else if(cmd==='EXPR'){const m=raw.match(/^EXPR\s+(.+?)\.(X|Y|Z|RX|RY|RZ|SX|SY|SZ|VISIBLE)\s*=\s*(.+)$/i);if(!m)status('EXPR ObjectName.X = TIME*10','error');else{const o=state.objects.find(x=>x.name===m[1]||x.id===m[1]);if(!o)status('対象がありません','error');else{addMotionBinding({objectId:o.id,property:m[2].toUpperCase(),expression:'='+m[3]});status('式を登録しました','command')}}}
 else if(cmd==='WORKSPACE'||cmd==='WB'){if(args[0]){const p=workspaceManager.apply(args[0].toLowerCase());status(`Workspace: ${p.label}`,'command')}else openWorkspaceDialog()}
 else if(cmd==='DOC'||cmd==='DOCUMENT'){spatialPanels.create('document',[0,0,90]);status('3D Document を作成','command')}
 else if(cmd==='NODE'){spatialPanels.create('node',[60,0,90]);status('3D Node Graph を作成','command')}
 else if(cmd==='PHYSICS'){state.physics.enabled=!/^(0|OFF|FALSE)$/i.test(args[0]||'ON');physicsManager.last=performance.now();status(`Physics ${state.physics.enabled?'ON':'OFF'}`,'command')}
 else if(cmd==='GRAVITY'){if(args.length===1&&/^(EARTH|MOON|MARS|ZERO)$/i.test(args[0]))physicsManager.setGravityPreset(args[0]);else if(args.length>=3&&args.slice(0,3).every(v=>Number.isFinite(Number(v))))state.physics.gravity=args.slice(0,3).map(Number);status(`Gravity ${state.physics.gravity.join(',')}`,'command')}
 else if(cmd==='DROP'){for(const p of state.selectedObjects())physicsManager.unfreeze(p);state.physics.enabled=true;status('DROP','command')}
 else if(cmd==='FREEZE'){for(const p of state.selectedObjects())physicsManager.freeze(p);status('FREEZE','command')}
 else if(cmd==='UNFREEZE'){for(const p of state.selectedObjects())physicsManager.unfreeze(p);status('UNFREEZE','command')}
 else if(cmd==='GENERATE'||cmd==='GACHA'){const made=generatorWorkbench.generate({count:Number(args[0])||6,spacing:Number(args[1])||80,seed:Number(args[2])||1});refresh();status(`GENERATE ${made.length}`,'command')}
 else if(cmd==='AVATAR'){const mode=(args[0]||'TPV').toLowerCase();if(mode==='walk'){avatarManager.startWalking();status('Avatar WALK','command')}else if(mode==='stop'){avatarManager.stopWalking();status('Avatar STOP','command')}else{avatarManager.setMode(mode==='fpv'?'fpv':mode==='orbit'?'orbit':'tpv');status(`Avatar ${mode.toUpperCase()}`,'command')}}
 else if(cmd==='PLACE'){placementManager.setEnabled(!/^(0|OFF|FALSE)$/i.test(args[0]||'ON'));$('#placeBtn').classList.toggle('active',placementManager.enabled);status(`Placement ${placementManager.enabled?'ON':'OFF'}`,'command')}
 else if(cmd==='LOCK'||cmd==='ANCHOR'){const parts=state.selectedObjects();for(const p of parts){p.locked=true;physicsManager?.freeze?.(p)}placementManager.setEnabled(false);$('#placeBtn').classList.remove('active');status(`⚓ ${parts.length} model(s) locked`,'command')}
 else if(cmd==='EDITMOVE'||cmd==='UNLOCK'){const parts=state.selectedObjects();for(const p of parts)p.locked=false;placementManager.setEnabled(true);$('#placeBtn').classList.add('active');status(`✒ ${parts.length} model(s) editable`,'command')}
 else if(cmd==='LIFE'||cmd==='SOUL'||cmd==='HEART'){const p=state.objectByPublicId(args[0])||state.primary();if(!p)status('Life Core対象を選択してください','error');else{const on=!/^(0|OFF|FALSE|REMOVE)$/i.test(args[1]||args[0]||'ON');setComponent(p,'lifeCore',on);refresh();status(`${p.objectId} Life Core ${on?'ON':'OFF'}`,'command')}}
 else if(cmd==='BRAIN'){const p=state.objectByPublicId(args[0])||state.primary();if(!p)status('Brain対象を選択してください','error');else{const on=!/^(0|OFF|FALSE|REMOVE)$/i.test(args[1]||args[0]||'ON');setComponent(p,'brain',on);refresh();status(`${p.objectId} Brain ${on?'ON':'OFF'}`,'command')}}
 else if(cmd==='JOINT'||cmd==='RIG'||cmd==='POSE'){openJointEditorDialog();if(args[0]){const name=args[0];if(avatarManager.setActiveJoint(name)){const vec=parseVectorToken(args[1])||(args.length>=4?args.slice(1,4).map(Number):null);if(vec&&vec.length>=3&&vec.slice(0,3).every(Number.isFinite)){avatarManager.setJointRotation(name,vec.slice(0,3));syncJointEditorFromSelection();status(`JOINT ${name} = ${vec.slice(0,3).join(',')}`,'command')}}else status(`関節がありません: ${name}`,'error')}}
 else if(cmd==='SKELETON'){const mode=(args[0]||'DUMMY').toLowerCase();state.avatar.rig={...(state.avatar.rig||{}),anatomyLevel:mode};status(`Skeleton level: ${mode}`,'command')}
 else if(cmd==='CHARACTER'||cmd==='CHARMAKE'){openCharacterDialog()}
 else if(cmd==='DESIGNSCALE'||cmd==='DSCALE'){const v=args[0]||'1:1';workspaceManager.setDesignScale(v.includes(':')?v:`1:${v}`);status(`Design Scale ${state.workspace.designScale}`,'command')}
 else if(cmd==='HOLD'||cmd==='GRAB'){const hand=String(args[0]||'RIGHT').toLowerCase()==='left'?'left':'right';if(handEquipment?.holdSelected?.(hand)){status(`HOLD ${hand.toUpperCase()}`,'command');refresh()}else status('持つオブジェクトを選択してください','error')}
 else if(cmd==='DROPTOOL'||cmd==='RELEASE'){const hand=String(args[0]||'RIGHT').toLowerCase()==='left'?'left':'right';handEquipment?.drop?.(hand);status(`DROP ${hand.toUpperCase()}`,'command');refresh()}
 else if(cmd==='SPACEPART'){const p=spacecraftParts.create(String(args[0]||'engine').toLowerCase());refresh();status(`SPACEPART ${p?.name||''}`,'command')}
 else if(cmd==='SPACECRAFT'){const sub=String(args[0]||'STATUS').toUpperCase();try{if(sub==='ASSEMBLE')spacecraftFlight.assembleSelected();else if(sub==='BOARD')spacecraftFlight.board();else if(sub==='UNBOARD')spacecraftFlight.unboard();else if(sub==='LAUNCH')spacecraftFlight.launch();else if(sub==='ORBIT')spacecraftFlight.setOrbit(args[1]);else if(sub==='TRANSFER')spacecraftFlight.transfer(args[1]);else if(sub==='LAND')spacecraftFlight.land();else if(sub==='THROTTLE')spacecraftFlight.setThrottle((Number(args[1])||0)/100);else if(sub==='BURN')spacecraftFlight.burn(args[1]||'prograde',Number(args[2])||1);else if(sub==='CAMERA')spacecraftFlight.setCameraMode(args[1]||'cockpit');else if(sub==='WALK')spacecraftFlight.enterWalkMode(args[1]||'tpv');else if(sub==='SEAT')spacecraftFlight.exitWalkMode();else if(sub==='MODIFY')spacecraftFlight.setModifyMode(String(args[1]||'ON').toUpperCase()!=='OFF');status(spacecraftFlight.status(),'command')}catch(e){status(e.message,'error')}}
 else if(cmd==='CELESTIALNAME'){const id=String(args.shift()||'');planetManager.setCelestialName(id,args.join(' ')||id);status(`Celestial ${id} renamed`,'command')}
 else if(cmd==='CELESTIALLABEL'){const id=String(args[0]||'');planetManager.setCelestialLabelVisible(id,!/^(0|OFF|FALSE)$/i.test(args[1]||'ON'));status(`Celestial label ${id}`,'command')}
 else if(cmd==='PLANET'||cmd==='WORLD'){const sub=String(args[0]||'TOGGLE').toUpperCase();if(sub==='OFF'||sub==='LEAVE'){planetManager.leaveAvatar(avatarManager);status('Planet mode OFF','command')}else if(sub==='RADIUS'){state.planet.radiusMm=Math.max(1000,Number(args[1])||1000000);planetManager.rebuild();status(`Planet radius ${state.planet.radiusMm} mm`,'command')}else if(sub==='TERRAIN'){state.planet.terrainAmplitudeMm=Math.max(0,Number(args[1])||10000);planetManager.rebuild();status(`Terrain amplitude ${state.planet.terrainAmplitudeMm} mm`,'command')}else if(sub==='SEED'){state.planet.seed=Number(args[1])||1;planetManager.rebuild();status(`Planet seed ${state.planet.seed}`,'command')}else if(sub==='WATERADIUS'||sub==='WATERRADIUS'){state.planet.waterRadiusMm=Math.max(1000,Number(args[1])||Math.max(1000,state.planet.radiusMm-300));planetManager.rebuild();status(`Water radius ${state.planet.waterRadiusMm} mm`,'command')}else if(sub==='WAVE'){state.planet.waveAmplitudeMm=Math.max(0,Number(args[1])||0);planetManager.rebuild();status(`Wave amplitude ${state.planet.waveAmplitudeMm} mm`,'command')}else if(sub==='RIVERS'){state.planet.rivers=!/^(0|OFF|FALSE)$/i.test(args[1]||'ON');if(args[2]!=null)state.planet.riverCount=Math.max(0,Math.min(32,Number(args[2])||0));planetManager.rebuild();status(`Planet rivers ${state.planet.rivers?'ON':'OFF'} (${state.planet.riverCount})`,'command')}else if(sub==='VEGETATION'||sub==='TREES'){state.planet.vegetation=!/^(0|OFF|FALSE)$/i.test(args[1]||'ON');if(args[2]!=null)state.planet.vegetationDensity=Math.max(0,Math.min(1200,Number(args[2])||0));planetManager.rebuild();status(`Planet vegetation ${state.planet.vegetation?'ON':'OFF'} (${state.planet.vegetationDensity})`,'command')}else if(sub==='BIOMES'){state.planet.biomes=!/^(0|OFF|FALSE)$/i.test(args[1]||'ON');planetManager.rebuild();status(`Planet biomes ${state.planet.biomes?'ON':'OFF'}`,'command')}else if(sub==='ON'||sub==='ENTER'||sub==='TOGGLE'){if(sub==='TOGGLE'&&state.planet.enabled)planetManager.leaveAvatar(avatarManager);else planetManager.spawnAvatar(avatarManager);status(`Planet mode ${state.planet.enabled?'ON':'OFF'}`,'command')}}
 else if(cmd==='RUN'){state.avatar.locomotion.running=true;avatarManager.startWalking();status('Avatar RUN','command')}
 else if(cmd==='JUMP'){avatarManager.jump();status('Avatar JUMP','command')}
 else if(cmd==='MOTIONAXIS'||cmd==='AXIS'){if(args[0]&&args[1]!=null){const p=commandObjectTargets(args[0])[0]||state.primary();if(!p)throw new Error('対象なし');const a=ensureMotionAxes(p).find(x=>x.id===args[1]||x.name===args[1]);if(!a)throw new Error('可動軸なし');if(args[2]!=null)a.value=Number(args[2])||0;applyMotionAxis(p,a,scene);refresh();status(`AXIS ${p.objectId} ${a.id} ${a.value}`,'command')}else openMotionAxisDialog()}
 else if(cmd==='SOCKET'){openSocketDialog()}
 else if(cmd==='ASSEMBLY'||cmd==='MATE'){openAssemblyDialog()}
 else if(cmd==='ASSEMBLYAPPLY'||cmd==='MATEAPPLY'){const n=applyAllAssemblyConstraints(state,scene);refresh();status(`Assembly apply ${n}`,'command')}
 else if(cmd==='UNION'||cmd==='JOIN'){booleanDirect('join',args[0],args[1])}
 else if(cmd==='DIFFERENCE'||cmd==='SUBTRACT'||cmd==='CUT'){booleanDirect('cut',args[0],args[1])}
 else if(cmd==='INTERSECTION'||cmd==='INTERSECT'){booleanDirect('intersect',args[0],args[1])}
 else if(cmd==='PROTOTYPE'||cmd==='INSTANCE'){makePrototype()}
 else if(cmd==='SYNCPROTOTYPES'||cmd==='SYNCPROTO'){syncPrototypes()}
 else if(cmd==='CREATOR'){const sub=String(args[0]||'TOGGLE').toUpperCase();creatorMode?.setEnabled?.(sub==='ON'?true:sub==='OFF'?false:!state.creator?.enabled);updateScaleHud();status(`Creator ${state.creator?.enabled?'ON':'OFF'}`,'command')}
 else if(cmd==='CREATORSCALE'){const mm=Number(args[0]);if(!Number.isFinite(mm)||mm<=0)throw new Error('CREATORSCALE <mm>');creatorMode?.setEnabled?.(true);creatorMode?.setScaleMm?.(mm);updateScaleHud();status(`Creator scale ${mm} mm/unit`,'command')}
 else if(cmd==='FOCUSMARK'){const on=String(args[0]||'TOGGLE').toUpperCase();state.creator.focusMarker=on==='ON'?true:on==='OFF'?false:!state.creator.focusMarker;creatorMode?.apply?.();status(`Focus marker ${state.creator.focusMarker?'ON':'OFF'}`,'command')}
 else if(cmd==='CREATEORIGIN'){const mode=String(args[0]||'VIEW').toLowerCase();const map={bench:'workbench',workbench:'workbench',avatar:'avatar',aim:'aim',cursor:'aim',custom:'custom',view:'view'};state.creator.createOrigin=map[mode]||'view';if(state.creator.createOrigin==='custom'&&args.length>=4)state.creator.customOrigin=args.slice(1,4).map(Number);creatorMode?.syncUi?.();status(`Create origin ${state.creator.createOrigin}`,'command')}
 else if(cmd==='CREATORANCHOR'){const on=String(args[0]||'ON').toUpperCase();creatorMode?.setAnchorToWorkbench?.(on!=='OFF');status(`Workbench anchor ${state.creator.anchorToWorkbench?'ON':'OFF'}`,'command')}
 else if(cmd==='ISCALE'||cmd==='SCALELEVEL'){const token=String(args[0]||'mm').toLowerCase();const level=infiniteScaleCore.setLevel(token);if(args[1]!=null)infiniteScaleCore.setVisualScale(Number(args[1])||1);infiniteScaleCore.applyToScene();updateScaleHud();status(`InfiniteScale ${level.label} / ${state.infiniteScale.metersPerUnit} m/unit`,'command')}
 else if(cmd==='BENCHSTORE'){const ok=portableWorkbench?.store?.(args[0]);portableWorkbench?.rebuild?.();status(ok?'作業台をインベントリへ収納':'作業台が見つかりません','command')}
 else if(cmd==='BENCHDEPLOY'){const wb=portableWorkbench?.deploy?.(args[0]);status(wb?`作業台を${wb.location==='planet'?'フィールド':'屋内'}へ設置`:'収納中の作業台がありません','command')}
 else if(cmd==='BUILD'){const k=String(args[0]||'').toLowerCase(),map={column:'column',pillar:'column','柱':'column',floor:'floor','床':'floor',wall:'wall','壁':'wall',roof:'roof','屋根':'roof'};if(['door','window','stairs','ladder'].includes(k)){const fn={door:'createDoor',window:'createWindow',stairs:'createStairsFitSelection',ladder:'createLadderFitSelection'}[k];const made=buildingAccess?.[fn]?.()||[];refresh();status(`${k} ${made.length} parts`,'command')}else{const o=buildingPrimitives?.create?.(map[k]);status(o?`${o.name}を作成`:'BUILD column/floor/wall/roof/door/window/stairs/ladder','command')}}
 else if(cmd==='BUILDASSIST'){const sub=String(args[0]||'OPEN').toUpperCase();if(sub==='LINE'){const made=buildingAssist.createColumnLine({count:Number(args[1])||undefined,spacing:Number(args[2])||undefined,axis:args[3]||undefined});refresh();status(`BUILDASSIST LINE ${made.length}`,'command')}else if(sub==='GRID'){const made=buildingAssist.createColumnGrid({cols:Number(args[1])||undefined,rows:Number(args[2])||undefined,spacingX:Number(args[3])||undefined,spacingY:Number(args[4])||undefined});refresh();status(`BUILDASSIST GRID ${made.length}`,'command')}else if(sub==='WALL'){const made=buildingAssist.wallBetweenSelected();refresh();status(`BUILDASSIST WALL ${made.length}`,'command')}else if(sub==='PERIMETER'){const made=buildingAssist.wallPerimeterFromSelection();refresh();status(`BUILDASSIST PERIMETER ${made.length}`,'command')}else if(sub==='FLOOR'){buildingAssist.floorFromSelection();refresh();status('BUILDASSIST FLOOR','command')}else if(sub==='ROOF'){buildingAssist.roofFromSelection();refresh();status('BUILDASSIST ROOF','command')}else if(sub==='HOUSE'){const made=buildingAssist.createSmartBuilding({width:Number(args[1])||6000,depth:Number(args[2])||6000,floors:Number(args[3])||1,baysX:Number(args[4])||3,baysY:Number(args[5])||3,storyHeight:Number(args[6])||2800});refresh();status(`BUILDASSIST HOUSE ${made.length}`,'command')}else{$("#buildingAssistBtn").click()}}
 else if(cmd==='DOOR'){const a0=String(args[0]||'').toUpperCase(),a1=String(args[1]||'').toUpperCase(),scope=a0==='ALL'?'all':'selected',act=(a0==='OPEN'||a1==='OPEN')?'open':(a0==='CLOSE'||a1==='CLOSE')?'close':'toggle',ds=buildingAccess?.toggleDoors?.({scope,action:act})||[];refresh();status(ds.length?`DOOR ${act.toUpperCase()} ×${ds.length}`:'ドアが見つかりません',ds.length?'command':'error')}
 else if(cmd==='BUILDPLACE'){const sub=String(args[0]||'OFF').toLowerCase();const tool=liveBuildingPlacement?.setTool?.(sub);status(`BUILDPLACE ${tool}`,'command')}
 else if(cmd==='MARKET'){renderMarketDialog();$('#marketDialog').classList.add('show');status('Marketplace','command')}
 else if(cmd==='RECIPE'){const sub=String(args[0]||'OPEN').toUpperCase();if(sub==='SAVE'){const name=args.slice(1).join(' ')||'Recipe';const r=recipeBlueprint.saveSelection({name});status(`RECIPE SAVE ${r.name}`,'command')}else if(sub==='PLACE'){const made=recipeBlueprint.instantiate(args[1],creatorMode?.creationPositionCad?.()||[0,0,0]);refresh();status(`RECIPE PLACE ${made.length}`,'command')}else{$("#recipeBtn").click()}}
 else if(cmd==='WORKBENCH'||cmd==='BENCH'){const sub=String(args[0]||'TOGGLE').toUpperCase();if(sub==='ENTER'||sub==='ON')seamlessWorld.enterWorkbench();else if(sub==='LEAVE'||sub==='OFF')seamlessWorld.leaveWorkbench();else seamlessWorld.toggleWorkbench();updateScaleHud();status(`Workbench ${state.seamless?.workbenchActive?'ENTER':'LEAVE'}`,'command')}
 else if(cmd==='OUTSIDE'||cmd==='EXPLORE'){seamlessWorld.goOutside(String(args[0]||'').toLowerCase()==='fpv'?'fpv':'tpv');updateScaleHud();status('Planet exterior','command')}
 else if(cmd==='INTERIOR'||cmd==='HOME'){seamlessWorld.returnInterior();updateScaleHud();status('Building interior','command')}
 else if(cmd==='PORTALENTER'){const p=commandObjectTargets(args[0]||'')[0]||state.primary();if(!p)throw new Error('PORTALENTER <ObjectID> [scale]');infiniteScaleCore.enterEntity(p,Number(args[1])||1);status(`Portal enter ${p.objectId}`,'command')}
 else if(cmd==='PORTALLEAVE'){infiniteScaleCore.leaveEntity();status('Portal leave','command')}
 else if(cmd==='CHARATTACH'){const p=commandObjectTargets(args[0]||'')[0]||state.primary();if(!p)throw new Error('CHARATTACH <ObjectID>');livingCharacterCore.attach(p);status(`Character core ${p.objectId}`,'command')}
 else if(cmd==='ANATOMY'){const p=commandObjectTargets(args[0]||'')[0]||state.primary();if(!p)throw new Error('ANATOMY <ObjectID> <dummy|skeleton|muscle|skin>');const level=args[1]||'dummy';livingCharacterCore.setAnatomyLevel(p,level);status(`Anatomy ${p.objectId} ${level}`,'command')}
 else if(cmd==='MECHPLAY'){mechanicalSolver.setRunning(true);status('Mechanical simulation PLAY','command')}
 else if(cmd==='MECHPAUSE'){mechanicalSolver.setRunning(false);status('Mechanical simulation PAUSE','command')}
 else if(cmd==='MOTOR'){const part=commandObjectTargets(args[0]||'')[0]||state.primary();if(!part)throw new Error('MOTOR <ObjectID> <AxisID> <RPM>');mechanicalSolver.addMotor({axis:{partId:part.id,axisId:args[1]},rpm:Number(args[2])||60,torque:Number(args[3])||1});status(`Motor ${part.objectId}/${args[1]} ${Number(args[2])||60}rpm`,'command')}
 else if(cmd==='MECHLINK'){const a=commandObjectTargets(args[0]||'')[0],b=commandObjectTargets(args[2]||'')[0];if(!a||!b)throw new Error('MECHLINK <ObjA> <AxisA> <ObjB> <AxisB> <type> <ratio>');const type=String(args[4]||'gear').toLowerCase(),ratio=Number(args[5])||1;mechanicalSolver.addLink({type,source:{partId:a.id,axisId:args[1]},target:{partId:b.id,axisId:args[3]},ratio});status(`Mechanical link ${type} ${a.objectId}:${args[1]} -> ${b.objectId}:${args[3]} x${ratio}`,'command')}
 else if(cmd==='BOM'){const rows=manufacturingCore.bom();console.table(rows);status(`BOM ${rows.length} parts (console.table)`,'command')}
 else if(cmd==='PARTMETA'){const p=commandObjectTargets(args[0]||'')[0]||state.primary();if(!p)throw new Error('PARTMETA <ObjectID> <material> [partNumber]');manufacturingCore.setPart(p,{material:args[1]||'UNSPECIFIED',partNumber:args[2]||p.objectId});status(`Part meta ${p.objectId} ${ensureManufacturingPart(p).material}`,'command')}
 else if(cmd==='BLUEPRINT'){const p=commandObjectTargets(args[0]||'')[0]||state.primary();if(!p)throw new Error('BLUEPRINT <ObjectID>');const bp=manufacturingCore.createBlueprint(p);status(`Blueprint ${bp.id} <- ${p.objectId}`,'command')}
 else if(cmd==='CAMTOOL'){const t=camCore.addTool({id:args[0]||undefined,name:args[1]||args[0],type:args[2]||'endmill',diameter:Number(args[3])||6,feed:Number(args[4])||600,spindle:Number(args[5])||8000});status(`CAM tool ${t.id} ${t.name} Ø${t.diameter}`,'command')}
 else if(cmd==='CAMOP'){const p=commandObjectTargets(args[0]||'')[0]||state.primary();if(!p)throw new Error('CAMOP <ObjectID> <contour|pocket|drill> [depth] [toolId]');const op=camCore.addOperation(p,{type:args[1]||'contour',depth:Number(args[2])||2,toolId:args[3]||'T01',stepDown:Number(args[4])||1,stepOver:Number(args[5])||.5});status(`CAM operation ${op.id} ${op.type} depth=${op.depth}`,'command')}
 else if(cmd==='CAMGEN'){const p=commandObjectTargets(args[0]||'')[0]||state.primary();if(!p)throw new Error('CAMGEN <ObjectID> [OperationID]');const path=camCore.generate(p,args[1]||state.cam.operations.filter(o=>o.partId===p.id).at(-1));status(`ToolPath ${path.id} / ${path.moves.length} moves / ${path.estimatedSeconds.toFixed(1)}s`,'command')}
 else if(cmd==='CAMGCODE'){const text=camCore.generateGCode(args[0]);console.log(text);status(`G-code generated ${text.split('\n').length} lines (console)`,'command')}
 else if(cmd==='CAMEXPORT'){const fn=camCore.exportNC(args[0]||'universe-engine.nc');status(`NC exported ${fn}`,'command')}
 else if(cmd==='CAMSIM'){const sim=camCore.simulate(args[0]);status(`CAM simulation ${sim.pathId} ready. CAMSTEP で進めます`,'command')}
 else if(cmd==='CAMSTEP'){const m=camCore.step();status(m?`CAM ${m.mode} X${m.x.toFixed(3)} Y${m.y.toFixed(3)} Z${m.z.toFixed(3)}`:'CAM simulation finished','command')}
 else if(cmd==='FACTORYMACHINE'){const m=factoryManager.addMachine({id:args[0],type:args[1]||'machining-center',cycleTime:Number(args[2])||10});status(`Factory machine ${m.id} ${m.type}`,'command')}
 else if(cmd==='FACTORYJOB'){const p=commandObjectTargets(args[1]||'')[0]||state.primary();const j=factoryManager.enqueue(args[0],{partId:p?.id||null,duration:Number(args[2])||10,name:args[3]||'Machining'});status(`Factory job ${j.id} -> ${args[0]}`,'command')}
 else if(cmd==='FACTORYPLAY'){factoryManager.setRunning(true);status('Factory simulation PLAY','command')}
 else if(cmd==='FACTORYPAUSE'){factoryManager.setRunning(false);status('Factory simulation PAUSE','command')}
 else if(cmd==='FACTORYSTEP'){const done=factoryManager.update(Number(args[0])||1);status(`Factory step +${Number(args[0])||1}s / completed ${done.length}`,'command')}
 else if(cmd==='FACTORYSTATUS'){console.table(factoryManager.summary().machines);status('Factory status (console.table)','command')}
 else if(cmd==='HELP'||cmd==='?'){status('例: CAMOP 16AZ pocket 5 T01 / CAMGEN 16AZ / CAMGCODE / CAMEXPORT part.nc / FACTORYMACHINE MC01 machining-center 12 / FACTORYJOB MC01 16AZ 12 / FACTORYPLAY / FACTORYSTEP 1','command')}
 else status(`不明なコマンド: ${cmd}`,'error');
}
const commandRecall=[];let commandRecallIndex=0;$('#commandInput').addEventListener('keydown',event=>{if(event.key==='Enter'){const v=event.currentTarget.value.trim();if(v){commandRecall.push(v);commandRecallIndex=commandRecall.length;executeCommand(v)}event.currentTarget.value=''}else if(event.key==='ArrowUp'){event.preventDefault();commandRecallIndex=Math.max(0,commandRecallIndex-1);event.currentTarget.value=commandRecall[commandRecallIndex]||''}else if(event.key==='ArrowDown'){event.preventDefault();commandRecallIndex=Math.min(commandRecall.length,commandRecallIndex+1);event.currentTarget.value=commandRecall[commandRecallIndex]||''}event.stopPropagation()});

function openPlanetDialog(){planetManager.ensureState();$('#planetEnabled').checked=!!state.planet.enabled;$('#planetRadius').value=state.planet.radiusMm;$('#planetTerrain').value=state.planet.terrainAmplitudeMm;$('#planetSpawnElevation').value=state.planet.spawnElevationMm||1000;$('#planetLandFraction').value=Math.round((Number(state.planet.landFractionTarget)||.30)*100);$('#planetCelestialLabels').checked=state.planet.celestialLabelsVisible!==false;$('#planetSeed').value=state.planet.seed;$('#planetContinents').checked=state.planet.continents!==false;$('#planetMountains').checked=state.planet.mountains!==false;$('#planetContinentScale').value=state.planet.continentScale||.72;$('#planetDetailStrength').value=state.planet.terrainDetailStrength||1;$('#planetRoughness').value=state.planet.terrainRoughness||1;$('#planetMountainSharpness').value=state.planet.mountainSharpness||2.25;$('#planetValleyStrength').value=state.planet.valleyStrength??.65;$('#planetPlateauStrength').value=state.planet.plateauStrength??.45;$('#planetCliffStrength').value=state.planet.cliffStrength??.35;$('#planetIslandStrength').value=state.planet.islandStrength??.30;$('#planetErosionStrength').value=state.planet.erosionStrength??.55;$('#planetBiomes').checked=state.planet.biomes!==false;$('#planetWater').checked=state.planet.water!==false;$('#planetWaterRadius').value=Number(state.planet.waterRadiusMm)||Math.max(1000,(Number(state.planet.radiusMm)||1000000)+(Number(state.planet.waterRenderOffsetMm)||-300));$('#planetWaveAmplitude').value=Number(state.planet.waveAmplitudeMm)||220;$('#planetRivers').checked=state.planet.rivers!==false;$('#planetRiverCount').value=state.planet.riverCount??7;$('#planetVegetation').checked=state.planet.vegetation!==false;$('#planetVegetationDensity').value=state.planet.vegetationDensity??180;$('#planetAtmosphere').checked=state.planet.atmosphere!==false;$('#planetDialog').classList.add('show')}
function applyPlanetDialog(){planetManager.ensureState();state.planet.radiusMm=Math.max(1000,Number($('#planetRadius').value)||1000000);state.planet.terrainAmplitudeMm=Math.max(0,Number($('#planetTerrain').value)||10000);state.planet.spawnElevationMm=Math.max(0,Number($('#planetSpawnElevation').value)||1000);state.planet.landFractionTarget=Math.max(.05,Math.min(.85,(Number($('#planetLandFraction').value)||30)/100));state.planet.celestialLabelsVisible=$('#planetCelestialLabels').checked;state.planet.seed=Number($('#planetSeed').value)||1;state.planet.continents=$('#planetContinents').checked;state.planet.mountains=$('#planetMountains').checked;state.planet.continentScale=Math.max(.25,Math.min(2.5,Number($('#planetContinentScale').value)||.72));state.planet.terrainDetailStrength=Math.max(0,Math.min(2.5,Number($('#planetDetailStrength').value)||1));state.planet.terrainRoughness=Math.max(.2,Math.min(3,Number($('#planetRoughness').value)||1));state.planet.mountainSharpness=Math.max(1,Math.min(6,Number($('#planetMountainSharpness').value)||2.25));state.planet.valleyStrength=Math.max(0,Math.min(2,Number($('#planetValleyStrength').value)||0));state.planet.plateauStrength=Math.max(0,Math.min(2,Number($('#planetPlateauStrength').value)||0));state.planet.cliffStrength=Math.max(0,Math.min(2,Number($('#planetCliffStrength').value)||0));state.planet.islandStrength=Math.max(0,Math.min(2,Number($('#planetIslandStrength').value)||0));state.planet.erosionStrength=Math.max(0,Math.min(2,Number($('#planetErosionStrength').value)||0));state.planet.biomes=$('#planetBiomes').checked;state.planet.water=$('#planetWater').checked;state.planet.waterRadiusMm=Math.max(1000,Number($('#planetWaterRadius').value)||Math.max(1000,state.planet.radiusMm-300));state.planet.waveAmplitudeMm=Math.max(0,Number($('#planetWaveAmplitude').value)||0);state.planet.rivers=$('#planetRivers').checked;state.planet.riverCount=Math.max(0,Math.min(32,Number($('#planetRiverCount').value)||0));state.planet.vegetation=$('#planetVegetation').checked;state.planet.vegetationDensity=Math.max(0,Math.min(1200,Number($('#planetVegetationDensity').value)||0));state.planet.atmosphere=$('#planetAtmosphere').checked;planetManager.rebuild();if($('#planetEnabled').checked)planetManager.spawnAvatar(avatarManager);else planetManager.leaveAvatar(avatarManager);$('#planetDialog').classList.remove('show');status(`Planet ${state.planet.enabled?'ON':'OFF'} / R=${state.planet.radiusMm} mm / land≈${(planetManager.estimateLandFraction()*100).toFixed(1)}% / spawn≈${state.planet.spawnElevationMm} mm / rivers=${state.planet.riverCount} / vegetation=${state.planet.vegetationDensity}`,'command')}
function openWorkspaceDialog(){
  const presets=WorkspaceManager.presets();
  $("#workspacePreset").innerHTML=Object.entries(presets).map(([k,v])=>`<option value="${k}" ${state.workspace?.preset===k?"selected":""}>${v.label}</option>`).join("");
  if($("#workspaceScale")&&!$("#workspaceScale").dataset?.missingSelector){$("#workspaceScale").innerHTML=Object.keys(WorkspaceManager.designScales()).map(v=>`<option value="${v}" ${state.workspace?.designScale===v?"selected":""}>${v}</option>`).join("");}
  $("#workspaceDialog").classList.add("show");
}
let pendingMontageFace={baseImage:"",eyesImage:"",noseImage:"",mouthImage:""};
function bindMontageImageInput(id,key){const el=$(id);if(!el)return;el.onchange=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{pendingMontageFace[key]=String(r.result||"");$("#characterFaceMode").value="montage"};r.readAsDataURL(f)}}
bindMontageImageInput("#characterFaceBase","baseImage");bindMontageImageInput("#characterFaceEyes","eyesImage");bindMontageImageInput("#characterFaceNose","noseImage");bindMontageImageInput("#characterFaceMouth","mouthImage");
function openCharacterDialog(){
  avatarManager?.ensureState?.();
  const a=state.avatar||{},ap=a.appearance||{},m=ap.montage||{};pendingMontageFace={baseImage:m.baseImage||"",eyesImage:m.eyesImage||"",noseImage:m.noseImage||"",mouthImage:m.mouthImage||""};
  $("#characterTarget").value="player";$("#characterName").value=a.name||"Player";$("#characterHeight").value=a.height||170;$("#characterSkin").value=ap.skin||"#c28b6d";$("#characterBody").value=ap.body||"#5ea6d6";$("#characterHair").value=ap.hair||"#2b1d18";$("#characterEye").value=ap.eye||"#4c7695";$("#characterFaceMode").value=ap.faceMode||"3d";$("#characterFaceWrap").value=Number(m.wrap)||.72;$("#characterMouthOpen").value=Number(m.mouthOpen)||0;$("#characterBlink").checked=a.blink!==false;$("#characterBrain").checked=true;$("#characterDialog").classList.add("show");
}
function applyCharacterDialog(){
  const montage={...pendingMontageFace,wrap:Number($("#characterFaceWrap").value)||.72,mouthOpen:Number($("#characterMouthOpen").value)||0};
  const profile={name:$("#characterName").value||"Character",height:Math.max(80,Number($("#characterHeight").value)||170),skin:$("#characterSkin").value,body:$("#characterBody").value,hair:$("#characterHair").value,eye:$("#characterEye").value,faceMode:$("#characterFaceMode").value,montage,blink:$("#characterBlink").checked,brain:$("#characterBrain").checked};
  if($("#characterTarget").value==="player"){state.avatar.name=profile.name;state.avatar.height=profile.height;state.avatar.blink=profile.blink;state.avatar.appearance={...(state.avatar.appearance||{}),skin:profile.skin,body:profile.body,hair:profile.hair,eye:profile.eye,faceMode:profile.faceMode,montage:profile.montage};avatarManager.build();avatarManager.sync();status(`Player Character: ${profile.name} / Face ${profile.faceMode}`,"command");}
  else{const npc=npcManager.create({...profile,appearance:{skin:profile.skin,body:profile.body,hair:profile.hair,eye:profile.eye,faceMode:profile.faceMode,montage:profile.montage},lifeCore:true,brain:profile.brain});status(`NPC作成: ${npc.id} ${npc.name}`,"command");}
  $("#characterDialog").classList.remove("show");refresh();
}

function syncJointEditorFromSelection(){
  if(!avatarManager)return;
  avatarManager.ensureState();
  const defs=avatarManager.getJointDefinitions();
  const sel=$("#jointSelect");
  if(!sel||sel.dataset?.missingSelector)return;
  const current=state.avatar?.rig?.activeJoint||defs[0]?.name||'pelvis';
  if(!sel.options.length||sel.options.length!==defs.length)sel.innerHTML=defs.map(d=>`<option value="${d.name}">${d.name}</option>`).join('');
  sel.value=defs.some(d=>d.name===current)?current:(defs[0]?.name||'');
  avatarManager.setActiveJoint(sel.value);
  const def=defs.find(d=>d.name===sel.value);if(!def)return;
  const rot=avatarManager.jointRotation(sel.value),axes=['X','Y','Z'];
  axes.forEach((a,i)=>{const input=$("#jointR"+a),out=$("#jointR"+a+"Value"),range=def.limits?.[a.toLowerCase()]||[-180,180];input.min=range[0];input.max=range[1];input.value=rot[i];out.textContent=`${rot[i]}°`});
  $("#jointMarkers").checked=state.avatar?.rig?.jointMarkers!==false;
  $("#rigAnatomyLevel").value=state.avatar?.rig?.anatomyLevel||'dummy';
}
function openJointEditorDialog(){avatarManager?.ensureState?.();syncJointEditorFromSelection();$("#jointEditorDialog").classList.add("show")}
function applyJointEditorRotation(){const name=$("#jointSelect").value;if(!name)return;const values=['X','Y','Z'].map(a=>Number($("#jointR"+a).value)||0);avatarManager.setJointRotation(name,values,true);['X','Y','Z'].forEach((a,i)=>$("#jointR"+a+"Value").textContent=`${values[i]}°`);avatarManager.setActiveJoint(name)}

function openPhysicsDialog(){
  const cfg=state.physics||{};$("#physicsEnabled").checked=!!cfg.enabled;$("#gravityPreset").value=Math.abs((cfg.gravity?.[2]??0)+9.80665)<.01?"earth":Math.abs(cfg.gravity?.[2]??0)<.01?"zero":"custom";
  $("#gravityX").value=cfg.gravity?.[0]??0;$("#gravityY").value=cfg.gravity?.[1]??0;$("#gravityZ").value=cfg.gravity?.[2]??-9.80665;
  const p=state.primary();if(p){physicsManager.ensurePart(p);$("#partPhysicsEnabled").checked=!!p.physics.enabled;$("#partBodyType").value=p.physics.bodyType;$("#partMass").value=p.physics.mass}else{$("#partPhysicsEnabled").checked=false}
  $("#physicsDialog").classList.add("show");
}
function applyPhysicsDialog(){
  state.physics.enabled=$("#physicsEnabled").checked;state.physics.gravity=[$("#gravityX").value,$("#gravityY").value,$("#gravityZ").value].map(Number);
  const p=state.primary();if(p){const ph=physicsManager.ensurePart(p);ph.enabled=$("#partPhysicsEnabled").checked;ph.bodyType=$("#partBodyType").value;ph.mass=Math.max(.001,Number($("#partMass").value)||1);ph.sleeping=false}
  physicsManager.last=performance.now();$("#physicsDialog").classList.remove("show");status(`Physics ${state.physics.enabled?"ON":"OFF"} / gravity ${state.physics.gravity.join(",")}`,"command");refresh();
}
$("#creatorModeBtn").onclick=()=>{creatorMode?.setEnabled?.(!state.creator?.enabled);updateScaleHud();status(`Creator ${state.creator?.enabled?"ON":"OFF"}`,"command")};
$("#workspaceBtn").onclick=openWorkspaceDialog;$("#physicsBtn").onclick=openPhysicsDialog;$("#planetBtn").onclick=openPlanetDialog;
$("#scaleWorkbenchBtn").onclick=()=>{creatorMode?.setEnabled?.(true);creatorMode?.setAnchorToWorkbench?.(true);updateScaleHud();status("Creator: 作業台をデザイン空間の起点に設定","command")};
$("#outsideBtn").onclick=()=>{seamlessWorld.goOutside(state.avatar?.mode==="fpv"?"fpv":"tpv");updateScaleHud();status("屋外へ移動","command")};
$("#scaleInBtn").onclick=()=>{creatorMode?.setEnabled?.(true);infiniteScaleCore.stepLevel(-1);infiniteScaleCore.applyToScene();creatorMode?.syncUi?.();updateScaleHud()};
$("#scaleOutBtn").onclick=()=>{creatorMode?.setEnabled?.(true);infiniteScaleCore.stepLevel(1);infiniteScaleCore.applyToScene();creatorMode?.syncUi?.();updateScaleHud()};
$("#benchInventoryBtn").onclick=()=>{$("#workbenchInventoryDialog").classList.add("show");renderWorkbenchInventory()};
$("#buildColumnBtn").onclick=()=>{buildingPrimitives.create("column");status("建築 柱を作成","command")};
$("#buildingAssistBtn").onclick=()=>{renderBuildingAssistDialog();$("#buildingAssistDialog").classList.add("show")};
$("#recipeBtn").onclick=()=>{renderRecipeDialog();$("#recipeDialog").classList.add("show")};
$("#buildFloorBtn").onclick=()=>{buildingPrimitives.create("floor");status("建築 床板を作成","command")};
$("#buildWallBtn").onclick=()=>{buildingPrimitives.create("wall");status("建築 壁板を作成","command")};
$("#buildRoofBtn").onclick=()=>{buildingPrimitives.create("roof");status("建築 屋根を作成","command")};
$("#buildDoorBtn").onclick=()=>{const wall=buildingAccess._selectedWall();const m=buildingAccess.createDoor();refresh();status(`ドア ${m.length} parts${wall?' / 壁開口を自動生成':''}`,`command`)};
$("#buildWindowBtn").onclick=()=>{const wall=buildingAccess._selectedWall();const m=buildingAccess.createWindow();refresh();status(`窓 ${m.length} parts${wall?' / 壁開口を自動生成':''}`,`command`)};
$("#buildStairsBtn").onclick=()=>{const m=buildingAccess.createStairsFitSelection();refresh();status(`階段 ${m.length} steps / 選択床高へ自動フィット`,`command`)};
$("#buildLadderBtn").onclick=()=>{const m=buildingAccess.createLadderFitSelection();refresh();status(`ハシゴ ${m.length} parts / 選択高さへ自動伸長`,`command`)};
$("#doorToggleBtn").onclick=()=>{const d=buildingAccess.toggleDoor();refresh();status(d?`ドア ${d.components.access.open?"OPEN":"CLOSE"}`:"ドアを選択してください",d?"command":"error")};
function renderWorkbenchInventory(){const root=$("#workbenchInventoryList");if(root?.dataset?.missingSelector)return;root.innerHTML=portableWorkbench.list().map(w=>`<div class="inventoryRow"><b>${escapeHtml(w.name)}</b><span>${w.stored?'INVENTORY':w.location.toUpperCase()}</span><span>${Math.round(w.dimensions.width)}×${Math.round(w.dimensions.depth)}×${Math.round(w.dimensions.height)}</span><button data-store="${w.id}" ${w.stored?'disabled':''}>収納</button><button data-deploy="${w.id}" ${w.stored?'':'disabled'}>設置</button></div>`).join("");root.querySelectorAll("[data-store]").forEach(b=>b.onclick=()=>{portableWorkbench.store(b.dataset.store);renderWorkbenchInventory();status("作業台を収納","command")});root.querySelectorAll("[data-deploy]").forEach(b=>b.onclick=()=>{portableWorkbench.deploy(b.dataset.deploy);renderWorkbenchInventory();status("作業台を設置","command")})}
$("#workbenchInventoryClose").onclick=()=>$("#workbenchInventoryDialog").classList.remove("show");

$("#motionAxisBtn").onclick=openMotionAxisDialog;$("#socketBtn").onclick=openSocketDialog;$("#assemblyBtn").onclick=openAssemblyDialog;$("#prototypeBtn").onclick=makePrototype;$("#syncPrototypeBtn").onclick=syncPrototypes;
$("#motionAxisSelect").onchange=()=>refreshMotionAxisDialog($("#motionAxisSelect").value);$("#motionAxisNew").onclick=()=>{$("#motionAxisSelect").value="";$("#motionAxisName").value="Motion Axis";$("#motionAxisType").value="revolute";$("#motionAxisOrigin").value="0,0,0";$("#motionAxisDirection").value="0,0,1";$("#motionAxisMin").value=0;$("#motionAxisMax").value=360;$("#motionAxisValue").value=0;$("#motionAxisPitch").value=1};$("#motionAxisApply").onclick=saveMotionAxis;$("#motionAxisDelete").onclick=deleteMotionAxis;$("#motionAxisClose").onclick=()=>$("#motionAxisDialog").classList.remove("show");
$("#socketSelect").onchange=()=>refreshSocketDialog($("#socketSelect").value);$("#socketNew").onclick=()=>{$("#socketSelect").value="";$("#socketName").value="Socket";$("#socketType").value="attach";$("#socketHand").value="either";$("#socketPosition").value="0,0,0";$("#socketRotation").value="0,0,0"};$("#socketApply").onclick=saveSocket;$("#socketDelete").onclick=deleteSocket;$("#socketClose").onclick=()=>$("#socketDialog").classList.remove("show");
$("#assemblyAdd").onclick=addAssemblyFromDialog;$("#assemblyApplyAll").onclick=()=>{const n=applyAllAssemblyConstraints(state,scene);refresh();status(`Assembly apply ${n}`,"command")};$("#assemblyClose").onclick=()=>$("#assemblyDialog").classList.remove("show");
$("#characterBtn").onclick=openCharacterDialog;$("#jointEditorBtn").onclick=openJointEditorDialog;$("#lifeBtn").onclick=()=>{const p=state.primary();if(!p)return status("Life Coreを付けるモデルを選択してください","error");const on=!ensureComponents(p).lifeCore?.enabled;setComponent(p,"lifeCore",on);refresh();status(`${p.objectId} Life Core ${on?"ON":"OFF"}`,"command")};
$("#avatarOrbitBtn").onclick=()=>{avatarManager.setMode("orbit");status("Avatar: Orbit","command")};
$("#avatarFpvBtn").onclick=()=>{avatarManager.setMode("fpv");status("Avatar: FPV","command")};
$("#avatarTpvBtn").onclick=()=>{avatarManager.setMode("tpv");status("Avatar: TPV","command")};
$("#avatarWalkBtn").onclick=()=>{if(state.avatar?.walking){avatarManager.stopWalking();status("Avatar: STOP","command")}else{avatarManager.startWalking();status("Avatar: WALK","command")}};$("#avatarRunBtn").onclick=()=>{state.avatar.locomotion.running=!state.avatar.locomotion.running;if(state.avatar.locomotion.running)avatarManager.startWalking();status(`Avatar: RUN ${state.avatar.locomotion.running?"ON":"OFF"}`,"command")};$("#avatarJumpBtn").onclick=()=>{avatarManager.jump();status("Avatar: JUMP","command")};
$("#anchorBtn").onclick=()=>{const parts=state.selectedObjects();if(!parts.length)return status("固定するモデルを選択してください","error");for(const p of parts){p.locked=true;physicsManager?.freeze?.(p)}placementManager?.setEnabled?.(false);$("#placeBtn")?.classList.remove("active");status(`⚓ ${parts.length}個のモデルを固定しました`,"command");refresh()};
$("#editMoveBtn").onclick=()=>{const parts=state.selectedObjects();if(!parts.length)return status("移動編集するモデルを選択してください","error");for(const p of parts)p.locked=false;placementManager?.setEnabled?.(true);$("#placeBtn")?.classList.add("active");status(`✒ ${parts.length}個のモデルを移動編集モードにしました`,"command");refresh()};
$("#placeBtn").onclick=()=>{placementManager.setEnabled(!placementManager.enabled);$("#placeBtn").classList.toggle("active",placementManager.enabled);status(`Placement ${placementManager.enabled?"ON":"OFF"}`,"command")};
$("#workspaceApply").onclick=()=>{const p=workspaceManager.apply($("#workspacePreset").value);workspaceManager.setDesignScale($("#workspaceScale").value||"1:1");infiniteScaleCore?.applyToScene?.();updateScaleHud();$("#workspaceDialog").classList.remove("show");status(`Workspace: ${p.label} / Scale ${state.workspace.designScale}`,"command")};
$("#workspaceClose").onclick=()=>$("#workspaceDialog").classList.remove("show");
$("#createDocumentBtn").onclick=()=>{spatialPanels.create("document",[0,0,90]);status("3D Document を作成","command")};
$("#createNodeBtn").onclick=()=>{spatialPanels.create("node",[60,0,90]);status("3D Node Graph を作成","command")};
const specialPropertyPreviewTimers=new Map();
function scheduleSpecialPreview(key,fn,delay=70){const old=specialPropertyPreviewTimers.get(key);if(old)clearTimeout(old);specialPropertyPreviewTimers.set(key,setTimeout(()=>{specialPropertyPreviewTimers.delete(key);fn()},delay));}
function applySpecialPropertyValues(id,v,{preview=false}={}){
 if(id==='special:planet'){
  Object.assign(state.planet,{radiusMm:Math.max(1000,Number.isFinite(v.radiusMm)?v.radiusMm:state.planet.radiusMm),waterRadiusMm:Math.max(1000,Number.isFinite(v.waterRadiusMm)?v.waterRadiusMm:state.planet.waterRadiusMm),terrainAmplitudeMm:Math.max(0,Number.isFinite(v.terrainAmplitudeMm)?v.terrainAmplitudeMm:0),spawnElevationMm:Number.isFinite(v.spawnElevationMm)?Math.max(0,v.spawnElevationMm):(state.planet.spawnElevationMm??1000),waveAmplitudeMm:Math.max(0,Number.isFinite(v.waveAmplitudeMm)?v.waveAmplitudeMm:0),waveSpeed:Number.isFinite(v.waveSpeed)?v.waveSpeed:state.planet.waveSpeed,landFractionTarget:Number.isFinite(v.landFractionPct)?Math.max(.05,Math.min(.85,v.landFractionPct/100)):state.planet.landFractionTarget,seed:Number.isFinite(v.seed)?Math.round(v.seed):(state.planet.seed??1),continentScale:Number.isFinite(v.continentScale)?Math.max(.25,Math.min(2.5,v.continentScale)):(state.planet.continentScale??.72),terrainDetailStrength:Number.isFinite(v.terrainDetailStrength)?Math.max(0,Math.min(2.5,v.terrainDetailStrength)):(state.planet.terrainDetailStrength??1),terrainRoughness:Number.isFinite(v.terrainRoughness)?Math.max(.2,Math.min(3,v.terrainRoughness)):(state.planet.terrainRoughness??1),mountainSharpness:Number.isFinite(v.mountainSharpness)?Math.max(1,Math.min(6,v.mountainSharpness)):(state.planet.mountainSharpness??2.25),valleyStrength:Number.isFinite(v.valleyStrength)?Math.max(0,Math.min(2,v.valleyStrength)):(state.planet.valleyStrength??.65),plateauStrength:Number.isFinite(v.plateauStrength)?Math.max(0,Math.min(2,v.plateauStrength)):(state.planet.plateauStrength??.45),cliffStrength:Number.isFinite(v.cliffStrength)?Math.max(0,Math.min(2,v.cliffStrength)):(state.planet.cliffStrength??.35),islandStrength:Number.isFinite(v.islandStrength)?Math.max(0,Math.min(2,v.islandStrength)):(state.planet.islandStrength??.30),erosionStrength:Number.isFinite(v.erosionStrength)?Math.max(0,Math.min(2,v.erosionStrength)):(state.planet.erosionStrength??.55),riverCount:Number.isFinite(v.riverCount)?Math.max(0,Math.min(32,Math.round(v.riverCount))):(state.planet.riverCount??7),vegetationDensity:Number.isFinite(v.vegetationDensity)?Math.max(0,Math.min(1200,Math.round(v.vegetationDensity))):(state.planet.vegetationDensity??180),gravity:Number.isFinite(v.gravity)?v.gravity:(state.planet.gravity??9.81),pressureKPa:Number.isFinite(v.pressureKPa)?v.pressureKPa:(state.planet.pressureKPa??101.325),temperatureC:Number.isFinite(v.temperatureC)?v.temperatureC:(state.planet.temperatureC??15),rotationPeriodHours:Number.isFinite(v.rotationPeriodHours)?Math.max(.01,v.rotationPeriodHours):state.planet.rotationPeriodHours,orbitPeriodDays:Number.isFinite(v.orbitPeriodDays)?Math.max(.01,v.orbitPeriodDays):state.planet.orbitPeriodDays,axialTiltDeg:Number.isFinite(v.axialTiltDeg)?v.axialTiltDeg:state.planet.axialTiltDeg});
  for(const key of ['enabled','continents','mountains','biomes','water','rivers','vegetation','atmosphere','celestialLabelsVisible'])if(typeof v[key]==='boolean')state.planet[key]=v[key];
  const rebuildPlanetFromProperty=()=>{planetManager?.rebuild?.();if(state.planet.enabled)planetManager?.spawnAvatar?.(avatarManager);else planetManager?.leaveAvatar?.(avatarManager)};
  if(preview)scheduleSpecialPreview(id,rebuildPlanetFromProperty,90);else{const t=specialPropertyPreviewTimers.get(id);if(t)clearTimeout(t);specialPropertyPreviewTimers.delete(id);rebuildPlanetFromProperty();status('惑星・環境プロパティを更新','command')}
  return true;
 }
 if(id==='special:avatar'){
  const beforeHeight=Number(state.avatar.height);if(v.name)state.avatar.name=v.name;if(Number.isFinite(v.height)&&v.height>20)state.avatar.height=v.height;if(v.mode)avatarManager?.setMode?.(v.mode);
  if(Number(state.avatar.height)!==beforeHeight){if(preview)scheduleSpecialPreview(id,()=>{avatarManager?.build?.();avatarManager?.sync?.()},70);else{avatarManager?.build?.();avatarManager?.sync?.();}}
  if(!preview)status('アバタープロパティを適用','command');return true;
 }
 if(id==='special:grid'){
  if(typeof v.gridVisible==='boolean')state.creator.gridVisible=v.gridVisible;if(Number.isFinite(v.gridOpacity))state.creator.gridOpacity=Math.max(0,Math.min(1,v.gridOpacity));if(Number.isFinite(v.scaleMm)&&v.scaleMm>0)creatorMode?.setScale?.(v.scaleMm);creatorMode?.updateGridVisibility?.();if(!preview)status('グリッドプロパティを適用','command');return true;
 }
 if(id?.startsWith('special:celestial:')){
  const cid=id.split(':').slice(2).join(':'),c=state.planet?.celestialCatalog?.[cid];if(!c)return false;if(v.name)c.name=v.name;if(v.celestialType)c.type=v.celestialType;if(typeof v.labelVisible==='boolean')c.labelVisible=v.labelVisible;c.environment={...(c.environment||{}),radiusMm:v.radiusMm,massEarth:v.massEarth,gravity:v.gravity,temperatureC:v.temperatureC,pressureKPa:v.pressureKPa,waterRadiusMm:v.waterRadiusMm,terrainAmplitudeMm:v.terrainAmplitudeMm,waveAmplitudeMm:v.waveAmplitudeMm,atmosphere:v.celestialAtmosphere,water:v.celestialWater};c.rotation={...(c.rotation||{}),periodHours:v.rotationPeriodHours,axialTiltDeg:v.axialTiltDeg};c.orbit={...(c.orbit||{}),radiusAU:v.orbitRadiusAU,periodDays:v.orbitPeriodDays,inclinationDeg:v.orbitInclinationDeg};planetManager?.refreshCelestialLabels?.();if(!preview)status('天体環境プロパティを適用','command');return true;
 }
 return false;
}
window.addEventListener('ue:special-property',e=>{const d=e.detail||{},id=d.specialId,v=d.values||{};
 if(d.action==='planet-dialog')return openPlanetDialog();
 if(d.action==='camera-home'){creatorMode?.resetCamera?.();status('カメラを初期位置へ戻しました','command');return refresh()}
 if(d.action==='camera-focus-avatar'){const a=avatarManager?.root||avatarManager?.group;if(a&&scene?.controls){const p=new THREE.Vector3();a.getWorldPosition?.(p);scene.controls.target.copy(p);scene.controls.update?.();}return}
 if(d.action==='preview'){applySpecialPropertyValues(id,v,{preview:true});return;}
 if(d.action==='apply'){applySpecialPropertyValues(id,v,{preview:false});refresh();return;}
 if(id?.startsWith('special:workbench:')){const wid=id.split(':').slice(2).join(':');if(d.action==='workbench-active')portableWorkbench?.setActive?.(wid);if(d.action==='workbench-toggle-store'){const w=(state.workbenches||[]).find(x=>x.id===wid);if(w?.stored)portableWorkbench?.deploy?.(wid);else portableWorkbench?.store?.(wid)}status('作業台を更新','command');refresh()}
});
window.addEventListener('ue:universal-dial-quick',e=>{const target=e.detail?.target;if(target==='time'){state.planet.simTimeHours=(Number(state.planet.simTimeHours)||0)+1;status(`時間 ${state.planet.simTimeHours.toFixed(2)} h`,'command')}else if(target==='timeScale'){state.planet.timeScale=Math.max(0,(Number(state.planet.timeScale)||0)+10);status(`時間倍率 ×${state.planet.timeScale}`,'command')}else if(target==='creatorScale'){const cur=Number(state.creator?.scaleMm)||1;const next=cur>=1000?cur*10:cur*2;creatorMode?.setScaleMm?.(next);creatorMode?.setScale?.(next);updateScaleHud();status(`Creator Scale ${next} mm/unit`,'command')}refresh();});
$("#physicsApply").onclick=applyPhysicsDialog;$("#physicsClose").onclick=()=>$("#physicsDialog").classList.remove("show");$("#planetApply").onclick=applyPlanetDialog;$("#planetClose").onclick=()=>$("#planetDialog").classList.remove("show");
$("#gravityPreset").onchange=e=>{const v=e.target.value;if(v!=="custom"){physicsManager.setGravityPreset(v);[$("#gravityX"),$("#gravityY"),$("#gravityZ")].forEach((el,i)=>el.value=state.physics.gravity[i])}};
$("#dropSelected").onclick=()=>{for(const p of state.selectedObjects())physicsManager.unfreeze(p);state.physics.enabled=true;status("DROP: 選択部品をDynamic化","command");refresh()};
$("#freezeSelected").onclick=()=>{for(const p of state.selectedObjects())physicsManager.freeze(p);status("FREEZE: 選択部品を静止","command");refresh()};
$("#generatorBtn").onclick=()=>$("#generatorDialog").classList.add("show");
$("#generatorApply").onclick=()=>{const made=generatorWorkbench.generate({count:Number($("#generatorCount").value)||6,spacing:Number($("#generatorSpacing").value)||80,seed:Number($("#generatorSeed").value)||1});$("#generatorDialog").classList.remove("show");refresh();status(`Generator: ${made.length} models`,"command")};
$("#generatorClose").onclick=()=>$("#generatorDialog").classList.remove("show");
$("#characterApply").onclick=applyCharacterDialog;$("#characterClose").onclick=()=>$("#characterDialog").classList.remove("show");
$("#jointEditorClose").onclick=()=>$("#jointEditorDialog").classList.remove("show");
$("#jointSelect").onchange=()=>syncJointEditorFromSelection();
for(const a of ["X","Y","Z"]){$("#jointR"+a).oninput=applyJointEditorRotation;}
$("#jointMarkers").onchange=e=>avatarManager.setJointMarkersVisible(e.target.checked);
$("#jointReset").onclick=()=>{avatarManager.setJointRotation($("#jointSelect").value,[0,0,0],true);syncJointEditorFromSelection();status(`Joint reset: ${$("#jointSelect").value}`,"command")};
$$('.posePreset').forEach(b=>b.onclick=()=>{avatarManager.posePreset(b.dataset.pose);syncJointEditorFromSelection();status(`Pose: ${b.dataset.pose}`,"command")});

$("#holdRightBtn").onclick=()=>{if(handEquipment?.holdSelected?.("right")){status("右手に持ちました","command");refresh()}else status("持つオブジェクトを選択してください","error")};
$("#holdLeftBtn").onclick=()=>{if(handEquipment?.holdSelected?.("left")){status("左手に持ちました","command");refresh()}else status("持つオブジェクトを選択してください","error")};
$("#dropHandBtn").onclick=()=>{const r=handEquipment?.drop?.("right")||handEquipment?.drop?.("left");status(r?"道具を手放しました":"手に道具はありません",r?"command":"info");refresh()};

$("#deleteBtn").onclick=removeSelected;
$("#villageBtn")?.addEventListener("click",()=>openVillageDialog());
document.getElementById("ueVillageClose")?.addEventListener("click",()=>document.getElementById("ueVillageDialog")?.classList.remove("show"));
document.getElementById("ueVillageCreate")?.addEventListener("click",()=>{const p=creatorMode?.creationPositionCad?.()||state.avatar?.position||[0,0,0];const v=villageManager.createVillage({name:`村 ${villageManager.list().length+1}`,position:[p[0]+7000,p[1]+5000,p[2]||0],population:9});refresh();openVillageDialog(v.id)});
document.getElementById("ueVillageRelease")?.addEventListener("click",()=>{villageManager?.releaseControl?.();avatarManager?.build?.();avatarManager?.sync?.();refresh()});
document.getElementById("ueVillageMode")?.addEventListener("change",e=>{const mode=villageManager?.setMode?.(e.target.value);creatorMode?.setEnabled?.(mode==='creator');refresh()});
document.getElementById('ueNpcTalkClose')?.addEventListener('click',()=>document.getElementById('ueNpcTalkDialog')?.classList.remove('show'));
document.getElementById('ueNpcTalkSend')?.addEventListener('click',()=>{const i=document.getElementById('ueNpcTalkInput');sendNpcTalk(i?.value);if(i)i.value=''});
document.getElementById('ueNpcTalkInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){sendNpcTalk(e.currentTarget.value);e.currentTarget.value=''}});
document.querySelectorAll('[data-npcquick]').forEach(b=>b.addEventListener('click',()=>{const dlg=document.getElementById('ueNpcTalkDialog'),n=npcById(dlg?.dataset?.npcId);if(!n)return;const a=b.dataset.npcquick;if(a==='gift'){villageManager?.gift?.(n.id,12);openNpcTalkDialog(n.id);return}if(a==='trade'){const shop=(state.shops||[]).find(s=>s.keeperId===n.id||s.villageId===n.villageId);if(shop)openShopDialog(shop.id);else status('この村人は店を持っていません','info');return}const map={greet:'こんにちは',job:'仕事は？',village:'村について教えて'};sendNpcTalk(map[a]||a)}));



$("#cameraHomeBtn")?.addEventListener("click",()=>{creatorMode?.resetCamera?.();status("カメラを初期位置へ戻しました","command")});

$("#fitBtn").onclick=()=>{
  scene.fit(state.objects.filter(object=>object.visible!==false));
};


$$(".selectionMode").forEach(button=>{
  button.onclick=()=>setSelectionMode(button.dataset.mode);
});

$$(".coord").forEach(button=>{
  button.onclick=()=>{
    $$(".coord").forEach(item=>{
      item.classList.toggle("active",item===button);
    });
    transform.restore();
    transform.mode=button.dataset.mode;
    resetTransformControls();
    transform.apply(transformValues());
  };
});

$("#applyTransform").onclick=()=>{transform.apply(transformValues());transform.capture();resetTransformControls();refresh();status("変形を確定しました（続けて操作できます）")};
$("#closeTransform").onclick=()=>{transform.apply(transformValues());transform.clear();setPropertyPanelMode("properties");geometrySelection.rebuildOverlays();edgeVisualizer.rebuildAll(state.objects);booleanVisualizer?.rebuildAll?.(state.objects);refresh();status("変形完了")};
$$('.dragMode').forEach(button=>button.onclick=()=>{transformDragMode=button.dataset.drag;$$('.dragMode').forEach(b=>b.classList.toggle('active',b===button));status(transformDragMode==='xy'?'XY平面ドラッグ':'Z高さドラッグ')});

$("#cancelTransform").onclick=()=>{
  transform.restore();
  transform.clear();
  setPropertyPanelMode("properties");
  geometrySelection.rebuildOverlays();
  edgeVisualizer.rebuildAll(state.objects);
  booleanVisualizer?.rebuildAll?.(state.objects);
  refresh();
  status("操作前へ戻しました");
};

$("#createGroup").onclick=()=>{
  try{
    createGroup(state,$("#groupName").value);
    closeDialog("#groupDialog");
    refresh();
    status("グループ作成");
  }catch(error){
    status(error.message);
  }
};

$("#closeGroup").onclick=()=>{
  closeDialog("#groupDialog");
};

$("#addMoveFeature").onclick=()=>{
  const part=featurePart();if(!part)return;
  featureTree.add(part,"Move",{x:0,y:0,z:0});
  renderFeatureDialog();
};

$("#addRotateFeature").onclick=()=>{
  const part=featurePart();if(!part)return;
  featureTree.add(part,"Rotate",{x:0,y:0,z:0});
  renderFeatureDialog();
};

$("#addMetadataFeature").onclick=()=>{
  const part=featurePart();if(!part)return;
  featureTree.add(part,"Metadata",{key:"",value:""});
  renderFeatureDialog();
};

$("#rebuildFeatures").onclick=()=>{
  const part=featurePart();if(!part)return;
  featureTree.rebuild(part);
  geometrySelection.invalidate(part);
  geometrySelection.clear();
  renderFeatureDialog();
  refresh();
  status("Feature Treeを再計算しました");
};

$("#featureClose").onclick=()=>closeDialog("#featureDialog");
$("#edgeFeatureApply").onclick=addEdgeFeature;
$("#edgeFeatureCancel").onclick=()=>closeDialog("#edgeFeatureDialog");
$("#defaultChamferApply").onclick=saveDefaultChamfer;
$("#defaultChamferClose").onclick=()=>closeDialog("#defaultChamferDialog");
$("#faceExtrudeApply").onclick=addFaceExtrude;
$("#faceExtrudeClose").onclick=()=>closeDialog("#faceExtrudeDialog");
$("#createSketch").onclick=createNewSketch;$("#sketchDialogClose").onclick=()=>closeDialog("#sketchDialog");$("#finishSketch").onclick=finishActiveSketch;
$("#sketchGridToggle").onclick=()=>{sketchController.gridEnabled=!sketchController.gridEnabled;sketchController.rebuild();refresh()};
$("#sketchSnapToggle").onclick=()=>{sketchController.snapEnabled=!sketchController.snapEnabled;refresh()};
$$(".sketchTool").forEach(b=>b.onclick=()=>{sketchController.setTool(b.dataset.tool);const codes={select:"SELECT",point:"P (POINT)",line:"L (LINE)",rectangle:"REC (RECTANGLE)",circle:"C (CIRCLE)",arc:"ARC",spline:"SPL (SPLINE)",freehand:"FH (FREEHAND)"};$("#activeSketchToolName").textContent=codes[b.dataset.tool]||b.dataset.tool;status(`SKETCH ${codes[b.dataset.tool]||b.dataset.tool}`,"command")});
$("#constraintHorizontal").onclick=()=>applySketchConstraint("Horizontal");
$("#constraintVertical").onclick=()=>applySketchConstraint("Vertical");
$("#constraintCoincident").onclick=()=>applySketchConstraint("Coincident");
$("#constraintParallel").onclick=()=>applySketchConstraint("Parallel");
$("#constraintPerpendicular").onclick=()=>applySketchConstraint("Perpendicular");
$("#constraintEqual").onclick=()=>applySketchConstraint("EqualLength");
$("#constraintConcentric").onclick=()=>applySketchConstraint("Concentric");
$("#constraintMidpoint").onclick=()=>applySketchConstraint("Midpoint");
$("#constraintFix").onclick=()=>applySketchConstraint("Fixed");
$("#dimensionSketch").onclick=openDimensionDialog;$("#trimSketch").onclick=trimSketchEntity;$("#extendSketch").onclick=extendSketchEntity;
$("#sketchEntityEditBtn").onclick=openSketchEntityEditor;
$("#sketchEntityDeleteBtn").onclick=()=>{if(sketchController.deleteSelected())status("スケッチ要素を削除","command")};
$("#sketchDiagnosticsBtn").onclick=openSketchDiagnostics;
$("#sketchRepairBtn").onclick=repairSketch;
$("#dimensionApply").onclick=applySketchDimension;
$("#dimensionClose").onclick=()=>closeDialog("#dimensionDialog");
$("#sketchDiagnosticsClose").onclick=()=>closeDialog("#sketchDiagnosticsDialog");
$("#runSketchRepair").onclick=repairSketch;
$("#sketchExtrudeApply").onclick=createExtrusionFromProfile;
$("#sketchExtrudeClose").onclick=()=>closeDialog("#sketchExtrudeDialog");
$("#sketchEntityApply").onclick=applySketchEntityEdit;$("#sketchEntityDelete").onclick=()=>{sketchController.deleteSelected();closeDialog("#sketchEntityDialog");status("スケッチ要素を削除","command")};$("#sketchEntityClose").onclick=()=>closeDialog("#sketchEntityDialog");
$("#sketchRevolveApply").onclick=createRevolutionFromProfile;$("#sketchRevolveClose").onclick=()=>closeDialog("#sketchRevolveDialog");
$("#partDatumApply").onclick=addPartDatum;$("#partDatumClose").onclick=()=>closeDialog("#partDatumDialog");$("#partDatumMode").onchange=refreshPartDatumReferenceUI;$("#partDatumType").onchange=refreshPartDatumReferenceUI;
$("#geometryConstraintApply").onclick=addGeometryConstraint;$("#geometryConstraintClose").onclick=()=>closeDialog("#geometryConstraintDialog");$("#geometryConstraintType").onchange=refreshGeometryConstraintUI;
$("#mirrorApply").onclick=applyMirror;
$("#mirrorClose").onclick=()=>closeDialog("#mirrorDialog");
["#mirrorMode","#mirrorPlane","#mirrorOffset"].forEach(id=>$(id).oninput=updateMirrorSummary);
$("#booleanApply").onclick=applyBoolean;
$("#patternType").onchange=updatePatternFields;$("#patternApply").onclick=applyPattern;$("#patternClose").onclick=()=>closeDialog("#patternDialog");
$("#booleanClose").onclick=()=>closeDialog("#booleanDialog");
$("#brepClose").onclick=()=>closeDialog("#brepDialog");
$("#brepRebuild").onclick=rebuildBRep;
$("#brepExport").onclick=exportBRep;
$("#faceKernelApply").onclick=applyFaceKernelFeature;
$("#faceKernelMerge").onclick=mergeCoplanarFaces;
$("#faceKernelClose").onclick=()=>{faceKernelVisualizer.clear();closeDialog("#faceKernelDialog")};
$("#edgeKernelApply").onclick=applyEdgeKernelFeature;
$("#edgeKernelDiagnose").onclick=renderEdgeDiagnostics;
$("#edgeKernelClose").onclick=()=>{edgeKernelVisualizer.clear();closeDialog("#edgeKernelDialog")};
$("#rebuildDirty").onclick=runDirtyRebuild;
$("#rebuildAll").onclick=runFullRebuild;
$("#rebuildClose").onclick=()=>closeDialog("#rebuildDialog");
$("#historyClose").onclick=()=>closeDialog("#historyDialog");
$("#historySnapshot").onclick=()=>{
  rebuildEngine.snapshot(`Manual ${rebuildEngine.history.length}`);
  renderHistoryDialog();
  status("Snapshotを保存しました");
};
$("#historyUndo").onclick=()=>{
  if(!rebuildEngine.undo())status("これ以上Undoできません");
  else{renderHistoryDialog();refresh();status("Undoしました")}
};
$("#historyRedo").onclick=()=>{
  if(!rebuildEngine.redo())status("これ以上Redoできません");
  else{renderHistoryDialog();refresh();status("Redoしました")}
};

$("#edgeKernelOperation").onchange=()=>{
  edgeKernelVisualizer.show(
    state.primary(),
    selectedEdgeForKernel(),
    $("#edgeKernelOperation").value
  );
};

$("#faceKernelOperation").onchange=()=>{
  faceKernelVisualizer.show(
    state.primary(),
    selectedFaceForKernel(),
    $("#faceKernelOperation").value
  );
};
$("#booleanOperation").onchange=updateBooleanSummary;
$("#booleanTarget").onchange=updateBooleanSummary;
$("#booleanTool").onchange=updateBooleanSummary;

$("#rollbackBar").onclick=event=>{
  const part=featurePart();if(!part)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const ratio=THREE.MathUtils.clamp((event.clientX-rect.left)/rect.width,0,1);
  const features=featureTree.ensure(part);
  const index=Math.round(ratio*Math.max(0,features.length-1));
  featureTree.setRollback(part,index);
  renderFeatureDialog();
};

function cloneSelectionForDrag(){
  const originals=state.selectedObjects();
  if(originals.some(o=>villageManager&&!villageManager.canModifyObject(o))){status("🔒 他者所有物はサバイバルで複製できません","error");return [];}
  const made=[];
  for(const raw of originals){
    // Three.js の Mesh / Euler / Quaternion / Material などは関数や循環参照を含むため、
    // structuredClone せず CAD のシリアライズ可能データだけを複製する。
    const safe=serializable(raw);
    if(!safe)continue;
    const data={...safe,id:state.uid(),name:`${raw.name} Copy`,groupId:null};
    // Signage rotation belongs to the sign object itself. Keep manual/auto rotation on duplicates.
    if(raw.metadata?.surfaceArt){data.metadata=data.metadata||{};data.metadata.surfaceArt=structuredClone(raw.metadata.surfaceArt);}
    made.push(addPart(data.type,data,false));
  }
  state.selectedIds=made.map(o=>o.id);
  state.primaryId=made.at(-1)?.id||null;
  selection.paint();
  refresh();
  return made;
}
function beginObjectDrag(event){
  if(state.selectionMode!=="body"||propertyPanelMode!=="transform")return false;
  const hit=scene.pickIntersection(event);if(!hit)return false;
  if(!state.selectedIds.includes(hit.object.userData.partId))selection.select(hit.object.userData.partId,false);
  if(event.ctrlKey||event.metaKey)cloneSelectionForDrag();
  const selected=state.selectedObjects();if(selected.some(o=>villageManager&&!villageManager.canModifyObject(o))){status("🔒 サバイバルでは所有者のいる建物を移動できません","error");return false;}
  const objects=selected.filter(o=>!o.locked);if(!objects.length){status("⚓ 固定中のモデルです。✒ 移動編集で解除してください","error");return false;}
  const start=objects.map(o=>({id:o.id,position:[...o.position]}));
  const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-hit.point.y);const point=new THREE.Vector3();scene.updatePointer(event);scene.raycaster.ray.intersectPlane(plane,point);
  dragSession={pointerId:event.pointerId,mode:transformDragMode,start,worldStart:point.clone(),cadStart:scene.worldPointToCad(point),screenY:event.clientY,snapCandidate:null};
  scene.controls.enabled=false;event.currentTarget.setPointerCapture(event.pointerId);return true;
}
function updateObjectDrag(event){
  if(!dragSession||dragSession.pointerId!==event.pointerId)return;
  if(dragSession.mode==="xy"){
    const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-dragSession.worldStart.y),point=new THREE.Vector3();scene.updatePointer(event);if(!scene.raycaster.ray.intersectPlane(plane,point))return;
    const cad=scene.worldPointToCad(point),dx=cad[0]-dragSession.cadStart[0],dy=cad[1]-dragSession.cadStart[1];
    for(const snap of dragSession.start){const o=state.object(snap.id);o.position=[snap.position[0]+dx,snap.position[1]+dy,snap.position[2]];scene.sync(o)}
  }else{
    const distance=scene.camera.position.distanceTo(scene.controls.target),worldDz=(dragSession.screenY-event.clientY)*distance/500;
    const a=scene.cadPointToWorld([0,0,0]),b=scene.cadPointToWorld([0,0,1]),worldPerCad=Math.max(1e-9,a.distanceTo(b)),dz=worldDz/worldPerCad;
    for(const snap of dragSession.start){const o=state.object(snap.id);o.position=[snap.position[0],snap.position[1],snap.position[2]+dz];scene.sync(o)}
  }
  dragSession.snapCandidate=snapAssist?.pick?.(event,state.selectedIds)||null;
  refresh();
}
function applyAssistSnapToDragged(candidate=null){
  const moving=state.selectedObjects();if(!moving.length)return;
  if(candidate&&snapAssist?.enabled?.()){const result=snapAssist.snapSelection(moving,candidate);if(result){status(`🧲 ${candidate.label}へスナップ: ${candidate.partName}`,'command');return result;}}
  const cfg=state.buildingAssist||{};if(String(cfg.mode||'snap')==='off')return;const others=state.objects.filter(o=>!state.selectedIds.includes(o.id)&&o.visible!==false);
  const radius=Math.max(1,Number(cfg.snapRadius)||450);let best=null;
  for(const m of moving){const mb=scene.partBounds(m);if(!mb)continue;const mp=m.position||[0,0,0];const mmin=[mp[0]+mb.min[0],mp[1]+mb.min[1],mp[2]+mb.min[2]],mmax=[mp[0]+mb.max[0],mp[1]+mb.max[1],mp[2]+mb.max[2]];
    for(const o of others){const ob=scene.partBounds(o);if(!ob)continue;const op=o.position||[0,0,0],omin=[op[0]+ob.min[0],op[1]+ob.min[1],op[2]+ob.min[2]],omax=[op[0]+ob.max[0],op[1]+ob.max[1],op[2]+ob.max[2]];
      for(let a=0;a<3;a++)for(const d of [omin[a]-mmax[a],omax[a]-mmin[a]])if(Math.abs(d)<=radius&&(!best||Math.abs(d)<Math.abs(best.d)))best={a,d};
    }}
  if(best)for(const m of moving){m.position[best.a]+=best.d;scene.sync(m)}
}
function endObjectDrag(event){if(!dragSession||dragSession.pointerId!==event.pointerId)return;const candidate=dragSession.snapCandidate;applyAssistSnapToDragged(candidate);snapAssist?.clear?.();dragSession=null;scene.controls.enabled=true;transform.capture();resetTransformControls();geometrySelection.rebuildOverlays();status("ドラッグ移動を確定")}

let selectedCelestial=null;
function openCelestialDialog(hit){if(!hit||!hit.record)return false;selectedCelestial=hit.record;$("#celestialId").value=hit.record.id;$("#celestialType").value=hit.record.type||"";$("#celestialName").value=hit.record.name||hit.record.id;$("#celestialLabelVisible").checked=!!hit.record.labelVisible;$("#celestialDialog").classList.add("show");status(`天体を選択: ${hit.record.id}`,"command");return true}
function applyCelestialDialog(){if(!selectedCelestial)return;planetManager.setCelestialName(selectedCelestial.id,$("#celestialName").value);planetManager.setCelestialLabelVisible(selectedCelestial.id,$("#celestialLabelVisible").checked);$("#celestialDialog").classList.remove("show");status(`天体名を更新: ${selectedCelestial.id} → ${selectedCelestial.name}`,"command")}
function updateSpacecraftStatus(){
  const el=$("#spacecraftStatus");if(el)el.textContent=spacecraftFlight?spacecraftFlight.status():"宇宙船未登録";
  const pos=spacecraftFlight&&spacecraftFlight.positionInfo?spacecraftFlight.positionInfo():null,pe=$("#spacecraftPosition");
  if(pe&&!pe.dataset.missingSelector){if(!pos)pe.textContent='位置データなし';else if(pos.mode==='transfer')pe.textContent=`太陽系航行 / ${pos.centralBodyId} → ${pos.targetId||'-'} / ${(pos.progress*100).toFixed(1)}% / ${pos.elapsedDays.toFixed(2)}日 / ${pos.totalDays.toFixed(2)}日`;else pe.textContent=`${pos.centralBodyId} / 緯度 ${pos.latitudeDeg.toFixed(4)}° / 経度 ${pos.longitudeDeg.toFixed(4)}° / 高度 ${pos.altitudeM.toFixed(2)} m / XYZ (${pos.xM.toFixed(1)}, ${pos.yM.toFixed(1)}, ${pos.zM.toFixed(1)}) m`;}
  const t=spacecraftFlight&&spacecraftFlight.telemetry?spacecraftFlight.telemetry():null;const te=$("#spacecraftTelemetry");if(te&&!te.dataset.missingSelector)te.textContent=t?`軌道半径 ${t.radiusM.toFixed(1)} m / 速度 ${t.speedMS.toFixed(2)} m/s / 円軌道 ${t.circularMS.toFixed(2)} m/s / 脱出 ${t.escapeMS.toFixed(2)} m/s / 離心率 ${t.eccentricity.toFixed(4)} / 周期 ${Number.isFinite(t.periodSec)?(t.periodSec/60).toFixed(2):'∞'} min`:'軌道データなし'
}
function refreshSpacecraftTargets(){const sel=$("#spacecraftTarget");if(!sel)return;const cat=state.planet&&state.planet.celestialCatalog||{};const rows=Object.values(cat).filter(r=>r.type==='planet'||r.type==='star-system');sel.innerHTML=rows.map(r=>`<option value="${r.id}">${escapeHtml(r.name||r.id)} (${r.id})</option>`).join("")||'<option value="PLANET-NEIGHBOR-0002">PLANET-NEIGHBOR-0002</option>'}


function updateReferenceMateUi(info=referenceMate.describe()){
  const box=$("#referenceMateStatus");if(!box||box.dataset?.missingSelector)return;
  if(!info.source){box.innerHTML='<b>1.</b> 移動元の基準をクリックしてください';return;}
  if(!info.target){box.innerHTML=`<b>移動元</b> ${escapeHtml(info.source.partName)} / ${escapeHtml(info.source.label)}<br><em>2.</em> 移動先の基準をクリックしてください`;return;}
  box.innerHTML=`<b>移動元</b> ${escapeHtml(info.source.partName)} / ${escapeHtml(info.source.label)}<br><em>移動先</em> ${escapeHtml(info.target.partName)} / ${escapeHtml(info.target.label)}<br>拘束: ${escapeHtml(info.type||'auto')} / 値 ${Number(info.value||0).toFixed(3)} / 適用で配置します。`;
}
referenceMate.onChange=updateReferenceMateUi;
function openReferenceMate(){
  referenceMate.begin();$("#referenceMateType").value="auto";$("#referenceMateValue").value="0";$("#referenceMateOffset").value="0";$("#referenceMateFlip").checked=false;$("#referenceMateKeep").checked=false;$("#referenceMateDialog").classList.add('show');
  updateReferenceMateUi();status('🔗 基準一致: 移動元の頂点・辺・面・中心・軸をクリック','command');
}
$("#referenceMateOpen")?.addEventListener('click',openReferenceMate);
$("#referenceMateType")?.addEventListener("change",e=>referenceMate.setOptions({type:e.target.value}));
$("#referenceMateValue")?.addEventListener("input",e=>referenceMate.setOptions({value:e.target.value}));
$("#referenceMateOffset")?.addEventListener('input',e=>referenceMate.setOptions({offsetMm:e.target.value}));
$("#referenceMateFlip")?.addEventListener('change',e=>referenceMate.setOptions({flip:e.target.checked}));
$("#referenceMateKeep")?.addEventListener('change',e=>referenceMate.setOptions({keep:e.target.checked}));
$("#referenceMateReset")?.addEventListener('click',()=>{referenceMate.resetPick();status('基準を選び直します','command')});
$("#referenceMateApply")?.addEventListener('click',()=>{
  referenceMate.setOptions({type:$("#referenceMateType").value,value:$("#referenceMateValue").value,offsetMm:$("#referenceMateOffset").value,flip:$("#referenceMateFlip").checked,keep:$("#referenceMateKeep").checked});
  const result=referenceMate.apply();if(!result.ok){status(result.message,'error');return;}
  $("#referenceMateDialog").classList.remove('show');transform.capture();resetTransformControls();geometrySelection.rebuildOverlays();refresh();
  status(`🔗 基準一致を適用${$("#referenceMateKeep").checked?' / 拘束記録':''}`,'command');
});
$("#referenceMateClose")?.addEventListener('click',()=>{$("#referenceMateDialog").classList.remove('show');referenceMate.cancel();});

const syncSmartSnapUi=()=>{const c=state.creator||(state.creator={});const t=$("#smartSnapToggle");if(t)t.checked=c.smartSnap!==false;document.querySelectorAll(".smartSnapType").forEach(el=>{el.checked=(c.smartSnapTypes||{})[el.dataset.type]!==false})};
$("#smartSnapToggle")?.addEventListener("change",e=>{state.creator.smartSnap=!!e.target.checked;if(!state.creator.smartSnap)snapAssist?.clear?.();status(`Smart Snap ${state.creator.smartSnap?'ON':'OFF'}`,'command')});
document.querySelectorAll(".smartSnapType").forEach(el=>el.addEventListener("change",()=>{state.creator.smartSnapTypes=state.creator.smartSnapTypes||{};state.creator.smartSnapTypes[el.dataset.type]=el.checked;snapAssist?.clear?.()}));
syncSmartSnapUi();

$("#canvas").addEventListener("pointerdown",event=>{if(document.activeElement&&document.activeElement.matches?.("input,textarea,select"))document.activeElement.blur();
  if(referenceMate.active){event.preventDefault();event.stopPropagation();referenceMate.handlePointerDown(event);return;}
  if(state.sketchMode){if(event.button===1||event.button===2||scene.panMode)return;sketchController.handlePointer(event);return}
  const datumId=scene.pickDatum(event);
  if(datumId){state.selectedDatumId=datumId;state.selectedIds=[];state.primaryId=null;geometrySelection.clear();scene.selectDatum(datumId);status(`基準要素を選択: ${datumId}`);refresh();return}
  if(beginObjectDrag(event))return;snapAssist?.clear?.();
  if(state.selectionMode==="body"){
    const id=scene.pick(event);
    if(!id){const celestial=planetManager?.pickCelestial?.(event);if(celestial){openCelestialDialog(celestial);return}}
    selection.select(id,event.shiftKey);
    geometrySelection.clear();
  }else{
    const result=geometrySelection.pick(event,event.shiftKey);
    if(result?.partId){
      selection.select(result.partId,false);
      geometrySelection.rebuildOverlays();
    }
  }
});
$("#canvas").addEventListener("pointermove",event=>{if(referenceMate.active){referenceMate.handlePointerMove(event);return;}if(state.sketchMode)sketchController.handlePointerMove(event);else updateObjectDrag(event)});
$("#canvas").addEventListener("pointerup",event=>{if(state.sketchMode&&sketchController.activeTool==="freehand")sketchController.finishFreehand();else endObjectDrag(event)});
$("#canvas").addEventListener("pointercancel",event=>{if(state.sketchMode&&sketchController.activeTool==="freehand")sketchController.finishFreehand();else endObjectDrag(event)});

$("#canvas").addEventListener("wheel",event=>{
  if(state.sketchMode)return;
  if(state.creator?.enabled&&!event.ctrlKey){
    event.preventDefault();
    const factor=Math.pow(10,(event.deltaY>0?1:-1)*.08);
    creatorMode?.setScaleMm?.((state.creator?.scaleMm||1)*factor);
    updateScaleHud();return;
  }
  if(!event.ctrlKey)return;
  event.preventDefault();
  creatorMode?.setEnabled?.(true);
  infiniteScaleCore.zoomContinuous(event.deltaY);
  infiniteScaleCore.applyToScene();
  creatorMode?.syncUi?.();
  updateScaleHud();
},{passive:false});
document.addEventListener("keydown",event=>{
  const key=event.key.toUpperCase();
  if((event.ctrlKey||event.metaKey)&&key==="S"){event.preventDefault();saveCurrentProject();return}
  if((event.ctrlKey||event.metaKey)&&key==="O"){event.preventDefault();$("#projectFileInput").click();return}
  if(event.target.matches("input,textarea,select"))return;
  if(key==="ESCAPE"&&liveBuildingPlacement?.active?.()){event.preventDefault();liveBuildingPlacement.cancelStage();status("建築配置をキャンセル","command");return}
  if(liveBuildingPlacement?.groupGhost&&(key==="Q"||key==="E")){event.preventDefault();liveBuildingPlacement.rotateGroup(key==="Q"?-15:15);status(`建築ゴースト回転 ${key==="Q"?"-15":"+15"}°`,"command");return}

  if((event.ctrlKey||event.metaKey)&&key==="Z"){
    event.preventDefault();
    if(rebuildEngine.undo()){refresh();status("Undoしました")}
    else status("これ以上Undoできません");
    return;
  }

  if((event.ctrlKey||event.metaKey)&&key==="Y"){
    event.preventDefault();
    if(rebuildEngine.redo()){refresh();status("Redoしました")}
    else status("これ以上Redoできません");
    return;
  }
  if(spacecraftFlight?.handleKey?.(event,true)){event.preventDefault();updateSpacecraftStatus?.();return;}
  if(avatarManager?.handleKey?.(event,true)){event.preventDefault();return;}
  if(state.sketchMode){
    if(key==="DELETE")sketchController.deleteSelected();
    else if(key==="ESCAPE"){sketchController.pendingPoint=null;sketchController.setTool("select")}
    else if(key==="L")setSketchCommand("line","L (LINE)");
    else if(key==="C")setSketchCommand("circle","C (CIRCLE)");
    else if(key==="R")setSketchCommand("rectangle","REC (RECTANGLE)");
    else if(key==="P")setSketchCommand("point","P (POINT)");
    else if(key==="H")applySketchConstraint("Horizontal");
    else if(key==="J")applySketchConstraint("Vertical");
    else if(key==="K")applySketchConstraint("Coincident");
    else if(key==="A")applySketchConstraint("Parallel");
    else if(key==="O")applySketchConstraint("Perpendicular");
    else if(key==="Q")applySketchConstraint("EqualLength");
    else if(key==="N")applySketchConstraint("Concentric");
    else if(key==="M")applySketchConstraint("Midpoint");
    else if(key==="X")applySketchConstraint("Fixed");
    else if(key==="D")openDimensionDialog();
    else if(key==="ENTER"){if(sketchController.activeTool==='spline'&&sketchController.splinePoints?.length)sketchController.finishSpline();else finishActiveSketch();}
    return
  }

  if(key==="1")setSelectionMode("body");
  else if(key==="2")setSelectionMode("face");
  else if(key==="3")setSelectionMode("edge");
  else if(key==="4")setSelectionMode("vertex");
  else if(key==="M")openTransform("relative","move");
  else if(key==="R")openTransform("relative","rotate");
  else if(key==="C"){
    event.preventDefault();
    status(`${copy(state)}個コピー`);
  }else if(key==="V"){
    event.preventDefault();
    const made=paste(state,addPart);
    selection.paint();
    refresh();
    status(`${made.length}個貼付`);
  }else if(key==="DELETE"){
    removeSelected();
  }else if(key==="G"){
    $("#groupDialog").classList.add("show");
  }else if(key==="E"){openFaceExtrude();
  }else if(key==="C"&&event.shiftKey){openDefaultChamfer();
  }else if(key==="F5"){
    runFullRebuild();
  }else if(key==="E"&&event.altKey){
    openEdgeKernel();
  }else if(key==="F"&&event.shiftKey){
    openEdgeFeature("Chamfer");
  }else if(key==="F"&&event.altKey){
    openEdgeFeature("Fillet");
  }else if(key==="F"){
    openFeatureDialog();
  }else if(event.key==="Escape"){snapAssist?.clear?.();
    if(referenceMate.active){referenceMate.cancel();$("#referenceMateDialog").classList.remove("show");status("基準一致を取消","command");return;}
    if(partPlacementAssist?.active?.()){partPlacementAssist.cancel();refresh();status("小部品配置を取消","command");return;}
    if(state.seamless?.workbenchActive){seamlessWorld.leaveWorkbench();updateScaleHud();status("Workbenchから世界へ戻りました","command");return;}
    transform.restore();
    transform.clear();
    geometrySelection.clear();
    document.querySelectorAll(".dialog.show").forEach(dialog=>{
      dialog.classList.remove("show");
    });
    refresh();
  }
});

document.addEventListener("keyup",event=>{if(event.target?.matches?.("input,textarea,select"))return;if(spacecraftFlight?.handleKey?.(event,false)){event.preventDefault();return;}if(avatarManager?.handleKey?.(event,false))event.preventDefault();});

document.querySelectorAll(".dialog").forEach(dialog=>{
  dialog.addEventListener("pointerdown",event=>{
    if(event.target===dialog)dialog.classList.remove("show");
  });
});

// Default experience starts outdoors on the planet surface in TPV. The first workbench is carried in inventory; no CAD object is spawned at the planet centre.


if($("#creatorAvatarHide"))$("#creatorAvatarHide").onclick=()=>{const g=avatarManager?.group;if(!g)return;g.visible=!g.visible;$("#creatorAvatarHide").textContent=g.visible?'👤 アバター非表示':'👤 アバター表示';status(g.visible?'アバター表示':'作業視界優先: アバターを一時非表示','command')};
function bindCraftHold(id,yaw,pitch,roll){const el=$(id);if(!el)return;const on=e=>{e.preventDefault();spacecraftFlight?.setControlInput?.(yaw,pitch,roll)};const off=()=>spacecraftFlight?.setControlInput?.(0,0,0);el.addEventListener('pointerdown',on);el.addEventListener('pointerup',off);el.addEventListener('pointercancel',off);el.addEventListener('pointerleave',off)}
bindCraftHold('#craftYawLeft',-1,0,0);bindCraftHold('#craftYawRight',1,0,0);bindCraftHold('#craftPitchUp',0,1,0);bindCraftHold('#craftPitchDown',0,-1,0);bindCraftHold('#craftRollLeft',0,0,-1);bindCraftHold('#craftRollRight',0,0,1);
$("#spacecraftBtn").onclick=()=>{$("#spacecraftDialog").classList.add("show");$("#spacecraftEnginePlume").checked=state.spacecraft?.enginePlume!==false;refreshSpacecraftTargets();updateSpacecraftStatus()};
$("#spacecraftClose").onclick=()=>$("#spacecraftDialog").classList.remove("show");
$("#spacecraftPartAdd").onclick=()=>{const p=spacecraftParts.create($("#spacecraftPartType").value);refresh();status(`宇宙船部品を作成: ${p?.name||''}`,"command")};
$("#spacecraftAssemble").onclick=()=>{try{const c=spacecraftFlight.assembleSelected();status(`宇宙船 ${c.id} を登録`,`command`);updateSpacecraftStatus()}catch(e){status(e.message,"error")}};
$("#spacecraftBoard").onclick=()=>{try{spacecraftFlight.board();status('運転席へ搭乗','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};$("#spacecraftUnboard").onclick=()=>{try{spacecraftFlight.unboard();avatarManager?.sync?.();status('宇宙船から降りました','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftLaunch").onclick=()=>{try{spacecraftFlight.launch();status('離陸開始','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftOrbit").onclick=()=>{try{spacecraftFlight.setOrbit();status('軌道投入','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftTransfer").onclick=()=>{try{spacecraftFlight.transfer($("#spacecraftTarget").value);status(`惑星間航行: ${$("#spacecraftTarget").value}`,'command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftLand").onclick=()=>{try{spacecraftFlight.land();status('着陸シーケンス開始','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftThrottle").oninput=()=>{try{spacecraftFlight.setThrottle((Number($("#spacecraftThrottle").value)||0)/100);updateSpacecraftStatus()}catch(e){}};
$("#spacecraftProgradeBurn").onclick=()=>{try{spacecraftFlight.burn('prograde',Number($("#spacecraftBurnDv").value)||1);status('Prograde burn','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftRetrogradeBurn").onclick=()=>{try{spacecraftFlight.burn('retrograde',Number($("#spacecraftBurnDv").value)||1);status('Retrograde burn','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftCockpitView").onclick=()=>{try{spacecraftFlight.setCameraMode('cockpit');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftChaseView").onclick=()=>{try{spacecraftFlight.setCameraMode('chase');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftOrbitView").onclick=()=>{try{spacecraftFlight.setCameraMode('orbit');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftWalkFPV").onclick=()=>{try{spacecraftFlight.enterWalkMode('fpv');avatarManager?.sync?.();status('航行中の船内FPV歩行','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftWalkTPV").onclick=()=>{try{spacecraftFlight.enterWalkMode('tpv');avatarManager?.sync?.();status('航行中の船内TPV歩行','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftReturnSeat").onclick=()=>{try{spacecraftFlight.exitWalkMode();status('運転席へ戻りました','command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftModify").onclick=()=>{try{const c=spacecraftFlight.active();const on=spacecraftFlight.setModifyMode(!(c&&c.modifyMode));creatorMode?.setEnabled?.(on);status(`宇宙船改造モード ${on?'ON':'OFF'}`,'command');updateSpacecraftStatus()}catch(e){status(e.message,'error')}};
$("#spacecraftEnginePlume").onchange=e=>{state.spacecraft.enginePlume=!!e.target.checked;};
$("#celestialApply").onclick=applyCelestialDialog;$("#celestialClose").onclick=()=>$("#celestialDialog").classList.remove("show");
planetManager.spawnAvatar(avatarManager);
avatarManager.setMode("tpv");
scene.loop();
refresh();

// v5.12.3 property-integrated datum editing and safe avatar teleport.
window.addEventListener('ue:property-datum',e=>{
  const id=e.detail?.objectId,part=state.object(id);if(!part)return;
  ensurePartDatums(part);state.selectedIds=[part.id];state.primaryId=part.id;selection.paint();
  openPartDatumDialog?.();
  status(e.detail?.action==='change'?'基準面/基準軸を選択して変更してください':'基準点・基準軸・基準面を追加できます','command');
});
window.addEventListener('ue:avatar-teleport',e=>{
  const detail=e.detail||{};let cad=null;
  if(detail.objectId){const o=state.object(detail.objectId);if(o)cad=[...(o.position||[0,0,0])];}
  else {const a=String(detail.coordinate||'').split(/[ ,]+/).filter(Boolean).map(Number);if(a.length>=3&&a.slice(0,3).every(Number.isFinite))cad=a.slice(0,3);}
  if(!cad)return status('移動先座標が不正なためキャンセルしました','error');
  if(state.avatar?.onPlanet&&planetManager){
    const world=scene.cadPointToWorld(new THREE.Vector3(...cad)),n=world.clone().normalize(),h=planetManager.heightAtDirection(n),sea=planetManager.waterLevelScene();
    if(!Number.isFinite(h)||h<=sea+planetManager.mmToScene(100))return status('移動先が海中または安全でないためキャンセルしました','error');
    state.avatar.planetNormal=n.toArray();state.avatar.surfaceOffset=0;avatarManager.sync();state.avatar.mode==='fpv'?avatarManager.toFPV():avatarManager.toTPV();status('アバターを指定位置へ移動しました','command');return;
  }
  state.avatar.position=[cad[0],cad[1],Math.max(Number(state.physics?.floorZ)||0,cad[2])];avatarManager.sync();state.avatar.mode==='fpv'?avatarManager.toFPV():avatarManager.toTPV();status('アバターを指定座標へ移動しました','command');
});
