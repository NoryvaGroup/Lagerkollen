const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run only the pure data helpers; no browser, credentials or remote project needed.
const source = fs.readFileSync('app.js', 'utf8').split('function render(){')[0];
const context = vm.createContext({window: {}, document: {}, localStorage: {}, indexedDB: {}, setTimeout, clearTimeout, setInterval, clearInterval, console});
vm.runInContext(source, context);
const sanitize = value => vm.runInContext(`sanitize(${JSON.stringify(value)})`, context);
const merge = (remote, local) => vm.runInContext(`mergeData(${JSON.stringify(remote)},${JSON.stringify(local)})`, context);

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
console.log('Data migration and merge tests passed');
