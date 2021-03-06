"use strict";
/**
Copyright (c) 2014 The Chromium Authors. All rights reserved.
Use of this source code is governed by a BSD-style license that can be
found in the LICENSE file.
**/

require("./category_util.js");
require("./event.js");
require("./extension_registry_base.js");

'use strict';

global.tr.exportTo('tr.b', function () {
  var getCategoryParts = tr.b.getCategoryParts;

  var RegisteredTypeInfo = tr.b.RegisteredTypeInfo;
  var ExtensionRegistryOptions = tr.b.ExtensionRegistryOptions;

  function decorateTypeBasedExtensionRegistry(registry, extensionRegistryOptions) {
    var savedStateStack = [];

    registry.registeredTypeInfos_ = [];

    registry.categoryPartToTypeInfoMap_ = new Map();
    registry.typeNameToTypeInfoMap_ = new Map();

    registry.register = function (constructor, metadata) {

      extensionRegistryOptions.validateConstructor(constructor);

      var typeInfo = new RegisteredTypeInfo(constructor, metadata || extensionRegistryOptions.defaultMetadata);

      typeInfo.typeNames = [];
      typeInfo.categoryParts = [];
      if (metadata && metadata.typeName) typeInfo.typeNames.push(metadata.typeName);
      if (metadata && metadata.typeNames) {
        typeInfo.typeNames.push.apply(typeInfo.typeNames, metadata.typeNames);
      }
      if (metadata && metadata.categoryParts) {
        typeInfo.categoryParts.push.apply(typeInfo.categoryParts, metadata.categoryParts);
      }

      if (typeInfo.typeNames.length === 0 && typeInfo.categoryParts.length === 0) throw new Error('typeName or typeNames must be provided');

      // Sanity checks...
      typeInfo.typeNames.forEach(function (typeName) {
        if (registry.typeNameToTypeInfoMap_.has(typeName)) throw new Error('typeName ' + typeName + ' already registered');
      });
      typeInfo.categoryParts.forEach(function (categoryPart) {
        if (registry.categoryPartToTypeInfoMap_.has(categoryPart)) {
          throw new Error('categoryPart ' + categoryPart + ' already registered');
        }
      });

      var e = new tr.b.Event('will-register');
      e.typeInfo = typeInfo;
      registry.dispatchEvent(e);

      // Actual registration.
      typeInfo.typeNames.forEach(function (typeName) {
        registry.typeNameToTypeInfoMap_.set(typeName, typeInfo);
      });
      typeInfo.categoryParts.forEach(function (categoryPart) {
        registry.categoryPartToTypeInfoMap_.set(categoryPart, typeInfo);
      });
      registry.registeredTypeInfos_.push(typeInfo);

      var e = new tr.b.Event('registry-changed');
      registry.dispatchEvent(e);
    };

    registry.pushCleanStateBeforeTest = function () {
      savedStateStack.push({
        registeredTypeInfos: registry.registeredTypeInfos_,
        typeNameToTypeInfoMap: registry.typeNameToTypeInfoMap_,
        categoryPartToTypeInfoMap: registry.categoryPartToTypeInfoMap_
      });
      registry.registeredTypeInfos_ = [];
      registry.typeNameToTypeInfoMap_ = new Map();
      registry.categoryPartToTypeInfoMap_ = new Map();
      var e = new tr.b.Event('registry-changed');
      registry.dispatchEvent(e);
    };

    registry.popCleanStateAfterTest = function () {
      var state = savedStateStack[0];
      savedStateStack.splice(0, 1);

      registry.registeredTypeInfos_ = state.registeredTypeInfos;
      registry.typeNameToTypeInfoMap_ = state.typeNameToTypeInfoMap;
      registry.categoryPartToTypeInfoMap_ = state.categoryPartToTypeInfoMap;
      var e = new tr.b.Event('registry-changed');
      registry.dispatchEvent(e);
    };

    registry.unregister = function (constructor) {
      var typeInfoIndex = -1;
      for (var i = 0; i < registry.registeredTypeInfos_.length; i++) {
        if (registry.registeredTypeInfos_[i].constructor == constructor) {
          typeInfoIndex = i;
          break;
        }
      }
      if (typeInfoIndex === -1) throw new Error(constructor + ' not registered');

      var typeInfo = registry.registeredTypeInfos_[typeInfoIndex];
      registry.registeredTypeInfos_.splice(typeInfoIndex, 1);
      typeInfo.typeNames.forEach(function (typeName) {
        registry.typeNameToTypeInfoMap_.delete(typeName);
      });
      typeInfo.categoryParts.forEach(function (categoryPart) {
        registry.categoryPartToTypeInfoMap_.delete(categoryPart);
      });
      var e = new tr.b.Event('registry-changed');
      registry.dispatchEvent(e);
    };

    registry.getTypeInfo = function (category, typeName) {
      if (category) {
        var categoryParts = getCategoryParts(category);
        for (var i = 0; i < categoryParts.length; i++) {
          var categoryPart = categoryParts[i];
          var typeInfo = registry.categoryPartToTypeInfoMap_.get(categoryPart);
          if (typeInfo !== undefined) return typeInfo;
        }
      }
      var typeInfo = registry.typeNameToTypeInfoMap_.get(typeName);
      if (typeInfo !== undefined) return typeInfo;

      return extensionRegistryOptions.defaultTypeInfo;
    };

    // TODO(nduca): Remove or rename.
    registry.getConstructor = function (category, typeName) {
      var typeInfo = registry.getTypeInfo(category, typeName);
      if (typeInfo) return typeInfo.constructor;
      return undefined;
    };
  }

  return {
    _decorateTypeBasedExtensionRegistry: decorateTypeBasedExtensionRegistry
  };
});