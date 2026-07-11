'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const webAppsRoot = path.resolve(__dirname, '../../..');

function createAmdHarness(options) {
    options = options || {};

    const modules = Object.assign(
        Object.create(null),
        options.modules || {}
    );
    const sandbox = Object.assign(
        {console: console},
        options.globals || {}
    );
    let lastExport;

    sandbox.window = sandbox.window || sandbox;
    sandbox.define = function(dependencies, factory) {
        const resolved = dependencies.map(function(dependency) {
            return modules[dependency];
        });
        lastExport = factory.apply(null, resolved);
    };

    const context = vm.createContext(sandbox);

    return {
        modules: modules,
        sandbox: sandbox,
        load: function(relativePath, moduleId) {
            const filename = path.resolve(webAppsRoot, relativePath);
            const rootPrefix = webAppsRoot + path.sep;
            if (!filename.startsWith(rootPrefix)) {
                throw new Error(
                    'Source escapes web-apps root: ' + relativePath
                );
            }

            const source = fs.readFileSync(filename, 'utf8');
            lastExport = undefined;
            vm.runInContext(source, context, {filename: filename});

            if (moduleId) {
                modules[moduleId] = lastExport;
            }
            return lastExport;
        }
    };
}

module.exports = {
    createAmdHarness: createAmdHarness
};
