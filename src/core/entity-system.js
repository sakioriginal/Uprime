const ENTITY_SCHEMA_VERSION = 1;

function cloneJson(value){
  if(value==null)return value;
  return JSON.parse(JSON.stringify(value));
}

export function ensureEntity(object){
  if(!object||typeof object!=="object")throw new Error("Entity object is required");
  object.entity=object.entity&&typeof object.entity==="object"?object.entity:{};
  const e=object.entity;
  e.schemaVersion=Number(e.schemaVersion||ENTITY_SCHEMA_VERSION);
  e.uid=e.uid||`entity:${object.id||object.objectId||crypto?.randomUUID?.()||Math.random().toString(36).slice(2)}`;
  e.kind=e.kind||object.entityKind||"object";
  e.parentEntityId=e.parentEntityId??null;
  e.tags=Array.isArray(e.tags)?e.tags:[];
  e.state=e.state&&typeof e.state==="object"?e.state:{enabled:true,damaged:false,locked:false};
  e.metadata=e.metadata&&typeof e.metadata==="object"?e.metadata:{};
  e.blueprint=e.blueprint&&typeof e.blueprint==="object"?e.blueprint:{sourceId:null,revision:1,manufacturable:true};
  e.manufacturing=e.manufacturing&&typeof e.manufacturing==="object"?e.manufacturing:{status:"design",materials:[],steps:[]};
  return e;
}

export function syncEntityKind(object,kind){
  const e=ensureEntity(object);
  e.kind=kind||object.entityKind||"object";
  object.entityKind=e.kind;
  return e.kind;
}

export function addEntityTag(object,tag){
  const e=ensureEntity(object);const key=String(tag||"").trim();
  if(key&&!e.tags.includes(key))e.tags.push(key);
  return e.tags;
}

export function removeEntityTag(object,tag){
  const e=ensureEntity(object);e.tags=e.tags.filter(t=>t!==tag);return e.tags;
}

export function setEntityState(object,key,value){
  const e=ensureEntity(object);e.state[key]=value;return value;
}

export class EntityRegistry{
  constructor(state){this.state=state;this.byUid=new Map();this.byObjectId=new Map();this.rebuild();}
  rebuild(){
    this.byUid.clear();this.byObjectId.clear();
    for(const object of this.state?.objects||[]){
      const e=ensureEntity(object);
      this.byUid.set(e.uid,object);
      if(object.objectId)this.byObjectId.set(String(object.objectId).toUpperCase(),object);
    }
    return this;
  }
  register(object){const e=ensureEntity(object);this.byUid.set(e.uid,object);if(object.objectId)this.byObjectId.set(String(object.objectId).toUpperCase(),object);return object;}
  unregister(object){if(!object)return;const e=ensureEntity(object);this.byUid.delete(e.uid);if(object.objectId)this.byObjectId.delete(String(object.objectId).toUpperCase());}
  find(id){const key=String(id||"").trim();return this.byUid.get(key)||this.byObjectId.get(key.toUpperCase())||this.state?.object?.(key)||null;}
  childrenOf(parent){const p=typeof parent==="string"?this.find(parent):parent;if(!p)return[];return (this.state?.objects||[]).filter(o=>ensureEntity(o).parentEntityId===p.id);}
  setParent(child,parent){const c=typeof child==="string"?this.find(child):child;const p=typeof parent==="string"?this.find(parent):parent;if(!c)throw new Error("Child entity not found");ensureEntity(c).parentEntityId=p?.id||null;return c;}
  snapshot(object){
    if(!object)return null;
    return cloneJson({
      id:object.id,objectId:object.objectId,name:object.name,type:object.type,
      entity:ensureEntity(object),components:object.components||{},motionAxes:object.motionAxes||[],sockets:object.sockets||[],
      physics:object.physics||{},metadata:object.metadata||{}
    });
  }
}

export {ENTITY_SCHEMA_VERSION};
