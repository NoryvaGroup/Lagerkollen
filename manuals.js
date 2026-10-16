'use strict';
// Read-only order index. Documents will be connected through private storage,
// not embedded into order backups or the service-worker cache.
function manualOrderMatches(order,query,includeArchived){
  return (includeArchived||!order.archived)&&[order.name,order.productNr,order.productName,order.line,order.subgroup].join(' ').toLocaleLowerCase('sv').includes(query.trim().toLocaleLowerCase('sv'));
}
function renderManuals(){
  const target=$('manualsOrders');if(!target)return;
  const orders=data.orders.filter(o=>manualOrderMatches(o,$('manualsSearch').value,$('manualsHistory').checked));
  const active=current();orders.sort((a,b)=>Number(b.id===active?.id)-Number(a.id===active?.id)||a.name.localeCompare(b.name,'sv',{numeric:true}));
  $('manualsCount').textContent=orders.length+' ordrar · inga anvisningar upplagda ännu';
  target.innerHTML=orders.length?orders.map(o=>'<article class="manuals-card"><div class="manuals-card-top"><span>'+esc([o.line,o.subgroup].filter(Boolean).join(' / ')||'Ej placerad')+'</span><span class="manuals-state">Saknar dokument</span></div><h3>'+esc(o.productName||o.subgroup||'Order')+'</h3><p>Order <strong>'+esc(o.name)+'</strong>'+(o.productNr?' · Artikel '+esc(o.productNr):'')+'</p><p class="hint">Ingen anvisning kopplad ännu.'+(o.archived?' Arkiverad order.':'')+'</p><button type="button" class="secondary" data-manual-order="'+esc(o.id)+'">Öppna order</button></article>').join(''):'<div class="manuals-empty"><h3>Ingen order matchar</h3><p>Prova ett annat sökord eller visa även arkiverade ordrar.</p></div>';
}
$('manualsSearch').oninput=renderManuals;
$('manualsHistory').onchange=renderManuals;
$('manualsOrders').onclick=event=>{const button=event.target.closest('[data-manual-order]');if(button)selectOrder(button.dataset.manualOrder);};
renderManuals();
