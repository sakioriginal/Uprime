
export class ParametricRebuildEngine{
  constructor(state,scene,brepCore,geometrySelection,edgeVisualizer,booleanVisualizer,onChange){
    this.state=state;
    this.scene=scene;
    this.brepCore=brepCore;
    this.geometrySelection=geometrySelection;
    this.edgeVisualizer=edgeVisualizer;
    this.booleanVisualizer=booleanVisualizer;
    this.onChange=onChange;
    this.log=[];
    this.history=[];
    this.historyIndex=-1;
    this.nextStableId=1;
  }

  ensureFeatureMetadata(part){
    const features=part.features||[];
    features.forEach((feature,index)=>{
      feature.dependencies=feature.dependencies||[];
      feature.dependents=feature.dependents||[];
      feature.stableName=feature.stableName||`${part.id}:feature-stable:${this.nextStableId++}`;
      feature.order=index;
      if(!feature.rebuildState)feature.rebuildState=feature.dirty?"dirty":"clean";
    });
    this.buildDependencyGraph(part);
  }

  buildDependencyGraph(part){
    const features=part.features||[];
    for(const feature of features){
      feature.dependencies=[];
      feature.dependents=[];
    }

    for(let i=0;i<features.length;i++){
      const feature=features[i];

      if(i>0){
        const previous=features[i-1];
        feature.dependencies.push(previous.id);
        previous.dependents.push(feature.id);
      }

      if(feature.type==="SketchExtrude"){
        const sketchFeature=features.find(candidate=>
          candidate.type==="Sketch" &&
          candidate.parameters?.sketchId===feature.parameters?.sketchId
        );
        if(sketchFeature&&!feature.dependencies.includes(sketchFeature.id)){
          feature.dependencies.push(sketchFeature.id);
          sketchFeature.dependents.push(feature.id);
        }
      }

      if(feature.type==="Boolean"){
        feature.externalDependencies=[
          feature.parameters?.targetId,
          feature.parameters?.toolId
        ].filter(Boolean);
      }
    }
  }

  markDirty(part,featureId,reason="changed"){
    this.ensureFeatureMetadata(part);
    const features=part.features||[];
    const start=features.findIndex(feature=>feature.id===featureId);
    if(start<0)return;

    for(let i=start;i<features.length;i++){
      const feature=features[i];
      feature.dirty=true;
      feature.rebuildState="dirty";
      feature.dirtyReason=reason;
    }

    this.onChange();
  }

  markAllDirty(part,reason="full rebuild"){
    this.ensureFeatureMetadata(part);
    for(const feature of part.features||[]){
      feature.dirty=true;
      feature.rebuildState="dirty";
      feature.dirtyReason=reason;
    }
  }

  evaluateFeature(part,feature){
    if(feature.enabled===false){
      feature.rebuildState="suppressed";
      feature.dirty=false;
      return;
    }

    if(feature.type==="Base"){
      return;
    }

    if(feature.type==="Move"){
      const p=feature.parameters||{};
      part.position[0]+=Number(p.x||0);
      part.position[1]+=Number(p.y||0);
      part.position[2]+=Number(p.z||0);

    }else if(feature.type==="Rotate"){
      const p=feature.parameters||{};
      part.rotation[0]+=Number(p.x||0);
      part.rotation[1]+=Number(p.y||0);
      part.rotation[2]+=Number(p.z||0);

    }else if(feature.type==="FaceExtrude"){
      const p=feature.parameters||{};
      const delta=Number(p.distance||0)*(p.direction==="reverse"?-1:1);
      if(p.axis==="X"){
        part.params.width=Math.max(.1,Number(part.params.width||0)+delta);
      }else if(p.axis==="Y"){
        part.params.height=Math.max(.1,Number(part.params.height||0)+delta);
      }else{
        part.params.depth=Math.max(.1,Number(part.params.depth||0)+delta);
      }

    }else if(feature.type==="SketchExtrude"){
      part.params.distance=Math.max(.001,Number(feature.parameters?.distance||part.params.distance||1));
      part.params.direction=feature.parameters?.direction||part.params.direction;

    }else if(feature.type==="DefaultChamfer"){
      // geometry.js evaluates this from the feature list.

    }else if(["Fillet","Chamfer","Boolean","FaceEdit","FaceMerge","EdgeEdit","Sketch","Metadata"].includes(feature.type)){
      // These are evaluated by their dedicated modules or geometry builder.
    }
  }

  rebuildPart(part,{dirtyOnly=true}={}){
    this.ensureFeatureMetadata(part);
    const features=part.features||[];
    const base=part.baseState||{
      position:[...part.position],
      rotation:[...part.rotation],
      scale:[...part.scale],
      params:structuredClone(part.params)
    };

    part.position=[...base.position];
    part.rotation=[...base.rotation];
    part.scale=[...base.scale];
    part.params=structuredClone(base.params);

    const maxIndex=Math.min(
      part.rollbackIndex??features.length-1,
      features.length-1
    );

    const entries=[];
    let failed=false;

    for(let index=0;index<features.length;index++){
      const feature=features[index];

      if(index>maxIndex){
        feature.rebuildState="rolled-back";
        entries.push(this.entry(part,feature,0,"rolled-back"));
        continue;
      }

      if(dirtyOnly&&!feature.dirty&&feature.rebuildState==="clean"){
        entries.push(this.entry(part,feature,0,"clean"));
        continue;
      }

      if(failed){
        feature.rebuildState="blocked";
        feature.dirty=true;
        entries.push(this.entry(part,feature,0,"blocked"));
        continue;
      }

      const start=performance.now();
      feature.rebuildState="rebuilding";

      try{
        this.evaluateFeature(part,feature);
        const elapsed=performance.now()-start;
        feature.dirty=false;
        feature.rebuildState=feature.enabled===false?"suppressed":"clean";
        feature.lastRebuildMs=elapsed;
        feature.lastError=null;
        entries.push(this.entry(part,feature,elapsed,feature.rebuildState));
      }catch(error){
        const elapsed=performance.now()-start;
        feature.rebuildState="error";
        feature.dirty=true;
        feature.lastError=error.message;
        feature.lastRebuildMs=elapsed;
        entries.push(this.entry(part,feature,elapsed,"error",error.message));
        failed=true;
      }
    }

    if(!failed){
      this.scene.rebuild(part);
      this.scene.sync(part);
      this.geometrySelection?.invalidate?.(part);
      this.brepCore?.build?.(part);
      this.edgeVisualizer?.rebuild?.(part);
    }

    this.log=[
      ...entries,
      ...this.log
    ].slice(0,200);

    this.booleanVisualizer?.rebuildAll?.(this.state.objects);
    this.onChange();
    return {part,failed,entries};
  }

  rebuildAll({dirtyOnly=true}={}){
    const results=[];
    for(const part of this.state.objects){
      results.push(this.rebuildPart(part,{dirtyOnly}));
    }
    return results;
  }

  entry(part,feature,elapsed,state,error=null){
    return {
      timestamp:new Date().toISOString(),
      partId:part.id,
      partName:part.name,
      featureId:feature.id,
      featureName:feature.name,
      featureType:feature.type,
      state,
      elapsed,
      error
    };
  }

  persistentNameMap(part){
    this.ensureFeatureMetadata(part);
    const solid=this.brepCore?.build?.(part);
    return {
      features:(part.features||[]).map(feature=>({
        stableName:feature.stableName,
        featureId:feature.id,
        type:feature.type,
        order:feature.order
      })),
      faces:(solid?.faces||[]).map((face,index)=>({
        stableName:`${part.id}:face:${face.surfaceType}:${index}`,
        currentId:face.id,
        normal:face.normal,
        area:face.area
      })),
      edges:(solid?.edges||[]).map((edge,index)=>({
        stableName:`${part.id}:edge:${edge.curveType}:${index}`,
        currentId:edge.id,
        length:edge.length
      }))
    };
  }

  snapshot(label="Snapshot"){
    const data={
      label,
      timestamp:new Date().toISOString(),
      objects:this.state.objects.map(part=>({
        id:part.id,
        name:part.name,
        type:part.type,
        params:structuredClone(part.params),
        position:[...part.position],
        rotation:[...part.rotation],
        scale:[...part.scale],
        visible:part.visible,
        opacity:part.opacity,
        baseState:structuredClone(part.baseState),
        rollbackIndex:part.rollbackIndex,
        features:structuredClone(part.features||[])
      })),
      selectedIds:[...this.state.selectedIds],
      primaryId:this.state.primaryId
    };

    this.history=this.history.slice(0,this.historyIndex+1);
    this.history.push(data);
    this.historyIndex=this.history.length-1;
    this.onChange();
    return data;
  }

  restore(snapshot){
    if(!snapshot)return false;

    for(const existing of [...this.state.objects]){
      this.scene.remove(existing);
    }

    this.state.objects=[];
    this.state.selectedIds=[];
    this.state.primaryId=null;

    for(const data of snapshot.objects){
      const part={
        ...structuredClone(data),
        mesh:null,
        edge:null
      };
      this.state.objects.push(part);
      this.scene.makeMesh(part);
      this.brepCore?.build?.(part);
    }

    this.state.selectedIds=[...snapshot.selectedIds];
    this.state.primaryId=snapshot.primaryId;
    this.booleanVisualizer?.rebuildAll?.(this.state.objects);
    this.onChange();
    return true;
  }

  undo(){
    if(this.historyIndex<=0)return false;
    this.historyIndex--;
    return this.restore(this.history[this.historyIndex]);
  }

  redo(){
    if(this.historyIndex>=this.history.length-1)return false;
    this.historyIndex++;
    return this.restore(this.history[this.historyIndex]);
  }
}
