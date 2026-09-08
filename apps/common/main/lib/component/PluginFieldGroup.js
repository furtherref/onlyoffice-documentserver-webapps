/*
 * (c) Copyright Ascensio System SIA 2010-2024
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 */
/**
 *  PluginFieldGroup.js
 *
 *  FORK-SPECIFIC (furtherref/onlyoffice-documentserver-webapps).
 *
 *  Backs the fork-only plugin toolbar item `type: 'field-group'`, which is
 *  NOT part of the upstream ONLYOFFICE plugin API. A field group renders one
 *  to three rows of `label + read-only input + small icon button` inside a
 *  plugin toolbar tab. Plugins register it through the ordinary
 *  `AddToolbarMenuItem` call, receive row-button clicks through
 *  `onToolbarMenuClick` (keyed by `rows[].button.id`), and push result text
 *  back through `UpdateToolbarMenuItem` with `rows[].value`.
 *
 *  Contract (v1):
 *    {
 *      id, type: 'field-group', contractVersion: 1,
 *      separator?, lockInViewMode?, disabled?, readyEventId?,
 *      rows: [{ id, label, value, button: { id, text, hint?, icons? } }]
 *    }
 *  After a successful registration the fork sends one reserved toolbar click
 *  callback with `readyEventId` so the plugin can detect support.
 *
 *  Validation, patch computation and click forwarding are DOM-free pure
 *  functions on the constructor so they can be unit-tested in Node.
 */

if (Common === undefined)
    var Common = {};

define([
    'common/main/lib/component/BaseView',
    'common/main/lib/component/InputField',
    'common/main/lib/component/Button'
], function () {
    'use strict';

    var CONTRACT_VERSION = 1,
        MAX_ROWS = 3,
        MAX_ID = 128,
        MAX_CAPTION = 64,
        MAX_HINT = 512,
        MAX_VALUE = 2048,
        ID_RE = /^[A-Za-z0-9_.:-]+$/,
        FORBIDDEN_KEYS = ['html', 'script', 'onClick', 'onclick', 'style', 'className', 'template', 'data', 'items'],
        RESERVED_IDS = ['__proto__', 'constructor', 'prototype'];

    function fail(message) {
        return {ok: false, error: message};
    }

    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function hasForbiddenKey(obj) {
        for (var i = 0; i < FORBIDDEN_KEYS.length; i++) {
            if (hasOwn(obj, FORBIDDEN_KEYS[i])) return FORBIDDEN_KEYS[i];
        }
        return null;
    }

    function checkId(value, what) {
        if (typeof value !== 'string' || !value.length) return what + ' must be a non-empty string';
        if (value.length > MAX_ID) return what + ' exceeds ' + MAX_ID + ' characters';
        if (!ID_RE.test(value)) return what + ' contains unsupported characters';
        if (value.indexOf('_oo_sep_') >= 0) return what + ' must not contain _oo_sep_';
        if (RESERVED_IDS.indexOf(value) >= 0) return what + ' is reserved';
        return null;
    }

    function checkText(value, what, max, required) {
        if (value === undefined && !required) return null;
        if (typeof value !== 'string') return what + ' must be a string';
        if (required && !value.length) return what + ' must not be empty';
        if (value.length > max) return what + ' exceeds ' + max + ' characters';
        return null;
    }

    function checkBoolean(obj, key) {
        if (hasOwn(obj, key) && typeof obj[key] !== 'boolean') return key + ' must be a boolean';
        return null;
    }

    function validateButton(button, rowIndex) {
        var where = 'rows[' + rowIndex + '].button';
        if (!isPlainObject(button)) return fail(where + ' must be an object');
        var bad = hasForbiddenKey(button);
        if (bad) return fail(where + ' must not define ' + bad);
        var err = checkId(button.id, where + '.id') ||
                  checkText(button.text, where + '.text', MAX_CAPTION, true) ||
                  checkText(button.hint, where + '.hint', MAX_HINT, false);
        if (err) return fail(err);
        if (button.icons !== undefined && typeof button.icons !== 'string' && !isPlainObject(button.icons))
            return fail(where + '.icons must be a string or an object');
        var out = {id: button.id, text: button.text, hint: button.hint || ''};
        if (button.icons !== undefined)
            out.icons = typeof button.icons === 'string' ? button.icons : JSON.parse(JSON.stringify(button.icons));
        return {ok: true, button: out};
    }

    function validateRow(row, index) {
        var where = 'rows[' + index + ']';
        if (!isPlainObject(row)) return fail(where + ' must be an object');
        var bad = hasForbiddenKey(row);
        if (bad) return fail(where + ' must not define ' + bad);
        var err = checkId(row.id, where + '.id') ||
                  checkText(row.label, where + '.label', MAX_CAPTION, true) ||
                  (typeof row.value === 'string' ? checkText(row.value, where + '.value', MAX_VALUE, false)
                                                 : where + '.value must be a string');
        if (err) return fail(err);
        var button = validateButton(row.button, index);
        if (!button.ok) return button;
        return {ok: true, row: {id: row.id, label: row.label, value: row.value, button: button.button}};
    }

    /**
     * Validates a `field-group` registration item.
     * @returns {{ok: true, item: Object}|{ok: false, error: string}}
     */
    function validateItem(item) {
        if (!isPlainObject(item)) return fail('item must be an object');
        if (item.type !== 'field-group') return fail('type must be field-group');
        if (item.contractVersion !== CONTRACT_VERSION) return fail('unsupported contractVersion');
        var bad = hasForbiddenKey(item);
        if (bad) return fail('item must not define ' + bad);
        var err = checkId(item.id, 'id') ||
                  checkBoolean(item, 'separator') ||
                  checkBoolean(item, 'lockInViewMode') ||
                  checkBoolean(item, 'disabled') ||
                  (hasOwn(item, 'readyEventId') ? checkId(item.readyEventId, 'readyEventId') : null);
        if (err) return fail(err);
        if (!Array.isArray(item.rows) || item.rows.length < 1 || item.rows.length > MAX_ROWS)
            return fail('rows must contain 1 to ' + MAX_ROWS + ' entries');

        var rows = [], seen = Object.create(null), seenButtons = Object.create(null);
        for (var i = 0; i < item.rows.length; i++) {
            var res = validateRow(item.rows[i], i);
            if (!res.ok) return res;
            if (seen[res.row.id]) return fail('duplicate row id ' + res.row.id);
            if (seenButtons[res.row.button.id]) return fail('duplicate button id ' + res.row.button.id);
            seen[res.row.id] = 1;
            seenButtons[res.row.button.id] = 1;
            rows.push(res.row);
        }

        var out = {
            id: item.id,
            type: 'field-group',
            contractVersion: CONTRACT_VERSION,
            separator: !!item.separator,
            lockInViewMode: !!item.lockInViewMode,
            rows: rows
        };
        if (hasOwn(item, 'disabled')) out.disabled = item.disabled;
        if (hasOwn(item, 'readyEventId')) out.readyEventId = item.readyEventId;
        return {ok: true, item: out};
    }

    var STRUCTURAL_KEYS = ['type', 'contractVersion', 'separator', 'lockInViewMode', 'readyEventId'],
        STRUCTURAL_BUTTON_KEYS = ['id', 'icons'];

    /**
     * Validates an `UpdateToolbarMenuItem` patch against the registered rows.
     * Only text fields are patchable; structure is immutable.
     * @param {Array} rows - normalized rows from validateItem().
     * @param {Object} patch - the incoming item.
     * @returns {{ok: true, changes: Array, disabled: (boolean|undefined)}|{ok: false, error: string}}
     */
    function validatePatch(rows, patch) {
        if (!isPlainObject(patch)) return fail('patch must be an object');
        var bad = hasForbiddenKey(patch);
        if (bad) return fail('patch must not define ' + bad);
        for (var k = 0; k < STRUCTURAL_KEYS.length; k++) {
            if (hasOwn(patch, STRUCTURAL_KEYS[k])) return fail('patch must not change ' + STRUCTURAL_KEYS[k]);
        }
        var err = checkBoolean(patch, 'disabled');
        if (err) return fail(err);

        var known = Object.create(null);
        for (var r = 0; r < rows.length; r++) known[rows[r].id] = 1;

        var changes = [], seen = Object.create(null);
        if (hasOwn(patch, 'rows')) {
            if (!Array.isArray(patch.rows)) return fail('rows must be an array');
            for (var i = 0; i < patch.rows.length; i++) {
                var row = patch.rows[i], where = 'rows[' + i + ']';
                if (!isPlainObject(row)) return fail(where + ' must be an object');
                bad = hasForbiddenKey(row);
                if (bad) return fail(where + ' must not define ' + bad);
                if (typeof row.id !== 'string' || !known[row.id]) return fail(where + ' refers to an unknown row');
                if (seen[row.id]) return fail(where + ' duplicates row ' + row.id);
                seen[row.id] = 1;

                var change = {id: row.id};
                if (hasOwn(row, 'value')) {
                    err = typeof row.value === 'string' ? checkText(row.value, where + '.value', MAX_VALUE, false) : where + '.value must be a string';
                    if (err) return fail(err);
                    change.value = row.value;
                }
                if (hasOwn(row, 'label')) {
                    err = checkText(row.label, where + '.label', MAX_CAPTION, true);
                    if (err) return fail(err);
                    change.label = row.label;
                }
                if (hasOwn(row, 'button')) {
                    if (!isPlainObject(row.button)) return fail(where + '.button must be an object');
                    bad = hasForbiddenKey(row.button);
                    if (bad) return fail(where + '.button must not define ' + bad);
                    for (k = 0; k < STRUCTURAL_BUTTON_KEYS.length; k++) {
                        if (hasOwn(row.button, STRUCTURAL_BUTTON_KEYS[k])) return fail(where + '.button.' + STRUCTURAL_BUTTON_KEYS[k] + ' is immutable');
                    }
                    if (hasOwn(row.button, 'text')) {
                        err = checkText(row.button.text, where + '.button.text', MAX_CAPTION, true);
                        if (err) return fail(err);
                        change.text = row.button.text;
                    }
                    if (hasOwn(row.button, 'hint')) {
                        err = checkText(row.button.hint, where + '.button.hint', MAX_HINT, false);
                        if (err) return fail(err);
                        change.hint = row.button.hint;
                    }
                }
                changes.push(change);
            }
        }
        return {ok: true, changes: changes, disabled: hasOwn(patch, 'disabled') ? patch.disabled : undefined};
    }

    function encode(text) {
        return Common.Utils.String.htmlEncode(text || '');
    }

    Common.UI.PluginFieldGroup = Common.UI.BaseView.extend({
        /*
         * options: value (item id), guid, tabid, separator, lock, rows
         * (normalized by validateItem), plus optional dataHint* passthrough.
         */
        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this, options);
            var me = this;
            this.rows = [];
            this._rowIndex = Object.create(null);
            ((this.options && this.options.rows) || []).forEach(function(row) {
                var copy = {
                    id: row.id, label: row.label, value: row.value,
                    button: {id: row.button.id, text: row.button.text, hint: row.button.hint || '', icons: row.button.icons}
                };
                me.rows.push(copy);
                me._rowIndex[copy.id] = copy;
            });
            this.keepState = [];
            this.disabled = false;
            this.rendered = false;
            this._views = [];
        },

        render: function(parentEl) {
            var me = this;
            if (this.rendered) return this;

            this.cmpEl = $('<div class="plugin-field-group"></div>');
            this.rows.forEach(function(row) {
                var $row = $('<div class="plugin-field-row"></div>').appendTo(me.cmpEl),
                    inputId = Common.UI.getId('plugin-field-'),
                    $label = $('<label class="plugin-field-label"></label>').attr('for', inputId).text(row.label).appendTo($row),
                    $inputMount = $('<span class="plugin-field-input"></span>').appendTo($row),
                    $btnMount = $('<span class="plugin-field-action"></span>').appendTo($row);

                var input = new Common.UI.InputField({
                    editable: false,
                    value: row.value,
                    cls: 'plugin-field-value',
                    ariaLabel: row.label,
                    dataHint: me.options.dataHint,
                    dataHintDirection: me.options.dataHintDirection,
                    dataHintOffset: me.options.dataHintOffset
                });
                input.render($inputMount);
                me._markCopyable(input, inputId);

                var button = new Common.UI.ButtonCustom({
                    cls: 'btn-toolbar plugin-field-button',
                    iconsSet: row.button.icons,
                    baseUrl: '',
                    caption: encode(row.button.text),
                    hint: row.button.hint || '',
                    value: row.button.id,
                    guid: me.options.guid,
                    tabid: me.options.tabid,
                    dataHint: me.options.dataHint,
                    dataHintDirection: me.options.dataHintDirection,
                    dataHintOffset: me.options.dataHintOffset
                });
                button.render($btnMount);
                button.on('click', function(b) {
                    if (!me.disabled && !(b && b.isDisabled && b.isDisabled()))
                        me.trigger('click', me, b);
                });

                me._views.push({id: row.id, $label: $label, input: input, button: button});
            });

            parentEl && parentEl.append(this.cmpEl);
            this.rendered = true;
            this.disabled && this._applyDisabled(true);
            return this;
        },

        // InputField.setEditable(false) sets data-can-copy="false", which makes
        // the editor swallow the context menu. Results must stay copyable.
        _markCopyable: function(input, inputId) {
            var $input = input._input;
            if (!$input) return;
            $input.attr('id', inputId);
            $input.attr('readonly', 'readonly');
            $input.attr('data-can-copy', 'true');
            $input.attr('oo_editor_input', 'true');
        },

        _applyDisabled: function(disabled) {
            this._views.forEach(function(view) {
                view.button.setDisabled(disabled);
            });
        },

        setDisabled: function(disabled) {
            disabled = !!disabled;
            if (this.disabled === disabled) return;
            this.disabled = disabled;
            this.rendered && this._applyDisabled(disabled);
        },

        isDisabled: function() {
            return this.disabled;
        },

        /**
         * Applies an UpdateToolbarMenuItem patch. Text only; `disabled` is
         * returned to the caller (LayoutManager routes it through lockControls).
         */
        updateFrom: function(patch) {
            var me = this,
                result = validatePatch(this.rows, patch);
            if (!result.ok) return result;

            result.changes.forEach(function(change) {
                var row = me._rowIndex[change.id],
                    view = null;
                for (var i = 0; i < me._views.length; i++) {
                    if (me._views[i].id === change.id) { view = me._views[i]; break; }
                }
                if (hasOwn(change, 'value')) {
                    row.value = change.value;
                    view && view.input.setValue(change.value);
                }
                if (hasOwn(change, 'label')) {
                    row.label = change.label;
                    view && view.$label.text(change.label);
                }
                if (hasOwn(change, 'text')) {
                    row.button.text = change.text;
                    view && view.button.setCaption(encode(change.text));
                }
                if (hasOwn(change, 'hint')) {
                    row.button.hint = change.hint;
                    view && view.button.updateHint(change.hint);
                }
            });
            return result;
        },

        /**
         * Releases child views and listeners. The outer toolbar slot is still
         * removed by Mixtbar, so cmpEl itself is left in place here.
         */
        dispose: function() {
            this._views.forEach(function(view) {
                view.button.off && view.button.off('click');
                view.button.remove && view.button.remove();
                view.input.remove && view.input.remove();
            });
            this._views = [];
            this.off && this.off();
            this.rendered = false;
        }
    });


    Common.UI.PluginFieldGroup.CONTRACT_VERSION = CONTRACT_VERSION;
    Common.UI.PluginFieldGroup.validateItem = validateItem;
    Common.UI.PluginFieldGroup.validatePatch = validatePatch;

    return Common.UI.PluginFieldGroup;
});
