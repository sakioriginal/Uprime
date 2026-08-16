import {serializable} from '../core/clipboard.js';
export class GeneratorWorkbench{
  constructor(state,addPart){this.state=state;this.addPart=addPart}
  generate({count=6,spacing=80,seed=1}={}){const pool=this.state.selectedObjects();if(!pool.length)return [];let s=Number(seed)||1;const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);const made=[];for(let i=0;i<count;i++){const src=pool[Math.floor(rnd()*pool.length)],safe=serializable(src);if(!safe)continue;const col=i%4,row=Math.floor(i/4);safe.id=this.state.uid();safe.objectId=this.state.publicId();safe.name=`${src.name} Gen${i+1}`;safe.groupId=null;safe.position=[src.position[0]+(col-1.5)*spacing,src.position[1]+row*spacing,src.position[2]];safe.rotation=[...src.rotation];safe.rotation[2]+=(rnd()-.5)*30;made.push(this.addPart(src.type,safe,false))}return made}
}
