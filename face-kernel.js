
import * as THREE from "three";

function dominantAxis(normal){
  const values=normal.map(value=>Math.abs(value));
  const index=values.indexOf(Math.max(...values));
  return ["X","Y","Z"][index];
}

function signForNormal(normal){
  const axis=dominantAxis(normal);
  const index=["X","Y","Z"].indexOf(axis);
  return Number(normal[index]||1)>=0?1:-1;
}

export class FaceKernel{
  constructor(state,scene,brepCore,featureTree,onChange){
    this.state=state;
    this.scene=scene;
    this.brepCore=brepCore;
    this.featureTree=featureTree;
    this.onChange=onChange;
  }

  selectedFaceRecord(){
    return this.state.subSelections.find(item=>item.mode==="face")||null;
  }

  resolve(part,selectionRecord){
    if(!part||!selectionRecord)return null;
    const solid=this.brepCore.build(part);
    const normal=selectionRecord.normal||[0,0,1];

    let best=null;
    for(const face of solid.faces){
      const dot=
        Number(face.normal?.[0]||0)*normal[0]+
        Number(face.normal?.[1]||0)*normal[1]+
        Number(face.normal?.[2]||0)*normal[2];

      if(!best||dot>best.dot){
        best={face,dot};
      }
    }

    return best?.face||null;
  }

  addFeature(part,selectionRecord,operation,value=0){
    const face=this.resolve(part,selectionRecord);
    if(!face)throw new Error("B-Rep Faceを特定できません");

    const parameters={
      operation,
      faceId:face.id,
      sourceSelectionId:selectionRecord.id,
      normal:[...selectionRecord.normal],
      axis:dominantAxis(selectionRecord.normal),
      sign:signForNormal(selectionRecord.normal),
      value:Number(value)||0,
      area:face.area,
      surfaceType:face.surfaceType
    };

    const feature=this.featureTree.add(part,"FaceEdit",parameters);
    feature.name=`Face ${operation}`;

    if(operation==="offset"){
      this.applyOffset(part,parameters);
      feature.parameters.resultMode="exact-box";
    }else{
      this.applyAttribute(part,parameters);
      feature.parameters.resultMode="brep-attribute";
    }

    feature.dirty=false;
    feature.status="ok";
    this.onChange();
    return feature;
  }

  applyOffset(part,parameters){
    if(part.type!=="box"){
      throw new Error("現段階の実オフセットは直方体に対応しています");
    }

    const delta=Number(parameters.value||0);
    const axis=parameters.axis;
    const sign=Number(parameters.sign||1);

    if(axis==="X"){
      part.params.width=Math.max(.1,Number(part.params.width)+delta*sign);
      part.position[0]+=delta/2;
    }else if(axis==="Y"){
      part.params.height=Math.max(.1,Number(part.params.height)+delta*sign);
      part.position[1]+=delta/2;
    }else{
      part.params.depth=Math.max(.1,Number(part.params.depth)+delta*sign);
      part.position[2]+=delta/2;
    }

    part.baseState={
      position:[...part.position],
      rotation:[...part.rotation],
      scale:[...part.scale],
      params:structuredClone(part.params)
    };

    this.scene.rebuild(part);
    this.brepCore.build(part);
  }

  applyAttribute(part,parameters){
    const solid=this.brepCore.build(part);
    const face=solid.faces.find(item=>item.id===parameters.faceId);
    if(!face)return;

    face.attributes=face.attributes||{};

    if(parameters.operation==="reverse"){
      face.attributes.reversed=!face.attributes.reversed;
      face.normal=face.normal.map(value=>-value);
    }else if(parameters.operation==="suppress"){
      face.attributes.suppressed=true;
    }else if(parameters.operation==="restore"){
      face.attributes.suppressed=false;
    }

    part.brep=solid;
  }

  mergeCoplanar(part){
    const solid=this.brepCore.build(part);
    const groups=new Map();

    for(const face of solid.faces){
      const key=[
        face.surfaceType,
        ...(face.normal||[]).map(value=>Number(value).toFixed(5))
      ].join(":");

      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(face);
    }

    const merged=[];
    for(const faces of groups.values()){
      if(faces.length===1){
        merged.push(faces[0]);
        continue;
      }

      const base=structuredClone(faces[0]);
      base.id=`${part.id}:face:merged:${merged.length}`;
      base.area=faces.reduce((sum,face)=>sum+Number(face.area||0),0);
      base.edgeIds=[...new Set(faces.flatMap(face=>face.edgeIds||[]))];
      base.vertexIds=[...new Set(faces.flatMap(face=>face.vertexIds||[]))];
      base.mergedFrom=faces.map(face=>face.id);
      merged.push(base);
    }

    solid.faces=merged;
    solid.shells[0].faceIds=merged.map(face=>face.id);
    solid.diagnostics=this.brepCore.diagnose(solid);
    part.brep=solid;

    const feature=this.featureTree.add(part,"FaceMerge",{
      mergedCount:solid.faces.length,
      sourceFaceCount:[...groups.values()].reduce((sum,g)=>sum+g.length,0)
    });
    feature.name="Merge Coplanar Faces";
    feature.dirty=false;
    feature.status="ok";
    this.onChange();

    return solid;
  }

  featureSummary(part){
    return (part.features||[])
      .filter(feature=>feature.type==="FaceEdit"||feature.type==="FaceMerge")
      .map(feature=>({
        id:feature.id,
        name:feature.name,
        enabled:feature.enabled,
        parameters:feature.parameters
      }));
  }
}

export class FaceKernelVisualizer{
  constructor(scene){
    this.scene=scene;
    this.root=new THREE.Group();
    this.root.name="Face Kernel Overlay";
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
    if(!part||!selectionRecord?.triangleIndices?.length)return;

    const position=part.mesh.geometry.attributes.position;
    const index=part.mesh.geometry.index;
    const vertices=[];

    for(const faceIndex of selectionRecord.triangleIndices){
      const base=faceIndex*3;
      const ids=index
        ? [index.getX(base),index.getX(base+1),index.getX(base+2)]
        : [base,base+1,base+2];

      for(const id of ids){
        const vertex=new THREE.Vector3().fromBufferAttribute(position,id);
        vertices.push(vertex.x,vertex.y,vertex.z);
      }
    }

    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices,3)
    );

    const colors={
      offset:0x54d38b,
      reverse:0x7f9cff,
      suppress:0xff6975,
      restore:0xffc45d
    };

    const material=new THREE.MeshBasicMaterial({
      color:colors[operation]||0xffffff,
      transparent:true,
      opacity:.42,
      side:THREE.DoubleSide,
      depthTest:false
    });

    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.copy(part.mesh.position);
    mesh.rotation.copy(part.mesh.rotation);
    mesh.scale.copy(part.mesh.scale);
    mesh.renderOrder=120;
    this.root.add(mesh);
  }
}
