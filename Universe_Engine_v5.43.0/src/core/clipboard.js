
function clean(value, seen=new WeakSet()){
  if(value===null||value===undefined)return value;
  const t=typeof value;
  if(t==='number'||t==='string'||t==='boolean')return value;
  if(t==='function'||t==='symbol'||t==='bigint')return undefined;
  if(value instanceof Date)return value.toISOString();
  if(Array.isArray(value))return value.map(v=>clean(v,seen)).filter(v=>v!==undefined);
  if(t==='object'){
    if(seen.has(value))return undefined;
    seen.add(value);
    const out={};
    for(const [k,v] of Object.entries(value)){
      if(['mesh','edge','geometry','material','parent','children','quaternion','matrix','matrixWorld','modelViewMatrix','normalMatrix'].includes(k))continue;
      const c=clean(v,seen); if(c!==undefined)out[k]=c;
    }
    seen.delete(value);
    return out;
  }
  return undefined;
}
export function serializable(part){return clean(part)}
export function copy(state){const list=state.selectedObjects();state.clipboard=list.map(serializable);return list.length}
export function paste(state,createPart){
  const made=[];
  for(const raw of state.clipboard||[]){
    const d=clean(raw); if(!d)continue;
    d.id=state.uid(); d.name=`${d.name||'Part'} Copy`;
    d.position=Array.isArray(d.position)?[...d.position]:[0,0,0]; d.position[0]+=20;
    d.groupId=null;
    if(Array.isArray(d.datums)){const oldToNew=new Map();d.datums=d.datums.filter(x=>!x?.system).map((x,i)=>{const id=`${d.id}:datum:copy-${i+1}`;if(x?.id)oldToNew.set(x.id,id);return {...x,id}});if(Array.isArray(d.geometryConstraints))d.geometryConstraints=d.geometryConstraints.map(c=>clean({...c,id:`${d.id}:constraint:${Math.random().toString(36).slice(2,8)}`,sourceId:oldToNew.get(c.sourceId)||c.sourceId,targetId:oldToNew.get(c.targetId)||c.targetId}))}
    made.push(createPart(d.type,d,false));
  }
  state.selectedIds=made.map(x=>x.id);state.primaryId=made.at(-1)?.id||null;return made;
}
