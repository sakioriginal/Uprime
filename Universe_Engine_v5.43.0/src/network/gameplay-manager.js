import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

export class NetworkGameplayManager{
  constructor({state,scene,multiplayer,avatar,spacecraft,itemCrafting=null,onStatus=()=>{}}={}){
    this.state=state;this.scene=scene;this.multiplayer=multiplayer;this.avatar=avatar;this.spacecraft=spacecraft;this.itemCrafting=itemCrafting;this.onStatus=onStatus;
    this.ensureState();this._lastCarrySync=0;
    scene?.addLoopHook?.((now)=>this.update(now));
  }
  ensureState(){
    this.state.multiplayer=this.state.multiplayer||{};
    const g=this.state.multiplayer.gameplay||(this.state.multiplayer.gameplay={});
    g.maxHp=Math.max(1,Number(g.maxHp)||100);g.hp=clamp(Number.isFinite(Number(g.hp))?g.hp:g.maxHp,0,g.maxHp);g.dead=!!g.dead;
    g.attackDamage=Math.max(1,Number(g.attackDamage)||25);g.attackRangeMm=Math.max(100,Number(g.attackRangeMm)||1800);g.attackConeDeg=Math.max(5,Math.min(180,Number(g.attackConeDeg)||70));
    g.respawnDelayMs=Math.max(500,Number(g.respawnDelayMs)||2500);g.deaths=Number(g.deaths)||0;g.kos=Number(g.kos)||0;
    return g;
  }
  localPresence(){const g=this.ensureState();return{hp:g.hp,maxHp:g.maxHp,dead:g.dead,deaths:g.deaths,kos:g.kos,carryIds:this.carryIds(),vehicleSeat:this.localVehicleSeat()}}
  carryIds(){const id=this.multiplayer?.clientId;return (this.state.objects||[]).filter(o=>o.metadata?.coopCarry?.participants?.includes(id)).map(o=>o.id)}
  localVehicleSeat(){const id=this.multiplayer?.clientId;if(!id)return null;for(const c of this.state.spacecraft?.crafts||[]){const s=c.multiplayerSeats;if(s?.pilotId===id)return{craftId:c.id,role:'pilot'};if(s?.passengers?.includes(id))return{craftId:c.id,role:'passenger'}}return null}
  _playerWorld(id){if(id===this.multiplayer?.clientId){const g=window.__UE_AVATAR_GROUP__;if(g)return g.getWorldPosition(new THREE.Vector3())}const v=this.multiplayer?.remoteVisuals?.get(id);return v?v.getWorldPosition(new THREE.Vector3()):null}
  toggleCarrySelected(){
    if(!this.multiplayer?.connected){this.onStatus('共同運搬にはMULTI接続が必要です','error');return false}
    const p=this.state.primary?.();if(!p){this.onStatus('共同運搬するオブジェクトを選択してください','error');return false}
    p.metadata=p.metadata||{};const c=p.metadata.coopCarry||(p.metadata.coopCarry={participants:[],offsetMm:90});c.participants=Array.isArray(c.participants)?c.participants:[];
    const id=this.multiplayer.clientId,i=c.participants.indexOf(id);if(i>=0)c.participants.splice(i,1);else c.participants.push(id);
    if(!c.participants.length)delete p.metadata.coopCarry;
    this.scene?.sync?.(p);this.multiplayer?.publishNow?.();this.onStatus(i>=0?'共同運搬から離れました':`共同運搬へ参加 (${c.participants.length}人)`,'command');return true;
  }
  attack(){
    const g=this.ensureState();if(g.dead)return false;if(!this.multiplayer?.connected){this.onStatus('対戦にはMULTI接続が必要です','error');return false}if((this.state.multiplayer?.playMode||this.multiplayer.playMode)!=='versus'){this.onStatus('攻撃はVERSUSモードで使用します','info');return false}
    const equip=this.itemCrafting?.combatStats?.()||{};
    if(equip.ranged&&this.projectiles?.fireBow)return this.projectiles.fireBow({draw:1});
    const attackDamage=Math.max(1,Number(equip.damage)||g.attackDamage),attackRangeMm=Math.max(100,Number(equip.rangeMm)||g.attackRangeMm),attackConeDeg=Math.max(5,Math.min(180,Number(equip.coneDeg)||g.attackConeDeg));const self=this._playerWorld(this.multiplayer.clientId);if(!self)return false;const avatarGroup=window.__UE_AVATAR_GROUP__;const forward=new THREE.Vector3(0,0,-1);if(avatarGroup)forward.applyQuaternion(avatarGroup.getWorldQuaternion(new THREE.Quaternion())).normalize();
    let best=null,bestDist=Infinity;const cone=Math.cos(THREE.MathUtils.degToRad(attackConeDeg*.5));
    for(const peer of this.multiplayer.peers.values()){
      if(peer.dead)continue;if(!this.state.multiplayer?.friendlyFire&&peer.team===this.multiplayer.team)continue;const pos=this._playerWorld(peer.clientId);if(!pos)continue;const delta=pos.clone().sub(self),dist=delta.length();if(dist>attackRangeMm||dist>=bestDist)continue;if(dist>1&&forward.dot(delta.normalize())<cone)continue;best=peer;bestDist=dist;
    }
    if(!best){this.onStatus('攻撃範囲に相手がいません','info');return false}
    this.multiplayer.sendGameEvent?.('damage',{targetClientId:best.clientId,damage:attackDamage,attackerClientId:this.multiplayer.clientId,attackerName:this.multiplayer.name,team:this.multiplayer.team});this.onStatus(`ATTACK${equip.weapon?.name?` [${equip.weapon.name}]`:''} → ${best.name} (${attackDamage})`,'command');return true;
  }
  handleGameEvent(msg){
    if(!msg||msg.targetClientId!==this.multiplayer?.clientId)return;const g=this.ensureState();
    if(msg.event==='damage'){
      if(g.dead)return;if((this.state.multiplayer?.playMode||this.multiplayer.playMode)!=='versus')return;if(!this.state.multiplayer?.friendlyFire&&msg.team===this.multiplayer.team)return;
      const armor=Math.max(0,Math.min(80,Number(this.itemCrafting?.combatStats?.().armor)||0));const raw=Math.max(0,Number(msg.damage)||0),applied=Math.max(1,Math.round(raw*(1-armor/100)));g.hp=clamp(g.hp-applied,0,g.maxHp);this.onStatus(`HIT ${msg.attackerName||'Player'} / HP ${g.hp}/${g.maxHp}`,g.hp?'command':'error');
      if(g.hp<=0){g.dead=true;g.deaths++;if(this.state.avatar)this.state.avatar.controlEnabled=false;this.multiplayer.sendGameEvent?.('ko',{targetClientId:msg.attackerClientId,victimClientId:this.multiplayer.clientId,victimName:this.multiplayer.name});setTimeout(()=>this.respawn(),g.respawnDelayMs)}
      this.multiplayer?._sendPresence?.(true);return;
    }
    if(msg.event==='ko'){g.kos++;this.onStatus(`KO +1 (${g.kos})`,'command');this.multiplayer?._sendPresence?.(true)}
  }
  respawn(){
    const g=this.ensureState();g.hp=g.maxHp;g.dead=false;if(this.state.avatar)this.state.avatar.controlEnabled=true;
    if(this.state.planet?.enabled&&this.avatar){const n=new THREE.Vector3(...(this.state.planet.homeNormal||[0,1,0]));this.avatar.enterPlanet?.(n);this.state.avatar.surfaceOffset=0;this.avatar.recoverToTerrainGround?.();this.avatar.sync?.()}
    else if(this.state.avatar){this.state.avatar.position=[-220,-180,0];this.avatar?.sync?.()}
    this.multiplayer?._sendPresence?.(true);this.onStatus(`RESPAWN / HP ${g.hp}`,'command');return true;
  }
  boardActiveVehicle(role='passenger'){
    if(!this.multiplayer?.connected){this.onStatus('共同搭乗にはMULTI接続が必要です','error');return false}const c=this.spacecraft?.active?.();if(!c){this.onStatus('アクティブな乗り物/宇宙船がありません','error');return false}
    c.multiplayerSeats=c.multiplayerSeats||{pilotId:null,passengers:[]};c.multiplayerSeats.passengers=Array.isArray(c.multiplayerSeats.passengers)?c.multiplayerSeats.passengers:[];const id=this.multiplayer.clientId;
    if(c.multiplayerSeats.pilotId===id)c.multiplayerSeats.pilotId=null;c.multiplayerSeats.passengers=c.multiplayerSeats.passengers.filter(x=>x!==id);
    if(role==='pilot'){if(c.multiplayerSeats.pilotId&&c.multiplayerSeats.pilotId!==id){this.onStatus('運転席は使用中です','error');return false}c.multiplayerSeats.pilotId=id;try{this.spacecraft.board?.()}catch(e){this.onStatus(e.message,'error');return false}}
    else{c.multiplayerSeats.passengers.push(id);if(this.state.avatar)this.state.avatar.enabled=false}
    this.multiplayer.publishNow?.();this.onStatus(role==='pilot'?'共同乗り物: 運転席へ搭乗':'共同乗り物: 同乗しました','command');return true;
  }
  unboardVehicle(){const id=this.multiplayer?.clientId;let changed=false;for(const c of this.state.spacecraft?.crafts||[]){const s=c.multiplayerSeats;if(!s)continue;if(s.pilotId===id){s.pilotId=null;try{this.spacecraft?.unboard?.()}catch{}changed=true}s.passengers=(s.passengers||[]).filter(x=>x!==id);}
    if(changed&&this.state.avatar)this.state.avatar.enabled=true;this.avatar?.recoverToSafeGround?.();this.multiplayer?.publishNow?.();this.onStatus('共同乗り物から降りました','command');return changed}
  _followPassenger(){const seat=this.localVehicleSeat();if(!seat||seat.role!=='passenger')return;const c=(this.state.spacecraft?.crafts||[]).find(x=>x.id===seat.craftId);if(!c)return;const ids=c.partIds||[];let sum=new THREE.Vector3(),count=0;for(const id of ids){const p=this.state.object?.(id);if(p?.mesh){p.mesh.getWorldPosition(new THREE.Vector3());sum.add(p.mesh.getWorldPosition(new THREE.Vector3()));count++}}if(!count)return;sum.multiplyScalar(1/count);if(this.state.avatar){this.state.avatar.enabled=false;this.state.avatar.onPlanet=false;this.state.avatar.position=this.scene.worldPointToCad(sum)}}
  update(now=performance.now()){
    this._followPassenger();if(!this.multiplayer?.connected)return;const t=Number(now)||0;if(t-this._lastCarrySync<80)return;this._lastCarrySync=t;
    const live=new Set([this.multiplayer.clientId,...this.multiplayer.peers.keys()]);
    for(const p of this.state.objects||[]){const c=p.metadata?.coopCarry;if(!c||!Array.isArray(c.participants)||!c.participants.length)continue;c.participants=c.participants.filter(id=>live.has(id));if(!c.participants.length){delete p.metadata.coopCarry;continue}const pts=c.participants.map(id=>this._playerWorld(id)).filter(Boolean);if(!pts.length)continue;const avg=pts.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(1/pts.length);const up=avg.clone().normalize();if(Number.isFinite(Number(c.offsetMm)))avg.add(up.multiplyScalar(Number(c.offsetMm)||0));p.position=this.scene.worldPointToCad(avg);this.scene.sync?.(p)}
  }
}
