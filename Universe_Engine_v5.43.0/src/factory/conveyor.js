export class Conveyor {
  constructor({id='CONV01',speed=.4,length=10}={}){this.id=id;this.speed=Number(speed)||0;this.length=Math.max(.01,Number(length)||10);this.items=[]}
  add(entityId,position=0){const item={entityId,position:Number(position)||0,done:false};this.items.push(item);return item}
  update(dt){for(const item of this.items){if(item.done)continue;item.position+=this.speed*(Number(dt)||0);if(item.position>=this.length){item.position=this.length;item.done=true}}return this.items}
}
