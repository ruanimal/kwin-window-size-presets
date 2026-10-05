// SPDX-License-Identifier: MIT
//
// Window Size Presets — KWin 脚本扩展
//
// 在 KWin 的窗口菜单（Alt+F3 / 标题栏右键）里加入尺寸预设，
// 用来把窗口的内容区（client area）设为指定尺寸，例如 800×600。
//
// 条目出现在窗口菜单的「扩展」子菜单下：
//   group 非空（默认）：扩展 ▸ 窗口尺寸 ▸ 800 × 600
//   group 为空：        扩展 ▸ 800 × 600
//
// 配置写在 kwinrc 的 [Script-window-size-presets] 组里（改完执行
//   qdbus6 org.kde.KWin /KWin reconfigure
// 生效）：
//   sizes      逗号分隔的尺寸列表，默认 "800x600,1024x768,1280x720,1440x900,1600x900,1920x1080"
//   shortcuts  与 sizes 一一对应的全局快捷键（作用于活动窗口）；
//              留空或写 "none" 表示该条目不注册快捷键。默认 "Meta+Alt+1,Meta+Alt+2,Meta+Alt+3"
//   center     改尺寸时是否保持窗口中心不动，默认 true
//   group      子菜单标题；设为空字符串表示把尺寸平铺在「扩展」下
//
// 例：
//   kwriteconfig6 --file kwinrc --group Script-window-size-presets --key sizes "800x600,960x540,1920x1080"
//   qdbus6 org.kde.KWin /KWin reconfigure

const DEFAULT_SIZES = "800x600,1024x768,1280x720,1440x900,1600x900,1920x1080";
const DEFAULT_SHORTCUTS = "Meta+Alt+1,Meta+Alt+2,Meta+Alt+3";
const DEFAULT_GROUP = "窗口尺寸";

// 子菜单标题后面留的空格。Breeze 在**高亮那一项**时会把子菜单箭头画得离文字很近，
// 中文标题（如「窗口尺寸」）的最后一个字会被箭头压住；标题末尾的空格会撑开这一项，
// 把箭头挤到右边去（离屏复现 + 对比截图验证：10pt 微软雅黑下不加空格必压、
// 1 个空格勉强、2 个空格正常）。不想要这个 hack 就把 group 设为空字符串，
// 让尺寸平铺在「扩展」下 —— 平铺项是普通条目，没有箭头。
const SUBMENU_PADDING = "  ";

function parseSizes(spec) {
    const sizes = [];
    const parts = String(spec).split(",");
    for (let i = 0; i < parts.length; ++i) {
        const match = parts[i].trim().match(/^(\d+)\s*[x×*]\s*(\d+)$/);
        if (match) {
            sizes.push({
                width: parseInt(match[1], 10),
                height: parseInt(match[2], 10),
            });
        }
    }
    return sizes;
}

function parseShortcuts(spec, count) {
    const parts = String(spec).split(",");
    const shortcuts = [];
    for (let i = 0; i < count; ++i) {
        const value = i < parts.length ? parts[i].trim() : "";
        shortcuts.push(value === "none" ? "" : value);
    }
    return shortcuts;
}

const SIZES = parseSizes(readConfig("sizes", DEFAULT_SIZES));
const SHORTCUTS = parseShortcuts(readConfig("shortcuts", DEFAULT_SHORTCUTS), SIZES.length);
const KEEP_CENTER = String(readConfig("center", "true")) !== "false";
const GROUP = String(readConfig("group", DEFAULT_GROUP));

// 外框（含标题栏和边框）比内容区大出来的部分
function framePadding(window) {
    const frame = window.frameGeometry;
    const client = window.clientGeometry;
    if (!(client.width > 0) || !(client.height > 0)) {
        return { width: 0, height: 0 };
    }
    return {
        width: Math.max(0, frame.width - client.width),
        height: Math.max(0, frame.height - client.height),
    };
}

// callDBus 的回调在 D-Bus 回复到达时（也就是下一个事件循环）执行，用作 defer
function nextTick(callback) {
    callDBus("org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus", "GetId", callback);
}

// 把 window 的内容区设为 width × height
function setClientSize(window, width, height) {
    if (!window) {
        return;
    }

    const padding = framePadding(window);
    const targetWidth = Math.round(width + padding.width);
    const targetHeight = Math.round(height + padding.height);

    const apply = function () {
        const frame = window.frameGeometry;
        let x = Math.round(frame.x);
        let y = Math.round(frame.y);
        if (KEEP_CENTER) {
            x = Math.round(frame.x + (frame.width - targetWidth) / 2);
            y = Math.round(frame.y + (frame.height - targetHeight) / 2);
        }
        window.frameGeometry = {
            x: x,
            y: y,
            width: targetWidth,
            height: targetHeight,
        };
    };

    if (window.maximizeMode !== 0) {
        // 最大化时 KWin 会把尺寸改回最大化的大小，所以先还原再设置
        window.setMaximize(false, false);
        apply();
        nextTick(apply);
    } else {
        apply();
    }
}

function makeSizeItem(window, size) {
    return {
        text: size.width + " × " + size.height,
        triggered: function () {
            setClientSize(window, size.width, size.height);
        },
    };
}

// 分组形式：扩展 ▸ 窗口尺寸 ▸ 800 × 600
function buildSizeMenu(window) {
    const items = [];
    for (let i = 0; i < SIZES.length; ++i) {
        items.push(makeSizeItem(window, SIZES[i]));
    }
    return {
        text: GROUP + SUBMENU_PADDING,
        items: items,
    };
}

// 平铺形式：扩展 ▸ 800 × 600
function registerFlatMenus() {
    for (let i = 0; i < SIZES.length; ++i) {
        (function (size) {
            registerUserActionsMenu(function (window) {
                return makeSizeItem(window, size);
            });
        })(SIZES[i]);
    }
}

if (SIZES.length) {
    if (GROUP) {
        registerUserActionsMenu(buildSizeMenu);
    } else {
        registerFlatMenus();
    }
}

// 可选的全局快捷键（作用于当前活动窗口）
for (let i = 0; i < SIZES.length; ++i) {
    if (!SHORTCUTS[i]) {
        continue;
    }
    (function (size, sequence) {
        registerShortcut("WindowSizePresets-" + size.width + "x" + size.height,
                         "窗口尺寸 " + size.width + "×" + size.height,
                         sequence,
                         function () {
                             setClientSize(workspace.activeWindow, size.width, size.height);
                         });
    })(SIZES[i], SHORTCUTS[i]);
}
