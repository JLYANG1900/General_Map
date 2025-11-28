const extensionName = "General_Map";
const extensionPath = `scripts/extensions/third-party/${extensionName}`;

let stContext = null;

// ==========================================
// 工具 1: 图片压缩 (保留之前的优化)
// ==========================================
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

// ==========================================
// 工具 2: IndexedDB 简易封装 (解决 5MB 限制)
// ==========================================
const dbName = "GeneralMapDB_V1";
const storeName = "settings";

const SimpleDB = {
    db: null,
    
    // 打开数据库
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
            
            request.onerror = (event) => reject("DB Open Error");
        });
    },

    // 获取数据 (替代 localStorage.getItem)
    getItem: async function(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    },

    // 保存数据 (替代 localStorage.setItem)
    setItem: async function(key, value) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put(value, key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },
    
    // 删除数据
    removeItem: async function(key) {
        await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
};

// ==========================================
// 默认数据
// ==========================================
const defaultMapData = {
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

// 全局状态
window.GeneralMap = {
    mapData: {},         
    isEditing: false,    
    currentDestination: '',
    themeColor: '#b38b59', 
    
    // [修改] init 变为 async
    init: async function() {
        await this.loadTheme(); 
        await this.loadData();
        this.renderMapPins();
        await this.loadBackground();
    },

    // ==========================================
    // 主题管理 (改为异步)
    // ==========================================
    loadTheme: async function() {
        // 尝试从 DB 读取
        let savedColor = await SimpleDB.getItem('general_map_theme');
        // 兼容旧版 localStorage (如果 DB 没有，尝试读旧的并迁移)
        if (!savedColor) {
            savedColor = localStorage.getItem('general_map_theme');
        }
        
        if (savedColor) {
            this.applyTheme(savedColor);
            const picker = document.getElementById('theme-color-picker');
            if(picker) picker.value = savedColor;
        }
    },

    applyTheme: function(color) {
        this.themeColor = color;
        document.documentElement.style.setProperty('--theme-color', color);
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        document.documentElement.style.setProperty('--theme-bg-opacity', `rgba(${r}, ${g}, ${b}, 0.3)`);
        
        // [修改] 保存到 DB
        SimpleDB.setItem('general_map_theme', color);
    },

    // ==========================================
    // 数据加载与保存 (核心修改)
    // ==========================================
    loadData: async function() {
        // [修改] 从 DB 读取
        let rawData = await SimpleDB.getItem('general_map_data_v2');
        
        // 迁移逻辑：如果 DB 没数据，试试 LocalStorage
        if (!rawData) {
            rawData = localStorage.getItem('general_map_data_v2');
            if (rawData) {
                // 如果发现旧数据，自动迁移到新 DB
                try {
                    await SimpleDB.setItem('general_map_data_v2', rawData);
                    console.log("已将旧数据迁移至 IndexedDB");
                } catch(e) {}
            }
        }

        if (rawData) {
            try {
                this.mapData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
                for (let key in defaultMapData) {
                    if (!this.mapData[key]) this.mapData[key] = defaultMapData[key];
                }
            } catch (e) {
                console.error("数据损坏，重置为默认", e);
                this.mapData = JSON.parse(JSON.stringify(defaultMapData));
            }
        } else {
            this.mapData = JSON.parse(JSON.stringify(defaultMapData));
        }
    },

    saveData: async function() {
        try {
            // [修改] 保存到 DB (支持大文件)
            // 这里不需要 JSON.stringify，IndexedDB 可以直接存对象
            // 但为了保持逻辑兼容，存对象即可，不用 stringify
            await SimpleDB.setItem('general_map_data_v2', this.mapData);
        } catch (e) {
            console.error("保存失败", e);
            alert("保存数据时发生错误：" + e.message);
        }
    },

    resetData: async function() {
        if(confirm("确定要重置所有地图数据吗？")) {
            await SimpleDB.removeItem('general_map_data_v2');
            localStorage.removeItem('general_map_data_v2'); // 清理旧的
            await this.loadData();
            this.renderMapPins();
            alert("数据已重置。");
        }
    },

    // ==========================================
    // 地图渲染 (保持不变)
    // ==========================================
    renderMapPins: function() {
        const container = document.getElementById('general-map-container');
        container.querySelectorAll('.location').forEach(el => el.remove());

        Object.values(this.mapData).forEach(loc => {
            const div = document.createElement('div');
            div.className = 'location';
            div.id = `pin-${loc.id}`;
            div.style.left = loc.x;
            div.style.top = loc.y;
            if (loc.color) div.style.color = loc.color;
            div.innerHTML = `<span class="label">${loc.name}</span>`;
            this.bindPinEvents(div, loc.id);
            container.appendChild(div);
        });
    },

    addNewPin: function() {
        if (!this.isEditing) {
            document.getElementById('edit-mode-toggle').click();
        }
        const id = 'custom-' + Date.now();
        this.mapData[id] = {
            id: id,
            name: "新地点",
            x: "50%", 
            y: "50%", 
            desc: "点击编辑描述", 
            type: "simple", 
            color: this.themeColor 
        };
        this.saveData();
        this.renderMapPins();
        setTimeout(() => this.renderPopup(id), 100);
    },

    deletePin: function(id) {
        if (confirm("确定要永久删除这个地点吗？")) {
            delete this.mapData[id];
            this.saveData();
            this.renderMapPins();
            this.closeAllPopups();
        }
    },

    bindPinEvents: function(elm, id) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false;
        const container = document.getElementById('general-map-container');

        elm.onmousedown = (e) => {
            if (this.isEditing) {
                isDragging = true;
                elm.classList.add('dragging');
                startX = e.clientX;
                startY = e.clientY;
                initialLeft = elm.offsetLeft;
                initialTop = elm.offsetTop;
                e.preventDefault();
                e.stopPropagation();
            }
        };

        const moveHandler = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            newLeft = Math.max(0, Math.min(newLeft, container.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, container.offsetHeight));
            elm.style.left = newLeft + 'px';
            elm.style.top = newTop + 'px';
            hasMoved = true;
        };

        const upHandler = () => {
            if (isDragging && hasMoved) {
                const pctX = (elm.offsetLeft / container.offsetWidth * 100).toFixed(1) + '%';
                const pctY = (elm.offsetTop / container.offsetHeight * 100).toFixed(1) + '%';
                this.mapData[id].x = pctX;
                this.mapData[id].y = pctY;
                this.saveData();
            }
            isDragging = false;
            elm.classList.remove('dragging');
        };

        document.addEventListener('mousemove', moveHandler);
        document.addEventListener('mouseup', upHandler);

        elm.onclick = (e) => {
            if (hasMoved) { hasMoved = false; return; }
            if (id === 'other-places') {
                this.showCustomTravelPopup();
            } else {
                this.renderPopup(id);
            }
        };
        
        elm.ondblclick = (e) => {
             this.renderPopup(id);
        }
    },

    renderPopup: function(id) {
        const data = this.mapData[id];
        if (!data) return;
        
        const popup = document.getElementById('dynamic-popup');
        const content = document.getElementById('popup-content');
        const overlay = document.getElementById('general-overlay');

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <h3 contenteditable="${this.isEditing}" class="editable-text" style="flex:1" onblur="window.GeneralMap.updateField('${id}', 'name', this.innerText)">${data.name}</h3>
                ${this.isEditing ? `<button class="general-btn small danger" onclick="window.GeneralMap.deletePin('${id}')">🗑️ 删除</button>` : ''}
            </div>
            
            <p contenteditable="${this.isEditing}" class="editable-text" onblur="window.GeneralMap.updateField('${id}', 'desc', this.innerText)">${data.desc || "暂无描述"}</p>
        `;

        if (data.image) {
            html += `<img src="${data.image}" class="popup-image">`;
        } else if (this.isEditing) {
            html += `<div style="border:1px dashed #666; padding:20px; text-align:center; color:#666">暂无封面图</div>`;
        }

        if (this.isEditing) {
            html += `
                <div class="edit-controls">
                    <button class="general-btn small" onclick="document.getElementById('img-upload-${id}').click()">📷 更换封面</button>
                    <input type="file" id="img-upload-${id}" style="display:none" accept="image/*" onchange="window.GeneralMap.uploadImage('${id}', 'image', this)">
                    ${data.image ? `<button class="general-btn small danger" onclick="window.GeneralMap.updateField('${id}', 'image', '')">🗑️ 删除图</button>` : ''}
                </div>
            `;
        }

        html += `<div style="text-align:center; margin-top:15px; display:flex; gap:10px; justify-content:center;">`;
        if (data.type === 'complex' || (this.isEditing && data.floors)) {
            html += `<button class="general-btn" onclick="window.GeneralMap.renderInterior('${id}')">🚪 进入内部</button>`;
        } else if (this.isEditing) {
            html += `<button class="general-btn small" onclick="window.GeneralMap.addFloor('${id}')">➕ 添加楼层/区域</button>`;
        }
        
        html += `<button class="general-btn" onclick="window.GeneralMap.openTravelMenu('${data.name}')">🚀 前往此处</button>`;
        html += `</div>`;

        content.innerHTML = html;
        popup.style.display = 'block';
        overlay.style.display = 'block';
    },

    renderInterior: function(id) {
        const data = this.mapData[id];
        const content = document.getElementById('popup-content');
        if (!data.floors) data.floors = [];

        let html = `
            <h3><span onclick="window.GeneralMap.renderPopup('${id}')" style="cursor:pointer; opacity:0.7">⬅️</span> ${data.name} - 内部</h3>
            <div class="interior-container">
        `;
        if (data.internalImage) {
            html += `<img src="${data.internalImage}" class="interior-image">`;
        } else {
            html += `<div style="height:200px; display:flex; align-items:center; justify-content:center; color:#666;">暂无内部示意图</div>`;
        }

        html += `<div class="floor-nav">`;
        data.floors.forEach((floor, index) => {
            html += `
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:4px;">
                    <button class="floor-btn" style="flex:1" onclick="window.GeneralMap.showFloorDetail('${id}', ${index})">
                        ${floor.name}
                    </button>
                    ${this.isEditing ? `
                        <button class="general-btn small danger" onclick="window.GeneralMap.deleteFloor('${id}', ${index})">×</button>
                    ` : ''}
                </div>
            `;
        });
        
        if (this.isEditing) {
            html += `<button class="general-btn small" style="width:100%; margin-top:10px;" onclick="window.GeneralMap.addFloor('${id}')">➕ 新增区域</button>`;
            html += `
                <div style="margin-top:10px; border-top:1px dashed #444; padding-top:5px;">
                    <button class="general-btn small" onclick="document.getElementById('int-img-${id}').click()">📷 更换内部图</button>
                    <input type="file" id="int-img-${id}" style="display:none" accept="image/*" onchange="window.GeneralMap.uploadImage('${id}', 'internalImage', this)">
                </div>
            `;
        }
        html += `</div></div>`; 
        content.innerHTML = html;
    },

    showFloorDetail: function(id, floorIndex) {
        const floor = this.mapData[id].floors[floorIndex];
        const content = document.getElementById('popup-content');
        
        let html = `
            <h3><span onclick="window.GeneralMap.renderInterior('${id}')" style="cursor:pointer; opacity:0.7">⬅️</span> ${floor.name}</h3>
            <p style="font-size:12px; color:#888;">名称 (可编辑):</p>
            <div contenteditable="${this.isEditing}" class="editable-text" style="font-size:16px; margin-bottom:10px;"
                 onblur="window.GeneralMap.updateFloor('${id}', ${floorIndex}, 'name', this.innerText)">${floor.name}</div>
            
            <p style="font-size:12px; color:#888;">描述 (可编辑):</p>
            <div contenteditable="${this.isEditing}" class="editable-text" style="min-height:50px; margin-bottom:15px;"
                 onblur="window.GeneralMap.updateFloor('${id}', ${floorIndex}, 'content', this.innerText)">${floor.content || "点击添加描述..."}</div>
        `;
        
        if (floor.subItems && floor.subItems.length > 0) {
            html += `<h4>包含区域:</h4><div style="display:flex; flex-wrap:wrap; gap:5px;">`;
            floor.subItems.forEach(item => {
                html += `<button class="general-btn small">${item}</button>`;
            });
            html += `</div>`;
        }
        
        html += `<div style="text-align:center; margin-top:20px;">
                    <button class="general-btn" onclick="window.GeneralMap.openTravelMenu('${floor.name}')">🚀 前往此处</button>
                 </div>`;

        content.innerHTML = html;
    },

    toggleEditMode: function() {
        this.isEditing = !this.isEditing;
        const checkbox = document.getElementById('edit-mode-toggle');
        if (checkbox) checkbox.checked = this.isEditing;
        
        const body = document.body;
        const label = document.getElementById('edit-mode-label');
        if (this.isEditing) {
            body.classList.add('general-editing-active');
            label.innerText = "✏️ 编辑中...";
            label.style.color = this.themeColor;
        } else {
            body.classList.remove('general-editing-active');
            label.innerText = "✏️ 编辑模式";
            label.style.color = "#888";
        }
    },

    updateField: function(id, field, value) {
        if (!this.mapData[id]) return;
        this.mapData[id][field] = value;
        this.saveData();
        if (field === 'name') this.renderMapPins();
    },

    updateFloor: function(id, floorIndex, field, value) {
        if (!this.mapData[id] || !this.mapData[id].floors[floorIndex]) return;
        this.mapData[id].floors[floorIndex][field] = value;
        this.saveData();
    },

    addFloor: function(id) {
        if (!this.mapData[id].floors) this.mapData[id].floors = [];
        this.mapData[id].floors.push({ name: "新区域 " + (this.mapData[id].floors.length + 1), content: "描述..." });
        this.mapData[id].type = 'complex'; 
        this.saveData();
        this.renderInterior(id); 
    },

    deleteFloor: function(id, index) {
        if(confirm("确定删除吗？")) {
            this.mapData[id].floors.splice(index, 1);
            this.saveData();
            this.renderInterior(id);
        }
    },

    // [修改] 结合压缩 + DB 存储
    uploadImage: function(id, field, input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            compressImage(file, 600, 0.6).then((base64Data) => {
                this.mapData[id][field] = base64Data;
                this.saveData();
                if (field === 'image') this.renderPopup(id);
                if (field === 'internalImage') this.renderInterior(id);
            }).catch(err => {
                console.error("图片处理失败", err);
                alert("图片处理失败，请重试");
            });
        }
    },
    
    // [修改] 背景图存储到 DB
    changeBackground: function(input) {
        if (input.files && input.files[0]) {
            compressImage(input.files[0], 1024, 0.7).then(async (bgData) => {
                document.getElementById('general-map-container').style.backgroundImage = `url(${bgData})`;
                try {
                    await SimpleDB.setItem('general_map_bg_v2', bgData);
                } catch (e) {
                     alert("背景图保存失败：" + e.message);
                }
            });
        }
    },

    // [修改] 从 DB 加载背景
    loadBackground: async function() {
        let bg = await SimpleDB.getItem('general_map_bg_v2');
        if (!bg) bg = localStorage.getItem('general_map_bg_v2'); // 兼容旧版
        if (bg) document.getElementById('general-map-container').style.backgroundImage = `url(${bg})`;
    },

    // ==========================================
    // 出行逻辑
    // ==========================================
    closeAllPopups: function() {
        $('#general-overlay').hide();
        $('.general-popup').hide();
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
        this.currentDestination = destination;
        const box = $('#travel-menu-overlay');
        
        box.find('.travel-options').html(`
            <div style="margin-bottom:10px; font-weight:bold; color:var(--theme-color);">目的地：${destination}</div>
            <button class="general-btn" onclick="window.GeneralMap.confirmTravel(true)">👤 独自前往</button>
            <button class="general-btn" onclick="window.GeneralMap.showCompanionInput()">👥 邀请某人一起前往</button>
            <button class="general-btn" style="margin-top: 10px; border-color: #666; color: #888;" onclick="window.GeneralMap.closeTravelMenu()">返回</button>
        `);
        box.css('display', 'flex');
    },

    showCompanionInput: function() {
        $('#travel-menu-overlay .travel-options').html(`
            <p style="color: #888; margin: 0 0 10px 0;">和谁一起去？</p>
            <input type="text" id="companion-name" class="travel-input" placeholder="输入角色姓名">
            <button class="general-btn" onclick="window.GeneralMap.confirmTravel(false)">🚀 前往</button>
            <button class="general-btn" style="margin-top: 10px; border-color: #666; color: #888;" onclick="window.GeneralMap.openTravelMenu('${this.currentDestination}')">返回</button>
        `);
    },

    confirmTravel: function(isAlone) {
        const destination = this.currentDestination;
        const userPlaceholder = "{{user}}"; 
        let outputText = "";
        
        if (isAlone) {
             outputText = `${userPlaceholder} 决定独自前往${destination}。`;
        } else {
             const companionName = $('#companion-name').val();
             if (!companionName) return alert("请输入姓名");
             outputText = `${userPlaceholder} 邀请 ${companionName} 前往 ${destination}`;
        }
        
        if (stContext) {
            stContext.executeSlashCommandsWithOptions(`/setinput ${outputText}`);
            this.closeAllPopups(); 
            $('#general-map-panel').fadeOut(); 
        } else {
            console.log("Mock Travel Command:", outputText);
            alert("指令已生成: " + outputText);
            this.closeAllPopups();
        }
    }
};

// ==========================================
// 初始化逻辑
// ==========================================

const initInterval = setInterval(() => {
    if (window.SillyTavern && window.SillyTavern.getContext && window.jQuery) {
        clearInterval(initInterval);
        stContext = window.SillyTavern.getContext();
        initializeExtension();
    }
}, 500);

async function initializeExtension() {
    console.log("[General Map] Initializing V4 (IndexedDB)...");

    $('#general-map-panel').remove();
    $('#general-toggle-btn').remove();
    $('link[href*="General_Map/style.css"]').remove();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${extensionPath}/style.css`;
    document.head.appendChild(link);

    const panelHTML = `
        <div id="general-toggle-btn" title="打开 General 地图" 
             style="position:fixed; top:130px; left:10px; z-index:9000; width:40px; height:40px; background:#b38b59; border-radius:50%; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); color:#fff; font-size:20px;">
            🗺️
        </div>
        <div id="general-map-panel">
            <div id="general-drag-handle">
                <span>General 档案地图</span>
                <span id="general-close-btn">❌</span>
            </div>
            <div id="general-content-area">Loading...</div>
        </div>
    `;
    $('body').append(panelHTML);

    try {
        const response = await fetch(`${extensionPath}/map.html`);
        if (!response.ok) throw new Error("Map file not found");
        const htmlContent = await response.text();
        $('#general-content-area').html(htmlContent);
        // 初始化现在是异步的
        await window.GeneralMap.init();

    } catch (e) {
        console.error("[General Map] Error:", e);
        $('#general-content-area').html(`<p style="padding:20px; color:white;">加载失败: ${e.message}</p>`);
    }

    $('#general-toggle-btn').on('click', () => {
        const panel = $('#general-map-panel');
        if (panel.is(':visible')) {
            panel.fadeOut();
        } else {
            panel.fadeIn();
        }
    });
    
    $('#general-close-btn').on('click', () => $('#general-map-panel').fadeOut());

    if ($.fn.draggable) {
        $('#general-map-panel').draggable({ 
            handle: '#general-drag-handle',
            containment: 'window'
        });
    }
}
