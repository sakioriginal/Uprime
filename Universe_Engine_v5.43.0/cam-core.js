import {ToolLibrary,CamTool} from './tool-library.js';
import {ToolPath} from './toolpath.js';
import {normalizeOperation,boundsFromPart} from './operations.js';
import {GCodeGenerator} from './gcode-generator.js';
function distance(a,b){return Math.hypot((b.x-a.x),(b.y-a.y),(b.z-a.z))}
export class CamCore{
  constructor(state){this.state=state;this.ensureState();this.tools=new ToolLibrary(this.state.cam.tools);this.gcode=new GCodeGenerator()}
  ensureState(){const c=this.state.cam=this.state.cam&&typeof this.state.cam==='object'?this.state.cam:{};c.tools=Array.isArray(c.tools)?c.tools:[];c.operations=Array.isArray(c.operations)?c.operations:[];c.paths=Array.isArray(c.paths)?c.paths:[];c.lastGCode=String(c.lastGCode||'');c.simulation=c.simulation&&typeof c.simulation==='object'?c.simulation:{pathId:null,index:0,running:false,speed:1};return c}
  addTool(data){const t=new CamTool(data);this.tools.add(t);this.state.cam.tools=this.tools.serialize();return t}
  addOperation(part,data={}){const op={id:`OP${String(this.state.cam.operations.length+1).padStart(3,'0')}`,partId:part.id,...normalizeOperation(data)};this.state.cam.operations.push(op);return op}
  generate(part,opInput){const op=typeof opInput==='string'?this.state.cam.operations.find(o=>o.id===opInput):normalizeOperation(opInput||{});if(!op)throw new Error('CAM operation not found');const tool=this.tools.get(op.toolId)||this.tools.list()[0];if(!tool)throw new Error('CAM tool not found');const b=boundsFromPart(part);const path=new ToolPath({id:`TP${String(this.state.cam.paths.length+1).padStart(3,'0')}`,operation:op.type,toolId:tool.id});const safe=op.safeZ;const depths=[];for(let z=-Math.min(op.stepDown,op.depth);z>-op.depth-.00001;z-=op.stepDown)depths.push(Math.max(-op.depth,z));if(!depths.length)depths.push(-op.depth);
    if(op.type==='drill'){
      path.rapid(op.holeX,op.holeY,safe);for(const z of depths){path.feed(op.holeX,op.holeY,z,tool.plunge);path.rapid(op.holeX,op.holeY,safe)}
    }else if(op.type==='pocket'){
      const minX=b.minX+tool.diameter/2+op.margin,maxX=b.maxX-tool.diameter/2-op.margin,minY=b.minY+tool.diameter/2+op.margin,maxY=b.maxY-tool.diameter/2-op.margin;const pitch=Math.max(tool.diameter*.05,tool.diameter*op.stepOver);
      for(const z of depths){path.rapid(minX,minY,safe);path.feed(minX,minY,z,tool.plunge);let y=minY,dir=1;while(y<=maxY+.0001){path.feed(dir>0?maxX:minX,y,z,tool.feed);y+=pitch;if(y<=maxY+.0001)path.feed(dir>0?maxX:minX,y,z,tool.feed);dir*=-1}path.rapid(path.moves.at(-1).x,path.moves.at(-1).y,safe)}
    }else{
      const minX=b.minX-op.margin-tool.diameter/2,maxX=b.maxX+op.margin+tool.diameter/2,minY=b.minY-op.margin-tool.diameter/2,maxY=b.maxY+op.margin+tool.diameter/2;
      for(const z of depths){path.rapid(minX,minY,safe);path.feed(minX,minY,z,tool.plunge);path.feed(maxX,minY,z,tool.feed);path.feed(maxX,maxY,z,tool.feed);path.feed(minX,maxY,z,tool.feed);path.feed(minX,minY,z,tool.feed);path.rapid(minX,minY,safe)}
    }
    path.estimatedSeconds=this.estimate(path,tool);this.state.cam.paths.push({...path});return path}
  estimate(path,tool){let seconds=0,last={x:0,y:0,z:0};for(const m of path.moves||[]){const d=distance(last,m);const mmMin=m.mode==='rapid'?5000:(m.feed||tool.feed||600);seconds+=d/Math.max(.001,mmMin)*60;last=m}return seconds}
  generateGCode(pathId){const raw=this.state.cam.paths.find(p=>p.id===pathId)||this.state.cam.paths.at(-1);if(!raw)throw new Error('ToolPath not found');const tool=this.tools.get(raw.toolId);const text=this.gcode.generate(raw,tool);this.state.cam.lastGCode=text;return text}
  simulate(pathId=null){const path=this.state.cam.paths.find(p=>p.id===pathId)||this.state.cam.paths.at(-1);if(!path)throw new Error('ToolPath not found');this.state.cam.simulation={pathId:path.id,index:0,running:true,speed:1,position:{x:0,y:0,z:0}};return this.state.cam.simulation}
  step(){const s=this.state.cam.simulation;if(!s?.running)return null;const p=this.state.cam.paths.find(x=>x.id===s.pathId);const move=p?.moves?.[s.index++];if(!move){s.running=false;return null}s.position={x:move.x,y:move.y,z:move.z};return move}
  exportNC(filename='universe-engine.nc'){const text=this.state.cam.lastGCode||this.generateGCode();const blob=new Blob([text],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return filename}
}
