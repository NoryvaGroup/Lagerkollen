const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run only the pure data helpers; no browser, credentials or remote project needed.
const source = fs.readFileSync('app.js', 'utf8').split('function render(){')[0];
const context = vm.createContext({window: {}, document: {}, localStorage: {}, indexedDB: {}, setTimeout, clearTimeout, setInterval, clearInterval, console});
vm.runInContext(source, context);
const sanitize = value => vm.runInContext(`sanitize(${JSON.stringify(value)})`, context);
const merge = (remote, local) => vm.runInContext(`mergeData(${JSON.stringify(remote)},${JSON.stringify(local)})`, context);
const results = order => vm.runInContext(`formatOrderResults(${JSON.stringify(order)})`, context);

const oldBackup = {orders:[{id:'o1',name:'Test',created:100,articles:[{id:'a1',nr:'ABC',status:'found',location:'A1',updated:100}]}],stock:{ABC:{nr:'ABC',location:'A1'}},current:'o1'};
assert.equal(sanitize(oldBackup).orders[0].articles[0].nr, 'ABC', 'old backups still load');
assert.equal(sanitize(oldBackup).orders[0].deletedArticles.a1, undefined);

const remote = structuredClone(oldBackup);
const local = structuredClone(oldBackup);
local.orders[0].articles = [];
local.orders[0].deletedArticles = {a1: 200};
local.orders[0].updated = 200;
assert.equal(merge(remote, local).orders[0].articles.length, 0, 'local deletion must survive merge');
assert.equal(merge(local, remote).orders[0].articles.length, 0, 'remote deletion must survive merge');

remote.orders[0].articles[0].updated = 300;
assert.equal(merge(remote, local).orders[0].articles.length, 1, 'later article edit wins over earlier deletion');

const other = structuredClone(oldBackup);
other.orders[0].articles.push({id:'a2',nr:'XYZ',status:'missing',updated:250});
assert.equal(merge(other, local).orders[0].articles.map(a=>a.nr).join(','), 'XYZ', 'unrelated articles remain');
vm.runInContext(`data=${JSON.stringify(oldBackup)}`, context);
const emptyRow = {payload:{orders:[],stock:{},current:null}};
const shouldSeed = (row, cp, userId) => vm.runInContext(`shouldSeedCloud(${JSON.stringify(row)},${JSON.stringify(cp)},${JSON.stringify(userId)})`, context);
assert.equal(shouldSeed(emptyRow, null, 'u1'), true, 'old local orders migrate into a fresh cloud account');
assert.equal(shouldSeed(emptyRow, {userId:'u2'}, 'u1'), false, 'data cached for another account is not silently uploaded');
assert.equal(shouldSeed({payload:oldBackup}, null, 'u1'), false, 'existing cloud data requires a conflict choice');
const exported = results({name:'007141',articles:[{nr:'00123',description:'Kontakt',status:'found',location:'A1',note:'Kontrollera\nigen'},{nr:'S4050142',status:'notfound',location:'',note:'=1+1'},{nr:'GROUP',isGroup:true}]}).split('\n').map(line=>line.split('\t'));
assert.equal(exported.length,3,'group headers are not exported as material');
assert.equal(exported[1][0],"'007141");assert.equal(exported[1][1],"'00123");assert.equal(exported[1][2],'Kontakt');assert.equal(exported[1][10],'Kontrollera igen');assert.equal(exported[2][10],"'=1+1",'notes cannot become spreadsheet formulas');
const enriched = structuredClone(oldBackup);Object.assign(enriched.orders[0],{kind:'picklist',productNr:'000001',productionQty:5,printedAt:'2026-10-02'});Object.assign(enriched.orders[0].articles[0],{description:'Test component',requiredQty:2.5,perUnitQty:0.5,availableQty:0,shortageQty:2.5,unit:'ST',isGroup:false});
const roundtrip = sanitize(JSON.parse(JSON.stringify(sanitize(enriched))));
assert.equal(roundtrip.schemaVersion,3);assert.equal(roundtrip.orders[0].articles[0].description,'Test component');assert.equal(roundtrip.orders[0].articles[0].requiredQty,2.5);assert.equal(roundtrip.orders[0].articles[0].availableQty,0);assert.equal(roundtrip.orders[0].productNr,'000001');
assert.equal(sanitize(oldBackup).orders[0].articles[0].requiredQty,null,'an absent quantity must not become zero');
assert.throws(()=>sanitize({...oldBackup,schemaVersion:4}),/nyare version/,'future backups cannot be silently downgraded');
const legacyEdit=structuredClone(oldBackup);legacyEdit.orders[0].articles[0].updated=500;legacyEdit.orders[0].articles[0].location='T50';legacyEdit.orders[0].updated=500;
const mixed=merge(enriched,legacyEdit);assert.equal(mixed.orders[0].articles[0].description,'Test component','an edit from an old local backup must not remove article metadata');assert.equal(mixed.orders[0].articles[0].location,'T50');assert.equal(mixed.orders[0].articles[0].requiredQty,2.5);assert.equal(mixed.orders[0].productNr,'000001');
vm.runInContext(`data=blank();rememberArticle({nr:'ABC',description:'Test part',location:'T40',note:'',status:'missing'},{name:'O1'},true);`, context);
let remembered = vm.runInContext('data.stock.ABC',context);
assert.equal(remembered.location,'T40','saving a place does not require Found status');assert.equal(remembered.description,'Test part');assert.equal(remembered.foundCount,0);assert.equal(remembered.lastSeen,0,'a Jeeves location is not a physical sighting');
vm.runInContext(`rememberArticle({nr:'ABC',description:'Test part',location:'T42',note:'',status:'notfound'},{name:'O2'},true);`,context);
remembered=vm.runInContext('data.stock.ABC',context);assert.equal(remembered.location,'T42');assert.equal(Array.from(remembered.previousLocations).join(','),'T40');
vm.runInContext(`rememberFound({nr:'ABC',description:'Test part',location:'T42',note:''},{name:'O2'},true);`,context);assert.equal(vm.runInContext('data.stock.ABC.foundCount',context),1);
const pendingPicklist=structuredClone(enriched);pendingPicklist.orders[0].articles[0].status='missing';
const defaultFound=sanitize(pendingPicklist);assert.equal(defaultFound.orders[0].articles[0].status,'found','whole picklists default to Found');assert.equal(defaultFound.stock.ABC.lastSeen,0,'default Found does not invent a physical sighting');
pendingPicklist.orders[0].articles[0].status='notfound';assert.equal(sanitize(pendingPicklist).orders[0].articles[0].status,'notfound','explicit Not found survives reload');
const shortage=structuredClone(oldBackup);shortage.orders[0].articles[0].status='missing';assert.equal(sanitize(shortage).orders[0].articles[0].status,'missing','shortage orders retain Missing');
const stalePicklist=structuredClone(pendingPicklist);stalePicklist.orders[0].articles[0].status='missing';stalePicklist.orders[0].articles[0].updated=900;assert.equal(merge(enriched,stalePicklist).orders[0].articles[0].status,'found','old pending state merges into new picklist workflow');
const picklistRow=vm.runInContext(`renderArticle(${JSON.stringify(defaultFound.orders[0].articles[0])},${JSON.stringify(defaultFound.orders[0])})`,context);assert.ok(picklistRow.includes('Inte hittad'));assert.ok(!picklistRow.includes('data-status="missing"'));assert.ok(picklistRow.includes('data-status="found" aria-pressed="true"'));
const summaryOrder={name:'193657',articles:[{nr:'5509053',description:'Timer <test>',status:'notfound',requiredQty:5,unit:'ST'},{nr:'FOUND',status:'found'},{nr:'HEADER',isGroup:true,status:'notfound'},{nr:'PENDING',status:'missing'}]};
const overview=vm.runInContext(`missingOverview(${JSON.stringify(summaryOrder)})`,context);assert.ok(overview.includes('5509053'));assert.ok(overview.includes('Timer &lt;test&gt;'));assert.ok(!overview.includes('FOUND'));assert.ok(!overview.includes('HEADER'));assert.ok(!overview.includes('PENDING'));assert.ok(overview.includes('>Saknas '));assert.ok(overview.includes('5 ST'));assert.ok(overview.includes('<table'));
summaryOrder.articles[0].status='found';const cleared=vm.runInContext(`missingOverview(${JSON.stringify(summaryOrder)})`,context);assert.ok(cleared.includes('Inga artiklar'));assert.ok(!cleared.includes('<table'));
console.log('Data migration and merge tests passed');
