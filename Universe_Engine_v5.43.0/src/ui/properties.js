import {ensureComponents,setComponent,entityLabel} from "../core/component-system.js";
import {ensureEntity} from "../core/entity-system.js";

export function nfield(label,path,value,step=.1){
  const n=Number.isFinite(Number(value))?Number(value):0;
  return `<div class="field"><label>${label}</label><input class="num" data-path="${path}" type="number" value="${n}" step="${step}"></div>`;
}

function setPath(obj,path,value){
  const keys=path.split(".");
  let target=obj;
  for(let i=0;i<keys.length-1;i++)target=target[keys[i]];
  target[keys.at(-1)]=value;
}

function selectionSection(summary){
  if(!summary||summary.mode==="body")return "";

  const labels={
    face:"面",
    edge:"辺",
    vertex:"頂点"
  };

  let details="";
  if(summary.mode==="face"){
    details=`<div>合計面積</div><strong>${Number(summary.area||0).toFixed(3)} mm²</strong>
    <div>境界辺</div><strong>${summary.boundaryEdges||0}</strong>`;
  }else if(summary.mode==="edge"){
    details=`<div>合計長さ</div><strong>${Number(summary.length||0).toFixed(3)} mm</strong>
    <div>接続面</div><strong>${summary.adjacentFaces||0}</strong>`;
  }else if(summary.mode==="vertex"){
    const first=summary.points?.[0]||[0,0,0];
    details=`<div>先頭座標</div><strong>${first.map(v=>Number(v).toFixed(3)).join(", ")}</strong>
    <div>接続辺</div><strong>${summary.connectedEdges||0}</strong>`;
  }

  return `<div class="section">
    <h3>要素選択</h3>
    <div class="selectionInfo">
      <div>モード</div><strong>${labels[summary.mode]}</strong>
      <div>選択数</div><strong>${summary.count}</strong>
      ${details}
    </div>
  </div>`;
}

export function renderProperties(root,state,scene,onChanged,selectionSummary=null){
  const object=state.primary();

  if(!object){
    root.innerHTML=selectionSection(selectionSummary)||'<div class="empty">部品を選択してください。</div>';
    return;
  }

  const shape=object.type==="box"
    ? nfield("幅","params.width",object.params.width)+
      nfield("高さ","params.height",object.params.height)+
      nfield("奥行","params.depth",object.params.depth)
    : nfield("半径","params.radius",object.params.radius)+
      nfield("高さ","params.height",object.params.height||0);

  root.innerHTML=`
    ${selectionSection(selectionSummary)}
    <div class="section">
      <h3>基本</h3>
      <div class="field"><label>名前</label><input id="partName" value="${object.name}"></div>
      <div class="field"><label>Object ID</label><input id="objectPublicId" value="${object.objectId||""}" maxlength="32"></div>
      <div class="field"><label>Group ID</label><input id="groupPublicId" value="${object.groupCode||""}" maxlength="32" placeholder="未設定"></div>
      <div class="field"><label>Body</label><div class="help">${object.bodyKind==="solid"?"Solid Body":"Surface/Mesh"}</div></div>
      <div class="field"><label>Entity UID</label><input value="${ensureEntity(object).uid}" readonly></div>
      ${shape}
    </div>
    <div class="section">
      <h3>位置</h3>
      ${nfield("X","position.0",object.position[0],.001)}
      ${nfield("Y","position.1",object.position[1],.001)}
      ${nfield("Z","position.2",object.position[2],.001)}
    </div>
    <div class="section">
      <h3>回転</h3>
      ${nfield("RX","rotation.0",object.rotation[0],.001)}
      ${nfield("RY","rotation.1",object.rotation[1],.001)}
      ${nfield("RZ","rotation.2",object.rotation[2],.001)}
    </div>

    <div class="section">
      <h3>基準 / Datum</h3>
      <div class="row"><button id="propertyDatumAdd">＋ 基準を追加</button><button id="propertyDatumPrimary">基準を変更</button></div>
      <div class="help">基準点・基準軸・基準面を追加/変更できます。Reference Mate と Snap の基準にも使用します。</div>
    </div>
    <div class="section">
      <h3>アバター移動</h3>
      <div class="row"><button id="avatarMoveToObject">選択オブジェクト座標へ</button></div>
      <div class="field"><label>指定座標 X,Y,Z</label><input id="avatarTargetCoordinate" value="${(object.position||[0,0,0]).join(', ')}"></div>
      <button id="avatarMoveToCoordinate">指定座標へ移動</button>
      <div class="help">移動先に安全な立ち位置が無い場合は移動をキャンセルします。</div>
    </div>
    <div class="section">
      <h3>存在 / Components</h3>
      <div class="field"><label>分類</label><div class="help" id="entityKindLabel">${entityLabel(object)}</div></div>
      <label><input id="lifeCoreToggle" type="checkbox" ${ensureComponents(object).lifeCore?.enabled?"checked":""}> ♡ Life Core / いのち</label>
      <label><input id="characterToggle" type="checkbox" ${ensureComponents(object).character?.enabled?"checked":""}> 人 Character Body</label>
      <label><input id="brainToggle" type="checkbox" ${ensureComponents(object).brain?.enabled?"checked":""}> 🧠 Brain / NPC思考</label>
      <label><input id="vehicleToggle" type="checkbox" ${ensureComponents(object).vehicle?.enabled?"checked":""}> 🚗 Vehicle</label>
      <label><input id="buildingToggle" type="checkbox" ${ensureComponents(object).building?.enabled?"checked":""}> ⌂ Building</label>
      <div class="help">Life Coreを付けると「物」から生命を持つEntityへ。Brainを追加するとNPC扱いになります。</div>
    </div>
    <div class="section">
      <h3>表示・外観</h3>
      <label><input id="visible" type="checkbox" ${object.visible!==false?"checked":""}> 表示</label>
      <div class="field"><label>色</label><input id="partColor" type="color" value="#${Number(object.color??0x88a9bf).toString(16).padStart(6,"0")}"></div>
      ${nfield("透明度","opacity",object.opacity*100,1)}
    </div>`;

  const ownedProtected=state.gameMode!=="creator"&&!state.creator?.enabled&&!!(object.metadata?.protectedOwner||object.metadata?.ownerId)&&object.metadata?.ownerId!=="PLAYER"&&object.metadata?.ownerUserId!==state.marketplace?.currentUserId;
  if(ownedProtected){
    const notice=document.createElement("div");notice.className="section";notice.innerHTML=`<h3>🔒 所有権</h3><div class="help">サバイバルでは ${object.metadata?.ownerId||"他者"} 所有の建物・設備は改変できません。Creatorモードでは編集できます。</div>`;root.prepend(notice);
    root.querySelectorAll("input,select,button").forEach(el=>{if(!["avatarMoveToObject","avatarMoveToCoordinate"].includes(el.id))el.disabled=true;});
  }

  root.querySelector("#objectPublicId").onchange=event=>{
    const next=String(event.target.value||"").trim().toUpperCase();
    if(!/^[A-Z0-9_-]{2,32}$/.test(next)){event.target.value=object.objectId||"";return alert("Object IDは2〜32文字の英数字/_/-で指定してください")}
    if(state.objects.some(o=>o!==object&&String(o.objectId||"").toUpperCase()===next)){event.target.value=object.objectId||"";return alert("同じObject IDが既にあります")}
    object.objectId=next;onChanged();
  };
  root.querySelector("#groupPublicId").onchange=event=>{object.groupCode=String(event.target.value||"").trim().toUpperCase()||null;onChanged()};

  root.querySelector("#partName").onchange=event=>{
    object.name=event.target.value||object.name;
    onChanged();
  };

  root.querySelectorAll(".num").forEach(input=>{
    const preview=event=>{
      let value=Number(event.target.value);
      if(!Number.isFinite(value))return;
      if(input.dataset.path==="opacity"){
        value=Math.max(0,Math.min(100,value))/100;
      }
      setPath(object,input.dataset.path,value);
      if(input.dataset.path.startsWith("params."))scene.rebuild(object);
      else scene.sync(object);
    };
    input.oninput=preview;
    input.onchange=event=>{preview(event);onChanged();};
  });


  root.querySelector("#propertyDatumAdd")?.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("ue:property-datum",{detail:{action:"add",objectId:object.id}})));
  root.querySelector("#propertyDatumPrimary")?.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("ue:property-datum",{detail:{action:"change",objectId:object.id}})));
  root.querySelector("#avatarMoveToObject")?.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("ue:avatar-teleport",{detail:{objectId:object.id}})));
  root.querySelector("#avatarMoveToCoordinate")?.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("ue:avatar-teleport",{detail:{coordinate:root.querySelector("#avatarTargetCoordinate")?.value||""}})));

  const componentToggle=(id,key)=>{const el=root.querySelector(id);if(!el)return;el.onchange=event=>{setComponent(object,key,event.target.checked);onChanged();};};
  componentToggle("#lifeCoreToggle","lifeCore");
  componentToggle("#characterToggle","character");
  componentToggle("#brainToggle","brain");
  componentToggle("#vehicleToggle","vehicle");
  componentToggle("#buildingToggle","building");

  root.querySelector("#partColor").oninput=event=>{
    object.color=parseInt(String(event.target.value).replace("#",""),16);
    scene.sync(object);
  };
  root.querySelector("#partColor").onchange=()=>onChanged();

  root.querySelector("#visible").onchange=event=>{
    object.visible=event.target.checked;
    scene.sync(object);
    onChanged();
  };
}


// v5.12.8 Universal Dial + environment-rich special-object properties.
export function renderSpecialProperties(root,state,specialId){
  if(!root||!specialId)return false;
  // v5.12.11: keep the active property editor alive while the user is typing.
  // A live preview may rebuild the scene and cause refresh(); replacing root.innerHTML
  // during that refresh used to drop focus and made numeric fields appear uneditable.
  const active=document.activeElement;
  if(root.dataset.specialEditing===specialId&&active&&root.contains(active)&&active.matches('input,select'))return true;
  const emit=(action,payload={})=>window.dispatchEvent(new CustomEvent('ue:special-property',{detail:{action,specialId,...payload}}));
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const num=(label,key,value,step=1,unit='')=>`<div class="field dialField"><label>${label}</label><div class="dialEntryRow"><input class="specialNum dialTargetEntry" data-label="${esc(label)}" data-key="${key}" data-unit="${esc(unit)}" type="number" value="${Number(value)||0}" step="${step}"><button class="dialPick" data-key="${key}" title="Universal Dialで操作">◉</button></div></div>`;
  const dial=()=>'';
  let html='';
  if(specialId==='special:planet'){
    const q=state.planet||{};
    html=`<div class="section"><h3>🌍 惑星 / 環境</h3><div class="help">このプロパティ欄から直接編集できます。数値・ON/OFFは入力と同時に反映されます。</div>${num('惑星半径','radiusMm',q.radiusMm,1000,'mm')}${num('水球半径','waterRadiusMm',q.waterRadiusMm,100,'mm')}${num('標高差','terrainAmplitudeMm',q.terrainAmplitudeMm,100,'mm')}${num('スポーン標高','spawnElevationMm',q.spawnElevationMm??1000,100,'mm')}${num('波振幅','waveAmplitudeMm',q.waveAmplitudeMm,10,'mm')}${num('波速度','waveSpeed',q.waveSpeed??.85,.01,'×')}${num('陸地率','landFractionPct',(q.landFractionTarget??.30)*100,1,'%')}${num('シード','seed',q.seed??1,1,'')}${num('大陸スケール','continentScale',q.continentScale??.72,.01,'×')}${num('地形ディテール','terrainDetailStrength',q.terrainDetailStrength??1,.01,'×')}${num('地形粗さ','terrainRoughness',q.terrainRoughness??1,.01,'×')}${num('山岳鋭さ','mountainSharpness',q.mountainSharpness??2.25,.05,'×')}${num('谷強度','valleyStrength',q.valleyStrength??.65,.01,'×')}${num('台地強度','plateauStrength',q.plateauStrength??.45,.01,'×')}${num('崖強度','cliffStrength',q.cliffStrength??.35,.01,'×')}${num('島強度','islandStrength',q.islandStrength??.30,.01,'×')}${num('侵食強度','erosionStrength',q.erosionStrength??.55,.01,'×')}${num('河川数','riverCount',q.riverCount??7,1,'本')}${num('植生密度','vegetationDensity',q.vegetationDensity??180,10,'')}${num('重力','gravity',q.gravity??9.81,.01,'m/s²')}${num('大気圧','pressureKPa',q.pressureKPa??101.325,.1,'kPa')}${num('平均気温','temperatureC',q.temperatureC??15,.1,'°C')}${num('自転周期','rotationPeriodHours',q.rotationPeriodHours??24,.1,'h')}${num('公転周期','orbitPeriodDays',q.orbitPeriodDays??365.25,.1,'day')}${num('地軸傾斜','axialTiltDeg',q.axialTiltDeg??23.4,.1,'°')}<label><input id="specialPlanetEnabled" type="checkbox" ${q.enabled!==false?'checked':''}> 惑星モード</label><label><input id="specialContinents" type="checkbox" ${q.continents!==false?'checked':''}> 大陸</label><label><input id="specialMountains" type="checkbox" ${q.mountains!==false?'checked':''}> 山岳</label><label><input id="specialBiomes" type="checkbox" ${q.biomes!==false?'checked':''}> バイオーム</label><label><input id="specialWater" type="checkbox" ${q.water!==false?'checked':''}> 海を表示</label><label><input id="specialRivers" type="checkbox" ${q.rivers!==false?'checked':''}> 河川</label><label><input id="specialVegetation" type="checkbox" ${q.vegetation!==false?'checked':''}> 植生</label><label><input id="specialAtmosphere" type="checkbox" ${q.atmosphere!==false?'checked':''}> 大気を表示</label><label><input id="specialCelestialLabels" type="checkbox" ${q.celestialLabelsVisible!==false?'checked':''}> 天体名表示</label><div class="help">「適用」は不要です。詳細設定は互換用に残しています。</div><div class="row"><button id="specialPlanetDialog">詳細設定を開く</button></div></div>${dial()}`;
  }else if(specialId==='special:avatar'){
    const a=state.avatar||{};html=`<div class="section"><h3>人 アバター</h3><div class="field"><label>名前</label><input id="specialAvatarName" value="${esc(a.name||'Player')}"></div>${num('身長','height',a.height,1,'mm')}<div class="field"><label>視点</label><select id="specialAvatarMode"><option value="tpv" ${a.mode==='tpv'?'selected':''}>TPV</option><option value="fpv" ${a.mode==='fpv'?'selected':''}>FPV</option><option value="orbit" ${a.mode==='orbit'?'selected':''}>Orbit</option></select></div><button id="specialApply">適用</button></div>${dial()}`;
  }else if(specialId==='special:camera'){
    html=`<div class="section"><h3>📷 カメラ</h3><div class="help">現在のカメラ位置・焦点を管理します。</div><div class="row"><button id="cameraHomeSpecial">◎ 初期位置へ復帰</button><button id="cameraFocusAvatar">アバターへ焦点</button></div></div>${dial()}`;
  }else if(specialId==='special:grid'){
    const c=state.creator||{};html=`<div class="section"><h3># グリッド</h3><label><input id="specialGridVisible" type="checkbox" ${c.gridVisible!==false?'checked':''}> 表示</label>${num('濃度','gridOpacity',c.gridOpacity??.14,.01,'')}${num('Creator Scale','scaleMm',c.scaleMm||1,.001,'mm/unit')}<button id="specialApply">適用</button></div>${dial()}`;
  }else if(specialId.startsWith('special:workbench:')){
    const id=specialId.split(':').slice(2).join(':'),w=(state.workbenches||[]).find(x=>x.id===id);if(!w)return false;html=`<div class="section"><h3>🛠 ${esc(w.name)}</h3><div class="field"><label>ID</label><input value="${esc(w.id)}" readonly></div><div class="field"><label>状態</label><div class="help">${w.stored?'収納中':w.active?'設置 / ACTIVE':'設置'}</div></div>${num('Yaw','yaw',w.yaw||0,1,'°')}<div class="row"><button id="workbenchActivate">Active</button><button id="workbenchToggleStore">${w.stored?'展開':'収納'}</button></div></div>${dial()}`;
  }else if(specialId.startsWith('special:celestial:')){
    const id=specialId.split(':').slice(2).join(':'),c=state.planet?.celestialCatalog?.[id];if(!c)return false;
    const env=c.environment||(c.environment={}); const orbit=c.orbit||(c.orbit={}); const rot=c.rotation||(c.rotation={});
    html=`<div class="section"><h3>✦ 天体 / 環境</h3><div class="field"><label>ID</label><input value="${esc(c.id)}" readonly></div><div class="field"><label>名称</label><input id="specialCelestialName" value="${esc(c.name||c.id)}"></div><div class="field"><label>種類</label><select id="specialCelestialType"><option value="planet" ${c.type==='planet'?'selected':''}>惑星</option><option value="moon" ${c.type==='moon'?'selected':''}>衛星</option><option value="star" ${c.type==='star'?'selected':''}>恒星</option><option value="other" ${!['planet','moon','star'].includes(c.type)?'selected':''}>その他</option></select></div>${num('半径','radiusMm',env.radiusMm??c.radiusMm??1000000,1000,'mm')}${num('質量','massEarth',env.massEarth??1,.01,'Earth')}${num('重力','gravity',env.gravity??9.81,.01,'m/s²')}${num('平均気温','temperatureC',env.temperatureC??15,.1,'°C')}${num('大気圧','pressureKPa',env.pressureKPa??101.325,.1,'kPa')}${num('水面半径','waterRadiusMm',env.waterRadiusMm??998000,100,'mm')}${num('地形高低差','terrainAmplitudeMm',env.terrainAmplitudeMm??10000,100,'mm')}${num('波振幅','waveAmplitudeMm',env.waveAmplitudeMm??220,10,'mm')}${num('自転周期','rotationPeriodHours',rot.periodHours??24,.1,'h')}${num('地軸傾斜','axialTiltDeg',rot.axialTiltDeg??23.4,.1,'°')}${num('公転半径','orbitRadiusAU',orbit.radiusAU??1,.001,'AU')}${num('公転周期','orbitPeriodDays',orbit.periodDays??365.25,.1,'day')}${num('軌道傾斜','orbitInclinationDeg',orbit.inclinationDeg??0,.1,'°')}<label><input id="specialCelestialAtmosphere" type="checkbox" ${env.atmosphere!==false?'checked':''}> 大気</label><label><input id="specialCelestialWater" type="checkbox" ${env.water!==false?'checked':''}> 水</label><label><input id="specialCelestialLabel" type="checkbox" ${c.labelVisible!==false?'checked':''}> 名称表示</label><button id="specialApply">適用</button></div>${dial()}`;
  }else return false;
  root.innerHTML=html;
  root.dataset.specialEditing=specialId;
  const entries=[...root.querySelectorAll('.dialTargetEntry')];
  const collectValues=()=>{const values={};root.querySelectorAll('.specialNum').forEach(el=>values[el.dataset.key]=Number(el.value));values.enabled=root.querySelector('#specialPlanetEnabled')?.checked;values.continents=root.querySelector('#specialContinents')?.checked;values.mountains=root.querySelector('#specialMountains')?.checked;values.biomes=root.querySelector('#specialBiomes')?.checked;values.water=root.querySelector('#specialWater')?.checked;values.rivers=root.querySelector('#specialRivers')?.checked;values.vegetation=root.querySelector('#specialVegetation')?.checked;values.atmosphere=root.querySelector('#specialAtmosphere')?.checked;values.celestialLabelsVisible=root.querySelector('#specialCelestialLabels')?.checked;values.gridVisible=root.querySelector('#specialGridVisible')?.checked;values.name=root.querySelector('#specialAvatarName')?.value||root.querySelector('#specialCelestialName')?.value;values.mode=root.querySelector('#specialAvatarMode')?.value;values.labelVisible=root.querySelector('#specialCelestialLabel')?.checked;values.celestialType=root.querySelector('#specialCelestialType')?.value;values.celestialAtmosphere=root.querySelector('#specialCelestialAtmosphere')?.checked;values.celestialWater=root.querySelector('#specialCelestialWater')?.checked;return values};
  let previewTimer=0;
  const requestPreview=(immediate=false)=>{
    if(previewTimer){clearTimeout(previewTimer);previewTimer=0;}
    const run=()=>{previewTimer=0;emit('preview',{values:collectValues()})};
    if(immediate)run();else previewTimer=setTimeout(run,90);
  };
  const setDialTarget=(el,label=null,unit=null)=>{if(!el)return;entries.forEach(x=>x.classList.toggle('dialActive',x===el));window.dispatchEvent(new CustomEvent('ue:universal-dial-target',{detail:{element:el,label:label||el.dataset.label||el.dataset.key,unit:unit??el.dataset.unit??'',specialId}}));};
  entries.forEach(el=>{
    el.addEventListener('focus',()=>setDialTarget(el));
    el.addEventListener('click',()=>setDialTarget(el));
    el.addEventListener('input',()=>{
      window.dispatchEvent(new CustomEvent('ue:universal-dial-sync',{detail:{element:el}}));
      requestPreview(false);
    });
    el.addEventListener('change',()=>requestPreview(true));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();requestPreview(true);el.blur();}});
    el.addEventListener('wheel',e=>{e.preventDefault();setDialTarget(el);window.dispatchEvent(new CustomEvent('ue:universal-dial-nudge',{detail:{direction:e.deltaY<0?1:-1}}))},{passive:false});
  });
  root.querySelectorAll('.dialPick').forEach(b=>b.addEventListener('click',()=>setDialTarget(root.querySelector(`.dialTargetEntry[data-key="${b.dataset.key}"]`))));
  ['#specialPlanetEnabled','#specialContinents','#specialMountains','#specialBiomes','#specialWater','#specialRivers','#specialVegetation','#specialAtmosphere','#specialCelestialLabels','#specialGridVisible','#specialAvatarMode','#specialCelestialLabel','#specialCelestialType','#specialCelestialAtmosphere','#specialCelestialWater'].forEach(sel=>root.querySelector(sel)?.addEventListener('change',()=>requestPreview(true)));
  ['#specialAvatarName','#specialCelestialName'].forEach(sel=>root.querySelector(sel)?.addEventListener('input',()=>requestPreview(false)));
  root.querySelector('#specialApply')?.addEventListener('click',()=>emit('apply',{values:collectValues()}));
  root.querySelector('#specialPlanetDialog')?.addEventListener('click',()=>emit('planet-dialog'));root.querySelector('#cameraHomeSpecial')?.addEventListener('click',()=>emit('camera-home'));root.querySelector('#cameraFocusAvatar')?.addEventListener('click',()=>emit('camera-focus-avatar'));root.querySelector('#workbenchActivate')?.addEventListener('click',()=>emit('workbench-active'));root.querySelector('#workbenchToggleStore')?.addEventListener('click',()=>emit('workbench-toggle-store'));
  root.addEventListener('focusout',()=>setTimeout(()=>{if(!root.contains(document.activeElement))delete root.dataset.specialEditing;},0),{once:true});
  return true;
}

