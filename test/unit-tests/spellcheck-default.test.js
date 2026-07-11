'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    createAmdHarness
} = require('./helpers/load-amd-source');

const WEB_APPS_ROOT = path.resolve(__dirname, '../..');
const MODULE_ID = 'documenteditor/main/app/util/SpellcheckSettings';
const MODULE_FILE = 'apps/documenteditor/main/app/util/SpellcheckSettings.js';

function readSource(relativePath) {
    return fs.readFileSync(path.join(WEB_APPS_ROOT, relativePath), 'utf8');
}

function loadSettings() {
    const filename = path.join(WEB_APPS_ROOT, MODULE_FILE);
    assert.equal(fs.existsSync(filename), true, 'SpellcheckSettings utility missing');

    const DE = {};
    const harness = createAmdHarness({globals: {DE: DE}});
    const settings = harness.load(MODULE_FILE, MODULE_ID);

    assert.equal(DE.Utils.SpellcheckSettings, settings);
    return settings;
}

test('document spellcheck defaults off without an explicit setting', function() {
    const settings = loadSettings();

    assert.equal(settings.resolveInitialValue(undefined, undefined), false);
    assert.equal(settings.resolveInitialValue(undefined, {}), false);
});

test('explicit feature and legacy settings override the off default', function() {
    const settings = loadSettings();

    assert.equal(settings.resolveInitialValue(true, {}), true);
    assert.equal(settings.resolveInitialValue(false, {spellcheck: true}), false);
    assert.equal(settings.resolveInitialValue(undefined, {spellcheck: true}), true);
    assert.equal(settings.resolveInitialValue(undefined, {spellcheck: false}), false);
});

test('spellcheck change policy is resolved from explicit features in every edition',
function() {
    const settings = loadSettings();
    const calls = [];
    const featuresManager = {
        canChange: function(name, force) {
            calls.push([name, force]);
            return force !== true;
        }
    };

    assert.equal(settings.canChange(featuresManager), false);
    assert.deepEqual(calls, [['spellcheck', true]]);
});

test('first use persists off while an existing user choice is preserved',
function() {
    const settings = loadSettings();
    const values = new Map();
    const storage = {
        getBool: function(key, defaultValue) {
            return values.has(key) ? values.get(key) : defaultValue;
        },
        setItem: function(key, value) {
            values.set(key, value === 1);
        }
    };

    assert.equal(settings.resolveUserPreference(storage, 'spellcheck', false, true), false);
    assert.equal(values.get('spellcheck'), false);

    values.set('spellcheck', true);
    assert.equal(settings.resolveUserPreference(storage, 'spellcheck', false, true), true);
    assert.equal(values.get('spellcheck'), true);
});

test('locked feature mode bypasses and does not overwrite user storage',
function() {
    const settings = loadSettings();
    const calls = [];
    const storage = {
        getBool: function() {
            calls.push('get');
            return true;
        },
        setItem: function() {
            calls.push('set');
        }
    };

    assert.equal(settings.resolveUserPreference(storage, 'spellcheck', false, false), false);
    assert.deepEqual(calls, []);
});

test('document startup preserves stored user choice and manual persistence',
function() {
    const mainSource = readSource(
        'apps/documenteditor/main/app/controller/Main.js'
    );
    const reviewSource = readSource(
        'apps/common/main/lib/controller/ReviewChanges.js'
    );

    assert.match(mainSource, new RegExp(MODULE_ID));
    assert.match(
        mainSource,
        /SpellcheckSettings\.resolveInitialValue\([\s\S]*?customization\)/
    );
    assert.match(
        mainSource,
        /SpellcheckSettings\.resolveUserPreference\([\s\S]*?canChangeSpellcheck\s*\)/
    );
    assert.match(
        mainSource,
        /appOptions\.canChangeSpellcheck\s*=\s*SpellcheckSettings\.canChange\(/
    );
    assert.match(
        reviewSource,
        /localStorage\.setItem\(this\.appPrefix \+ "settings-spellcheck", state \? 1 : 0\)/
    );
    assert.match(reviewSource, /this\.api\.asc_setSpellCheck\(state\)/);
    assert.match(reviewSource, /this\.canChangeSpellcheck\(\) && !suspend/);
});

test('document spellcheck controls share the forced feature change policy',
function() {
    const mainSource = readSource(
        'apps/documenteditor/main/app/controller/Main.js'
    );
    const leftMenuSource = readSource(
        'apps/documenteditor/main/app/controller/LeftMenu.js'
    );
    const fileMenuSource = readSource(
        'apps/documenteditor/main/app/view/FileMenuPanels.js'
    );
    const reviewControllerSource = readSource(
        'apps/common/main/lib/controller/ReviewChanges.js'
    );
    const reviewViewSource = readSource(
        'apps/common/main/lib/view/ReviewChanges.js'
    );

    assert.doesNotMatch(mainSource, /FeaturesManager\.canChange\('spellcheck'\)/);
    assert.doesNotMatch(leftMenuSource, /FeaturesManager\.canChange\('spellcheck'\)/);
    assert.doesNotMatch(fileMenuSource, /FeaturesManager\.canChange\('spellcheck'\)/);
    assert.match(leftMenuSource, /this\.mode\.canChangeSpellcheck/);
    assert.match(fileMenuSource, /mode\.canChangeSpellcheck/);
    assert.match(reviewControllerSource, /this\.appConfig\.canChangeSpellcheck/);
    assert.match(reviewViewSource, /this\.appConfig\.canChangeSpellcheck/);
});
