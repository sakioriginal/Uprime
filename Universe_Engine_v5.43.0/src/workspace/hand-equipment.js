import * as THREE from 'three';
import {ensureSockets,addSocket} from '../core/sockets.js';
import {ensureComponents,setComponent} from '../core/component-system.js';

function cloneMaterial(m){if(Array.isArray(m))return m.map(x=>x&&x.clone?x.clone():x);return m&&m.clone?m.clone():m}
function disposeVisual(o){if(!o)return;o.traverse(c=>{if(Array.isArray(c.material))c.material.forEach(m=>m&&m.dispose&&m.dispose());else if(c.material&&c.material.dispose)c.material.dispose()});if(o.parent)o.parent.remove(o)}

export class HandEquipmentManager{
  constructor(state,scene,avatar){this.state=state;this.scene=scene;this.avatar=avatar;this.visuals={left:null,right:null};this.ensureState();if(this.scene&&this.scene.addLoopHook)this.scene.addLoopHook(()=>this.update())}
  ensureState(){this.state.avatar=this.state.avatar||{};this.state.avatar.hands=this.state.avatar.hands||{left:null,right:null};if(this.state.avatar.hands.left===undefined)this.state.avatar.hands.left=null;if(this.state.avatar.hands.right===undefined)this.state.avatar.hands.right=null;return this.state.avatar.hands}
  _part(id){return(this.state.objects||[]).find(o=>o.id===id||o.objectId===id)||null}
  _grip(part,hand){const list=ensureSockets(part);let s=list.find(x=>x.enabled!==false&&x.type==='grip'&&(x.hand===hand||x.hand==='either'||x.hand==='both'));if(!s)s=list.find(x=>x.enabled!==false&&x.type==='grip');if(!s)s=addSocket(part,{name:'Auto Grip',type:'grip',hand:'either',position:[0,0,0],rotation:[0,0,0]});return s}
  _wrist(hand){return this.avatar&&this.avatar.joints?this.avatar.joints[hand==='left'?'leftWrist':'rightWrist']:null}
  _makeVisual(part,grip,hand){if(!part.mesh)return null;const root=new THREE.Group();root.name=`held-${hand}-${part.id}`;const visual=part.mesh.clone(true);visual.traverse(c=>{if(c.material)c.material=cloneMaterial(c.material);c.userData={...(c.userData||{}),heldVisual:true};});const rootScale=new THREE.Vector3(1,1,1);this.scene.root.updateMatrixWorld(true);this.scene.root.getWorldScale(rootScale);visual.scale.set((part.scale&&part.scale[0]||1)*rootScale.x,(part.scale&&part.scale[2]||1)*rootScale.y,(part.scale&&part.scale[1]||1)*rootScale.z);
    const r=grip.rotation||[0,0,0],q=new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(Number(r[0])||0),THREE.MathUtils.degToRad(Number(r[2])||0),THREE.MathUtils.degToRad(Number(r[1])||0),'XYZ')).invert();visual.quaternion.copy(q);const p=grip.position||[0,0,0],scale=rootScale.x;visual.position.set(-(Number(p[0])||0)*scale,-(Number(p[2])||0)*scale,-(Number(p[1])||0)*scale);root.add(visual);return root}

  _attachForView(hand){const visual=this.visuals[hand];if(!visual)return;const mode=this.state.avatar&&this.state.avatar.mode;if(mode==='fpv'){if(visual.parent!==this.scene.camera)this.scene.camera.add(visual);const h=Math.max(80,Number(this.state.avatar.height)||170);visual.position.set((hand==='left'?-1:1)*h*.13,-h*.14,-h*.42);visual.rotation.set(0,(hand==='left'?.18:-.18),0)}else{const wrist=this._wrist(hand);if(wrist&&visual.parent!==wrist){wrist.add(visual);visual.position.set(0,0,0);visual.rotation.set(0,0,0)}}}
  update(){this._attachForView('left');this._attachForView('right')}
  hold(part,hand='right'){
    hand=hand==='left'?'left':'right';if(!part)return false;this.drop(hand,false);const wrist=this._wrist(hand);if(!wrist)return false;ensureComponents(part);setComponent(part,'item',true);setComponent(part,'equipment',true);const grip=this._grip(part,hand),visual=this._makeVisual(part,grip,hand);if(!visual)return false;wrist.add(visual);part.mesh.visible=false;part.metadata=part.metadata||{};part.metadata.heldBy='player';part.metadata.heldHand=hand;this.visuals[hand]=visual;this.ensureState()[hand]=part.id;this._attachForView(hand);return true;
  }
  holdSelected(hand='right'){const part=this.state.primary?this.state.primary():null;return this.hold(part,hand)}
  drop(hand='right',place=true){hand=hand==='left'?'left':'right';const hands=this.ensureState(),id=hands[hand],part=id?this._part(id):null,visual=this.visuals[hand];if(part&&visual&&place){visual.updateMatrixWorld(true);const world=new THREE.Vector3();visual.getWorldPosition(world);part.position=this.scene.worldPointToCad(world);}
    if(part){part.metadata=part.metadata||{};delete part.metadata.heldBy;delete part.metadata.heldHand;if(part.mesh){part.mesh.visible=part.visible!==false;this.scene.sync(part)}}disposeVisual(visual);this.visuals[hand]=null;hands[hand]=null;return part||null;
  }
  dropAll(){this.drop('left');this.drop('right')}
  toggleSelected(hand='right'){const id=this.ensureState()[hand];const selected=this.state.primary?this.state.primary():null;if(id&&selected&&id===selected.id)return!!this.drop(hand);if(selected)return this.hold(selected,hand);return!!this.drop(hand)}
  restore(){const hands={...this.ensureState()};this.visuals.left=this.visuals.right=null;if(hands.left){const p=this._part(hands.left);this.state.avatar.hands.left=null;if(p)this.hold(p,'left')}if(hands.right){const p=this._part(hands.right);this.state.avatar.hands.right=null;if(p)this.hold(p,'right')}}
  status(){const h=this.ensureState();const left=this._part(h.left),right=this._part(h.right);return{left:left?left.objectId||left.name:null,right:right?right.objectId||right.name:null}}
}
