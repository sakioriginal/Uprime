export class CamTool{
  constructor({id,name,type='endmill',diameter=6,feed=600,plunge=200,spindle=8000}={}){this.id=id||`T${String(Math.floor(Math.random()*99)+1).padStart(2,'0')}`;this.name=name||this.id;this.type=type;this.diameter=Math.max(.001,Number(diameter)||6);this.feed=Math.max(.001,Number(feed)||600);this.plunge=Math.max(.001,Number(plunge)||200);this.spindle=Math.max(0,Number(spindle)||0)}
}
export class ToolLibrary{
  constructor(seed=[]){this.tools=new Map();for(const t of seed)this.add(t instanceof CamTool?t:new CamTool(t));if(!this.tools.size){this.add(new CamTool({id:'T01',name:'End Mill 6mm',diameter:6}));this.add(new CamTool({id:'T02',name:'Drill 5mm',type:'drill',diameter:5,feed:250,plunge:180,spindle:5000}))}}
  add(tool){this.tools.set(tool.id,tool);return tool}
  get(id){return this.tools.get(id)}
  list(){return [...this.tools.values()]}
  serialize(){return this.list().map(t=>({...t}))}
}
