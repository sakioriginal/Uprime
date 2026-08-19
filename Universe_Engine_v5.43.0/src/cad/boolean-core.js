import {booleanGeometry} from './csg-bsp.js';
export class BooleanCore{
  constructor(state,scene,featureTree,visualizer,onChange){Object.assign(this,{state,scene,featureTree,visualizer,onChange})}
  canExactBoxOperation(){return true}
  snapshot(part){return {id:part.id,type:part.type,params:structuredClone(part.params),position:[...part.position],rotation:[...part.rotation],scale:[...part.scale]}}
  addFeature(target,tool,operation,keepTool){
    if(!target?.mesh||!tool?.mesh)throw new Error('Boolean対象のメッシュがありません');
    const geometry=booleanGeometry(target.mesh,tool.mesh,operation);
    const positions=Array.from(geometry.attributes.position.array),normals=Array.from(geometry.attributes.normal.array);geometry.dispose();
    const feature=this.featureTree.add(target,'Boolean',{operation,targetId:target.id,toolId:tool.id,keepTool,targetSnapshot:this.snapshot(target),toolSnapshot:this.snapshot(tool),resultMode:'bsp-solid'});
    feature.name=`Boolean ${operation[0].toUpperCase()}${operation.slice(1)}`;
    target.type='mesh';target.params={positions,normals};target.position=[0,0,0];target.rotation=[0,0,0];target.scale=[1,1,1];
    target.baseState={position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],params:structuredClone(target.params)};
    this.scene.rebuild(target);this.visualizer.clearFeature(feature.id);
    if(!keepTool){tool.visible=false;this.scene.sync(tool)}
    feature.dirty=false;feature.status='ok';this.onChange();return {feature,exact:true};
  }
  rebuildFeature(){}
}
export class BooleanVisualizer{
  constructor(scene){this.scene=scene;this.root={children:[]}}
  clearFeature(){}
  rebuildFeature(){}
  rebuildAll(){}
}
