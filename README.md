# Window Size Presets（窗口尺寸预设）

一个 KWin 脚本扩展（KDE KPackage，`KWin/Script` 类型）：在 KWin 的**窗口菜单**
（`Alt+F3` 或**标题栏右键**）里加入尺寸预设，把窗口的内容区一键设为 `800×600` 等尺寸。

```
标题栏右键 / Alt+F3
└── 扩展 (Extensions)
    └── 窗口尺寸
        ├── 800 × 600        ← Meta+Alt+1
        ├── 1024 × 768       ← Meta+Alt+2
        ├── 1280 × 720       ← Meta+Alt+3
        ├── 1440 × 900
        ├── 1600 × 900
        └── 1920 × 1080
```

尺寸按**内容区（client area）**计算：例如选 800×600，KWin 读到的外框是 800×(600+标题栏高度)，
所以窗口里真正能画东西的区域正好是 800×600。窗口中心保持不变；如果窗口当时是最大化状态，
会先取消最大化再设尺寸。

## 安装（用户级，不需要 root）

```bash
kpackagetool6 --type KWin/Script -i /path/to/kwin-window-size-presets
kwriteconfig6 --file kwinrc --group Plugins --key window-size-presetsEnabled true
qdbus6 org.kde.KWin /KWin reconfigure
```

也可以装完在 **系统设置 → 窗口管理 → KWin 脚本** 里勾选「Window Size Presets / 窗口尺寸预设」。

验证已加载：

```bash
qdbus6 org.kde.KWin /Scripting org.kde.kwin.Scripting.isScriptLoaded window-size-presets   # -> true
```

## 配置

配置在 `kwinrc` 的 `[Script-window-size-presets]` 组，改完执行 `qdbus6 org.kde.KWin /KWin reconfigure` 生效。

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `sizes` | `800x600,1024x768,1280x720,1440x900,1600x900,1920x1080` | 逗号分隔的尺寸列表，`x`/`×`/`*` 都行 |
| `shortcuts` | `Meta+Alt+1,Meta+Alt+2,Meta+Alt+3` | 与 `sizes` 一一对应的全局快捷键（作用于当前活动窗口）；留空或写 `none` 表示不注册 |
| `center` | `true` | 改尺寸时是否保持窗口中心不动 |
| `group` | `窗口尺寸` | 子菜单标题；设为空字符串则把尺寸平铺在「扩展」下 |

例：只保留三个尺寸、并且不要快捷键

```bash
kwriteconfig6 --file kwinrc --group Script-window-size-presets --key sizes "800x600,1280x720,2560x1440"
kwriteconfig6 --file kwinrc --group Script-window-size-presets --key shortcuts ""
qdbus6 org.kde.KWin /KWin reconfigure
```

快捷键可以在 **系统设置 → 快捷键 → KWin → 窗口尺寸 …** 里改。

## 卸载

```bash
kpackagetool6 --type KWin/Script -r window-size-presets
qdbus6 org.kde.KWin /KWin reconfigure
```

（如果之前手动写过 `[Plugins] window-size-presetsEnabled`，可用
`kwriteconfig6 --file kwinrc --group Plugins --key window-size-presetsEnabled --delete` 删掉。）

## 已知限制

- 条目位置固定在窗口菜单的**「扩展」子菜单**里 —— 这是 KWin 脚本扩展 API 的唯一入口
  （`registerUserActionsMenu`，见 `kwin/src/useractions.cpp`），脚本无法把条目插到「移动/调整大小」那一层。
- 子菜单标题「窗口尺寸」后面**故意带了两个尾随空格**：Breeze 在鼠标悬停（高亮）那一项时会把
  子菜单箭头画得离文字很近，中文标题的最后一个字会被箭头压住（离屏复现过：10pt 微软雅黑下不加空格必压，
  加 1 个空格勉强，2 个空格正常，对比图见 [docs/submenu-arrow-spacing.png](docs/submenu-arrow-spacing.png)，
  复现程序见 [docs/arrow-spacing-repro.cpp](docs/arrow-spacing-repro.cpp)）。不想要这个 hack 就把
  `group` 设为空字符串，让尺寸平铺在「扩展」下——平铺项是普通条目，没有箭头可用。
- **任务栏应用按钮右键菜单无法用扩展方式加入条目**：那个菜单是 Plasma 的
  `org.kde.plasma.taskmanager` 小组件的 `ContextMenu.qml` 硬编码实现的（QML 被编译进
  `org.kde.plasma.taskmanager.so`），没有对外扩展点；要加只能改 plasma-desktop 源码重新编译。
  作为补偿，本扩展注册了全局快捷键，任何位置都能用。
- 全局快捷键只作用于**当前活动窗口**；窗口菜单里的条目作用于**被点击的那个窗口**。
- 只对普通窗口有效：面板、桌面、输入法等特殊窗口不接受改尺寸。

## 实现备注（给将来改代码的人）

- 子菜单标题尾部的 `SUBMENU_PADDING = "  "` 是给 Breeze 的箭头间距打的补丁，原因见上面「已知限制」。
- `Qt` 对象在 KWin 的 JS 脚本引擎里**不存在**（那是 QML 才有的），所以不能用 `Qt.rect(...)`；
  但 `window.frameGeometry = { x, y, width, height }` 这种普通对象赋值是可以被接受的，
  对应 `Window::moveResize()`。
- 从 KWin 读出来的几何对象**不要存起来以后再写回**（它和 C++ 侧的 `RectF` 有联动，
  写回等于写当前值）。每次都重新读 `frameGeometry` 并新建对象字面量。
- 最大化状态下直接写 `frameGeometry` 会被最大化状态盖掉，所以要
  `setMaximize(false, false)` 之后再设；`setMaximize` 的效果不在同一个 tick 生效，
  因此用 `callDBus(..., callback)` 把设置推迟到下一个事件循环再执行一次。
- 注册窗口菜单条目时，KWin 读的键是 **`text`**，而官方文档（`documentation-global.xml`）写的是
  `title`；写 `title` 会被静默忽略（5.27 → master 的实现都是 `text`）。
