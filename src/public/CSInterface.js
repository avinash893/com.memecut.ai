/**
 * CSInterface - v11.0.0
 * Adobe CEP (Common Extensibility Platform) Interface
 * https://github.com/Adobe-CEP/CEP-Resources
 * 
 * Copyright 2013 Adobe Systems Incorporated. All rights reserved.
 * Distributed under the Apache License v2.0 - http://www.apache.org/licenses/LICENSE-2.0
 *
 * This is the real CSInterface.js required by Adobe CEP panels.
 * It provides the bridge between the panel's JavaScript and the host application (Premiere Pro).
 */

var csVersion = new CSVersion(11, 0);

function CSVersion(major, minor) {
    this.major = major;
    this.minor = minor;
    this.toString = function () {
        return this.major + "." + this.minor;
    };
}

function SystemPath() {}
SystemPath.USER_DATA        = "userData";
SystemPath.COMMON_FILES     = "commonFiles";
SystemPath.MY_DOCUMENTS     = "myDocuments";
SystemPath.APPLICATION      = "application";
SystemPath.EXTENSION        = "extension";
SystemPath.HOST_APPLICATION = "hostApplication";

function ColorType() {}
ColorType.RGB   = "rgb";
ColorType.NONE  = "none";

function RGBColor(red, green, blue, alpha) {
    this.red   = red;
    this.green = green;
    this.blue  = blue;
    this.alpha = alpha;
}

function Direction(left, top, right, bottom) {
    this.left   = left;
    this.top    = top;
    this.right  = right;
    this.bottom = bottom;
}

function GradientStop(offset, rgbColor) {
    this.offset   = offset;
    this.rgbColor = rgbColor;
}

function GradientColor(type, direction, numStops, arrGradientStop) {
    this.type           = type;
    this.direction      = direction;
    this.numStops       = numStops;
    this.arrGradientStop = arrGradientStop;
}

function UIColor(type, antialiasLevel, color) {
    this.type           = type;
    this.antialiasLevel = antialiasLevel;
    this.color          = color;
}

function AppSkinInfo(baseFontFamily, baseFontSize, appBarBackgroundColor, panelBackgroundColor, appBarBackgroundColorSRGB, panelBackgroundColorSRGB, systemHighlightColor) {
    this.baseFontFamily              = baseFontFamily;
    this.baseFontSize                = baseFontSize;
    this.appBarBackgroundColor       = appBarBackgroundColor;
    this.panelBackgroundColor        = panelBackgroundColor;
    this.appBarBackgroundColorSRGB   = appBarBackgroundColorSRGB;
    this.panelBackgroundColorSRGB    = panelBackgroundColorSRGB;
    this.systemHighlightColor        = systemHighlightColor;
}

function HostEnvironment(appName, appVersion, appLocale, appUILocale, appId, isAppOffline, appSkinInfo) {
    this.appName     = appName;
    this.appVersion  = appVersion;
    this.appLocale   = appLocale;
    this.appUILocale = appUILocale;
    this.appId       = appId;
    this.isAppOffline = isAppOffline;
    this.appSkinInfo = appSkinInfo;
}

function HostCapabilities(EXTENDED_PANEL_MENU, EXTENDED_PANEL_ICONS, DELEGATE_APE_ENCODING, SUPPORT_HTML_EXTENSIONS, DISABLE_FLASH_PANEL) {
    this.EXTENDED_PANEL_MENU     = EXTENDED_PANEL_MENU;
    this.EXTENDED_PANEL_ICONS    = EXTENDED_PANEL_ICONS;
    this.DELEGATE_APE_ENCODING   = DELEGATE_APE_ENCODING;
    this.SUPPORT_HTML_EXTENSIONS = SUPPORT_HTML_EXTENSIONS;
    this.DISABLE_FLASH_PANEL     = DISABLE_FLASH_PANEL;
}

function ApiVersion(major, minor, micro) {
    this.major = major;
    this.minor = minor;
    this.micro = micro;
    this.toString = function () {
        return this.major + "." + this.minor + "." + this.micro;
    };
}

function MenuItemStatus(displayName, enabled, checked) {
    this.displayName = displayName;
    this.enabled     = enabled;
    this.checked     = checked;
}

function ContextMenuItemStatus(displayName, enabled, checked, id) {
    this.displayName = displayName;
    this.enabled     = enabled;
    this.checked     = checked;
    this.id          = id;
}

/** CSEvent */
function CSEvent(type, scope, appId, extensionId) {
    this.type        = type;
    this.scope       = scope;
    this.appId       = appId;
    this.extensionId = extensionId;
}
CSEvent.prototype.data = "";

/** CSInterface */
function CSInterface() {
    this.hostEnvironment = this.getHostEnvironment();
}

CSInterface.GLOBAL    = "GLOBAL";
CSInterface.APPLICATION = "APPLICATION";

CSInterface.prototype.getHostEnvironment = function () {
    return JSON.parse(window.__adobe_cep__.getHostEnvironment());
};

CSInterface.prototype.closeExtension = function () {
    window.__adobe_cep__.closeExtension();
};

CSInterface.prototype.getSystemPath = function (pathType) {
    var path = decodeURIComponent(window.__adobe_cep__.getSystemPath(pathType));
    var OSVersion = this.getOSInformation();
    if (OSVersion.indexOf("Windows") >= 0) {
        path = path.replace("file:///", "").split("/").join("\\");
    } else if (OSVersion.indexOf("Mac") >= 0) {
        path = path.replace("file://", "");
    }
    return path;
};

CSInterface.prototype.evalScript = function (script, callback) {
    if (!callback || typeof callback !== "function") {
        callback = function (result) {};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

CSInterface.prototype.getApplicationID = function () {
    var id = this.hostEnvironment.appId;
    return id;
};

CSInterface.prototype.getHostCapabilities = function () {
    var cap = JSON.parse(window.__adobe_cep__.getHostCapabilities());
    return cap;
};

CSInterface.prototype.dispatchEvent = function (event) {
    if (typeof event.data === "object") {
        event.data = JSON.stringify(event.data);
    }
    window.__adobe_cep__.dispatchEvent(JSON.stringify(event));
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
    window.__adobe_cep__.addEventListener(type, listener.toString(), obj);
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    window.__adobe_cep__.removeEventListener(type, listener.toString(), obj);
};

CSInterface.prototype.showPanel = function (extensionId) {
    window.__adobe_cep__.requestOpenExtension(extensionId, "");
};

CSInterface.prototype.getExtensions = function (extensionIds) {
    var extensionIdsStr = JSON.stringify(extensionIds);
    var extensionsStr   = window.__adobe_cep__.getExtensions(extensionIdsStr);
    return JSON.parse(extensionsStr);
};

CSInterface.prototype.getNetworkPreferences = function () {
    var result = window.__adobe_cep__.getNetworkPreferences();
    return JSON.parse(result);
};

CSInterface.prototype.initResourceBundle = function () {
    var resourceBundle = window.__adobe_cep__.initResourceBundle();
    return JSON.parse(resourceBundle);
};

CSInterface.prototype.dumpInstallationInfo = function () {
    return window.__adobe_cep__.dumpInstallationInfo();
};

CSInterface.prototype.getOSInformation = function () {
    var userAgent = navigator.userAgent;
    if (userAgent.indexOf("Windows") >= 0) {
        if (userAgent.indexOf("Windows NT 5.0") >= 0)       return "Windows 2000";
        else if (userAgent.indexOf("Windows NT 5.1") >= 0)  return "Windows XP";
        else if (userAgent.indexOf("Windows NT 5.2") >= 0)  return "Windows Server 2003";
        else if (userAgent.indexOf("Windows NT 6.0") >= 0)  return "Windows Vista";
        else if (userAgent.indexOf("Windows NT 6.1") >= 0)  return "Windows 7";
        else if (userAgent.indexOf("Windows NT 6.2") >= 0)  return "Windows 8";
        else if (userAgent.indexOf("Windows NT 10") >= 0)   return "Windows 10";
        else                                                 return "Windows";
    } else if (userAgent.indexOf("Mac") >= 0) {
        if (userAgent.indexOf("Mac OS X 10_5") >= 0 || userAgent.indexOf("Mac OS X 10.5") >= 0) return "Mac OS X 10.5";
        else if (userAgent.indexOf("Mac OS X 10_6") >= 0 || userAgent.indexOf("Mac OS X 10.6") >= 0) return "Mac OS X 10.6";
        else if (userAgent.indexOf("Mac OS X 10_7") >= 0 || userAgent.indexOf("Mac OS X 10.7") >= 0) return "Mac OS X 10.7";
        else if (userAgent.indexOf("Mac OS X 10_8") >= 0 || userAgent.indexOf("Mac OS X 10.8") >= 0) return "Mac OS X 10.8";
        else if (userAgent.indexOf("Mac OS X 10_9") >= 0 || userAgent.indexOf("Mac OS X 10.9") >= 0) return "Mac OS X 10.9";
        else if (userAgent.indexOf("Mac OS X 10_10") >= 0 || userAgent.indexOf("Mac OS X 10.10") >= 0) return "Mac OS X 10.10";
        else if (userAgent.indexOf("Mac OS X 10_11") >= 0 || userAgent.indexOf("Mac OS X 10.11") >= 0) return "Mac OS X 10.11";
        else if (userAgent.indexOf("Mac OS X 10_12") >= 0 || userAgent.indexOf("Mac OS X 10.12") >= 0) return "macOS Sierra";
        else if (userAgent.indexOf("Mac OS X 10_13") >= 0 || userAgent.indexOf("Mac OS X 10.13") >= 0) return "macOS High Sierra";
        else if (userAgent.indexOf("Mac OS X 10_14") >= 0 || userAgent.indexOf("Mac OS X 10.14") >= 0) return "macOS Mojave";
        else if (userAgent.indexOf("Mac OS X 10_15") >= 0 || userAgent.indexOf("Mac OS X 10.15") >= 0) return "macOS Catalina";
        else                                                 return "Mac OS X";
    }
    return "Unknown";
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    window.cep.util.openURLInDefaultBrowser(url);
};

CSInterface.prototype.getExtensionID = function () {
    return window.__adobe_cep__.getExtensionId();
};

CSInterface.prototype.getScaleFactor = function () {
    return window.devicePixelRatio;
};

CSInterface.prototype.setScaleFactorChangedHandler = function (handler) {
    window.addEventListener("devicePixelRatioChangedEvent", handler);
};

CSInterface.prototype.getCurrentApiVersion = function () {
    var apiVersion = JSON.parse(window.__adobe_cep__.getCurrentApiVersion());
    return apiVersion;
};

CSInterface.prototype.setPanelFlyoutMenu = function (menu) {
    if ("string" !== typeof menu) {
        return;
    }
    window.__adobe_cep__.invokeAsync("setPanelFlyoutMenu", menu);
};

CSInterface.prototype.updatePanelMenuItem = function (menuItemLabel, enabled, checked) {
    var resultId = 0;
    if (csVersion.major >= 4) {
        var itemStatus = new MenuItemStatus(menuItemLabel, enabled, checked);
        resultId = window.__adobe_cep__.invokeSync("updatePanelMenuItem", JSON.stringify(itemStatus));
    }
    return resultId;
};

CSInterface.prototype.setContextMenu = function (menu, callback) {
    if ("string" !== typeof menu) {
        return;
    }
    window.__adobe_cep__.invokeAsync("setContextMenu", menu, callback);
};

CSInterface.prototype.setContextMenuByJSON = function (menu, callback) {
    if ("string" !== typeof menu) {
        return;
    }
    window.__adobe_cep__.invokeAsync("setContextMenuByJSON", menu, callback);
};

CSInterface.prototype.updateContextMenuItem = function (id, enabled, checked) {
    var itemStatus = new ContextMenuItemStatus(id, enabled, checked);
    resultId = window.__adobe_cep__.invokeSync("updateContextMenuItem", JSON.stringify(itemStatus));
    return resultId;
};

CSInterface.prototype.isWindowVisible = function () {
    return window.__adobe_cep__.isWindowVisible();
};

CSInterface.prototype.resizeContent = function (width, height) {
    window.__adobe_cep__.resizeContent(width, height);
};

CSInterface.prototype.registerInvalidCertificateCallback = function (callback) {
    return window.__adobe_cep__.registerInvalidCertificateCallback(callback);
};

CSInterface.prototype.registerPlayerInfoChangeCallback = function (callback) {
    window.__adobe_cep__.registerPlayerInfoChangeCallback(callback);
};

CSInterface.prototype.unregisterPlayerInfoChangeCallback = function () {
    window.__adobe_cep__.unregisterPlayerInfoChangeCallback();
};

CSInterface.prototype.getPlayerInfo = function () {
    var playerInfo = JSON.parse(window.__adobe_cep__.getPlayerInfo());
    return playerInfo;
};
