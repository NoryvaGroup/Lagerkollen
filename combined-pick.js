'use strict';
// Read-only comparison. Picking status, locations and order quantities stay independent.
const comparedOrders = new Map();
function combinedPickSectionMap(order){
  const members=new Map(),occurrences=new Map();let section={key:'ungrouped',name:'Utan sektion'};
  for(const article of order.articles){
    if(article.isGroup){
      const name=article.description||article.nr;
      const base=norm(name).replace(/\b\d+(?:[.,]\d+)?\s*KW\b/g,'KW');
      const occurrence=occurrences.get(base)||0;occurrences.set(base,occurrence+1);
      section={key:base+'\u0000'+occurrence,name};
    }else members.set(article.id,section);
  }
  return members;
}
function combinedPickSectionRows(first,second,nr,unit){
  const sections=new Map();
  [first,second].forEach((order,index)=>{
    const members=combinedPickSectionMap(order);
    for(const a of order.articles){
      if(a.isGroup||norm(a.nr)!==norm(nr)||norm(a.unit||'ST')!==norm(unit||'ST'))continue;
      const section=members.get(a.id);
      if(!sections.has(section.key))sections.set(section.key,{key:section.key,name:section.name,amounts:[0,0],unknown:[false,false],present:[false,false]});
      const row=sections.get(section.key);row.present[index]=true;
      if(a.requiredQty==null)row.unknown[index]=true;else row.amounts[index]+=a.requiredQty;
    }
  });
  return [...sections.values()].map(row=>({...row,total:row.unknown.some(Boolean)?null:row.amounts[0]+row.amounts[1]}));
}
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
  if(other){
    document.querySelector('#combinedResults thead th:last-child').textContent='Totalt alla sektioner';
    document.querySelectorAll('#combinedResults tbody tr').forEach((element,index)=>{
      const row=rows[index],sections=combinedPickSectionRows(order,other,row.nr,row.unit);
      if(sections.length>1){
        const detail=document.createElement('div');
        detail.innerHTML=sections.map(s=>'<small>'+esc(s.name)+': '+(s.total==null?'okänt':quantity(s.amounts[0])+' + '+quantity(s.amounts[1])+' = '+quantity(s.total)+' '+esc(row.unit))+'</small>').join('');
        element.lastElementChild.append(detail);
      }
    });
  }
  document.querySelectorAll('#articles .article').forEach(element=>{
    element.querySelector('.shared-pick-badge')?.remove();
    const article=order.articles.find(a=>a.id===element.dataset.id);
    const row=article&&shared.find(r=>norm(r.nr)===norm(article.nr)&&norm(r.unit)===norm(article.unit||'ST'));
    element.classList.toggle('shared-pick',!!row);
    if(row){
      const key=combinedPickSectionMap(order).get(article.id)?.key;
      const section=combinedPickSectionRows(order,other,article.nr,article.unit).find(s=>s.key===key);
      const badge=document.createElement('div');badge.className='shared-pick-badge';
      const amount=section?.total==null?'okänt':quantity(section.total)+' '+row.unit;
      badge.textContent='Denna sektion, båda ordrar: '+amount;
      if(section&&!section.unknown.some(Boolean))badge.textContent+=' ('+quantity(section.amounts[0])+' + '+quantity(section.amounts[1])+')';
      const total=document.createElement('small');total.style.display='block';
      total.textContent='Totalt i alla sektioner: '+(row.total==null?'okänt':quantity(row.total)+' '+row.unit)+'. Samma artikelnummer återkommer; totalsumman är inte extra att plocka.';
      badge.append(total);element.querySelector('.identity').append(badge);
    }
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
