const extensionName = "General_Map";
const extensionPath = `scripts/extensions/third-party/${extensionName}`;

let stContext = null;

// ==========================================
// 1. 默认数据定义 (Default Data)
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
    backgroundImage: null, // 新增：背景图也存入内存状态
    
    // 初始化
    init: function() {
        // 尝试加载数据
        this.loadSettingsFromServer();
        
        this.renderMapPins();
        // 渲染背景 (注意：现在背景也是从 Server 加载的)
        this.renderBackground(); 
    },

    // ==========================================
    // 服务端数据同步 (Full Sync V7)
    // ==========================================
    
    // 从服务器加载设置
    loadSettingsFromServer: function() {
        // 1. 尝试从全局 extension_settings 获取
        let settings = null;
        if (typeof extension_settings !== 'undefined' && extension_settings[extensionName]) {
            settings = extension_settings[extensionName];
        } else if (stContext && stContext.extensionSettings && stContext.extensionSettings[extensionName]) {
            settings = stContext.extensionSettings[extensionName];
        }

        if (!settings || Object.keys(settings).length === 0) {
            // 没有服务器数据，尝试迁移本地旧数据（为了兼容）
            const localBg = localStorage.getItem('general_map_bg_v2');
            const localData = localStorage.getItem('general_map_data_v2');
            const localTheme = localStorage.getItem('general_map_theme');

            console.log("[General Map] 未检测到服务器数据，加载默认/本地缓存...");
            
            this.mapData = localData ? JSON.parse(localData) : JSON.parse(JSON.stringify(defaultMapData));
            this.themeColor = localTheme || '#b38b59';
            this.backgroundImage = localBg || null; 

            // 立即尝试同步一次到服务器，确保存档建立
            if (localData || localBg) {
                console.log("[General Map] 正在将本地旧缓存迁移至服务器...");
                this.saveSettingsToServer();
            }
        } else {
            // 有服务器数据
            console.log("[General Map] 已从服务器同步数据。");
            this.mapData = settings.mapData || JSON.parse(JSON.stringify(defaultMapData));
            this.themeColor = settings.themeColor || '#b38b59';
            // 关键：从服务器设置中读取背景图
            this.backgroundImage = settings.backgroundImage || null;

            // 合并默认数据防止字段缺失
            for (let key in defaultMapData) {
                if (!this.mapData[key]) this.mapData[key] = defaultMapData[key];
            }
        }

        // 应用读取到的设置
        this.applyTheme(this.themeColor, false);
        const picker = document.getElementById('theme-color-picker');
        if(picker) picker.value = this.themeColor;
    },

    // 保存设置到服务器 (包含背景图)
    saveSettingsToServer: function() {
        const dataToSave = {
            mapData: this.mapData,
            themeColor: this.themeColor,
            backgroundImage: this.backgroundImage // 新增：保存背景图到服务器
        };
        
        if (typeof extension_settings !== 'undefined') {
            extension_settings[extensionName] = dataToSave;
            
            if (typeof saveExtensionSettings === 'function') {
                saveExtensionSettings();
                console.log("[General Map] 全量数据已保存至服务器 (含背景)。");
            }
        }
    },

    // ==========================================
    // 主题色管理
    // ==========================================
    applyTheme: function(color, shouldSave = true) {
        this.themeColor = color;
        document.documentElement.style.setProperty('--theme-color', color);
        
        const r = parseInt(color.substr(1, 2), 16);
        const g = parseInt(color.substr(3, 2), 16);
        const b = parseInt(color.substr(5, 2), 16);
        document.documentElement.style.setProperty('--theme-bg-opacity', `rgba(${r}, ${g}, ${b}, 0.3)`);
        
        if (shouldSave) this.saveSettingsToServer();
    },

    // ==========================================
    // 数据操作
    // ==========================================
    resetData: function() {
        if(confirm("确定要重置所有地图数据吗？\n注意：这将清除服务器上的所有自定义设置（包括背景图）。")) {
            this.mapData = JSON.parse(JSON.stringify(defaultMapData));
            this.themeColor = '#b38b59';
            this.backgroundImage = null; // 重置背景
            
            this.saveSettingsToServer();
            this.renderMapPins();
            this.renderBackground();
            this.applyTheme(this.themeColor);
            
            alert("数据已重置并同步至服务器。其他设备请刷新页面。");
        }
    },

    // ==========================================
    // 地图渲染与交互
    // ==========================================
    renderMapPins: function() {
        const container = document.getElementById('general-map-container');
        if (!container) return;
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
        this.saveSettingsToServer();
        this.renderMapPins();
        setTimeout(() => this.renderPopup(id), 100);
    },

    deletePin: function(id) {
        if (confirm("确定要永久删除这个地点吗？")) {
            delete this.mapData[id];
            this.saveSettingsToServer();
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
                this.saveSettingsToServer();
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

    // ==========================================
    // 字段更新
    // ==========================================
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
        this.saveSettingsToServer();
        if (field === 'name') this.renderMapPins();
    },

    updateFloor: function(id, floorIndex, field, value) {
        if (!this.mapData[id] || !this.mapData[id].floors[floorIndex]) return;
        this.mapData[id].floors[floorIndex][field] = value;
        this.saveSettingsToServer();
    },

    addFloor: function(id) {
        if (!this.mapData[id].floors) this.mapData[id].floors = [];
        this.mapData[id].floors.push({ name: "新区域 " + (this.mapData[id].floors.length + 1), content: "描述..." });
        this.mapData[id].type = 'complex'; 
        this.saveSettingsToServer();
        this.renderInterior(id); 
    },

    deleteFloor: function(id, index) {
        if(confirm("确定删除吗？")) {
            this.mapData[id].floors.splice(index, 1);
            this.saveSettingsToServer();
            this.renderInterior(id);
        }
    },

    uploadImage: function(id, field, input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.mapData[id][field] = e.target.result;
                this.saveSettingsToServer();
                if (field === 'image') this.renderPopup(id);
                if (field === 'internalImage') this.renderInterior(id);
            };
            reader.readAsDataURL(file);
        }
    },
    
    // 背景图 - 已修改为上传到服务器
    changeBackground: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const bgData = e.target.result;
                this.backgroundImage = bgData; // 更新状态
                this.renderBackground();       // 渲染
                this.saveSettingsToServer();   // 保存到服务器
            }
            reader.readAsDataURL(input.files[0]);
        }
    },

    renderBackground: function() {
        // 优先使用同步的背景，否则使用默认 CSS 定义的
        const container = document.getElementById('general-map-container');
        if (this.backgroundImage) {
            container.style.backgroundImage = `url(${this.backgroundImage})`;
        } else {
            // 如果没有自定义背景，保持 style.css 里的默认背景
            // 这里清除 inline style，让 css 生效
            container.style.backgroundImage = ''; 
        }
    },

    // 废弃：不再只从本地加载
    loadBackground: function() {
        // 保留此空函数以防调用报错，逻辑已移至 renderBackground
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
    console.log("[General Map] Initializing V7 (Full Sync)...");

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
        window.GeneralMap.init();

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
