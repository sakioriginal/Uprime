
import * as THREE from "three";

function pointFromVertex(vertex){
  return new THREE.Vector3().fromArray(vertex.position);
}

function collinear(a,b,c,tolerance=1e-5){
  const ab=b.clone().sub(a);
  const ac=c.clone().sub(a);
  return ab.cross(ac).length()<tolerance;
}

export class EdgeKernel{
  constructor(state,scene,brepCore,featureTree,edgeVisualizer,onChange){
    this.state=state;
    this.scene=scene;
    this.brepCore=brepCore;
    this.featureTree=featureTree;
    this.edgeVisualizer=edgeVisualizer;
    this.onChange=onChange;
  }

  selectedEdgeRecord(){
    return this.state.subSelections.find(item=>item.mode==="edge")||null;
  }

  resolve(part,selectionRecord){
    if(!part||!selectionRecord)return null;

    const solid=this.brepCore.build(part);
    const localA=new THREE.Vector3().fromArray(selectionRecord.localA);
    const localB=new THREE.Vector3().fromArray(selectionRecord.localB);

    let best=null;

    for(const edge of solid.edges){
      const vA=solid.vertices.find(v=>v.id===edge.vertexIds[0]);
      const vB=solid.vertices.find(v=>v.id===edge.vertexIds[1]);
      if(!vA||!vB)continue;

      const a=pointFromVertex(vA);
      const b=pointFromVertex(vB);

      const direct=a.distanceTo(localA)+b.distanceTo(localB);
      const reverse=a.distanceTo(localB)+b.distanceTo(localA);
      const score=Math.min(direct,reverse);

      if(!best||score<best.score){
        best={edge,score};
      }
    }

    return best?.edge||null;
  }

  addFeature(part,selectionRecord,operation,options={}){
    const edge=this.resolve(part,selectionRecord);
    if(!edge)throw new Error("B-Rep Edgeを特定できません");

    const parameters={
      operation,
      edgeId:edge.id,
      sourceSelectionId:selectionRecord.id,
      size:Number(options.size||0),
      ratio:Number(options.ratio||.5),
      length:edge.length,
      curveType:edge.curveType,
      faceIds:[...edge.faceIds]
    };

    const feature=this.featureTree.add(part,"EdgeEdit",parameters);
    feature.name=`Edge ${operation}`;

    if(operation==="split"){
      this.splitEdge(part,edge,parameters.ratio);
      feature.parameters.resultMode="brep-topology";
    }else if(operation==="merge"){
      this.mergeCollinear(part,edge);
      feature.parameters.resultMode="brep-topology";
    }else if(operation==="suppress"||operation==="restore"){
      this.applyAttribute(part,edge,operation);
      feature.parameters.resultMode="brep-attribute";
    }else if(operation==="fillet"||operation==="chamfer"){
      this.registerBlendFeature(part,selectionRecord,operation,parameters.size);
      feature.parameters.resultMode="edge-feature";
    }

    feature.dirty=false;
    feature.status="ok";
    this.onChange();
    return feature;
  }

  splitEdge(part,edge,ratio){
    const solid=this.brepCore.build(part);
    const clamped=Math.max(.01,Math.min(.99,Number(ratio)||.5));

    const vertexA=solid.vertices.find(v=>v.id===edge.vertexIds[0]);
    const vertexB=solid.vertices.find(v=>v.id===edge.vertexIds[1]);
    if(!vertexA||!vertexB)throw new Error("Edge頂点が見つかりません");

    const a=pointFromVertex(vertexA);
    const b=pointFromVertex(vertexB);
    const middle=a.clone().lerp(b,clamped);

    const newVertex={
      id:`${part.id}:vertex:split:${Date.now()}`,
      type:"Vertex",
      position:middle.toArray(),
      edgeIds:[],
      faceIds:[...new Set(edge.faceIds)]
    };

    const first={
      ...structuredClone(edge),
      id:`${part.id}:edge:split:${Date.now()}:a`,
      vertexIds:[vertexA.id,newVertex.id],
      length:a.distanceTo(middle),
      halfEdgeIds:[]
    };

    const second={
      ...structuredClone(edge),
      id:`${part.id}:edge:split:${Date.now()}:b`,
      vertexIds:[newVertex.id,vertexB.id],
      length:middle.distanceTo(b),
      halfEdgeIds:[]
    };

    solid.vertices.push(newVertex);
    solid.edges=solid.edges.filter(item=>item.id!==edge.id);
    solid.edges.push(first,second);

    for(const face of solid.faces){
      const index=face.edgeIds.indexOf(edge.id);
      if(index>=0){
        face.edgeIds.splice(index,1,first.id,second.id);
      }
    }

    for(const loop of solid.loops){
      const index=loop.edgeIds.indexOf(edge.id);
      if(index>=0){
        loop.edgeIds.splice(index,1,first.id,second.id);
      }
    }

    part.brep=solid;
    return {newVertex,first,second};
  }

  mergeCollinear(part,edge){
    const solid=this.brepCore.build(part);
    const vertexMap=new Map(solid.vertices.map(v=>[v.id,v]));
    const candidates=[];

    for(const vertexId of edge.vertexIds){
      const vertex=vertexMap.get(vertexId);
      if(!vertex)continue;

      const connected=solid.edges.filter(
        candidate=>
          candidate.id!==edge.id &&
          candidate.vertexIds.includes(vertexId)
      );

      for(const candidate of connected){
        const shared=pointFromVertex(vertex);
        const edgeOtherId=edge.vertexIds.find(id=>id!==vertexId);
        const candidateOtherId=candidate.vertexIds.find(id=>id!==vertexId);

        const edgeOther=vertexMap.get(edgeOtherId);
        const candidateOther=vertexMap.get(candidateOtherId);
        if(!edgeOther||!candidateOther)continue;

        if(
          collinear(
            pointFromVertex(edgeOther),
            shared,
            pointFromVertex(candidateOther)
          )
        ){
          candidates.push({
            candidate,
            sharedVertexId:vertexId,
            edgeOtherId,
            candidateOtherId
          });
        }
      }
    }

    const target=candidates[0];
    if(!target)throw new Error("共線で接続するEdgeがありません");

    const start=vertexMap.get(target.edgeOtherId);
    const end=vertexMap.get(target.candidateOtherId);

    const merged={
      ...structuredClone(edge),
      id:`${part.id}:edge:merged:${Date.now()}`,
      vertexIds:[start.id,end.id],
      faceIds:[...new Set([
        ...edge.faceIds,
        ...target.candidate.faceIds
      ])],
      length:pointFromVertex(start).distanceTo(pointFromVertex(end)),
      halfEdgeIds:[]
    };

    solid.edges=solid.edges.filter(
      item=>
        item.id!==edge.id &&
        item.id!==target.candidate.id
    );
    solid.edges.push(merged);

    for(const face of solid.faces){
      const next=[];
      for(const edgeId of face.edgeIds){
        if(edgeId===edge.id||edgeId===target.candidate.id){
          if(!next.includes(merged.id))next.push(merged.id);
        }else{
          next.push(edgeId);
        }
      }
      face.edgeIds=next;
    }

    for(const loop of solid.loops){
      const next=[];
      for(const edgeId of loop.edgeIds){
        if(edgeId===edge.id||edgeId===target.candidate.id){
          if(!next.includes(merged.id))next.push(merged.id);
        }else{
          next.push(edgeId);
        }
      }
      loop.edgeIds=next;
    }

    solid.vertices=solid.vertices.filter(
      vertex=>vertex.id!==target.sharedVertexId
    );

    part.brep=solid;
    return merged;
  }

  applyAttribute(part,edge,operation){
    const solid=this.brepCore.build(part);
    const target=solid.edges.find(item=>item.id===edge.id);
    if(!target)return;

    target.attributes=target.attributes||{};
    target.attributes.suppressed=operation==="suppress";
    part.brep=solid;
  }

  registerBlendFeature(part,selectionRecord,operation,size){
    const type=operation==="fillet"?"Fillet":"Chamfer";

    const feature=this.featureTree.add(part,type,{
      size:Math.max(.001,Number(size)||.001),
      method:"constant",
      allEdges:false,
      edgeIds:[selectionRecord.id],
      edges:[{
        id:selectionRecord.id,
        localA:[...selectionRecord.localA],
        localB:[...selectionRecord.localB],
        length:selectionRecord.length,
        adjacentFaces:[...(selectionRecord.adjacentFaces||[])]
      }]
    });

    feature.name=`${type} ${part.features.filter(f=>f.type===type).length}`;
    feature.dirty=false;
    feature.status="preview";
    this.edgeVisualizer?.rebuild?.(part);
    return feature;
  }

  diagnose(part){
    const solid=this.brepCore.build(part);
    const issues=[];

    for(const edge of solid.edges){
      if(edge.length<1e-8){
        issues.push({
          severity:"error",
          type:"zero-length",
          id:edge.id,
          message:`ゼロ長Edge: ${edge.id}`
        });
      }

      if(edge.faceIds.length===0){
        issues.push({
          severity:"warning",
          type:"orphan-edge",
          id:edge.id,
          message:`Face未接続: ${edge.id}`
        });
      }

      if(edge.faceIds.length>2){
        issues.push({
          severity:"error",
          type:"non-manifold",
          id:edge.id,
          message:`非多様体Edge: ${edge.id}`
        });
      }
    }

    const signatures=new Map();

    for(const edge of solid.edges){
      const key=[...edge.vertexIds].sort().join("|");
      if(!signatures.has(key))signatures.set(key,[]);
      signatures.get(key).push(edge);
    }

    for(const group of signatures.values()){
      if(group.length>1){
        issues.push({
          severity:"warning",
          type:"duplicate-edge",
          id:group.map(edge=>edge.id).join(","),
          message:`重複Edge: ${group.length}`
        });
      }
    }

    if(!issues.length){
      issues.push({
        severity:"ok",
        type:"valid",
        id:solid.solidId,
        message:"Edgeトポロジに重大な問題はありません"
      });
    }

    return issues;
  }

  tangentChain(part,edge){
    const solid=this.brepCore.build(part);
    const result=[edge.id];
    const queue=[edge];
    const visited=new Set(result);
    const vertexMap=new Map(solid.vertices.map(v=>[v.id,v]));

    while(queue.length){
      const current=queue.shift();

      for(const vertexId of current.vertexIds){
        const currentOtherId=current.vertexIds.find(id=>id!==vertexId);
        const currentOther=vertexMap.get(currentOtherId);
        const shared=vertexMap.get(vertexId);
        if(!currentOther||!shared)continue;

        const a=pointFromVertex(currentOther)
          .sub(pointFromVertex(shared))
          .normalize();

        for(const candidate of solid.edges){
          if(
            visited.has(candidate.id) ||
            !candidate.vertexIds.includes(vertexId)
          )continue;

          const candidateOtherId=candidate.vertexIds.find(id=>id!==vertexId);
          const candidateOther=vertexMap.get(candidateOtherId);
          if(!candidateOther)continue;

          const b=pointFromVertex(candidateOther)
            .sub(pointFromVertex(shared))
            .normalize();

          if(Math.abs(Math.abs(a.dot(b))-1)<1e-4){
            visited.add(candidate.id);
            result.push(candidate.id);
            queue.push(candidate);
          }
        }
      }
    }

    return result;
  }
}

export class EdgeKernelVisualizer{
  constructor(scene){
    this.scene=scene;
    this.root=new THREE.Group();
    this.root.name="Edge Kernel Overlay";
    scene.scene.add(this.root);
  }

  clear(){
    while(this.root.children.length){
      const child=this.root.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  show(part,selectionRecord,operation){
    this.clear();
    if(!part||!selectionRecord)return;

    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...selectionRecord.localA,...selectionRecord.localB],
        3
      )
    );

    const colors={
      split:0x5fd5ff,
      merge:0x79df9f,
      suppress:0xff6774,
      restore:0xffc25e,
      fillet:0x54d4ff,
      chamfer:0xffa94f
    };

    const material=new THREE.LineBasicMaterial({
      color:colors[operation]||0xffffff,
      depthTest:false
    });

    const line=new THREE.LineSegments(geometry,material);
    line.position.copy(part.mesh.position);
    line.rotation.copy(part.mesh.rotation);
    line.scale.copy(part.mesh.scale);
    line.renderOrder=130;
    this.root.add(line);
  }
}
