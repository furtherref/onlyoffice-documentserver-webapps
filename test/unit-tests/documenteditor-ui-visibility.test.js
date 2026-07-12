'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    createAmdHarness
} = require('./helpers/load-amd-source');

const WEB_APPS_ROOT = path.resolve(__dirname, '../..');

function readSource(relativePath) {
    return fs.readFileSync(path.join(WEB_APPS_ROOT, relativePath), 'utf8');
}

test('document toolbar adds collaboration but not protection tabs',
function() {
    const source = readSource(
        'apps/documenteditor/main/app/controller/Toolbar.js'
    );
    const executableSource = source.replace(/^\s*\/\/.*$/gm, '');

    assert.match(executableSource, /addTab\(tab, \$panel, 6\)/);
    assert.doesNotMatch(executableSource, /addTab\(tab, \$panel, 7\)/);
    assert.match(executableSource, /setVisible\('review'/);
    assert.doesNotMatch(executableSource, /setVisible\('protect'/);
    assert.match(
        source,
        /Common\.Controllers\.ReviewChanges'[\s\S]*createToolbarPanel\(\)/
    );
    assert.match(
        source,
        /Common\.Controllers\.Protection'[\s\S]*createToolbarPanel\(\)/
    );
});

test('hidden protection tab still ignores late activation while review activates', function() {
    const callbacks = Object.create(null);
    const Common = {
        NotificationCenter: {
            on: function(name, callback) {
                callbacks[name] = callback;
            }
        }
    };
    const DE = {Controllers: {}};
    const underscore = {
        bind: function(fn, context) {
            return fn.bind(context);
        },
        extend: Object.assign
    };
    const Backbone = {
        Controller: {
            extend: function(definition) {
                return definition;
            }
        }
    };
    const harness = createAmdHarness({
        globals: {
            Asc: {
                c_oAscDropCap: {None: 0},
                c_oAscNumberingFormat: {None: 0},
                c_oAscSectionApplyType: {All: 0}
            },
            Backbone: Backbone,
            Common: Common,
            DE: DE,
            _: underscore
        }
    });
    const activated = [];
    let unfoldCalls = 0;

    harness.load('apps/documenteditor/main/app/controller/Toolbar.js');
    const controller = Object.assign(Object.create(DE.Controllers.Toolbar), {
        addListeners: function() {},
        toolbar: {
            setTab: function(action) {
                activated.push(action);
            }
        },
        onChangeCompactView: function() {
            unfoldCalls++;
        }
    });
    DE.Controllers.Toolbar.initialize.call(controller);

    callbacks['tab:set-active']('review', true);
    callbacks['tab:set-active']('protect', true);
    assert.deepEqual(activated, ['review']);
    assert.equal(unfoldCalls, 1);

    callbacks['tab:set-active']('home', true);
    assert.deepEqual(activated, ['review', 'home']);
    assert.equal(unfoldCalls, 2);
});

test('document left menu keeps the chat entry hidden', function() {
    const source = readSource(
        'apps/documenteditor/main/app/controller/LeftMenu.js'
    );

    assert.doesNotMatch(source, /leftMenu\.btnChat\s*\[/);
    assert.match(source, /leftMenu\.btnChat\.hide\(\)/);
});

test('document editor disables chat and mail merge capabilities', function() {
    const source = readSource(
        'apps/documenteditor/main/app/controller/Main.js'
    );

    assert.match(
        source,
        /this\.appOptions\.canUseMailMerge\s*=\s*false;\s*this\.appOptions\.canChat\s*=\s*false;/
    );
});

test('document status bar hides both language controls and separators',
function() {
    const viewSource = readSource(
        'apps/documenteditor/main/app/view/Statusbar.js'
    );
    const controllerSource = readSource(
        'apps/documenteditor/main/app/controller/Statusbar.js'
    );

    assert.match(viewSource, /btnLanguage\.render\([\s\S]*btnLanguage\.hide\(\)/);
    assert.match(controllerSource, /btnDocLang\.render\([\s\S]*btnDocLang\.hide\(\)/);
    assert.match(
        controllerSource,
        /find\('#btn-cnt-lang'\)\.prev\('\.separator'\)\.hide\(\)/
    );
    assert.match(
        controllerSource,
        /find\('\.separator\.space, \.el-lang'\)\.hide\(\)/
    );
});
