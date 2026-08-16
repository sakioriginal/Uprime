const EPS=1e-5;
const SNAP_EPS=1e-3;

function round(value){return Math.round(value/SNAP_EPS)*SNAP_EPS}
function pointKey(point){return `${round(point.x)},${round(point.y)}`}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function polygonArea(points){let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a.x*b.y-b.x*a.y}return area/2}
function polygonCentroid(points){const signedArea=polygonArea(points);if(Math.abs(signedArea)<EPS){return{x:points.reduce((s,p)=>s+p.x,0)/points.length,y:points.reduce((s,p)=>s+p.y,0)/points.length}}let cx=0,cy=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],f=a.x*b.y-b.x*a.y;cx+=(a.x+b.x)*f;cy+=(a.y+b.y)*f}const d=6*signedArea;return{x:cx/d,y:cy/d}}
function segmentsIntersect(a,b,c,d){const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);return(((abC>EPS&&abD<-EPS)||(abC<-EPS&&abD>EPS))&&((cdA>EPS&&cdB<-EPS)||(cdA<-EPS&&cdB>EPS)))}
function selfIntersects(points){const n=points.length;for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%n];for(let j=i+1;j<n;j++){if(Math.abs(i-j)<=1)continue;if(i===0&&j===n-1)continue;const c=points[j],d=points[(j+1)%n];if(segmentsIntersect(a,b,c,d))return true}}return false}
function pointInPolygon(point,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if(((a.y>point.y)!==(b.y>point.y))&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y||EPS)+a.x)inside=!inside}return inside}
function canonicalLoopKey(points){const keys=points.map(pointKey),rots=[];for(let i=0;i<keys.length;i++)rots.push([...keys.slice(i),...keys.slice(0,i)].join('|'));const rev=[...keys].reverse();for(let i=0;i<rev.length;i++)rots.push([...rev.slice(i),...rev.slice(0,i)].join('|'));return rots.sort()[0]}

function normalizeAngle(a){a%=Math.PI*2;if(a<0)a+=Math.PI*2;return a}
function arcSweep(e){let a0=normalizeAngle(e.startAngle||0),a1=normalizeAngle(e.endAngle||0);if(e.clockwise){let d=a0-a1;if(d<=0)d+=Math.PI*2;return-d}let d=a1-a0;if(d<=0)d+=Math.PI*2;return d}
function sampleArc(e,segments=48){const sweep=arcSweep(e),count=Math.max(4,Math.ceil(Math.abs(sweep)/(Math.PI*2)*segments)),pts=[];for(let i=0;i<=count;i++){const a=(e.startAngle||0)+sweep*i/count;pts.push({x:e.center.x+Math.cos(a)*e.radius,y:e.center.y+Math.sin(a)*e.radius})}return pts}
function sampleSpline(e,segmentsPerSpan=8){const p=e.points||[];if(p.length<2)return p.map(q=>({...q}));if(p.length===2)return p.map(q=>({...q}));const pts=[];const cat=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return{x:.5*((2*p1.x)+(-p0.x+p2.x)*t+(2*p0.x-5*p1.x+4*p2.x-p3.x)*t2+(-p0.x+3*p1.x-3*p2.x+p3.x)*t3),y:.5*((2*p1.y)+(-p0.y+p2.y)*t+(2*p0.y-5*p1.y+4*p2.y-p3.y)*t2+(-p0.y+3*p1.y-3*p2.y+p3.y)*t3)}};const src=e.closed?[p.at(-1),...p,p[0],p[1]]:[p[0],...p,p.at(-1)];const spans=e.closed?p.length:p.length-1;for(let i=0;i<spans;i++){const k=e.closed?i+1:i+1;const p0=src[k-1],p1=src[k],p2=src[k+1],p3=src[k+2];for(let s=0;s<segmentsPerSpan;s++)pts.push(cat(p0,p1,p2,p3,s/segmentsPerSpan))}pts.push(e.closed?{...pts[0]}:{...p.at(-1)});return pts}
function entityPolyline(e){
  if(e.type==='line'||e.type==='centerline')return[{...e.start},{...e.end}];
  if(e.type==='arc')return sampleArc(e);
  if(e.type==='spline'||e.type==='freehand')return sampleSpline(e);
  return[];
}
function entityEndpoints(e){const pts=entityPolyline(e);return pts.length?[pts[0],pts.at(-1)]:null}

function buildCurveGraph(sketch){
  const vertices=new Map(),edges=[];
  const ensureVertex=point=>{const key=pointKey(point);if(!vertices.has(key))vertices.set(key,{key,point:{...point},edges:[]});return vertices.get(key)};
  for(const entity of sketch.entities||[]){
    if(entity.visible===false||entity.construction)continue;
    if(!['line','centerline','arc','spline','freehand'].includes(entity.type))continue;
    if((entity.type==='spline'||entity.type==='freehand')&&entity.closed)continue;
    const pts=entityPolyline(entity);if(pts.length<2||distance(pts[0],pts.at(-1))<EPS)continue;
    const a=ensureVertex(pts[0]),b=ensureVertex(pts.at(-1));const edge={id:entity.id,a:a.key,b:b.key,points:pts};edges.push(edge);a.edges.push(edge);b.edges.push(edge);
  }
  return{vertices,edges};
}
function traceLoops(graph){
  const loops=[],unique=new Set(),maxDepth=Math.max(4,graph.edges.length+1);
  const walk=(startKey,currentKey,pathVertices,pathEdges,pathPoints)=>{
    if(pathEdges.length>maxDepth)return;const current=graph.vertices.get(currentKey);if(!current)return;
    for(const edge of current.edges){if(pathEdges.includes(edge.id))continue;const forward=edge.a===currentKey,nextKey=forward?edge.b:edge.a;const segment=forward?edge.points:[...edge.points].reverse();const nextPoints=pathPoints.length?[...pathPoints,...segment.slice(1)]:[...segment];
      if(nextKey===startKey&&pathVertices.length>=2){const pts=nextPoints.slice(0,-1);if(pts.length<3)continue;const key=canonicalLoopKey(pts);if(!unique.has(key)){unique.add(key);loops.push({points:pts,edgeIds:[...pathEdges,edge.id]})}continue}
      if(pathVertices.includes(nextKey))continue;walk(startKey,nextKey,[...pathVertices,nextKey],[...pathEdges,edge.id],nextPoints);
    }
  };
  for(const v of graph.vertices.values())walk(v.key,v.key,[v.key],[],[]);return loops;
}

function directEntityProfiles(sketch){
  const profiles=[];
  for(const entity of sketch.entities||[]){if(entity.construction||entity.visible===false)continue;
    if(entity.type==='rectangle'){
      const width=Math.abs(entity.b.x-entity.a.x),height=Math.abs(entity.b.y-entity.a.y);if(width>EPS&&height>EPS){const points=[{x:entity.a.x,y:entity.a.y},{x:entity.b.x,y:entity.a.y},{x:entity.b.x,y:entity.b.y},{x:entity.a.x,y:entity.b.y}];profiles.push({id:`profile:${entity.id}`,entityId:entity.id,type:'rectangle',points,center:polygonCentroid(points),width,height,area:Math.abs(polygonArea(points)),signedArea:polygonArea(points),holes:[],source:'entity'})}
    }else if(entity.type==='circle'&&entity.radius>EPS){profiles.push({id:`profile:${entity.id}`,entityId:entity.id,type:'circle',center:{...entity.center},radius:entity.radius,area:Math.PI*entity.radius*entity.radius,signedArea:Math.PI*entity.radius*entity.radius,holes:[],source:'entity'})}
    else if((entity.type==='spline'||entity.type==='freehand')&&entity.closed){let points=sampleSpline(entity,10);if(points.length>2&&distance(points[0],points.at(-1))<SNAP_EPS)points=points.slice(0,-1);if(points.length>=3&&!selfIntersects(points)){const area=polygonArea(points);if(Math.abs(area)>EPS)profiles.push({id:`profile:${entity.id}`,entityId:entity.id,type:entity.type,points,center:polygonCentroid(points),area:Math.abs(area),signedArea:area,holes:[],source:'entity'})}}
    else if(entity.type==='arc'&&Math.abs(Math.abs(arcSweep(entity))-Math.PI*2)<1e-3){let points=sampleArc(entity,96).slice(0,-1);const area=polygonArea(points);profiles.push({id:`profile:${entity.id}`,entityId:entity.id,type:'arc-circle',points,center:polygonCentroid(points),area:Math.abs(area),signedArea:area,holes:[],source:'entity'})}
  }
  return profiles;
}
function curveLoopProfiles(sketch){const graph=buildCurveGraph(sketch),rawLoops=traceLoops(graph),profiles=[],errors=[];for(let i=0;i<rawLoops.length;i++){const loop=rawLoops[i],area=polygonArea(loop.points);if(Math.abs(area)<EPS){errors.push({type:'zero-area',message:'面積0の閉ループを除外しました。',edgeIds:loop.edgeIds});continue}if(selfIntersects(loop.points)){errors.push({type:'self-intersection',message:'自己交差する閉ループを除外しました。',edgeIds:loop.edgeIds});continue}profiles.push({id:`profile:loop:${i}:${canonicalLoopKey(loop.points)}`,type:'polygon',points:loop.points,center:polygonCentroid(loop.points),area:Math.abs(area),signedArea:area,edgeIds:loop.edgeIds,holes:[],source:'curve-loop'})}return{profiles,errors,graph}}
function removeDuplicateProfiles(profiles){const result=[],keys=new Set();for(const p of profiles){const key=p.type==='circle'?`circle:${pointKey(p.center)}:${round(p.radius)}`:canonicalLoopKey(p.points);if(keys.has(key))continue;keys.add(key);result.push(p)}return result}
function classifyNesting(profiles){const polygons=profiles.filter(p=>p.type!=='circle'&&p.points?.length>=3);for(const p of polygons){p.depth=0;p.parentId=null;let best=null;for(const q of polygons){if(q===p||q.area<=p.area)continue;if(pointInPolygon(p.center,q.points)&&(!best||q.area<best.area))best=q}if(best){p.parentId=best.id;p.depth=(best.depth||0)+1}}
  const solids=[];for(const p of profiles){if(p.type==='circle'){p.depth=0;p.parentId=null;solids.push(p);continue}if((p.depth||0)%2===0)solids.push(p)}for(const solid of solids){solid.holes=profiles.filter(candidate=>{if(candidate===solid)return false;if(candidate.type==='circle')return solid.type!=='circle'&&pointInPolygon(candidate.center,solid.points);return candidate.parentId===solid.id&&(candidate.depth||0)%2===1})}return solids}

export function buildSketchProfiles(sketch){
  const entityProfiles=directEntityProfiles(sketch),curveResult=curveLoopProfiles(sketch);const allProfiles=removeDuplicateProfiles([...entityProfiles,...curveResult.profiles]);const profiles=classifyNesting(allProfiles);
  sketch.profiles=profiles;sketch.profileCount=profiles.length;sketch.profileErrors=curveResult.errors;sketch.profileGraph={vertices:curveResult.graph.vertices.size,edges:curveResult.graph.edges.length,loops:curveResult.profiles.length};return profiles;
}
