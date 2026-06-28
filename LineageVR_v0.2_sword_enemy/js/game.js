AFRAME.registerComponent("lineage-game", {
  init(){
    Lineage.updateHUD();
    this.el.setAttribute("player-system", "");
    console.log("Lineage VR v0.2 started");
  }
});