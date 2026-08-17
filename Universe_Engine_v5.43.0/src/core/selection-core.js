
import * as THREE from "three";
import {buildTopology,faceByTriangle} from "../cad/topology.js";

function distancePointSegment2D(point,a,b){
  const ab=b.clone().sub(a);
  const length2=ab.lengthSq();
  const t=length2>1e-12
    ? THREE.MathUtils.clamp(point.clone().sub(a).dot(ab)/length2,0,1)
    : 0;
  const closest=a.clone().addScaledVector(ab,t);
  return {
    distance:point.distanceTo(closest),
    closest
  };
}

export class GeometrySelectionController {
  constructor(state,scene,onChange){
    this.state=state;
    this.scene=scene;
    this.onChange=onChange;
    this.overlayRoot=new THREE.Group();
    this.overlayRoot.name="Topology Selection Overlays";
    this.scene.scene.add(this.overlayRoot);
  }

  ensureTopology(part){
    const geometryId=part.mesh.geometry.uuid;
    if(!part.topology||part.topologyGeometryId!==geometryId){
      part.topology=buildTopology(part.mesh);
      part.topologyGeometryId=geometryId;
    }
    return part.topology;
  }

  invalidate(part){
    if(!part)return;
    part.topology=null;
    part.topologyGeometryId=null;
  }

  setMode(mode){
    if(!["body","face","edge","vertex"].includes(mode))return;
    this.state.selectionMode=mode;
    this.clear();
    this.onChange();
  }

  clear(){
    this.state.clearSubSelection();
    this.clearOverlays();
  }

  clearOverlays(){
    while(this.overlayRoot.children.length){
      const child=this.overlayRoot.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  recordKey(record){
    return `${record.partId}:${record.mode}:${record.id}`;
  }

  pick(event,additive=false){
    const hit=this.scene.pickIntersection(event);
    if(!hit){
      if(!additive)this.clear();
      this.onChange();
      return null;
    }

    const part=this.state.object(hit.object.userData.partId);
    if(!part)return null;

    if(this.state.selectionMode==="body"){
      return {mode:"body",partId:part.id};
    }

    const topology=this.ensureTopology(part);
    let record=null;

    if(this.state.selectionMode==="face"){
      record=this.pickFace(part,topology,hit);
    }else if(this.state.selectionMode==="edge"){
      record=this.pickEdge(part,topology,event);
    }else if(this.state.selectionMode==="vertex"){
      record=this.pickVertex(part,topology,event);
    }

    if(!record)return null;

    if(!additive)this.state.subSelections=[];
    const key=this.recordKey(record);
    const index=this.state.subSelections.findIndex(item=>this.recordKey(item)===key);

    if(additive&&index>=0){
      this.state.subSelections.splice(index,1);
    }else{
      this.state.subSelections.push(record);
    }

    this.rebuildOverlays();
    this.onChange();
    return record;
  }

  pickFace(part,topology,hit){
    const face=faceByTriangle(topology,hit.faceIndex);
    if(!face)return null;

    return {
      mode:"face",
      partId:part.id,
      id:face.id,
      triangleIndices:[...face.triangleIndices],
      area:face.area,
      normal:face.normal.toArray(),
      boundaryEdges:[...face.boundaryEdges]
    };
  }

  pickEdge(part,topology,event){
    const pointer=new THREE.Vector2(event.clientX,event.clientY);
    let best=null;

    for(const edge of topology.edges){
      const worldA=part.mesh.localToWorld(edge.a.clone());
      const worldB=part.mesh.localToWorld(edge.b.clone());
      const screenA=this.scene.worldToScreen(worldA);
      const screenB=this.scene.worldToScreen(worldB);
      const result=distancePointSegment2D(pointer,screenA,screenB);

      if(!best||result.distance<best.distance){
        best={edge,distance:result.distance,worldA,worldB};
      }
    }

    if(!best||best.distance>18)return null;

    return {
      mode:"edge",
      partId:part.id,
      id:best.edge.id,
      localA:best.edge.a.toArray(),
      localB:best.edge.b.toArray(),
      worldA:best.worldA.toArray(),
      worldB:best.worldB.toArray(),
      length:best.edge.length,
      adjacentFaces:[...best.edge.adjacentFaces]
    };
  }

  pickVertex(part,topology,event){
    const pointer=new THREE.Vector2(event.clientX,event.clientY);
    let best=null;

    for(const vertex of topology.vertices){
      const world=part.mesh.localToWorld(vertex.position.clone());
      const screen=this.scene.worldToScreen(world);
      const distance=screen.distanceTo(pointer);

      if(!best||distance<best.distance){
        best={vertex,world,distance};
      }
    }

    if(!best||best.distance>20)return null;

    return {
      mode:"vertex",
      partId:part.id,
      id:best.vertex.id,
      local:best.vertex.position.toArray(),
      world:best.world.toArray(),
      connectedEdges:[...best.vertex.connectedEdges]
    };
  }

  rebuildOverlays(){
    this.clearOverlays();

    for(const record of this.state.subSelections){
      const part=this.state.object(record.partId);
      if(!part)continue;

      if(record.mode==="face"){
        this.addFaceOverlay(part,record);
      }else if(record.mode==="edge"){
        this.addEdgeOverlay(part,record);
      }else if(record.mode==="vertex"){
        this.addVertexOverlay(record);
      }
    }
  }

  addFaceOverlay(part,record){
    const topology=this.ensureTopology(part);
    const position=part.mesh.geometry.attributes.position;
    const index=part.mesh.geometry.index;
    const vertices=[];

    for(const faceIndex of record.triangleIndices){
      const base=faceIndex*3;
      const ids=index
        ? [index.getX(base),index.getX(base+1),index.getX(base+2)]
        : [base,base+1,base+2];

      ids.forEach(id=>{
        const v=new THREE.Vector3().fromBufferAttribute(position,id);
        vertices.push(v.x,v.y,v.z);
      });
    }

    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices,3)
    );
    geometry.computeVertexNormals();

    const material=new THREE.MeshBasicMaterial({
      color:0x35a9ff,
      transparent:true,
      opacity:.42,
      side:THREE.DoubleSide,
      depthTest:false
    });

    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.copy(part.mesh.position);
    mesh.rotation.copy(part.mesh.rotation);
    mesh.scale.copy(part.mesh.scale);
    mesh.renderOrder=100;
    this.overlayRoot.add(mesh);
  }

  addEdgeOverlay(part,record){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...record.localA,...record.localB],
        3
      )
    );

    const material=new THREE.LineBasicMaterial({
      color:0xffc34d,
      depthTest:false
    });

    const line=new THREE.LineSegments(geometry,material);
    line.position.copy(part.mesh.position);
    line.rotation.copy(part.mesh.rotation);
    line.scale.copy(part.mesh.scale);
    line.renderOrder=101;
    this.overlayRoot.add(line);

    // Add endpoint markers so the selected topological edge is obvious.
    for(const local of [record.localA,record.localB]){
      const marker=new THREE.Mesh(
        new THREE.SphereGeometry(1.2,14,10),
        new THREE.MeshBasicMaterial({
          color:0xffd979,
          depthTest:false
        })
      );
      marker.position.fromArray(local);
      marker.renderOrder=102;
      line.add(marker);
    }
  }

  addVertexOverlay(record){
    const marker=new THREE.Mesh(
      new THREE.SphereGeometry(2,18,12),
      new THREE.MeshBasicMaterial({
        color:0xff5e6d,
        depthTest:false
      })
    );
    marker.position.fromArray(record.world);
    marker.renderOrder=103;
    this.overlayRoot.add(marker);
  }

  summary(){
    const items=this.state.selectedSubElements();

    if(!items.length){
      return {
        mode:this.state.selectionMode,
        count:0,
        text:"要素未選択"
      };
    }

    if(this.state.selectionMode==="face"){
      return {
        mode:"face",
        count:items.length,
        area:items.reduce((sum,item)=>sum+Number(item.area||0),0),
        boundaryEdges:[
          ...new Set(items.flatMap(item=>item.boundaryEdges||[]))
        ].length
      };
    }

    if(this.state.selectionMode==="edge"){
      return {
        mode:"edge",
        count:items.length,
        length:items.reduce((sum,item)=>sum+Number(item.length||0),0),
        adjacentFaces:[
          ...new Set(items.flatMap(item=>item.adjacentFaces||[]))
        ].length
      };
    }

    if(this.state.selectionMode==="vertex"){
      return {
        mode:"vertex",
        count:items.length,
        points:items.map(item=>item.world),
        connectedEdges:[
          ...new Set(items.flatMap(item=>item.connectedEdges||[]))
        ].length
      };
    }

    return {
      mode:"body",
      count:this.state.selectedIds.length
    };
  }
}
