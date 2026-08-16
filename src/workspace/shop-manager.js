const clone=v=>JSON.parse(JSON.stringify(v));
const sid=()=>`SHOP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*46656).toString(36).toUpperCase()}`;

const DEFAULT_STOCK=[
  {sku:'wood',kind:'resource',resource:'wood',name:'木',icon:'🪵',price:8,buyPrice:4,quantity:40},
  {sku:'stone',kind:'resource',resource:'stone',name:'石',icon:'🪨',price:7,buyPrice:3,quantity:40},
  {sku:'fiber',kind:'resource',resource:'fiber',name:'繊維',icon:'🌿',price:6,buyPrice:3,quantity:30},
  {sku:'iron',kind:'resource',resource:'iron',name:'鉄',icon:'🔩',price:24,buyPrice:12,quantity:16},
  {sku:'stone-axe',kind:'recipe',recipeId:'stone-axe',name:'石の斧',icon:'🪓',price:48,buyPrice:22,quantity:8},
  {sku:'stone-pickaxe',kind:'recipe',recipeId:'stone-pickaxe',name:'石のつるはし',icon:'⛏️',price:52,buyPrice:24,quantity:8},
  {sku:'torch',kind:'recipe',recipeId:'torch',name:'たいまつ',icon:'🔥',price:18,buyPrice:8,quantity:12},
  {sku:'bandage',kind:'recipe',recipeId:'bandage',name:'包帯',icon:'🩹',price:20,buyPrice:8,quantity:20},
  {sku:'bow',kind:'recipe',recipeId:'bow',name:'ボウ',icon:'🏹',price:75,buyPrice:34,quantity:5},
  {sku:'shield',kind:'recipe',recipeId:'shield',name:'シールド',icon:'🛡️',price:90,buyPrice:40,quantity:5}
];

export class ShopManager{
  constructor({state,scene,addPart,npcManager,itemCrafting,marketplace,groundResolver=null,onStatus=()=>{}}={}){
    this.state=state;this.scene=scene;this.addPart=addPart;this.npcManager=npcManager;this.itemCrafting=itemCrafting;this.marketplace=marketplace;this.groundResolver=groundResolver;this.onStatus=onStatus;this.ensureState();
  }
  ensureState(){
    this.state.shops=Array.isArray(this.state.shops)?this.state.shops:[];
    for(const s of this.state.shops){s.stock=Array.isArray(s.stock)?s.stock:clone(DEFAULT_STOCK);s.cash=Number.isFinite(Number(s.cash))?Number(s.cash):500;s.open=s.open!==false;s.position=Array.isArray(s.position)?s.position:[0,0,0];for(const line of s.stock){line.basePrice=Number(line.basePrice)||Number(line.price)||10;line.baseBuyPrice=Number(line.baseBuyPrice)||Number(line.buyPrice)||Math.max(1,line.basePrice*.45);}}
    return this.state.shops;
  }
  list(){return this.ensureState();}
  get(id){return this.ensureState().find(s=>s.id===id)||null;}
  _ground(pos){try{return this.groundResolver?this.groundResolver(pos):pos}catch{return pos}}
  createShop({name='フロンティア雑貨店',position=[0,0,0],yaw=0,starter=false}={}){
    const p=this._ground([Number(position[0])||0,Number(position[1])||0,Number(position[2])||0]);
    const id=sid(),shop={id,name,position:[...p],yaw:Number(yaw)||0,cash:800,open:true,keeperId:null,objectIds:[],stock:clone(DEFAULT_STOCK),createdAt:new Date().toISOString(),starter:!!starter};
    const x=p[0],y=p[1],z=p[2],c=Math.cos(yaw*Math.PI/180),s=Math.sin(yaw*Math.PI/180);
    const rot=(dx,dy)=>[x+dx*c-dy*s,y+dx*s+dy*c];
    const part=(type,data)=>{const o=this.addPart(type,{...data,entityKind:'building',metadata:{...(data.metadata||{}),shopId:id,shopPart:true},components:{...(data.components||{}),building:{enabled:true,primitive:data.metadata?.shopPrimitive||'shop',layer:data.metadata?.shopLayer||'shop'},shop:{enabled:true,shopId:id}}},false);if(o)shop.objectIds.push(o.id);return o};
    // 4.8m x 3.6m compact roadside store, open front with counter.
    part('box',{name:`${name} 床`,params:{width:4800,height:160,depth:3600},position:[x,y,z+80],rotation:[0,0,yaw],color:0x8f806b,metadata:{walkable:true,shopPrimitive:'floor',shopLayer:'floor'}});
    for(const w of [
      {dx:0,dy:1750,w:4800,d:120,label:'奥壁'},
      {dx:-2340,dy:0,w:3600,d:120,label:'左壁',a:90},
      {dx:2340,dy:0,w:3600,d:120,label:'右壁',a:90}
    ]){const q=rot(w.dx,w.dy);part('box',{name:`${name} ${w.label}`,params:{width:w.w,height:2600,depth:w.d},position:[q[0],q[1],z+1460],rotation:[0,0,yaw+(w.a||0)],color:0xd8c6a5,metadata:{shopPrimitive:'wall',shopLayer:'wall'}})}
    const cq=rot(0,700);part('box',{name:`${name} カウンター`,params:{width:2600,height:950,depth:650},position:[cq[0],cq[1],z+555],rotation:[0,0,yaw],color:0x6f4d35,metadata:{shopPrimitive:'counter',shopLayer:'furniture'}});
    const sq=rot(0,-1760);part('box',{name:`🏪 ${name} 看板`,params:{width:2200,height:650,depth:80},position:[sq[0],sq[1],z+2250],rotation:[0,0,yaw],color:0xd49b38,metadata:{shopPrimitive:'sign',shopLayer:'signage',surfaceArt:{enabled:true,type:'text',text:`🏪 ${name}`,background:'#8c5d22',textColor:'#fff6d5'}}});
    const kp=rot(0,1150);const keeper=this.npcManager?.create?.({name:'店番 ミナ',position:this._ground([kp[0],kp[1],z+5]),yaw:yaw+180,body:'#9b6b45',hair:'#2b1d18',role:'shopkeeper',shopId:id,occupation:'店番',dialogue:['いらっしゃいませ！','今日は何をお探しですか？','素材の買取もしていますよ。']});
    if(keeper)shop.keeperId=keeper.id;
    this.state.shops.push(shop);this.onStatus(`🏪 ${name} と店番を作成しました`,'command');return shop;
  }
  ensureStarterShop(position=[6000,-2500,0]){this.ensureState();if(this.state.shops.length)return this.state.shops[0];return this.createShop({name:'フロンティア雑貨店',position,starter:true});}
  wallet(){return this.marketplace?.wallet?.()||{balance:0};}
  buy(shopId,sku,count=1){
    const shop=this.get(shopId),line=shop?.stock?.find(x=>x.sku===sku);count=Math.max(1,Math.floor(Number(count)||1));if(!shop||!line||!shop.open)throw new Error('店または商品が利用できません');if((Number(line.quantity)||0)<count)throw new Error('在庫が足りません');
    const total=(Number(line.price)||0)*count,w=this.wallet();if((Number(w.balance)||0)<total)throw new Error('所持ポイントが不足しています');
    w.balance-=total;w.spent=(Number(w.spent)||0)+total;shop.cash=(Number(shop.cash)||0)+total;line.quantity-=count;
    for(let i=0;i<count;i++){if(line.kind==='resource')this.itemCrafting?.addResource?.(line.resource,1);else this.itemCrafting?.grantRecipe?.(line.recipeId,1)}
    shop.lastTradeAt=new Date().toISOString();const v=(this.state.villages||[]).find(v=>v.id===shop.villageId);if(v){v.economy=v.economy||{};v.economy.demand=v.economy.demand||{};v.economy.demand[line.resource||line.sku]=(Number(v.economy.demand[line.resource||line.sku])||0)+count;}this.onStatus(`購入: ${line.name} ×${count} / ${total}pt`,'command');return {line,total};
  }
  sellResource(shopId,resource,count=1){
    const shop=this.get(shopId),line=shop?.stock?.find(x=>x.kind==='resource'&&x.resource===resource);count=Math.max(1,Math.floor(Number(count)||1));if(!shop||!line)throw new Error('この店では買い取れません');const r=this.itemCrafting?.resources?.()||{};if((Number(r[resource])||0)<count)throw new Error('売却する素材が足りません');const total=(Number(line.buyPrice)||0)*count;if((Number(shop.cash)||0)<total)throw new Error('店の資金が不足しています');
    r[resource]-=count;shop.cash-=total;line.quantity=(Number(line.quantity)||0)+count;const w=this.wallet();w.balance=(Number(w.balance)||0)+total;w.earned=(Number(w.earned)||0)+total;shop.lastTradeAt=new Date().toISOString();const v=(this.state.villages||[]).find(v=>v.id===shop.villageId);if(v){v.economy=v.economy||{};v.economy.supply=v.economy.supply||{};v.economy.supply[resource]=(Number(v.economy.supply[resource])||0)+count;}this.onStatus(`売却: ${line.name} ×${count} / +${total}pt`,'command');return {line,total};
  }
  restock(shopId){const shop=this.get(shopId);if(!shop)return false;for(const line of shop.stock)line.quantity=Math.max(Number(line.quantity)||0,line.kind==='resource'?30:6);return true;}
}
