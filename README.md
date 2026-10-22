# General_Map

**v1.4.1** · **JLYANG1900**

[中文](#中文-chinese) | [English](#english)

![General Map New UI](https://i.ibb.co/sf3xbYC/General-Map-New-UI.png)

---

## 中文 Chinese

**General_Map** 是为 SillyTavern（酒馆）设计的互动地图扩展，支持多层地图、地标编辑、建筑楼层、角色头像追踪和出行内容生成。地图与追踪配置保存在本地浏览器中，可通过 JSON 备份迁移。

> 更新插件前，请先导出备份。

### 新功能：角色追踪

自定义想要追踪的角色，插件会读取角色的位置，并将头像显示在匹配的地标坐标上。

- **自定义名单**：添加、编辑、暂停或删除角色，支持角色别名。名单按当前角色或群聊及聊天记录分别保存。
- **头像来源**：上传本地图片、填写图片地址，或自动使用唯一匹配的同名/别名 ST 角色卡头像；没有可用头像时显示姓名首字。
- **多种位置来源**：支持消息变量（含 MVU）、聊天变量、明确选择的全局变量，以及手动填写地点。
- **地标匹配**：根据地标名称、别名和建筑内部区域名称定位；角色位于其他地图时，可以从列表跳转查看。
- **同地点合并**：最多并列显示三个头像，多出的角色以数量入口显示，完整名单仍在追踪面板中。
- **状态反馈**：位置未知、未匹配地标或匹配存在歧义时显示提示，不会把头像随意放到其他地点。
- **自动刷新**：监听聊天、消息和 MVU 更新事件；地图面板可见时，每两秒补充检查一次位置。

**此功能不调用 LLM，也不会直接从聊天正文推测位置。** 自动追踪需要角色卡或相关脚本提供结构化位置变量；没有变量时，可以使用手动位置。

#### 使用步骤

1. 打开一段酒馆聊天，进入地图，点击 **角色追踪 → 添加角色**。
2. 输入角色名。变量中的名字不同时，添加角色别名，例如显示名“埃莉诺”、别名“埃莉诺·诺曼”。多个别名可用顿号、逗号或换行分隔。
3. 选择位置来源，按需填写位置变量路径，或选择“手动位置”直接填写地点。
4. 上传头像或填写头像地址；留空时尝试匹配 ST 角色卡头像。
5. 按需限定“匹配地图”，然后保存。
6. 查看列表中的地点、变量来源和匹配状态。点击头像或列表中的定位按钮可查看对应地标。

| 位置来源 | 行为 |
| --- | --- |
| 自动（消息优先） | 优先读取当前聊天最近的非空消息变量快照；没有消息快照时读取聊天变量，不自动读取全局变量。 |
| 消息变量 / MVU | 从当前聊天的消息变量中读取位置。 |
| 聊天变量 | 从当前聊天的变量中读取位置。 |
| 全局变量 | 仅在明确选择此来源时读取全局变量。 |
| 手动位置 | 使用填写的地点名称，不读取位置变量。 |

#### 变量与地点匹配

自动识别支持 `stat_data` 下的 `主要角色`、`重要角色`、`当前角色`、`MainCharacters`、`characters`、`npc`，也支持不带 `stat_data` 的对应结构。位置字段支持 `位置`、`当前地点`、`地点`、`location`。

例如，地图中已有“私人别墅”地标时，下面的变量可将关祁定位到该地标：

```json
{
  "stat_data": {
    "主要角色": {
      "关祁": {
        "位置": "私人别墅"
      }
    }
  }
}
```

非标准结构可以指定完整路径，例如 `stat_data.主要角色.关祁.位置` 或 `npc.关祁.location`。支持 STscript 的字面量点号键；名字包含英文句点时，可使用 JSON 路径数组，例如 `["stat_data","characters","Dr. Smith","location"]`。

- 在编辑模式下打开地标详情，可以设置“地点别名”。
- 优先匹配完整名称或别名，其次匹配地点文本中最长的名称。相同优先级匹配多个地标时显示“待确认”，可通过限定地图或补充别名消除歧义。
- 建筑楼层或内部区域匹配到所属建筑的地图坐标，不是室内独立坐标；传送门和“其他地点”这类自定义出行入口不作为角色所在地。
- 拖动地标后，头像在拖动结束时跟随更新。
- 按当前选中的回复分支读取变量。当前消息没有变量时使用更早的消息快照，并显示来源楼层（从 `#0` 开始）；不会读取同一消息的其他回复分支。
- 最新有效快照中已删除的角色不会从旧快照中重新出现。自动模式优先选定消息快照，不会因为其中缺少某个角色就自动改读聊天变量。

### 新 UI：Material 风格界面

新界面借鉴 Material Design 3、Material You 和 Google 产品的视觉风格，保留原有地图操作与数据格式。

- **浅色界面**：无衬线字体、胶囊按钮、柔和阴影、局部半透明效果，统一工具栏、地标详情、楼层、出行菜单和角色追踪表单。
- **自适应配色**：根据主题色生成浅色底和可读的强调色，默认蓝色为 `#0b57d0`；已保存的主题色会沿用。主题按钮与强调色文字采用对比度处理，不会覆盖自定义地标颜色。
- **响应式布局**：宽屏打开角色追踪时，名单显示在地图右侧；手机和平板采用上下布局，手机端地图面板全屏显示。
- **清晰的操作反馈**：图标按钮带名称提示，支持键盘焦点反馈和系统“减少动态效果”设置。
- **保留悬浮入口**：入口仍可拖动，默认半透明；手机上打开地图后，入口不会遮挡面板控件。
- **作者署名**：顶部显示“插件作者：JLYANG1900”，窄屏自动换行。
- **无需额外 UI 框架**：不请求外部字体，继续使用插件自身的样式与矢量图标。

文件操作按钮的顺序与含义如下：

| 图标 | 功能 |
| --- | --- |
| 下载箭头 | **导出备份**：下载包含全部地图、追踪配置和已上传图片的 JSON 文件。 |
| 上传箭头 | **导入备份**：选择 JSON 文件，确认后替换当前地图库及备份中的追踪配置。 |
| 文件夹 | **更换背景**：选择图片，仅替换当前地图的背景。 |

### 其他功能

- **多层地图与传送门**：通过传送门在城市、世界地图及更多层级间跳转，支持返回上一层。
- **自由编辑地标**：开启编辑模式后拖动地标，修改名称、描述、长篇地点介绍、别名、文字颜色和背景颜色。
- **建筑与楼层**：将地标设置为复合建筑，上传封面和内部示意图，添加或删除楼层及区域。
- **出行内容生成**：选择目的地、同行角色、要遇见的 NPC 和活动，将生成的内容填入酒馆输入框，不会自动发送消息。
- **本地保存与备份**：地图和追踪配置保存到 IndexedDB，支持 JSON 导入导出，并兼容旧版 V1/V2 地图数据。

### 安装与更新

#### 自动安装

1. 在 SillyTavern 中打开扩展菜单，选择安装扩展。
2. 输入仓库地址：`https://github.com/JLYANG1900/General_Map`。
3. 安装后刷新页面，并在扩展列表中启用插件。

#### 手动安装

将运行文件放入 `SillyTavern/public/scripts/extensions/third-party/General_Map/`。如果下载的源码中包含“正式版”目录，使用该目录内的运行文件，确保安装后的结构为：

```text
General_Map/
    index.js
    tracking.js
    style.css
    map.html
    manifest.json
```

刷新酒馆页面后启用扩展。更新前先导出备份，并同时替换上面的五个运行文件；请勿遗漏新增的 `tracking.js`。

### 基础操作

1. 点击酒馆界面的地图入口打开面板；拖动入口可调整其位置，主面板本身保持固定。
2. 使用“地图工具”右侧的折叠按钮展开或收起工具栏。
3. 点击地标查看详情；传送门可切换地图，“前往此处”打开出行菜单。
4. 开启“编辑模式”，点击“新增地点”，或拖动已有地标调整位置。
5. 在详情中直接编辑文字、上传图片，或切换地点类型：普通地点、复合建筑、传送门。
6. 定期使用下载箭头导出备份；背景与主题色可通过工具栏单独调整。

### 数据与兼容性说明

- 地图库仍由同一浏览器中的聊天共享；**角色追踪名单按聊天隔离**。新聊天需要重新添加角色，重命名聊天也可能使用新的配置标识。
- 追踪配置和上传头像包含在地图备份中，实时位置则从当前聊天重新读取。自定义主题色属于独立的浏览器设置，不包含在地图库 JSON 中。
- 导入备份会替换现有地图库及备份中的追踪配置，不是合并操作。请先导出现有数据。
- 清理浏览器站点数据可能删除本地地图和配置，请保留备份文件。
- 优先使用酒馆助手的 `TavernHelper.getVariables()`；未安装酒馆助手时，尝试读取 ST 当前上下文中的消息和聊天变量。不扫描其他聊天，不写入剧情变量。
- 本次 UI 更新不重置地图、不改变保存的地标坐标，也不覆盖地标的自定义文字或背景颜色。

### 更新记录

#### v1.4.1

- 更新为 Material 风格浅色 UI，加入自适应主题配色、宽屏追踪侧栏及顶部作者署名。
- 改进手机布局、图标提示、键盘焦点和减少动态效果支持，移除外部字体请求。
- 统一导出/导入箭头含义，修复背景保存失败后仍显示新图的问题，补充损坏图片的错误提示。
- 增加文件按钮、备份往返与取消、背景持久化与失败回退、长标题及桌面/手机布局回归测试。

#### v1.4.0

- 新增角色追踪、头像上传、变量读取、地标别名、跨地图定位和未知位置提示。
- 修复回复分支误读、聊天切换后追踪状态残留、无效导入和存储失败处理。
- 修复图片字段转义、异步上传写错地图、旧弹窗修改新地图、出行文本被误解析为命令等问题。
- 将 CSS 与主题变量限定在插件范围内，避免影响酒馆原有控件。

#### v1.3.0

- 新增可拖动、半透明的悬浮入口，固定主面板位置，支持折叠工具栏。
- 新增地点介绍及独立的地标文字、背景颜色，统一矢量图标。
- 修复主题色影响地标文字、地图重绘后拖拽监听残留及动态事件参数转义问题。

### 开发与验证

| 文件 | 职责 |
| --- | --- |
| `index.js` | 地图数据、IndexedDB、备份、图片处理与交互。 |
| `tracking.js` | 角色追踪、变量读取、地点匹配与头像显示。 |
| `style.css` | Material 风格 UI、弹窗和响应式布局。 |
| `map.html` | 工具栏、追踪表单及弹窗结构。 |
| `manifest.json` | 插件元数据。 |

从包含 `tests/` 的项目根目录运行：

```sh
node --test tests/tracking.test.cjs
node tests/browser-smoke.cjs
```

第一条命令无需酒馆或浏览器。浏览器回归需要可解析的 `playwright` 包、Google Chrome，以及 `ST_ROOT` 指向本机 SillyTavern（默认 `~/SillyTavern`，仅使用其 jQuery 文件）。测试使用独立浏览器上下文和模拟聊天，本地临时服务在结束后关闭；截图输出到 `GM_TEST_OUTPUT`，默认 `/private/tmp/general-map-tests`。

接口参考：[SillyTavern 扩展开发文档](https://docs.sillytavern.app/for-contributors/writing-extensions/) · [酒馆助手变量接口](https://github.com/n0vi028/js-slash-runner/blob/main/src/function/variables.ts)。

[中文](#中文-chinese) | [English](#english)

---

## English

**General_Map** is an interactive map extension for SillyTavern. It supports nested maps, editable landmarks, building floors, character-avatar tracking, and travel prompts. Maps and tracking profiles are stored in your browser and can be transferred through JSON backups.

> Export a backup before updating. 

### New Feature: Character Tracking

Choose the characters you want to follow. The extension reads their locations and places their avatars at the coordinates of matching landmarks.

- **Custom watchlist**: Add, edit, pause, or remove characters and define aliases. Profiles are stored separately for the current character or group and chat.
- **Avatar options**: Upload an image, enter an image URL, or use a uniquely matched ST character-card avatar by name or alias. If no usable image is available, the first character of the name is shown.
- **Multiple location sources**: Read message variables, including MVU data, chat variables, explicitly selected global variables, or a manually entered location.
- **Landmark matching**: Match names, aliases, and building-area names. Characters on another map can be located through the tracking list.
- **Shared locations**: Show up to three avatars together, with a count button for additional characters. The full list remains available in the tracking panel.
- **Clear status**: Unknown, unmatched, or ambiguous locations stay in the list instead of placing an avatar at an arbitrary landmark.
- **Automatic updates**: Listen for chat, message, and MVU events, with an additional location check every two seconds while the map panel is visible.

**Tracking does not call an LLM or infer locations from chat prose.** Automatic tracking requires structured location variables supplied by a character card or script. Manual locations work without those variables.

#### Getting Started

1. Open a SillyTavern chat, open the map, and select **Character Tracking → Add Character**.
2. Enter a name and any aliases used in the variables. Separate aliases with commas, Chinese enumeration commas, or line breaks.
3. Choose a location source. Specify a variable path when needed, or select **Manual Location** and enter a place name.
4. Upload an avatar or enter an image URL. Leave it blank to try matching an ST character-card avatar.
5. Optionally limit matching to a specific map, then save.
6. Check the location, variable source, and matching status in the list. Click an avatar or the locate button to view its landmark.

| Location Source | Behavior |
| --- | --- |
| Auto, message first | Use the latest non-empty message-variable snapshot in the current chat. Fall back to chat variables only when no message snapshot exists. Never select global variables automatically. |
| Message variables / MVU | Read locations from the current chat's message variables. |
| Chat variables | Read locations from the current chat's variables. |
| Global variables | Read global variables only when this source is explicitly selected. |
| Manual location | Use the entered place name without reading location variables. |

#### Variables and Matching

Automatic detection supports `主要角色`, `重要角色`, `当前角色`, `MainCharacters`, `characters`, and `npc`, either inside `stat_data` or directly at the root. Supported location fields are `位置`, `当前地点`, `地点`, and `location`.

For example, if your map contains a landmark named **Library**, these variables can place Alice there:

```json
{
  "stat_data": {
    "characters": {
      "Alice": {
        "location": "Library"
      }
    }
  }
}
```

For other structures, enter a full path such as `stat_data.characters.Alice.location` or `npc.Alice.location`. Literal dotted STscript keys are supported. For names containing periods, use a JSON path array, such as `["stat_data","characters","Dr. Smith","location"]`.

- Open a landmark in edit mode to set its aliases.
- Exact names and aliases take priority, followed by the longest matching name within the location text. Equally ranked matches are marked as ambiguous; restrict the map or add more specific aliases to resolve them.
- A floor or internal area resolves to its parent building's map coordinates, not an independent indoor position. Portals and custom travel entries such as “Other Places” are excluded from character-location matching.
- Avatars follow a landmark after its drag operation ends.
- Variables follow the currently selected reply branch. If that message has no variables, an earlier snapshot may be used, with its source message shown from `#0`. Other branches of the same message are not read.
- Characters removed from the latest authoritative snapshot are not revived from older snapshots. Auto mode does not switch to chat variables merely because a character is absent from the selected message snapshot.

### New UI: Material-Inspired Design

The refreshed interface takes visual inspiration from Material Design 3, Material You, and Google product interfaces while preserving existing map operations and data formats.

- **Light surfaces**: Sans-serif typography, pill-shaped buttons, soft shadows, and selective translucency unify the toolbar, landmark details, floors, travel menu, and tracking forms.
- **Adaptive colors**: Generate light surfaces and readable accents from the selected theme color. The default is blue `#0b57d0`; existing saved colors are preserved. Contrast adjustments for theme buttons and accent text do not overwrite custom pin colors.
- **Responsive layout**: On wide screens, the open tracking panel sits beside the map. Phones and tablets use a stacked layout; the map panel fills the screen on phones.
- **Interaction feedback**: Named icon tooltips, visible keyboard focus, and support for the system's reduced-motion preference.
- **Draggable entry**: The semi-transparent floating entry remains movable. It stays behind the open map panel on phones instead of covering its controls.
- **Author credit**: The header displays the author credit for JLYANG1900 and wraps it onto a second line on small screens.
- **No extra UI framework**: Uses the extension's own styles and vector icons without requesting external fonts.

The file controls appear in this order:

| Icon | Action |
| --- | --- |
| Download arrow | **Export Backup**: Download a JSON file containing all maps, tracking profiles, and uploaded images. |
| Upload arrow | **Import Backup**: Select a JSON file and confirm replacement of the current map library and tracking profiles. |
| Folder | **Change Background**: Select an image for the current map only. |

### Other Features

- **Nested maps and portals**: Navigate between cities, world maps, and additional levels, with a return-to-previous-map action.
- **Editable landmarks**: Drag pins in edit mode and customize names, descriptions, long-form introductions, aliases, text colors, and background colors.
- **Buildings and floors**: Use complex-building landmarks with cover images, internal diagrams, and editable floors or areas.
- **Travel prompts**: Choose a destination, companion, NPC to meet, and activity. Generated text is placed in the SillyTavern input without sending a message automatically.
- **Local storage and backups**: Save maps and tracking profiles in IndexedDB, export and import JSON backups, and import legacy V1/V2 map data.

### Installation and Updates

#### Automatic Installation

1. Open SillyTavern's Extensions menu and select the extension-installation action.
2. Enter the repository URL: `https://github.com/JLYANG1900/General_Map`.
3. Reload the page after installation and enable the extension.

#### Manual Installation

Place the runtime files in `SillyTavern/public/scripts/extensions/third-party/General_Map/`. If the downloaded source includes a `正式版` directory, use the runtime files inside it. The installed layout should be:

```text
General_Map/
    index.js
    tracking.js
    style.css
    map.html
    manifest.json
```

Reload SillyTavern and enable the extension. Before updating, export a backup and replace all five runtime files together. Do not omit `tracking.js`.

### Basic Usage

1. Click the floating map entry to open the panel. Drag the entry to reposition it; the main panel stays fixed.
2. Use the collapse button beside the map-tools heading to show or hide the toolbar.
3. Click a landmark for details. Portals switch maps, and **Travel Here** opens the travel menu.
4. Enable edit mode to add landmarks or drag existing pins.
5. Edit text directly in the detail view, upload images, or choose a landmark type: simple location, complex building, or portal.
6. Export backups regularly with the download-arrow button. Background and theme-color controls are available separately in the toolbar.

### Data and Compatibility

- The map library remains shared across chats in the same browser. **Tracking profiles are isolated by chat.** New chats need their own watchlist; renaming a chat may also change its profile identifier.
- Backups include tracking settings and uploaded avatars. Live locations are read again from the current chat. The custom theme color is a separate browser setting and is not included in the map-library JSON.
- Import replaces the existing map library and tracking profiles rather than merging them. Export your current data first.
- Clearing browser site data can remove maps and settings. Keep backup files outside browser storage.
- The extension prefers Tavern Helper's `TavernHelper.getVariables()`. Without it, the extension attempts to read message and chat variables from the current ST context. It does not scan other chats or write story variables.
- The UI refresh does not reset maps, change saved landmark coordinates, or overwrite custom pin text and background colors.

### Changelog

#### v1.4.1

- Introduced the Material-inspired light UI, adaptive theme colors, wide-screen tracking sidebar, and header author credit.
- Improved mobile layouts, icon tooltips, keyboard focus, and reduced-motion support; removed external font requests.
- Clarified export/import arrow meanings, restored the previous background after a failed save, and added clearer corrupt-image errors.
- Added regression coverage for file buttons, backup round-trips and cancellation, background persistence and rollback, long titles, and desktop/mobile layouts.

#### v1.4.0

- Added character tracking, avatar uploads, variable readers, landmark aliases, cross-map navigation, and unknown-location status.
- Fixed reply-branch selection, stale tracking state after chat changes, invalid imports, and storage-failure handling.
- Fixed image-field escaping, uploads targeting the wrong map, stale popups editing a different map, and travel text being interpreted as extra commands.
- Scoped CSS and theme variables to the extension to avoid affecting SillyTavern controls.

#### v1.3.0

- Added a draggable, semi-transparent entry, a fixed main panel, and collapsible controls.
- Added location introductions, independent pin text/background colors, and consistent vector icons.
- Fixed theme colors affecting pin labels, stale drag listeners after rendering, and inline-event argument escaping.

### Development and Verification

| File | Responsibility |
| --- | --- |
| `index.js` | Map data, IndexedDB, backups, image handling, and interactions. |
| `tracking.js` | Character tracking, variable readers, location matching, and avatar overlays. |
| `style.css` | Material-inspired UI, dialogs, and responsive layouts. |
| `map.html` | Toolbar, tracking forms, and dialog structure. |
| `manifest.json` | Extension metadata. |

Run from the project root containing `tests/`:

```sh
node --test tests/tracking.test.cjs
node tests/browser-smoke.cjs
```

The first command does not require SillyTavern or a browser. Browser regression tests require a resolvable `playwright` package, Google Chrome, and `ST_ROOT` pointing to a local SillyTavern installation. The default is `~/SillyTavern`; only its jQuery file is used. Tests run with an isolated browser context and mock chats, and close the temporary local server on completion. Screenshots go to `GM_TEST_OUTPUT`, defaulting to `/private/tmp/general-map-tests`.

API references: [SillyTavern extension documentation](https://docs.sillytavern.app/for-contributors/writing-extensions/) · [Tavern Helper variable API](https://github.com/n0vi028/js-slash-runner/blob/main/src/function/variables.ts).

[中文](#中文-chinese) | [English](#english)

---

(C) 2024-2026 JLYANG1900. All Rights Reserved.
