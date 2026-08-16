
import * as THREE from "three";

const ROUND=1e-5;

function rounded(value){
  return Math.round(value/ROUND)*ROUND;
}

function vertexKey(v){
  return `${rounded(v.x)},${rounded(v.y)},${rounded(v.z)}`;
}

function edgeKey(a,b){
  const ka=vertexKey(a),kb=vertexKey(b);
  return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;
}

function triangleIndices(geometry,faceIndex){
  const index=geometry.index;
  const base=faceIndex*3;
  return index
    ? [index.getX(base),index.getX(base+1),index.getX(base+2)]
    : [base,base+1,base+2];
}

function localVertex(geometry,index){
  return new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,index);
}

function normalKey(normal){
  const n=normal.clone().normalize();
  return `${rounded(n.x)},${rounded(n.y)},${rounded(n.z)}`;
}

function planeOffset(normal,point){
  return rounded(normal.dot(point));
}

export function buildTopology(mesh){
  const geometry=mesh.geometry;
  const position=geometry.attributes.position;
  const triangleCount=(geometry.index?geometry.index.count:position.count)/3;

  const triangles=[];
  const edgeMap=new Map();

  for(let faceIndex=0;faceIndex<triangleCount;faceIndex++){
    const ids=triangleIndices(geometry,faceIndex);
    const vertices=ids.map(id=>localVertex(geometry,id));
    const [a,b,c]=vertices;
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const area=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
    const planeKey=`${normalKey(normal)}|${planeOffset(normal,a)}`;

    const triangle={
      faceIndex,
      ids,
      vertices,
      normal,
      area,
      planeKey
    };
    triangles.push(triangle);

    const pairs=[[0,1],[1,2],[2,0]];
    for(const [i,j] of pairs){
      const va=vertices[i],vb=vertices[j];
      const key=edgeKey(va,vb);
      if(!edgeMap.has(key)){
        edgeMap.set(key,{
          key,
          a:va.clone(),
          b:vb.clone(),
          triangleIndices:[]
        });
      }
      edgeMap.get(key).triangleIndices.push(faceIndex);
    }
  }

  const faceGroups=new Map();
  for(const triangle of triangles){
    if(!faceGroups.has(triangle.planeKey)){
      faceGroups.set(triangle.planeKey,{
        id:`face-${faceGroups.size}`,
        planeKey:triangle.planeKey,
        normal:triangle.normal.clone(),
        triangleIndices:[],
        area:0,
        boundaryEdges:[]
      });
    }
    const group=faceGroups.get(triangle.planeKey);
    group.triangleIndices.push(triangle.faceIndex);
    group.area+=triangle.area;
  }

  const triangleToFace=new Map();
  for(const face of faceGroups.values()){
    face.triangleIndices.forEach(index=>triangleToFace.set(index,face.id));
  }

  const edges=[];
  for(const edge of edgeMap.values()){
    const adjacentFaces=[
      ...new Set(
        edge.triangleIndices
          .map(index=>triangleToFace.get(index))
          .filter(Boolean)
      )
    ];

    // Internal triangulation edges inside one coplanar face are hidden.
    if(adjacentFaces.length===1 && edge.triangleIndices.length===2)continue;

    const record={
      id:`edge-${edges.length}`,
      key:edge.key,
      a:edge.a,
      b:edge.b,
      length:edge.a.distanceTo(edge.b),
      adjacentFaces
    };
    edges.push(record);

    adjacentFaces.forEach(faceId=>{
      const face=[...faceGroups.values()].find(item=>item.id===faceId);
      if(face)face.boundaryEdges.push(record.id);
    });
  }

  const vertices=[];
  const vertexMap=new Map();
  for(const edge of edges){
    for(const vertex of [edge.a,edge.b]){
      const key=vertexKey(vertex);
      if(!vertexMap.has(key)){
        const record={
          id:`vertex-${vertices.length}`,
          key,
          position:vertex.clone(),
          connectedEdges:[]
        };
        vertexMap.set(key,record);
        vertices.push(record);
      }
      vertexMap.get(key).connectedEdges.push(edge.id);
    }
  }

  return {
    triangles,
    faces:[...faceGroups.values()],
    edges,
    vertices,
    triangleToFace
  };
}

export function faceByTriangle(topology,faceIndex){
  const id=topology.triangleToFace.get(faceIndex);
  return topology.faces.find(face=>face.id===id)||null;
}
