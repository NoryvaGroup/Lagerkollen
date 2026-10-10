const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Isolated presentation tests: no real storage, account or network access.
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {value:'', checked:false, innerHTML:'', textContent:'',
    classList:{toggle(){},remove(){}},setAttribute(name,value){this[name]=value;}});
  return nodes.get(id);
}
const document = {getElementById:node,body:node('body'),querySelectorAll:()=>[],querySelector:()=>node('selector')};
const context = vm.createContext({window:{},document,localStorage:{},indexedDB:{},setTimeout,clearTimeout,setInterval,clearInterval,console});
const source = fs.readFileSync('app.js','utf8');
vm.runInContext(source.split('function render(){')[0],context);
vm.runInContext(fs.readFileSync('workbench.js','utf8').replace(/initWorkbench\(\);\s*$/,''),context);
const run = code => vm.runInContext(code,context);
const fixture = {schemaVersion:6,current:'order',orders:[{id:'order',name:'001234',line:'H1',kind:'picklist',articles:[
  {id:'group',nr:'GROUP',description:'Skruvar',isGroup:true},
  {id:'a',nr:'000001',description:'Skruv',location:'T39 A1',note:'Behåll',requiredQty:20,status:'neutral',statusVersion:2},
  {id:'b',nr:'000002',location:'T40',status:'fetched',statusVersion:2},
  {id:'c',nr:'000003',location:'T41',status:'found',blockReason:'Truck behövs',statusVersion:2},
  {id:'d',nr:'000004',location:'T42',status:'notfound',statusVersion:2}
]}],stock:{'000001':{nr:'000001',location:'T39 A1',previousLocations:['T38'],foundCount:5}},groups:[],sections:[]};
run('data='+JSON.stringify(fixture));
const before = run('JSON.stringify(data)');
assert.deepEqual(JSON.parse(run('JSON.stringify(pickingSummary(current()))')),{total:4,fetched:1,remaining:3,missing:1,blocked:1,percent:25});
run("filter='remaining';renderArticles()");
assert.ok(node('articles').innerHTML.includes('000001'));
assert.ok(!node('articles').innerHTML.includes('000002'));
assert.ok(node('articles').innerHTML.includes('000003'));
assert.ok(node('articles').innerHTML.includes('000004'));
assert.ok(!node('articles').innerHTML.includes('article-group'));
node('search').value='TRUCK';run('renderArticles()');
assert.ok(node('articles').innerHTML.includes('000003'));
assert.ok(!node('articles').innerHTML.includes('000001'));
node('search').value='';run("filter='all';sectionFilter='group';renderArticles()");
assert.ok(node('articles').innerHTML.includes('article-group'));
run('workbenchReady=true;renderWorkbench(4)');
assert.equal(node('progressLabel').textContent,'1 av 4 hämtade');
assert.equal(node('progressRemaining').textContent,'3 kvar');
assert.equal(node('exceptionCount').textContent,2);
assert.equal(node('visibleCount').textContent,'Visar 4 av 4 artiklar');
assert.equal(node('orderTools').open,false,'existing populated orders start focused on picking');
assert.equal(run('JSON.stringify(data)'),before,'filters and progress counters leave all original fields untouched');
run("current().articles=[];current().id='new';data.current='new';renderWorkbench(0)");
assert.equal(node('orderTools').open,true,'new empty orders open article entry');
run('data='+before);
run('renderWorkbench(4)');
assert.equal(run('JSON.stringify(data)'),before,'view rendering and filtering cannot change any order or stock field');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('/workbench.js')>html.indexOf('/app.js'));
assert.ok(html.indexOf('/workbench.css')>html.indexOf('/styles.css'));
const worker=fs.readFileSync('sw.js','utf8');
for(const asset of ['/workbench.js','/workbench.css']) assert.ok(worker.includes(asset),'PWA caches new presentation assets');
const css=fs.readFileSync('workbench.css','utf8');
assert.ok(css.includes('@media(min-width:1400px)'));
assert.ok(css.includes('@media(max-width:720px)'));
assert.ok(css.includes('prefers-reduced-motion'));
console.log('Workbench filters, counters, empty-order entry, data preservation and PWA asset tests passed');
