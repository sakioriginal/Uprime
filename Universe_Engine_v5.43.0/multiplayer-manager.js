import * as THREE from 'three';

function makeClientId(){
  try{return crypto.randomUUID()}catch{return `ue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
}

function clone(v){return typeof structuredClone==='function'?structuredClone(v):JSON.parse(JSON.stringify(v))}

function canonicalSnapshot(snapshot){
  const data=clone(snapshot||{});
  delete data.savedAt;
  // Avatar/camera controls are per-player presence, not shared project state.
  delete data.avatar;
  delete data.controls;
  delete data.multiplayer;
  delete data.vr;
  // Cockpit/camera control is local to each player. Flight physics and shared seats remain shared.
  for(const c of data.spacecraft?.crafts||[]){delete c.pilot;delete c.walkMode;delete c.cameraMode;delete c.cameraOrbit;delete c._avatarRestore;delete c.control;delete c.modifyMode;}
  if(data.creator){
    delete data.creator.panelVisible;
    delete data.creator.panelCollapsed;
    delete data.creator.cameraTool;
  }
  return data;
}

export class MultiplayerManager{
  constructor({state,scene,serializeProject,applyProject,onStatus=()=>{},onPeers=()=>{},onGameEvent=()=>{}}={}){
    this.state=state;this.scene=scene;this.serializeProject=serializeProject;this.applyProject=applyProject;
    this.onStatus=onStatus;this.onPeers=onPeers;this.onGameEvent=onGameEvent;this.clientId=makeClientId();this.socket=null;this.room='';this.name='Player';this.isHost=false;
    this.connected=false;this.applyingRemote=false;this.lastCanonical='';this.lastSeq=0;this.peers=new Map();this.remoteVisuals=new Map();this.playMode='coop';this.team='A';
    this._lastConnectOptions=null;this._manualDisconnect=false;this._reconnectTimer=null;this._reconnectAttempt=0;this._lastPresenceSentAt=0;this._lastRxAt=0;
    // v5.44: realtime movement is lightweight presence; full world snapshots are slow background saves only.
    this._pollTimer=setInterval(()=>this._pollSharedState(),30000);
    this._presenceTimer=setInterval(()=>this._sendPresence(),100);
    this._keepAliveTimer=setInterval(()=>this._keepAlive(),10000);
    this._visualTimer=setInterval(()=>this._interpolateRemoteVisuals(),33);
  }
  destroy(){clearInterval(this._pollTimer);clearInterval(this._presenceTimer);clearInterval(this._keepAliveTimer);clearInterval(this._visualTimer);clearTimeout(this._reconnectTimer);this.disconnect();}
  connect({url,room,name,wantsHost=false,playMode='coop',team='A'}={}){
    this._manualDisconnect=false;clearTimeout(this._reconnectTimer);
    this._lastConnectOptions={url:String(url||''),room,name,wantsHost:!!wantsHost,playMode,team};
    this.disconnect(false,false);
    this.room=String(room||'default').trim()||'default';this.name=String(name||'Player').trim()||'Player';this.playMode=playMode==='versus'?'versus':'coop';this.team=String(team||'A').slice(0,12)||'A';this.state.multiplayer={playMode:this.playMode,team:this.team,friendlyFire:false,...(this.state.multiplayer||{}),playMode:this.playMode,team:this.team};
    this.onStatus(`接続中: ${this.room}`,'info');
    const ws=new WebSocket(String(url||''));this.socket=ws;
    ws.addEventListener('open',()=>{
      this._reconnectAttempt=0;this._lastRxAt=Date.now();
      ws.send(JSON.stringify({type:'hello',room:this.room,name:this.name,clientId:this.clientId,wantsHost:!!wantsHost,playMode:this.playMode,team:this.team}));
    });
    ws.addEventListener('message',event=>{this._lastRxAt=Date.now();this._handleMessage(event.data)});
    ws.addEventListener('close',event=>{
      if(this.socket!==ws)return;this.socket=null;this.connected=false;this.isHost=false;
      if(this._manualDisconnect){this._clearRemoteVisuals();this.peers.clear();this.onPeers([]);this.onStatus('共同プレイ接続を終了しました','info');return}
      this.onStatus(`接続が切れました (${event.code||'network'})。再接続します…`,'error');this._scheduleReconnect();
    });
    ws.addEventListener('error',()=>{if(this.socket===ws)this.onStatus('Relay通信が不安定です。自動再接続を待っています','error')});
  }
  disconnect(notify=true,manual=true){
    if(manual)this._manualDisconnect=true;clearTimeout(this._reconnectTimer);
    const ws=this.socket;this.socket=null;this.connected=false;this.isHost=false;
    if(ws&&ws.readyState<=1){try{ws.close(1000,'client disconnect')}catch{}}
    this._clearRemoteVisuals();this.peers.clear();this.onPeers([]);if(notify)this.onStatus('オフライン','info');
  }
  _scheduleReconnect(){
    if(this._manualDisconnect||!this._lastConnectOptions)return;clearTimeout(this._reconnectTimer);
    const wait=Math.min(8000,1200*Math.pow(1.7,this._reconnectAttempt++));
    this._reconnectTimer=setTimeout(()=>{if(!this._manualDisconnect)this.connect({...this._lastConnectOptions})},wait);
  }
  _keepAlive(){
    if(!this._open())return;this._send({type:'ping',t:Date.now()});
  }
  publishNow(){
    if(!this.connected||!this._open())return false;
    const snapshot=canonicalSnapshot(this.serializeProject(this.state));
    this.lastCanonical=JSON.stringify(snapshot);
    this._send({type:'project-snapshot',snapshot});return true;
  }
  _open(){return this.socket&&this.socket.readyState===WebSocket.OPEN}
  _send(message){if(!this._open())return false;this.socket.send(JSON.stringify(message));return true}
  sendGameEvent(event,payload={}){return this._send({type:'game-event',event,...payload})}
  async _handleMessage(raw){
    let msg;try{msg=JSON.parse(raw)}catch{return}
    if(msg.type==='pong')return;
    if(msg.type==='welcome'){
      this.connected=true;this.isHost=!!msg.isHost;this.lastSeq=msg.hasSnapshot?Math.max(0,Number(msg.seq||0)-1):Number(msg.seq||0);
      this.peers.clear();for(const p of msg.peers||[])if(p.clientId!==this.clientId)this.peers.set(p.clientId,p);
      this._emitPeers();this.onStatus(`${this.room} に接続 / ${this.isHost?'HOST':'GUEST'} / ${this.peers.size+1}人`,'ok');
      if(this.isHost&&!msg.hasSnapshot)this.publishNow();this._sendPresence(true);return;
    }
    if(msg.type==='host-changed'){this.isHost=!!msg.isHost;this._emitPeers();this.onStatus(this.isHost?'HOST権限を引き継ぎました':'HOSTが変更されました','info');return;}
    if(msg.type==='peer-joined'){
      if(msg.peer?.clientId&&msg.peer.clientId!==this.clientId)this.peers.set(msg.peer.clientId,msg.peer);this._emitPeers();
      if(this.isHost&&!msg.hasSnapshot)this.publishNow();return;
    }
    if(msg.type==='peer-left'){
      this.peers.delete(msg.clientId);this._removeRemoteVisual(msg.clientId);this._emitPeers();return;
    }
    if(msg.type==='presence'){
      if(!msg.clientId||msg.clientId===this.clientId)return;
      const previous=this.peers.get(msg.clientId)||{};this.peers.set(msg.clientId,{...previous,clientId:msg.clientId,name:msg.name||previous.name||'Player',playMode:msg.playMode||previous.playMode||this.playMode,team:msg.team||previous.team||'A',hp:Number(msg.hp??previous.hp??100),maxHp:Number(msg.maxHp??previous.maxHp??100),dead:!!msg.dead,kos:Number(msg.kos??previous.kos??0),deaths:Number(msg.deaths??previous.deaths??0),vehicleSeat:msg.vehicleSeat||null,carryIds:msg.carryIds||[],selection:msg.selection||[],primaryId:msg.primaryId||null});
      this._updateRemoteVisual(msg);this._emitPeers();return;
    }
    if(msg.type==='game-event'){this.onGameEvent(msg);return;}
    if(msg.type==='project-snapshot'){
      const seq=Number(msg.seq||0);if(seq&&seq<=this.lastSeq)return;if(seq)this.lastSeq=seq;
      if(msg.source===this.clientId||!msg.snapshot)return;
      this.applyingRemote=true;
      try{
        await this.applyProject(clone(msg.snapshot),msg);
        this.lastCanonical=JSON.stringify(canonicalSnapshot(this.serializeProject(this.state)));
        this.onStatus(`共同編集を同期しました #${this.lastSeq}`,'ok');
      }catch(error){console.error(error);this.onStatus(`共同編集の反映失敗: ${error.message}`,'error')}
      finally{this.applyingRemote=false}
      return;
    }
    if(msg.type==='cloud-saved'){this.onStatus(`クロスセーブ完了 #${Number(msg.seq)||0}`,'ok');return;}
    if(msg.type==='error')this.onStatus(msg.message||'共同プレイサーバーエラー','error');
  }
  _pollSharedState(){
    // Only the host performs automatic full-world snapshots. Guests use presence/game-events.
    if(!this.connected||!this.isHost||this.applyingRemote||!this._open())return;
    let snapshot;try{snapshot=canonicalSnapshot(this.serializeProject(this.state))}catch{return}
    const text=JSON.stringify(snapshot);if(text===this.lastCanonical)return;
    this.lastCanonical=text;this._send({type:'project-snapshot',snapshot});
  }
  _presencePayload(){
    const a=this.state.avatar||{};let worldPosition=null,worldQuaternion=null;
    const g=window.__UE_AVATAR_GROUP__;if(g){
      try{const p=g.getWorldPosition(new THREE.Vector3()),q=g.getWorldQuaternion(new THREE.Quaternion());worldPosition=p.toArray();worldQuaternion=[q.x,q.y,q.z,q.w]}
      catch{worldPosition=g.position?.toArray?.()||null;worldQuaternion=g.quaternion?[g.quaternion.x,g.quaternion.y,g.quaternion.z,g.quaternion.w]:null}
    }
    const gameplay=window.__UE_NETWORK_GAMEPLAY__?.localPresence?.()||{};return {type:'presence',name:this.name,clientId:this.clientId,playMode:this.playMode,team:this.team,...gameplay,position:Array.isArray(a.position)?a.position:null,yaw:Number(a.yaw)||0,onPlanet:!!a.onPlanet,planetNormal:a.planetNormal||null,worldPosition,worldQuaternion,selection:[...(this.state.selectedIds||[])],primaryId:this.state.primaryId||null};
  }
  _sendPresence(force=false){
    if(!this.connected||!this._open())return;const now=Date.now(),payload=this._presencePayload(),text=JSON.stringify(payload);
    // Send immediately when pose changes; otherwise send a heartbeat presence every 3 s.
    if(!force&&text===this._lastPresence&&now-this._lastPresenceSentAt<3000)return;
    this._lastPresence=text;this._lastPresenceSentAt=now;this._send(payload);
  }
  _emitPeers(){this.onPeers([...this.peers.values()].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''))))}
  _makeRemoteVisual(id,name){
    const group=new THREE.Group();group.name=`remote-player:${id}`;
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(14,44,6,10),new THREE.MeshStandardMaterial({roughness:.65,metalness:.02}));body.position.y=36;body.raycast=()=>{};group.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(12,16,12),new THREE.MeshStandardMaterial({roughness:.7}));head.position.y=78;head.raycast=()=>{};group.add(head);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(20,2.2,8,24),new THREE.MeshBasicMaterial({transparent:true,opacity:.8}));ring.rotation.x=Math.PI/2;ring.position.y=2;ring.raycast=()=>{};group.add(ring);
    group.userData={remotePlayer:true,clientId:id,name};this.scene?.scene?.add?.(group);this.remoteVisuals.set(id,group);return group;
  }
  _updateRemoteVisual(msg){
    let group=this.remoteVisuals.get(msg.clientId)||this._makeRemoteVisual(msg.clientId,msg.name);
    const team=String(msg.team||'A');const color=team==='B'?0xe16b6b:team==='C'?0x79d28b:team==='FREE'?0xd6c56a:0x6ba7e1;group.traverse?.(o=>{if(o.isMesh&&o.material?.color)o.material.color.setHex(color)});group.userData.team=team;group.userData.playMode=msg.playMode||'coop';
    // Full-project re-application can replace scene children. Always reattach remote avatars if needed.
    const root=this.scene?.scene;if(root&&group.parent!==root)root.add(group);
    const wp=msg.worldPosition;let targetPos=null;if(Array.isArray(wp)&&wp.length>=3)targetPos=new THREE.Vector3(Number(wp[0])||0,Number(wp[1])||0,Number(wp[2])||0);
    else if(Array.isArray(msg.position)&&msg.position.length>=3)targetPos=new THREE.Vector3(Number(msg.position[0])||0,Number(msg.position[2])||0,Number(msg.position[1])||0);
    if(targetPos){if(!group.userData.netReady){group.position.copy(targetPos);group.userData.netReady=true}group.userData.netTargetPosition=targetPos}
    if(Array.isArray(msg.worldQuaternion)&&msg.worldQuaternion.length>=4){const q=new THREE.Quaternion(...msg.worldQuaternion.map(Number));if(!group.userData.netQuaternionReady){group.quaternion.copy(q);group.userData.netQuaternionReady=true}group.userData.netTargetQuaternion=q}
    else{const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-(Number(msg.yaw)||0)*Math.PI/180);group.userData.netTargetQuaternion=q}
    group.visible=true;
  }
  _interpolateRemoteVisuals(){
    for(const group of this.remoteVisuals.values()){
      const root=this.scene?.scene;if(root&&group.parent!==root)root.add(group);
      const p=group.userData?.netTargetPosition,q=group.userData?.netTargetQuaternion;
      if(p)group.position.lerp(p,.32);if(q)group.quaternion.slerp(q,.32);
    }
  }
  _removeRemoteVisual(id){const g=this.remoteVisuals.get(id);if(!g)return;g.traverse?.(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m?.dispose?.());else o.material?.dispose?.()});g.parent?.remove?.(g);this.remoteVisuals.delete(id)}
  _clearRemoteVisuals(){for(const id of [...this.remoteVisuals.keys()])this._removeRemoteVisual(id)}
}
