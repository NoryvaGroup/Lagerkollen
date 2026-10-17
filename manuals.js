'use strict';
// Independent private document library; never part of order backups.
let manualCatalog={userId:null,items:[],loaded:false,loading:false,error:'',request:0};
let manualDocument={request:0,url:null};
function manualMatches(m,q){return [m.title,m.description,m.file_name].join(' ').toLocaleLowerCase('sv').includes(q.trim().toLocaleLowerCase('sv'));}
function closeManualDocument(){
 manualDocument.request++;if(manualDocument.url)URL.revokeObjectURL(manualDocument.url);manualDocument.url=null;
 $('manualFrame').removeAttribute('src');$('manualOpenTab').removeAttribute('href');$('manualDownload').removeAttribute('href');
 if($('manualReader').open)$('manualReader').close();
}
function renderManuals(){
 if(!$('manualsOrders'))return;const userId=window.Cloud?.user?.id||null;
 if(userId!==manualCatalog.userId){manualCatalog={userId,items:[],loaded:false,loading:false,error:'',request:manualCatalog.request+1};closeManualDocument();}
 if(!userId){$('manualsTotal').textContent='Privat bibliotek';$('manualsCount').textContent='Logga in för att läsa anvisningarna på mobil och dator.';$('manualsOrders').innerHTML='<div class="manuals-empty"><h3>Dina anvisningar är privata</h3><p>Använd samma Lagerkollen-konto som för dina ordrar.</p><button type="button" class="primary" data-manual-login>Logga in</button></div>';return;}
 if(!manualCatalog.loaded&&!manualCatalog.loading&&!manualCatalog.error&&view==='manuals'){loadManuals();return;}
 $('manualsTotal').textContent=manualCatalog.loaded?manualCatalog.items.length+' dokument':'Dokumentbibliotek';
 if(manualCatalog.loading){$('manualsCount').textContent='Hämtar anvisningar…';$('manualsOrders').innerHTML='<p class="manuals-empty">Läser dokumentbiblioteket…</p>';return;}
 if(manualCatalog.error){$('manualsCount').textContent='Kunde inte hämta anvisningarna.';$('manualsOrders').innerHTML='<div class="manuals-empty"><h3>Biblioteket kunde inte laddas</h3><p>'+esc(manualCatalog.error)+'</p><p>Kontrollera anslutningen och försök igen. Orderdata påverkas inte.</p></div>';return;}
 const items=manualCatalog.items.filter(m=>manualMatches(m,$('manualsSearch').value));
 $('manualsCount').textContent='Visar '+items.length+' av '+manualCatalog.items.length+' anvisningar';
 $('manualsOrders').innerHTML=items.map(m=>'<article class="manuals-card"><div class="manuals-card-top"><span>GEMENSAM ANVISNING</span><span class="manuals-state">PDF · '+Number(m.page_count)+' sidor</span></div><h3>'+esc(m.title)+'</h3><p>'+esc(m.description)+'</p><p class="hint">'+(Number(m.file_bytes)/1000000).toLocaleString('sv-SE',{maximumFractionDigits:1})+' MB · Originalets bilder och sidor</p><button type="button" class="primary" data-manual-open="'+esc(m.id)+'">Läs anvisning</button></article>').join('')||'<div class="manuals-empty"><h3>'+(manualCatalog.items.length?'Ingen anvisning matchar':'Inga anvisningar upplagda ännu')+'</h3><p>'+(manualCatalog.items.length?'Prova att söka på till exempel Cup eller Europa.':'Här visas gemensamma anvisningar när de har lagts in.')+'</p></div>';
}
async function loadManuals(){
 const userId=window.Cloud?.user?.id;if(!userId)return;
 const request=++manualCatalog.request;manualCatalog.userId=userId;manualCatalog.loading=true;manualCatalog.error='';renderManuals();
 try{const items=await Cloud.listManuals();if(request!==manualCatalog.request||window.Cloud?.user?.id!==userId)return;manualCatalog.items=items;manualCatalog.loaded=true;}
 catch(e){if(request!==manualCatalog.request||window.Cloud?.user?.id!==userId)return;manualCatalog.error='Kontrollera din inloggning och internetanslutning.';}
 finally{if(request===manualCatalog.request&&window.Cloud?.user?.id===userId){manualCatalog.loading=false;renderManuals();}}
}
async function openManualDocument(id){
 const userId=window.Cloud?.user?.id,m=manualCatalog.items.find(m=>m.id===id);if(!m||!userId)return;
 closeManualDocument();const request=++manualDocument.request;
 $('manualReaderTitle').textContent=m.title;$('manualReaderMeta').textContent=m.page_count+' sidor · Gemensam anvisning';
 $('manualReaderStatus').textContent='Hämtar PDF…';$('manualFrame').classList.add('hidden');$('manualReaderActions').classList.add('hidden');$('manualReader').showModal();
 try{
  const blob=await Cloud.downloadManual(m.storage_path);if(request!==manualDocument.request||window.Cloud?.user?.id!==userId)return;if(!blob.size)throw Error('Tom fil');
  const url=URL.createObjectURL(new Blob([blob],{type:'application/pdf'}));manualDocument.url=url;
  $('manualFrame').src=url+'#view=FitH';$('manualFrame').title=m.title;$('manualFrame').classList.remove('hidden');
  $('manualOpenTab').href=url;$('manualDownload').href=url;$('manualDownload').download=m.file_name;$('manualReaderActions').classList.remove('hidden');
  $('manualReaderStatus').textContent='Bläddra och zooma med PDF-läsarens verktyg. Om dokumentet inte visas här, välj Öppna i egen flik.';
 }catch(e){if(request===manualDocument.request)$('manualReaderStatus').textContent='Kunde inte öppna PDF:en. Stäng läsaren och försök igen. Kontrollera anslutning och inloggning.';}
}
$('manualsSearch').oninput=renderManuals;
$('manualsReload').onclick=()=>loadManuals();
$('manualsOrders').onclick=e=>{if(e.target.closest('[data-manual-login]')){show('backup');return;}const b=e.target.closest('[data-manual-open]');if(b)openManualDocument(b.dataset.manualOpen);};
$('manualClose').onclick=closeManualDocument;
$('manualReader').addEventListener('close',()=>{if(!$('manualReader').open)closeManualDocument();});
renderManuals();
