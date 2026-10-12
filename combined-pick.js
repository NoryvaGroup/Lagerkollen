'use strict';
// Read-only comparison. Picking status, locations and order quantities stay independent.
const comparedOrders = new Map();
function combinedPickRows(first, second) {
  const rows = new Map();
  [first,second].forEach((order,index)=>{
    for(const article of order?.articles||[]){
      if(article.isGroup)continue;
      const key=norm(article.nr)+'\u0000'+norm(article.unit||'ST');
      if(!rows.has(key))rows.set(key,{nr:article.nr,description:article.description||'',unit:article.unit||'ST',amounts:[0,0],unknown:[false,false],present:[false,false],locations:[]});
      const row=rows.get(key);row.present[index]=true;
      if(article.requiredQty==null)row.unknown[index]=true;
      else row.amounts[index]+=article.requiredQty;
      const location=article.location||data.stock[norm(article.nr)]?.location||'';
      if(location&&!row.locations.includes(location))row.locations.push(location);
    }
  });
  return [...rows.values()].map(row=>({...row,shared:row.present.every(Boolean),total:row.unknown.some(Boolean)?null:row.amounts[0]+row.amounts[1]}));
}
function renderCombinedPick(){
  const order=current(),panel=$('combinedPick');if(!panel||!order)return;
  const candidates=data.orders.filter(o=>o.id!==order.id&&!o.archived&&o.articles.some(a=>!a.isGroup));
  if(!comparedOrders.has(order.id)){
    const batch=candidates.filter(o=>o.created===order.created&&o.line===order.line&&o.subgroup===order.subgroup);
    comparedOrders.set(order.id,batch.length===1?batch[0].id:'');
  }
  const selected=comparedOrders.get(order.id),other=candidates.find(o=>o.id===selected);
  $('compareOrder').innerHTML='<option value="">Ingen jämförelse</option>'+candidates.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name+' · '+(o.productName||o.subgroup||''))+'</option>').join('');
  $('compareOrder').value=other?.id||'';
  const rows=other?combinedPickRows(order,other):[],shared=rows.filter(r=>r.shared);
  $('combinedCount').textContent=other?shared.length+' gemensamma artikelnummer':'';
  const qty=(row,index)=>!row.present[index]?'—':row.unknown[index]?'Okänt':quantity(row.amounts[index])+' '+esc(row.unit);
  $('combinedResults').innerHTML=other?'<p class="joint-help">Totalt behov för hela båda ordrarna, inklusive upprepade artikelrader. Kontrollera VBA1 innan du hämtar: tomt saldo är okänt, inte noll. Markera plockstatus i respektive order.</p><div class="joint-table-wrap"><table class="joint-table"><thead><tr><th>Artikel / lagerplats</th><th>Order '+esc(order.name)+'</th><th>Order '+esc(other.name)+'</th><th>Behov båda</th></tr></thead><tbody>'+rows.map(row=>'<tr class="'+(row.shared?'joint-shared':'')+'"><th scope="row"><strong>'+esc(row.nr)+'</strong>'+(row.shared?'<span class="joint-tag">Gemensam</span>':'<span class="joint-tag unique">Endast en order</span>')+'<span class="joint-description">'+esc(row.description)+'</span><small>'+esc(row.locations.length?row.locations.join(' / '):'Ingen sparad lagerplats')+'</small></th><td>'+qty(row,0)+'</td><td>'+qty(row,1)+'</td><td><b>'+(row.total==null?'Okänt':quantity(row.total)+' '+esc(row.unit))+'</b>'+(row.shared&&!row.unknown.some(Boolean)?'<small>'+quantity(row.amounts[0])+' + '+quantity(row.amounts[1])+'</small>':'')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="joint-help">Välj en annan order för att se gemensamma artiklar och summerat behov.</p>';
  document.querySelectorAll('#articles .article').forEach(element=>{
    element.querySelector('.shared-pick-badge')?.remove();
    const article=order.articles.find(a=>a.id===element.dataset.id);
    const row=article&&shared.find(r=>norm(r.nr)===norm(article.nr)&&norm(r.unit)===norm(article.unit||'ST'));
    element.classList.toggle('shared-pick',!!row);
    if(row){const badge=document.createElement('div');badge.className='shared-pick-badge';badge.textContent='Gemensam med '+other.name+' · Behov båda: '+(row.total==null?'okänt':quantity(row.total)+' '+row.unit)+' (alla rader)';element.querySelector('.identity').append(badge);}
  });
}
function initCombinedPick(){
  const panel=document.createElement('details');panel.id='combinedPick';panel.className='combined-pick';panel.open=true;
  panel.innerHTML='<summary>Plocka två ordrar samtidigt <span id="combinedCount"></span></summary><div class="joint-body"><label for="compareOrder">Jämför aktiv order med</label><select id="compareOrder"></select><div id="combinedResults"></div></div>';
  document.querySelector('.picking-progress').after(panel);
  $('compareOrder').onchange=()=>{if(current()){comparedOrders.set(current().id,$('compareOrder').value);renderCombinedPick();}};
  renderCombinedPick();
}
initCombinedPick();
