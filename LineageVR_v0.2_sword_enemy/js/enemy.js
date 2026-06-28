AFRAME.registerComponent("enemy", {
  schema: {
    type: {default:"slime"},
    hp: {type:"number", default:60},
    speed: {type:"number", default:0.4}
  },
  init(){
    this.maxHp = this.data.hp;
    this.hp = this.data.hp;
    this.dead = false;
    this.attackCooldown = 0;
    this.flashTimer = 0;

    const barBg = document.createElement("a-box");
    barBg.setAttribute("position", "0 1.25 0");
    barBg.setAttribute("width", "0.9");
    barBg.setAttribute("height", "0.08");
    barBg.setAttribute("depth", "0.02");
    barBg.setAttribute("color", "#222");
    this.el.appendChild(barBg);

    const bar = document.createElement("a-box");
    bar.setAttribute("position", "0 1.25 0.015");
    bar.setAttribute("width", "0.86");
    bar.setAttribute("height", "0.045");
    bar.setAttribute("depth", "0.025");
    bar.setAttribute("color", "#ff4a4a");
    this.el.appendChild(bar);
    this.hpBar = bar;

    Lineage.enemies.push(this.el);
  },
  takeDamage(amount){
    if(this.dead) return;
    this.hp -= amount;
    this.flashTimer = 0.15;
    const body = this.el.querySelector(".enemyBody") || this.el;
    body.setAttribute("color", "#fff06a");

    const text = document.querySelector("#worldText");
    if(text) text.setAttribute("value", `${this.data.type} に ${amount} ダメージ!`);

    if(this.hp <= 0){
      this.die();
    } else {
      this.updateBar();
    }
  },
  updateBar(){
    const ratio = Math.max(0, this.hp / this.maxHp);
    if(this.hpBar) this.hpBar.setAttribute("width", 0.86 * ratio);
  },
  die(){
    this.dead = true;
    this.updateBar();
    this.el.setAttribute("visible", "false");
    Lineage.addExp(this.data.type === "dummy" ? 8 : 20);
    setTimeout(() => {
      this.hp = this.maxHp;
      this.dead = false;
      this.el.setAttribute("visible", "true");
      this.updateBar();
      const p = this.el.object3D.position;
      p.x = (Math.random() - 0.5) * 5;
      p.z = -6 - Math.random() * 5;
    }, 2500);
  },
  tick(time, delta){
    if(this.dead) return;
    const dt = Math.min(delta/1000, 0.05);

    if(this.flashTimer > 0){
      this.flashTimer -= dt;
      if(this.flashTimer <= 0){
        const body = this.el.querySelector(".enemyBody") || this.el;
        body.setAttribute("color", this.data.type === "dummy" ? "#c8955d" : "#9b72ff");
      }
    }

    // Dummy does not move.
    if(this.data.speed <= 0) return;

    const rig = document.querySelector("#rig");
    if(!rig) return;

    const ep = this.el.object3D.position;
    const pp = rig.object3D.position;
    const dx = pp.x - ep.x;
    const dz = pp.z - ep.z;
    const dist = Math.hypot(dx, dz);

    if(dist < 9 && dist > 1.25){
      ep.x += (dx / dist) * this.data.speed * dt;
      ep.z += (dz / dist) * this.data.speed * dt;
      this.el.object3D.lookAt(pp.x, ep.y, pp.z);
    }

    this.attackCooldown -= dt;
    if(dist <= 1.35 && this.attackCooldown <= 0){
      this.attackCooldown = 1.2;
      Lineage.damagePlayer(5);
    }
  }
});