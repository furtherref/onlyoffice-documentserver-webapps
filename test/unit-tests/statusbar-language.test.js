'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    createAmdHarness
} = require('./helpers/load-amd-source');

const utilModule =
    'documenteditor/main/app/util/StatusbarLanguage';
const utilFile =
    'apps/documenteditor/main/app/util/StatusbarLanguage.js';

function loadUtility() {
    const DE = {Utils: {}};
    const harness = createAmdHarness({globals: {DE: DE}});
    const utility = harness.load(utilFile, utilModule);
    assert.equal(typeof utility.normalizeCode, 'function');
    return utility;
}

test('adapter aliases only LCID 2052 without mutating caller records',
function() {
    const utility = loadUtility();
    const original = Object.freeze({
        value: 'zh-CN',
        code: 2052,
        displayValue: '中文– 中华人民共和国',
        displayValueEn: 'Chinese – People\'s Republic of China',
        spellcheck: false
    });

    const adapted = utility.adaptLanguageList([original]);
    assert.equal(adapted[0].displayValue, '中文-简体');
    assert.equal(adapted[0].displayValueEn, 'Chinese - Simplified');
    assert.equal(adapted[0].value, 'zh-CN');
    assert.equal(adapted[0].spellcheck, false);
    assert.notStrictEqual(adapted[0], original);
    assert.equal(original.displayValue, '中文– 中华人民共和国');
});

test('adapter normalizes callback codes to a finite integer or null',
function() {
    const utility = loadUtility();
    assert.equal(utility.normalizeCode('2052'), 2052);
    assert.equal(utility.normalizeCode(2052), 2052);
    assert.equal(utility.normalizeCode(null), null);
    assert.equal(utility.normalizeCode(undefined), null);
    assert.equal(utility.normalizeCode(''), null);
    assert.equal(utility.normalizeCode(true), null);
    assert.equal(utility.normalizeCode(NaN), null);
    assert.equal(utility.normalizeCode(Infinity), null);
    assert.equal(utility.normalizeCode(-1), null);
    assert.equal(utility.normalizeCode(1.5), null);
});

test('adapter matches menu records by normalized numeric LCID', function() {
    const utility = loadUtility();
    assert.equal(utility.findItemIndexByCode(
        [{code: 1033}, {code: '2052'}],
        2052
    ), 1);
    assert.equal(utility.findItemIndexByCode([], 2052), -1);
});

test('adapter emits neutral callback information for mixed language',
function() {
    const utility = loadUtility();
    const info = utility.createCallbackInfo(null, null, null);
    assert.equal(info.value, '');
    assert.equal(info.displayValue, '—');
    assert.equal(info.code, null);
});

test('generic English remains valid and unaliased', function() {
    const utility = loadUtility();
    const name = utility.getDisplayName(0x0009, {
        native: 'English',
        english: 'English'
    });
    assert.equal(name.native, 'English');
    assert.equal(name.english, 'English');
});

test('getDisplayName handles missing displayName object', function() {
    const utility = loadUtility();
    const name = utility.getDisplayName(0x0009, null);
    assert.equal(name.native, '');
    assert.equal(name.english, '');
});

test('getDisplayName handles partial displayName object', function() {
    const utility = loadUtility();
    const name = utility.getDisplayName(0x0009, {native: 'Français'});
    assert.equal(name.native, 'Français');
    assert.equal(name.english, '');
});

test('createCallbackInfo returns valid language info when code is valid', function() {
    const utility = loadUtility();
    const info = utility.createCallbackInfo(0x0409, ['e'], {
        native: 'English (United States)',
        english: 'English (United States)'
    });
    assert.equal(info.value, 'e');
    assert.equal(info.displayValue, 'English (United States)');
    assert.equal(info.code, 0x0409);
});

test('createCallbackInfo handles null languageName', function() {
    const utility = loadUtility();
    const info = utility.createCallbackInfo(0x0409, null, {
        native: 'English',
        english: 'English'
    });
    assert.equal(info.value, '');
    assert.equal(info.displayValue, 'English');
    assert.equal(info.code, 0x0409);
});

test('adaptLanguageList handles non-Chinese language items', function() {
    const utility = loadUtility();
    const original = {
        value: 'en-US',
        code: 0x0409,
        displayValue: 'English (United States)',
        displayValueEn: 'English (United States)'
    };
    const adapted = utility.adaptLanguageList([original]);
    assert.equal(adapted[0].displayValue, 'English (United States)');
    assert.equal(adapted[0].code, 0x0409);
    assert.notStrictEqual(adapted[0], original);
});

test('adaptLanguageList handles items with null code', function() {
    const utility = loadUtility();
    const items = [{code: null, displayValue: 'Mixed'}];
    const adapted = utility.adaptLanguageList(items);
    assert.equal(adapted[0].code, null);
    assert.equal(adapted[0].displayValue, 'Mixed');
});

test('findItemIndexByCode returns -1 when items is not an array', function() {
    const utility = loadUtility();
    assert.equal(utility.findItemIndexByCode(null, 2052), -1);
    assert.equal(utility.findItemIndexByCode(undefined, 2052), -1);
    assert.equal(utility.findItemIndexByCode({}, 2052), -1);
});

test('findItemIndexByCode handles items with null code property', function() {
    const utility = loadUtility();
    assert.equal(utility.findItemIndexByCode(
        [{code: null}, {code: undefined}, {code: 2052}],
        2052
    ), 2);
});
