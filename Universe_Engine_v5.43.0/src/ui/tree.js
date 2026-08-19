import {classifyEntity} from "../core/component-system.js";
export function renderTree(root,state,callbacks){
 if(!root||!state)return;
 root.innerHTML="";
 const sketchesList=Array.isArray(state.sketches)?state.sketches:[];
 const groupsList=Array.isArray(state.groups)?state.groups:[];
 const objectsList=Array.isArray(state.objects)?state.objects:[];
 const datum=document.createElement("div");datum.className="treeBranch datumBranch";
 datum.innerHTML=`<div class="treeBranchHeader"><button class="treeChevron">▾</button><span>◎</span><span class="name">基準要素</span></div><div class="treeChildren"></div>`;
 const datumDefs=[
  ["origin","⊙","原点 (0, 0, 0)",""],["xAxis","━","X軸","axisX"],["yAxis","━","Y軸","axisY"],["zAxis","┃","Z軸","axisZ"],
  ["xyPlane","▱","XY基準平面",""],["xzPlane","▱","XZ基準平面",""],["yzPlane","▱","YZ基準平面",""]
 ];
 const datumChildren=datum.querySelector('.treeChildren');
 for(const [id,icon,label,cls] of datumDefs){
  const row=document.createElement('div');row.className=`datumItem ${cls} ${state.selectedDatumId===id?'selected':''} ${state.datumVisibility?.[id]===false?'hidden':''}`;
  row.innerHTML=`<span>${icon}</span><span>${label}</span><button class="mini eye">${state.datumVisibility?.[id]===false?'○':'●'}</button>`;
  row.onclick=e=>{if(e.target.closest('button'))return;callbacks.selectDatum?.(id)};
  row.querySelector('.eye').onclick=e=>{e.stopPropagation();callbacks.toggleDatum?.(id)};
  datumChildren.appendChild(row);
 }
 datum.querySelector('.treeBranchHeader').onclick=()=>datum.classList.toggle('collapsed');root.appendChild(datum);
 // v5.12.7 Special objects are first-class selectable tree entries.
 const special=document.createElement('div');special.className='treeBranch specialBranch';
 special.innerHTML=`<div class="treeBranchHeader"><button class="treeChevron">▾</button><span>◆</span><span class="name">特殊オブジェクト</span></div><div class="treeChildren"></div>`;
 const specialChildren=special.querySelector('.treeChildren');
 const addSpecialFolder=(label,icon,rows)=>{const folder=document.createElement('div');folder.className='treeSubBranch collapsed';const h=document.createElement('div');h.className='treeSubHeader';h.innerHTML=`<button class="mini treeChevron">▸</button><span>${icon}</span><span class="name">${label}</span><span class="help">${rows.length}</span>`;const b=document.createElement('div');b.className='treeSubChildren';h.onclick=()=>{folder.classList.toggle('collapsed');h.querySelector('.treeChevron').textContent=folder.classList.contains('collapsed')?'▸':'▾'};for(const r of rows)b.appendChild(r);folder.append(h,b);specialChildren.appendChild(folder)};
 const specialRow=(id,icon,label,help='')=>{const row=document.createElement('div');row.className=`treeItem specialItem ${state.specialSelection===id?'selected':''}`;row.innerHTML=`<span>·</span><span>${icon}</span><span class="name">${label}</span><span class="help">${help}</span>`;row.onclick=e=>{e.stopPropagation();callbacks.selectSpecial?.(id)};return row};
 addSpecialFolder('ワールド','🌍',[specialRow('special:planet','🌍','惑星','Planet / Terrain'),specialRow('special:camera','📷','カメラ','View Camera'),specialRow('special:grid','#','グリッド','Creator Grid')]);
 addSpecialFolder('キャラクター','人',[specialRow('special:avatar','人','アバター',state.avatar?.name||'Player')]);
 const npcRows=(state.characters||[]).map(n=>{const life=n.life||{},v=(state.villages||[]).find(x=>x.id===n.villageId),hp=Math.round(n.vitals?.hp??100),maxHp=Math.round(n.vitals?.maxHp??100),activity=life.activityLabel||life.state||'待機';const row=document.createElement('div');row.className='treeItem specialItem npcStatusItem';row.innerHTML=`<span>·</span><span>🧑</span><span class="name">${n.name||n.id}</span><span class="help">${n.occupation||n.role||'村人'} / ${activity} / ❤️${hp}/${maxHp}${life.destinationLabel?` → ${life.destinationLabel}`:''}${v?` / ${v.name}`:''}</span><button class="mini npcTalk">💬</button>`;row.onclick=e=>{e.stopPropagation();if(e.target.closest('button'))return;callbacks.openNpc?.(n.id)};row.querySelector('.npcTalk').onclick=e=>{e.stopPropagation();callbacks.openNpc?.(n.id)};return row});
 if(npcRows.length)addSpecialFolder('村人 / NPC','🧑',npcRows);
 addSpecialFolder('作業環境','🛠',(state.workbenches||[]).map(w=>specialRow(`special:workbench:${w.id}`,'🛠',w.name||w.id,w.stored?'収納中':(w.active?'ACTIVE':'設置'))));
 const signageRows=objectsList.filter(o=>o.metadata?.surfaceArt).map(o=>{const art=o.metadata.surfaceArt||{},type=String(art.mediaType||'image').toUpperCase(),light=String(art.lightMode||'none'),rot=[0,90,180,270].includes(Number(art.rotationDeg))?Number(art.rotationDeg):180;const row=document.createElement('div');row.className=`treeItem specialItem ${o.id===state.primaryId?'selected':''}`;row.innerHTML=`<span>·</span><span>📺</span><span class="name">${o.name||'看板'}</span><span class="help">${type} / ↻${rot}°${light!=='none'?` / 💡${light}`:''}</span><button class="mini editSign">編集</button>`;row.onclick=e=>{e.stopPropagation();if(e.target.closest('button'))return;callbacks.editSurfaceArt?.(o)};row.querySelector('.editSign').onclick=e=>{e.stopPropagation();callbacks.editSurfaceArt?.(o)};return row});
 if(signageRows.length)addSpecialFolder('看板 / メディア','📺',signageRows);
 const cats=Object.values(state.planet?.celestialCatalog||{}).slice(0,80).map(c=>specialRow(`special:celestial:${c.id}`,'✦',c.name||c.id,c.type||''));
 if(cats.length)addSpecialFolder('天体','✦',cats);
 special.querySelector('.treeBranchHeader').onclick=()=>special.classList.toggle('collapsed');root.appendChild(special);
 const rendered=new Set();
 const item=o=>{const wrap=document.createElement('div');wrap.className='treeBranch partBranch';
   const d=document.createElement("div");d.className=`treeItem ${o.id===state.primaryId?"selected":(Array.isArray(state.selectedIds)&&state.selectedIds.includes(o.id))?"multi":""} ${o.visible===false?"hidden":""}`;
   const sketches=sketchesList.filter(s=>s.ownerPartId===o.id);const partDatums=Array.isArray(o.datums)?o.datums:[];const geometryConstraints=Array.isArray(o.geometryConstraints)?o.geometryConstraints:[];const motionAxes=Array.isArray(o.motionAxes)?o.motionAxes:[];const sockets=Array.isArray(o.sockets)?o.sockets:[];
   const kind=classifyEntity(o),kindIcon=kind==='npc'?'🧠':kind==='character'?'♡':kind==='vehicle'?'🚗':kind==='building'?'⌂':'';
   d.innerHTML=`<button class="mini treeChevron">${(sketches.length||partDatums.length||geometryConstraints.length||motionAxes.length||sockets.length)?'▾':'·'}</button><span>${kindIcon||o.type}</span><span class="name">${o.name}</span><span class="help">${o.objectId||o.id}${o.groupCode?` / @${o.groupCode}`:""} / ${o.features?.length||1}F</span><button class="mini eye">${o.visible===false?"○":"●"}</button>`;
   d.onclick=e=>{if(e.target.closest('button'))return;callbacks.select(o.id,e.shiftKey)};
   d.querySelector('.eye').onclick=e=>{e.stopPropagation();callbacks.toggle(o)};
   const children=document.createElement('div');children.className='treeChildren';
   const addFolder=(label,icon,items,{collapsed=false}={})=>{if(!items.length)return;const folder=document.createElement('div');folder.className=`treeSubBranch ${collapsed?'collapsed':''}`;const header=document.createElement('div');header.className='treeSubHeader';header.innerHTML=`<button class="mini treeChevron">${collapsed?'▸':'▾'}</button><span>${icon}</span><span class="name">${label}</span><span class="help">${items.length}</span>`;const body=document.createElement('div');body.className='treeSubChildren';header.onclick=e=>{e.stopPropagation();folder.classList.toggle('collapsed');header.querySelector('.treeChevron').textContent=folder.classList.contains('collapsed')?'▸':'▾'};for(const node of items)body.appendChild(node);folder.append(header,body);children.appendChild(folder)};
   const datumRow=pd=>{const row=document.createElement('div');row.className=`sketchTreeItem datumTreeItem ${pd.system?'primaryDatum':'derivedDatum'} ${pd.visible===false?'hidden':''} ${pd.selected?'selected':''}`;const ref=pd.system?'部品基準':(pd.reference?.kind==='between'?'中間参照':'参照');row.innerHTML=`<span>${pd.type==='point'?'⊙':pd.type==='axis'?'↗':'▱'}</span><span class="name">${pd.name}</span><span class="help">${pd.orientation||''} / ${ref}</span><button class="mini datumEye" title="表示・非表示">${pd.visible===false?'○':'●'}</button>`;row.onclick=e=>{if(e.target.closest('button'))return;callbacks.selectPartDatum?.(o,pd)};row.querySelector('.datumEye').onclick=e=>{e.stopPropagation();callbacks.togglePartDatum?.(o,pd)};return row};
   const primaryDatums=partDatums.filter(pd=>pd.system).map(datumRow);const derivedDatums=partDatums.filter(pd=>!pd.system).map(datumRow);
   addFolder('基本ジオメトリ','⌖',primaryDatums,{collapsed:true});
   addFolder('作成ジオメトリ','◇',derivedDatums,{collapsed:false});
   const constraintRows=geometryConstraints.map(gc=>{const row=document.createElement('div');row.className='sketchTreeItem constraintTreeItem';const target=partDatums.find(d=>d.id===gc.targetDatumId);row.innerHTML=`<span>⊥</span><span class="name">${gc.type}: ${target?.name||'Datum'}</span><span class="help">${gc.reference}${['distance','angle'].includes(gc.type)?` / ${gc.value}`:''}</span>`;return row});
   addFolder('幾何拘束','⊥',constraintRows,{collapsed:false});
   const axisRows=motionAxes.map(a=>{const row=document.createElement('div');row.className='sketchTreeItem';row.innerHTML=`<span>↻</span><span class="name">${a.name}</span><span class="help">${a.type} / ${Number(a.value||0).toFixed(2)}</span>`;row.onclick=()=>callbacks.selectMotionAxis?.(o,a);return row});addFolder('可動軸','↻',axisRows,{collapsed:false});
   const socketRows=sockets.map(a=>{const row=document.createElement('div');row.className='sketchTreeItem';row.innerHTML=`<span>⌾</span><span class="name">${a.name}</span><span class="help">${a.type}</span>`;row.onclick=()=>callbacks.selectSocket?.(o,a);return row});addFolder('ソケット','⌾',socketRows,{collapsed:true});
   const sketchRows=sketches.map(sk=>{sk.ensureEntityCodes?.();const row=document.createElement('div');row.className='sketchTreeItem';const ids=(sk.entities||[]).slice(0,4).map(e=>e.code).filter(Boolean).join(', ');row.innerHTML=`<span>✎</span><span class="name">${sk.name}</span><span class="help">${sk.plane||"XY"} / ${Array.isArray(sk.entities)?sk.entities.length:0}要素${ids?` / ${ids}${sk.entities.length>4?'…':''}`:''}</span><button class="mini editSketch">編集</button>`;row.ondblclick=()=>callbacks.editSketch?.(sk);row.querySelector('.editSketch').onclick=()=>callbacks.editSketch?.(sk);return row});
   addFolder('スケッチ','✎',sketchRows,{collapsed:false});
   d.querySelector('.treeChevron').onclick=e=>{e.stopPropagation();if(sketches.length||partDatums.length||geometryConstraints.length||motionAxes.length||sockets.length)wrap.classList.toggle('collapsed')};wrap.append(d,children);root.appendChild(wrap);rendered.add(o.id)};
 for(const g of groupsList){const h=document.createElement("div");h.className="groupHeader";h.innerHTML=`<span>Group</span><span class="name">${g.name}</span><span class="help"> @${g.groupCode||g.id}</span>`;h.onclick=()=>callbacks.selectGroup(g);root.appendChild(h);g.memberIds.map(id=>state.object(id)).filter(Boolean).forEach(item)}
 objectsList.filter(o=>!rendered.has(o.id)).forEach(item);
 const orphans=sketchesList.filter(s=>!s.ownerPartId||!state.object(s.ownerPartId));if(orphans.length){const h=document.createElement('div');h.className='groupHeader';h.innerHTML='<span>✎</span><span class="name">未所属スケッチ</span>';root.appendChild(h);for(const sk of orphans){const row=document.createElement('div');row.className='sketchTreeItem';row.innerHTML=`<span>✎</span><span class="name">${sk.name}</span><span class="help">${sk.plane||"XY"}</span><button class="mini editSketch">編集</button>`;row.querySelector('.editSketch').onclick=()=>callbacks.editSketch?.(sk);root.appendChild(row)}}
 // Collapse the ordinary model/group area separately from special objects.
 const modelNodes=[...root.children].filter(n=>n!==datum&&n!==special);
 if(modelNodes.length){const modelBranch=document.createElement('div');modelBranch.className='treeBranch modelBranch';modelBranch.innerHTML=`<div class="treeBranchHeader"><button class="treeChevron">▾</button><span>▣</span><span class="name">モデル / 部品</span><span class="help">${objectsList.length}</span></div><div class="treeChildren"></div>`;const body=modelBranch.querySelector('.treeChildren');for(const n of modelNodes)body.appendChild(n);modelBranch.querySelector('.treeBranchHeader').onclick=()=>modelBranch.classList.toggle('collapsed');root.appendChild(modelBranch)}
}
