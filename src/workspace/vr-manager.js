import {VRButton} from 'three/addons/webxr/VRButton.js';
export class VRManager{
  constructor(state,scene,{onStatus=()=>{}}={}){this.state=state;this.scene=scene;this.onStatus=onStatus;this.button=null;this.ensureState()}
  ensureState(){this.state.vr={enabled:false,locomotion:'stick',snapTurnDeg:30,...(this.state.vr||{})}}
  supported(){return !!navigator.xr&&!!this.scene?.renderer?.xr}
  async toggle(){
    this.ensureState();
    if(!navigator.xr){this.onStatus('このブラウザはWebXRをサポートしていません','error');return false}
    const ok=await navigator.xr.isSessionSupported?.('immersive-vr').catch(()=>false);if(!ok){this.onStatus('immersive-vr が利用できません。HTTPS + 対応HMDで開いてください','error');return false}
    this.scene.renderer.xr.enabled=true;
    if(!this.button){this.button=VRButton.createButton(this.scene.renderer);this.button.id='ueVrSessionButton';this.button.style.zIndex='120';document.body.appendChild(this.button)}
    this.button.click();this.state.vr.enabled=true;this.onStatus('WebXR VRセッションを開始します','command');return true
  }
}
