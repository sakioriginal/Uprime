
export class SelectionController{
 constructor(state,scene,onChange){this.state=state;this.scene=scene;this.onChange=onChange}
 select(id,additive=false){if(!id){if(!additive){this.state.selectedIds=[];this.state.primaryId=null}}else if(additive){const i=this.state.selectedIds.indexOf(id);if(i>=0)this.state.selectedIds.splice(i,1);else this.state.selectedIds.push(id);this.state.primaryId=id}else{this.state.selectedIds=[id];this.state.primaryId=id}this.paint();this.onChange()}
 paint(){for(const o of this.state.objects){const material=o?.mesh?.material;if(!material)continue;const primary=o.id===this.state.primaryId,selected=this.state.selectedIds.includes(o.id);if(material.emissive?.setHex)material.emissive.setHex(primary?0x175b85:selected?0x14683f:0);if("emissiveIntensity" in material)material.emissiveIntensity=primary?1:selected?.8:0}}
}
