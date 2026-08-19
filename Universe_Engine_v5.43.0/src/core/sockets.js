function v3(v,f=[0,0,0]){const a=Array.isArray(v)?v:f;return [Number(a[0])||0,Number(a[1])||0,Number(a[2])||0]}
export function ensureSockets(part){part.sockets=Array.isArray(part.sockets)?part.sockets:[];return part.sockets}
export function addSocket(part,data={}){const list=ensureSockets(part),i=list.length+1;const s={id:data.id||`SKT${String(i).padStart(3,'0')}`,name:data.name||`Socket ${i}`,type:data.type||'attach',position:v3(data.position),rotation:v3(data.rotation),hand:data.hand||'either',enabled:data.enabled!==false};list.push(s);return s}
export function removeSocket(part,id){part.sockets=ensureSockets(part).filter(s=>s.id!==id)}
