<img width="1920" height="869" alt="ScreenShot_2025-11-28_212809_385" src="https://github.com/user-attachments/assets/fc692c15-abbb-4c2d-ba88-a98fd16cdd34" />
# General_Map (SillyTavern Universal Map Plugin / 酒馆通用地图插件)

> **Version / 版本**: 1.2.0  
> **Author / 作者**: JLYANG1900

**General_Map** is a universal map extension designed specifically for SillyTavern. It is more than just a static map; it is a fully customizable, interactive world-building tool that supports multi-level nesting.

**General_Map** 是一款专为 SillyTavern（酒馆）设计的通用地图扩展插件。它不仅仅是一张静态地图，更是一个完全可自定义、支持多层级嵌套的交互式世界构建工具。

---

## 🌟 Core Features (核心特性)

### 1. 🗺️ Multi-Level Map System (无限层级地图系统)
- **Multi-dimensional World / 多维度世界**  
  Supports free navigation from "City" to "World Map" and more levels.  
  支持从“城市”到“世界地图”乃至更多层级的自由跳转。
- **Portals / 传送门**  
  Create special "Portal" pins for seamless transitions between map levels (e.g., click "Airport" in city view to jump to world map).  
  创建特殊的“传送门”地点，实现不同地图层级间的无缝切换（例如：从城市视图点击“机场”跳转到世界地图）。
- **Return Mechanism / 返回机制**  
  Built-in history stack allows one-click return to the previous map level.  
  内置历史记录堆栈，支持一键返回上一级地图。

### 2. ✏️ Visual Editing (自由可视化编辑)
- **Drag & Drop / 拖拽布局**  
  In "Edit Mode", simply drag and drop location pins to rearrange them. (WYSIWYG)  
  打开“编辑模式”后，长按/点击即可随意拖拽地点图标，所见即所得。
- **Custom Pins / 自定义地点**  
  Add new pins freely, customize their names, descriptions, and colors.  
  自由添加新的地点 (Pins)，自定义名称、描述、颜色。
- **Image Support / 图片支持**  
  Upload cover images for locations, or internal structure images for buildings.  
  为每个地点上传封面图，甚至为建筑上传内部结构图。

### 3. 🏢 Complex Structures (复合建筑系统)
- **Indoor Roaming / 室内漫游**  
  Create "Complex Structure" locations that allow users to enter and view floor plans.  
  支持创建“复合建筑”类型，点击进入后可查看楼层索引。
- **Floor Management / 楼层管理**  
  Add or remove floors, with independent names and descriptions for each.  
  自由添加/删除楼层，为每一层设定独立的名称和详细描述。

### 4. 🎨 Customization (个性化定制)
- **Theme Colors / 主题色**  
  Built-in color picker to change the interface theme color in real-time (Default: Retro Gold #b38b59).  
  内置取色器，实时修改界面主题色（默认复古金 #b38b59）。
- **Backgrounds / 背景更换**  
  Support one-click replacement of the current map background image.  
  支持一键替换当前地图的背景图片。
- **Mobile Friendly / 移动端适配**  
  Optimized touch interactions and responsive layout for phones and tablets.  
  针对手机/平板优化的触摸交互和响应式布局。

### 5. 💾 Data Persistence (数据安全与迁移)
- **Auto-Save / 自动保存**  
  All operations are saved locally to IndexedDB in real-time.  
  所有操作实时保存至本地 IndexedDB。
- **Backup & Export / 备份导出**  
  Support exporting the entire world setting as a JSON file.  
  支持将整个世界设定导出为 JSON 文件。
- **Smart Import / 智能导入**  
  Automatically identify and migrate legacy (V1/V2) data to the new V3 multi-level structure upon import.  
  导入备份时自动识别并兼容旧版 (V1/V2) 数据，自动迁移到新的 V3 多层级结构。

---

## 🛠️ Installation (安装说明)

### Method 1: Automatic Installation (Recommended / 推荐)
1. In SillyTavern, open the **Extensions** menu.  
   在 SillyTavern 中打开 **扩展 (Extensions)** 菜单。
2. Click **Install Extension** button.  
   点击 **安装扩展 (Install Extension)** 按钮。
3. Paste the following Git URL into the input box and click **Save**:  
   将以下 Git URL 粘贴到输入框中并点击 **保存**:
   ```
   https://github.com/JLYANG1900/General_Map
   ```
4. Find the extension in the list and enable it.  
   在列表中找到该插件并启用。

### Method 2: Manual Installation (手动安装)
1. Place the `General_Map` folder into SillyTavern's extension directory:  
   将 `General_Map` 文件夹放置在 SillyTavern 的插件目录下：
   `SillyTavern/public/scripts/extensions/third-party/`

2. Ensure the folder structure is as follows:  
   确保文件夹结构如下：
   ```
   General_Map/
   ├── index.js
   ├── style.css
   ├── map.html
   └── manifest.json
   ```

3. Restart SillyTavern or reload the page, then enable the extension in the list.  
   重启 SillyTavern 或刷新页面，在扩展列表中启用插件。

---

## 📖 Usage Guide (使用指南)

### Basic Operations (基础操作)
- **Enter Map / 进入地图**: Click the map icon in the SillyTavern interface. (点击酒馆界面中的地图入口图标)
- **View Details / 查看详情**: Click any pin to view its description, cover image, and interaction options. (单击任意地点图标可查看详细描述、封面图及交互选项)
- **Travel System / 旅行系统**: Click "Travel Here" to trigger simulated travel events. (点击“前往此处”可触发模拟旅行事件)

### Edit Mode (编辑模式)
1. Click the **✏️ Edit Mode** toggle at the top.  
   点击顶部的 **✏️ 编辑模式** 开关。
2. **Add Pin / 新增地点**: Click "📍 Add New Pin" to generate a new coordinate in the center.  
   点击“📍 新增地点”按钮，会在屏幕中央生成一个新坐标。
3. **Move Pin / 移动地点**: Drag the pin with your mouse (or long-press on touch devices).  
   鼠标按住（或手指长按）地点图标进行拖拽。
4. **Edit Content / 编辑内容**: Click the pin to open details, then click directly on text (title, description) to edit.  
   点击地点弹出详情框，直接点击文字区域（标题、描述）即可进行修改。
5. **Change Type / 修改类型**: Switch pin type in the popup:  
   在弹窗中将地点类型切换为：
   - `📍 Simple`: Basic landmark. (普通地点)
   - `🏢 Complex`: Has internal floors. (复合建筑)
   - `🌀 Portal`: Jumps to another Map ID. (传送门)

### Data Backup (数据备份)
Recommended to regularly click **💾 Export Backup** to save your world data as a JSON file, preventing data loss from browser cache clearing.  
建议定期点击 **💾 导出备份** 按钮，将您的世界构建数据保存为本地 JSON 文件，以防浏览器缓存清理导致数据丢失。

---

## 📂 File Structure (文件结构)
- `index.js`: Core logic, V3 data structure, IndexedDB wrapper, event handling. (核心逻辑，包含数据结构、IndexedDB 封装、交互事件处理)
- `style.css`: Stylesheet, retro UI definition, mobile adaptation. (样式表，定义了复古 UI、弹窗样式及移动端适配)
- `map.html`: The HTML skeleton of the plugin. (插件的 HTML 骨架)
- `manifest.json`: Plugin metadata definition. (插件元数据定义)

---

## ⚠️ Notes (注意事项)
- Always **Export Backup** before updating the extension.  
  更新插件前，请务必使用 **导出备份** 功能保存当前数据。
- The plugin uses IndexedDB. Clearing browser cache may lose data. Please backup regularly.  
  插件使用 IndexedDB 存储数据，清理浏览器缓存可能会导致数据丢失，请养成备份习惯。

---

(C) 2024-2026 JLYANG1900. All Rights Reserved.
