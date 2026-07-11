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
 * SPDX-License-Identifier: AGPL-3.0-only
 */

define(['core'], function () {
    'use strict';

    function resolveInitialValue(featureValue, customization) {
        if (featureValue !== undefined) {
            return featureValue;
        }

        if (customization && customization.spellcheck !== undefined) {
            return customization.spellcheck !== false;
        }

        return false;
    }

    function canChange(featuresManager) {
        return featuresManager.canChange('spellcheck', true);
    }

    function resolveUserPreference(storage, key, initialValue, changeAllowed) {
        if (!changeAllowed) {
            return initialValue;
        }

        var value = storage.getBool(key, initialValue);
        storage.setItem(key, value ? 1 : 0);
        return value;
    }

    var SpellcheckSettings = {
        resolveInitialValue: resolveInitialValue,
        canChange: canChange,
        resolveUserPreference: resolveUserPreference
    };

    DE.Utils = DE.Utils || {};
    DE.Utils.SpellcheckSettings = SpellcheckSettings;
    return SpellcheckSettings;
});
