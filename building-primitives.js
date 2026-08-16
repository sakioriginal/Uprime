export class BuildingPrimitiveManager{
  constructor(state,addPart,getPlacementOrigin=null){this.state=state;this.addPart=addPart;this.getPlacementOrigin=getPlacementOrigin}
  avatarHeightMm(){return Math.max(800,(Number(this.state.avatar?.height)||170)*(Number(this.state.workspace?.unitScaleMm)||10))}
  origin(){
    const p=this.getPlacementOrigin?.();
    if(Array.isArray(p)&&p.length>=3)return [...p];
    const last=this.state.creator&&Array.isArray(this.state.creator.lastCreatePosition)?this.state.creator.lastCreatePosition:null;
    if(last)return [...last];
    const z=Number(this.state.workspace&&this.state.workspace.groundBaseCadZ);return [0,2500,Number.isFinite(z)?z:0]
  }
  create(kind){const H=this.avatarHeightMm(),o=this.origin();this.state.creator&&(this.state.creator.lastCreatePosition=[...o]);let params,position,name,rotation=[0,0,0];if(kind==='column'){params={width:H*.06,height:H,depth:H*.06};position=[o[0],o[1],o[2]+H/2];name='建築 柱'}else if(kind==='floor'){params={width:H,height:H*.04,depth:H};position=[o[0],o[1],o[2]+H*.02];name='建築 床板'}else if(kind==='wall'){params={width:H,height:H,depth:H*.05};position=[o[0],o[1],o[2]+H/2];name='建築 壁板'}else if(kind==='roof'){params={width:H,height:H*.045,depth:H};position=[o[0],o[1],o[2]+H*.85];rotation=[0,15,0];name='建築 屋根'}else return null;return this.addPart('box',{name,params,position,rotation,entityKind:'building',components:{building:{enabled:true,primitive:kind}}})}
}
