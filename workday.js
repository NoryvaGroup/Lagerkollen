'use strict';
// Dashboard is a projection of existing orders, not a second picking database.
let lastPickingUndo=null;
const undoArticleKeys=['status','statusVersion','blockReason'];
const undoStockKeys=['foundCount','lastSeen','lastOrder','lastFoundLocation'];
const undoCopy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const undoSame=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function beginPickingUndo(targets,label){
  return {label,targets:targets.map(({order,article})=>({orderId:order.id,id:article.id,nr:article.nr,before:undoCopy(article)})),stock:Object.fromEntries([...new Set(targets.map(t=>norm(t.article.nr)))].map(nr=>[nr,undoCopy(data.stock[nr])]))};
}
function finishPickingUndo(snapshot){
  if(!snapshot)return;
  const targets=snapshot.targets.map(t=>{const a=data.orders.find(o=>o.id===t.orderId)?.articles.find(a=>a.id===t.id);return {...t,after:undoCopy(a)};}).filter(t=>t.after&&undoArticleKeys.some(k=>!undoSame(t.before[k],t.after[k])));
  if(!targets.length)return;
  const keys=[...new Set(targets.map(t=>norm(t.nr)))];
  lastPickingUndo={label:snapshot.label,targets,stock:keys.map(nr=>({nr,before:snapshot.stock[nr]||{},after:undoCopy(data.stock[nr]||{})}))};
}
function renderPickingUndo(){
  const bar=$('undoPickingBar');if(!bar)return;
  bar.classList.toggle('hidden',!lastPickingUndo);
  if(lastPickingUndo)$('undoPickingText').textContent=lastPickingUndo.label+' · '+lastPickingUndo.targets.length+' artikelrader';
}
function undoLastPicking(){
  const record=lastPickingUndo;if(!record)return false;
  if(cloudConflict){notice('Lös synkkonflikten innan du ångrar.');return false;}
  const targets=record.targets.map(t=>({t,order:data.orders.find(o=>o.id===t.orderId)})).map(x=>({...x,article:x.order?.articles.find(a=>a.id===x.t.id)}));
  if(targets.some(({t,order,article})=>!order||order.archived||!article||article.nr!==t.nr||article.updated!==t.after.updated||undoArticleKeys.some(k=>!undoSame(article[k],t.after[k])))){
    lastPickingUndo=null;renderPickingUndo();notice('Kan inte ångra: någon berörd status har ändrats eller ordern har tagits bort/arkiverats.');return false;
  }
  const now=Date.now();
  for(const {t,order,article} of targets){for(const key of undoArticleKeys){if(t.before[key]===undefined)delete article[key];else article[key]=undoCopy(t.before[key]);}article.updated=Math.max(now,(article.updated||0)+1);order.updated=article.updated;}
  // Never undo locations, descriptions, notes or newer register edits.
  for(const s of record.stock){const current=data.stock[s.nr];if(!current||undoStockKeys.some(k=>!undoSame(current[k],s.after[k])))continue;for(const k of undoStockKeys){if(s.before[k]===undefined)delete current[k];else current[k]=undoCopy(s.before[k]);}current.updated=Math.max(now,(current.updated||0)+1);}
  lastPickingUndo=null;persist();notice('Senaste statusändringen ångrad. Lagerplatser och antal är kvar.');return true;
}
function workdaySummary(order){
  const rows=order.articles.filter(a=>!a.isGroup),count=status=>rows.filter(a=>a.status===status).length;
  const total=rows.length,fetched=count('fetched'),missing=count('notfound'),blocked=count('found');
  return {total,fetched,missing,blocked,notStarted:total-fetched-missing-blocked,remaining:total-fetched};
}
function workdayOrderMatches(o,query,line){return !o.archived&&(!line||o.line===line)&&[o.name,o.productNr,o.productName,o.line,o.subgroup].join(' ').toLocaleLowerCase('sv').includes(query.trim().toLocaleLowerCase('sv'));}
function workdayCard(o){
  const s=workdaySummary(o),percent=s.total?Math.round(s.fetched/s.total*100):0;
  return '<article class="day-card"><div class="day-card-meta"><span>'+esc(o.subgroup||'Utan underrubrik')+'</span><span>'+(s.total?(s.remaining?'Pågående':'Plock klar'):'Inväntar artikellista')+'</span></div><h4>Order '+esc(o.name)+'</h4><p class="day-product">'+esc(o.productName||o.productNr||'Aggregat ej angivet')+'</p><div class="day-progress-label"><strong>'+s.fetched+' av '+s.total+' hämtade</strong><span>'+percent+' %</span></div><progress value="'+s.fetched+'" max="'+Math.max(1,s.total)+'" aria-label="'+s.fetched+' av '+s.total+' hämtade"></progress><div class="day-breakdown"><span>'+s.notStarted+' inte påbörjade</span><span class="day-missing">'+s.missing+' inte hittade</span><span class="day-waiting">'+s.blocked+' väntar</span></div><button class="'+(o.id===data.current?'primary':'secondary')+'" type="button" data-day-order="'+esc(o.id)+'">'+(o.id===data.current?'Fortsätt plocka':'Öppna order')+'</button></article>';
}
function renderWorkday(){
  if(!$('dayOrders'))return;
  const active=data.orders.filter(o=>!o.archived),query=$('daySearch').value,line=$('dayLine').value;
  const available=[...new Set(active.map(o=>o.line).filter(Boolean))];
  $('dayLine').innerHTML='<option value="">Alla produktionslinjer</option>'+available.map(l=>'<option value="'+esc(l)+'">'+esc(l)+'</option>').join('');$('dayLine').value=available.includes(line)?line:'';
  const orders=active.filter(o=>workdayOrderMatches(o,query,$('dayLine').value));
  const totals=active.reduce((s,o)=>{const x=workdaySummary(o);for(const k of Object.keys(s))s[k]+=x[k];return s;},{notStarted:0,missing:0,blocked:0,fetched:0});
  $('dayTotals').innerHTML=[['Aktiva ordrar',active.length],['Inte påbörjade rader',totals.notStarted],['Inte hittade',totals.missing],['Hittade · väntar',totals.blocked],['Hämtade rader',totals.fetched]].map(([label,n])=>'<div><strong>'+n+'</strong><span>'+label+'</span></div>').join('');
  const lines=[...new Set([...lineNames(),...orders.map(o=>o.line||'Ej placerad')])];
  $('dayOrders').innerHTML=lines.map(l=>{const items=orders.filter(o=>(o.line||'Ej placerad')===l);if(!items.length)return '';const groups=[...new Set(items.map(o=>o.subgroup||'Utan underrubrik'))];return '<section class="day-line"><header><span>PRODUKTIONSLINJE</span><h3>'+esc(l)+'</h3><small>'+items.length+' ordrar</small></header>'+groups.map(g=>'<section class="day-group"><h4>'+esc(g)+'</h4><div class="day-grid">'+items.filter(o=>(o.subgroup||'Utan underrubrik')===g).sort((a,b)=>Number(b.id===data.current)-Number(a.id===data.current)||a.name.localeCompare(b.name,'sv',{numeric:true})).map(workdayCard).join('')+'</div></section>').join('')+'</section>';}).join('')||'<div class="empty">'+(active.length?'Ingen order matchar sökningen.':'Inga aktiva ordrar ännu. Skapa en order för att börja.')+'</div>';
  $('dayCount').textContent='Visar '+orders.length+' av '+active.length+' aktiva ordrar';renderPickingUndo();
}
$('daySearch').oninput=renderWorkday;$('dayLine').onchange=renderWorkday;
$('dayOrders').onclick=e=>{const b=e.target.closest('[data-day-order]');if(b)selectOrder(b.dataset.dayOrder);};
$('dayNew').onclick=()=>{show('orders');startOrder();};
$('undoPicking').onclick=undoLastPicking;
show('home');
