const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const tests = [];

function test(name, fn) {
    tests.push({name, fn});
}

function loadSaveStatusDelay() {
    const filePath = path.resolve(__dirname, '../../apps/documenteditor/main/app/util/SaveStatusDelay.js');
    const source = fs.readFileSync(filePath, 'utf8');
    let exportedModule;
    const sandbox = {
        DE: {},
        define: function(deps, factory) {
            exportedModule = factory();
        }
    };

    vm.runInNewContext(source, sandbox, {filename: filePath});
    return exportedModule;
}

test('keeps the saving caption visible for the minimum display window', function() {
    const saveStatusDelay = loadSaveStatusDelay();

    const delay = saveStatusDelay.getChangesSavedDelay({
        startedAt: 1000,
        now: 1250,
        minDisplayDelay: 1200,
        fastCoauthDelay: 500,
        fastCoauth: true,
        usersCount: 2
    });

    assert.strictEqual(delay, 950);
});

test('preserves the fast coauthoring delay after the minimum window has passed', function() {
    const saveStatusDelay = loadSaveStatusDelay();

    const delay = saveStatusDelay.getChangesSavedDelay({
        startedAt: 1000,
        now: 2600,
        minDisplayDelay: 1200,
        fastCoauthDelay: 500,
        fastCoauth: true,
        usersCount: 2
    });

    assert.strictEqual(delay, 500);
});

test('does not add delay when no save start is known outside fast coauthoring', function() {
    const saveStatusDelay = loadSaveStatusDelay();

    const delay = saveStatusDelay.getChangesSavedDelay({
        startedAt: 0,
        now: 2600,
        minDisplayDelay: 1200,
        fastCoauthDelay: 500,
        fastCoauth: false,
        usersCount: 1
    });

    assert.strictEqual(delay, 0);
});

let failures = 0;

tests.forEach(function(entry) {
    try {
        entry.fn();
        console.log('ok - ' + entry.name);
    } catch (error) {
        failures += 1;
        console.error('not ok - ' + entry.name);
        console.error(error && error.stack || error);
    }
});

if (failures > 0) {
    process.exit(1);
}
