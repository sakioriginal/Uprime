export class InspectionStation {
  constructor({id='QC01',tolerance=.05}={}){this.id=id;this.tolerance=Math.abs(Number(tolerance)||.05);this.history=[]}
  inspect(part,nominal={}){
    const measured={};let passed=true;
    for(const [key,value] of Object.entries(nominal||{})){
      if(!Number.isFinite(Number(value)))continue;
      const actual=Number(part?.params?.[key]??value);
      measured[key]=actual;
      if(Math.abs(actual-Number(value))>this.tolerance)passed=false;
    }
    const result={id:`QC${String(this.history.length+1).padStart(4,'0')}`,partId:part?.id||null,passed,measured,tolerance:this.tolerance,time:new Date().toISOString()};
    this.history.push(result);return result;
  }
}
