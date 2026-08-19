function clone(v){return JSON.parse(JSON.stringify(v));}
var PART_KEYS=['type','bodyKind','name','params','position','rotation','scale','visible','opacity','color','features','rollbackIndex','baseState','metadata','datums','geometryConstraints','physics','components','motionAxes','sockets','motionBase','entityKind','manufacturing','locked'];
function safePart(o){var out={};PART_KEYS.forEach(function(k){if(o[k]!==undefined)out[k]=clone(o[k]);});return out;}
function ensure(state){state.manufacturing=state.manufacturing||{};state.manufacturing.recipes=Array.isArray(state.manufacturing.recipes)?state.manufacturing.recipes:[];return state.manufacturing.recipes;}
function makeId(prefix){prefix=prefix||'RCP';return prefix+'-'+Date.now().toString(36).toUpperCase()+'-'+Math.floor(Math.random()*9999).toString().padStart(4,'0');}
function averagePosition(objects){if(!objects.length)return [0,0,0];var s=objects.reduce(function(a,o){var p=Array.isArray(o.position)?o.position:[0,0,0];return [a[0]+(p[0]||0),a[1]+(p[1]||0),a[2]+(p[2]||0)];},[0,0,0]);return s.map(function(v){return v/objects.length;});}
function lastId(items){return items && items.length?items[items.length-1].id:null;}
function ensureThumbnail(r){r.thumbnail=r.thumbnail||{preferred:'model',screenshot:null,model:null,updatedAt:null};return r.thumbnail;}

export class RecipeBlueprintManager{
  constructor(state,addPart){this.state=state;this.addPart=addPart;ensure(state);}
  list(filter){var rows=ensure(this.state).slice();filter=filter||{};var q=String(filter.query||'').trim().toLowerCase(),cat=String(filter.category||'');return rows.filter(function(r){if(cat&&cat!=='ALL'&&r.category!==cat)return false;if(!q)return true;return [r.name,r.category,r.kind,r.notes,(r.tags||[]).join(' ')].join(' ').toLowerCase().indexOf(q)>=0;});}
  categories(){var base=['アイテム','道具','食べ物','建築素材','建築','家具','乗り物','機械','キャラ','服装','武器','装備','クリーチャー','その他'];ensure(this.state).forEach(function(r){if(r.category&&base.indexOf(r.category)<0)base.push(r.category);});return base;}
  saveSelection(options){options=options||{};var name=options.name||'新しいレシピ',category=options.category||'その他',kind=options.kind||'recipe',notes=options.notes||'',tags=options.tags||[];
    var objects=this.state.selectedObjects?this.state.selectedObjects():[];if(!objects.length)throw new Error('レシピ化するオブジェクトを選択してください');
    var anchor=averagePosition(objects),ids=new Set(objects.map(function(o){return o.id;}));
    var groups=(this.state.groups||[]).filter(function(g){return g.memberIds.some(function(id){return ids.has(id);});}).map(function(g){var c=clone(g);c.memberIds=g.memberIds.filter(function(id){return ids.has(id);});return c;});
    var record={id:makeId(kind==='blueprint'?'BP':'RCP'),name:String(name),category:String(category),kind:kind,version:1,favorite:!!options.favorite,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),notes:String(notes),tags:Array.isArray(tags)?tags:String(tags).split(',').map(function(x){return x.trim();}).filter(Boolean),anchor:anchor,objects:objects.map(function(o){var c=safePart(o),p=Array.isArray(o.position)?o.position:[0,0,0];c.sourceObjectId=o.id;c.position=[(p[0]||0)-anchor[0],(p[1]||0)-anchor[1],(p[2]||0)-anchor[2]];return c;}),groups:groups,thumbnail:{preferred:String(options.thumbnailPreferred||'model'),screenshot:null,model:null,updatedAt:null}};
    ensure(this.state).push(record);return record;
  }

  setThumbnail(id,type,dataUrl){var r=ensure(this.state).find(function(x){return x.id===id;});if(!r)throw new Error('レシピが見つかりません');if(type!=='screenshot'&&type!=='model')throw new Error('thumbnail type');var t=ensureThumbnail(r);t[type]=dataUrl||null;t.updatedAt=new Date().toISOString();r.updatedAt=t.updatedAt;return t;}
  setThumbnailPreferred(id,type){var r=ensure(this.state).find(function(x){return x.id===id;});if(!r)throw new Error('レシピが見つかりません');var t=ensureThumbnail(r);t.preferred=(type==='screenshot'?'screenshot':'model');r.updatedAt=new Date().toISOString();return t.preferred;}
  thumbnail(id,type){var r=ensure(this.state).find(function(x){return x.id===id;});if(!r)return null;var t=ensureThumbnail(r);return t[type||t.preferred]||t.model||t.screenshot||null;}
  toggleFavorite(id){var r=ensure(this.state).find(function(x){return x.id===id;});if(!r)throw new Error('レシピが見つかりません');r.favorite=!r.favorite;r.updatedAt=new Date().toISOString();return r.favorite;}
  duplicate(id){var r=ensure(this.state).find(function(x){return x.id===id;});if(!r)throw new Error('レシピが見つかりません');var c=clone(r);c.id=makeId(c.kind==='blueprint'?'BP':'RCP');c.name=c.name+' Copy';c.createdAt=new Date().toISOString();c.updatedAt=c.createdAt;ensure(this.state).push(c);return c;}

  remove(id){var a=ensure(this.state),i=a.findIndex(function(r){return r.id===id;});if(i>=0)a.splice(i,1);return i>=0;}
  instantiate(id,origin){origin=Array.isArray(origin)?origin:[0,0,0];var r=ensure(this.state).find(function(x){return x.id===id;});if(!r)throw new Error('レシピが見つかりません');var made=[],idMap=new Map();
    r.objects.forEach(function(raw){var data=clone(raw),rel=Array.isArray(data.position)?data.position:[0,0,0];delete data.sourceObjectId;data.position=[origin[0]+rel[0],origin[1]+rel[1],origin[2]+rel[2]];data.groupId=null;data.groupCode=null;var o=this.addPart(data.type,data,false);made.push(o);idMap.set(raw.sourceObjectId,o.id);},this);
    if(made.length>1){var gid='group-'+Date.now(),groupCode='G'+String((this.state.groups||[]).length+1).padStart(3,'0'),g={id:gid,groupCode:groupCode,name:r.name,memberIds:made.map(function(o){return o.id;})};this.state.groups.push(g);made.forEach(function(o){o.groupId=gid;o.groupCode=groupCode;});}
    this.state.selectedIds=made.map(function(o){return o.id;});this.state.primaryId=lastId(made);return made;
  }
  exportJson(id){var r=ensure(this.state).find(function(x){return x.id===id;});if(!r)throw new Error('レシピが見つかりません');return JSON.stringify({format:'UE-RECIPE',version:1,recipe:r},null,2);}
  importJson(text){var d=JSON.parse(text),r=(d&&d.recipe)?d.recipe:d;if(!r||!r.name||!Array.isArray(r.objects))throw new Error('レシピ形式ではありません');r=clone(r);r.id=makeId(r.kind==='blueprint'?'BP':'RCP');r.updatedAt=new Date().toISOString();ensure(this.state).push(r);return r;}
}
