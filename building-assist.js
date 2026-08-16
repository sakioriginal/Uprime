function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function centerOf(part){return part && Array.isArray(part.position) ? part.position : [0,0,0];}
function sizeOf(part){
  var p=(part && part.params)?part.params:{};
  var w=p.width!==undefined?p.width:(p.w!==undefined?p.w:1000);
  var d=p.depth!==undefined?p.depth:(p.d!==undefined?p.d:100);
  var h=p.height!==undefined?p.height:(p.h!==undefined?p.h:2400);
  return {w:Math.abs(Number(w))||1000,d:Math.abs(Number(d))||100,h:Math.abs(Number(h))||2400};
}
function lastId(items){return items && items.length ? items[items.length-1].id : null;}

export class BuildingAssistManager{
  constructor(state,addPart,removePart){this.state=state;this.addPart=addPart;this.removePart=removePart||null;this.groundResolver=null;this.ensureState();}
  grounded(point){const p=Array.isArray(point)?point.slice():[0,0,0];try{const q=this.groundResolver?.(p);return Array.isArray(q)?q:p}catch{return p}}
  ensureState(){
    var defaults={mode:'snap',columnSpacing:3000,columnSpacingY:3000,columnCount:4,columnRows:3,axis:'X',wallThickness:120,floorThickness:150,roofThickness:120,roofPitch:20,brickLength:210,brickDepth:100,brickHeight:60,brickMortar:10,autoFoundation:true,foundationWidth:320,foundationMinHeight:250};
    this.state.buildingAssist=this.state.buildingAssist||{};
    Object.keys(defaults).forEach(function(k){if(this.state.buildingAssist[k]===undefined)this.state.buildingAssist[k]=defaults[k];},this);
    return this.state.buildingAssist;
  }
  setMode(mode){var m=String(mode||'snap').toLowerCase();this.ensureState().mode=['off','snap','auto'].indexOf(m)>=0?m:'snap';return this.state.buildingAssist.mode;}
  basePoint(){
    var primary=this.state.primary && this.state.primary();
    if(primary)return centerOf(primary).slice();
    var p=this.state.creator && this.state.creator.lastCreatePosition;
    return Array.isArray(p)?p.slice():[0,0,0];
  }
  _avatarHeightMm(){return Math.max(1000,(Number(this.state.avatar && this.state.avatar.height)||170)*10);}
  _groundZ(x,y,zHint=0){const g=this.grounded([Number(x)||0,Number(y)||0,Number(zHint)||0]);return Number(g?.[2])||0;}
  _siteBaseZ(points,floorT=150){const cfg=this.ensureState();let high=-Infinity;for(const p of points||[])high=Math.max(high,this._groundZ(p[0],p[1],p[2]||0));if(!Number.isFinite(high))high=this._groundZ(this.basePoint()[0],this.basePoint()[1],0);return high+Math.max(20,Number(cfg.foundationMinHeight)||250)+Math.max(10,Number(floorT)||150);}
  _newFoundation(x,y,topZ,index,meta){
    const cfg=this.ensureState(),w=Math.max(60,Number(cfg.foundationWidth)||320),gz=this._groundZ(x,y,topZ),h=Math.max(20,(Number(topZ)||0)-gz);
    const info={enabled:true,primitive:'foundation',layer:'foundation',assist:true,gravityFoundation:true,planetRadial:true,supportIndex:index,groundZ:gz,topZ:Number(topZ)||0};
    if(meta)Object.keys(meta).forEach(k=>info[k]=meta[k]);
    // In the anchored planet tangent frame CAD +Z is the local gravity-up axis. Each
    // support samples its own terrain point, so the pier reaches the surface even on slopes.
    return this.addPart('box',{name:'建築 基礎 '+(index+1),params:{width:w,height:h,depth:w},position:[x,y,gz+h/2],entityKind:'building',components:{building:info},metadata:{walkable:false,gravityAligned:true}},false);
  }
  _foundationGrid(origin,width,depth,baysX,baysY,topZ,meta){const made=[];let i=0;for(let y=0;y<=baysY;y++)for(let x=0;x<=baysX;x++){made.push(this._newFoundation(origin[0]+width*x/baysX,origin[1]+depth*y/baysY,topZ,i++,meta));}return made;}
  _newColumn(position,index,meta){
    var H=this._avatarHeightMm(),section=Math.max(60,H*.07);
    var info={enabled:true,primitive:'column',layer:'column',assist:true,lineIndex:index};
    if(meta)Object.keys(meta).forEach(function(k){info[k]=meta[k];});
    return this.addPart('box',{name:'建築 柱 '+(index+1),params:{width:section,height:H,depth:section},position:[position[0],position[1],position[2]+H/2],entityKind:'building',components:{building:info}},false);
  }
  createColumnLine(options){
    options=options||{};var cfg=this.ensureState();
    var rawCount=options.count!==undefined?options.count:cfg.columnCount;
    var rawSpacing=options.spacing!==undefined?options.spacing:cfg.columnSpacing;
    var rawAxis=options.axis!==undefined?options.axis:cfg.axis;
    var n=clamp(Math.round(Number(rawCount)||4),2,100);
    var step=Math.max(.001,Number(rawSpacing)||3000);
    var a=String(rawAxis||'X').toUpperCase();
    var origin=this.grounded(Array.isArray(options.start)?options.start:this.basePoint()),made=[];
    for(var i=0;i<n;i++){
      var p=origin.slice();if(a==='Y')p[1]+=i*step;else p[0]+=i*step;
      made.push(this._newColumn(p,i,{layout:'line',axis:a,spacing:step}));
    }
    this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);return made;
  }
  createColumnGrid(options){
    options=options||{};var cfg=this.ensureState();
    var cols=clamp(Math.round(Number(options.cols!==undefined?options.cols:cfg.columnCount)||4),2,30);
    var rows=clamp(Math.round(Number(options.rows!==undefined?options.rows:cfg.columnRows)||3),2,30);
    var sx=Math.max(.001,Number(options.spacingX!==undefined?options.spacingX:cfg.columnSpacing)||3000);
    var sy=Math.max(.001,Number(options.spacingY!==undefined?options.spacingY:cfg.columnSpacingY)||3000);
    var origin=this.grounded(Array.isArray(options.start)?options.start:this.basePoint()),made=[],idx=0;
    for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){
      var p=[origin[0]+x*sx,origin[1]+y*sy,origin[2]];
      made.push(this._newColumn(p,idx++,{layout:'grid',gridX:x,gridY:y,spacingX:sx,spacingY:sy}));
    }
    this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);return made;
  }
  _selectedColumns(){
    var objs=this.state.selectedObjects?this.state.selectedObjects():[];
    return objs.filter(function(o){return !!(o && o.components && o.components.building && o.components.building.primitive==='column')||/柱|column/i.test((o&&o.name)||'');});
  }
  _makeWall(a,b,index){
    var cfg=this.ensureState(),pa=centerOf(a),pb=centerOf(b),sa=sizeOf(a),sb=sizeOf(b),dx=pb[0]-pa[0],dy=pb[1]-pa[1],dist=Math.hypot(dx,dy);if(dist<1e-6)return null;
    var h=Math.max(sa.h,sb.h),th=Math.max(10,Number(cfg.wallThickness)||120),ang=Math.atan2(dy,dx)*180/Math.PI;
    return this.addPart('box',{name:'建築 壁 '+(index+1),params:{width:dist,height:h,depth:th},position:[(pa[0]+pb[0])/2,(pa[1]+pb[1])/2,Math.max(pa[2]-sa.h/2,pb[2]-sb.h/2)+h/2],rotation:[0,0,ang],entityKind:'building',components:{building:{enabled:true,primitive:'wall',layer:'wall',assist:true,between:[a.id,b.id]}}},false);
  }
  wallBetweenSelected(){
    var cols=this._selectedColumns();if(cols.length<2)throw new Error('柱を2本以上選択してください');var made=[];
    var sorted=cols.slice().sort(function(a,b){return a.position[0]-b.position[0]||a.position[1]-b.position[1];});
    for(var i=0;i<sorted.length-1;i++){var wall=this._makeWall(sorted[i],sorted[i+1],i);if(wall)made.push(wall);}
    this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);return made;
  }
  wallPerimeterFromSelection(){
    var cols=this._selectedColumns();if(cols.length<4)throw new Error('外周壁には柱を4本以上選択してください');
    var xs=cols.map(function(o){return centerOf(o)[0];}),ys=cols.map(function(o){return centerOf(o)[1];});
    var minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys);
    function nearest(x,y){return cols.slice().sort(function(a,b){var pa=centerOf(a),pb=centerOf(b);return Math.hypot(pa[0]-x,pa[1]-y)-Math.hypot(pb[0]-x,pb[1]-y);})[0];}
    var corners=[nearest(minX,minY),nearest(maxX,minY),nearest(maxX,maxY),nearest(minX,maxY)],made=[];
    for(var i=0;i<4;i++){var w=this._makeWall(corners[i],corners[(i+1)%4],i);if(w)made.push(w);}
    this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);return made;
  }
  floorFromSelection(){
    var items=this.state.selectedObjects?this.state.selectedObjects():[];if(!items.length)throw new Error('柱・壁などを選択してください');var cfg=this.ensureState();var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity;
    items.forEach(function(o){var p=centerOf(o),s=sizeOf(o);minX=Math.min(minX,p[0]-s.w/2);maxX=Math.max(maxX,p[0]+s.w/2);minY=Math.min(minY,p[1]-s.d/2);maxY=Math.max(maxY,p[1]+s.d/2);minZ=Math.min(minZ,p[2]-s.h/2);});
    var t=Math.max(10,Number(cfg.floorThickness)||150);return this.addPart('box',{name:'建築 床 自動フィット',params:{width:maxX-minX,height:t,depth:maxY-minY},position:[(minX+maxX)/2,(minY+maxY)/2,minZ-t/2],entityKind:'building',components:{building:{enabled:true,primitive:'floor',layer:'floor',assist:true,fitTo:items.map(function(x){return x.id;})}}});
  }
  createSmartBuilding(options){
    options=options||{};var cfg=this.ensureState();
    var width=Math.max(500,Number(options.width!==undefined?options.width:6000)||6000);
    var depth=Math.max(500,Number(options.depth!==undefined?options.depth:6000)||6000);
    var floors=clamp(Math.round(Number(options.floors!==undefined?options.floors:1)||1),1,20);
    var baysX=clamp(Math.round(Number(options.baysX!==undefined?options.baysX:3)||3),1,20);
    var baysY=clamp(Math.round(Number(options.baysY!==undefined?options.baysY:3)||3),1,20);
    var story=Math.max(1000,Number(options.storyHeight!==undefined?options.storyHeight:this._avatarHeightMm())||this._avatarHeightMm());
    var raw=Array.isArray(options.start)?options.start:this.basePoint(),origin=[Number(raw[0])||0,Number(raw[1])||0,Number(raw[2])||0];
    var sx=width/baysX,sy=depth/baysY,made=[],columns=[],floorT=Math.max(10,Number(cfg.floorThickness)||150),supportPts=[];
    for(var yy=0;yy<=baysY;yy++)for(var xx=0;xx<=baysX;xx++)supportPts.push([origin[0]+xx*sx,origin[1]+yy*sy,origin[2]]);
    // The common building datum is set from the highest terrain sample. The building stays
    // level while individual gravity foundations extend down to their own terrain heights.
    origin[2]=this._siteBaseZ(supportPts,floorT);
    if(cfg.autoFoundation!==false)made.push(...this._foundationGrid(origin,width,depth,baysX,baysY,origin[2]-floorT,{smartBuilding:true,floorIndex:0}));
    for(var f=0;f<floors;f++){
      var baseZ=origin[2]+f*story;
      var floor=this.addPart('box',{name:'建築 Floor '+(f+1),params:{width:width,height:floorT,depth:depth},position:[origin[0]+width/2,origin[1]+depth/2,baseZ-floorT/2],entityKind:'building',components:{building:{enabled:true,primitive:'floor',layer:'floor',assist:true,smartBuilding:true,floorIndex:f,foundationDatumZ:origin[2]}}},false);made.push(floor);
      for(var y=0;y<=baysY;y++)for(var x=0;x<=baysX;x++){var c=this._newColumn([origin[0]+x*sx,origin[1]+y*sy,baseZ],columns.length,{layout:'smart',floorIndex:f,gridX:x,gridY:y,spacingX:sx,spacingY:sy});columns.push(c);made.push(c);}
      var corner=function(x,y){return {id:'virtual',name:'virtual',position:[x,y,baseZ+story/2],params:{width:1,depth:1,height:story}};};
      var c0=corner(origin[0],origin[1]),c1=corner(origin[0]+width,origin[1]),c2=corner(origin[0]+width,origin[1]+depth),c3=corner(origin[0],origin[1]+depth);
      [ [c0,c1],[c1,c2],[c2,c3],[c3,c0] ].forEach(function(pair,i){var w=this._makeWall(pair[0],pair[1],made.length+i);if(w){w.components.building.smartBuilding=true;w.components.building.floorIndex=f;made.push(w);}},this);
    }
    var roofT=Math.max(10,Number(cfg.roofThickness)||120),pitch=Number(options.roofPitch!==undefined?options.roofPitch:cfg.roofPitch)||0,top=origin[2]+floors*story;
    var roof=this.addPart('box',{name:'建築 Roof',params:{width:width*1.04,height:roofT,depth:depth*1.04},position:[origin[0]+width/2,origin[1]+depth/2,top+roofT/2],rotation:[0,pitch,0],entityKind:'building',components:{building:{enabled:true,primitive:'roof',layer:'roof',assist:true,smartBuilding:true,pitch:pitch}}},false);made.push(roof);
    this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);
    return made;
  }
  createBrickWall(options){
    options=options||{};var cfg=this.ensureState(),origin=Array.isArray(options.start)?options.start:this.basePoint();
    var length=Math.max(100,Number(options.length!==undefined?options.length:3000)||3000),height=Math.max(60,Number(options.height!==undefined?options.height:this._avatarHeightMm())||this._avatarHeightMm());
    var brickL=Math.max(20,Number(options.brickLength!==undefined?options.brickLength:cfg.brickLength)||210),brickD=Math.max(20,Number(options.brickDepth!==undefined?options.brickDepth:cfg.brickDepth)||100),brickH=Math.max(20,Number(options.brickHeight!==undefined?options.brickHeight:cfg.brickHeight)||60),mortar=Math.max(0,Number(options.mortar!==undefined?options.mortar:cfg.brickMortar)||10),axis=String(options.axis||cfg.axis||'X').toUpperCase();
    var courseH=brickH+mortar,courses=Math.max(1,Math.floor(height/courseH)),made=[],idx=0;
    for(var row=0;row<courses;row++){
      var offset=(row%2)*(brickL+mortar)/2,pos=offset;
      while(pos<length){var remaining=length-pos,actual=Math.min(brickL,remaining);if(actual<brickL*.25)break;var p=origin.slice();if(axis==='Y')p[1]+=pos+actual/2;else p[0]+=pos+actual/2;p[2]+=row*courseH+brickH/2;
        var part=this.addPart('box',{name:'レンガ '+(++idx),params:{width:axis==='Y'?brickD:actual,height:brickH,depth:axis==='Y'?actual:brickD},position:p,entityKind:'building',components:{building:{enabled:true,primitive:'brick',layer:'wall',assist:true,brickCourse:row,brickIndex:idx,bond:'running'}}},false);made.push(part);pos+=actual+mortar;}
    }
    this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);return made;
  }
  createFromFloorPlan(text,options){
    options=options||{};const cfg=this.ensureState(),raw=Array.isArray(options.start)?options.start:this.basePoint(),origin=[Number(raw[0])||0,Number(raw[1])||0,Number(raw[2])||0],story=Math.max(1000,Number(options.storyHeight)||2800),wallT=Math.max(10,Number(cfg.wallThickness)||120),floorT=Math.max(10,Number(cfg.floorThickness)||150),made=[];
    const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
    if(!lines.length)throw new Error('間取りを入力してください。例: Living,0,0,4000,3000');
    let ri=0,rooms=[];for(const line of lines){const a=line.split(',').map(x=>x.trim());if(a.length<5)continue;rooms.push({name:a[0]||`Room${++ri}`,x:Number(a[1])||0,y:Number(a[2])||0,w:Math.max(300,Number(a[3])||3000),d:Math.max(300,Number(a[4])||3000)});}
    if(!rooms.length)throw new Error('間取りを解析できません。部屋名,X,Y,幅,奥行 の形式で入力してください');
    const pts=[];for(const r of rooms)for(const [dx,dy] of [[0,0],[r.w,0],[0,r.d],[r.w,r.d]])pts.push([origin[0]+r.x+dx,origin[1]+r.y+dy,origin[2]]);
    const z=this._siteBaseZ(pts,floorT),seen=new Set();
    for(const r of rooms){
      const floor=this.addPart('box',{name:`間取り ${r.name} 床`,params:{width:r.w,height:floorT,depth:r.d},position:[origin[0]+r.x+r.w/2,origin[1]+r.y+r.d/2,z-floorT/2],entityKind:'building',components:{building:{enabled:true,primitive:'floor',layer:'floor',assist:true,floorPlan:true,room:r.name,foundationDatumZ:z}}},false);made.push(floor);
      const wall=(cx,cy,len,ang,label)=>this.addPart('box',{name:`間取り ${r.name} 壁 ${label}`,params:{width:len,height:story,depth:wallT},position:[origin[0]+cx,origin[1]+cy,z+story/2],rotation:[0,0,ang],entityKind:'building',components:{building:{enabled:true,primitive:'wall',layer:'wall',assist:true,floorPlan:true,room:r.name}}},false);
      made.push(wall(r.x+r.w/2,r.y,r.w,0,'S'),wall(r.x+r.w/2,r.y+r.d,r.w,0,'N'),wall(r.x,r.y+r.d/2,r.d,90,'W'),wall(r.x+r.w,r.y+r.d/2,r.d,90,'E'));
      if(cfg.autoFoundation!==false){for(const [dx,dy] of [[0,0],[r.w,0],[0,r.d],[r.w,r.d]]){const x=origin[0]+r.x+dx,y=origin[1]+r.y+dy,key=`${x.toFixed(3)}:${y.toFixed(3)}`;if(seen.has(key))continue;seen.add(key);made.push(this._newFoundation(x,y,z-floorT,seen.size-1,{floorPlan:true,room:r.name}));}}
    }
    this.state.selectedIds=made.map(o=>o.id);this.state.primaryId=lastId(made);return made;
  }
  normalizeGroupFoundations(items){
    const all=(items||[]).filter(Boolean),found=all.filter(o=>o?.components?.building?.primitive==='foundation'),body=all.filter(o=>o?.components?.building?.primitive!=='foundation');
    if(!found.length)return {lift:0,foundations:[],items:body};
    const cfg=this.ensureState(),minH=Math.max(20,Number(cfg.foundationMinHeight)||250);
    let currentTop=-Infinity,highest=-Infinity;
    for(const f of found){const p=centerOf(f),sz=sizeOf(f);currentTop=Math.max(currentTop,Number(f.components?.building?.topZ));if(!Number.isFinite(currentTop))currentTop=p[2]+sz.h/2;highest=Math.max(highest,this._groundZ(p[0],p[1],p[2]));}
    if(!Number.isFinite(currentTop))currentTop=0;if(!Number.isFinite(highest))highest=0;const desired=highest+minH,dz=desired-currentTop;
    for(const o of body){o.position[2]=(Number(o.position?.[2])||0)+dz;if(o.components?.building)o.components.building.foundationDatumZ=desired;}
    for(const f of found){const p=centerOf(f),gz=this._groundZ(p[0],p[1],desired),h=Math.max(20,desired-gz);f.params=f.params||{};f.params.height=h;f.position[2]=gz+h/2;f.components.building.groundZ=gz;f.components.building.topZ=desired;f.components.building.foundationDatumZ=desired;}
    return {lift:dz,foundations:found,items:body};
  }
  createFoundationsForSelection(){
    const items=(this.state.selectedObjects?this.state.selectedObjects():[]).filter(o=>o?.components?.building&&o.components.building.primitive!=='foundation'&&!o.components.building.ghostPreview);
    if(!items.length)throw new Error('基礎を作る建築物を選択してください');
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,bottom=Infinity;for(const o of items){const p=centerOf(o),sz=sizeOf(o);minX=Math.min(minX,p[0]-sz.w/2);maxX=Math.max(maxX,p[0]+sz.w/2);minY=Math.min(minY,p[1]-sz.d/2);maxY=Math.max(maxY,p[1]+sz.d/2);bottom=Math.min(bottom,p[2]-sz.h/2);}
    const pts=[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]],grounds=pts.map(p=>this._groundZ(p[0],p[1],bottom)),floorT=Math.max(10,Number(this.ensureState().floorThickness)||150),desired=Math.max(bottom,Math.max(...grounds)+Math.max(20,Number(this.ensureState().foundationMinHeight)||250));
    const dz=desired-bottom;for(const o of items){o.position[2]=(Number(o.position?.[2])||0)+dz;o.components.building.foundationDatumZ=desired;}
    const made=pts.map((p,i)=>this._newFoundation(p[0],p[1],desired,i,{retrofit:true}));
    this.state.selectedIds=made.map(o=>o.id);this.state.primaryId=lastId(made);return {foundations:made,lift:dz,items};
  }
  analyzeSelection(){
    var items=this.state.selectedObjects?this.state.selectedObjects():[];if(!items.length)return null;
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
    items.forEach(function(o){var p=centerOf(o),s=sizeOf(o);minX=Math.min(minX,p[0]-s.w/2);maxX=Math.max(maxX,p[0]+s.w/2);minY=Math.min(minY,p[1]-s.d/2);maxY=Math.max(maxY,p[1]+s.d/2);minZ=Math.min(minZ,p[2]-s.h/2);maxZ=Math.max(maxZ,p[2]+s.h/2);});
    return {width:maxX-minX,depth:maxY-minY,height:maxZ-minZ,center:[(minX+maxX)/2,(minY+maxY)/2,(minZ+maxZ)/2],count:items.length};
  }
  setLayerVisible(layer,visible){
    var key=String(layer||'').toLowerCase();var n=0;
    (this.state.parts||[]).forEach(function(o){var b=o&&o.components&&o.components.building;if(b&&String(b.layer||b.primitive||'').toLowerCase()===key){o.visible=!!visible;n++;}});return n;
  }


  clearPreview(){
    var ghosts=(this.state.objects||[]).filter(function(o){return !!(o&&o.components&&o.components.building&&o.components.building.ghostPreview);});
    if(this.removePart){for(var i=0;i<ghosts.length;i++)this.removePart(ghosts[i]);}
    else {var ids={};ghosts.forEach(function(o){ids[o.id]=true;});this.state.objects=(this.state.objects||[]).filter(function(o){return !ids[o.id];});}
    this.state.buildingAssist.previewIds=[];return ghosts.length;
  }
  previewSmartBuilding(options){
    this.clearPreview();
    var oldSelected=(this.state.selectedIds||[]).slice(),oldPrimary=this.state.primaryId;
    var made=this.createSmartBuilding(options||{});
    for(var i=0;i<made.length;i++){
      var o=made[i];o.opacity=.24;o.color=0x55d7ff;o.physics=o.physics||{};o.physics.enabled=false;
      o.components=o.components||{};o.components.building=o.components.building||{};o.components.building.ghostPreview=true;o.components.building.previewState='candidate';
      if(o.mesh&&o.mesh.material){o.mesh.material.transparent=true;o.mesh.material.opacity=.24;o.mesh.material.depthWrite=false;o.mesh.material.color.set(0x55d7ff);}
    }
    this.state.buildingAssist.previewIds=made.map(function(o){return o.id;});this.state.selectedIds=oldSelected;this.state.primaryId=oldPrimary;return made;
  }
  commitPreview(){
    var ids=this.ensureState().previewIds||[],map={};ids.forEach(function(id){map[id]=true;});var made=[];
    (this.state.objects||[]).forEach(function(o){if(!map[o.id])return;o.opacity=1;o.color=0x88a9bf;if(o.components&&o.components.building){o.components.building.ghostPreview=false;o.components.building.previewState='committed';}if(o.mesh&&o.mesh.material){o.mesh.material.transparent=false;o.mesh.material.opacity=1;o.mesh.material.depthWrite=true;o.mesh.material.color.set(o.color);}made.push(o);});
    this.state.buildingAssist.previewIds=[];this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);return made;
  }
  layerSummary(){var out={column:0,wall:0,floor:0,roof:0};(this.state.objects||[]).forEach(function(o){var b=o&&o.components&&o.components.building;if(b&&out[b.layer]!==undefined&&!b.ghostPreview)out[b.layer]++;});return out;}

  roofFromSelection(){
    var items=this.state.selectedObjects?this.state.selectedObjects():[];if(!items.length)throw new Error('柱・壁などを選択してください');var cfg=this.ensureState();var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,maxTop=-Infinity;
    items.forEach(function(o){var p=centerOf(o),s=sizeOf(o);minX=Math.min(minX,p[0]-s.w/2);maxX=Math.max(maxX,p[0]+s.w/2);minY=Math.min(minY,p[1]-s.d/2);maxY=Math.max(maxY,p[1]+s.d/2);maxTop=Math.max(maxTop,p[2]+s.h/2);});
    var t=Math.max(10,Number(cfg.roofThickness)||120),pitch=Number(cfg.roofPitch)||20;
    return this.addPart('box',{name:'建築 屋根 自動フィット',params:{width:(maxX-minX)*1.05,height:t,depth:(maxY-minY)*1.05},position:[(minX+maxX)/2,(minY+maxY)/2,maxTop+t/2],rotation:[0,pitch,0],entityKind:'building',components:{building:{enabled:true,primitive:'roof',layer:'roof',assist:true,fitTo:items.map(function(x){return x.id;}),pitch:pitch}}});
  }
}
