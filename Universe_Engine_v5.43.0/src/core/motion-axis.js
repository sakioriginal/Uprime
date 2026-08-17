import * as THREE from "three";

function vec3(v,fallback=[0,0,0]){
  const a=Array.isArray(v)?v:fallback;return [Number(a[0])||0,Number(a[1])||0,Number(a[2])||0];
}
function norm(v){const q=new THREE.Vector3(...vec3(v,[0,0,1]));if(q.lengthSq()<1e-12)q.set(0,0,1);return q.normalize()}
export function ensureMotionAxes(part){part.motionAxes=Array.isArray(part.motionAxes)?part.motionAxes:[];return part.motionAxes}
export function addMotionAxis(part,data={}){
  const axes=ensureMotionAxes(part);const idx=axes.length+1;
  const axis={id:data.id||`MA${String(idx).padStart(3,'0')}`,name:data.name||`Motion Axis ${idx}`,type:data.type||'revolute',origin:vec3(data.origin),direction:vec3(data.direction,[0,0,1]),min:Number.isFinite(+data.min)?+data.min:0,max:Number.isFinite(+data.max)?+data.max:(data.type==='slider'?100:360),value:Number(data.value)||0,pitch:Number(data.pitch)||1,enabled:data.enabled!==false};
  axes.push(axis);return axis;
}
export function removeMotionAxis(part,id){part.motionAxes=ensureMotionAxes(part).filter(a=>a.id!==id)}
export function clampAxis(axis,v){const lo=Math.min(+axis.min||0,+axis.max||0),hi=Math.max(+axis.min||0,+axis.max||0);return Math.max(lo,Math.min(hi,Number(v)||0))}
export function applyMotionAxis(part,axis,scene){
  if(!part||!axis||axis.enabled===false)return;
  part.motionBase=part.motionBase||{position:[...part.position],rotation:[...part.rotation]};
  const base=part.motionBase,dir=norm(axis.direction),value=clampAxis(axis,axis.value);axis.value=value;
  const p=new THREE.Vector3(...base.position);const e=new THREE.Euler(...base.rotation,'XYZ');const q=new THREE.Quaternion().setFromEuler(e);
  if(axis.type==='slider'||axis.type==='cylindrical'||axis.type==='screw'){
    const mm=axis.type==='screw'?value*(Number(axis.pitch)||1):value;p.add(dir.clone().multiplyScalar(mm));
  }
  if(axis.type==='revolute'||axis.type==='cylindrical'||axis.type==='screw'){
    const deg=axis.type==='screw'?value*360:value;const rot=new THREE.Quaternion().setFromAxisAngle(dir,THREE.MathUtils.degToRad(deg));q.premultiply(rot);
  }
  part.position=[p.x,p.y,p.z];const out=new THREE.Euler().setFromQuaternion(q,'XYZ');part.rotation=[out.x,out.y,out.z];scene?.sync?.(part);
}
export function resetMotionBase(part){part.motionBase={position:[...part.position],rotation:[...part.rotation]}}
