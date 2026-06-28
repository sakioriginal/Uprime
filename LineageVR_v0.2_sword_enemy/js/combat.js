window.Combat = {
  hitEnemy(enemyEl, damage){
    const comp = enemyEl.components.enemy;
    if(!comp || comp.dead) return;
    comp.takeDamage(damage);
  }
};