
import * as THREE from "three";

export class EdgeFeatureVisualizer{
  constructor(scene){
    this.scene=scene;
    this.root=new THREE.Group();
    this.root.name="Edge Feature Preview";
    scene.scene.add(this.root);
  }

  clearPart(partId){
    const remove=this.root.children.filter(x=>x.userData.partId===partId);
    remove.forEach(x=>{this.root.remove(x);x.geometry?.dispose?.();x.material?.dispose?.()});
  }

  rebuild(part){
    this.clearPart(part.id);
    for(const feature of part.features||[]){
      if(feature.enabled===false||!["Fillet","Chamfer"].includes(feature.type))continue;
      if(feature.parameters?.allEdges)continue;
      for(const edge of feature.parameters?.edges||[]){
        const a=new THREE.Vector3().fromArray(edge.localA);
        const b=new THREE.Vector3().fromArray(edge.localB);
        const lineGeometry=new THREE.BufferGeometry().setFromPoints([a,b]);
        const material=new THREE.LineBasicMaterial({
          color:feature.type==="Fillet"?0x55d6ff:0xffb24d,
          depthTest:false,
          transparent:true,
          opacity:.95
        });
        const line=new THREE.Line(lineGeometry,material);
        line.position.copy(part.mesh.position);
        line.rotation.copy(part.mesh.rotation);
        line.scale.copy(part.mesh.scale);
        line.renderOrder=80;
        line.userData.partId=part.id;
        this.root.add(line);
      }
    }
  }

  rebuildAll(parts){parts.forEach(p=>this.rebuild(p))}
}
