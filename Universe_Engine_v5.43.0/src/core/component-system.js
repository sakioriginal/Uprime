import {ensureEntity,syncEntityKind} from "./entity-system.js";

export const COMPONENT_TYPES={
  lifeCore:{label:'Life Core / いのち',icon:'♡'},
  brain:{label:'Brain / 思考',icon:'🧠'},
  character:{label:'Character',icon:'人'},
  vehicle:{label:'Vehicle',icon:'🚗'},
  building:{label:'Building',icon:'⌂'},
  skeleton:{label:'Skeleton / 骨格',icon:'☊'},
  animation:{label:'Animation',icon:'▶'},
  locomotion:{label:'Locomotion / 移動',icon:'🚶'},
  propulsion:{label:'Propulsion / 推進',icon:'➤'},
  inventory:{label:'Inventory',icon:'▣'},
  item:{label:'Item / 持てる物',icon:'✋'},
  equipment:{label:'Equipment / 装備',icon:'🛡'},
  container:{label:'Container / 収納',icon:'□'},
  physics:{label:'Physics / 物理',icon:'⚛'},
  damage:{label:'Damage / 損傷',icon:'⚠'},
  power:{label:'Power / 電力・動力',icon:'⚡'},
  blueprint:{label:'Blueprint / 設計図',icon:'◇'},
  manufacturing:{label:'Manufacturing / 製造',icon:'⚙'},
  script:{label:'Script / 自動化',icon:'⌘'}
};

export function ensureComponents(object){
  ensureEntity(object);
  object.components=object.components&&typeof object.components==='object'?object.components:{};
  return object.components;
}

export function hasComponent(object,key){return !!ensureComponents(object)[key]?.enabled}

export function setComponent(object,key,enabled=true,data={}){
  const c=ensureComponents(object);
  c[key]={...(c[key]||{}),...data,enabled:!!enabled};
  if(key==='lifeCore'&&!enabled){
    if(c.brain)c.brain.enabled=false;
    if(c.character)c.character.enabled=false;
  }
  if((key==='brain'||key==='character'||key==='skeleton'||key==='animation'||key==='locomotion')&&enabled){
    c.lifeCore={...(c.lifeCore||{}),enabled:true};
  }
  if(key==='locomotion'&&enabled){
    c.skeleton={...(c.skeleton||{}),enabled:true,level:c.skeleton?.level||'dummy'};
    c.animation={...(c.animation||{}),enabled:true};
  }
  if(key==='propulsion'&&enabled){
    c.propulsion={...(c.propulsion||{}),enabled:true,type:c.propulsion?.type||'generic'};
  }
  object.entityKind=classifyEntity(object);
  syncEntityKind(object,object.entityKind);
  return c[key];
}

export function classifyEntity(object){
  const c=ensureComponents(object);
  if(c.lifeCore?.enabled){
    if(c.brain?.enabled)return 'npc';
    return 'character';
  }
  if(c.vehicle?.enabled)return 'vehicle';
  if(c.building?.enabled)return 'building';
  return ensureEntity(object).kind||'object';
}

export function entityLabel(object){
  const kind=classifyEntity(object);
  return ({object:'物',character:'キャラクター',npc:'NPC',vehicle:'乗り物',building:'建物'})[kind]||kind;
}

export function lifeSummary(object){
  const c=ensureComponents(object);
  return {
    kind:classifyEntity(object),
    life:!!c.lifeCore?.enabled,
    brain:!!c.brain?.enabled,
    character:!!c.character?.enabled
  };
}
