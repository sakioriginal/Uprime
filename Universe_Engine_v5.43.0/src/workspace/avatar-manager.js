import * as THREE from 'three';

export class AvatarManager{
  constructor(state,scene){
    this.state=state;this.scene=scene;this.group=new THREE.Group();this.group.name='articulated-avatar';scene.scene.add(this.group);
    this.joints={};this.face={};this.blink={phase:'wait',phaseStart:0,nextAt:0,value:0};this.walkPhase=0;this.moveKeys=new Set();this.analogMove={x:0,y:0};this.planetManager=null;this.verticalVelocity=0;this.drag={active:false,pointerId:null,offset:new THREE.Vector3()};this.ensureState();this.build();this.sync();this.installDrag();
  }
  ensureState(){
    this.state.avatar={enabled:true,mode:'orbit',height:170,position:[-220,-180,0],yaw:0,name:'Player',appearance:{skin:'#c28b6d',body:'#5ea6d6',pants:'#25384d',hair:'#2b1d18',eye:'#4c7695'},pose:{},walking:false,walkSpeed:42,blink:true,controlEnabled:true,rig:{version:'4.0.0',anatomyLevel:'dummy',jointMarkers:true,activeJoint:'pelvis'},...((this.state.avatar||{}))};this.state.avatar.appearance={skin:'#c28b6d',body:'#5ea6d6',pants:'#25384d',hair:'#2b1d18',eye:'#4c7695',faceMode:'3d',montage:{baseImage:'',eyesImage:'',noseImage:'',mouthImage:'',wrap:.72,mouthOpen:0},...(this.state.avatar.appearance||{})};this.state.avatar.appearance.montage={baseImage:'',eyesImage:'',noseImage:'',mouthImage:'',wrap:.72,mouthOpen:0,...(this.state.avatar.appearance.montage||{})};
    if(!this.state.avatar.pose)this.state.avatar.pose={};
    this.state.avatar.rig={version:'4.2.0',anatomyLevel:'dummy',jointMarkers:true,activeJoint:'pelvis',...(this.state.avatar.rig||{})};this.state.avatar.locomotion={running:false,crouching:false,jumping:false,runMultiplier:2.15,jumpSpeed:95,walkStepMm:500,runStepMm:850,stepLengthRatio:.415,runStepLengthRatio:.65,walkCadence:1.55,runCadence:2.55,...(this.state.avatar.locomotion||{})};this.state.avatar.cameraYaw=Number(this.state.avatar.cameraYaw)||0;this.state.avatar.cameraPitch=Number.isFinite(Number(this.state.avatar.cameraPitch))?Number(this.state.avatar.cameraPitch):20;this.state.avatar.turnRate=Math.max(25,Number(this.state.avatar.turnRate)||Number(this.state.controls?.avatarTurnRate)||95);this.state.avatar.cameraDistance=Number(this.state.avatar.cameraDistance)||1.7;this.state.controls={movementReference:'avatar',...(this.state.controls||{})};if(!Array.isArray(this.state.avatar.planetNormal))this.state.avatar.planetNormal=[0,1,0];if(!Array.isArray(this.state.avatar.planetForward))this.state.avatar.planetForward=[0,0,-1];
  }
  _dispose(){this.group.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.()});this.group.clear();this.joints={};this.face={}}
  _joint(parent,name,pos,limit={x:[-180,180],y:[-180,180],z:[-180,180]}){const j=new THREE.Group();j.name=name;j.position.set(...pos);j.userData.poseJoint=name;j.userData.poseLimits=limit;parent.add(j);this.joints[name]=j;return j}
  _capsule(parent,name,radius,length,mat,pos=[0,0,0]){const g=new THREE.CapsuleGeometry(Math.max(.8,radius),Math.max(.1,length-radius*2),6,12);const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(...pos);parent.add(m);return m}
  _jointMarker(j,r,color=0x4f91bd){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.05}));m.userData.poseJoint=j.name;m.userData.jointMarker=true;m.visible=this.state.avatar.rig?.jointMarkers!==false;j.add(m);return m}
  _makeFace(head,h,skin){
    const white=new THREE.MeshStandardMaterial({color:0xf2f5f7,roughness:.35}),iris=new THREE.MeshStandardMaterial({color:this.state.avatar.appearance?.eye||0x4c7695,roughness:.3}),dark=new THREE.MeshStandardMaterial({color:0x3b241b,roughness:.75}),lip=new THREE.MeshStandardMaterial({color:0x914c52,roughness:.6});
    const faceRoot=new THREE.Group();faceRoot.name='FaceRoot';head.add(faceRoot);this.face.root=faceRoot;
    for(const side of ['left','right']){
      const sign=side==='left'?-1:1,eye=new THREE.Group();eye.position.set(sign*h*.036,h*.014,-h*.083);faceRoot.add(eye);
      const eyeball=new THREE.Mesh(new THREE.SphereGeometry(h*.018,16,10),white);eyeball.scale.z=.45;eye.add(eyeball);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(h*.008,12,8),iris);pupil.position.z=-h*.016;pupil.scale.z=.25;eye.add(pupil);
      const lid=new THREE.Mesh(new THREE.SphereGeometry(h*.0205,16,8,0,Math.PI*2,0,Math.PI/2),skin.clone());lid.position.z=-h*.0185;lid.rotation.x=Math.PI/2;lid.scale.set(1.12,.05,.34);eye.add(lid);
      this.face[`${side}Eye`]=eye;this.face[`${side}Lid`]=lid;
    }
    const nose=new THREE.Mesh(new THREE.ConeGeometry(h*.012,h*.035,10),skin.clone());nose.rotation.x=-Math.PI/2;nose.position.set(0,-h*.004,-h*.103);faceRoot.add(nose);
    const mouth=new THREE.Mesh(new THREE.BoxGeometry(h*.044,h*.006,h*.006),lip);mouth.position.set(0,-h*.045,-h*.091);mouth.rotation.z=.02;faceRoot.add(mouth);this.face.mouth=mouth;
    const browGeo=new THREE.BoxGeometry(h*.032,h*.005,h*.005);for(const side of ['left','right']){const sign=side==='left'?-1:1,b=new THREE.Mesh(browGeo,dark);b.position.set(sign*h*.035,h*.045,-h*.088);b.rotation.z=sign*.08;faceRoot.add(b)}
  }

  _loadMontageImage(src,key){
    if(!src||!this.face?.montage)return;const img=new Image();img.onload=()=>{if(!this.face?.montage)return;this.face.montage.images[key]=img;this._drawMontageFace(this.blink?.value||0)};img.src=src;
  }
  _drawMontageFace(blink=0){
    const m=this.face?.montage;if(!m)return;const {canvas:c,ctx,texture,images}=m,ap=this.state.avatar.appearance||{},cfg=ap.montage||{};ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=ap.skin||'#c28b6d';ctx.fillRect(0,0,c.width,c.height);
    const drawContain=(img,x,y,w,h)=>{if(!img)return;const iw=img.naturalWidth||img.width||1,ih=img.naturalHeight||img.height||1,sc=Math.min(w/iw,h/ih),dw=iw*sc,dh=ih*sc;ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)};
    // Central half of the texture maps to the visible front of the face shell.
    const wrap=Math.max(.35,Math.min(1,Number(cfg.wrap)||.72)),faceW=650+720*wrap,faceX=(2048-faceW)/2;drawContain(images.base,faceX,55,faceW,900);
    if(images.eyes)drawContain(images.eyes,710,305,630,250);
    if(images.nose)drawContain(images.nose,885,455,280,270);
    const mo=Math.max(0,Math.min(1,Number(cfg.mouthOpen)||0)),mh=185*(1+mo*.75);if(images.mouth)drawContain(images.mouth,820,650,410,mh);
    if(blink>0){ctx.save();ctx.globalAlpha=Math.min(1,blink*.96);ctx.fillStyle=ap.skin||'#c28b6d';for(const x of [780,1110]){ctx.beginPath();ctx.roundRect?.(x,365,255,95*blink+12,38);ctx.fill()}ctx.globalAlpha=1;ctx.strokeStyle='#513832';ctx.lineWidth=12*blink;for(const yx of [[780,410],[1110,410]]){ctx.beginPath();ctx.moveTo(yx[0],yx[1]);ctx.quadraticCurveTo(yx[0]+125,yx[1]+18,yx[0]+250,yx[1]);ctx.stroke()}ctx.restore()}
    texture.needsUpdate=true;
  }
  _makeMontageFace(head,h){
    const ap=this.state.avatar.appearance||{},cfg=ap.montage||{},c=document.createElement('canvas');c.width=2048;c.height=1024;const ctx=c.getContext('2d'),tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=THREE.RepeatWrapping;const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.72,metalness:0});const geo=new THREE.CylinderGeometry(h*.091,h*.095,h*.175,40,1,false);const shell=new THREE.Mesh(geo,mat);shell.name='MontageFaceShell';shell.position.set(0,-h*.003,-h*.004);shell.scale.set(.88,1,.96);shell.rotation.y=Math.PI;head.add(shell);this.face.root=shell;this.face.montage={canvas:c,ctx,texture:tex,images:{},shell};for(const [k,src] of [['base',cfg.baseImage],['eyes',cfg.eyesImage],['nose',cfg.noseImage],['mouth',cfg.mouthImage]])this._loadMontageImage(src,k);this._drawMontageFace(0);
  }
  build(){
    this._dispose();this.ensureState();const h=Math.max(80,Number(this.state.avatar.height)||170);
    const ap=this.state.avatar.appearance||{},body=new THREE.MeshStandardMaterial({color:ap.body||0x5ea6d6,roughness:.72}),skin=new THREE.MeshStandardMaterial({color:ap.skin||0xc28b6d,roughness:.78}),pants=new THREE.MeshStandardMaterial({color:ap.pants||0x25384d,roughness:.8}),shoe=new THREE.MeshStandardMaterial({color:0x20252b,roughness:.7}),hair=new THREE.MeshStandardMaterial({color:ap.hair||0x2b1d18,roughness:.82});
    const pelvis=this._joint(this.group,'pelvis',[0,h*.50,0],{x:[-25,25],y:[-45,45],z:[-25,25]});this._jointMarker(pelvis,h*.035);
    const waist=this._joint(pelvis,'waist',[0,h*.04,0],{x:[-35,35],y:[-55,55],z:[-30,30]});this._jointMarker(waist,h*.025);
    this._capsule(waist,'Torso',h*.115,h*.32,body,[0,h*.16,0]);
    const chest=this._joint(waist,'chest',[0,h*.24,0],{x:[-25,30],y:[-40,40],z:[-25,25]});
    const neck=this._joint(chest,'neck',[0,h*.105,0],{x:[-45,55],y:[-75,75],z:[-40,40]});this._jointMarker(neck,h*.018);
    const head=this._joint(neck,'head',[0,h*.09,0],{x:[-35,40],y:[-55,55],z:[-30,30]});
    const hm=new THREE.Mesh(new THREE.SphereGeometry(h*.095,24,16),skin);hm.scale.set(.88,1.08,.95);head.add(hm);
    const hairCap=new THREE.Mesh(new THREE.SphereGeometry(h*.098,20,10,0,Math.PI*2,0,Math.PI*.52),hair);hairCap.position.y=h*.022;hairCap.scale.set(.9,.82,.96);head.add(hairCap);
    if(String(ap.faceMode||'3d').toLowerCase()==='montage')this._makeMontageFace(head,h);else this._makeFace(head,h,skin);
    const arm=(side)=>{const sign=side==='left'?-1:1,label=side[0].toUpperCase()+side.slice(1);const shoulder=this._joint(chest,`${side}Shoulder`,[sign*h*.17,h*.015,0],{x:[-90,130],y:[-100,100],z:[side==='left'?-120:-35,side==='left'?35:120]});this._jointMarker(shoulder,h*.027);this._capsule(shoulder,`${label}UpperArm`,h*.04,h*.22,body,[0,-h*.11,0]);const elbow=this._joint(shoulder,`${side}Elbow`,[0,-h*.22,0],{x:[0,150],y:[-20,20],z:[-10,10]});this._jointMarker(elbow,h*.021);this._capsule(elbow,`${label}Forearm`,h*.035,h*.205,body,[0,-h*.102,0]);const wrist=this._joint(elbow,`${side}Wrist`,[0,-h*.205,0],{x:[-70,70],y:[-45,45],z:[-35,35]});this._jointMarker(wrist,h*.017);this._capsule(wrist,`${label}Hand`,h*.026,h*.105,skin,[0,-h*.052,0]);return{shoulder,elbow,wrist}};
    const leg=(side)=>{const sign=side==='left'?-1:1,label=side[0].toUpperCase()+side.slice(1);const hip=this._joint(pelvis,`${side}Hip`,[sign*h*.07,-h*.015,0],{x:[-40,120],y:[-45,45],z:[-45,45]});this._jointMarker(hip,h*.03);this._capsule(hip,`${label}Thigh`,h*.052,h*.27,pants,[0,-h*.135,0]);const knee=this._joint(hip,`${side}Knee`,[0,-h*.27,0],{x:[0,150],y:[-8,8],z:[-8,8]});this._jointMarker(knee,h*.023);this._capsule(knee,`${label}Shin`,h*.045,h*.245,pants,[0,-h*.122,0]);const ankle=this._joint(knee,`${side}Ankle`,[0,-h*.245,0],{x:[-45,45],y:[-25,25],z:[-25,25]});this._jointMarker(ankle,h*.018);const foot=new THREE.Mesh(new THREE.BoxGeometry(h*.07,h*.045,h*.14),shoe);foot.position.set(0,-h*.025,-h*.045);ankle.add(foot);return{hip,knee,ankle}};
    arm('left');arm('right');leg('left');leg('right');this.group.userData.avatar=true;this.group.userData.poserJoints=this.joints;this.applyPose(this.state.avatar.pose||{});this.setJointMarkersVisible(this.state.avatar.rig?.jointMarkers!==false);this.setActiveJoint(this.state.avatar.rig?.activeJoint||'pelvis');this.resetBlink(performance.now()/1000);
  }

  getJointDefinitions(){return Object.entries(this.joints).map(([name,j])=>({name,limits:j.userData.poseLimits||{},rotation:[j.rotation.x,j.rotation.y,j.rotation.z].map(THREE.MathUtils.radToDeg)}))}
  setJointMarkersVisible(visible){this.ensureState();this.state.avatar.rig.jointMarkers=!!visible;this.group.traverse(o=>{if(o.userData?.jointMarker)o.visible=!!visible});}
  setActiveJoint(name){this.ensureState();if(!this.joints[name])return false;this.state.avatar.rig.activeJoint=name;this.group.traverse(o=>{if(o.userData?.jointMarker){const active=o.userData.poseJoint===name;o.scale.setScalar(active?1.55:1);if(o.material?.emissive)o.material.emissive.setHex(active?0x24506b:0x000000)}});return true}
  jointRotation(name){const j=this.joints[name];if(!j)return [0,0,0];return [j.rotation.x,j.rotation.y,j.rotation.z].map(v=>Math.round(THREE.MathUtils.radToDeg(v)*10)/10)}
  posePreset(name){const n=String(name||'neutral').toLowerCase();if(n==='t'){this.applyPose({leftShoulder:[0,0,90],rightShoulder:[0,0,-90],leftElbow:[0,0,0],rightElbow:[0,0,0],leftHip:[0,0,0],rightHip:[0,0,0],leftKnee:[0,0,0],rightKnee:[0,0,0]});}
    else if(n==='a'){this.applyPose({leftShoulder:[8,0,55],rightShoulder:[8,0,-55],leftElbow:[5,0,0],rightElbow:[5,0,0],leftHip:[4,0,0],rightHip:[4,0,0],leftKnee:[3,0,0],rightKnee:[3,0,0]});}
    else if(n==='sit'){this.applyPose({leftHip:[85,0,0],rightHip:[85,0,0],leftKnee:[90,0,0],rightKnee:[90,0,0],leftAnkle:[-10,0,0],rightAnkle:[-10,0,0],leftShoulder:[18,0,12],rightShoulder:[18,0,-12],leftElbow:[65,0,0],rightElbow:[65,0,0]});}
    else this.neutralPose();this.state.avatar.posePreset=n;}

  applyPose(pose={}){for(const[name,value]of Object.entries(pose)){if(!this.joints[name]||!Array.isArray(value))continue;this.setJointRotation(name,value,false)}this.state.avatar.pose={...pose}}
  setJointRotation(name,degrees=[0,0,0],save=true){const j=this.joints[name];if(!j)return false;const lim=j.userData.poseLimits||{},clampD=(v,r)=>THREE.MathUtils.clamp(Number(v)||0,r?.[0]??-180,r?.[1]??180),d=[clampD(degrees[0],lim.x),clampD(degrees[1],lim.y),clampD(degrees[2],lim.z)];j.rotation.set(...d.map(THREE.MathUtils.degToRad));if(save)this.state.avatar.pose={...(this.state.avatar.pose||{}),[name]:d};return true}
  neutralPose(){const pose={leftShoulder:[8,0,8],rightShoulder:[8,0,-8],leftElbow:[8,0,0],rightElbow:[8,0,0],leftHip:[3,0,0],rightHip:[3,0,0],leftKnee:[5,0,0],rightKnee:[5,0,0],neck:[0,0,0],head:[0,0,0]};this.applyPose(pose)}
  resetBlink(now){this.blink={phase:'wait',phaseStart:now,nextAt:now+1.15+Math.random()*2.25,value:0}}
  stepBlink(now){if(!this.state.avatar.blink)return 0;if(!this.blink.nextAt)this.resetBlink(now);if(this.blink.phase==='wait'&&now>=this.blink.nextAt){this.blink.phase='closing';this.blink.phaseStart=now}const e=now-this.blink.phaseStart;if(this.blink.phase==='closing'){this.blink.value=Math.min(1,e/.11);if(this.blink.value>=1){this.blink.phase='hold';this.blink.phaseStart=now;this.blink.value=1}}else if(this.blink.phase==='hold'){this.blink.value=1;if(e>=.09){this.blink.phase='opening';this.blink.phaseStart=now}}else if(this.blink.phase==='opening'){this.blink.value=Math.max(0,1-e/.19);if(this.blink.value<=0)this.resetBlink(now)}return this.blink.value}
  applyBlink(v){for(const side of ['left','right']){const lid=this.face[`${side}Lid`];if(!lid)continue;lid.scale.y=.05+.95*v;lid.position.y=-.002*this.state.avatar.height*v}if(this.face?.montage)this._drawMontageFace(v)}
  startWalking(speed=null){this.ensureState();this.state.avatar.walking=true;if(Number.isFinite(Number(speed)))this.state.avatar.walkSpeed=Number(speed);if(this.state.avatar.mode==='orbit')this.setMode('tpv')}
  stopWalking(){this.ensureState();this.state.avatar.walking=false;this.moveKeys.clear();this.walkPhase=0;this.neutralPose();this.sync()}
  isControlMode(){return this.state.avatar?.controlEnabled!==false&&(this.state.avatar?.mode==='fpv'||this.state.avatar?.mode==='tpv')}
  handleKey(event,down=true){if(!this.isControlMode())return false;const k=String(event.key||'').toLowerCase(),map={'w':'forward','arrowup':'forward','s':'back','arrowdown':'back','a':'left','arrowleft':'left','d':'right','arrowright':'right'};if(k==='shift'){this.state.avatar.locomotion.running=!!down;return true}if(k==='control'||k==='c'){this.state.avatar.locomotion.crouching=!!down;return true}if(k===' '&&down){this.jump();return true}const action=map[k];if(!action)return false;if(down)this.moveKeys.add(action);else this.moveKeys.delete(action);return true}
  setPlanetManager(manager){this.planetManager=manager}
  setAnalogMove(x=0,y=0){this.analogMove.x=Number(x)||0;this.analogMove.y=Number(y)||0}
  applyViewDelta(dx=0,dy=0){
    this.ensureState();const a=this.state.avatar;
    if(a.mode==='fpv'){
      a.pitch=Math.max(-80,Math.min(80,(Number(a.pitch)||0)+Number(dy||0)));
      if(a.onPlanet&&this.planetManager){
        const frame=this._planetFrame();
        const turn=THREE.MathUtils.degToRad(Number(dx)||0);
        const nf=frame.f.clone().applyAxisAngle(frame.n,turn).projectOnPlane(frame.n).normalize();
        if(nf.lengthSq()>.000001)a.planetForward=nf.toArray();
      }else a.yaw=(Number(a.yaw)||0)+Number(dx||0);
      this.toFPV();return
    }
    if(a.mode==='tpv'){
      a.cameraYaw=(Number(a.cameraYaw)||0)+Number(dx||0);
      a.cameraPitch=Math.max(-65,Math.min(75,(Number(a.cameraPitch)||20)+Number(dy||0)));
      this.toTPV();return;
    }
    // Orbit mode: rotate the camera on a sphere around the current focus.
    const cam=this.scene?.camera,target=this.scene?.controls?.target;
    if(cam&&target){
      const off=cam.position.clone().sub(target);const sph=new THREE.Spherical().setFromVector3(off);
      sph.theta-=THREE.MathUtils.degToRad(Number(dx||0));
      sph.phi=THREE.MathUtils.clamp(sph.phi+THREE.MathUtils.degToRad(Number(dy||0)),0.08,Math.PI-0.08);
      off.setFromSpherical(sph);cam.position.copy(target).add(off);cam.lookAt(target);this.scene.controls?.update?.();
    }
  }
  _turnToward(currentDeg,targetDeg,dt){
    let d=((targetDeg-currentDeg+540)%360)-180;const maxStep=Math.max(1,Number(this.state.avatar?.turnRate)||95)*Math.max(0,Number(dt)||0);
    if(Math.abs(d)<=maxStep)return targetDeg;return currentDeg+Math.sign(d)*maxStep;
  }
  _gaitSpeed(){
    const a=this.state.avatar,locom=a.locomotion||{},h=Math.max(80,Number(a.height)||170),running=!!locom.running;
    // Universe Engine world units are millimetres. Walking is defined by a fixed stride:
    // one normal step = 500 mm, independent from avatar height.
    const stepMm=running?Math.max(100,Number(locom.runStepMm)||850):Math.max(100,Number(locom.walkStepMm)||500);
    const mmPerUnit=Math.max(1e-9,Number(this.state.workspace?.unitScaleMm)||10);
    const step=stepMm/mmPerUnit; // 500 mm -> 50 scene units when 1 unit = 10 mm
    const cadence=running?(Number(locom.runCadence)||2.55):(Number(locom.walkCadence)||1.55);
    return {speed:step*cadence,step,stepMm,cadence};
  }
  jump(){if(this.state.avatar?.locomotion?.jumping)return false;this.state.avatar.locomotion.jumping=true;this.verticalVelocity=Number(this.state.avatar.locomotion.jumpSpeed)||95;return true}
  enterPlanet(normal=new THREE.Vector3(0,1,0)){this.ensureState();const n=normal.clone().normalize();this.state.avatar.onPlanet=true;this.state.avatar.planetNormal=n.toArray();let f=new THREE.Vector3(0,0,-1).projectOnPlane(n).normalize();if(f.lengthSq()<.01)f=new THREE.Vector3(1,0,0).projectOnPlane(n).normalize();this.state.avatar.planetForward=f.toArray();this.state.avatar.surfaceOffset=0;this.setMode(this.state.avatar.mode==='orbit'?'tpv':this.state.avatar.mode);this.sync()}
  leavePlanet(){this.state.avatar.onPlanet=false;this.verticalVelocity=0;this.state.avatar.locomotion.jumping=false;this.group.quaternion.identity();this.sync()}
  _planetFrame(){const n=new THREE.Vector3(...(this.state.avatar.planetNormal||[0,1,0])).normalize(),f=new THREE.Vector3(...(this.state.avatar.planetForward||[0,0,-1])).projectOnPlane(n).normalize();if(f.lengthSq()<.01)f.set(0,0,-1).projectOnPlane(n).normalize();const r=new THREE.Vector3().crossVectors(f,n).normalize();return{n,f,r}}
  _terrainSurfaceRadius(n){
    if(!this.planetManager)return NaN;
    const terrain=this.planetManager.terrain,ray=this.scene?.raycaster;
    if(!terrain||!ray)return this.planetManager.surfaceRadius(n);
    const h=Math.max(80,Number(this.state.avatar.height)||170),amp=Math.max(1,this.planetManager.amplitudeScene?.()||0);
    const analytic=this.planetManager.surfaceRadius(n),origin=n.clone().multiplyScalar(analytic+amp*2+h*2);
    ray.set(origin,n.clone().negate());ray.near=0;ray.far=amp*5+h*5;
    const hit=ray.intersectObject(terrain,false)?.[0];
    return hit?.point?hit.point.length():analytic;
  }
  _solidMeshes(){
    const out=[];
    for(const o of (this.state.objects||[])){
      if(o.visible===false||!o.mesh)continue;const meta=o.metadata||{},b=o.components?.building,primitive=String(b?.primitive||'');
      if(meta.noCollision===true||meta.helperOnly||meta.doorOpen===true)continue;
      if(['floor','roof','stair','ladderAid','platform','foundation'].includes(primitive)||meta.walkable===true)continue;
      out.push(o.mesh);
    }
    for(const m of (this.scene?.workspaceColliders||[]))if(m?.visible!==false)out.push(m);
    return out;
  }
  _blockedAtPlanet(n){
    const meshes=this._solidMeshes();if(!meshes.length)return false;
    const h=Math.max(80,Number(this.state.avatar.height)||170),r=Math.max(10,h*.16),ground=this._terrainSurfaceRadius(n)+(Number(this.state.avatar.surfaceOffset)||0);
    const center=n.clone().multiplyScalar(ground+h*.48),box=new THREE.Box3();
    for(const mesh of meshes){try{mesh.updateWorldMatrix?.(true,false);box.setFromObject(mesh);if(box.isEmpty())continue;const closest=box.clampPoint(center,new THREE.Vector3());let d=center.distanceTo(closest);if(d<r)return true}catch{}}
    return false;
  }
  _syncPlanet(){if(!this.planetManager)return;const {n,f}=this._planetFrame(),surface=this._terrainSurfaceRadius(n)+(Number(this.state.avatar.surfaceOffset)||0),world=n.clone().multiplyScalar(surface);this.group.position.copy(world);const right=new THREE.Vector3().crossVectors(f,n).normalize(),back=f.clone().negate(),m=new THREE.Matrix4().makeBasis(right,n,back);this.group.quaternion.setFromRotationMatrix(m);this.group.visible=this.state.avatar.enabled!==false&&this.state.avatar.mode!=='fpv'}
  _walkableSurfaceOffset(n){
    if(!this.planetManager||!this.scene||!this.scene.raycaster)return 0;
    const meshes=[];
    for(const o of (this.state.objects||[])){
      if(o.visible===false||!o.mesh)continue;
      const meta=o.metadata||{},building=o.components&&o.components.building;
      const primitive=String((building&&building.primitive)||'');
      // Vertical/access parts must NEVER become an automatic walking support.
      const blockedPrimitive=['door','doorFrame','doorKnob','window','windowFrame','wall','column','ladder','ladderRung'].includes(primitive);
      const buildingWalkable=['floor','roof','stair','ladderAid','platform','foundation'].includes(primitive);
      const walkable=(meta.walkable===true||buildingWalkable)&&!blockedPrimitive&&!meta.helperOnly&&!meta.doorLeaf;
      if(walkable)meshes.push(o.mesh);
    }
    const base=this.planetManager.surfaceRadius(n),h=Math.max(80,Number(this.state.avatar.height)||170);
    const current=Math.max(0,Number(this.state.avatar.surfaceOffset)||0);
    // Cast from just above the CURRENT feet, not from a fixed high point.
    // This prevents a roof/door/header above the player from teleporting the avatar upward.
    const maxStepUp=Math.max(18,h*.32);
    const origin=n.clone().multiplyScalar(base+current+maxStepUp);
    this.scene.raycaster.set(origin,n.clone().negate());
    this.scene.raycaster.near=0;
    this.scene.raycaster.far=Math.max(h*8,current+maxStepUp+h*4);
    const hits=meshes.length?this.scene.raycaster.intersectObjects(meshes,true):[];
    let best=0; // terrain is always a valid fallback at offset 0
    for(const hit of hits){
      const radial=hit.point.length()-base;
      if(!Number.isFinite(radial)||radial<0)continue;
      // Only step UP a human-sized step; large drops are allowed so the avatar can get down.
      if(radial<=current+maxStepUp+1e-6){best=Math.max(best,radial);break;}
    }
    return best;
  }
  recoverToTerrainGround(){
    // One-shot vertical recovery only. Never rewrite the tangent frame (planetNormal/planetForward),
    // otherwise WASD / left-stick movement can appear locked after a support object disappears.
    this.ensureState();
    this.verticalVelocity=0;
    const a=this.state.avatar||{};
    if(a.locomotion)a.locomotion.jumping=false;
    if(a.onPlanet&&this.planetManager){
      a.surfaceOffset=0;
      a.groundRecoveryUntil=(performance.now?performance.now():Date.now())+120;
      this._syncPlanet();
      return 0;
    }
    return this.recoverToSafeGround();
  }
  _updatePlanet(dt,moving){
    if(!this.planetManager)return;
    const a=this.state.avatar;
    let {n,f}=this._planetFrame();

    // 1) Tangent-plane locomotion. This is intentionally independent from grounding.
    let dx=(this.moveKeys.has('right')?1:0)-(this.moveKeys.has('left')?1:0);
    let dz=(this.moveKeys.has('back')?1:0)-(this.moveKeys.has('forward')?1:0);
    const analogMag=Math.min(1,Math.hypot(this.analogMove.x,this.analogMove.y));
    if(analogMag>.001){dx+=this.analogMove.x;dz+=this.analogMove.y}
    if(a.walking&&!this.moveKeys.size&&analogMag<.001){dx=0;dz=-1}
    const raw=Math.hypot(dx,dz)||1,inputMag=Math.min(1,raw);dx/=raw;dz/=raw;
    const forward=f.clone().projectOnPlane(n).normalize();
    const right=new THREE.Vector3().crossVectors(forward,n).normalize();
    let tangent=forward.clone().multiplyScalar(-dz).add(right.clone().multiplyScalar(dx));
    if(tangent.lengthSq()>.0001)tangent.normalize();
    const gait=this._gaitSpeed(),distance=gait.speed*inputMag*Math.max(0,dt||0);
    const radius=Math.max(10,this._terrainSurfaceRadius(n)+(Number(a.surfaceOffset)||0));

    if(moving&&tangent.lengthSq()>.001&&distance>0){
      // Rotate the radial normal around an axis perpendicular to the desired tangent.
      // This preserves the avatar's latitude/longitude motion without touching vertical grounding.
      const axis=new THREE.Vector3().crossVectors(n,tangent).normalize();
      const angle=distance/radius;
      const previousN=n.clone();
      if(axis.lengthSq()>.000001&&Number.isFinite(angle))n.applyAxisAngle(axis,angle).normalize();
      // Avatar capsule collision: reject tangent movement that would enter walls/CAD solids.
      if(this._blockedAtPlanet(n))n.copy(previousN);

      // Keep facing direction tangent to the NEW surface, but turn gradually.
      const desired=tangent.clone().projectOnPlane(n).normalize();
      const current=f.clone().projectOnPlane(n).normalize();
      const dot=THREE.MathUtils.clamp(current.dot(desired),-1,1),ang=Math.acos(dot);
      const maxTurn=THREE.MathUtils.degToRad(Math.max(25,Number(a.turnRate)||95))*Math.max(0,dt||0);
      if(ang>1e-5){
        const turnAxis=new THREE.Vector3().crossVectors(current,desired);
        if(turnAxis.lengthSq()>.000001){turnAxis.normalize();current.applyAxisAngle(turnAxis,Math.min(ang,maxTurn)).projectOnPlane(n).normalize()}
        else current.copy(desired);
      }
      f.copy(current);
      a.planetNormal=n.toArray();
      a.planetForward=f.toArray();
    }

    // 2) Terrain-following ground. surfaceRadius(n) is evaluated at the NEW latitude/longitude
    // every frame, so the avatar follows mountains/valleys instead of moving on a fixed sphere.
    // Buildings remain an additional walkable offset above that terrain surface.
    if(!Number.isFinite(this.planetManager.surfaceRadius(n))){return;}

    // 3) Vertical-only grounding. It may change surfaceOffset, never the tangent position/frame.
    const locom=a.locomotion||{};
    if(locom.jumping){
      this.verticalVelocity-=180*Math.max(0,dt||0);
      a.surfaceOffset=Math.max(0,(Number(a.surfaceOffset)||0)+this.verticalVelocity*Math.max(0,dt||0));
      if(a.surfaceOffset<=0&&this.verticalVelocity<0){a.surfaceOffset=0;this.verticalVelocity=0;locom.jumping=false}
    }else{
      const now=(performance.now?performance.now():Date.now());
      // During the tiny one-shot recovery window, keep terrain offset 0. After that,
      // normal floor/stair support resumes. No XY/tangent state is modified here.
      if(Number(a.groundRecoveryUntil)||0>now)a.surfaceOffset=0;
      else a.surfaceOffset=Math.max(0,Number(this._walkableSurfaceOffset(n))||0);
    }

    this._syncPlanet();
    if(a.mode==='tpv')this.toTPV();else if(a.mode==='fpv')this.toFPV();
  }

  recoverToSafeGround(){
    this.ensureState();
    this.verticalVelocity=0;
    if(this.state.avatar&&this.state.avatar.locomotion){this.state.avatar.locomotion.jumping=false;}
    if(this.state.avatar&&this.state.avatar.onPlanet&&this.planetManager){
      const frame=this._planetFrame(),offset=this._walkableSurfaceOffset(frame.n);
      this.state.avatar.surfaceOffset=Math.max(0,Number(offset)||0);
      this._syncPlanet();
      if(this.state.avatar.mode==='tpv')this.toTPV();else if(this.state.avatar.mode==='fpv')this.toFPV();
      return this.state.avatar.surfaceOffset;
    }
    if(this.state.avatar&&Array.isArray(this.state.avatar.position)){
      this.state.avatar.position[2]=Math.max(Number(this.state.physics&&this.state.physics.floorZ)||0,Number(this.state.avatar.position[2])||0);
      this.sync();
    }
    return 0;
  }
  animateWalk(dt,moving){if(!moving){if(!this.state.avatar.walking){this.walkPhase=0;this.neutralPose()}return}const gait=this._gaitSpeed(),locom=this.state.avatar.locomotion||{};this.walkPhase+=(dt||0)*gait.cadence*Math.PI;const s=Math.sin(this.walkPhase),c=Math.cos(this.walkPhase),boost=(locom.running?1.35:1),arm=28*s*boost,leg=34*s*boost,kneeL=Math.max(0,-s)*48+5,kneeR=Math.max(0,s)*48+5;this.setJointRotation('leftShoulder',[8+arm,0,8],false);this.setJointRotation('rightShoulder',[8-arm,0,-8],false);this.setJointRotation('leftElbow',[12+Math.max(0,-s)*18,0,0],false);this.setJointRotation('rightElbow',[12+Math.max(0,s)*18,0,0],false);this.setJointRotation('leftHip',[-leg,0,0],false);this.setJointRotation('rightHip',[leg,0,0],false);this.setJointRotation('leftKnee',[kneeL,0,0],false);this.setJointRotation('rightKnee',[kneeR,0,0],false);this.setJointRotation('leftAnkle',[8*c,0,0],false);this.setJointRotation('rightAnkle',[-8*c,0,0],false);this.joints.pelvis.position.y=(Number(this.state.avatar.height)||170)*.50+Math.abs(c)*1.3}
  _blockedWorkspace(candidate){
    const meshes=this._solidMeshes();if(!meshes.length)return false;const h=Math.max(80,Number(this.state.avatar.height)||170),r=Math.max(10,h*.16),center=new THREE.Vector3(candidate[0],candidate[2]+h*.48,candidate[1]),box=new THREE.Box3();
    for(const mesh of meshes){try{box.setFromObject(mesh);const closest=box.clampPoint(center,new THREE.Vector3());if(center.distanceTo(closest)<r)return true}catch{}}return false;
  }
  update(dt,now){this.ensureState();this.applyBlink(this.stepBlink(now||performance.now()/1000));const keys=this.moveKeys,analogMag=Math.min(1,Math.hypot(this.analogMove.x,this.analogMove.y)),analog=analogMag>.001,manual=keys.size>0||analog,auto=this.state.avatar.walking&&!manual,moving=manual||auto;this.animateWalk(dt,moving);if(this.state.avatar.onPlanet&&this.planetManager){this._updatePlanet(dt,moving);return}if(!moving){this.sync();return}let lx=(keys.has('right')?1:0)-(keys.has('left')?1:0),lz=(keys.has('back')?1:0)-(keys.has('forward')?1:0);if(analog){lx+=this.analogMove.x;lz+=this.analogMove.y}if(auto){lx=0;lz=-1}const rawMag=Math.hypot(lx,lz)||1,inputMag=Math.min(1,rawMag);lx/=rawMag;lz/=rawMag;const moveYaw=(Number(this.state.avatar.yaw)||0)*Math.PI/180,wx=lx*Math.cos(moveYaw)-lz*Math.sin(moveYaw),wy=lx*Math.sin(moveYaw)+lz*Math.cos(moveYaw),spd=this._gaitSpeed().speed*inputMag*(dt||0);const candidate=[this.state.avatar.position[0]+wx*spd,this.state.avatar.position[1]+wy*spd,this.state.avatar.position[2]];if(!this._blockedWorkspace(candidate)){this.state.avatar.position[0]=candidate[0];this.state.avatar.position[1]=candidate[1];}if(manual){const desired=Math.atan2(wx,-wy)*180/Math.PI;if(Number.isFinite(desired))this.state.avatar.yaw=this._turnToward(Number(this.state.avatar.yaw)||0,desired,dt)}this.sync();if(this.state.avatar.mode==='tpv')this.toTPV();else if(this.state.avatar.mode==='fpv')this.toFPV()}
  installDrag(){const canvas=this.scene.canvas;if(!canvas)return;const ray=this.scene.raycaster,ptr=this.scene.pointer,plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hitPt=new THREE.Vector3();const updatePointer=e=>{const r=canvas.getBoundingClientRect();ptr.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ptr,this.scene.camera)};canvas.addEventListener('pointerdown',e=>{if(e.button!==0||this.state.avatar?.mode==='fpv')return;updatePointer(e);const hits=ray.intersectObject(this.group,true);if(!hits.length)return;const floorY=this.group.position.y;plane.set(new THREE.Vector3(0,1,0),-floorY);if(!ray.ray.intersectPlane(plane,hitPt))return;this.drag.active=true;this.drag.pointerId=e.pointerId;this.drag.offset.copy(this.group.position).sub(hitPt);this.scene.controls.enabled=false;canvas.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopImmediatePropagation()},true);canvas.addEventListener('pointermove',e=>{if(!this.drag.active||this.drag.pointerId!==e.pointerId)return;updatePointer(e);if(!ray.ray.intersectPlane(plane,hitPt))return;const p=hitPt.clone().add(this.drag.offset);this.state.avatar.position[0]=p.x;this.state.avatar.position[1]=p.z;this.sync();e.preventDefault();e.stopImmediatePropagation()},true);const end=e=>{if(!this.drag.active||(e&&this.drag.pointerId!==e.pointerId))return;this.drag.active=false;this.drag.pointerId=null;this.scene.controls.enabled=true};canvas.addEventListener('pointerup',end,true);canvas.addEventListener('pointercancel',end,true)}
  sync(){const a=this.state.avatar;if(a.onPlanet&&this.planetManager){this._syncPlanet();return}this.group.visible=a.enabled!==false&&a.mode!=='fpv';this.group.position.set(a.position[0],a.position[2],a.position[1]);this.group.rotation.set(0,-(a.yaw||0)*Math.PI/180,0)}
  setMode(mode){this.ensureState();this.state.avatar.mode=mode;if(mode==='fpv')this.toFPV();else if(mode==='tpv')this.toTPV();else{this.group.visible=this.state.avatar.enabled!==false;this.scene.controls.enabled=true}return mode}
  toFPV(){const a=this.state.avatar,h=Number(a.height)||170;if(a.onPlanet&&this.planetManager){
    this._syncPlanet();const {n,f}=this._planetFrame(),base=this.group.position.clone(),eye=base.add(n.clone().multiplyScalar(h*.92));
    const pitch=THREE.MathUtils.degToRad(Math.max(-80,Math.min(80,Number(a.pitch)||0))),right=new THREE.Vector3().crossVectors(f,n).normalize();
    const look=f.clone().applyAxisAngle(right,pitch).normalize();
    this.scene.camera.position.copy(eye);this.scene.camera.up.copy(n);this.scene.controls.target.copy(eye).add(look.multiplyScalar(Math.max(120,h)));this.scene.controls.enabled=true;this.scene.camera.lookAt(this.scene.controls.target);this.scene.controls.update();return
  }const p=a.position,yaw=(a.yaw||0)*Math.PI/180,pitch=(a.pitch||0)*Math.PI/180;this.sync();this.scene.controls.enabled=true;this.scene.camera.up.set(0,1,0);this.scene.camera.position.set(p[0],p[2]+h*.92,p[1]);const f=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));this.scene.controls.target.copy(this.scene.camera.position).add(f.multiplyScalar(100));this.scene.controls.update()}
  _creatorViewFactor(){const mm=Math.max(.001,Number(this.state.creator?.scaleMm)||1);return THREE.MathUtils.clamp(Math.pow(mm,.25),.12,6000)}
  toTPV(){const a=this.state.avatar,h=Number(a.height)||170,pitch=THREE.MathUtils.degToRad(Math.max(-65,Math.min(75,Number(a.cameraPitch)||20))),radius=h*(Number(a.cameraDistance)||1.7)*this._creatorViewFactor();if(a.onPlanet&&this.planetManager){this._syncPlanet();const {n,f}=this._planetFrame(),viewF=f.clone().applyAxisAngle(n,THREE.MathUtils.degToRad(Number(a.cameraYaw)||0)).normalize(),target=this.group.position.clone().add(n.clone().multiplyScalar(h*.55)),horizontal=viewF.clone().negate().multiplyScalar(Math.cos(pitch)*radius),vertical=n.clone().multiplyScalar(Math.sin(pitch)*radius);this.scene.camera.position.copy(target).add(horizontal).add(vertical);this.scene.camera.up.copy(n);this.scene.controls.target.copy(target);this.scene.controls.enabled=true;this.group.visible=a.enabled!==false;this.scene.controls.update();return}const p=a.position,viewYaw=THREE.MathUtils.degToRad((Number(a.yaw)||0)+(Number(a.cameraYaw)||0));this.sync();this.group.visible=a.enabled!==false;this.scene.camera.up.set(0,1,0);const target=new THREE.Vector3(p[0],p[2]+h*.55,p[1]),back=new THREE.Vector3(-Math.sin(viewYaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(viewYaw)*Math.cos(pitch)).multiplyScalar(radius);this.scene.camera.position.copy(target).add(back);this.scene.controls.target.copy(target);this.scene.controls.enabled=true;this.scene.controls.update()}
}
