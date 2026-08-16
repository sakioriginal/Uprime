import * as THREE from "three";
export function ensureAssemblyState(state){state.assemblyConstraints=Array.isArray(state.assemblyConstraints)?state.assemblyConstraints:[];return state.assemblyConstraints}
export function addAssemblyConstraint(state,data={}){const list=ensureAssemblyState(state);const c={id:data.id||`AC${String(list.length+1).padStart(3,'0')}`,name:data.name||`Assembly ${list.length+1}`,type:data.type||'coincident',sourceId:data.sourceId,targetId:data.targetId,sourceAxisId:data.sourceAxisId||null,targetAxisId:data.targetAxisId||null,value:Number(data.value)||0,enabled:data.enabled!==false};list.push(c);return c}
function axisDir(part,id){const a=(part.motionAxes||[]).find(x=>x.id===id);const d=a?.direction||[0,0,1];const v=new THREE.Vector3(...d);return v.lengthSq()?v.normalize():new THREE.Vector3(0,0,1)}
export function applyAssemblyConstraint(state,c,scene){if(!c||c.enabled===false)return false;const a=state.object(c.sourceId),b=state.object(c.targetId);if(!a||!b)return false;
  const da=axisDir(a,c.sourceAxisId),db=axisDir(b,c.targetAxisId);
  if(c.type==='coincident'||c.type==='concentric'){b.position=[...a.position]}
  else if(c.type==='distance'){const p=new THREE.Vector3(...a.position).add(da.multiplyScalar(Number(c.value)||0));b.position=[p.x,p.y,p.z]}
  else if(c.type==='parallel'||c.type==='perpendicular'){
    const target=c.type==='parallel'?da:Math.abs(da.z)<.9?new THREE.Vector3().crossVectors(da,new THREE.Vector3(0,0,1)).normalize():new THREE.Vector3().crossVectors(da,new THREE.Vector3(0,1,0)).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(db,target);const cur=new THREE.Quaternion().setFromEuler(new THREE.Euler(...b.rotation));q.multiply(cur);const e=new THREE.Euler().setFromQuaternion(q);b.rotation=[e.x,e.y,e.z];
  } else if(c.type==='angle'){
    const q=new THREE.Quaternion().setFromAxisAngle(da,THREE.MathUtils.degToRad(Number(c.value)||0));const cur=new THREE.Quaternion().setFromEuler(new THREE.Euler(...b.rotation));q.multiply(cur);const e=new THREE.Euler().setFromQuaternion(q);b.rotation=[e.x,e.y,e.z];
  }
  scene?.sync?.(b);return true}
export function applyAllAssemblyConstraints(state,scene){let n=0;for(const c of ensureAssemblyState(state))if(applyAssemblyConstraint(state,c,scene))n++;return n}
