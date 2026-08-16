export const DEFAULT_JOINTS=[
  ["root",null],["pelvis","root"],["spine","pelvis"],["chest","spine"],["neck","chest"],["head","neck"],
  ["leftShoulder","chest"],["leftElbow","leftShoulder"],["leftWrist","leftElbow"],
  ["rightShoulder","chest"],["rightElbow","rightShoulder"],["rightWrist","rightElbow"],
  ["leftHip","pelvis"],["leftKnee","leftHip"],["leftAnkle","leftKnee"],
  ["rightHip","pelvis"],["rightKnee","rightHip"],["rightAnkle","rightKnee"]
];
function clone(v){return JSON.parse(JSON.stringify(v))}
function defJoint(name,parent){return {name,parent,rotation:[0,0,0],position:[0,0,0],limits:{rx:[-180,180],ry:[-180,180],rz:[-180,180]},enabled:true}}
export function ensureCharacter(entity){entity.character=entity.character&&typeof entity.character==="object"?entity.character:{};const c=entity.character;c.version=1;c.rig=c.rig&&typeof c.rig==="object"?c.rig:{};c.rig.joints=Array.isArray(c.rig.joints)&&c.rig.joints.length?c.rig.joints:DEFAULT_JOINTS.map(([n,p])=>defJoint(n,p));c.pose=c.pose||"neutral";c.locomotion=c.locomotion||{mode:"idle",speed:0,grounded:true};c.ik=c.ik||{enabled:true,targets:{leftHand:null,rightHand:null,leftFoot:null,rightFoot:null,lookAt:null}};c.anatomy=c.anatomy||{level:"dummy",layers:["dummy"]};return c}
export class LivingCharacterCore{constructor(state){this.state=state}attach(entity){return ensureCharacter(entity)}setAnatomyLevel(entity,level){const c=ensureCharacter(entity);c.anatomy.level=String(level||"dummy");if(!c.anatomy.layers.includes(c.anatomy.level))c.anatomy.layers.push(c.anatomy.level);return c.anatomy.level}setJoint(entity,name,rotation){const c=ensureCharacter(entity);const j=c.rig.joints.find(x=>x.name===name);if(!j)throw new Error(`Joint not found: ${name}`);j.rotation=rotation.slice(0,3).map(Number);return j}setIK(entity,slot,target){const c=ensureCharacter(entity);if(!(slot in c.ik.targets))throw new Error(`IK slot not found: ${slot}`);c.ik.targets[slot]=target?clone(target):null;return c.ik.targets[slot]}setLocomotion(entity,mode,speed=0){const c=ensureCharacter(entity);c.locomotion.mode=mode;c.locomotion.speed=Number(speed)||0;return c.locomotion}}
