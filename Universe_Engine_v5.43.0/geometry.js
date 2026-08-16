
import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";

function boxGeometry(params,features=[]){
  const enabled=features.filter(f=>f.enabled!==false);
  const globalFillet=[...enabled].reverse().find(f=>f.type==="Fillet"&&f.parameters?.allEdges);
  const globalChamfer=[...enabled].reverse().find(f=>f.type==="Chamfer"&&f.parameters?.allEdges);
  const explicitPartial=enabled.some(f=>["Fillet","Chamfer"].includes(f.type)&&!f.parameters?.allEdges&&(f.parameters?.edgeIds?.length||0)>0);
  const defaultChamfer=[...enabled].reverse().find(f=>f.type==="DefaultChamfer"&&f.parameters?.enabled);

  if(globalFillet){
    const max=Math.min(params.width,params.height,params.depth)/2-.001;
    const radius=Math.max(.001,Math.min(max,Number(globalFillet.parameters.size)||.001));
    return new RoundedBoxGeometry(params.width,params.height,params.depth,8,radius);
  }

  const activeChamfer=globalChamfer||(!explicitPartial?defaultChamfer:null);
  if(activeChamfer){
    const max=Math.min(params.width,params.height,params.depth)/2-.001;
    const bevel=Math.max(.001,Math.min(max,Number(activeChamfer.parameters.size)||.001));
    const shape=new THREE.Shape();
    const w=params.width/2,h=params.height/2;
    shape.moveTo(-w+bevel,-h);
    shape.lineTo(w-bevel,-h);shape.lineTo(w,-h+bevel);
    shape.lineTo(w,h-bevel);shape.lineTo(w-bevel,h);
    shape.lineTo(-w+bevel,h);shape.lineTo(-w,h-bevel);
    shape.lineTo(-w,-h+bevel);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{
      depth:Math.max(.001,params.depth-2*bevel),
      bevelEnabled:true,
      bevelThickness:bevel,
      bevelSize:bevel,
      bevelSegments:1,
      steps:1,
      curveSegments:1
    });
    geometry.center();
    // ExtrudeGeometry uses Z depth, matching our box depth.
    return geometry;
  }

  return new THREE.BoxGeometry(Math.max(.1,params.width),Math.max(.1,params.height),Math.max(.1,params.depth),1,1,1);
}

function extrusionGeometry(p){
  let shape;
  if(p.profileType==="circle"){
    shape=new THREE.Shape();
    shape.absarc(0,0,Math.max(.001,p.radius),0,Math.PI*2,false);
  }else if(p.profileType==="polygon"&&Array.isArray(p.points)&&p.points.length>=3){
    shape=new THREE.Shape();
    const center=p.profileCenter||{x:0,y:0};
    const first=p.points[0];
    shape.moveTo(first.x-center.x,first.y-center.y);
    for(let i=1;i<p.points.length;i++){
      shape.lineTo(
        p.points[i].x-center.x,
        p.points[i].y-center.y
      );
    }
    shape.closePath();

    for(const hole of p.holes||[]){
      if(hole.type==="circle"){
        const path=new THREE.Path();
        path.absarc(
          hole.center.x-center.x,
          hole.center.y-center.y,
          Math.max(.001,hole.radius),
          0,
          Math.PI*2,
          true
        );
        shape.holes.push(path);
      }else if(Array.isArray(hole.points)&&hole.points.length>=3){
        const path=new THREE.Path();
        path.moveTo(
          hole.points[0].x-center.x,
          hole.points[0].y-center.y
        );
        for(let i=1;i<hole.points.length;i++){
          path.lineTo(
            hole.points[i].x-center.x,
            hole.points[i].y-center.y
          );
        }
        path.closePath();
        shape.holes.push(path);
      }
    }
  }else{
    const w=Math.max(.001,p.width)/2,h=Math.max(.001,p.profileHeight)/2;
    shape=new THREE.Shape();
    shape.moveTo(-w,-h);shape.lineTo(w,-h);shape.lineTo(w,h);shape.lineTo(-w,h);shape.closePath();
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.001,p.distance),bevelEnabled:false,steps:1,curveSegments:96});
  geometry.center();
  if(p.plane==="XZ")geometry.rotateX(Math.PI/2);
  else if(p.plane==="YZ")geometry.rotateY(Math.PI/2);
  return geometry;
}


function revolutionGeometry(p){
  const points=(p.points||[]).map(q=>new THREE.Vector2(Math.max(.001,Math.abs(p.axis==="X"?q.y:q.x)),p.axis==="X"?q.x:q.y));
  if(points.length<2)points.push(new THREE.Vector2(10,-10),new THREE.Vector2(10,10));
  const angle=THREE.MathUtils.degToRad(Math.max(.1,Math.min(360,Number(p.angle)||360)));
  const g=new THREE.LatheGeometry(points,Math.max(3,Number(p.segments)||96),0,angle);
  if(p.plane==="XY")g.rotateX(Math.PI/2);
  else if(p.plane==="YZ")g.rotateZ(Math.PI/2);
  return g;
}

export function createGeometry(type,p,features=[]){
  if(type==="mesh"){
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(p.positions||[],3));
    if(Array.isArray(p.normals)&&p.normals.length===(p.positions||[]).length)g.setAttribute("normal",new THREE.Float32BufferAttribute(p.normals,3));
    else g.computeVertexNormals();
    g.computeBoundingBox();g.computeBoundingSphere();
    return g;
  }
  if(type==="extrusion")return extrusionGeometry(p);
  if(type==="revolution")return revolutionGeometry(p);
  if(type==="box")return boxGeometry(p,features);
  if(type==="cylinder")return new THREE.CylinderGeometry(Math.max(.1,p.radius),Math.max(.1,p.radius),Math.max(.1,p.height),96);
  return new THREE.SphereGeometry(Math.max(.1,p.radius),64,40);
}
export function defaults(type){
  if(type==="mesh")return {positions:[],normals:[]};
  if(type==="revolution")return {points:[{x:10,y:-10},{x:20,y:-10},{x:20,y:10},{x:10,y:10}],axis:"Y",angle:360,segments:96,plane:"XY"};
  if(type==="extrusion")return {profileType:"rectangle",width:40,profileHeight:30,radius:15,distance:20,plane:"XY"};
  if(type==="box")return {width:80,height:40,depth:60};
  if(type==="cylinder")return {radius:20,height:60};
  return {radius:25};
}
