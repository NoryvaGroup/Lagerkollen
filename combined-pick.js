'use strict';
// Grouped picking. Explicit completion updates only the two selected orders.
const comparedOrders = new Map();
let samplockMode = false;
function isHinkArticle(article){return /\bhink(?:artikel|artiklar)?\b/i.test([article.note,data.stock[norm(article.nr)]?.note].filter(Boolean).join(' '));}
function markCombinedFetched(firstId,secondId,nr,unit){
  const orders=[firstId,secondId].map(id=>data.orders.find(o=>o.id===id&&!o.archived));
  if(firstId===secondId||orders.some(o=>!o))return false;
  const matches=orders.map(o=>o.articles.filter(a=>!a.isGroup&&norm(a.nr)===norm(nr)&&norm(a.unit||'ST')===norm(unit||'ST')));
  if(matches.some(list=>!list.length))return false;
  let changed=false,sighting=null;const now=Date.now();
  orders.forEach((order,index)=>{for(const article of matches[index])if(article.status!=='fetched'){
    if(!sighting&&!['found','fetched'].includes(article.status))sighting={article,order};
    article.status='fetched';article.statusVersion=2;article.updated=now;order.updated=now;changed=true;
  }});
  if(changed){if(sighting)rememberFound(sighting.article,sighting.order,true);persist();notice('Hämtad till båda ordrarna – alla rader för '+nr);}
  return changed;
}
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
      if(!rows.has(key))rows.set(key,{nr:article.nr,description:article.description||'',unit:article.unit||'ST',amounts:[0,0],unknown:[false,false],pendingAmounts:[0,0],pendingUnknown:[false,false],present:[false,false],locations:[],hink:false,statuses:[[],[]],notes:[]});
      const row=rows.get(key);row.present[index]=true;
      row.hink ||= isHinkArticle(article);row.statuses[index].push(article.status);
      for(const note of [article.note,article.blockReason,data.stock[norm(article.nr)]?.note])if(note&&!row.notes.includes(note))row.notes.push(note);
      if(article.requiredQty==null)row.unknown[index]=true;
      else row.amounts[index]+=article.requiredQty;
      if(article.status!=='fetched'){if(article.requiredQty==null)row.pendingUnknown[index]=true;else row.pendingAmounts[index]+=article.requiredQty;}
      const location=article.location||data.stock[norm(article.nr)]?.location||'';
      if(location&&!row.locations.includes(location))row.locations.push(location);
    }
  });
  return [...rows.values()].map(row=>({...row,shared:row.present.every(Boolean),total:row.unknown.some(Boolean)?null:row.amounts[0]+row.amounts[1],pendingTotal:row.pendingUnknown.some(Boolean)?null:row.pendingAmounts[0]+row.pendingAmounts[1]}));
}
function combinedAllocationMarkup(row,firstName,secondName,section){
  const amount=(value,unknown=false)=>unknown||value==null?'Okänt':quantity(value)+' '+esc(row.unit);
  return '<div class="shared-pick-total">Totalbehov båda: <strong>'+amount(row.total)+'</strong></div>'+
    '<div class="shared-pick-orders"><span><small>Order '+esc(firstName)+'</small><strong>'+amount(row.amounts[0],row.unknown[0])+'</strong></span><span><small>Order '+esc(secondName)+'</small><strong>'+amount(row.amounts[1],row.unknown[1])+'</strong></span></div>'+
    '<small class="shared-pick-help">Summerat över hela varje order. Samma total visas på upprepade artikelrader.</small>'+
    (section?'<small class="shared-pick-section">Denna sektion: '+esc(firstName)+' '+amount(section.amounts[0],section.unknown[0])+' · '+esc(secondName)+' '+amount(section.amounts[1],section.unknown[1])+'</small>':'');
}
function samplockRows(rows,query='',filterBy='all',sort='location'){
  const q=norm(query);
  return rows.filter(row=>norm([row.nr,row.description,...row.locations,...row.notes,row.hink?'Hink':''].join(' ')).includes(q)&&
    (filterBy==='all'||filterBy==='hink'&&row.hink||filterBy==='shared'&&row.shared||filterBy==='remaining'&&row.statuses.some(list=>list.some(status=>status!=='fetched'))))
    .sort((a,b)=>{if(sort==='number')return a.nr.localeCompare(b.nr,'sv',{numeric:true});
      const left=a.locations[0]||'',right=b.locations[0]||'';
      return !left&&!right?a.nr.localeCompare(b.nr,'sv',{numeric:true}):!left?1:!right?-1:left.localeCompare(right,'sv',{numeric:true})||a.nr.localeCompare(b.nr,'sv',{numeric:true});});
}
function samplockCard(row,first,second){
  const amount=(value,unknown)=>unknown||value==null?'Okänt':quantity(value)+' '+esc(row.unit);
  const allocations=[first,second].map((order,index)=>{
    if(!row.present[index])return '<div class="sam-allocation absent"><span>Order '+esc(order.name)+'</span><strong>Ingår inte</strong></div>';
    const statuses=row.statuses[index],fetched=statuses.filter(s=>s==='fetched').length,missing=statuses.filter(s=>s==='notfound').length,blocked=statuses.filter(s=>s==='found').length;
    return '<div class="sam-allocation"><span>Order '+esc(order.name)+'</span><strong>'+amount(row.amounts[index],row.unknown[index])+'</strong><small>'+ (fetched===statuses.length?'✓ Hämtad':'Kvar: '+amount(row.pendingAmounts[index],row.pendingUnknown[index])+' · '+fetched+' av '+statuses.length+' rader hämtade')+(missing?' · '+missing+' inte hittade':'')+(blocked?' · '+blocked+' hittade, ej hämtade':'')+'</small><button type="button" class="secondary small" data-sam-order="'+esc(order.id)+'" data-sam-nr="'+esc(row.nr)+'">Öppna artikel</button></div>';
  }).join('');
  const sections=combinedPickSectionRows(first,second,row.nr,row.unit);
  return '<article class="sam-card '+(row.shared?'shared':'')+'"><div class="sam-identity"><strong>'+esc(row.nr)+'</strong><span>'+esc(row.description)+'</span><div class="sam-tags">'+(row.shared?'<span class="joint-tag">Gemensam</span>':'<span class="joint-tag unique">En order</span>')+(row.hink?'<span class="hink-badge">Hink</span>':'')+'</div></div><div class="sam-location"><span>Lagerplats</span><strong>'+esc(row.locations.length?row.locations.join(' / '):'Okänd plats')+'</strong>'+(row.locations.length>1?'<small>Flera platser sparade – kontrollera vilken som gäller.</small>':'')+'</div><div class="sam-total"><span>Totalbehov</span><strong>'+amount(row.total,row.total==null)+'</strong><small>Kvar enligt plockstatus:<br><b>'+amount(row.pendingTotal,row.pendingTotal==null)+'</b></small></div><div class="sam-allocations">'+allocations+'</div>'+
    (row.shared?'<button type="button" class="primary sam-fetch" data-sam-fetch="'+esc(row.nr)+'" data-sam-unit="'+esc(row.unit)+'" data-sam-first="'+esc(first.id)+'" data-sam-second="'+esc(second.id)+'"'+(row.statuses.every(list=>list.every(status=>status==='fetched'))?' disabled':'')+'>'+ (row.statuses.every(list=>list.every(status=>status==='fetched'))?'✓ Hämtat till båda':'✓ Hämtat till båda · alla sektioner')+'</button>':'')+
    (row.hink?'<p class="sam-hink">Hinkartikel – plockas via sidan för hinkartiklar.</p>':'')+
    (row.notes.length?'<details class="sam-sections"><summary>Anteckningar och anmärkningar</summary>'+row.notes.map(note=>'<p>'+esc(note)+'</p>').join('')+'</details>':'')+
    (sections.length>1?'<details class="sam-sections"><summary>Fördelning per sektion</summary>'+sections.map(s=>'<p>'+esc(s.name)+'<br>'+esc(first.name)+': '+amount(s.amounts[0],s.unknown[0])+' · '+esc(second.name)+': '+amount(s.amounts[1],s.unknown[1])+'</p>').join('')+'</details>':'')+'</article>';
}
function renderCombinedPick(){
  const order=current(),panel=$('combinedPick');if(!panel)return;
  if(!order){samplockMode=false;document.body.classList.remove('samplock-active');return;}
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
  if(!other)samplockMode=false;
  $('samModeToggle').disabled=!other;$('samModeToggle').textContent=samplockMode?'Till orderrader':'Öppna samplock';
  $('samModeToggle').setAttribute('aria-pressed',String(samplockMode));
  document.body.classList.toggle('samplock-active',samplockMode);
  $('samToolbar').classList.toggle('hidden',!samplockMode);
  const shown=other?samplockRows(rows,$('samSearch').value,$('samFilter').value,$('samSort').value):[];
  $('samMeta').textContent=other?'Visar '+shown.length+' av '+rows.length+' artiklar · '+rows.filter(r=>r.hink).length+' hinkartiklar · Order '+order.name+' + '+other.name:'';
  $('samMeta').classList.toggle('hidden',!samplockMode);
  $('combinedResults').innerHTML=samplockMode?'<p class="joint-help">En rad per artikelnummer och enhet. Mängderna gäller hela båda ordrarna, oavsett orderns sektionsfilter. Kontrollera VBA1 innan du hämtar: tomt saldo är okänt, inte noll. Öppna respektive orderartikel för att markera plockstatus.</p><div class="sam-list">'+(shown.map(row=>samplockCard(row,order,other)).join('')||'<p class="empty">Inga artiklar matchar. Byt filter eller sökord.</p>')+'</div>': '<p class="joint-help">'+(other?'Öppna samplock för en gemensam plocklista med totalbehov och fördelning till varje order.':'Välj en annan order för att börja samplocka.')+'</p>';
  document.querySelectorAll('#articles .article').forEach(element=>{
    element.querySelector('.shared-pick-badge')?.remove();
    element.querySelector('.hink-badge')?.remove();
    const article=order.articles.find(a=>a.id===element.dataset.id);
    if(article&&isHinkArticle(article)){const badge=document.createElement('span');badge.className='hink-badge';badge.textContent='Hink';element.querySelector('.identity').append(badge);}
    const row=article&&shared.find(r=>norm(r.nr)===norm(article.nr)&&norm(r.unit)===norm(article.unit||'ST'));
    element.classList.toggle('shared-pick',!!row);
    if(row){
      const key=combinedPickSectionMap(order).get(article.id)?.key;
      const section=combinedPickSectionRows(order,other,article.nr,article.unit).find(s=>s.key===key);
      const badge=document.createElement('div');badge.className='shared-pick-badge';
      badge.innerHTML=combinedAllocationMarkup(row,order.name,other.name,section);
      element.querySelector('.identity').append(badge);
    }
  });
}
function initCombinedPick(){
  const panel=document.createElement('details');panel.id='combinedPick';panel.className='combined-pick';panel.open=true;
  panel.innerHTML='<summary>Samplock <span id="combinedCount"></span></summary><div class="joint-body"><div class="sam-pair"><div><label for="compareOrder">Plocka aktiv order tillsammans med</label><select id="compareOrder"></select></div><button type="button" id="samModeToggle" class="primary" aria-pressed="false">Öppna samplock</button></div><div id="samToolbar" class="sam-toolbar hidden"><label class="sr-only" for="samSearch">Sök i samplock</label><input id="samSearch" type="search" placeholder="Sök artikel, plats eller anteckning"><label class="sr-only" for="samFilter">Visa artiklar</label><select id="samFilter"><option value="all">Alla artiklar</option><option value="hink">Hinkartiklar</option><option value="shared">Gemensamma artiklar</option><option value="remaining">Kvar att plocka</option></select><label class="sr-only" for="samSort">Sortera samplock</label><select id="samSort"><option value="location">Plockrunda: lagerplats</option><option value="number">Artikelnummer</option></select></div><p id="samMeta" class="hidden" role="status"></p><div id="combinedResults"></div></div>';
  document.querySelector('.picking-progress').after(panel);
  $('samFilter').value='remaining';
  $('compareOrder').onchange=()=>{if(current()){comparedOrders.set(current().id,$('compareOrder').value);renderCombinedPick();}};
  $('samModeToggle').onclick=()=>{samplockMode=!samplockMode;panel.open=true;renderCombinedPick();if(samplockMode)$('samSearch').focus();};
  $('samSearch').oninput=renderCombinedPick;$('samFilter').onchange=renderCombinedPick;$('samSort').onchange=renderCombinedPick;
  panel.addEventListener('toggle',()=>{if(!panel.open&&samplockMode){samplockMode=false;renderCombinedPick();}});
  $('combinedResults').addEventListener('click',event=>{
    const fetched=event.target.closest('[data-sam-fetch]');
    if(fetched){if(current()?.id!==fetched.dataset.samFirst||comparedOrders.get(current().id)!==fetched.dataset.samSecond){notice('Orderparet ändrades. Kontrollera plocklistan igen.');return;}
      markCombinedFetched(fetched.dataset.samFirst,fetched.dataset.samSecond,fetched.dataset.samFetch,fetched.dataset.samUnit);return;}
    const button=event.target.closest('[data-sam-order]');if(!button)return;samplockMode=false;selectOrder(button.dataset.samOrder);$('search').value=button.dataset.samNr;renderArticles();$('articles').scrollIntoView({block:'start'});
  });
  const hinkButton=document.createElement('button');hinkButton.type='button';hinkButton.id='hinkFilter';hinkButton.dataset.filter='hink';hinkButton.textContent='Hink';hinkButton.setAttribute('aria-pressed','false');
  document.querySelector('.filters').append(hinkButton);hinkButton.onclick=()=>{filter='hink';renderArticles();};
  document.addEventListener('keydown',event=>{if(samplockMode&&event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.matches('input,textarea,select,[contenteditable]')){event.preventDefault();event.stopPropagation();show('order');panel.open=true;$('samSearch').focus();}},true);
  renderCombinedPick();
}
initCombinedPick();
