import * as THREE from 'three';
import {setComponent,ensureComponents} from '../core/component-system.js';
import {addSocket,ensureSockets} from '../core/sockets.js';

const clone=v=>JSON.parse(JSON.stringify(v));
const uid=(p='ITM')=>`${p}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*9999).toString().padStart(4,'0')}`;

const RECIPES=[
  {id:'stone-axe',name:'石の斧',category:'tool',icon:'🪓',cost:{wood:2,stone:3},hand:'right',model:{type:'box',params:{width:280,height:55,depth:90}},stats:{tool:'axe',power:2.5,durability:120,damage:16,rangeMm:1250}},
  {id:'plank-batch',name:'木材加工',category:'material',icon:'🪵',cost:{wood:2},station:'workbench',outputResource:{plank:4}},
  {id:'stone-block-batch',name:'石材加工',category:'material',icon:'🧱',cost:{stone:3},station:'workbench',outputResource:{stoneBlock:2}},
  {id:'iron-ingot',name:'鉄鉱石の精錬',category:'material',icon:'🔩',cost:{ironOre:2,wood:1},station:'workbench',outputResource:{iron:1}},
  {id:'mechanical-parts',name:'機械部品',category:'material',icon:'⚙️',cost:{iron:2,plank:1},station:'workbench',outputResource:{metalPart:2}},
  {id:'cart-kit',name:'手押しカートキット',category:'vehicle',icon:'🛒',cost:{plank:6,metalPart:2},station:'workbench',stackable:true,stats:{deployable:'cart'}},
  {id:'wood-club',name:'木のクラブ',category:'weapon',icon:'🪵',cost:{wood:3},hand:'right',model:{type:'cylinder',params:{radius:24,height:520,segments:16}},stats:{damage:18,rangeMm:1250,coneDeg:76,durability:80}},
  {id:'stone-pickaxe',name:'石のつるはし',category:'tool',icon:'⛏️',cost:{wood:2,stone:3},hand:'right',model:{type:'box',params:{width:360,height:55,depth:70}},stats:{tool:'pickaxe',power:2,durability:120,damage:14,rangeMm:1200}},
  {id:'iron-sword',name:'鉄の剣',category:'weapon',icon:'⚔️',cost:{wood:1,iron:4},hand:'right',model:{type:'box',params:{width:55,height:700,depth:18}},stats:{damage:38,rangeMm:1650,coneDeg:62,durability:220}},
  {id:'shield',name:'シールド',category:'equipment',icon:'🛡️',cost:{wood:2,iron:2},hand:'left',model:{type:'box',params:{width:420,height:520,depth:35}},stats:{armor:25,durability:180}},
  {id:'bow',name:'ボウ',category:'weapon',icon:'🏹',cost:{wood:3,fiber:2},hand:'left',model:{type:'box',params:{width:28,height:650,depth:28}},stats:{damage:28,rangeMm:7000,coneDeg:22,durability:150,ranged:true}},
  {id:'torch',name:'たいまつ',category:'tool',icon:'🔥',cost:{wood:1,fiber:1},hand:'right',model:{type:'cylinder',params:{radius:18,height:430,segments:12}},stats:{tool:'light',durability:100}},
  {id:'smartphone',name:'スマートフォン',category:'tool',icon:'📱',cost:{iron:1,metalPart:1},station:'workbench',hand:'right',model:{type:'box',params:{width:72,height:145,depth:9}},stats:{tool:'smartphone',device:'phone',durability:250,apps:['inventory','craft','map','media','multiplayer']}},
  {id:'audio-cd',name:'音楽CD',category:'media',icon:'💿',cost:{metalPart:1},station:'workbench',model:{type:'cylinder',params:{radius:60,height:1.2,segments:48}},stats:{mediaCarrier:'cd',mediaTitle:'Untitled CD',mediaUrl:'',provider:'youtube'}},
  {id:'vinyl-record',name:'レコード',category:'media',icon:'📀',cost:{metalPart:1},station:'workbench',model:{type:'cylinder',params:{radius:150,height:2,segments:64}},stats:{mediaCarrier:'vinyl',mediaTitle:'Untitled Record',mediaUrl:'',provider:'youtube'}},
  {id:'media-player',name:'メディアプレイヤー',category:'device',icon:'📻',cost:{iron:2,metalPart:2},station:'workbench',stackable:true,stats:{deployable:'mediaPlayer',device:'mediaPlayer'}},
  {id:'bandage',name:'包帯',category:'consumable',icon:'🩹',cost:{fiber:2},stackable:true,stats:{heal:30}},
  {id:'wood-wall-kit',name:'木壁キット',category:'building',icon:'🧱',cost:{wood:5},stackable:true,stats:{building:'wall',count:1}}
];

export class ItemCraftingManager{
  constructor({state,scene,addPart,handEquipment,workbench=null,avatar=null,onStatus=()=>{}}={}){this.state=state;this.scene=scene;this.addPart=addPart;this.handEquipment=handEquipment;this.workbench=workbench;this.avatar=avatar;this.onStatus=onStatus;this.ensureState();}
  ensureState(){
    this.state.inventory=this.state.inventory||{items:[]};this.state.inventory.items=Array.isArray(this.state.inventory.items)?this.state.inventory.items:[];
    this.state.inventory.resources=this.state.inventory.resources||{};
    const r=this.state.inventory.resources;
    if(!this.state.inventory.craftingInitialized){Object.assign(r,{wood:Number(r.wood)||6,stone:Number(r.stone)||4,ironOre:Number(r.ironOre)||0,iron:Number(r.iron)||2,fiber:Number(r.fiber)||4,plank:Number(r.plank)||0,stoneBlock:Number(r.stoneBlock)||0,metalPart:Number(r.metalPart)||0});this.state.inventory.craftingInitialized=true;}
    this.state.avatar=this.state.avatar||{};this.state.avatar.equipment=this.state.avatar.equipment||{left:null,right:null,body:null};
    return this.state.inventory;
  }
  recipes(){return RECIPES.map(clone)}
  resources(){this.ensureState();return this.state.inventory.resources}
  canCraft(id){const rec=RECIPES.find(r=>r.id===id);if(!rec)return false;if(rec.station==='workbench'&&!this.workbench?.active?.())return false;const have=this.resources();return Object.entries(rec.cost||{}).every(([k,v])=>(Number(have[k])||0)>=v)}
  addResource(type,count=1){const r=this.resources();r[type]=(Number(r[type])||0)+Math.max(0,Number(count)||0);return r[type]}
  _consumeCost(cost){const r=this.resources();for(const [k,v] of Object.entries(cost||{}))r[k]=Math.max(0,(Number(r[k])||0)-v)}
  _inventoryRecord(rec,partId=null){return{id:uid(),type:rec.category==='weapon'?'weapon':rec.category,name:rec.name,recipeId:rec.id,icon:rec.icon||'◆',partId,quantity:1,stackable:!!rec.stackable,stats:clone(rec.stats||{}),createdAt:new Date().toISOString()}}
  craft(id){
    this.ensureState();const rec=RECIPES.find(r=>r.id===id);if(!rec)throw new Error('レシピが見つかりません');if(!this.canCraft(id)){this.onStatus(`${rec.name}: 素材不足`,'error');return null}
    this._consumeCost(rec.cost);
    if(rec.outputResource){for(const [k,v] of Object.entries(rec.outputResource))this.addResource(k,v);this.onStatus(`加工完了: ${rec.name}`,'command');return {type:'resource',output:clone(rec.outputResource)}}
    let item=this._inventoryRecord(rec);
    if(rec.stackable){const found=this.state.inventory.items.find(x=>x.recipeId===rec.id&&x.stackable);if(found){found.quantity=(Number(found.quantity)||1)+1;item=found}else this.state.inventory.items.push(item)}
    else{
      const p=this.addPart(rec.model?.type||'box',{name:rec.name,params:clone(rec.model?.params||{}),visible:false,metadata:{craftedItem:true,recipeId:rec.id,itemStats:clone(rec.stats||{}),itemCategory:rec.category},components:{item:{enabled:true},equipment:{enabled:true}}},false);
      ensureComponents(p);setComponent(p,'item',true);setComponent(p,'equipment',true);if(rec.category==='weapon')setComponent(p,'weapon',true);if(rec.category==='tool')setComponent(p,'tool',true);
      ensureSockets(p);addSocket(p,{name:'Grip',type:'grip',hand:rec.hand||'either',position:[0,0,0],rotation:[0,0,0]});p.visible=false;if(p.mesh)p.mesh.visible=false;item.partId=p.id;this.state.inventory.items.push(item);
    }
    this.onStatus(`CRAFT: ${rec.name}`,'command');return item;
  }
  grantRecipe(id,count=1){
    this.ensureState();const rec=RECIPES.find(r=>r.id===id);if(!rec)throw new Error('レシピが見つかりません');let last=null;
    for(let n=0;n<Math.max(1,Math.floor(Number(count)||1));n++){
      if(rec.outputResource){for(const [k,v] of Object.entries(rec.outputResource))this.addResource(k,v);last={type:'resource',output:clone(rec.outputResource)};continue}
      let item=this._inventoryRecord(rec);
      if(rec.stackable){const found=this.state.inventory.items.find(x=>x.recipeId===rec.id&&x.stackable);if(found){found.quantity=(Number(found.quantity)||1)+1;item=found}else this.state.inventory.items.push(item)}
      else{const p=this.addPart(rec.model?.type||'box',{name:rec.name,params:clone(rec.model?.params||{}),visible:false,metadata:{craftedItem:true,recipeId:rec.id,itemStats:clone(rec.stats||{}),itemCategory:rec.category},components:{item:{enabled:true},equipment:{enabled:true}}},false);ensureComponents(p);setComponent(p,'item',true);setComponent(p,'equipment',true);if(rec.category==='weapon')setComponent(p,'weapon',true);if(rec.category==='tool')setComponent(p,'tool',true);ensureSockets(p);addSocket(p,{name:'Grip',type:'grip',hand:rec.hand||'either',position:[0,0,0],rotation:[0,0,0]});p.visible=false;if(p.mesh)p.mesh.visible=false;item.partId=p.id;this.state.inventory.items.push(item)}
      last=item;
    }
    return last;
  }
  itemById(id){return this.state.inventory?.items?.find(x=>x.id===id)||null}
  _part(item){return item?.partId?(this.state.objects||[]).find(p=>p.id===item.partId):null}
  equip(itemOrId,hand=null){
    this.ensureState();const item=typeof itemOrId==='string'?this.itemById(itemOrId):itemOrId;if(!item||!item.partId){this.onStatus('このアイテムは手に装備できません','info');return false}const rec=RECIPES.find(r=>r.id===item.recipeId);hand=hand||(rec?.hand==='left'?'left':'right');const part=this._part(item);if(!part)return false;
    this.unequip(hand);part.visible=true;const ok=this.handEquipment?.hold?.(part,hand);if(!ok){part.visible=false;return false}this.state.avatar.equipment[hand]=item.id;this.state.inventory.items=this.state.inventory.items.filter(x=>x.id!==item.id);this.onStatus(`EQUIP ${hand.toUpperCase()}: ${item.name}`,'command');return true;
  }
  unequip(hand='right'){
    this.ensureState();hand=hand==='left'?'left':'right';const itemId=this.state.avatar.equipment[hand];if(!itemId)return false;let item=this.itemById(itemId);if(!item){const partId=this.state.avatar?.hands?.[hand];const p=(this.state.objects||[]).find(x=>x.id===partId);if(p){const rec=RECIPES.find(r=>r.id===p.metadata?.recipeId);item=this._inventoryRecord(rec||{id:p.metadata?.recipeId||'custom',name:p.name,category:p.metadata?.itemCategory||'item',stats:p.metadata?.itemStats||{}},p.id);item.id=itemId}}
    const part=this.handEquipment?.drop?.(hand,false);if(part){part.visible=false;if(part.mesh)part.mesh.visible=false}if(item&&!this.state.inventory.items.some(x=>x.id===item.id))this.state.inventory.items.push(item);this.state.avatar.equipment[hand]=null;this.onStatus(`UNEQUIP ${hand.toUpperCase()}`,'command');return true;
  }
  equippedItem(hand='right'){const id=this.state.avatar?.equipment?.[hand];if(!id)return null;const inv=this.itemById(id);if(inv)return inv;const partId=this.state.avatar?.hands?.[hand],p=(this.state.objects||[]).find(x=>x.id===partId);if(!p)return null;return{id,name:p.name,partId:p.id,stats:clone(p.metadata?.itemStats||{}),recipeId:p.metadata?.recipeId||null,type:p.metadata?.itemCategory||'item'}}
  combatStats(){const right=this.equippedItem('right'),left=this.equippedItem('left');const weapon=[right,left].find(x=>x&&Number(x.stats?.damage)>0);const shield=[left,right].find(x=>x&&Number(x.stats?.armor)>0);return{weapon,damage:Number(weapon?.stats?.damage)||null,rangeMm:Number(weapon?.stats?.rangeMm)||null,coneDeg:Number(weapon?.stats?.coneDeg)||null,armor:Number(shield?.stats?.armor)||0,ranged:!!weapon?.stats?.ranged}}
  use(itemOrId){const item=typeof itemOrId==='string'?this.itemById(itemOrId):itemOrId;if(!item)return false;if(item.stats?.deployable==='cart'){const a=this.avatar?.root||this.avatar?.group;const wp=new THREE.Vector3();let pos=[0,0,0];if(a?.getWorldPosition&&wp?.toArray){a.getWorldPosition(wp);pos=wp.toArray()}const base=this.addPart('box',{name:'Hand Cart',params:{width:900,height:120,depth:1400},position:pos,metadata:{vehicleType:'cart',craftedVehicle:true}},true);this.consume(item,1);this.onStatus('🛒 手押しカートを配置しました','command');return !!base}
    if(item.stats?.mediaCarrier){try{window.dispatchEvent(new CustomEvent('ue:media-carrier-open',{detail:{itemId:item.id}}))}catch{}this.onStatus(`${item.icon||'💿'} メディア設定を開きました`,'command');return true}
    if(item.stats?.deployable==='mediaPlayer'){const a=this.avatar?.root||this.avatar?.group;const wp=new THREE.Vector3();let pos=[0,0,0];if(a?.getWorldPosition){a.getWorldPosition(wp);pos=wp.toArray()}const base=this.addPart('box',{name:'Media Player',params:{width:420,height:180,depth:320},position:pos,metadata:{mediaPlayer:{enabled:true,carrierItemId:null,playing:false,volume:.8,loop:true,spatialAudio:true,audioRefDistanceMm:1800,audioMaxDistanceMm:25000,audioRolloff:1.35}}},true);this.consume(item,1);try{window.dispatchEvent(new CustomEvent('ue:media-player-placed',{detail:{partId:base.id}}))}catch{}this.onStatus('📻 メディアプレイヤーを配置しました','command');return !!base}
    if(item.stats?.device==='phone'){try{window.dispatchEvent(new CustomEvent('ue:smartphone-open',{detail:{itemId:item.id}}))}catch{}this.onStatus('📱 スマートフォンを開きました','command');return true}
    if(Number(item.stats?.heal)>0){const g=this.state.multiplayer?.gameplay;if(g){g.hp=Math.min(Number(g.maxHp)||100,(Number(g.hp)||0)+Number(item.stats.heal));this.consume(item,1);this.onStatus(`USE ${item.name}: HP ${g.hp}/${g.maxHp}`,'command');return true}}return false}
  consume(item,count=1){if(!item)return false;if(item.stackable&&(Number(item.quantity)||1)>count){item.quantity-=count;return true}this.state.inventory.items=this.state.inventory.items.filter(x=>x.id!==item.id);return true}
  customItemFromSelected({name=null,category='tool',hand='right',stats={}}={}){const p=this.state.primary?.();if(!p){this.onStatus('アイテム化するCADオブジェクトを選択してください','error');return null}p.metadata=p.metadata||{};p.metadata.craftedItem=true;p.metadata.recipeId='custom';p.metadata.itemCategory=category;p.metadata.itemStats=clone(stats);ensureComponents(p);setComponent(p,'item',true);setComponent(p,'equipment',true);ensureSockets(p);if(!p.sockets.some(s=>s.type==='grip'))addSocket(p,{name:'Grip',type:'grip',hand,position:[0,0,0],rotation:[0,0,0]});const item={id:uid(),type:category,name:name||p.name||'Custom Item',recipeId:'custom',icon:'🛠️',partId:p.id,quantity:1,stats:clone(stats)};p.visible=false;if(p.mesh)p.mesh.visible=false;this.state.inventory.items.push(item);this.onStatus(`CADアイテム化: ${item.name}`,'command');return item}
}
