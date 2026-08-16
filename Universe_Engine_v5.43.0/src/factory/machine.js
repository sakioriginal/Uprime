export class FactoryMachine {
  constructor({id,type='generic',name=null,cycleTime=10}={}){
    this.id=id||`MCH-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    this.type=type;
    this.name=name||this.id;
    this.state='idle';
    this.power=true;
    this.cycleTime=Math.max(0.01,Number(cycleTime)||10);
    this.queue=[];
    this.currentJob=null;
    this.completedJobs=[];
    this.toolId=null;
    this.position={x:0,y:0,z:0};
  }
  enqueue(job){this.queue.push(job);return job}
  startNext(){
    if(!this.power||this.currentJob||!this.queue.length)return null;
    this.currentJob=this.queue.shift();
    this.currentJob.elapsed=Number(this.currentJob.elapsed)||0;
    this.currentJob.duration=Math.max(.01,Number(this.currentJob.duration)||this.cycleTime);
    this.currentJob.state='running';
    this.state='running';
    return this.currentJob;
  }
  update(dt){
    if(!this.currentJob)this.startNext();
    const job=this.currentJob;
    if(!job||!this.power)return null;
    job.elapsed+=Math.max(0,Number(dt)||0);
    job.progress=Math.min(1,job.elapsed/job.duration);
    if(job.progress>=1){
      job.state='done';
      job.completedAt=new Date().toISOString();
      this.completedJobs.push(job);
      this.currentJob=null;
      this.state='idle';
      return job;
    }
    return null;
  }
}
