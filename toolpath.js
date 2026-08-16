export class ToolPath{
  constructor({id='TP01',operation='contour',toolId='T01'}={}){this.id=id;this.operation=operation;this.toolId=toolId;this.moves=[];this.estimatedSeconds=0}
  rapid(x,y,z){this.moves.push({mode:'rapid',x:Number(x),y:Number(y),z:Number(z)});return this}
  feed(x,y,z,f=null){this.moves.push({mode:'feed',x:Number(x),y:Number(y),z:Number(z),feed:f==null?null:Number(f)});return this}
  arcCW(x,y,z,i,j,f=null){this.moves.push({mode:'arcCW',x:Number(x),y:Number(y),z:Number(z),i:Number(i),j:Number(j),feed:f==null?null:Number(f)});return this}
  arcCCW(x,y,z,i,j,f=null){this.moves.push({mode:'arcCCW',x:Number(x),y:Number(y),z:Number(z),i:Number(i),j:Number(j),feed:f==null?null:Number(f)});return this}
}
