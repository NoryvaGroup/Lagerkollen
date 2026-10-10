'use strict';
// Presentation only. Never writes orders, stock, cloud state or backup payloads.
const foldedLines = new Map();
let workbenchReady = false;
let workbenchOrderId = null;
let expandedOrderId = null;
function pickingSummary(order) {
  const items = (order?.articles || []).filter(a => !a.isGroup);
  const fetched = items.filter(a => a.status === 'fetched').length;
  return { total: items.length, fetched, remaining: items.length - fetched,
    missing: items.filter(a => a.status === 'notfound').length,
    blocked: items.filter(a => a.status === 'found').length,
    percent: items.length ? Math.round(fetched / items.length * 100) : 0 };
}
function workbenchIcon(name) {
  const paths = {
    orders:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    order:'<path d="m4 7 2 2 3-4m3 2h8M4 14l2 2 3-4m3 2h8M12 20h8"/>',
    stock:'<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v9l9 5 9-5V8M12 13v9M7 5l9 5"/>',
    edit:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    backup:'<path d="M7 17H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10h-1M12 12v9m-3-3 3 3 3-3"/>'
  };
  return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||paths.orders)+'</svg>';
}
function renderWorkbenchOrders() {
  if (!workbenchReady) return;
  const query = norm($('orderSearch').value);
  const active = current();
  let visible = 0;
  document.querySelectorAll('#orders .line-section').forEach((section,index) => {
    const title = section.querySelector('.line-section-head');
    const content = section.querySelector('.line-content');
    if (title && content) {
      const name = section.getAttribute('aria-label');
      if (!foldedLines.has(name)) foldedLines.set(name, !!active && active.line !== name);
      if (active?.id !== expandedOrderId && active?.line === name) foldedLines.set(name,false);
      const button = document.createElement('button');
      button.type = 'button';button.className = 'line-fold';
      content.id = 'line-content-'+index;
      const closed = !query && foldedLines.get(name);
      button.setAttribute('aria-expanded',String(!closed));
      button.setAttribute('aria-controls',content.id);
      button.setAttribute('aria-label',(closed?'Visa ':'Dölj ')+'ordrar i '+name);
      button.textContent = closed ? '›' : '⌄';
      content.classList.toggle('hidden',closed);
      button.onclick = () => {foldedLines.set(name,!foldedLines.get(name));
        const hide=foldedLines.get(name);content.classList.toggle('hidden',hide);
        button.setAttribute('aria-expanded',String(!hide));button.textContent=hide?'›':'⌄';
        button.setAttribute('aria-label',(hide?'Visa ':'Dölj ')+'ordrar i '+name);};
      title.querySelector('.line-fold')?.remove();title.prepend(button);
    }
    let hits = 0;
    section.querySelectorAll('.order-row').forEach(row => {
      const order = data.orders.find(o=>o.id===row.dataset.order);
      const match = !query || norm([order?.name,order?.productName,order?.productNr,order?.line,order?.subgroup].join(' ')).includes(query);
      row.classList.toggle('hidden',!match);if(match){hits++;visible++;}
    });
    section.querySelectorAll('.subgroup-block').forEach(group=>group.classList.toggle('hidden',!!query&&!group.querySelector('.order-row:not(.hidden)')));
    section.classList.toggle('hidden',!!query&&!hits);
  });
  $('orderSearchEmpty').classList.toggle('hidden',!query||visible>0);
  $('workspaceCount').textContent = data.orders.filter(o=>!o.archived).length+' aktiva ordrar';
  expandedOrderId = active?.id || null;
}
function renderWorkbench(shown) {
  if (!workbenchReady || !current()) return;
  const order=current(), summary=pickingSummary(sectionOrder(order));
  if (order.id !== workbenchOrderId) {
    $('orderTools').open = !order.articles.some(a=>!a.isGroup);
    workbenchOrderId = order.id;
  }
  $('progressLabel').textContent=summary.total?`${summary.fetched} av ${summary.total} hämtade`:'Ingen plocklista inlagd ännu';
  $('progressRemaining').textContent=summary.total?`${summary.remaining} kvar`:'Lägg till artiklar i Orderverktyg';
  $('pickProgress').value=summary.fetched;$('pickProgress').max=Math.max(1,summary.total);
  $('pickProgress').setAttribute('aria-label',`${summary.fetched} av ${summary.total} artiklar hämtade`);
  $('exceptionCount').textContent=summary.missing+summary.blocked;
  $('exceptionText').textContent=summary.missing||summary.blocked?`${summary.missing} saknas · ${summary.blocked} hittade med hinder`:'Inga artiklar markerade som saknade eller hindrade';
  $('exceptionPanel').classList.toggle('has-exceptions',summary.missing+summary.blocked>0);
  const totalShown=shown??document.querySelectorAll('#articles .article').length;
  $('visibleCount').textContent=`Visar ${totalShown} av ${summary.total} artiklar`;
  $('resetPickingFilters').classList.toggle('hidden',filter==='all'&&!$('search').value&&!sectionFilter&&sortBy==='default');
  $('remainingFilter').setAttribute('aria-pressed',String(filter==='remaining'));
  document.querySelectorAll('.stat-shortcut').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pickFilter===filter)));
  $('placementDetails').classList.toggle('hidden',order.kind==='shortage');
  document.body.classList.toggle('compact-picking',$('compactPicking').checked);
}
function initWorkbench() {
  const main=$('main');main.tabIndex=-1;
  const skip=document.createElement('a');skip.href='#main';skip.className='skip-link';skip.textContent='Hoppa till arbetsytan';document.body.prepend(skip);
  document.querySelectorAll('.desktop-nav button,.mobile-nav button').forEach(button=>{
    const label=button.querySelector('span')?.textContent||'';
    button.innerHTML=workbenchIcon(button.dataset.view)+(label?'<span>'+esc(label)+'</span>':'');
  });
  document.querySelector('.brandmark').innerHTML=workbenchIcon('stock');
  document.querySelector('.nav-hint').id='workspaceCount';
  const sidebarSearch=document.createElement('div');sidebarSearch.className='sidebar-search';
  sidebarSearch.innerHTML='<label class="sr-only" for="orderSearch">Sök order, produkt eller produktionslinje</label><input id="orderSearch" type="search" placeholder="Sök order eller aggregat…" autocomplete="off"><p id="orderSearchEmpty" class="hidden" role="status">Ingen order matchar sökningen.</p>';
  $('sidebar').insertBefore(sidebarSearch,document.querySelector('.sidebar-scroll'));
  $('orderSearch').oninput=renderWorkbenchOrders;
  $('newOrderToggle').textContent='+ Ny order';

  const tools=document.createElement('details');tools.id='orderTools';tools.className='order-tools';
  tools.innerHTML='<summary><span>Orderverktyg</span><small>Lägg till · placering · export</small></summary><div class="order-tools-body"></div>';
  const body=tools.lastElementChild;
  const placement=document.createElement('div');placement.id='placementDetails';placement.append($('placementForm'));
  body.append(document.querySelector('.entry'),placement,document.querySelector('.result-action'));
  const management=document.createElement('div');management.className='order-management';
  management.append($('archive'),$('deleteOrder'));body.append(management);
  document.querySelector('#activeWrap .pagehead').after(tools);
  const jump=document.createElement('button');jump.type='button';jump.className='primary small';jump.textContent='Till artiklar ↓';
  jump.onclick=()=>document.querySelector('.picking-toolbar').scrollIntoView({block:'start'});
  document.querySelector('.pageactions').prepend(jump);
  $('repeatOrder').className='secondary small';

  const progress=document.createElement('div');progress.className='picking-progress';
  progress.innerHTML='<div><strong id="progressLabel"></strong><span id="progressRemaining"></span></div><progress id="pickProgress" value="0" max="1"></progress>';
  const stats=document.querySelector('.stats');stats.before(progress);
  const statFilters=['all','neutral','found','notfound','fetched'];
  [...stats.children].forEach((tile,index)=>{const button=document.createElement('button');button.className='stat-shortcut';button.type='button';button.dataset.pickFilter=statFilters[index];
    while(tile.firstChild)button.append(tile.firstChild);tile.append(button);
    button.onclick=()=>{filter=button.dataset.pickFilter;renderArticles();};});

  const exceptions=document.createElement('details');exceptions.id='exceptionPanel';exceptions.className='exception-panel';
  exceptions.innerHTML='<summary><span>Att följa upp <b id="exceptionCount">0</b></span><small id="exceptionText"></small></summary>';
  $('missingOverview').before(exceptions);exceptions.append($('missingOverview'));
  const toolbar=document.createElement('div');toolbar.className='picking-toolbar';
  const listbar=document.querySelector('.listbar');listbar.before(toolbar);
  toolbar.append(document.querySelector('.section-picker'),listbar);
  const remaining=document.createElement('button');remaining.id='remainingFilter';remaining.type='button';remaining.dataset.filter='remaining';remaining.textContent='Kvar att plocka';
  document.querySelector('.filters').insertBefore(remaining,document.querySelector('.filters').children[1]);
  remaining.onclick=()=>{filter='remaining';renderArticles();};
  const listMeta=document.createElement('div');listMeta.className='list-meta';
  listMeta.innerHTML='<span id="visibleCount" role="status"></span><button type="button" class="textbtn hidden" id="resetPickingFilters">Återställ filter</button><label class="density-toggle"><input id="compactPicking" type="checkbox"> Kompakt vy</label>';
  toolbar.after(listMeta);
  $('resetPickingFilters').onclick=()=>{filter='all';sectionFilter='';sortBy='default';$('sort').value='default';$('search').value='';renderOrder();};
  $('compactPicking').onchange=()=>renderWorkbench();
  // Focus a field inside the collapsed tools without adding a second key handler.
  $('quickInput').addEventListener('focus',()=>{tools.open=true;});
  document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='n'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.matches('input,textarea,select,[contenteditable]')&&!document.querySelector('dialog[open]'))tools.open=true;},true);
  workbenchReady=true;renderWorkbenchOrders();renderWorkbench();
}
initWorkbench();
