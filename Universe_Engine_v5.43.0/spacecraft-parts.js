export class SpacecraftPartsManager{
  constructor(state,addPart){this.state=state;this.addPart=addPart}
  origin(){const p=this.state.creator&&Array.isArray(this.state.creator.lastCreatePosition)?this.state.creator.lastCreatePosition:null;return p?[...p]:null}
  create(kind){
    const o=this.origin();let type='box',name='宇宙船部品',params={},scale=[1,1,1],rotation=[0,0,0],meta={kind};
    if(kind==='engine'){type='cylinder';name='ロケットエンジン';params={radius:1100,height:2800};meta={kind,thrustN:220000,ispSec:300,gimbalDeg:6}}
    else if(kind==='tank'){type='cylinder';name='燃料タンク';params={radius:1500,height:4800};meta={kind,fuelKg:850,capacityKg:850,fuelType:'generic-propellant'}}
    else if(kind==='seat'){type='box';name='運転席';params={width:900,height:1300,depth:950};meta={kind,seatRole:'pilot'}}
    else if(kind==='landing'){type='box';name='着陸脚';params={width:220,height:2200,depth:220};meta={kind,strokeMm:300,maxLoadKg:4000}}
    else if(kind==='parachute'){type='sphere';name='パラシュート';params={radius:850};scale=[1,.22,1];meta={kind,areaM2:28,deployed:false}}
    else if(kind==='rcs'){type='cylinder';name='RCSスラスター';params={radius:180,height:500};meta={kind,thrustN:1200,ispSec:220}}
    else if(kind==='hull'){type='cylinder';name='有人船体';params={radius:2200,height:6500};meta={kind,pressurized:true,walkable:true,accessCompatible:true}}
    else if(kind==='deck'){type='box';name='船内床';params={width:3800,height:180,depth:5000};meta={kind,walkable:true,accessCompatible:true}}
    else if(kind==='wall'){type='box';name='船体壁';params={width:4200,height:2600,depth:180};meta={kind,pressurized:true,accessCompatible:true}}
    else return null;
    const data={name,params,rotation,scale,entityKind:'vehicle',components:{vehicle:{enabled:true,kind:'spacecraft'},spacecraftPart:{enabled:true,...meta}},metadata:{spacecraftPart:meta}};if(o)data.position=o;const part=this.addPart(type,data);
    return part;
  }
  kindOf(part){return part&&part.components&&part.components.spacecraftPart&&part.components.spacecraftPart.kind||part&&part.metadata&&part.metadata.spacecraftPart&&part.metadata.spacecraftPart.kind||null}
}
