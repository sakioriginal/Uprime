export function boundsFromPart(part){
  const p=part?.params||{};
  const w=Math.abs(Number(p.width??p.w??p.sizeX??20))||20;
  const d=Math.abs(Number(p.depth??p.d??p.sizeY??20))||20;
  const h=Math.abs(Number(p.height??p.h??p.sizeZ??10))||10;
  return {minX:-w/2,maxX:w/2,minY:-d/2,maxY:d/2,minZ:-h/2,maxZ:h/2,width:w,depth:d,height:h};
}
export function normalizeOperation(op={}){return {type:String(op.type||'contour').toLowerCase(),toolId:op.toolId||'T01',depth:Math.abs(Number(op.depth)||2),stepDown:Math.max(.001,Math.abs(Number(op.stepDown)||1)),stepOver:Math.max(.01,Math.min(.95,Math.abs(Number(op.stepOver)||.5))),safeZ:Number.isFinite(Number(op.safeZ))?Number(op.safeZ):5,margin:Math.max(0,Number(op.margin)||0),holeX:Number(op.holeX)||0,holeY:Number(op.holeY)||0}}
