import {ensureMotionAxes,applyMotionAxis} from "./motion-axis.js";

function getAxis(state,ref){if(!ref)return null;const part=state.object?.(ref.partId)||state.objects?.find(o=>o.id===ref.partId||o.objectId===ref.partId);if(!part)return null;const axis=ensureMotionAxes(part).find(a=>a.id===ref.axisId||a.name===ref.axisId);return axis?{part,axis}:null}
export function ensureMechanical(state){state.mechanical=state.mechanical&&typeof state.mechanical==="object"?state.mechanical:{};state.mechanical.links=Array.isArray(state.mechanical.links)?state.mechanical.links:[];state.mechanical.motors=Array.isArray(state.mechanical.motors)?state.mechanical.motors:[];state.mechanical.running=!!state.mechanical.running;state.mechanical.time=Number(state.mechanical.time)||0;return state.mechanical}
export class MechanicalSolver{
  constructor(state,scene){this.state=state;this.scene=scene;ensureMechanical(state)}
  addLink(data={}){const m=ensureMechanical(this.state);const link={id:data.id||`ML${String(m.links.length+1).padStart(3,"0")}`,type:data.type||"gear",source:data.source||null,target:data.target||null,ratio:Number.isFinite(+data.ratio)?+data.ratio:1,offset:Number(data.offset)||0,enabled:data.enabled!==false};m.links.push(link);return link}
  addMotor(data={}){const m=ensureMechanical(this.state);const motor={id:data.id||`MTR${String(m.motors.length+1).padStart(3,"0")}`,axis:data.axis||null,rpm:Number(data.rpm)||60,torque:Number(data.torque)||1,enabled:data.enabled!==false,phase:Number(data.phase)||0};m.motors.push(motor);return motor}
  step(dt){const m=ensureMechanical(this.state);if(!m.running)return 0;dt=Math.max(0,Math.min(.1,Number(dt)||0));m.time+=dt;let changed=0;for(const motor of m.motors){if(!motor.enabled)continue;const r=getAxis(this.state,motor.axis);if(!r)continue;r.axis.value=(Number(r.axis.value)||0)+motor.rpm*6*dt;applyMotionAxis(r.part,r.axis,this.scene);changed++}
    for(let pass=0;pass<4;pass++)for(const link of m.links){if(!link.enabled)continue;const s=getAxis(this.state,link.source),t=getAxis(this.state,link.target);if(!s||!t)continue;const sv=Number(s.axis.value)||0;let tv=sv*link.ratio+link.offset;if(link.type==="gear")tv=-tv;else if(link.type==="rack")tv=sv*link.ratio+link.offset;else if(link.type==="belt"||link.type==="chain")tv=sv*link.ratio+link.offset;else if(link.type==="cam")tv=(Math.sin((sv*Math.PI)/180)*.5+.5)*link.ratio+link.offset;t.axis.value=tv;applyMotionAxis(t.part,t.axis,this.scene);changed++}
    return changed
  }
  setRunning(v){ensureMechanical(this.state).running=!!v;return this.state.mechanical.running}
}
