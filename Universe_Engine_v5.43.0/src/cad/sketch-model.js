import {buildSketchProfiles} from "./sketch-profiles.js";

const PREFIX={point:"P",line:"L",rectangle:"R",circle:"C",arc:"A",spline:"S",centerline:"CL"};

export class SketchModel {
  constructor({id,name,plane="XY",gridSize=10,ownerPartId=null}){
    this.id=id;this.name=name;this.plane=plane;this.gridSize=gridSize;this.ownerPartId=ownerPartId;
    this.entities=[];this.constraints=[];this.dimensions=[];this.visible=true;
    this.profileCount=0;this.nextEntityId=1;this.entityCounters={};
  }
  nextCode(type){
    const prefix=PREFIX[type]||"E";
    this.entityCounters[prefix]=(this.entityCounters[prefix]||0)+1;
    let code=`${prefix}${String(this.entityCounters[prefix]).padStart(3,"0")}`;
    while(this.entities.some(e=>e.code===code)){this.entityCounters[prefix]++;code=`${prefix}${String(this.entityCounters[prefix]).padStart(3,"0")}`}
    return code;
  }
  ensureEntityCodes(){
    this.entityCounters=this.entityCounters||{};
    for(const e of this.entities||[]){
      if(!e.code)e.code=this.nextCode(e.type);
      const m=String(e.code).match(/^([A-Z]+)(\d+)$/i);if(m)this.entityCounters[m[1].toUpperCase()]=Math.max(this.entityCounters[m[1].toUpperCase()]||0,Number(m[2])||0);
    }
    return this.entities;
  }
  addEntity(type,data){
    this.ensureEntityCodes();
    const entity={id:`${this.id}:entity:${this.nextEntityId++}`,code:this.nextCode(type),type,construction:false,visible:true,...structuredClone(data)};
    this.entities.push(entity);this.updateProfiles();return entity;
  }
  setEntityCode(entity,newCode){
    if(!entity)return false;const code=String(newCode||"").trim().toUpperCase();
    if(!/^[A-Z][A-Z0-9_-]{1,31}$/.test(code))throw new Error("IDは英字で始まる2〜32文字の英数字/_/-で指定してください");
    if(this.entities.some(e=>e!==entity&&String(e.code).toUpperCase()===code))throw new Error(`スケッチ要素ID ${code} は既に存在します`);
    entity.code=code;return true;
  }
  removeEntity(id){this.entities=this.entities.filter(e=>e.id!==id);this.updateProfiles()}
  entity(id){this.ensureEntityCodes();return this.entities.find(e=>e.id===id||String(e.code).toUpperCase()===String(id||"").toUpperCase())||null}
  updateProfiles(){this.ensureEntityCodes();return buildSketchProfiles(this).length}
}
