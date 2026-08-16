
import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {createGeometry} from "../cad/geometry.js";

export class SceneController{
  constructor(canvas){
    this.canvas=canvas;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x0c1218);
    this.camera=new THREE.PerspectiveCamera(45,1,.1,5000000);
    this.camera.position.set(150,120,170);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.controls=new OrbitControls(this.camera,canvas);
    this.controls.enableDamping=true;
    this.controls.enablePan=true;
    this.controls.screenSpacePanning=true;
    this.controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.PAN};
    this.panMode=false;
    this.root=new THREE.Group();
    this.scene.add(this.root);
    this.baseHemisphereLight=new THREE.HemisphereLight(0xffffff,0x334455,2.2);this.baseHemisphereLight.name='WorkspaceHemisphereLight';this.scene.add(this.baseHemisphereLight);
    const dl=new THREE.DirectionalLight(0xffffff,2);dl.name='WorkspaceDirectionalLight';
    dl.position.set(100,150,100);this.baseDirectionalLight=dl;
    this.scene.add(dl);
    this.grid=new THREE.GridHelper(1000,100,0x33536b,0x233642);
    this.scene.add(this.grid);
    this.setGridAppearance(.18,true);
    this.datumGroup=new THREE.Group();
    this.datumGroup.name="datum-elements";
    this.scene.add(this.datumGroup);
    this.datumObjects=new Map();
    this.createDatumElements();
    this.raycaster=new THREE.Raycaster();
    this.pointer=new THREE.Vector2();
    this.loopHooks=[];
    this.youtubeWallOverlays=new Map();
    this.wallMediaOverlayHost=null;
    this.loopHooks.push(()=>{this.updateYoutubeWallOverlays();this.updateSpatialLocalMedia()});
    this.resize();
    addEventListener("resize",()=>this.resize());
  }


  createDatumElements(){
    const makeLine=(id,a,b,color)=>{
      const geometry=new THREE.BufferGeometry().setFromPoints([a,b]);
      const material=new THREE.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:false});
      const line=new THREE.Line(geometry,material);line.userData.datumId=id;line.renderOrder=80;this.datumGroup.add(line);this.datumObjects.set(id,line);return line;
    };
    const L=180;
    makeLine("xAxis",new THREE.Vector3(-L,0,0),new THREE.Vector3(L,0,0),0xff5f68);
    makeLine("yAxis",new THREE.Vector3(0,0,-L),new THREE.Vector3(0,0,L),0x56d98b);
    makeLine("zAxis",new THREE.Vector3(0,-L,0),new THREE.Vector3(0,L,0),0x5aa8ff);
    const origin=new THREE.Mesh(new THREE.SphereGeometry(2.4,16,12),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false}));
    origin.userData.datumId="origin";origin.renderOrder=90;this.datumGroup.add(origin);this.datumObjects.set("origin",origin);
    const plane=(id,rotation,color)=>{
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));
      mesh.rotation.set(...rotation);mesh.userData.datumId=id;mesh.renderOrder=10;this.datumGroup.add(mesh);this.datumObjects.set(id,mesh);return mesh;
    };
    plane("xyPlane",[-Math.PI/2,0,0],0x4f9fd4);
    plane("xzPlane",[0,0,0],0x6bcf91);
    plane("yzPlane",[0,Math.PI/2,0],0xe28d71);
  }


  setWorkCoordinateSystem({originCad=[0,0,0],unitScaleMm=10}={}){
    const mmPerWorkspaceUnit=Math.max(1e-9,Number(unitScaleMm)||10);
    const scale=1/mmPerWorkspaceUnit;
    this.workCoordinate={originCad:[...(originCad||[0,0,0])],unitScaleMm:mmPerWorkspaceUnit,scale};
    const o=this.workCoordinate.originCad;
    const world=new THREE.Vector3(Number(o[0])||0,Number(o[2])||0,Number(o[1])||0);
    this.root.position.copy(world);this.root.scale.setScalar(scale);
    this.datumGroup.position.copy(world);this.datumGroup.scale.setScalar(scale);
    this.grid.position.copy(world);this.grid.scale.setScalar(scale);
    return this.workCoordinate;
  }

  setWorkCoordinateFrame({originWorld=null,quaternion=null,unitScaleMm=10}={}){
    const mmPerWorkspaceUnit=Math.max(1e-9,Number(unitScaleMm)||10);
    const scale=1/mmPerWorkspaceUnit;
    const origin=originWorld?.isVector3?originWorld.clone():new THREE.Vector3(...(Array.isArray(originWorld)?originWorld:[0,0,0]));
    const q=quaternion?.isQuaternion?quaternion.clone():new THREE.Quaternion();
    this.workCoordinate={originCad:[origin.x,origin.z,origin.y],unitScaleMm:mmPerWorkspaceUnit,scale,originWorld:origin.toArray(),quaternion:[q.x,q.y,q.z,q.w]};
    for(const g of [this.root,this.datumGroup,this.grid]){
      if(!g)continue;
      g.position.copy(origin);g.quaternion.copy(q);g.scale.setScalar(scale);g.updateMatrixWorld(true);
    }
    return this.workCoordinate;
  }

  cadPointToWorld(point=[0,0,0]){
    const local=new THREE.Vector3(Number(point[0])||0,Number(point[2])||0,Number(point[1])||0);
    this.root.updateMatrixWorld(true);
    return this.root.localToWorld(local);
  }

  worldPointToCad(point){
    this.root.updateMatrixWorld(true);
    const local=this.root.worldToLocal((point?.isVector3?point:new THREE.Vector3(Number(point?.x)||0,Number(point?.y)||0,Number(point?.z)||0)).clone());
    return [local.x,local.z,local.y];
  }

  worldBoxToCad(box){
    const a=this.worldPointToCad(box.min),b=this.worldPointToCad(box.max);
    return {min:a.map((v,i)=>Math.min(v,b[i])),max:a.map((v,i)=>Math.max(v,b[i]))};
  }

  setGridAppearance(opacity=.18,visible=true){
    if(!this.grid)return;
    this.grid.visible=visible!==false;
    const mats=Array.isArray(this.grid.material)?this.grid.material:[this.grid.material];
    for(const m of mats){if(!m)continue;m.transparent=true;m.opacity=Math.max(.02,Math.min(.8,Number(opacity)||.18));m.depthWrite=false;}
  }

  setPanMode(enabled){
    this.panMode=!!enabled;
    this.controls.enablePan=true;
    this.controls.mouseButtons={
      LEFT:this.panMode?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE,
      MIDDLE:THREE.MOUSE.PAN,
      RIGHT:THREE.MOUSE.PAN
    };
    return this.panMode;
  }

  setDatumVisibility(id,visible){const object=this.datumObjects.get(id);if(object)object.visible=!!visible}
  selectDatum(id){
    for(const [key,object] of this.datumObjects){
      const selected=key===id;
      if(object.material){
        object.material.opacity=selected?1:(key.endsWith("Plane")?.13:.95);
        if(selected&&key.endsWith("Plane"))object.material.opacity=.32;
      }
      object.scale.setScalar(selected?1.18:1);
    }
  }

  pickDatum(event){
    this.updatePointer(event);
    const objects=[...this.datumObjects.values()].filter(o=>o.visible);
    return this.raycaster.intersectObjects(objects,false)[0]?.object?.userData?.datumId||null;
  }

  resize(){
    const r=this.canvas.parentElement.getBoundingClientRect();
    this.renderer.setSize(r.width,r.height,false);
    this.camera.aspect=r.width/Math.max(1,r.height);
    this.camera.updateProjectionMatrix();
  }

  makeMesh(part){
    const mat=new THREE.MeshStandardMaterial({
      color:part.color,
      roughness:.55,
      metalness:.08
    });
    const mesh=new THREE.Mesh(createGeometry(part.type,part.params,part.features||[]),mat);
    mesh.userData.partId=part.id;
    const edge=new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({color:0x28475b})
    );
    edge.raycast=()=>{};
    mesh.add(edge);
    part.edge=edge;
    part.mesh=mesh;
    this.rebuildPartDatums(part);
    this.root.add(mesh);
    this.sync(part);
    return mesh;
  }

  disposeObject3D(object){
    if(!object)return;
    object.traverse?.(child=>{
      child.geometry?.dispose?.();
      if(Array.isArray(child.material))child.material.forEach(m=>m?.dispose?.());
      else child.material?.dispose?.();
    });
    object.parent?.remove(object);
  }

  partBounds(part){
    const p=part?.params||{};
    if(part?.type==='box')return {min:[-(p.width||80)/2,-(p.depth||60)/2,-(p.height||40)/2],max:[(p.width||80)/2,(p.depth||60)/2,(p.height||40)/2]};
    if(part?.type==='cylinder')return {min:[-(p.radius||25),-(p.radius||25),-(p.height||50)/2],max:[p.radius||25,p.radius||25,(p.height||50)/2]};
    if(part?.type==='sphere')return {min:[-(p.radius||30),-(p.radius||30),-(p.radius||30)],max:[p.radius||30,p.radius||30,p.radius||30]};
    try{const b=new THREE.Box3().setFromBufferAttribute(part.mesh.geometry.attributes.position);return {min:[b.min.x,b.min.z,b.min.y],max:[b.max.x,b.max.z,b.max.y]}}catch{return {min:[-25,-25,-25],max:[25,25,25]}}
  }

  vectorForOrientation(orientation){
    const key=(orientation||'Z').toUpperCase();
    if(key==='X')return [1,0,0];if(key==='Y')return [0,1,0];if(key==='Z')return [0,0,1];
    if(key==='XY')return [0,0,1];if(key==='XZ')return [0,1,0];if(key==='YZ')return [1,0,0];return [0,0,1];
  }

  resolveDatumReference(part,token,seen=new Set()){
    const bounds=this.partBounds(part),center=bounds.min.map((v,i)=>(v+bounds.max[i])/2);
    if(!token)return {position:[0,0,0],orientation:null,direction:[0,0,1],normal:[0,0,1],type:'point'};
    if(token.startsWith('face:')){const key=token.slice(5),axis='XYZ'.indexOf(key[0]),side=key[1];const pos=[...center];pos[axis]=side==='+'?bounds.max[axis]:bounds.min[axis];const n=[0,0,0];n[axis]=side==='+'?1:-1;return {position:pos,orientation:key[0],normal:n,direction:n,type:'plane'};}
    if(token.startsWith('mid:')){const a=token.slice(4),n=this.vectorForOrientation(a);return {position:[...center],orientation:a,normal:n,direction:n,type:'plane'};}
    if(token.startsWith('hole:')){const f=(part.features||[]).find((x,i)=>String(x.id||i)===token.slice(5));const c=f?.params?.center||f?.center||[0,0,0],axis=f?.params?.axis||'Z',v=this.vectorForOrientation(axis);return {position:[Number(c[0])||0,Number(c[1])||0,Number(c[2])||0],orientation:axis,direction:v,normal:v,type:'axis'};}
    if(token.startsWith('datum:')){const id=token.slice(6);if(seen.has(id))return {position:[0,0,0],orientation:null,direction:[0,0,1],normal:[0,0,1],type:'point'};seen.add(id);const d=(part.datums||[]).find(x=>x.id===id);if(!d)return {position:[0,0,0],orientation:null,direction:[0,0,1],normal:[0,0,1],type:'point'};return this.resolvePartDatum(part,d,seen);}
    return {position:[0,0,0],orientation:null,direction:[0,0,1],normal:[0,0,1],type:'point'};
  }

  resolvePartDatum(part,datum,seen=new Set()){
    if(datum._solved)return {...datum._solved};
    const ref=datum.reference||{};
    if(datum.system||ref.kind==='localOrigin'||ref.kind==='primaryAxis'||ref.kind==='primaryPlane'){
      const v=this.vectorForOrientation(datum.orientation);return {position:[...(datum.position||[0,0,0])],orientation:datum.orientation,direction:[...(datum.direction||v)],normal:[...(datum.normal||v)],type:datum.type};
    }
    const a=this.resolveDatumReference(part,ref.sourceA,seen),b=ref.sourceB?this.resolveDatumReference(part,ref.sourceB,seen):null;
    let position=[...(a.position||datum.position||[0,0,0])];
    if(ref.kind==='between'&&b)position=position.map((v,i)=>(v+(b.position?.[i]||0))/2);
    const axis='XYZ'.indexOf((datum.orientation||a.orientation||'Z')[0]);if(axis>=0)position[axis]+=(Number(datum.offset)||0);
    position=position.map((v,i)=>v+(Number(datum.position?.[i])||0));
    const base=this.vectorForOrientation(datum.orientation||a.orientation);
    return {position,orientation:datum.orientation||a.orientation,direction:[...(datum.direction||a.direction||base)],normal:[...(datum.normal||a.normal||base)],type:datum.type};
  }

  solveGeometryConstraints(part){
    for(const d of part.datums||[])delete d._solved;
    const constraints=Array.isArray(part.geometryConstraints)?part.geometryConstraints:[];
    const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n)};
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const add=(a,b)=>a.map((x,i)=>x+b[i]);const mul=(a,k)=>a.map(x=>x*k);
    for(let pass=0;pass<3;pass++)for(const c of constraints){
      const d=(part.datums||[]).find(x=>x.id===c.targetDatumId);if(!d||d.system)continue;
      const current=this.resolvePartDatum(part,d),ref=this.resolveDatumReference(part,c.reference);
      let solved={...current,position:[...current.position],direction:[...(current.direction||[0,0,1])],normal:[...(current.normal||[0,0,1])]};
      const rv=norm(ref.normal||ref.direction||[0,0,1]);
      if(c.type==='coincident')solved.position=[...ref.position];
      else if(c.type==='distance')solved.position=add(ref.position,mul(rv,Number(c.value)||0));
      else if(c.type==='parallel'){solved.direction=[...rv];solved.normal=[...rv];}
      else if(c.type==='perpendicular'){let p=cross(rv,[0,0,1]);if(Math.hypot(...p)<1e-6)p=cross(rv,[0,1,0]);p=norm(p);solved.direction=p;solved.normal=p;}
      else if(c.type==='angle'){const a=(Number(c.value)||0)*Math.PI/180;let u=cross(rv,[0,0,1]);if(Math.hypot(...u)<1e-6)u=cross(rv,[0,1,0]);u=norm(u);const p=norm(add(mul(rv,Math.cos(a)),mul(u,Math.sin(a))));solved.direction=p;solved.normal=p;}
      else if(c.type==='concentric'){solved.position=[...ref.position];solved.direction=[...rv];solved.normal=[...rv];}
      d._solved=solved;
    }
  }

  rebuildPartDatums(part){
    const mesh=part?.mesh;
    if(!mesh)return;

    if(part.datumGroup){
      this.disposeObject3D(part.datumGroup);
      part.datumGroup=null;
    }

    const group=new THREE.Group();
    group.name=`part-datums:${part.id}`;
    group.userData.partId=part.id;
    group.raycast=()=>{};

    this.solveGeometryConstraints(part);
    const datums=Array.isArray(part.datums)?part.datums:[];
    const lineMaterial=color=>new THREE.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:false});
    const pointMaterial=color=>new THREE.MeshBasicMaterial({color,depthTest:false});
    const planeMaterial=color=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false,depthTest:false});
    const colorFor=d=>d.selected?0xffd45c:0x64c7ff;
    const cadToLocal=position=>new THREE.Vector3(Number(position?.[0])||0,Number(position?.[2])||0,Number(position?.[1])||0);
    const cadVectorToLocal=v=>new THREE.Vector3(Number(v?.[0])||0,Number(v?.[2])||0,Number(v?.[1])||0);
    const directionFor=orientation=>cadVectorToLocal(this.vectorForOrientation(orientation));

    for(const datum of datums){
      if(datum?.visible===false)continue;
      const color=colorFor(datum);
      const resolved=this.resolvePartDatum(part,datum);
      const pos=cadToLocal(resolved.position);
      let object=null;

      if(datum.type==='point'){
        object=new THREE.Mesh(new THREE.SphereGeometry(1.8,14,10),pointMaterial(color));
        object.position.copy(pos);
      }else if(datum.type==='axis'){
        const dir=cadVectorToLocal(resolved.direction||this.vectorForOrientation(resolved.orientation||datum.orientation)).normalize();
        const half=45;
        const geometry=new THREE.BufferGeometry().setFromPoints([pos.clone().addScaledVector(dir,-half),pos.clone().addScaledVector(dir,half)]);
        object=new THREE.Line(geometry,lineMaterial(color));
      }else if(datum.type==='plane'){
        object=new THREE.Mesh(new THREE.PlaneGeometry(70,70),planeMaterial(color));
        object.position.copy(pos);
        const normal=cadVectorToLocal(resolved.normal||this.vectorForOrientation(resolved.orientation||datum.orientation)).normalize();
        object.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
      }

      if(!object)continue;
      object.name=datum.name||datum.type;
      object.renderOrder=70;
      object.userData={...object.userData,partId:part.id,partDatumId:datum.id,isPartDatum:true};
      object.raycast=()=>{};
      group.add(object);
    }

    mesh.add(group);
    part.datumGroup=group;
  }

  rebuild(part){
    part.mesh.geometry.dispose();
    part.mesh.geometry=createGeometry(part.type,part.params,part.features||[]);
    part.edge.geometry.dispose();
    part.edge.geometry=new THREE.EdgesGeometry(part.mesh.geometry);
    this.rebuildPartDatums(part);
    this.sync(part);
  }

  ensureWallMediaOverlayHost(){
    if(this.wallMediaOverlayHost?.isConnected)return this.wallMediaOverlayHost;
    const host=document.createElement('div');
    host.className='wallMediaOverlayHost';
    Object.assign(host.style,{position:'fixed',display:'block',overflow:'hidden',pointerEvents:'none',zIndex:'11',left:'0',top:'0',width:'0',height:'0'});
    document.body.appendChild(host);this.wallMediaOverlayHost=host;return host;
  }

  removeYoutubeWallOverlay(mesh){
    if(!mesh)return;
    const entry=this.youtubeWallOverlays?.get(mesh.uuid);
    if(entry){try{entry.iframe.src='about:blank';entry.wrap.remove()}catch{}this.youtubeWallOverlays.delete(mesh.uuid)}
    if(mesh.userData)delete mesh.userData.youtubeWallOverlayId;
  }

  ensureYoutubeWallOverlay(mesh,art){
    if(!mesh||!art||!['youtube','vimeo','embed'].includes(String(art.mediaType||'').toLowerCase())||art.wallPlayback===false){this.removeYoutubeWallOverlay(mesh);return null}
    const provider=String(art.mediaType||'').toLowerCase();const id=provider==='youtube'?String(art.youtubeId||'').trim():provider==='vimeo'?String(art.vimeoId||'').trim():String(art.embedUrl||art.mediaUrl||'').trim();if(!id){this.removeYoutubeWallOverlay(mesh);return null}
    const start=Math.max(0,Math.floor(Number(art.startSeconds)||0));
    const end=Math.max(0,Math.floor(Number(art.endSeconds)||0));
    const loop=art.loop!==false,autoplay=art.autoplay!==false,muted=art.muted!==false;
    const rotationDeg=[0,90,180,270].includes(Number(art.rotationDeg))?Number(art.rotationDeg):180;
    const autoRotation=art.autoRotation!==false;
    const resolvedRotationDeg=autoRotation&&[0,90,180,270].includes(Number(art.autoResolvedRotationDeg))?Number(art.autoResolvedRotationDeg):rotationDeg;
    const key=JSON.stringify([provider,id,start,end,loop,autoplay,muted,Number(art.volume)||0,rotationDeg,autoRotation,resolvedRotationDeg]);
    let entry=this.youtubeWallOverlays.get(mesh.uuid);
    if(entry&&entry.key===key)return entry;
    if(entry)this.removeYoutubeWallOverlay(mesh);
    const wrap=document.createElement('div');
    wrap.className='youtubeWallOverlay';
    Object.assign(wrap.style,{position:'absolute',display:'none',overflow:'hidden',background:'#000',pointerEvents:'none',left:'0',top:'0',width:'1000px',height:'562.5px',zIndex:'1',transformOrigin:'0 0',backfaceVisibility:'hidden',boxShadow:'none'});
    const iframe=document.createElement('iframe');
    iframe.title='Wall media display';iframe.allow='autoplay; encrypted-media; picture-in-picture';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.tabIndex=-1;
    Object.assign(iframe.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',pointerEvents:'none',transformOrigin:'50% 50%'});
    const rr=((resolvedRotationDeg%360)+360)%360;
    if(rr===180)iframe.style.transform='rotate(180deg)';
    else if(rr===90||rr===270){iframe.style.width='100%';iframe.style.height='100%';iframe.style.transform=`rotate(${rr}deg) scale(${Math.SQRT1_2})`;}
    else iframe.style.transform='none';
    const originParam=location.protocol.startsWith('http')?`&origin=${encodeURIComponent(location.origin)}`:'';
    const endParam=end>start?`&end=${end}`:'';
    if(provider==='youtube')iframe.src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=${autoplay?1:0}&mute=${muted?1:0}&loop=${loop?1:0}&playlist=${encodeURIComponent(id)}&playsinline=1&rel=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1&start=${start}${endParam}${originParam}`;else if(provider==='vimeo')iframe.src=`https://player.vimeo.com/video/${encodeURIComponent(id)}?autoplay=${autoplay?1:0}&muted=${muted?1:0}&loop=${loop?1:0}&background=1&autopause=0`;else iframe.src=id;
    const send=(func,args=[])=>{try{iframe.contentWindow?.postMessage(JSON.stringify({event:'command',func,args}),'*')}catch{}};
    iframe.addEventListener('load',()=>{setTimeout(()=>{if(provider==='youtube'){send('setVolume',[Math.round(Math.max(0,Math.min(1,Number(art.volume)||0))*100)]);send(muted?'mute':'unMute');if(autoplay)send('playVideo')}else if(provider==='vimeo'){try{iframe.contentWindow?.postMessage({method:'setVolume',value:muted?0:Math.max(0,Math.min(1,Number(art.volume)||0))},'*');if(autoplay)iframe.contentWindow?.postMessage({method:'play'},'*')}catch{}}},350)});
    wrap.appendChild(iframe);this.ensureWallMediaOverlayHost().appendChild(wrap);
    entry={wrap,iframe,key,mesh,id,provider,muted,rotationDeg:resolvedRotationDeg};this.youtubeWallOverlays.set(mesh.uuid,entry);mesh.userData.youtubeWallOverlayId=mesh.uuid;return entry;
  }

  _wallMediaHomography(srcW,srcH,pts){
    // Solve an 8-parameter projective transform from a rectangle to a screen-space quadrilateral.
    const src=[[0,0],[srcW,0],[srcW,srcH],[0,srcH]],A=[],b=[];
    for(let i=0;i<4;i++){const [x,y]=src[i],[X,Y]=pts[i];A.push([x,0,y,0,1,0,-x*X,-y*X]);b.push(X);A.push([0,x,0,y,0,1,-x*Y,-y*Y]);b.push(Y)}
    for(let i=0;i<8;i++){let pivot=i;for(let r=i+1;r<8;r++)if(Math.abs(A[r][i])>Math.abs(A[pivot][i]))pivot=r;if(Math.abs(A[pivot][i])<1e-9)return null;[A[i],A[pivot]]=[A[pivot],A[i]];[b[i],b[pivot]]=[b[pivot],b[i]];const q=A[i][i];for(let c=i;c<8;c++)A[i][c]/=q;b[i]/=q;for(let r=0;r<8;r++){if(r===i)continue;const f=A[r][i];if(!f)continue;for(let c=i;c<8;c++)A[r][c]-=f*A[i][c];b[r]-=f*b[i]}}
    const [a,b1,c,d,e,f,g,h]=b;
    return `matrix3d(${a},${b1},0,${g},${c},${d},0,${h},0,0,1,0,${e},${f},0,1)`;
  }

  _wallMediaOccluded(mesh,target,normal,distance){
    const origin=this.camera.position.clone();const dir=target.clone().sub(origin);const len=dir.length();if(len<=1e-6)return false;dir.normalize();
    this.raycaster.set(origin,dir);this.raycaster.near=.001;this.raycaster.far=Math.max(.001,len-.002);
    const hits=this.raycaster.intersectObjects(this.scene.children,true);
    const belongs=obj=>{for(let n=obj;n;n=n.parent)if(n===mesh)return true;return false};
    for(const hit of hits){const o=hit.object;if(!o||belongs(o)||o===this.grid||o===this.datumGroup||o.userData?.datumId||o.userData?.surfaceLightRig||o.isLine||o.isPoints||o.visible===false)continue;const mat=o.material;if(Array.isArray(mat)){if(mat.every(m=>m?.transparent&&Number(m.opacity)<.08))continue}else if(mat?.transparent&&Number(mat.opacity)<.08)continue;return true}
    return false;
  }

  _spatialAudioGain(mesh,art={}){
    if(art.spatialAudio===false)return 1;
    const pos=new THREE.Vector3();mesh.getWorldPosition(pos);
    const mmPerUnit=Math.max(1e-9,Number(this.workCoordinate?.unitScaleMm)||10);
    const dMm=this.camera.position.distanceTo(pos)*mmPerUnit;
    const ref=Math.max(100,Number(art.audioRefDistanceMm)||2000);
    const max=Math.max(ref+100,Number(art.audioMaxDistanceMm)||30000);
    const roll=Math.max(.05,Number(art.audioRolloff)||1.35);
    if(dMm>=max)return 0;
    if(dMm<=ref)return 1;
    const inverse=1/(1+roll*((dMm/ref)-1));
    const edge=THREE.MathUtils.clamp((max-dMm)/(max-ref),0,1);
    return THREE.MathUtils.clamp(inverse*Math.sqrt(edge),0,1);
  }

  _applySpatialMediaVolume(entry,art,gain,now=performance.now()){
    const base=THREE.MathUtils.clamp(Number(art.volume)||0,0,1),v=base*gain;
    if(entry){
      if(now-(entry.lastVolumeAt||0)<120&&Math.abs(v-(entry.lastSpatialVolume??-1))<.025)return;
      entry.lastVolumeAt=now;entry.lastSpatialVolume=v;
      try{
        const f=entry.iframe?.contentWindow;if(!f)return;
        if(entry.provider==='youtube')f.postMessage(JSON.stringify({event:'command',func:'setVolume',args:[Math.round(v*100)]}),'*');
        else if(entry.provider==='vimeo')f.postMessage({method:'setVolume',value:entry.muted?0:v},'*');
      }catch{}
    }
  }

  updateSpatialLocalMedia(){
    const now=performance.now();
    this.root.traverse(mesh=>{
      const el=mesh.userData?.surfaceMediaElement,art=mesh.userData?.surfaceArtAudio;if(!el||!art)return;
      if(now-(mesh.userData._lastSpatialAudioAt||0)<120)return;mesh.userData._lastSpatialAudioAt=now;
      const gain=this._spatialAudioGain(mesh,art),base=THREE.MathUtils.clamp(Number(art.volume)||0,0,1);
      try{el.volume=THREE.MathUtils.clamp(base*gain,0,1)}catch{}
    });
  }

  updateYoutubeWallOverlays(){
    if(!this.youtubeWallOverlays?.size)return;
    const rect=this.canvas.getBoundingClientRect(),host=this.ensureWallMediaOverlayHost();
    Object.assign(host.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    const lbCenter=new THREE.Vector3(),worldCenter=new THREE.Vector3(),normal=new THREE.Vector3(),toCamera=new THREE.Vector3();
    const srcW=1000,srcH=562.5;
    for(const [,entry] of [...this.youtubeWallOverlays]){
      const mesh=entry.mesh,wrap=entry.wrap;if(!mesh?.parent||!mesh.visible){wrap.style.display='none';continue}
      mesh.updateMatrixWorld(true);mesh.geometry?.computeBoundingBox?.();const lb=mesh.geometry?.boundingBox;if(!lb){wrap.style.display='none';continue}
      lbCenter.copy(lb.min).add(lb.max).multiplyScalar(.5);lbCenter.z=lb.max.z;worldCenter.copy(lbCenter).applyMatrix4(mesh.matrixWorld);
      normal.set(0,0,1).transformDirection(mesh.matrixWorld).normalize();toCamera.copy(this.camera.position).sub(worldCenter);
      if(normal.dot(toCamera)<=1e-5){wrap.style.display='none';continue}
      if(this._wallMediaOccluded(mesh,worldCenter,normal,toCamera.length())){wrap.style.display='none';continue}
      const art=mesh.userData?.surfaceArtAudio||{};this._applySpatialMediaVolume(entry,art,this._spatialAudioGain(mesh,art));
      const corners=[[lb.min.x,lb.min.y,lb.max.z],[lb.max.x,lb.min.y,lb.max.z],[lb.max.x,lb.max.y,lb.max.z],[lb.min.x,lb.max.y,lb.max.z]];
      const pts=[];let invalid=false;
      for(const v of corners){const p=new THREE.Vector3(...v).applyMatrix4(mesh.matrixWorld).project(this.camera);if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.z<-1||p.z>1){invalid=true;break}pts.push([(p.x+1)*rect.width/2,(1-p.y)*rect.height/2])}
      if(invalid){wrap.style.display='none';continue}
      const area=Math.abs(pts.reduce((sum,p,i)=>{const q=pts[(i+1)%4];return sum+p[0]*q[1]-q[0]*p[1]},0)/2);if(area<80){wrap.style.display='none';continue}
      // Robust wall-space projection: use the projected quad's real on-screen bounds,
      // then clip the HTML player to the exact quadrilateral. Unlike a fixed 1000px
      // iframe + matrix3d, the DOM element itself now shrinks with distance and angle.
      const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
      let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      // Intersect with the renderer viewport so an off-screen sign cannot allocate a huge overlay.
      if(maxX<=0||maxY<=0||minX>=rect.width||minY>=rect.height){wrap.style.display='none';continue}
      const rawW=maxX-minX,rawH=maxY-minY;if(rawW<2||rawH<2||rawW>rect.width*4||rawH>rect.height*4){wrap.style.display='none';continue}
      const clippedMinX=Math.max(0,minX),clippedMinY=Math.max(0,minY),clippedMaxX=Math.min(rect.width,maxX),clippedMaxY=Math.min(rect.height,maxY);
      const w=Math.max(1,clippedMaxX-clippedMinX),h=Math.max(1,clippedMaxY-clippedMinY);
      // Polygon coordinates are relative to the clipped bounding rectangle. Clamping keeps
      // partially off-screen signage stable while still preserving a trapezoidal silhouette.
      const poly=pts.map(([x,y])=>{const px=Math.max(0,Math.min(w,x-clippedMinX)),py=Math.max(0,Math.min(h,y-clippedMinY));return `${px.toFixed(2)}px ${py.toFixed(2)}px`}).join(',');
      Object.assign(wrap.style,{display:'block',left:`${clippedMinX}px`,top:`${clippedMinY}px`,width:`${w}px`,height:`${h}px`,transform:'none',clipPath:`polygon(${poly})`,webkitClipPath:`polygon(${poly})`,opacity:String(Math.max(.15,Math.min(1,mesh.material?.opacity??1))) });
    }
  }

  controlWallMedia(part,action){
    const mesh=part?.mesh;if(!mesh)return false;const entry=this.youtubeWallOverlays?.get(mesh.uuid);const el=mesh.userData?.surfaceMediaElement;
    if(el){if(action==='pause')el.pause?.();else if(action==='play')el.play?.().catch?.(()=>{});else if(action==='muteToggle')el.muted=!el.muted;return true}
    if(!entry)return false;const f=entry.iframe?.contentWindow;if(!f)return false;
    try{if(entry.provider==='youtube'){const func=action==='pause'?'pauseVideo':action==='play'?'playVideo':entry.muted?'unMute':'mute';f.postMessage(JSON.stringify({event:'command',func,args:[]}),'*');if(action==='muteToggle')entry.muted=!entry.muted}else if(entry.provider==='vimeo'){if(action==='pause')f.postMessage({method:'pause'},'*');else if(action==='play')f.postMessage({method:'play'},'*');else {entry.muted=!entry.muted;f.postMessage({method:'setVolume',value:entry.muted?0:1},'*')}}else {if(action==='play')entry.iframe.focus?.();return false}return true}catch{return false}
  }

  applySurfaceArt(part){
    const mesh=part?.mesh,art=part?.metadata?.surfaceArt;if(!mesh?.material)return;
    const mat=mesh.material;
    const cleanup=()=>{
      const old=mesh.userData?.surfaceMediaElement;if(old){try{old.pause?.();old.removeAttribute?.('src');old.load?.()}catch{}}
      delete mesh.userData.surfaceMediaElement;
      this.removeYoutubeWallOverlay(mesh);
      const dyn=mesh.userData?.surfaceDynamic;if(dyn)dyn.active=false;delete mesh.userData.surfaceDynamic;
      const rig=mesh.getObjectByName?.('SurfaceMediaLightRig');if(rig){rig.traverse(o=>{o.dispose?.();o.material?.dispose?.();o.geometry?.dispose?.()});mesh.remove(rig)}
      if(mat.userData?.surfaceArtTexture){mat.userData.surfaceArtTexture.dispose?.();delete mat.userData.surfaceArtTexture}
      mat.map=null;mat.emissive?.set?.(0x000000);mat.emissiveIntensity=0;delete mat.userData.surfaceArtKey;mat.needsUpdate=true;
    };
    if(!art){delete mesh.userData.surfaceArtAudio;cleanup();return}
    mesh.userData.surfaceArtAudio=art;
    const key=JSON.stringify([art.background||'#d8d0c2',art.text||'',art.textColor||'#111111',art.imageDataUrl||'',art.mediaType||'image',art.mediaUrl||'',art.mediaDataUrl||'',art.wallPlayback!==false,art.loop!==false,art.autoplay!==false,art.muted!==false,Number(art.volume)||0,Number(art.startSeconds)||0,Number(art.endSeconds)||0,Number(art.rotationDeg)||180,art.autoRotation!==false,Number(art.autoResolvedRotationDeg)||180,art.lightMode||'none',art.lightColor||'#fff1c4',Number(art.lightIntensity)||0,art.spatialAudio!==false,Number(art.audioRefDistanceMm)||2000,Number(art.audioMaxDistanceMm)||30000,Number(art.audioRolloff)||1.35]);
    if(mat.userData?.surfaceArtKey===key)return;
    cleanup();mat.userData.surfaceArtKey=key;
    const type=String(art.mediaType||'image').toLowerCase();
    const makeCanvas=(img=null,label='')=>{const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');const paint=()=>{ctx.fillStyle=art.background||'#d8d0c2';ctx.fillRect(0,0,c.width,c.height);if(img){try{const iw=img.videoWidth||img.naturalWidth||img.width||1,ih=img.videoHeight||img.naturalHeight||img.height||1,scale=Math.min(c.width/iw,c.height/ih),w=iw*scale,h=ih*scale;ctx.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h)}catch{}}if(label){ctx.fillStyle='#ffffff';ctx.font='700 46px system-ui,sans-serif';ctx.textAlign='center';ctx.fillText(label,512,228);ctx.font='600 110px system-ui,sans-serif';ctx.fillText(type==='youtube'?'▶':(type==='audio'||type==='music'?'♫':'LED'),512,335)}if(art.text){ctx.fillStyle=art.textColor||'#111111';ctx.font='700 74px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const words=String(art.text).split(/\s+/),lines=[];let line='';for(const word of words){const test=(line+' '+word).trim();if(ctx.measureText(test).width>900&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);lines.slice(0,4).forEach((ln,i)=>ctx.fillText(ln,512,256+(i-(Math.min(lines.length,4)-1)/2)*88))}};paint();return {c,ctx,paint}};
    const useTexture=(tex)=>{if(mat.userData?.surfaceArtTexture)mat.userData.surfaceArtTexture.dispose?.();mat.map=tex;mat.userData.surfaceArtTexture=tex;mat.color.set(0xffffff);mat.needsUpdate=true};
    const fallback=label=>{const {c}=makeCanvas(null,label);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;useTexture(tex)};
    const src=art.mediaDataUrl||art.mediaUrl||art.imageDataUrl||'';
    if(type==='video'&&src){const video=document.createElement('video');video.src=src;video.loop=art.loop!==false;video.muted=art.muted!==false;video.playsInline=true;video.crossOrigin='anonymous';video.preload='metadata';video.volume=Math.max(0,Math.min(1,Number(art.volume)||0));mesh.userData.surfaceMediaElement=video;const tex=new THREE.VideoTexture(video);tex.colorSpace=THREE.SRGBColorSpace;useTexture(tex);if(art.autoplay)video.play().catch(()=>{})}
    else if((type==='audio'||type==='music')&&src){const audio=document.createElement('audio');audio.src=src;audio.loop=art.loop!==false;audio.preload='metadata';audio.volume=Math.max(0,Math.min(1,Number(art.volume)||0));mesh.userData.surfaceMediaElement=audio;fallback(type==='music'?'MUSIC':'AUDIO');if(art.autoplay)audio.play().catch(()=>{})}
    else if(type==='youtube'){
      const id=String(art.youtubeId||'').trim();
      if(id){const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const data=makeCanvas(img);const ctx=data.ctx;ctx.save();ctx.fillStyle='rgba(0,0,0,.58)';ctx.beginPath();ctx.arc(512,256,78,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(490,210);ctx.lineTo(490,302);ctx.lineTo(565,256);ctx.closePath();ctx.fill();ctx.restore();data.paint=()=>{};const tex=new THREE.CanvasTexture(data.c);tex.colorSpace=THREE.SRGBColorSpace;useTexture(tex);mesh.userData.youtubeId=id;mesh.userData.youtubeUrl=art.mediaUrl||''};img.onerror=()=>fallback(`YouTube  ${id}`);img.src=`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
      else fallback('YouTube');
      this.ensureYoutubeWallOverlay(mesh,art);
    }
    else if(type==='vimeo'||type==='embed'){fallback(type==='vimeo'?'VIMEO ▶':'WEB VIDEO ▶');this.ensureYoutubeWallOverlay(mesh,art)}
    else if(type==='gif'&&src){const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const data=makeCanvas(img);const tex=new THREE.CanvasTexture(data.c);tex.colorSpace=THREE.SRGBColorSpace;useTexture(tex);const dyn={active:true,img,paint:data.paint,tex,last:0};mesh.userData.surfaceDynamic=dyn;if(!this._surfaceDynamicHook){this._surfaceDynamicHook=true;this.addLoopHook(now=>{this.root.traverse(o=>{const d=o.userData?.surfaceDynamic;if(d?.active&&now-d.last>40){d.last=now;try{d.paint();d.tex.needsUpdate=true}catch{d.active=false}}})})}};img.onerror=()=>fallback('GIF');img.src=src}
    else if((type==='image'||type==='led')&&src){const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{const {c}=makeCanvas(img);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;useTexture(tex)};img.onerror=()=>fallback(type==='led'?'LED':'IMAGE');img.src=src}
    else fallback(type==='led'?'LED DISPLAY':'');
    if(type==='led'){mat.emissive?.set?.(0xffffff);mat.emissiveIntensity=Math.max(.2,Number(art.lightIntensity)||1.5)}
    const lightMode=String(art.lightMode||'none'),intensity=Math.max(0,Number(art.lightIntensity)||0),color=new THREE.Color(art.lightColor||'#fff1c4');
    if(lightMode!=='none'&&intensity>0){const rig=new THREE.Group();rig.name='SurfaceMediaLightRig';rig.userData.surfaceLightRig=true;const w=Math.max(100,Number(part.params?.width)||1000),h=Math.max(100,Number(part.params?.height)||1000),d=Math.max(10,Number(part.params?.depth)||100);const z=d/2+Math.max(40,d*.25);
      if(lightMode==='backlight'||lightMode==='neon'){mat.emissive?.set?.(color);mat.emissiveIntensity=Math.max(mat.emissiveIntensity||0,intensity*(lightMode==='neon'?.9:.45));for(const x of [-w*.42,w*.42])for(const y of [-h*.35,h*.35]){const l=new THREE.PointLight(color,intensity*.65,Math.max(w,h)*1.5,2);l.position.set(x,y,-z);rig.add(l)}}
      else if(lightMode==='spot'){for(const x of [-w*.3,w*.3]){const l=new THREE.SpotLight(color,intensity,Math.max(w,h)*2,Math.PI/5,.35,1.5);l.position.set(x,h*.65,z*2);const t=new THREE.Object3D();t.position.set(x,0,0);rig.add(t);l.target=t;rig.add(l)}}
      else if(lightMode==='flood'){const l=new THREE.PointLight(color,intensity,Math.max(w,h)*2.5,1.3);l.position.set(0,h*.15,z*2);rig.add(l)}mesh.add(rig)}
  }
  sync(part){
    // CAD座標: X/Y=水平面、Z=高さ。Three.js の X/Z/Y へ写像する。
    part.mesh.position.set(part.position[0],part.position[2],part.position[1]);
    const r=part.rotation.map(THREE.MathUtils.degToRad);
    part.mesh.rotation.set(r[0],r[2],-r[1],"XYZ");
    part.mesh.scale.set(part.scale[0],part.scale[2],part.scale[1]);
    part.mesh.visible=part.visible!==false&&!(part.metadata&&part.metadata.heldBy);
    part.mesh.material.transparent=part.opacity<.999;
    part.mesh.material.opacity=part.opacity;
    if(part.color!=null)part.mesh.material.color.set(part.color);
    this.applySurfaceArt(part);
    part.mesh.updateMatrixWorld(true);
  }

  remove(part){
    if(!part?.mesh)return;
    this.removeYoutubeWallOverlay(part.mesh);
    this.disposeObject3D(part.mesh);
    part.mesh=null;
    part.edge=null;
    part.datumGroup=null;
  }

  updatePointer(event){
    const r=this.canvas.getBoundingClientRect();
    this.pointer.x=((event.clientX-r.left)/r.width)*2-1;
    this.pointer.y=-((event.clientY-r.top)/r.height)*2+1;
    this.raycaster.setFromCamera(this.pointer,this.camera);
  }

  pickIntersection(event){
    this.updatePointer(event);
    return this.raycaster.intersectObjects(this.root.children,false)[0]||null;
  }

  pick(event){
    return this.pickIntersection(event)?.object?.userData?.partId||null;
  }

  worldToScreen(world){
    const projected=world.clone().project(this.camera);
    const rect=this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      rect.left+(projected.x+1)*rect.width/2,
      rect.top+(1-projected.y)*rect.height/2
    );
  }

  fit(parts){
    if(!parts.length)return;
    const box=new THREE.Box3();
    parts.forEach(p=>box.expandByObject(p.mesh));
    const size=box.getSize(new THREE.Vector3());
    const center=box.getCenter(new THREE.Vector3());
    const radius=Math.max(size.x,size.y,size.z)*.9+20;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(radius,radius*.75,radius));
    this.camera.near=Math.max(.01,radius/1000);
    this.camera.far=radius*100;
    this.camera.updateProjectionMatrix();
  }

  addLoopHook(fn){if(typeof fn==="function")this.loopHooks.push(fn);return ()=>{this.loopHooks=this.loopHooks.filter(x=>x!==fn)}}

  loop(){
    if(this._animationLoopStarted)return;
    this._animationLoopStarted=true;
    // setAnimationLoop works on normal screens and is required by WebXR immersive sessions.
    this.renderer.setAnimationLoop(()=>{
      this.controls.update();
      const now=performance.now();
      for(const hook of this.loopHooks){try{hook(now)}catch(error){console.warn("Scene loop hook failed",error)}}
      this.renderer.render(this.scene,this.camera);
    });
  }
}
