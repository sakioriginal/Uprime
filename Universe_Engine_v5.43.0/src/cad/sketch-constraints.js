
const EPS=1e-8;

export class SketchConstraintEngine{
  constructor(sketchController){
    this.controller=sketchController;
  }

  selectedEntity(){
    const sketch=this.controller.activeSketch;
    return sketch?.entity(this.controller.selectedEntityId)||null;
  }

  add(type,data={}){
    const sketch=this.controller.activeSketch;
    if(!sketch)throw new Error("スケッチがありません");
    const constraint={
      id:`${sketch.id}:constraint:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      type,
      enabled:true,
      status:"ok",
      ...structuredClone(data)
    };
    sketch.constraints.push(constraint);
    this.solve();
    return constraint;
  }

  previousEntity(){return this.controller.activeSketch?.entity(this.controller.previousSelectedEntityId)||null}
  twoLines(){const a=this.selectedEntity(),b=this.previousEntity();if(!a||!b||a.type!=="line"||b.type!=="line"||a.id===b.id)throw new Error("線を2本順番に選択してください");return[a,b]}
  parallel(){const[a,b]=this.twoLines();return this.add("Parallel",{entityA:a.id,entityB:b.id})}
  perpendicular(){const[a,b]=this.twoLines();return this.add("Perpendicular",{entityA:a.id,entityB:b.id})}
  equal(){const[a,b]=this.twoLines();return this.add("EqualLength",{entityA:a.id,entityB:b.id})}
  concentric(){const a=this.selectedEntity(),b=this.previousEntity();if(!a||!b||a.type!=="circle"||b.type!=="circle"||a.id===b.id)throw new Error("円を2つ順番に選択してください");return this.add("Concentric",{entityA:a.id,entityB:b.id})}
  midpoint(){const a=this.selectedEntity(),b=this.previousEntity();let p,l;if(a?.type==="point"&&b?.type==="line"){p=a;l=b}else if(a?.type==="line"&&b?.type==="point"){p=b;l=a}else throw new Error("点と線を順番に選択してください");return this.add("Midpoint",{pointEntity:p.id,lineEntity:l.id})}
  lineLength(line){return Math.hypot(line.end.x-line.start.x,line.end.y-line.start.y)}
  unit(line){const len=this.lineLength(line)||1;return{x:(line.end.x-line.start.x)/len,y:(line.end.y-line.start.y)/len}}
  horizontal(){
    const entity=this.selectedEntity();
    if(!entity||entity.type!=="line")throw new Error("線を1本選択してください");
    return this.add("Horizontal",{entityId:entity.id});
  }

  vertical(){
    const entity=this.selectedEntity();
    if(!entity||entity.type!=="line")throw new Error("線を1本選択してください");
    return this.add("Vertical",{entityId:entity.id});
  }

  fixed(){
    const entity=this.selectedEntity();
    if(!entity)throw new Error("Entityを選択してください");
    return this.add("Fixed",{entityId:entity.id,snapshot:structuredClone(entity)});
  }

  coincident(){
    const sketch=this.controller.activeSketch;
    const first=sketch?.entity(this.controller.selectedEntityId);
    const secondId=this.controller.previousSelectedEntityId;
    const second=sketch?.entity(secondId);
    if(!first||!second||first.id===second.id)throw new Error("線または点を2つ順番に選択してください");
    const a=this.nearestEndpointPair(first,second);
    if(!a)throw new Error("端点を持つEntityを選択してください");
    return this.add("Coincident",{
      entityA:first.id,pointA:a.pointA,
      entityB:second.id,pointB:a.pointB
    });
  }

  addDimension(value,requestedType=null){
    const sketch=this.controller.activeSketch;
    const entity=this.selectedEntity();
    if(!sketch||!entity)throw new Error("線または円を選択してください");
    const number=Number(value);
    if(!Number.isFinite(number)||number<=0)throw new Error("0より大きい寸法を入力してください");
    let type=requestedType|| (entity.type==="circle"?"Radius":entity.type==="line"?"Length":null);
    if(entity.type==="circle"&&!['Radius','Diameter'].includes(type))type='Radius';
    if(entity.type==="line"&&!['Length','Horizontal','Vertical','Angle'].includes(type))type='Length';
    if(!type)throw new Error("寸法は線と円に対応しています");
    const existing=sketch.dimensions.find(d=>d.entityId===entity.id&&d.type===type);
    if(existing){existing.value=number;existing.enabled=true}
    else sketch.dimensions.push({id:`${sketch.id}:dimension:${Date.now()}`,type,entityId:entity.id,value:number,enabled:true,status:"ok"});
    this.solve();
  }

  endpoints(entity){
    if(entity.type==="point")return [{key:"point",value:entity.point}];
    if(entity.type==="line")return [{key:"start",value:entity.start},{key:"end",value:entity.end}];
    return [];
  }

  nearestEndpointPair(a,b){
    const ea=this.endpoints(a),eb=this.endpoints(b);
    let best=null;
    for(const pa of ea)for(const pb of eb){
      const distance=Math.hypot(pa.value.x-pb.value.x,pa.value.y-pb.value.y);
      if(!best||distance<best.distance)best={pointA:pa.key,pointB:pb.key,distance};
    }
    return best;
  }

  point(entity,key){
    if(entity.type==="point")return entity.point;
    return entity[key];
  }

  solve(){
    const sketch=this.controller.activeSketch;
    if(!sketch)return;
    let conflict=false;

    for(let iteration=0;iteration<8;iteration++){
      for(const c of sketch.constraints.filter(x=>x.enabled!==false)){
        try{
          this.applyConstraint(sketch,c);
          c.status="ok";
        }catch(_){
          c.status="conflict";conflict=true;
        }
      }
      for(const d of sketch.dimensions.filter(x=>x.enabled!==false)){
        try{
          this.applyDimension(sketch,d);
          d.status="ok";
        }catch(_){
          d.status="conflict";conflict=true;
        }
      }
    }

    sketch.constraintStatus=conflict?"conflict":"solved";
    sketch.dof=this.estimateDof(sketch);
    sketch.updateProfiles();
    this.controller.rebuild();
    this.controller.onChange();
  }

  applyConstraint(sketch,c){
    const entity=sketch.entity(c.entityId);
    if(c.type==="Horizontal"){
      if(!entity||entity.type!=="line")throw new Error();
      entity.end.y=entity.start.y;
    }else if(c.type==="Vertical"){
      if(!entity||entity.type!=="line")throw new Error();
      entity.end.x=entity.start.x;
    }else if(c.type==="Fixed"){
      if(!entity)throw new Error();
      const fixed=structuredClone(c.snapshot);
      Object.keys(entity).forEach(key=>delete entity[key]);
      Object.assign(entity,fixed);
    }else if(c.type==="Parallel"){
      const a=sketch.entity(c.entityA),b=sketch.entity(c.entityB);if(!a||!b)throw new Error();
      const u=this.unit(a),len=this.lineLength(b);b.end.x=b.start.x+u.x*len;b.end.y=b.start.y+u.y*len;
    }else if(c.type==="Perpendicular"){
      const a=sketch.entity(c.entityA),b=sketch.entity(c.entityB);if(!a||!b)throw new Error();
      const u=this.unit(a),len=this.lineLength(b);b.end.x=b.start.x-u.y*len;b.end.y=b.start.y+u.x*len;
    }else if(c.type==="EqualLength"){
      const a=sketch.entity(c.entityA),b=sketch.entity(c.entityB);if(!a||!b)throw new Error();
      const u=this.unit(b),len=this.lineLength(a);b.end.x=b.start.x+u.x*len;b.end.y=b.start.y+u.y*len;
    }else if(c.type==="Concentric"){
      const a=sketch.entity(c.entityA),b=sketch.entity(c.entityB);if(!a||!b)throw new Error();
      const x=(a.center.x+b.center.x)/2,y=(a.center.y+b.center.y)/2;a.center.x=b.center.x=x;a.center.y=b.center.y=y;
    }else if(c.type==="Midpoint"){
      const p=sketch.entity(c.pointEntity),l=sketch.entity(c.lineEntity);if(!p||!l)throw new Error();
      p.point.x=(l.start.x+l.end.x)/2;p.point.y=(l.start.y+l.end.y)/2;
    }else if(c.type==="Coincident"){
      const a=sketch.entity(c.entityA),b=sketch.entity(c.entityB);
      if(!a||!b)throw new Error();
      const pa=this.point(a,c.pointA),pb=this.point(b,c.pointB);
      const x=(pa.x+pb.x)/2,y=(pa.y+pb.y)/2;
      pa.x=x;pa.y=y;pb.x=x;pb.y=y;
    }
  }

  applyDimension(sketch,d){
    const entity=sketch.entity(d.entityId);
    if(!entity)throw new Error();
    if(d.type==="Length"){
      if(entity.type!=="line")throw new Error();
      const dx=entity.end.x-entity.start.x,dy=entity.end.y-entity.start.y;
      const length=Math.hypot(dx,dy);
      if(length<EPS){entity.end.x=entity.start.x+d.value;entity.end.y=entity.start.y}
      else{entity.end.x=entity.start.x+dx/length*d.value;entity.end.y=entity.start.y+dy/length*d.value}
    }else if(d.type==="Horizontal"){
      if(entity.type!=="line")throw new Error();const sign=entity.end.x>=entity.start.x?1:-1;entity.end.x=entity.start.x+sign*d.value;
    }else if(d.type==="Vertical"){
      if(entity.type!=="line")throw new Error();const sign=entity.end.y>=entity.start.y?1:-1;entity.end.y=entity.start.y+sign*d.value;
    }else if(d.type==="Angle"){
      if(entity.type!=="line")throw new Error();const len=this.lineLength(entity)||1,a=d.value*Math.PI/180;entity.end.x=entity.start.x+Math.cos(a)*len;entity.end.y=entity.start.y+Math.sin(a)*len;
    }else if(d.type==="Radius"||d.type==="Diameter"){
      if(entity.type!=="circle")throw new Error();entity.radius=d.type==="Diameter"?d.value/2:d.value;
    }
  }

  estimateDof(sketch){
    let dof=0;
    for(const e of sketch.entities){
      if(e.type==="point")dof+=2;
      else if(e.type==="line")dof+=4;
      else if(e.type==="rectangle")dof+=4;
      else if(e.type==="circle")dof+=3;
    }
    for(const c of sketch.constraints.filter(x=>x.enabled!==false)){
      if(c.type==="Fixed")dof-=4;
      else if(c.type==="Horizontal"||c.type==="Vertical")dof-=1;
      else if(c.type==="Coincident")dof-=2;
      else if(["Parallel","Perpendicular","EqualLength"].includes(c.type))dof-=1;
      else if(c.type==="Concentric"||c.type==="Midpoint")dof-=2;
    }
    dof-=sketch.dimensions.filter(x=>x.enabled!==false).length;
    return Math.max(0,dof);
  }
  diagnose(sketch=this.controller.activeSketch){
    if(!sketch)return[];
    const issues=[],tol=Math.max(.001,(sketch.gridSize||10)*.02);
    const lines=sketch.entities.filter(e=>e.type==="line"&&!e.construction&&e.visible!==false);
    for(const l of lines){const len=this.lineLength(l);if(len<1e-8)issues.push({severity:"error",type:"zero-length",message:`ゼロ長線: ${l.id}`});else if(len<tol)issues.push({severity:"warning",type:"micro-line",message:`微小線分 ${len.toFixed(4)} mm`,entityIds:[l.id]})}
    const endpoints=[];for(const l of lines){endpoints.push({e:l,key:"start",p:l.start},{e:l,key:"end",p:l.end})}
    for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++){const a=endpoints[i],b=endpoints[j];if(a.e.id===b.e.id)continue;const d=Math.hypot(a.p.x-b.p.x,a.p.y-b.p.y);if(d>1e-8&&d<tol)issues.push({severity:"warning",type:"near-endpoints",message:`近接端点 ${d.toFixed(4)} mm`,refs:[a,b]})}
    const counts=new Map();for(const x of endpoints){const k=`${x.p.x.toFixed(5)},${x.p.y.toFixed(5)}`;counts.set(k,(counts.get(k)||0)+1)}
    const open=[...counts.values()].filter(v=>v===1).length;if(open)issues.push({severity:"warning",type:"open-loop",message:`開いた端点: ${open}`});
    if(!issues.length)issues.push({severity:"ok",type:"clean",message:"重大な問題は見つかりませんでした"});
    sketch.diagnostics=issues;return issues
  }
  repairNearEndpoints(){
    const sketch=this.controller.activeSketch;if(!sketch)return 0;
    const issues=this.diagnose(sketch).filter(i=>i.type==="near-endpoints");let n=0;
    for(const issue of issues){const[a,b]=issue.refs,x=(a.p.x+b.p.x)/2,y=(a.p.y+b.p.y)/2;a.p.x=b.p.x=x;a.p.y=b.p.y=y;n++}
    this.solve();return n
  }

}
