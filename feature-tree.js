
export class FeatureTreeController {
  constructor(state,scene,onChange,edgeVisualizer=null){
    this.state=state;
    this.scene=scene;
    this.onChange=onChange;
    this.selectedFeatureId=null;
    this.edgeVisualizer=edgeVisualizer;
  }

  ensure(part){
    if(!part.features){
      part.features=[{
        id:`${part.id}:base`,
        type:"Base",
        name:"Base Geometry",
        enabled:true,
        dirty:false,
        order:0,
        parameters:{}
      }];
      part.rollbackIndex=part.features.length-1;
    }
    return part.features;
  }

  add(part,type,parameters={}){
    const features=this.ensure(part);
    const feature={
      id:`${part.id}:feature:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      type,
      name:`${type} ${features.length}`,
      enabled:true,
      dirty:true,
      order:features.length,
      parameters:structuredClone(parameters)
    };
    features.push(feature);
    part.rollbackIndex=features.length-1;
    this.selectedFeatureId=feature.id;
    this.markDirtyFrom(part,feature.id);
    this.onChange();
    return feature;
  }

  remove(part,featureId){
    const features=this.ensure(part);
    const index=features.findIndex(feature=>feature.id===featureId);
    if(index<=0)return false;
    features.splice(index,1);
    features.forEach((feature,i)=>feature.order=i);
    part.rollbackIndex=Math.min(part.rollbackIndex,features.length-1);
    this.selectedFeatureId=null;
    this.markDirtyFromIndex(part,index);
    this.onChange();
    return true;
  }

  move(part,featureId,delta){
    const features=this.ensure(part);
    const index=features.findIndex(feature=>feature.id===featureId);
    const target=index+delta;
    if(index<=0||target<=0||target>=features.length)return false;
    [features[index],features[target]]=[features[target],features[index]];
    features.forEach((feature,i)=>feature.order=i);
    this.markDirtyFromIndex(part,Math.min(index,target));
    this.onChange();
    return true;
  }

  toggle(part,featureId){
    const feature=this.ensure(part).find(item=>item.id===featureId);
    if(!feature||feature.type==="Base")return;
    feature.enabled=!feature.enabled;
    feature.dirty=true;
    this.markDirtyFrom(part,featureId);
    this.onChange();
  }

  setRollback(part,index){
    const features=this.ensure(part);
    part.rollbackIndex=Math.max(0,Math.min(features.length-1,index));
    this.onChange();
  }

  markDirtyFrom(part,featureId){
    const features=this.ensure(part);
    const index=features.findIndex(feature=>feature.id===featureId);
    this.markDirtyFromIndex(part,index);
  }

  markDirtyFromIndex(part,index){
    const features=this.ensure(part);
    for(let i=Math.max(0,index);i<features.length;i++){
      features[i].dirty=true;
    }
  }

  applyFeature(part,feature){
    if(!feature.enabled)return;

    if(feature.type==="Move"){
      const v=feature.parameters;
      part.position[0]+=Number(v.x||0);
      part.position[1]+=Number(v.y||0);
      part.position[2]+=Number(v.z||0);
    }else if(feature.type==="Rotate"){
      const v=feature.parameters;
      part.rotation[0]+=Number(v.x||0);
      part.rotation[1]+=Number(v.y||0);
      part.rotation[2]+=Number(v.z||0);
    }else if(feature.type==="Metadata"){
      part.metadata={...(part.metadata||{}),...(feature.parameters||{})};
    }else if(feature.type==="EdgeEdit"){
      return;
    }else if(feature.type==="FaceEdit"||feature.type==="FaceMerge"){
      return;
    }else if(feature.type==="Boolean"){
      return;
    }else if(feature.type==="FaceExtrude"){
      const p=feature.parameters||{};
      const distance=Number(p.distance||0)*(p.direction==="reverse"?-1:1);
      const axis=p.axis||"Z";
      if(axis==="X"){part.params.width=Math.max(.1,Number(part.params.width||0)+distance);part.position[0]+=distance*Number(p.faceSign||1)/2;}
      else if(axis==="Y"){part.params.height=Math.max(.1,Number(part.params.height||0)+distance);part.position[1]+=distance*Number(p.faceSign||1)/2;}
      else{part.params.depth=Math.max(.1,Number(part.params.depth||0)+distance);part.position[2]+=distance*Number(p.faceSign||1)/2;}
    }
  }

  rebuild(part){
    const features=this.ensure(part);
    const base=part.baseState||{
      position:[...part.position],
      rotation:[...part.rotation],
      scale:[...part.scale],
      params:structuredClone(part.params)
    };
    part.baseState=structuredClone(base);

    part.position=[...base.position];
    part.rotation=[...base.rotation];
    part.scale=[...base.scale];
    part.params=structuredClone(base.params);

    const maxIndex=Math.min(
      part.rollbackIndex??features.length-1,
      features.length-1
    );

    for(let i=0;i<=maxIndex;i++){
      const feature=features[i];
      if(i>0)this.applyFeature(part,feature);
      feature.dirty=false;
      feature.status=feature.enabled?"ok":"suppressed";
    }

    for(let i=maxIndex+1;i<features.length;i++){
      features[i].status="rolled-back";
    }

    this.scene.rebuild(part);
    this.edgeVisualizer?.rebuild?.(part);
    this.onChange();
  }

  serialize(part){
    return {
      rollbackIndex:part.rollbackIndex,
      features:structuredClone(this.ensure(part))
    };
  }

  selected(part){
    return this.ensure(part).find(feature=>feature.id===this.selectedFeatureId)||null;
  }
}
