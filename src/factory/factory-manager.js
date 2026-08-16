import {FactoryMachine} from './machine.js';
import {Conveyor} from './conveyor.js';
import {InspectionStation} from './inspection.js';
export class FactoryManager{
  constructor(state){this.state=state;this.ensureState()}
  ensureState(){const f=this.state.factory=this.state.factory&&typeof this.state.factory==='object'?this.state.factory:{};f.running=!!f.running;f.time=Number(f.time)||0;f.machines=Array.isArray(f.machines)?f.machines:[];f.conveyors=Array.isArray(f.conveyors)?f.conveyors:[];f.inspections=Array.isArray(f.inspections)?f.inspections:[];return f}
  addMachine(data={}){const f=this.ensureState();const raw=new FactoryMachine(data);f.machines.push({...raw});return f.machines.at(-1)}
  machine(id){return this.ensureState().machines.find(m=>m.id===id||m.name===id)}
  enqueue(machineId,job){const m=this.machine(machineId);if(!m)throw new Error(`Machine not found: ${machineId}`);m.queue=Array.isArray(m.queue)?m.queue:[];const row={id:job.id||`JOB-${Date.now().toString(36).toUpperCase()}`,state:'queued',progress:0,elapsed:0,...job};m.queue.push(row);return row}
  addConveyor(data={}){const f=this.ensureState();const raw=new Conveyor(data);f.conveyors.push({...raw});return f.conveyors.at(-1)}
  addInspection(data={}){const f=this.ensureState();const raw=new InspectionStation(data);f.inspections.push({...raw});return f.inspections.at(-1)}
  setRunning(v){this.ensureState().running=!!v}
  update(dt){const f=this.ensureState();if(!f.running)return [];dt=Math.max(0,Number(dt)||0);f.time+=dt;const completed=[];for(const m of f.machines){m.queue=Array.isArray(m.queue)?m.queue:[];m.completedJobs=Array.isArray(m.completedJobs)?m.completedJobs:[];if(!m.currentJob&&m.queue.length&&m.power!==false){m.currentJob=m.queue.shift();m.currentJob.state='running';m.currentJob.elapsed=Number(m.currentJob.elapsed)||0;m.currentJob.duration=Math.max(.01,Number(m.currentJob.duration)||Number(m.cycleTime)||10);m.state='running'}const j=m.currentJob;if(j&&m.power!==false){j.elapsed+=dt;j.progress=Math.min(1,j.elapsed/j.duration);if(j.progress>=1){j.state='done';j.completedAt=new Date().toISOString();m.completedJobs.push(j);completed.push({machine:m,job:j});m.currentJob=null;m.state='idle'}}}for(const c of f.conveyors){c.items=Array.isArray(c.items)?c.items:[];for(const item of c.items){if(item.done)continue;item.position=(Number(item.position)||0)+(Number(c.speed)||0)*dt;if(item.position>=Number(c.length||10)){item.position=Number(c.length||10);item.done=true}}}return completed}
  summary(){const f=this.ensureState();return {running:f.running,time:f.time,machines:f.machines.map(m=>({id:m.id,type:m.type,state:m.state||'idle',queued:(m.queue||[]).length,current:m.currentJob?.id||null,completed:(m.completedJobs||[]).length}))}}
}
