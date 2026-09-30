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
assert.equal(results({name:'007141',articles:[{nr:'00123',status:'found',location:'A1',note:'Kontrollera\nigen'},{nr:'S4050142',status:'notfound',location:'',note:'=1+1'}]}),"Order\tArtikelnummer\tStatus\tLagerplats\tAnteckning\n'007141\t'00123\tHittad\tA1\tKontrollera igen\n'007141\tS4050142\tEj hittad\t\t'=1+1",'results paste into spreadsheet without losing leading zeroes or running notes as formulas');
console.log('Data migration and merge tests passed');
