const extensionName = "General_Map";
const extensionPath = `scripts/extensions/third-party/${extensionName}`;

let stContext = null;

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
    }
};

// ==========================================
// 工具 2: 图片压缩
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
            
            request.onerror = (event) => reject("DB Open Error");
        });
    },

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
    // 临时存储出行信息
    tempTravelData: {
        isAlone: true,
        companionName: '',
        meetNPC: false,
        meetNPCName: '',
        destination: ''
    },
    
    init: async function() {
        await this.loadTheme(); 
        await this.loadData();
        this.renderMapPins();
        await this.loadBackground();
    },

    // ==========================================
    // 主题管理
    // ==========================================
    loadTheme: async function() {
        let savedColor = await SimpleDB.getItem('general_map_theme');
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
        
        SimpleDB.setItem('general_map_theme', color);
    },

    // ==========================================
    // 数据加载、保存与备份
    // ==========================================
    loadData: async function() {
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
            await SimpleDB.setItem('general_map_data_v2', this.mapData);
        } catch (e) {
            console.error("保存失败", e);
            alert("保存数据时发生错误：" + e.message);
        }
    },

    resetData: async function() {
        if(confirm("确定要重置所有地图数据吗？")) {
            await SimpleDB.removeItem('general_map_data_v2');
            localStorage.removeItem('general_map_data_v2'); 
            await this.loadData();
            this.renderMapPins();
            alert("数据已重置。");
        }
    },

    // 导出备份
    exportBackup: async function() {
        try {
            const dataStr = JSON.stringify(this.mapData, null, 2);
            const blob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0,10);
            a.download = `General_Map_Backup_${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("导出失败: " + e.message);
        }
    },

    // 导入备份
    importBackup: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (typeof json !== 'object' || Object.keys(json).length === 0) {
                        throw new Error("无效的地图数据格式");
                    }

                    if (confirm("导入备份将覆盖当前的地图数据，确定继续吗？")) {
                        this.mapData = json;
                        await this.saveData(); 
                        this.renderMapPins();
                        this.closeAllPopups();
                        alert("备份导入成功！");
                    }
                } catch (err) {
                    console.error(err);
                    alert("导入失败：文件格式错误或已损坏。");
                }
                input.value = '';
            };
            reader.readAsText(input.files[0]);
        }
    },

    // ==========================================
    // 地图渲染与交互 (包含移动端拖拽支持)
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
            div.innerHTML = `<span class="label">${Sanitize.encode(loc.name)}</span>`;
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
        let hasMoved = false; // 用于区分点击和拖拽
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
                this.mapData[id].x = pctX;
                this.mapData[id].y = pctY;
                this.saveData();
            }
            isDragging = false;
            elm.classList.remove('dragging');
        };

        // --- 触摸事件 (移动端) ---
        const touchStartHandler = (e) => {
            if (this.isEditing) {
                isDragging = true;
                elm.classList.add('dragging');
                // 获取第一个触摸点
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                initialLeft = elm.offsetLeft;
                initialTop = elm.offsetTop;
                hasMoved = false;
                // 注意：这里不要立即 preventDefault，否则无法触发点击
            }
        };

        const touchMoveHandler = (e) => {
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            
            // 只有移动超过阈值才视为拖拽，并阻止滚动
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
                if (e.cancelable) e.preventDefault(); // 阻止屏幕跟随手指滚动
            }

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            // 边界检查
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
                this.mapData[id].x = pctX;
                this.mapData[id].y = pctY;
                this.saveData();
            }
            
            isDragging = false;
            elm.classList.remove('dragging');
        };

        // 绑定 PC 鼠标全局监听
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);

        // 绑定 移动端 触摸监听 (passive: false 允许 preventDefault)
        elm.addEventListener('touchstart', touchStartHandler, { passive: false });
        elm.addEventListener('touchmove', touchMoveHandler, { passive: false });
        elm.addEventListener('touchend', touchEndHandler);
        elm.addEventListener('touchcancel', touchEndHandler);

        // 点击事件：如果是拖拽结束，阻止点击弹窗
        elm.onclick = (e) => {
            if (hasMoved) { 
                hasMoved = false; 
                e.preventDefault(); 
                e.stopPropagation();
                return; 
            }
            
            if (id === 'other-places') {
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
        const data = this.mapData[id];
        if (!data) return;
        
        const popup = document.getElementById('dynamic-popup');
        const content = document.getElementById('popup-content');
        const overlay = document.getElementById('general-overlay');

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <h3 contenteditable="${this.isEditing}" class="editable-text" style="flex:1" onblur="window.GeneralMap.updateField('${id}', 'name', this.innerText)">${Sanitize.encode(data.name)}</h3>
                ${this.isEditing ? `<button class="general-btn small danger" onclick="window.GeneralMap.deletePin('${id}')">🗑️ 删除</button>` : ''}
            </div>
            
            <p contenteditable="${this.isEditing}" class="editable-text" onblur="window.GeneralMap.updateField('${id}', 'desc', this.innerText)">${Sanitize.encode(data.desc || "暂无描述")}</p>
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
        
        html += `<button class="general-btn" onclick="window.GeneralMap.openTravelMenu('${Sanitize.encode(data.name)}')">🚀 前往此处</button>`;
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
            <h3><span onclick="window.GeneralMap.renderPopup('${id}')" style="cursor:pointer; opacity:0.7">⬅️</span> ${Sanitize.encode(data.name)} - 内部</h3>
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
                        ${Sanitize.encode(floor.name)}
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
            <h3><span onclick="window.GeneralMap.renderInterior('${id}')" style="cursor:pointer; opacity:0.7">⬅️</span> ${Sanitize.encode(floor.name)}</h3>
            <p style="font-size:12px; color:#888;">名称 (可编辑):</p>
            <div contenteditable="${this.isEditing}" class="editable-text" style="font-size:16px; margin-bottom:10px;"
                 onblur="window.GeneralMap.updateFloor('${id}', ${floorIndex}, 'name', this.innerText)">${Sanitize.encode(floor.name)}</div>
            
            <p style="font-size:12px; color:#888;">描述 (可编辑):</p>
            <div contenteditable="${this.isEditing}" class="editable-text" style="min-height:50px; margin-bottom:15px;"
                 onblur="window.GeneralMap.updateFloor('${id}', ${floorIndex}, 'content', this.innerText)">${Sanitize.encode(floor.content || "点击添加描述...")}</div>
        `;
        
        if (floor.subItems && floor.subItems.length > 0) {
            html += `<h4>包含区域:</h4><div style="display:flex; flex-wrap:wrap; gap:5px;">`;
            floor.subItems.forEach(item => {
                html += `<button class="general-btn small">${Sanitize.encode(item)}</button>`;
            });
            html += `</div>`;
        }
        
        html += `<div style="text-align:center; margin-top:20px;">
                    <button class="general-btn" onclick="window.GeneralMap.openTravelMenu('${Sanitize.encode(floor.name)}')">🚀 前往此处</button>
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

    loadBackground: async function() {
        let bg = await SimpleDB.getItem('general_map_bg_v2');
        if (!bg) bg = localStorage.getItem('general_map_bg_v2'); 
        if (bg) document.getElementById('general-map-container').style.backgroundImage = `url(${bg})`;
    },

    // ==========================================
    // 出行逻辑 (V6 Update: NPC & Activity)
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

    // 1. 打开目的地界面
    openTravelMenu: function(destination) {
        if(!destination) return alert("请输入目的地");
        this.tempTravelData.destination = destination;
        
        const box = $('#travel-menu-overlay');
        
        // [新增] 遇见 NPC 选项
        box.find('.travel-options').html(`
            <div style="margin-bottom:10px; font-weight:bold; color:var(--theme-color);">目的地：${Sanitize.encode(destination)}</div>
            
            <div style="margin-bottom:15px; text-align:left; background:rgba(0,0,0,0.3); padding:10px; border-radius:4px;">
                <label style="display:flex; align-items:center; cursor:pointer;">
                    <input type="checkbox" id="meet-npc-toggle" onchange="window.GeneralMap.toggleNpcInput()">
                    <span style="margin-left:8px; color:#dcdcdc;">是否要遇见 NPC?</span>
                </label>
                <div id="npc-input-container" style="display:none; margin-top:8px;">
                    <input type="text" id="meet-npc-name" class="travel-input" style="margin:0; width:100%; box-sizing:border-box;" placeholder="输入 NPC 名字">
                </div>
            </div>

            <button class="general-btn" onclick="window.GeneralMap.confirmTravel(true)">👤 独自前往</button>
            <button class="general-btn" onclick="window.GeneralMap.showCompanionInput()">👥 邀请某人一起前往</button>
            <button class="general-btn" style="margin-top: 10px; border-color: #666; color: #888;" onclick="window.GeneralMap.closeTravelMenu()">返回</button>
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
        // 在进入同伴输入前，先保存一下 NPC 状态（如果有的话），或者直接在 confirmTravel 里统一获取
        // 这里为了简化流程，我们假设用户已经填好了 NPC 状态，点击“邀请某人”是中间步骤
        
        // 保存当前 NPC 设置到 temp
        const npcToggle = document.getElementById('meet-npc-toggle');
        if(npcToggle) {
             this.tempTravelData.meetNPC = npcToggle.checked;
             this.tempTravelData.meetNPCName = $('#meet-npc-name').val() || '';
        }

        $('#travel-menu-overlay .travel-options').html(`
            <p style="color: #888; margin: 0 0 10px 0;">和谁一起去？</p>
            <input type="text" id="companion-name" class="travel-input" placeholder="输入角色姓名">
            <button class="general-btn" onclick="window.GeneralMap.confirmTravel(false)">下一步</button>
            <button class="general-btn" style="margin-top: 10px; border-color: #666; color: #888;" onclick="window.GeneralMap.openTravelMenu('${Sanitize.encode(this.tempTravelData.destination)}')">返回</button>
        `);
    },

    // 2. 确认出行方式（独自/陪伴），进入活动选择
    confirmTravel: function(isAlone) {
        // 如果是从主菜单直接点击“独自前往”，需要获取 NPC 数据
        if (isAlone) {
             const npcToggle = document.getElementById('meet-npc-toggle');
             if(npcToggle) {
                 this.tempTravelData.meetNPC = npcToggle.checked;
                 this.tempTravelData.meetNPCName = $('#meet-npc-name').val() || '';
             }
        } else {
             // 如果是同伴模式，名字在 companion-input 里
             const companionName = $('#companion-name').val();
             if (!companionName) return alert("请输入姓名");
             this.tempTravelData.companionName = companionName;
        }

        this.tempTravelData.isAlone = isAlone;
        this.showActivitySelection();
    },

    // 3. [新增] 活动选择弹窗
    showActivitySelection: function() {
        const activities = ['闲逛', '吃饭', '喝酒', '约会', '睡觉', '做爱'];
        const box = $('#travel-menu-overlay');
        
        let html = `
            <div style="margin-bottom:10px; font-weight:bold; color:var(--theme-color);">在目的地做什么？</div>
            <div class="activity-grid">
        `;
        
        activities.forEach(act => {
            html += `<button class="general-btn" onclick="window.GeneralMap.finalizeTravel('${act}')">${act}</button>`;
        });
        
        html += `
            </div>
            <div style="margin-top:15px; border-top:1px solid #444; padding-top:10px; text-align:left;">
                <p style="margin:0 0 5px 0; font-size:12px; color:#888;">自定义活动：</p>
                <div style="display:flex; gap:5px;">
                    <input type="text" id="custom-activity" class="travel-input" style="margin:0; flex:1;" placeholder="例如：看电影">
                    <button class="general-btn" onclick="window.GeneralMap.finalizeTravel($('#custom-activity').val())">确定</button>
                </div>
            </div>
            <button class="general-btn" style="margin-top: 15px; width:100%; border-color: #666; color: #888;" onclick="window.GeneralMap.openTravelMenu('${Sanitize.encode(this.tempTravelData.destination)}')">重选目的地</button>
        `;
        
        box.find('.travel-options').html(html);
    },

    // 4. 生成最终文本并执行
    finalizeTravel: function(activity) {
        if (!activity) return alert("请选择或输入活动内容");

        const { destination, isAlone, companionName, meetNPC, meetNPCName } = this.tempTravelData;
        const userPlaceholder = "{{user}}";
        
        let outputText = "";
        
        // 构建第一部分：去哪里
        if (isAlone) {
            outputText += `${userPlaceholder} 决定独自前往 ${destination}`;
        } else {
            outputText += `${userPlaceholder} 邀请 ${companionName} 前往 ${destination}`;
        }

        // 构建第二部分：遇见NPC
        if (meetNPC && meetNPCName) {
            outputText += `，并打算在那里见 ${meetNPCName}`;
        }

        // 构建第三部分：活动
        // 简单自然语言拼接
        outputText += `。活动内容：${activity}。`;

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
    console.log("[General Map] Initializing V7 (Features Added)...");

    $('#general-map-panel').remove();
    $('#general-toggle-btn').remove();
    $('link[href*="General_Map/style.css"]').remove();

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${extensionPath}/style.css`;
    document.head.appendChild(link);

    // [新增] 悬挂小图标逻辑 - 移动端默认居中
    let defaultTop = '130px';
    let defaultLeft = '10px';
    let transformStyle = '';
    
    // 简单判断是否移动端 (屏幕宽度小于 768px)
    if (window.innerWidth <= 768) {
        defaultTop = '50%';
        defaultLeft = '50%';
        transformStyle = 'translate(-50%, -50%)';
    }

    const panelHTML = `
        <div id="general-toggle-btn" title="打开 General 地图" 
             style="position:fixed; top:${defaultTop}; left:${defaultLeft}; transform:${transformStyle}; z-index:9000; width:45px; height:45px; background:#b38b59; border-radius:50%; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.5); color:#fff; font-size:22px;">
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
        await window.GeneralMap.init();

    } catch (e) {
        console.error("[General Map] Error:", e);
        $('#general-content-area').html(`<p style="padding:20px; color:white;">加载失败: ${e.message}</p>`);
    }

    // [新增] 悬挂图标拖拽逻辑
    const toggleBtn = $('#general-toggle-btn');
    let isDraggingIcon = false;

    if ($.fn.draggable) {
        toggleBtn.draggable({
            containment: "window",
            scroll: false,
            start: function() {
                isDraggingIcon = true;
            },
            stop: function() {
                // 延迟重置状态，防止拖拽结束时立即触发 click
                setTimeout(() => {
                    isDraggingIcon = false;
                }, 100);
            }
        });
    }

    toggleBtn.on('click', () => {
        if (isDraggingIcon) return; // 如果是拖拽结束，不触发点击
        
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
