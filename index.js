const extensionName = "General_Map";
const extensionPath = `scripts/extensions/third-party/${extensionName}`;

const getSTContext = () => window.SillyTavern?.getContext?.() || null;
const gmAnimationDuration = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : 200;

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validId(id) {
    return typeof id === 'string' && id.trim() && !['__proto__', 'constructor', 'prototype'].includes(id);
}

function normalizeWorld(value) {
    if (!isRecord(value)) throw new Error('地图备份必须是对象');
    let world = JSON.parse(JSON.stringify(value));
    if (!Object.prototype.hasOwnProperty.call(world, 'maps')) {
        if (!Object.keys(world).length || !Object.values(world).every(pin => isRecord(pin) && 'x' in pin && 'y' in pin)) {
            throw new Error('无效的地图数据格式');
        }
        world = { ...JSON.parse(JSON.stringify(defaultWorldData)), maps: { ...JSON.parse(JSON.stringify(defaultWorldData.maps)), default_city: { ...defaultWorldData.maps.default_city, pins: world } } };
    }
    if (!isRecord(world.maps) || !Object.keys(world.maps).length) throw new Error('备份至少需要一张地图');
    const coordinate = value => {
        const text = String(value ?? '50%').trim();
        if (!/^\d+(?:\.\d+)?%?$/.test(text) || parseFloat(text) > 100) throw new Error('地标坐标必须在 0 到 100% 之间');
        return `${parseFloat(text)}%`;
    };
    for (const [mapId, map] of Object.entries(world.maps)) {
        if (!validId(mapId) || !isRecord(map) || !isRecord(map.pins)) throw new Error('地图 ID 或地标列表无效');
        map.name = String(map.name || mapId);
        map.background = window.GeneralMapTracking.safeImage(map.background);
        for (const [id, pin] of Object.entries(map.pins)) {
            if (!validId(id) || !isRecord(pin)) throw new Error('地标数据无效');
            pin.id = id;
            pin.name = String(pin.name || '未命名地点');
            pin.type = ['simple', 'complex', 'portal', 'custom'].includes(pin.type) ? pin.type : 'simple';
            pin.x = coordinate(pin.x); pin.y = coordinate(pin.y);
            pin.aliases = window.GeneralMapTracking.splitAliases(pin.aliases);
            pin.image = window.GeneralMapTracking.safeImage(pin.image);
            pin.internalImage = window.GeneralMapTracking.safeImage(pin.internalImage);
            if (pin.floors != null && (!Array.isArray(pin.floors) || !pin.floors.every(isRecord))) throw new Error('建筑楼层数据无效');
            for (const floor of pin.floors || []) {
                floor.name = String(floor.name || '未命名区域');
                floor.subItems = Array.isArray(floor.subItems) ? floor.subItems.map(String) : [];
            }
        }
    }
    if (!validId(world.currentMapId) || !Object.prototype.hasOwnProperty.call(world.maps, world.currentMapId)) world.currentMapId = Object.keys(world.maps)[0];
    world.tracking = window.GeneralMapTracking.normalizeConfig(world.tracking);
    return world;
}

// ==========================================
// 工具 1: 安全净化 (防止 XSS 攻击)
// ==========================================
const Sanitize = {
    encode: function(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    jsArg: function(value) {
        return JSON.stringify(value == null ? "" : String(value))
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};

const GMIcon = {
    paths: {
        add: '<path d="M12 5v14"/><path d="M5 12h14"/>',
        back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
        building: '<path d="M4 21h16"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M9 8h1"/><path d="M14 8h1"/><path d="M9 12h1"/><path d="M14 12h1"/><path d="M10 21v-4h4v4"/>',
        camera: '<path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z"/><circle cx="12" cy="13" r="3"/>',
        close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        door: '<path d="M5 21h14"/><path d="M7 21V5a2 2 0 0 1 2-2h6v18"/><path d="M11 12h.01"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
        export: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
        folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
        import: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
        map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
        palette: '<path d="M12 22a10 10 0 1 1 10-10c0 2.2-1.4 3-3 3h-1.5a1.5 1.5 0 0 0 0 3H18a2 2 0 0 1 0 4h-6Z"/><circle cx="7.5" cy="10" r=".75"/><circle cx="10.5" cy="7" r=".75"/><circle cx="14" cy="7.5" r=".75"/><circle cx="16.5" cy="11" r=".75"/>',
        pin: '<path d="M12 21s7-5.4 7-12a7 7 0 1 0-14 0c0 6.6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
        portal: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7a5 5 0 1 0 5 5"/><path d="M12 11a1 1 0 1 0 1 1"/><path d="M16 3h5v5"/><path d="m21 3-7 7"/>',
        reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v6h6"/>',
        trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m6 6 1 15h10l1-15"/><path d="M10 11v6"/><path d="M14 11v6"/>',
        travel: '<path d="M2 16 22 7l-8 15-3-7-9 1Z"/><path d="m11 15 4-4"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        users: '<circle cx="9" cy="8" r="3"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 11a3 3 0 1 0-1-5.8"/><path d="M17 21a6 6 0 0 0-3-5.2"/>',
        warning: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>'
    },

    svg: function(name, extraClass = "") {
        const path = this.paths[name] || this.paths.pin;
        const className = `gm-icon gm-icon-${name}${extraClass ? ` ${extraClass}` : ""}`;
        return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
    },

    label: function(name, text, extraClass = "") {
        return `${this.svg(name, extraClass)}<span>${Sanitize.encode(text)}</span>`;
    }
};

// ==========================================
// 工具 2: 图片压缩
// ==========================================
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) return reject(new Error('请选择图片文件'));
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                try {
                let width = img.width;
                let height = img.height;
                const scale = Math.min(1, maxWidth / Math.max(width, height));
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (error) { reject(error); }
            };
            img.onerror = () => reject(new Error('无法解码图片，请选择有效的图片文件'));
            img.src = event.target.result;
        };
        reader.onerror = () => reject(reader.error || new Error('无法读取图片文件'));
        reader.readAsDataURL(file);
    });
}

// ==========================================
// 工具 3: IndexedDB 简易封装
// ==========================================
const dbName = "GeneralMapDB_V1";
const storeName = "settings";

const SimpleDB = {
    db: null,
    
    open: function() {
        return new Promise((resolve, reject) => {
            if (this.db) return resolve(this.db);
            const request = indexedDB.open(dbName, 1);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            
            request.onerror = () => reject(request.error || new Error('DB Open Error'));
        });
    },

    getItem: async function(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ?? null);
            request.onerror = () => reject(request.error);
        });
    },

    setItem: async function(key, value) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);
            transaction.oncomplete = () => resolve(true);
            transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('保存事务未完成'));
            request.onerror = () => reject(request.error);
        });
    },
    
    removeItem: async function(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            transaction.oncomplete = () => resolve(true);
            transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('删除事务未完成'));
            request.onerror = () => reject(request.error);
        });
    }
};

// ==========================================
// 默认数据
// ==========================================
const defaultPins = {
    // === Task 1: 新增的大地图入口 ===
    "world-map-portal": { 
        id: "world-map-portal", 
        name: "大地图", 
        x: "90%", 
        y: "10%", 
        desc: "点击进入世界地图视图。", 
        type: "portal", 
        targetMapId: "default_world", 
        color: "#ffd54f" 
    },
    // =============================
    "gov": { id: "gov", name: "市政府", x: "50%", y: "60%", desc: "城市行政中心。", type: "simple", color: "#ef9a9a" },
    "villa": { id: "villa", name: "私人别墅", x: "25%", y: "15%", desc: "位于北区的一栋独栋别墅。", type: "simple", color: "#ba68c8" },
    "PrivateClub": { id: "PrivateClub", name: "私人会所", x: "75%", y: "15%", desc: "仅限会员进入的高级会所，隐秘性极高。", type: "simple", color: "#ce93d8" },
    "airport": { id: "airport", name: "机场", x: "85%", y: "35%", desc: "连接世界的交通枢纽。", type: "simple", color: "#b0bec5" },
    "port": { id: "port", name: "港口", x: "85%", y: "65%", desc: "繁忙的国际货运港口。", type: "simple", color: "#a5d6a7" },
    "office4": { id: "office4", name: "A集团", x: "15%", y: "25%", desc: "本市新兴科技巨头。", type: "simple", color: "#b39ddb" },
    "office3": { id: "office3", name: "B集团", x: "10%", y: "35%", desc: "老牌实业集团，在本地拥有深厚根基。", type: "simple", color: "#90caf9" },
    "office": { id: "office", name: "C集团", x: "15%", y: "60%", desc: "主营航运、大宗商品与投资的家族企业。", type: "simple", color: "#64b5f6" },
    "TVstation": { id: "TVstation", name: "电视台", x: "20%", y: "65%", desc: "城市媒体中心，众多节目的录制现场。", type: "simple", color: "#80cbc4" },
    "office2": { id: "office2", name: "D集团", x: "15%", y: "70%", desc: "国内最大的娱乐产业集团之一。", type: "simple", color: "#e57373" },
    "highschool": { id: "highschool", name: "高中", x: "30%", y: "85%", desc: "本市著名的重点高中。", type: "simple", color: "#ffcc80" },
    "other-places": { id: "other-places", name: "其他地点", x: "85%", y: "85%", desc: "前往未在地图上标注的区域。", type: "custom", color: "#ffe0b2" },
};

// 默认 World 结构 (V3)
const defaultWorldData = {
    currentMapId: "default_city",
    maps: {
        "default_city": {
            name: "默认城市",
            // 默认城市背景
            background: "https://files.catbox.moe/1f95nr.jpg", 
            pins: JSON.parse(JSON.stringify(defaultPins))
        },
        // === Task 1 & 2: 默认世界地图结构 ===
        "default_world": {
            name: "世界地图",
            // 【Updated】新增世界地图默认背景
            background: "https://files.catbox.moe/iov3on.jpg", 
            pins: {
                "city-return-portal": {
                    id: "city-return-portal",
                    name: "default_city",
                    x: "50%",
                    y: "50%",
                    desc: "返回默认城市",
                    type: "portal",
                    targetMapId: "default_city",
                    color: "#4fc3f7"
                }
            }
        }
    }
};

// 全局状态
window.GeneralMap = {
    worldData: null,     // V3 新增: 存储整个世界的所有地图
    mapHistory: [],      // V3 新增: 历史堆栈，用于"返回上一层"
    isEditing: false,    
    themeColor: '#0b57d0',
    controlsCollapsed: false,
    pinEventCleanups: [],
    
    // 临时存储出行信息
    tempTravelData: {
        isAlone: true,
        companionName: '',
        meetNPC: false,
        meetNPCName: '',
        destination: ''
    },
    
    // Getter: 兼容旧代码，获取当前地图的 pins
    get mapData() {
        if (!this.worldData || !this.worldData.maps[this.worldData.currentMapId]) {
            return {};
        }
        return this.worldData.maps[this.worldData.currentMapId].pins;
    },

    init: async function() {
        await this.loadTheme(); 
        await this.loadData();
        // 渲染逻辑移到 loadBackground 内部或之后
        await this.loadBackground(); 
        this.renderMapPins();
        this.initControlsPanel();
        this.updateUIControls();
        this.tracker?.destroy();
        this.tracker = window.GeneralMapTracking.create({ map: this, icons: GMIcon, compressImage, getContext: getSTContext });
        this.tracker.init();
    },

    // ==========================================
    // 主题管理
    // ==========================================
    loadTheme: async function() {
        let savedColor = await SimpleDB.getItem('general_map_theme');
        if (!savedColor) {
            savedColor = localStorage.getItem('general_map_theme');
        }
        
        this.applyTheme(/^#[0-9a-f]{6}$/i.test(savedColor) ? savedColor : this.themeColor);
        const picker = document.getElementById('theme-color-picker');
        if (picker) picker.value = this.themeColor;
    },

    applyTheme: function(color) {
        if (!/^#[0-9a-f]{6}$/i.test(color)) return;
        this.themeColor = color;
        const seed = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
        const mix = (rgb, target, amount) => rgb.map(value => Math.round(value + (target - value) * amount));
        const css = rgb => `rgb(${rgb.join(', ')})`;
        const luminance = rgb => rgb.reduce((sum, value, i) => {
            const channel = value / 255;
            return sum + (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
        }, 0);
        // Keep both white button text and tinted-container text readable.
        const container = mix(seed, 255, .88);
        const maxLuminance = Math.min(.18, (luminance(container) + .05) / 4.5 - .05);
        let primary = [...seed];
        while (luminance(primary) > maxLuminance) primary = mix(primary, 0, .08);
        const tokens = {
            '--gm-theme-color': color,
            '--gm-theme-bg-opacity': `rgba(${seed.join(', ')}, 0.3)`,
            '--gm-primary': css(primary),
            '--gm-primary-hover': css(mix(primary, 0, .12)),
            '--gm-primary-container': css(container),
            '--gm-primary-soft': css(mix(seed, 255, .95)),
        };
        for (const id of ['general-map-panel', 'general-toggle-btn']) {
            const root = document.getElementById(id);
            if (root) for (const [name, value] of Object.entries(tokens)) root.style.setProperty(name, value);
        }
        
        SimpleDB.setItem('general_map_theme', color).catch(error => console.error('[General Map] Theme save failed', error));
    },

    // ==========================================
    // 数据加载、迁移与保存 (V3 Update)
    // ==========================================
    loadData: async function() {
        // 1. 尝试读取数据
        let rawData = await SimpleDB.getItem('general_map_data_v2');
        
        if (!rawData) {
            rawData = localStorage.getItem('general_map_data_v2');
            if (rawData) {
                try {
                    await SimpleDB.setItem('general_map_data_v2', rawData);
                    console.log("已将旧数据迁移至 IndexedDB");
                } catch(e) {}
            }
        }

        let parsedData = null;
        if (rawData) {
            parsedData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        }

        // 2. 数据迁移逻辑 (Check if V3)
        // V3 结构必须包含 'maps' 和 'currentMapId'
        if (parsedData) {
            this.worldData = normalizeWorld(parsedData);
            if (!parsedData.maps) {
                const oldBg = await SimpleDB.getItem('general_map_bg_v2') || localStorage.getItem('general_map_bg_v2');
                if (oldBg) this.worldData.maps.default_city.background = window.GeneralMapTracking.safeImage(oldBg);
            }
        } else {
            // 获取旧的全局背景图
            let oldBg = await SimpleDB.getItem('general_map_bg_v2');
            if (!oldBg) oldBg = localStorage.getItem('general_map_bg_v2');

            // 构造新的 World 对象
            this.worldData = normalizeWorld(defaultWorldData);
            
            // 如果有旧背景，存入默认 city
            if (oldBg) {
                this.worldData.maps["default_city"].background = window.GeneralMapTracking.safeImage(oldBg);
            }

            // 保存迁移后的数据
            await this.saveData();
        }

        // 确保当前 ID 有效
        if (!this.worldData.maps[this.worldData.currentMapId]) {
            this.worldData.currentMapId = Object.keys(this.worldData.maps)[0] || "default_city";
        }
    },

    saveData: async function() {
        try {
            await SimpleDB.setItem('general_map_data_v2', this.worldData);
            return true;
        } catch (e) {
            console.error("保存失败", e);
            alert("保存数据时发生错误：" + e.message);
            return false;
        }
    },

    resetData: async function() {
        if(confirm("确定要重置所有地图数据（包括所有层级）吗？")) {
            const replacement = normalizeWorld(defaultWorldData);
            this.closeAllPopups();
            try { await SimpleDB.setItem('general_map_data_v2', replacement); }
            catch (error) { alert('重置失败：' + error.message); return; }
            localStorage.removeItem('general_map_data_v2'); 
            localStorage.removeItem('general_map_bg_v2');
            
            this.mapHistory = [];
            // 重置时直接使用 defaultWorldData，其中已包含你要求的新增地点
            this.worldData = replacement;
            if (!document.getElementById('general-map-container')) {
                await initializeExtension();
                return;
            }
            this.tracker?.reset();
            
            await this.loadBackground();
            this.renderMapPins();
            this.updateUIControls();
            alert("数据已重置。");
        }
    },

    // ==========================================
    // 地图切换逻辑 (V3 New)
    // ==========================================
    
    // 切换到指定 ID 的地图
    switchMap: async function(mapId) {
        if (!validId(mapId) || mapId === this.worldData.currentMapId) return;
        this.closeAllPopups();

        // 如果目标地图不存在，自动创建一个空白地图
        if (!Object.prototype.hasOwnProperty.call(this.worldData.maps, mapId)) {
            console.log(`Map ID ${mapId} 不存在，正在创建新地图...`);
            this.worldData.maps[mapId] = {
                name: mapId,
                background: "",
                pins: {}
            };
        }

        // 记录历史
        this.mapHistory.push(this.worldData.currentMapId);
        
        // 切换
        this.worldData.currentMapId = mapId;
        await this.saveData();

        // 刷新视图
        await this.loadBackground(); // 背景现在随地图变
        this.renderMapPins();
        this.updateUIControls();
    },

    // 返回上一级
    goBackMap: async function() {
        if (this.mapHistory.length === 0) return;
        this.closeAllPopups();

        const prevMapId = this.mapHistory.pop();
        
        if (this.worldData.maps[prevMapId]) {
            this.worldData.currentMapId = prevMapId;
            await this.saveData();
            
            await this.loadBackground();
            this.renderMapPins();
            this.updateUIControls();
        } else {
            alert("历史记录中的地图已不存在。");
            this.mapHistory = []; // 清空无效历史
            this.updateUIControls();
        }
    },

    updateUIControls: function() {
        const backBtn = document.getElementById('map-back-btn');
        if (backBtn) {
            backBtn.style.display = (this.mapHistory.length > 0) ? 'inline-block' : 'none';
        }
        
        // 更新当前地图标题（可选）
        const currentMap = this.worldData.maps[this.worldData.currentMapId];
        const subText = document.getElementById('subtitle-text');
        if(subText) {
            subText.innerText = `当前区域: ${currentMap.name || '未知'} (ID: ${this.worldData.currentMapId})`;
        }
    },

    initControlsPanel: function() {
        this.controlsCollapsed = localStorage.getItem('general_map_controls_collapsed') === 'true';
        this.applyControlsPanelState();
    },

    toggleControlsPanel: function() {
        this.controlsCollapsed = !this.controlsCollapsed;
        localStorage.setItem('general_map_controls_collapsed', String(this.controlsCollapsed));
        this.applyControlsPanelState();
    },

    applyControlsPanelState: function() {
        const panel = document.getElementById('general-controls-panel');
        const button = document.getElementById('controls-collapse-btn');
        if (!panel || !button) return;

        panel.classList.toggle('is-collapsed', this.controlsCollapsed);
        button.title = this.controlsCollapsed ? '展开工具' : '收起工具';
        button.setAttribute('aria-label', button.title);
        button.setAttribute('aria-expanded', String(!this.controlsCollapsed));
    },

    // ==========================================
    // 导入/导出
    // ==========================================
    exportBackup: async function() {
        try {
            const dataStr = JSON.stringify(this.worldData, null, 2);
            const blob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0,10);
            a.download = `General_World_Backup_${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("导出失败: " + e.message);
        }
    },

// 导入备份 (修复版：兼容旧版 V1/V2 数据)
    importBackup: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    
                    const newWorldData = normalizeWorld(json);

                    // 3. 执行导入
                    if (confirm("导入备份将覆盖当前的地图数据，确定继续吗？")) {
                        this.closeAllPopups();
                        await SimpleDB.setItem('general_map_data_v2', newWorldData);
                        this.worldData = newWorldData;
                        this.mapHistory = []; // 清空历史
                        
                        // 确保 currentMapId 有效
                        if (!this.worldData.maps[this.worldData.currentMapId]) {
                            this.worldData.currentMapId = Object.keys(this.worldData.maps)[0];
                        }

                        this.tracker?.reset();
                        await this.loadBackground();
                        this.renderMapPins();
                        this.closeAllPopups();
                        this.updateUIControls();
                        alert("备份导入成功！(已自动兼容旧版数据)");
                    }
                } catch (err) {
                    console.error(err);
                    alert("导入失败：" + err.message);
                }
                input.value = '';
            };
            reader.onerror = () => { alert('无法读取备份文件'); input.value = ''; };
            reader.readAsText(input.files[0]);
        }
    },

    // ==========================================
    // 地图渲染与交互
    // ==========================================
    renderMapPins: function() {
        const container = document.getElementById('general-map-container');
        this.pinEventCleanups.forEach(cleanup => cleanup());
        this.pinEventCleanups = [];
        container.querySelectorAll('.location').forEach(el => el.remove());

        // 使用 getter 获取当前地图的 pins
        const currentPins = this.mapData; 

        Object.values(currentPins).forEach(loc => {
            const div = document.createElement('div');
            div.className = 'location';
            div.id = `pin-${loc.id}`;
            div.style.left = loc.x;
            div.style.top = loc.y;
            if (loc.color) div.style.color = loc.color;
            if (loc.bgColor) div.style.backgroundColor = loc.bgColor;
            
            const pinIcon = loc.type === 'portal'
                ? GMIcon.svg('portal', 'pin-type-icon')
                : loc.type === 'complex'
                    ? GMIcon.svg('building', 'pin-type-icon')
                    : GMIcon.svg('pin', 'pin-type-icon');

            div.innerHTML = `${pinIcon}<span class="label">${Sanitize.encode(loc.name)}</span>`;
            this.bindPinEvents(div, loc.id);
            container.appendChild(div);
        });
        this.tracker?.render();
    },

    addNewPin: function() {
        if (!this.isEditing) {
            document.getElementById('edit-mode-toggle').click();
        }
        const id = 'custom-' + (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        // 直接写入当前地图的 pins
        this.worldData.maps[this.worldData.currentMapId].pins[id] = {
            id: id,
            name: "新地点",
            x: "50%", 
            y: "50%", 
            desc: "点击编辑描述", 
            type: "simple", 
            color: "#e0c5a1"
        };
        this.saveData();
        this.renderMapPins();
        this.renderPopup(id);
    },

    deletePin: function(id) {
        if (confirm("确定要永久删除这个地点吗？")) {
            delete this.worldData.maps[this.worldData.currentMapId].pins[id];
            this.saveData();
            this.renderMapPins();
            this.closeAllPopups();
        }
    },

    bindPinEvents: function(elm, id) {
        const targetMap = this.worldData.maps[this.worldData.currentMapId];
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false; 
        const container = document.getElementById('general-map-container');

        // --- 鼠标事件 (PC) ---
        elm.onmousedown = (e) => {
            if (this.isEditing) {
                isDragging = true;
                elm.classList.add('dragging');
                startX = e.clientX;
                startY = e.clientY;
                initialLeft = elm.offsetLeft;
                initialTop = elm.offsetTop;
                hasMoved = false;
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const mouseMoveHandler = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            newLeft = Math.max(0, Math.min(newLeft, container.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, container.offsetHeight));
            elm.style.left = newLeft + 'px';
            elm.style.top = newTop + 'px';
        };

        const mouseUpHandler = () => {
            if (isDragging && hasMoved) {
                const pctX = (elm.offsetLeft / container.offsetWidth * 100).toFixed(1) + '%';
                const pctY = (elm.offsetTop / container.offsetHeight * 100).toFixed(1) + '%';
                // 更新当前地图数据
                targetMap.pins[id].x = pctX;
                targetMap.pins[id].y = pctY;
                this.saveData();
                this.tracker?.render();
            }
            isDragging = false;
            elm.classList.remove('dragging');
        };

        // --- 触摸事件 (移动端) ---
        const touchStartHandler = (e) => {
            if (this.isEditing) {
                isDragging = true;
                elm.classList.add('dragging');
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                initialLeft = elm.offsetLeft;
                initialTop = elm.offsetTop;
                hasMoved = false;
            }
        };

        const touchMoveHandler = (e) => {
            if (!isDragging) return;
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
                if (e.cancelable) e.preventDefault(); 
            }
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            newLeft = Math.max(0, Math.min(newLeft, container.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, container.offsetHeight));
            elm.style.left = newLeft + 'px';
            elm.style.top = newTop + 'px';
        };

        const touchEndHandler = (e) => {
            if (!isDragging) return;
            if (hasMoved) {
                const pctX = (elm.offsetLeft / container.offsetWidth * 100).toFixed(1) + '%';
                const pctY = (elm.offsetTop / container.offsetHeight * 100).toFixed(1) + '%';
                targetMap.pins[id].x = pctX;
                targetMap.pins[id].y = pctY;
                this.saveData();
                this.tracker?.render();
            }
            isDragging = false;
            elm.classList.remove('dragging');
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        elm.addEventListener('touchstart', touchStartHandler, { passive: false });
        elm.addEventListener('touchmove', touchMoveHandler, { passive: false });
        elm.addEventListener('touchend', touchEndHandler);
        elm.addEventListener('touchcancel', touchEndHandler);
        this.pinEventCleanups.push(() => {
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            elm.removeEventListener('touchstart', touchStartHandler);
            elm.removeEventListener('touchmove', touchMoveHandler);
            elm.removeEventListener('touchend', touchEndHandler);
            elm.removeEventListener('touchcancel', touchEndHandler);
            elm.onmousedown = null;
            elm.onclick = null;
            elm.ondblclick = null;
        });

        // --- Click Logic Update for Portals ---
        elm.onclick = (e) => {
            if (hasMoved) { 
                hasMoved = false; 
                e.preventDefault(); 
                e.stopPropagation();
                return; 
            }
            
            const pinData = this.mapData[id];

            // 如果不是编辑模式，且是传送门，则直接跳转
            if (!this.isEditing && pinData.type === 'portal') {
                if (pinData.targetMapId) {
                    this.switchMap(pinData.targetMapId);
                } else {
                    alert("该传送门未设置目标地图 ID。");
                }
                return;
            }

            // 否则打开详情弹窗
            if (id === 'other-places' && !this.isEditing) {
                this.showCustomTravelPopup();
            } else {
                this.renderPopup(id);
            }
        };
        
        elm.ondblclick = (e) => {
            if (!hasMoved) this.renderPopup(id);
        }
    },

    renderPopup: function(id) {
        const data = this.mapData[id]; // use getter
        if (!data) return;
        this.popupTarget = { mapId: this.worldData.currentMapId, id };
        const idArg = Sanitize.jsArg(id);
        const nameArg = Sanitize.jsArg(data.name);
        const targetMapArg = Sanitize.jsArg(data.targetMapId || "");
        
        const popup = document.getElementById('dynamic-popup');
        const content = document.getElementById('popup-content');
        const overlay = document.getElementById('general-overlay');

        // Pin 类型选择 HTML (仅编辑模式)
        let typeSelectHTML = "";
        if (this.isEditing) {
            typeSelectHTML = `
                <div class="gm-type-controls">
                    <label class="gm-inline-label">${GMIcon.label('pin', '地点类型:')}
                        <select onchange="window.GeneralMap.updateField(${idArg}, 'type', this.value); window.GeneralMap.renderPopup(${idArg})">
                            <option value="simple" ${data.type === 'simple' ? 'selected' : ''}>普通地点</option>
                            <option value="complex" ${data.type === 'complex' ? 'selected' : ''}>复合建筑 (含楼层)</option>
                            <option value="portal" ${data.type === 'portal' ? 'selected' : ''}>传送门 (地图跳转)</option>
                        </select>
                    </label>
                    ${data.type === 'portal' ? `
                        <label class="gm-portal-target">
                            <span>目标地图 ID</span>
                            <input type="text" class="travel-input"
                            value="${Sanitize.encode(data.targetMapId || '')}" 
                            onblur="window.GeneralMap.updateField(${idArg}, 'targetMapId', this.value)" placeholder="例: default_world">
                        </label>
                    ` : ''}
                </div>
            `;
        }

        let styleControlsHTML = "";
        if (this.isEditing) {
            styleControlsHTML = `
                <div class="pin-style-controls">
                    <label>
                        <span>地点小图标字体颜色</span>
                        <input type="color" value="${Sanitize.encode(data.color || '#e0c5a1')}" onchange="window.GeneralMap.updateField(${idArg}, 'color', this.value)">
                    </label>
                    <label>
                        <span>文本框背景颜色</span>
                        <input type="color" value="${Sanitize.encode(data.bgColor || '#000000')}" onchange="window.GeneralMap.updateField(${idArg}, 'bgColor', this.value)">
                    </label>
                </div>
            `;
        }

        const introText = data.introduction || "";
        const introDisplayText = introText || (this.isEditing ? "" : "暂无地点介绍");
        const introClass = introText ? "location-intro-body editable-text" : "location-intro-body editable-text is-empty";

        let html = `
            <div class="gm-popup-heading">
                <h3 contenteditable="${this.isEditing}" class="editable-text" style="flex:1" onblur="window.GeneralMap.updateField(${idArg}, 'name', this.innerText)">${Sanitize.encode(data.name)}</h3>
                ${this.isEditing ? `<button class="general-btn small danger" onclick="window.GeneralMap.deletePin(${idArg})">${GMIcon.label('trash', '删除')}</button>` : ''}
            </div>
            ${typeSelectHTML}
            ${styleControlsHTML}
            ${this.isEditing ? `<label class="gm-pin-aliases">地点别名<input type="text" value="${Sanitize.encode((data.aliases || []).join('、'))}" placeholder="图书馆、阅览室" onblur="window.GeneralMap.updateField(${idArg}, 'aliases', this.value)"></label>` : ''}
            <p contenteditable="${this.isEditing}" class="editable-text" onblur="window.GeneralMap.updateField(${idArg}, 'desc', this.innerText)">${Sanitize.encode(data.desc || "暂无描述")}</p>
            <div class="location-intro">
                <div class="location-intro-label">地点介绍</div>
                <div contenteditable="${this.isEditing}" class="${introClass}" data-placeholder="点击添加地点介绍..." oninput="this.classList.toggle('is-empty', !this.innerText.trim())" onblur="this.classList.toggle('is-empty', !this.innerText.trim()); window.GeneralMap.updateField(${idArg}, 'introduction', this.innerText)">${Sanitize.encode(introDisplayText)}</div>
            </div>
        `;

        if (data.image) {
            html += `<img src="${Sanitize.encode(window.GeneralMapTracking.safeImage(data.image))}" class="popup-image" alt="地点封面">`;
        } else if (this.isEditing && data.type !== 'portal') {
            html += `<div class="gm-image-empty">暂无封面图</div>`;
        }

        if (this.isEditing && data.type !== 'portal') {
            html += `
                <div class="edit-controls">
                    <button class="general-btn small" onclick="this.nextElementSibling.click()">${GMIcon.label('camera', '更换封面')}</button>
                    <input type="file" style="display:none" accept="image/*" onchange="window.GeneralMap.uploadImage(${idArg}, 'image', this)">
                    ${data.image ? `<button class="general-btn small danger" onclick="window.GeneralMap.updateField(${idArg}, 'image', '')">${GMIcon.label('trash', '删除图')}</button>` : ''}
                </div>
            `;
        }

        // 底部按钮区域
        html += `<div class="gm-popup-actions">`;
        
        if (data.type === 'portal') {
             html += `<button class="general-btn gm-primary-button" onclick="window.GeneralMap.switchMap(${targetMapArg})">${GMIcon.label('portal', '进入该区域')}</button>`;
        } else {
            if (data.type === 'complex' || (this.isEditing && data.floors)) {
                html += `<button class="general-btn" onclick="window.GeneralMap.renderInterior(${idArg})">${GMIcon.label('door', '进入内部')}</button>`;
            } else if (this.isEditing) {
                // 如果是 simple 但想加楼层
                html += `<button class="general-btn small" onclick="window.GeneralMap.addFloor(${idArg})">${GMIcon.label('add', '添加楼层/区域')}</button>`;
            }
            html += `<button class="general-btn gm-primary-button" onclick="window.GeneralMap.openTravelMenu(${nameArg})">${GMIcon.label('travel', '前往此处')}</button>`;
        }
        
        html += `</div>`;

        content.innerHTML = html;
        popup.style.display = 'block';
        overlay.style.display = 'block';
    },

    renderInterior: function(id) {
        const data = this.mapData[id];
        if (!data) return;
        const content = document.getElementById('popup-content');
        const idArg = Sanitize.jsArg(id);
        if (!data.floors) data.floors = [];

        let html = `
            <h3 class="gm-interior-heading"><button type="button" class="general-btn gm-icon-button" title="返回地点" aria-label="返回地点" onclick="window.GeneralMap.renderPopup(${idArg})">${GMIcon.svg('back')}</button> ${Sanitize.encode(data.name)} - 内部</h3>
            <div class="interior-container">
        `;
        if (data.internalImage) {
            html += `<img src="${Sanitize.encode(window.GeneralMapTracking.safeImage(data.internalImage))}" class="interior-image" alt="建筑内部">`;
        } else {
            html += `<div class="gm-image-empty gm-interior-empty">暂无内部示意图</div>`;
        }

        html += `<div class="floor-nav">`;
        data.floors.forEach((floor, index) => {
            html += `
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;">
                    <button class="floor-btn" style="flex:1" onclick="window.GeneralMap.showFloorDetail(${idArg}, ${index})">
                        ${Sanitize.encode(floor.name)}
                    </button>
                    ${this.isEditing ? `
                        <button class="general-btn small danger" onclick="window.GeneralMap.deleteFloor(${idArg}, ${index})">${GMIcon.svg('trash')}</button>
                    ` : ''}
                </div>
            `;
        });
        
        if (this.isEditing) {
            html += `<button class="general-btn small" style="width:100%; margin-top:10px;" onclick="window.GeneralMap.addFloor(${idArg})">${GMIcon.label('add', '新增区域')}</button>`;
            html += `
                <div class="gm-interior-upload">
                    <button class="general-btn small" onclick="this.nextElementSibling.click()">${GMIcon.label('camera', '更换内部图')}</button>
                    <input type="file" style="display:none" accept="image/*" onchange="window.GeneralMap.uploadImage(${idArg}, 'internalImage', this)">
                </div>
            `;
        }
        html += `</div></div>`; 
        content.innerHTML = html;
    },

    showFloorDetail: function(id, floorIndex) {
        const floor = this.mapData[id]?.floors?.[floorIndex];
        if (!floor) return;
        const content = document.getElementById('popup-content');
        const idArg = Sanitize.jsArg(id);
        const floorNameArg = Sanitize.jsArg(floor.name);
        
        let html = `
            <h3 class="gm-interior-heading"><button type="button" class="general-btn gm-icon-button" title="返回建筑内部" aria-label="返回建筑内部" onclick="window.GeneralMap.renderInterior(${idArg})">${GMIcon.svg('back')}</button> ${Sanitize.encode(floor.name)}</h3>
            <p class="gm-field-label">名称</p>
            <div contenteditable="${this.isEditing}" class="editable-text" style="font-size:16px; margin-bottom:10px;"
                 onblur="window.GeneralMap.updateFloor(${idArg}, ${floorIndex}, 'name', this.innerText)">${Sanitize.encode(floor.name)}</div>
            
            <p class="gm-field-label">描述</p>
            <div contenteditable="${this.isEditing}" class="editable-text" style="min-height:50px; margin-bottom:15px;"
                 onblur="window.GeneralMap.updateFloor(${idArg}, ${floorIndex}, 'content', this.innerText)">${Sanitize.encode(floor.content || "点击添加描述...")}</div>
        `;
        
        if (floor.subItems && floor.subItems.length > 0) {
            html += `<h4>包含区域:</h4><div style="display:flex; flex-wrap:wrap; gap:5px;">`;
            floor.subItems.forEach(item => {
                html += `<button class="general-btn small">${Sanitize.encode(item)}</button>`;
            });
            html += `</div>`;
        }
        
        html += `<div style="text-align:center; margin-top:20px;">
                    <button class="general-btn" onclick="window.GeneralMap.openTravelMenu(${floorNameArg})">${GMIcon.label('travel', '前往此处')}</button>
                 </div>`;

        content.innerHTML = html;
    },

    toggleEditMode: function() {
        this.isEditing = !this.isEditing;
        const checkbox = document.getElementById('edit-mode-toggle');
        if (checkbox) checkbox.checked = this.isEditing;
        
        const body = document.getElementById('general-map-panel');
        const label = document.getElementById('edit-mode-label');
        if (this.isEditing) {
            body.classList.add('general-editing-active');
            label.innerHTML = GMIcon.label('edit', '编辑中...');
        } else {
            body.classList.remove('general-editing-active');
            label.innerHTML = GMIcon.label('edit', '编辑模式');
        }
        this.renderMapPins(); // Re-render to show/hide edit cues
        this.closeAllPopups();
    },

    updateField: function(id, field, value) {
        if (!this.isEditing || (this.popupTarget && this.popupTarget.mapId !== this.worldData.currentMapId)) return;
        if (!['name', 'desc', 'introduction', 'type', 'targetMapId', 'color', 'bgColor', 'aliases', 'image'].includes(field)) return;
        if (field === 'aliases') value = window.GeneralMapTracking.splitAliases(value);
        if (field === 'image') value = window.GeneralMapTracking.safeImage(value);
        if (!this.worldData.maps[this.worldData.currentMapId].pins[id]) return;
        this.worldData.maps[this.worldData.currentMapId].pins[id][field] = value;
        this.saveData();
        if (['name', 'type', 'color', 'bgColor', 'aliases'].includes(field)) this.renderMapPins();
        if (field === 'image') this.renderPopup(id);
    },

    updateFloor: function(id, floorIndex, field, value) {
        const pin = this.worldData.maps[this.worldData.currentMapId].pins[id];
        if (!this.isEditing || !['name', 'content'].includes(field) || !pin?.floors?.[floorIndex]) return;
        pin.floors[floorIndex][field] = value;
        this.saveData();
        this.tracker?.render();
    },

    addFloor: function(id) {
        const pin = this.worldData.maps[this.worldData.currentMapId].pins[id];
        if (!pin || !this.isEditing) return;
        if (!pin.floors) pin.floors = [];
        pin.floors.push({ name: "新区域 " + (pin.floors.length + 1), content: "描述..." });
        pin.type = 'complex'; 
        this.saveData();
        this.renderInterior(id); 
    },

    deleteFloor: function(id, index) {
        if (!this.mapData[id]?.floors?.[index] || !this.isEditing) return;
        if(confirm("确定删除吗？")) {
            this.worldData.maps[this.worldData.currentMapId].pins[id].floors.splice(index, 1);
            this.saveData();
            this.renderInterior(id);
            this.tracker?.render();
        }
    },

    uploadImage: function(id, field, input) {
        const world = this.worldData;
        const mapId = world.currentMapId;
        const pin = world.maps[mapId].pins[id];
        if (!pin || !['image', 'internalImage'].includes(field)) return;
        if (input.files && input.files[0]) {
            const file = input.files[0];
            compressImage(file, 600, 0.6).then((base64Data) => {
                if (this.worldData !== world || world.maps[mapId]?.pins[id] !== pin) return;
                pin[field] = base64Data;
                this.saveData();
                if (this.worldData.currentMapId !== mapId || this.popupTarget?.id !== id) return;
                if (field === 'image') this.renderPopup(id);
                if (field === 'internalImage') this.renderInterior(id);
            }).catch(err => {
                console.error("图片处理失败", err);
                alert("图片处理失败，请重试");
            }).finally(() => { input.value = ''; });
        }
    },
    
    // 背景图现在属于 Current Map
    changeBackground: function(input) {
        const world = this.worldData;
        const mapId = world.currentMapId;
        const target = world.maps[mapId];
        if (input.files && input.files[0]) {
            compressImage(input.files[0], 1024, 0.7).then(async (bgData) => {
                if (this.worldData !== world || world.maps[mapId] !== target) return;
                
                const previousBackground = target.background;
                target.background = bgData;
                const saved = await this.saveData();
                // A failed write must not leave a background that disappears on reload.
                if (!saved && target.background === bgData) target.background = previousBackground;
                if (this.worldData === world && world.maps[mapId] === target && world.currentMapId === mapId) await this.loadBackground();
            }).catch(error => alert('背景图片处理失败：' + error.message)).finally(() => { input.value = ''; });
        }
    },

    loadBackground: async function() {
        const currentMap = this.worldData.maps[this.worldData.currentMapId];
        let bg = currentMap.background;
        
        // 如果当前地图没背景，显示默认或空
        if (bg) {
            document.getElementById('general-map-container').style.backgroundImage = `url(${bg})`;
        } else {
             document.getElementById('general-map-container').style.backgroundImage = 'none';
        }
    },

    // ==========================================
    // 出行逻辑
    // ==========================================
    closeAllPopups: function() {
        if (document.getElementById('dynamic-popup')?.contains(document.activeElement)) document.activeElement.blur();
        this.popupTarget = null;
        $('#general-overlay').hide();
        $('#general-map-panel .general-popup').hide();
        $('#travel-menu-overlay').hide();
    },
    
    closeTravelMenu: function() {
        $('#travel-menu-overlay').hide();
    },

    showCustomTravelPopup: function() {
        const box = $('#travel-menu-overlay');
        box.find('.travel-options').html(`
            <p>请输入目的地名称：</p>
            <input type="text" id="custom-dest-input" class="travel-input" placeholder="例如：海边">
            <button class="general-btn" onclick="window.GeneralMap.openTravelMenu($('#custom-dest-input').val())">下一步</button>
        `);
        box.css('display', 'flex');
    },

    openTravelMenu: function(destination) {
        if(!destination) return alert("请输入目的地");
        this.tempTravelData.destination = destination;
        
        const box = $('#travel-menu-overlay');
        
        box.find('.travel-options').html(`
            <div class="gm-travel-destination">目的地：${Sanitize.encode(destination)}</div>
            
            <div class="gm-npc-option">
                <label style="display:flex; align-items:center; cursor:pointer;">
                    <input type="checkbox" id="meet-npc-toggle" onchange="window.GeneralMap.toggleNpcInput()">
                    <span style="margin-left:8px;">是否要遇见 NPC?</span>
                </label>
                <div id="npc-input-container" style="display:none; margin-top:8px;">
                    <input type="text" id="meet-npc-name" class="travel-input" style="margin:0; width:100%; box-sizing:border-box;" placeholder="输入 NPC 名字">
                </div>
            </div>

            <button class="general-btn gm-primary-button" onclick="window.GeneralMap.confirmTravel(true)">${GMIcon.label('user', '独自前往')}</button>
            <button class="general-btn" onclick="window.GeneralMap.showCompanionInput()">${GMIcon.label('users', '邀请某人一起前往')}</button>
            <button class="general-btn gm-text-button" onclick="window.GeneralMap.closeTravelMenu()">返回</button>
        `);
        box.css('display', 'flex');
    },

    toggleNpcInput: function() {
        const isChecked = document.getElementById('meet-npc-toggle').checked;
        const container = document.getElementById('npc-input-container');
        container.style.display = isChecked ? 'block' : 'none';
        if(isChecked) {
            document.getElementById('meet-npc-name').focus();
        }
    },

    showCompanionInput: function() {
        const npcToggle = document.getElementById('meet-npc-toggle');
        if(npcToggle) {
             this.tempTravelData.meetNPC = npcToggle.checked;
             this.tempTravelData.meetNPCName = $('#meet-npc-name').val() || '';
        }
        const destinationArg = Sanitize.jsArg(this.tempTravelData.destination);

        $('#travel-menu-overlay .travel-options').html(`
            <label class="gm-field-label" for="companion-name">和谁一起去？</label>
            <input type="text" id="companion-name" class="travel-input" placeholder="输入角色姓名">
            <button class="general-btn gm-primary-button" onclick="window.GeneralMap.confirmTravel(false)">下一步</button>
            <button class="general-btn gm-text-button" onclick="window.GeneralMap.openTravelMenu(${destinationArg})">返回</button>
        `);
    },

    confirmTravel: function(isAlone) {
        if (isAlone) {
             const npcToggle = document.getElementById('meet-npc-toggle');
             if(npcToggle) {
                 this.tempTravelData.meetNPC = npcToggle.checked;
                 this.tempTravelData.meetNPCName = $('#meet-npc-name').val() || '';
             }
        } else {
             const companionName = $('#companion-name').val();
             if (!companionName) return alert("请输入姓名");
             this.tempTravelData.companionName = companionName;
        }

        this.tempTravelData.isAlone = isAlone;
        this.showActivitySelection();
    },

    showActivitySelection: function() {
        const activities = ['闲逛', '吃饭', '喝酒', '约会', '睡觉', '做爱'];
        const box = $('#travel-menu-overlay');
        const destinationArg = Sanitize.jsArg(this.tempTravelData.destination);
        
        let html = `
            <div class="gm-travel-destination">在目的地做什么？</div>
            <div class="activity-grid">
        `;
        
        activities.forEach(act => {
            html += `<button class="general-btn" onclick="window.GeneralMap.finalizeTravel(${Sanitize.jsArg(act)})">${Sanitize.encode(act)}</button>`;
        });
        
        html += `
            </div>
            <div class="gm-custom-activity">
                <label class="gm-field-label" for="custom-activity">自定义活动</label>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="custom-activity" class="travel-input" style="margin:0; flex:1;" placeholder="例如：看电影">
                    <button class="general-btn gm-primary-button" onclick="window.GeneralMap.finalizeTravel($('#custom-activity').val())">确定</button>
                </div>
            </div>
            <button class="general-btn gm-text-button" onclick="window.GeneralMap.openTravelMenu(${destinationArg})">重选目的地</button>
        `;
        
        box.find('.travel-options').html(html);
    },

    finalizeTravel: function(activity) {
        if (!activity) return alert("请选择或输入活动内容");

        const { destination, isAlone, companionName, meetNPC, meetNPCName } = this.tempTravelData;
        const userPlaceholder = "{{user}}";
        
        let outputText = "";
        
        if (isAlone) {
            outputText += `${userPlaceholder} 决定独自前往 ${destination}`;
        } else {
            outputText += `${userPlaceholder} 邀请 ${companionName} 前往 ${destination}`;
        }

        if (meetNPC && meetNPCName) {
            outputText += `，并在那里遇见 ${meetNPCName}`;
        }

        outputText += `。活动内容：${activity}。`;

        const textarea = document.getElementById('send_textarea');
        if (textarea) {
            textarea.value = outputText;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.focus();
            this.closeAllPopups(); 
            $('#general-map-panel').fadeOut(gmAnimationDuration());
        } else {
            console.log("Mock Travel Command:", outputText);
            alert("指令已生成: " + outputText);
            this.closeAllPopups();
        }
    }
};

// ==========================================
// 初始化逻辑 (修复版)
// ==========================================

const initInterval = setInterval(() => {
    // 确保依赖项已加载
    if (window.SillyTavern && window.SillyTavern.getContext && window.jQuery) {
        clearInterval(initInterval);
        initializeExtension();
    }
}, 500);

async function initializeExtension() {
    console.log("[General Map] Starting Initialization...");
    window.GeneralMap.tracker?.destroy();

    // 1. 清理旧元素
    $('#general-map-panel').remove();
    $('#general-toggle-btn').remove();
    $('link[href*="General_Map/style.css"]').remove();

    // 2. 尝试加载 CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${extensionPath}/style.css`;
    document.head.appendChild(link);

    // 3. 计算按钮位置
    const togglePositionKey = 'general_map_toggle_position';
    const toggleButtonSize = 45;
    const toggleButtonMargin = 8;
    const clampNumber = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
    const clampTogglePosition = (left, top) => ({
        left: clampNumber(left, toggleButtonMargin, window.innerWidth - toggleButtonSize - toggleButtonMargin),
        top: clampNumber(top, toggleButtonMargin, window.innerHeight - toggleButtonSize - toggleButtonMargin),
    });
    const readSavedTogglePosition = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(togglePositionKey));
            if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
                return clampTogglePosition(saved.left, saved.top);
            }
        } catch (e) {}
        return null;
    };

    const savedTogglePosition = readSavedTogglePosition();
    const initialTogglePosition = savedTogglePosition || (
        window.innerWidth <= 768
            ? clampTogglePosition((window.innerWidth - toggleButtonSize) / 2, (window.innerHeight - toggleButtonSize) / 2)
            : clampTogglePosition(10, 130)
    );
    let defaultTop = `${initialTogglePosition.top}px`;
    let defaultLeft = `${initialTogglePosition.left}px`;
    let transformStyle = 'none';

    // 4. 插入 HTML
    // Only dynamic positioning stays inline; the visual system lives in style.css.
    const panelHTML = `
        <button id="general-toggle-btn" type="button" title="打开 General 地图" aria-label="打开 General 地图"
             style="top:${defaultTop}; left:${defaultLeft}; transform:${transformStyle};">
            ${GMIcon.svg('map')}
        </button>
        <div id="general-map-panel" style="display:none;" role="region" aria-label="General Map 互动地图">
            <div id="general-drag-handle">
                <span class="gm-brand-mark">${GMIcon.svg('map')}</span>
                <div class="gm-brand-text">
                    <span class="gm-brand-name">General Map</span>
                    <span class="gm-brand-caption">互动地图</span>
                    <small class="gm-brand-author">插件作者：JLYANG1900</small>
                </div>
                <button id="general-close-btn" type="button" title="关闭地图" aria-label="关闭地图">${GMIcon.svg('close')}</button>
            </div>
            <div id="general-content-area"><p class="gm-loading">正在加载地图…</p></div>
        </div>
    `;
    $('body').append(panelHTML);

    // ============================================================
    // 事件绑定区域
    // ============================================================
    const toggleBtn = $('#general-toggle-btn');
    const closeBtn = $('#general-close-btn');
    const panel = $('#general-map-panel');
    
    let isDragging = false;
    let suppressToggleClick = false;
    let lastDragEndAt = 0;

    const applyTogglePosition = (left, top) => {
        if (!toggleBtn[0]) return clampTogglePosition(left, top);
        const position = clampTogglePosition(left, top);
        toggleBtn.css({
            left: `${position.left}px`,
            top: `${position.top}px`,
            right: 'auto',
            bottom: 'auto',
            transform: 'none',
        });
        return position;
    };

    const syncToggleOpacity = () => {
        const button = toggleBtn[0];
        if (!button) return;
        const shouldBeOpaque = isDragging || (button && button.matches(':hover')) || document.activeElement === button;
        toggleBtn.css('opacity', shouldBeOpaque ? '1' : '0.55');
    };

    const saveTogglePosition = () => {
        if (!toggleBtn[0]) return;
        const rect = toggleBtn[0].getBoundingClientRect();
        const position = applyTogglePosition(rect.left, rect.top);
        try {
            localStorage.setItem(togglePositionKey, JSON.stringify({
                left: Math.round(position.left),
                top: Math.round(position.top),
            }));
        } catch (e) {}
    };

    const finishToggleDrag = () => {
        lastDragEndAt = Date.now();
        setTimeout(() => {
            isDragging = false;
            suppressToggleClick = false;
            toggleBtn.removeClass('general-toggle-dragging');
            syncToggleOpacity();
        }, 150);
    };

    const enableNativeToggleDrag = () => {
        const button = toggleBtn[0];
        let dragState = null;

        toggleBtn.on('pointerdown.generalMapToggleDrag', (event) => {
            const originalEvent = event.originalEvent;
            if (originalEvent.button !== undefined && originalEvent.button !== 0) return;

            const rect = button.getBoundingClientRect();
            applyTogglePosition(rect.left, rect.top);
            dragState = {
                pointerId: originalEvent.pointerId,
                startX: originalEvent.clientX,
                startY: originalEvent.clientY,
                offsetX: originalEvent.clientX - rect.left,
                offsetY: originalEvent.clientY - rect.top,
                moved: false,
            };

            if (button.setPointerCapture && originalEvent.pointerId !== undefined) {
                try { button.setPointerCapture(originalEvent.pointerId); } catch (e) {}
            }
        });

        toggleBtn.on('pointermove.generalMapToggleDrag', (event) => {
            if (!dragState) return;
            const originalEvent = event.originalEvent;
            if (dragState.pointerId !== undefined && originalEvent.pointerId !== dragState.pointerId) return;

            const deltaX = originalEvent.clientX - dragState.startX;
            const deltaY = originalEvent.clientY - dragState.startY;
            if (!dragState.moved && Math.hypot(deltaX, deltaY) < 4) return;

            dragState.moved = true;
            isDragging = true;
            suppressToggleClick = true;
            toggleBtn.addClass('general-toggle-dragging');
            toggleBtn.css('opacity', '1');
            applyTogglePosition(originalEvent.clientX - dragState.offsetX, originalEvent.clientY - dragState.offsetY);
            event.preventDefault();
            event.stopPropagation();
        });

        const endNativeDrag = (event) => {
            if (!dragState) return;
            const originalEvent = event.originalEvent;
            if (dragState.pointerId !== undefined && originalEvent.pointerId !== dragState.pointerId) return;

            const didMove = dragState.moved;
            if (button.releasePointerCapture && originalEvent.pointerId !== undefined) {
                try { button.releasePointerCapture(originalEvent.pointerId); } catch (e) {}
            }

            dragState = null;
            if (didMove) {
                saveTogglePosition();
                finishToggleDrag();
            } else {
                isDragging = false;
                suppressToggleClick = false;
                syncToggleOpacity();
            }
        };

        toggleBtn.on('pointerup.generalMapToggleDrag pointercancel.generalMapToggleDrag', endNativeDrag);
    };

    toggleBtn.on('mouseenter focusin', () => toggleBtn.css('opacity', '1'));
    toggleBtn.on('mouseleave focusout', syncToggleOpacity);
    $(window).off('resize.generalMapToggle').on('resize.generalMapToggle', () => saveTogglePosition());

    // 绑定关闭按钮
    closeBtn.on('click', (e) => {
        e.stopPropagation();
        panel.fadeOut(gmAnimationDuration());
    });

    // 绑定拖拽逻辑。入口按钮使用原生 Pointer Events，避免依赖 jQuery UI。
    enableNativeToggleDrag();

    // 地图面板固定在原位，不绑定拖拽事件。

    // 绑定点击开/关逻辑
    toggleBtn.on('click', (e) => {
        // 如果正在拖拽，或者刚拖拽完，则不执行点击
        if (isDragging || suppressToggleClick || Date.now() - lastDragEndAt < 250) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        panel.stop(true, true);
        if (panel.is(':visible')) {
            panel.fadeOut(gmAnimationDuration());
        } else {
            panel.fadeIn(gmAnimationDuration());
            window.GeneralMap.tracker?.refresh();
            // 重新获取焦点或检查内容
            if($.trim($('#general-content-area').text()) === "Loading...") {
                // 如果还显示 Loading，可能是初始化失败了，尝试重新显示错误信息
                console.log("Panel opened but content is still loading.");
            }
        }
    });

    // ============================================================
    // 5. 异步加载数据
    // ============================================================
    try {
        if (!window.GeneralMapTracking) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = `${extensionPath}/tracking.js`;
                script.onload = resolve;
                script.onerror = () => reject(new Error('无法加载 tracking.js，请检查插件文件是否完整'));
                document.head.appendChild(script);
            });
        }
        console.log(`[General Map] Fetching HTML from: ${extensionPath}/map.html`);
        const response = await fetch(`${extensionPath}/map.html`);
        
        if (!response.ok) {
            throw new Error(`无法加载地图文件 (Status: ${response.status})。请检查插件文件夹名称是否为 "General_Map"。`);
        }
        
        const htmlContent = await response.text();
        $('#general-content-area').html(htmlContent);
        
        // 初始化 JS 数据
        await window.GeneralMap.init();
        console.log("[General Map] Initialization Complete.");

    } catch (e) {
        console.error("[General Map] Error:", e);
        // Keep startup errors in the same scoped surface as the map.
        $('#general-content-area').html(`
            <div class="gm-startup-error">
                <h3 class="gm-inline-label">${GMIcon.label('warning', '启动失败')}</h3>
                <p>${Sanitize.encode(e.message)}</p>
                <div class="gm-field-label">
                    提示：请确保插件安装路径为:<br>
                    <code>.../extensions/third-party/General_Map</code>
                </div>
                <button class="general-btn danger" onclick="window.GeneralMap.resetData()">尝试重置数据</button>
            </div>
        `);
    }
}
