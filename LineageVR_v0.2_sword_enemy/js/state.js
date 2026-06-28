window.Lineage = {
  player: {
    hp: 100,
    maxHp: 100,
    level: 1,
    exp: 0,
    attack: 12
  },
  enemies: [],
  sword: {
    held: false,
    speed: 0,
    lastHitTime: 0
  },
  addExp(amount){
    this.player.exp += amount;
    const need = this.player.level * 35;
    if(this.player.exp >= need){
      this.player.exp -= need;
      this.player.level += 1;
      this.player.attack += 4;
      this.player.maxHp += 10;
      this.player.hp = this.player.maxHp;
      const text = document.querySelector("#worldText");
      if(text) text.setAttribute("value", "Level Up! Lv " + this.player.level);
    }
    this.updateHUD();
  },
  damagePlayer(amount){
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.updateHUD();
    const text = document.querySelector("#worldText");
    if(text) text.setAttribute("value", "被弾! HP " + this.player.hp);
  },
  updateHUD(){
    const el = document.querySelector("#hudStats");
    if(!el) return;
    el.textContent = `HP ${this.player.hp}/${this.player.maxHp} / Lv ${this.player.level} / EXP ${this.player.exp} / ATK ${this.player.attack}`;
  }
};