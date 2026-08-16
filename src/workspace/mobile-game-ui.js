export class MobileGameUI{
  constructor(state,{root=document,onStatus=()=>{},itemCrafting=null,resourceManager=null}={}){
    this.state=state;this.root=root;this.onStatus=onStatus;this.itemCrafting=itemCrafting;this.resourceManager=resourceManager;this.ensureState();this.bind();this.render();this.timer=setInterval(()=>{this.renderHotbar();this.renderCombatHud()},500);
  }
  ensureState(){
    this.state.controls=this.state.controls||{};
    const defaults=[
      {label:'JUMP',action:'jump'},{label:'USE',action:'interact'},{label:'INV',action:'inventory'},{label:'VIEW',action:'view'}
    ];
    if(!Array.isArray(this.state.controls.mobileActions))this.state.controls.mobileActions=defaults;
    while(this.state.controls.mobileActions.length<4)this.state.controls.mobileActions.push(defaults[this.state.controls.mobileActions.length]);
    this.state.controls.mobileHud=this.state.controls.mobileHud!==false;
  }
  $(s){return this.root?.querySelector?.(s)||null}
  bind(){
    this.$('#mobileActionSettingsBtn')?.addEventListener('click',()=>this.openSettings());
    this.$('#mobileInventoryBtn')?.addEventListener('click',()=>this.openInventory());
    this.$('#mobileUiClose')?.addEventListener('click',()=>this.$('#mobileUiDialog')?.classList.remove('show'));
    this.$('#mobileUiSave')?.addEventListener('click',()=>this.saveSettings());
    this.root?.querySelectorAll?.('.mobileActionBtn').forEach((b,i)=>b.addEventListener('click',()=>this.runAction(this.state.controls.mobileActions[i]?.action)));
    this.$('#mobileInventoryClose')?.addEventListener('click',()=>this.$('#mobileInventoryDialog')?.classList.remove('show'));
    this.$('#mobileCraftBtn')?.addEventListener('click',()=>this.openCraft());this.$('#mobileCraftClose')?.addEventListener('click',()=>this.$('#mobileCraftDialog')?.classList.remove('show'));
    this.$('#unequipLeftBtn')?.addEventListener('click',()=>{this.itemCrafting?.unequip?.('left');this.renderInventory()});this.$('#unequipRightBtn')?.addEventListener('click',()=>{this.itemCrafting?.unequip?.('right');this.renderInventory()});
  }
  click(id){const el=this.$(id);if(el&&!el.dataset?.missingSelector){el.click();return true}return false}
  runAction(action){
    switch(action){
      case 'jump':return this.click('#avatarJumpBtn');
      case 'run':return this.click('#avatarRunBtn');
      case 'walk':return this.click('#avatarWalkBtn');
      case 'fpv':return this.click('#avatarFpvBtn');
      case 'tpv':return this.click('#avatarTpvBtn');
      case 'view':return this.state.avatar?.mode==='fpv'?this.click('#avatarTpvBtn'):this.click('#avatarFpvBtn');
      case 'inventory':this.openInventory();return true;
      case 'interact':return this.interact();
      case 'drop':return this.click('#dropHandBtn');
      case 'rightHand':return this.click('#holdRightBtn');
      case 'leftHand':return this.click('#holdLeftBtn');
      case 'multi':return this.click('#multiplayerBtn');
      case 'attack':return this.click('#multiAttackBtn');
      case 'carry':return this.click('#multiCarryBtn');
      case 'pilot':return this.click('#multiPilotBtn');
      case 'passenger':return this.click('#multiPassengerBtn');
      case 'unboard':return this.click('#multiUnboardBtn');
      case 'respawn':return this.click('#multiRespawnBtn');
      case 'workbench':return this.click('#benchInventoryBtn');
      case 'harvest':return this.resourceManager?.harvestNearest?.()||false;
      case 'craft':this.openCraft();return true;
      default:this.onStatus(`Action: ${action||'none'}`,'command');return false;
    }
  }
  interact(){
    if(this.state.primaryId){if(this.click('#doorToggleBtn'))return true;}
    this.onStatus('USE: 対象を選択して操作します','command');return false;
  }
  openSettings(){this.ensureState();const d=this.$('#mobileUiDialog');if(!d)return;this.root.querySelectorAll('.mobileActionSelect').forEach((s,i)=>s.value=this.state.controls.mobileActions[i]?.action||'interact');d.classList.add('show')}
  saveSettings(){this.root.querySelectorAll('.mobileActionSelect').forEach((s,i)=>{const label=s.options[s.selectedIndex]?.textContent?.split(' / ')[0]||`A${i+1}`;this.state.controls.mobileActions[i]={label,action:s.value}});this.renderActions();this.$('#mobileUiDialog')?.classList.remove('show');this.onStatus('スマホアクション割当を保存しました','command')}
  openInventory(){this.renderInventory();this.$('#mobileInventoryDialog')?.classList.add('show')}
  renderInventory(){const root=this.$('#mobileInventoryList');if(!root)return;const items=this.state.inventory?.items||[],eq=this.state.avatar?.equipment||{};root.innerHTML=items.length?items.map((it,i)=>`<div class="mobileInventoryItem"><b>${this.escape(it.icon||this.icon(it))} ${this.escape(it.name||it.type||`Item ${i+1}`)}${it.quantity>1?` ×${it.quantity}`:''}</b><small>${this.escape(it.type||'item')}</small><div class="row"><button data-use="${i}">${it.stats?.heal?'使用':it.partId?'装備':'開く'}</button>${it.partId?`<button data-equip-left="${i}">左手</button><button data-equip-right="${i}">右手</button>`:''}</div></div>`).join(''):'<div class="help">インベントリは空です。</div>';root.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{const item=items[Number(b.dataset.use)];if(item?.type==='workbench')this.click('#benchInventoryBtn');else if(item?.stats?.heal)this.itemCrafting?.use?.(item);else if(item?.partId)this.itemCrafting?.equip?.(item);this.renderInventory();this.renderHotbar()});root.querySelectorAll('[data-equip-left]').forEach(b=>b.onclick=()=>{this.itemCrafting?.equip?.(items[Number(b.dataset.equipLeft)],'left');this.renderInventory()});root.querySelectorAll('[data-equip-right]').forEach(b=>b.onclick=()=>{this.itemCrafting?.equip?.(items[Number(b.dataset.equipRight)],'right');this.renderInventory()});const e=this.$('#mobileEquippedText');if(e)e.textContent=`L: ${this.itemCrafting?.equippedItem?.('left')?.name||'-'} / R: ${this.itemCrafting?.equippedItem?.('right')?.name||'-'}`;}
  renderHotbar(){const root=this.$('#mobileHotbar');if(!root)return;const items=(this.state.inventory?.items||[]).slice(0,6);root.innerHTML=items.map((it,i)=>`<button title="${this.escape(it.name||it.type||'item')}"><span>${i+1}</span>${this.escape(it.icon||this.icon(it))}</button>`).join('');root.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{const item=items[i];if(item?.type==='workbench')this.click('#benchInventoryBtn');else if(item?.stats?.heal)this.itemCrafting?.use?.(item);else if(item?.partId)this.itemCrafting?.equip?.(item);else this.openInventory();this.renderHotbar()})}
  icon(it){if(it?.type==='workbench')return '▣';if(it?.type==='weapon')return '⚔️';if(it?.type==='tool')return '🔧';if(it?.type==='consumable'||it?.type==='food')return '🍎';if(it?.type==='equipment')return '🛡️';return '◆'}
  openCraft(){this.renderCraft();this.$('#mobileCraftDialog')?.classList.add('show')}
  renderCraft(){const root=this.$('#mobileCraftList');if(!root||!this.itemCrafting)return;const recipes=this.itemCrafting.recipes(),res=this.itemCrafting.resources();const rr=this.$('#mobileCraftResources');if(rr)rr.textContent=`木 ${res.wood||0} / 石 ${res.stone||0} / 鉄鉱石 ${res.ironOre||0} / 鉄 ${res.iron||0} / 繊維 ${res.fiber||0} / 木材 ${res.plank||0} / 石材 ${res.stoneBlock||0} / 機械部品 ${res.metalPart||0}`;root.innerHTML=recipes.map(r=>`<div class="mobileInventoryItem"><b>${r.icon||'◆'} ${this.escape(r.name)}</b><small>${Object.entries(r.cost||{}).map(([k,v])=>`${k}:${v}`).join(' / ')}</small><button data-craft="${r.id}" ${this.itemCrafting.canCraft(r.id)?'':'disabled'}>${r.station==='workbench'?'作業台で加工':'クラフト'}</button></div>`).join('');root.querySelectorAll('[data-craft]').forEach(b=>b.onclick=()=>{this.itemCrafting.craft(b.dataset.craft);this.renderCraft();this.renderHotbar()})}
  renderActions(){this.ensureState();this.root.querySelectorAll('.mobileActionBtn').forEach((b,i)=>{const a=this.state.controls.mobileActions[i];b.textContent=a?.label||`A${i+1}`;b.dataset.action=a?.action||''})}
  render(){this.renderActions();this.renderHotbar();this.renderCombatHud();const hud=this.$('#mobileGameHud');if(hud)hud.classList.toggle('hidden',this.state.controls.mobileHud===false)}
  renderCombatHud(){const g=this.state.multiplayer?.gameplay||{},hp=Number(g.hp??100),max=Math.max(1,Number(g.maxHp??100)),mode=this.state.multiplayer?.playMode==='versus'?`VS / ${this.state.multiplayer?.team||'A'}`:'CO-OP';const t=this.$('#mobileHpText'),f=this.$('#mobileHpFill'),m=this.$('#mobileModeLabel');if(t)t.textContent=`HP ${Math.round(hp)}/${Math.round(max)}${g.dead?' DOWN':''}`;if(f)f.style.width=`${Math.max(0,Math.min(100,hp/max*100))}%`;if(m)m.textContent=mode}
  escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
}
