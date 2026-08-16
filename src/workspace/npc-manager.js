import * as THREE from 'three';

const hex=v=>typeof v==='number'?v:parseInt(String(v||'').replace('#',''),16)||0xffffff;

export class NPCManager{
  constructor(state,scene){this.state=state;this.scene=scene;this.root=new THREE.Group();this.root.name='npc-characters';scene.scene.add(this.root);this.instances=new Map();this.ensureState();this.rebuild();this.bindInteraction();scene.addLoopHook?.((dt,now)=>this.update(dt,now));}
  ensureState(){this.state.characters=Array.isArray(this.state.characters)?this.state.characters:[];}
  nextId(){let i=1,id;do{id=`NPC${String(i++).padStart(3,'0')}`}while(this.state.characters.some(c=>c.id===id));return id}
  create(profile={}){this.ensureState();const n=this.state.characters.length;const p={id:this.nextId(),name:`NPC ${n+1}`,height:170,position:[80+n*55,-80,0],yaw:0,skin:'#c28b6d',body:'#5ea6d6',hair:'#2b1d18',blink:true,lifeCore:true,brain:true,emotion:'neutral',...profile};this.state.characters.push(p);this.rebuild();return p}
  remove(id){this.state.characters=this.state.characters.filter(c=>c.id!==id);this.rebuild()}
  rebuild(){this.root.clear();this.instances.clear();for(const p of this.state.characters)this.instances.set(p.id,this.buildOne(p));}
  _applyWorldPose(g,p){
    const pos=p.position||[0,0,0];let world;
    try{world=this.scene?.cadPointToWorld?.(pos)}catch{}
    if(!world)world=new THREE.Vector3(Number(pos[0])||0,Number(pos[2])||0,Number(pos[1])||0);
    g.position.copy(world);
    let up=new THREE.Vector3(0,1,0);
    if(this.state.planet?.enabled&&world.lengthSq()>1)up=world.clone().normalize();
    else{try{const a=this.scene.cadPointToWorld([0,0,0]),b=this.scene.cadPointToWorld([0,0,1]);up=b.sub(a).normalize()}catch{}}
    const align=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up);
    const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-(Number(p.yaw)||0)*Math.PI/180);
    g.quaternion.copy(align).multiply(yaw);
  }
  buildOne(p){const h=Math.max(80,Number(p.height)||170),g=new THREE.Group();g.name=p.id;g.userData.npcId=p.id;const mat=(c,r=.7)=>new THREE.MeshStandardMaterial({color:hex(c),roughness:r});const skin=mat(p.skin),body=mat(p.body),hair=mat(p.hair,.82),dark=mat('#243447');
    const capsule=(r,l,m,y)=>{const x=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.1,l-r*2),6,10),m);x.position.y=y;g.add(x);return x};
    capsule(h*.11,h*.36,body,h*.64);const head=new THREE.Mesh(new THREE.SphereGeometry(h*.095,20,14),skin);head.position.y=h*.91;g.add(head);const cap=new THREE.Mesh(new THREE.SphereGeometry(h*.098,18,8,0,Math.PI*2,0,Math.PI*.52),hair);cap.position.set(0,h*.93,0);g.add(cap);
    for(const s of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(h*.014,10,8),mat('#f4f6f7',.4));eye.position.set(s*h*.035,h*.925,-h*.086);eye.scale.z=.45;g.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(h*.006,8,6),mat('#406987',.35));pupil.position.set(s*h*.035,h*.925,-h*.098);pupil.scale.z=.25;g.add(pupil);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(h*.035,h*.18,5,8),body);arm.name=s<0?'armL':'armR';arm.position.set(s*h*.16,h*.61,0);g.add(arm);const leg=new THREE.Mesh(new THREE.CapsuleGeometry(h*.045,h*.25,5,8),dark);leg.name=s<0?'legL':'legR';leg.position.set(s*h*.06,h*.30,0);g.add(leg)}
    const mouth=new THREE.Mesh(new THREE.BoxGeometry(h*.04,h*.005,h*.006),mat('#914c52'));mouth.position.set(0,h*.865,-h*.091);g.add(mouth);
    const cargo=new THREE.Mesh(new THREE.BoxGeometry(h*.12,h*.10,h*.12),mat('#b98b54',.85));cargo.name='npc-cargo';cargo.position.set(0,h*.58,-h*.16);cargo.visible=false;g.add(cargo);
    const cart=new THREE.Group();cart.name='npc-cart';const tray=new THREE.Mesh(new THREE.BoxGeometry(h*.34,h*.10,h*.24),mat('#8d6a43',.9));tray.position.set(0,h*.18,h*.34);cart.add(tray);for(const sx of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(h*.065,h*.065,h*.035,12),dark);wheel.rotation.z=Math.PI/2;wheel.position.set(sx*h*.17,h*.12,h*.34);cart.add(wheel)}const handle=new THREE.Mesh(new THREE.BoxGeometry(h*.035,h*.035,h*.38),mat('#705237',.9));handle.position.set(0,h*.24,h*.12);handle.rotation.x=-.38;cart.add(handle);
    const animal=new THREE.Group();animal.name='cart-animal';const torso=new THREE.Mesh(new THREE.BoxGeometry(h*.20,h*.13,h*.32),mat('#7b5c3e',.9));torso.position.set(0,h*.22,h*.72);animal.add(torso);const neck=new THREE.Mesh(new THREE.BoxGeometry(h*.08,h*.18,h*.08),mat('#7b5c3e',.9));neck.position.set(0,h*.31,h*.57);neck.rotation.x=-.35;animal.add(neck);const ah=new THREE.Mesh(new THREE.BoxGeometry(h*.12,h*.11,h*.15),mat('#76553a',.9));ah.position.set(0,h*.40,h*.51);animal.add(ah);for(const sx of [-1,1])for(const sz of [0.62,0.82]){const leg=new THREE.Mesh(new THREE.BoxGeometry(h*.035,h*.20,h*.035),mat('#5b4633',.95));leg.position.set(sx*h*.065,h*.11,h*sz);animal.add(leg)}cart.add(animal);cart.visible=false;g.add(cart);this._applyWorldPose(g,p);g.userData.profile=p;g.userData.blinkPhase=Math.random()*6;this.root.add(g);return g}
  bindInteraction(){
    const canvas=this.scene?.canvas;if(!canvas)return;let down=null;
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;down={x:e.clientX,y:e.clientY,id:e.pointerId}},true);
    canvas.addEventListener('pointerup',e=>{if(!down||down.id!==e.pointerId)return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;if(moved>8)return;const rect=canvas.getBoundingClientRect(),pointer=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.scene.camera);const hit=ray.intersectObject(this.root,true)[0];if(!hit)return;let o=hit.object;while(o&&o.parent!==this.root)o=o.parent;const npcId=o?.userData?.npcId||o?.name;if(!npcId||!this.state.characters.some(n=>n.id===npcId))return;window.dispatchEvent(new CustomEvent('ue:npc-interact',{detail:{npcId}}));e.preventDefault();e.stopPropagation();},true);
  }
  update(dt=0,now=0){for(const [id,g] of this.instances){const p=g.userData.profile;if(!p)continue;const prev=g.userData.lastCadPos||[...(p.position||[0,0,0])],cur=p.position||[0,0,0],moved=Math.hypot((cur[0]||0)-(prev[0]||0),(cur[1]||0)-(prev[1]||0))>1;g.userData.lastCadPos=[...cur];this._applyWorldPose(g,p);g.visible=p.vitals?.alive!==false;const phase=(now||performance.now())*.008;for(const [name,sign] of [['armL',1],['armR',-1],['legL',-1],['legR',1]]){const limb=g.getObjectByName(name);if(!limb)continue;const work=p.life?.workMotion;if(work&&name.startsWith('arm'))limb.rotation.x=(work==='farm'?-.55:-1.0)+Math.sin(phase*1.8)*.7*sign;else if(work&&name.startsWith('leg'))limb.rotation.x=Math.sin(phase*.4)*.05*sign;else limb.rotation.x=moved?Math.sin(phase)*.55*sign:Math.sin(phase*.18)*.035*sign}g.position.addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(g.quaternion),moved?Math.abs(Math.sin(phase*2))*.9:Math.sin(phase*.35)*.35);const cargo=g.getObjectByName('npc-cargo');if(cargo)cargo.visible=!!(p.life?.cargo?.qty>0)&&!p.life?.cart?.active;const cart=g.getObjectByName('npc-cart');if(cart){cart.visible=!!p.life?.cart?.active;const animal=cart.getObjectByName('cart-animal');if(animal){animal.visible=cart.visible&&p.life?.cart?.kind!=='handcart';animal.scale.setScalar(p.life?.cart?.kind==='ox-cart'?1.12:0.95)}}if(!p.blink)continue;g.userData.blinkPhase+=(dt||0);const v=Math.sin(g.userData.blinkPhase*0.55+id.length)>0.995?0.25:1;g.scale.y=v<1?.998:1;}}
}
