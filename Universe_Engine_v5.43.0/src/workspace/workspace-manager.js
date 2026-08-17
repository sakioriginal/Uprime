import * as THREE from 'three';

const PRESETS={
  studio:{label:'Design Studio',bg:0x0c1218,floor:0x28323b,accent:0x516778,items:[['workbench',[0,0,42],[180,90,8]],['chair',[0,-78,25],[45,45,50]],['computerDesk',[220,75,36],[130,65,6]],['monitor',[220,82,75],[52,6,32]],['chair',[220,25,25],[42,42,50]],['shelf',[-150,100,70],[40,20,140]]]},
  woodshop:{label:'木の工房',bg:0x17120d,floor:0x493625,accent:0x8a6845,items:[['workbench',[0,0,45],[170,85,8]],['timberRack',[-135,90,80],[35,25,160]],['toolboard',[0,100,95],[170,6,90]],['stool',[90,-50,24],[35,35,48]]]},
  metalshop:{label:'鉄工所',bg:0x11161a,floor:0x33383c,accent:0x5f7078,items:[['steelBench',[0,0,42],[180,90,8]],['machine',[130,80,55],[70,60,110]],['cabinet',[-135,75,60],[55,40,120]]]},
  factory:{label:'工場',bg:0x101416,floor:0x333637,accent:0x70777a,items:[['line',[0,70,35],[300,55,12]],['machine',[-120,-30,60],[75,65,120]],['machine',[120,-30,60],[75,65,120]],['rack',[0,-120,80],[220,35,160]]]},
  office:{label:'オフィス',bg:0x13171d,floor:0x3a3d43,accent:0x707781,items:[['workbench',[0,0,40],[170,80,7]],['chair',[0,-70,25],[45,45,50]],['computerDesk',[210,70,38],[140,70,6]],['monitor',[210,78,78],[55,6,34]],['chair',[210,18,25],[45,45,50]],['cabinet',[-145,90,65],[45,35,130]]]},
  library:{label:'図書館',bg:0x16120f,floor:0x43352c,accent:0x705945,items:[['table',[0,0,38],[160,80,6]],['chair',[0,-70,25],[45,45,50]],['bookshelf',[-150,90,90],[35,25,180]],['bookshelf',[150,90,90],[35,25,180]]]},
  mountain:{label:'山の中',bg:0x101713,floor:0x314235,accent:0x55705a,items:[['cabinDesk',[0,0,40],[150,75,8]],['chair',[0,-65,25],[45,45,50]],['shelf',[-130,85,70],[45,25,140]]]},
  beach:{label:'海岸の家',bg:0x101d28,floor:0x806f56,accent:0x6aa4bb,items:[['desk',[0,0,40],[150,75,7]],['chair',[0,-65,25],[45,45,50]],['shelf',[-130,85,70],[45,25,140]]]},
  spaceship:{label:'宇宙船',bg:0x070b12,floor:0x222b38,accent:0x375772,items:[['console',[0,50,55],[190,45,65]],['table',[0,-40,40],[130,70,6]],['seat',[0,-105,28],[45,45,56]],['locker',[-150,65,85],[45,35,170]]]},
};
export class WorkspaceManager{
  constructor(state,scene){this.state=state;this.scene=scene;this.group=new THREE.Group();this.group.name='workspace-environment';scene.scene.add(this.group);this.workOriginMarker=new THREE.Group();this.workOriginMarker.name='workspace-work-origin';scene.scene.add(this.workOriginMarker);this.apply(state.workspace?.preset||'studio')}
  static presets(){return PRESETS}
  static designScales(){return {'1:1':1,'1:10':10,'1:20':20,'1:50':50,'1:100':100,'1:500':500,'1:1000':1000}}
  setDesignScale(value='1:1'){const scales=WorkspaceManager.designScales(),ratio=scales[value]||Math.max(1,Number(String(value).split(':').at(-1))||1);this.state.workspace.designScale=value;this.state.workspace.unitScaleMm=10*ratio;this.updateWorkOrigin();return ratio}
  clear(){while(this.group.children.length){const o=this.group.children.pop();o.traverse?.(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m?.dispose?.());else c.material?.dispose?.()})}this.scene.workspaceColliders=[];this.scene.workspacePlacementSurfaces=[]}
  box(size,pos,color,{collider=true,surface=false,name='workspace'}={}){const g=new THREE.BoxGeometry(size[0],size[2],size[1]);const m=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.08});const o=new THREE.Mesh(g,m);o.position.set(pos[0],pos[2],pos[1]);o.userData.workspaceEnvironment=true;o.userData.workspaceName=name;this.group.add(o);if(collider)this.scene.workspaceColliders.push(o);if(surface)this.scene.workspacePlacementSurfaces.push(o);return o}
  furniture(kind,pos,size,color){
    const [x,y,z]=pos,[w,d,h]=size;const topKinds=new Set(['desk','workbench','steelBench','table','cabinDesk','computerDesk']);
    if(topKinds.has(kind)){
      const top=this.box([w,d,Math.max(4,h)],[x,y,z],color,{surface:true,name:kind});if(!this.primaryWorkSurface && kind!=='computerDesk')this.primaryWorkSurface={kind,x,y,z,w,d,h:Math.max(4,h),mesh:top};const legH=z-Math.max(4,h)/2,leg=5;for(const sx of [-1,1])for(const sy of [-1,1])this.box([leg,leg,Math.max(1,legH)],[x+sx*(w/2-10),y+sy*(d/2-10),legH/2],0x687985,{name:`${kind}-leg`});return;
    }
    if(kind==='chair'||kind==='stool'||kind==='seat'){this.box([w,d,5],[x,y,z],color,{surface:true,name:kind});this.box([w,5,h*.55],[x,y-d/2+3,z+h*.28],color,{name:`${kind}-back`});for(const sx of [-1,1])for(const sy of [-1,1])this.box([4,4,z],[x+sx*(w/2-6),y+sy*(d/2-6),z/2],0x637380,{name:`${kind}-leg`});return}
    if(kind==='monitor'){this.box([w,d,h],[x,y,z],0x17232c,{surface:false,name:kind});this.box([5,18,25],[x,y-4,z-h/2-12],0x617381,{name:'monitor-stand'});return}
    this.box(size,pos,color,{surface:kind==='line'||kind==='console',name:kind});
  }
  buildInteriorShell(color=0x34424d){
    // A lightweight building shell makes the workbench a place inside the world,
    // rather than a detached editor scene.  The front wall keeps a central exit.
    const W=700,D=700,H=260,t=8,doorW=95,doorH=190;
    this.box([W,t,H],[0,D/2-t/2,H/2],color,{name:'building-wall-back'});
    this.box([t,D,H],[-W/2+t/2,0,H/2],color,{name:'building-wall-left'});
    this.box([t,D,H],[W/2-t/2,0,H/2],color,{name:'building-wall-right'});
    this.box([(W-doorW)/2,t,H],[-(W+doorW)/4,-D/2+t/2,H/2],color,{name:'building-wall-front-left'});
    this.box([(W-doorW)/2,t,H],[(W+doorW)/4,-D/2+t/2,H/2],color,{name:'building-wall-front-right'});
    this.box([doorW,t,H-doorH],[0,-D/2+t/2,doorH+(H-doorH)/2],color,{name:'building-door-header'});
    const portal=new THREE.Mesh(new THREE.PlaneGeometry(doorW*.72,doorH*.82),new THREE.MeshBasicMaterial({color:0x58baf2,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));
    portal.position.set(0,doorH*.45,-D/2+1);portal.rotation.y=Math.PI;portal.name='WorldExitPortal';portal.userData.workspaceExit=true;this.group.add(portal);this.exitPortal=portal;
  }
  apply(key){const p=PRESETS[key]||PRESETS.studio;this.state.workspace={unitScaleMm:10,workOriginOffsetMm:100,designScale:'1:1',...(this.state.workspace||{}),preset:key};this.clear();this.primaryWorkSurface=null;this.scene.workspaceColliders=[];this.scene.workspacePlacementSurfaces=[];this.scene.scene.background=new THREE.Color(p.bg);this.scene.grid.material.color?.set?.(p.accent);this.box([700,700,8],[0,0,-4],p.floor,{surface:true,name:'floor'});this.buildInteriorShell(p.accent);for(const [kind,pos,size] of p.items)this.furniture(kind,pos,size,p.accent);this.updateWorkOrigin();return p}
  updateWorkOrigin(){const u=Math.max(1e-9,Number(this.state.workspace.unitScaleMm)||10),offset=(Number(this.state.workspace.workOriginOffsetMm)||100)/u,s=this.primaryWorkSurface;const origin=s?[s.x,s.y,s.z+s.h/2+offset]:[0,0,offset];this.state.workspace.workOrigin=[...origin];this.scene.setWorkCoordinateSystem?.({originCad:origin,unitScaleMm:u});while(this.workOriginMarker.children.length){const o=this.workOriginMarker.children.pop();o.geometry?.dispose?.();o.material?.dispose?.()}const mk=(a,b,c)=>{const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]),m=new THREE.LineBasicMaterial({color:c,depthTest:false});const l=new THREE.Line(g,m);l.renderOrder=95;this.workOriginMarker.add(l)};const L=12,world=new THREE.Vector3(origin[0],origin[2],origin[1]);this.workOriginMarker.position.copy(world);mk([0,0,0],[L,0,0],0xff5f68);mk([0,0,0],[0,0,L],0x56d98b);mk([0,0,0],[0,L,0],0x5aa8ff);const pt=new THREE.Mesh(new THREE.SphereGeometry(1.2,12,8),new THREE.MeshBasicMaterial({color:0xffe06a,depthTest:false}));this.workOriginMarker.add(pt);this.workOriginMarker.userData={workOrigin:true,offsetMm:Number(this.state.workspace.workOriginOffsetMm)||100};return origin}
}
