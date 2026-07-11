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

// ---------------------------------------------------------------------------
// Task 8: SDK-authoritative status bar language (controller + view)
// ---------------------------------------------------------------------------

function createUnderscoreDouble() {
    return {
        bind: function(fn, context) {
            return fn.bind(context);
        },
        each: function(items, iterator) {
            (items || []).forEach(iterator);
        },
        extend: Object.assign,
        findIndex: function(items, matcher) {
            return (items || []).findIndex(function(item) {
                return Object.keys(matcher).every(function(key) {
                    return item[key] === matcher[key];
                });
            });
        },
        template: function() {
            return function() {
                return '';
            };
        }
    };
}

function createMenuDouble() {
    return {
        items: [],
        recent: null,
        clearAll: function() {
            this.items.forEach(function(item) {
                item.checked = false;
            });
        },
        resetItems: function(items) {
            this.items = items.map(function(item) {
                return Object.assign({checked: false}, item);
            });
        },
        setChecked: function(index, checked) {
            this.clearAll();
            if (this.items[index] && this.items[index].checkable) {
                this.items[index].checked = !!checked;
            }
        },
        setRecent: function(recent) {
            this.recent = recent;
        }
    };
}

function createEditorHarness() {
    const underscore = createUnderscoreDouble();
    function UiDouble(options) {
        Object.assign(this, options || {});
        this.items = this.items || [];
        this.on = function() {};
        this.setCaption = function(caption) {
            this.caption = caption;
        };
        this.setDisabled = function(disabled) {
            this.disabled = !!disabled;
        };
    }
    function MenuDouble(options) {
        Object.assign(this, createMenuDouble(), options || {});
        this.on = function() {};
    }
    const DE = {
        Controllers: {},
        Models: {
            Pages: function(initial) {
                this.state = Object.assign({}, initial);
                this.get = function(key) {
                    return this.state[key];
                };
                this.on = function() {};
            }
        },
        Utils: {},
        Views: {}
    };
    const Common = {
        NotificationCenter: {
            on: function() {}
        },
        localStorage: {
            getBool: function() {
                return false;
            }
        },
        UI: {
            Button: UiDouble,
            InputField: UiDouble,
            Menu: MenuDouble,
            MenuSimple: MenuDouble
        },
        Utils: {
            InternalSettings: {
                get: function() {
                    return 0;
                }
            },
            String: {
                format: function(value) {
                    return value || '';
                }
            }
        },
        util: {
            LanguageInfo: {
                getLocalLanguageName: function(code) {
                    return code === 2052 ? ['zh-CN'] : ['en-US'];
                },
                getLocalLanguageDisplayName: function(code) {
                    return code === 2052
                        ? {
                            native: '中文– 中华人民共和国',
                            english:
                                'Chinese – People\'s Republic of China'
                        }
                        : {
                            native: 'English – United States',
                            english: 'English – United States'
                        };
                }
            }
        }
    };
    const Backbone = {
        Controller: {
            extend: function(definition) {
                return definition;
            }
        },
        View: {
            extend: function(definition) {
                return definition;
            }
        }
    };
    const harness = createAmdHarness({
        globals: {
            Backbone: Backbone,
            Common: Common,
            DE: DE,
            _: underscore
        },
        modules: {
            backbone: Backbone,
            jquery: function() {},
            underscore: underscore,
            'text!documenteditor/main/app/template/StatusBar.template': ''
        }
    });

    harness.load(utilFile, utilModule);
    harness.load(
        'apps/documenteditor/main/app/controller/Statusbar.js'
    );
    harness.load(
        'apps/documenteditor/main/app/view/Statusbar.js'
    );

    assert.equal(typeof DE.Controllers.Statusbar._onTextLanguage, 'function');
    assert.equal(typeof DE.Views.Statusbar.setLanguage, 'function');
    return {Common: Common, DE: DE, harness: harness};
}

function createViewMethodDouble(DE, overrides) {
    const fireEvent = [];
    const setCaptionCalls = [];
    const setDisabledCalls = [];
    const obj = Object.assign({
        langMenu: createMenuDouble(),
        btnLanguage: {
            caption: undefined,
            disabled: undefined,
            setCaption: function(caption) {
                this.caption = caption;
                setCaptionCalls.push(caption);
            },
            setDisabled: function(disabled) {
                this.disabled = !!disabled;
                setDisabledCalls.push(!!disabled);
            }
        },
        currentLanguageCode: null,
        mode: {isDisconnected: false},
        _isDisabled: false,
        _state: {
            docProtection: {
                isReadOnly: false,
                isFormsOnly: false,
                isCommentsOnly: false
            }
        },
        fireEvent: function() {
            fireEvent.push(Array.prototype.slice.call(arguments));
        },
        _syncLanguageMenuSelection:
            DE.Views.Statusbar._syncLanguageMenuSelection,
        onLanguageMenuClick: DE.Views.Statusbar.onLanguageMenuClick,
        reloadLanguages: DE.Views.Statusbar.reloadLanguages,
        setLanguage: DE.Views.Statusbar.setLanguage
    }, overrides || {});

    return {obj: obj, fireEvent: fireEvent};
}

const ADAPTED_ITEMS = [
    {
        value: 'zh-CN',
        code: 2052,
        displayValue: '中文-简体',
        displayValueEn: 'Chinese - Simplified',
        spellcheck: false
    },
    {
        value: 'en-US',
        code: 1033,
        displayValue: 'English – United States',
        displayValueEn: 'English – United States',
        spellcheck: true
    }
];

test('controller normalizes 2052 callback and applies scoped alias',
function() {
    const {DE} = createEditorHarness();
    let captured = null;
    const statusbar = {
        setLanguage: function(info) {
            captured = info;
        }
    };

    DE.Controllers.Statusbar._onTextLanguage.call({statusbar: statusbar}, '2052');

    assert.equal(captured.code, 2052);
    assert.equal(captured.displayValue, '中文-简体');
});

test('controller copies language records before adapting menu labels',
function() {
    const {DE} = createEditorHarness();
    const frozenInput = Object.freeze([Object.freeze({
        value: 'zh-CN',
        code: 2052,
        displayValue: '中文– 中华人民共和国',
        displayValueEn: 'Chinese – People\'s Republic of China',
        spellcheck: false
    })]);
    let received = null;
    const controller = {
        statusbar: {
            reloadLanguages: function(langs) {
                received = langs;
            }
        }
    };

    DE.Controllers.Statusbar.setLanguages.call(controller, frozenInput);

    assert.equal(frozenInput[0].displayValue, '中文– 中华人民共和国');
    assert.notStrictEqual(controller.langs, frozenInput);
    assert.equal(received[0].displayValue, '中文-简体');
    assert.equal(received[0].value, 'zh-CN');
});

test('view starts neutral before the first SDK callback', function() {
    const {DE} = createEditorHarness();
    const view = Object.create(DE.Views.Statusbar);

    view.initialize({});

    assert.equal(view.currentLanguageCode, null);
    assert.equal(view.btnLanguage.caption, '—');
    assert.equal(view.btnLanguage.disabled, true);
    assert.equal(view.langMenu.items.some(function(item) {
        return item.checked;
    }), false);
});

test('view clears and restores 2052 around a mixed callback', function() {
    const {DE} = createEditorHarness();
    const {obj} = createViewMethodDouble(DE);

    obj.reloadLanguages(ADAPTED_ITEMS);

    obj.setLanguage({code: 2052, displayValue: '中文-简体'});
    assert.equal(obj.currentLanguageCode, 2052);
    assert.equal(obj.btnLanguage.caption, '中文-简体');
    assert.equal(obj.langMenu.items[0].checked, true);

    obj.setLanguage({code: null});
    assert.equal(obj.currentLanguageCode, null);
    assert.equal(obj.btnLanguage.caption, '—');
    assert.equal(obj.langMenu.items.some(function(item) {
        return item.checked;
    }), false);

    obj.setLanguage({code: 2052, displayValue: '中文-简体'});
    assert.equal(obj.currentLanguageCode, 2052);
    assert.equal(obj.btnLanguage.caption, '中文-简体');
    assert.equal(obj.langMenu.items[0].checked, true);
});

test('reload cannot restore stale 2052 after 1033 callback', function() {
    const {DE} = createEditorHarness();
    const {obj} = createViewMethodDouble(DE);

    obj.reloadLanguages(ADAPTED_ITEMS);
    obj.setLanguage({code: 2052, displayValue: '中文-简体'});
    obj.setLanguage({code: 1033, displayValue: 'English – United States'});
    obj.reloadLanguages(ADAPTED_ITEMS);

    assert.equal(obj.currentLanguageCode, 1033);
    assert.equal(obj.btnLanguage.caption, 'English – United States');
    assert.equal(obj.langMenu.items[0].checked, false);
    assert.equal(obj.langMenu.items[1].checked, true);
});

test('unavailable current code becomes checked after a later reload',
function() {
    const {DE} = createEditorHarness();
    const {obj} = createViewMethodDouble(DE);

    obj.setLanguage({code: 2052, displayValue: '中文-简体'});
    assert.equal(obj.currentLanguageCode, 2052);
    assert.equal(obj.btnLanguage.caption, '中文-简体');
    assert.equal(obj.langMenu.items.length, 0);

    obj.reloadLanguages(ADAPTED_ITEMS);
    assert.equal(obj.currentLanguageCode, 2052);
    assert.equal(obj.btnLanguage.caption, '中文-简体');
    assert.equal(obj.langMenu.items[0].checked, true);
});

test('empty reload disables without discarding authoritative state',
function() {
    const {DE} = createEditorHarness();
    const {obj} = createViewMethodDouble(DE);

    obj.reloadLanguages(ADAPTED_ITEMS);
    obj.setLanguage({code: 2052, displayValue: '中文-简体'});

    obj.reloadLanguages([]);

    assert.equal(obj.btnLanguage.disabled, true);
    assert.equal(obj.currentLanguageCode, 2052);
    assert.equal(obj.btnLanguage.caption, '中文-简体');
});

test('protection and disconnection continue to disable language menu',
function() {
    const {DE} = createEditorHarness();

    const {obj: protectedObj} = createViewMethodDouble(DE, {
        _state: {
            docProtection: {
                isReadOnly: true,
                isFormsOnly: false,
                isCommentsOnly: false
            }
        }
    });
    protectedObj.reloadLanguages(ADAPTED_ITEMS);
    assert.equal(protectedObj.btnLanguage.disabled, true);

    const {obj: disconnectedObj} = createViewMethodDouble(DE, {
        mode: {isDisconnected: true}
    });
    disconnectedObj.reloadLanguages(ADAPTED_ITEMS);
    assert.equal(disconnectedObj.btnLanguage.disabled, true);
});

test('menu click emits numeric code without optimistic caption change',
function() {
    const {DE} = createEditorHarness();
    const {obj, fireEvent} = createViewMethodDouble(DE);

    obj.reloadLanguages(ADAPTED_ITEMS);
    obj.setLanguage({code: 1033, displayValue: 'English – United States'});

    obj.onLanguageMenuClick({code: '2052'});

    assert.equal(fireEvent.length, 1);
    assert.equal(fireEvent[0][0], 'langchanged');
    assert.equal(fireEvent[0][1][0], obj);
    assert.equal(fireEvent[0][1][1], 2052);
    assert.equal(obj.currentLanguageCode, 1033);
    assert.equal(obj.btnLanguage.caption, 'English – United States');
});

test('menu click restores SDK checked state after MenuSimple optimism',
function() {
    const {DE} = createEditorHarness();
    const {obj} = createViewMethodDouble(DE);

    obj.reloadLanguages(ADAPTED_ITEMS);
    obj.setLanguage({code: 1033, displayValue: 'English – United States'});

    // Simulate MenuSimple's own optimistic check of the clicked item.
    obj.langMenu.clearAll();
    obj.langMenu.items[0].checked = true;

    obj.onLanguageMenuClick({code: '2052'});

    assert.equal(obj.langMenu.items[0].checked, false);
    assert.equal(obj.langMenu.items[1].checked, true);
});

test('recent language persistence remains BCP-47 based', function() {
    const {DE} = createEditorHarness();
    const {obj} = createViewMethodDouble(DE);

    obj.reloadLanguages(ADAPTED_ITEMS);

    assert.equal(obj.langMenu.recent.valueField, 'value');
    assert.equal(obj.langMenu.items[0].value, 'zh-CN');
});

test('generic English callback is not suppressed by initialization',
function() {
    const {DE} = createEditorHarness();
    let captured = null;
    const statusbar = {
        setLanguage: function(info) {
            captured = info;
        }
    };

    DE.Controllers.Statusbar._onTextLanguage.call(
        {statusbar: statusbar}, 0x0009
    );
    assert.equal(captured.code, 0x0009);

    const {obj} = createViewMethodDouble(DE);
    obj.setLanguage(captured);

    assert.equal(obj.btnLanguage.caption, 'English – United States');
    assert.equal(obj.currentLanguageCode, 0x0009);
});

test('invalid menu code never invokes SDK setter', function() {
    const {DE} = createEditorHarness();
    let putCalls = 0;
    const controller = {
        api: {
            put_TextPrLang: function() {
                putCalls++;
            }
        }
    };

    DE.Controllers.Statusbar.onLangMenu.call(controller, null, null);
    DE.Controllers.Statusbar.onLangMenu.call(controller, null, NaN);
    DE.Controllers.Statusbar.onLangMenu.call(controller, null, '');
    DE.Controllers.Statusbar.onLangMenu.call(controller, null, '  ');

    assert.equal(putCalls, 0);
});
