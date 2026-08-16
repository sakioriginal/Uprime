export class TransformController{
 constructor(state,scene){this.state=state;this.scene=scene;this.mode="relative"}
 capture(){this.state.transformSnapshot=this.state.selectedObjects().map(o=>({id:o.id,position:[...o.position],rotation:[...o.rotation],scale:[...o.scale]}))}
 restore(){for(const s of this.state.transformSnapshot||[]){const o=this.state.object(s.id);if(o){o.position=[...s.position];o.rotation=[...s.rotation];o.scale=[...s.scale];this.scene.sync(o)}}}
 apply(values){this.restore();for(const snap of this.state.transformSnapshot||[]){const o=this.state.object(snap.id);if(!o)continue;const protectedOwned=this.state.gameMode!=="creator"&&!this.state.creator?.enabled&&(o.metadata?.protectedOwner||o.metadata?.ownerId)&&o.metadata?.ownerId!=="PLAYER"&&o.metadata?.ownerUserId!==this.state.marketplace?.currentUserId;if(protectedOwned)continue;for(let i=0;i<3;i++){
   if(values.position?.[i]!=null)o.position[i]=this.mode==="absolute"?values.position[i]:snap.position[i]+values.position[i];
   if(values.rotation?.[i]!=null)o.rotation[i]=this.mode==="absolute"?values.rotation[i]:snap.rotation[i]+values.rotation[i];
   if(values.scale?.[i]!=null){const v=Math.max(.000001,values.scale[i]);o.scale[i]=this.mode==="absolute"?v:snap.scale[i]*v;}
 }this.scene.sync(o)}}
 clear(){this.state.transformSnapshot=null}
}
