AFRAME.registerComponent("sword", {
  init(){
    this.prev = new THREE.Vector3();
    this.now = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.hasPrev = false;
    this.cooldown = 0;
  },
  tick(time, delta){
    this.el.object3D.getWorldPosition(this.now);
    if(this.hasPrev && delta > 0){
      this.velocity.copy(this.now).sub(this.prev).multiplyScalar(1000/delta);
      Lineage.sword.speed = this.velocity.length();
    }
    this.prev.copy(this.now);
    this.hasPrev = true;
    this.cooldown -= delta/1000;

    if(!Lineage.sword.held) return;
    if(this.cooldown > 0) return;
    if(Lineage.sword.speed < 1.4) return;

    const tip = new THREE.Vector3();
    this.el.object3D.getWorldPosition(tip);

    for(const enemy of Lineage.enemies){
      const comp = enemy.components.enemy;
      if(!comp || comp.dead) continue;
      const ep = new THREE.Vector3();
      enemy.object3D.getWorldPosition(ep);
      ep.y += 0.75;
      const d = tip.distanceTo(ep);
      if(d < 0.85){
        this.cooldown = 0.35;
        const dmg = Math.round(Lineage.player.attack + Lineage.sword.speed * 3);
        Combat.hitEnemy(enemy, dmg);
        break;
      }
    }
  }
});

AFRAME.registerComponent("sword-controller", {
  schema: {hand:{default:"right"}},
  init(){
    this.heldSword = null;
    this.tmp = new THREE.Vector3();

    this.el.addEventListener("triggerdown", () => this.grabSword());
    this.el.addEventListener("gripdown", () => this.grabSword());
    this.el.addEventListener("triggerup", () => this.releaseSword());
    this.el.addEventListener("gripup", () => this.releaseSword());

    // PC fallback.
    window.addEventListener("click", () => {
      const scene = document.querySelector("a-scene");
      if(scene && scene.is("vr-mode")) return;
      const enemies = Lineage.enemies.filter(e => e.components.enemy && !e.components.enemy.dead);
      if(enemies[0]) Combat.hitEnemy(enemies[0], Lineage.player.attack + 4);
    });
  },
  grabSword(){
    const sword = document.querySelector("#sword");
    if(!sword) return;

    this.heldSword = sword;
    Lineage.sword.held = true;

    this.el.object3D.add(sword.object3D);
    sword.object3D.position.set(0, -0.18, -0.18);
    sword.object3D.rotation.set(THREE.MathUtils.degToRad(65), 0, 0);
    const text = document.querySelector("#worldText");
    if(text) text.setAttribute("value", "剣装備！振って攻撃");
  },
  releaseSword(){
    // 今回は落とさず、手に持ったままにする。操作が安定するため。
  }
});