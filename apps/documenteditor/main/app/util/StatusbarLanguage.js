/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

define(['core'], function () {
    'use strict';

    var CHINESE_SIMPLIFIED_CODE = 0x0804;
    var CHINESE_SIMPLIFIED_NATIVE = '中文-简体';
    var CHINESE_SIMPLIFIED_ENGLISH = 'Chinese - Simplified';
    var NEUTRAL_CAPTION = '—';

    function normalizeCode(value) {
        if (value === null || value === undefined ||
            typeof value === 'boolean') {
            return null;
        }

        if (typeof value === 'string') {
            if (value.trim() === '') {
                return null;
            }
            value = Number(value);
        }

        return typeof value === 'number' &&
            isFinite(value) && value >= 0 &&
            Math.floor(value) === value
            ? value
            : null;
    }

    function getDisplayName(code, displayName) {
        code = normalizeCode(code);
        if (code === CHINESE_SIMPLIFIED_CODE) {
            return {
                native: CHINESE_SIMPLIFIED_NATIVE,
                english: CHINESE_SIMPLIFIED_ENGLISH
            };
        }

        return {
            native: displayName && displayName.native || '',
            english: displayName && displayName.english || ''
        };
    }

    function createCallbackInfo(code, languageName, displayName) {
        code = normalizeCode(code);
        if (code === null) {
            return {
                value: '',
                displayValue: NEUTRAL_CAPTION,
                code: null
            };
        }

        displayName = getDisplayName(code, displayName);
        return {
            value: languageName && languageName[0] || '',
            displayValue: displayName.native,
            code: code
        };
    }

    function adaptLanguageList(items) {
        if (!Array.isArray(items)) {
            return [];
        }

        return items.map(function (item) {
            var adapted = Object.assign({}, item || {}),
                code = normalizeCode(adapted.code);
            adapted.code = code;

            if (code === CHINESE_SIMPLIFIED_CODE) {
                adapted.displayValue = CHINESE_SIMPLIFIED_NATIVE;
                adapted.displayValueEn = CHINESE_SIMPLIFIED_ENGLISH;
            }

            return adapted;
        });
    }

    function findItemIndexByCode(items, code) {
        code = normalizeCode(code);
        if (code === null || !Array.isArray(items)) {
            return -1;
        }

        for (var index = 0; index < items.length; index++) {
            if (normalizeCode(items[index] && items[index].code) === code) {
                return index;
            }
        }

        return -1;
    }

    var StatusbarLanguage = {
        CHINESE_SIMPLIFIED_CODE: CHINESE_SIMPLIFIED_CODE,
        NEUTRAL_CAPTION: NEUTRAL_CAPTION,
        normalizeCode: normalizeCode,
        getDisplayName: getDisplayName,
        createCallbackInfo: createCallbackInfo,
        adaptLanguageList: adaptLanguageList,
        findItemIndexByCode: findItemIndexByCode
    };

    DE.Utils = DE.Utils || {};
    DE.Utils.StatusbarLanguage = StatusbarLanguage;
    return StatusbarLanguage;
});
