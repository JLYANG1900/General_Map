const extensionName = "General_Map";
const extensionPath = `scripts/extensions/third-party/${extensionName}`;

let stContext = null;

// ==========================================
// 1. 默认数据定义 (Default Data)
// ==========================================
// 这是所有地点的初始数据。如果用户没有修改过，就会加载这个。
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
    mapData: {},         // 当前运行时的地图数据
    isEditing: false,    // 是否处于编辑模式
    currentDestination: '',
    
    // 初始化
    init: function() {
        this.loadData();
        this.renderMapPins();
        this.loadBackground();
    },

    // 加载数据：优先读取 LocalStorage，没有则使用默认
    // 注意：key 改为 general_map_data_v2 以区分原版 CTE
    loadData: function() {
        const saved = localStorage.getItem('general_map_data_v2');
        if (saved) {
            try {
                this.mapData = JSON.parse(saved);
                // 简单的合并策略，防止新版本字段缺失
                for (let key in defaultMapData) {
                    if (!this.mapData[key]) this.mapData[key] = defaultMapData[key];
                }
            } catch (e) {
                console.error("数据损坏，重置为默认", e);
                this.mapData = JSON.parse(JSON.stringify(defaultMapData));
            }
        } else {
            // 深拷贝默认数据
            this.mapData = JSON.parse(JSON.stringify(defaultMapData));
        }
    },

    saveData: function() {
        localStorage.setItem('general_map_data_v2', JSON.stringify(this.mapData));
    },

    resetData: function() {
        if(confirm("确定要重置所有地图数据吗？所有自定义名称、图片和楼层都将丢失。")) {
            localStorage.removeItem('general_map_data_v2');
            this.loadData();
            this.renderMapPins();
            alert("数据已重置。");
        }
    },

    // 渲染地图上的大头针
    renderMapPins: function() {
        const container = document.getElementById('general-map-container');
        // 清空现有 Pins
        container.querySelectorAll('.location').forEach(el => el.remove());

        Object.values(this.mapData).forEach(loc => {
            const div = document.createElement('div');
            div.className = 'location';
            div.id = `pin-${loc.id}`;
            div.style.left = loc.x;
            div.style.top = loc.y;
            if (loc.color) div.style.color = loc.color;
            
            div.innerHTML = `<span class="label">${loc.name}</span>`;
            
            // 绑定事件
            this.bindPinEvents(div, loc.id);
            
            container.appendChild(div);
        });
    },

    // 处理 Pin 的点击和拖拽
    bindPinEvents: function(elm, id) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false;
        const container = document.getElementById('general-map-container');

        elm.onmousedown = (e) => {
            // 只有在编辑模式或长按(非编辑模式)下才允许拖拽
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

        // 全局移动监听 (仅编辑模式有效)
        const moveHandler = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            // 计算百分比位置
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            // 边界检查
            newLeft = Math.max(0, Math.min(newLeft, container.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, container.offsetHeight));

            elm.style.left = newLeft + 'px';
            elm.style.top = newTop + 'px';
            hasMoved = true;
        };

        const upHandler = () => {
            if (isDragging && hasMoved) {
                // 保存新坐标
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

        // 点击事件
        elm.onclick = (e) => {
            if (hasMoved) { hasMoved = false; return; }
            // 普通点击逻辑
            if (id === 'other-places') {
                this.showCustomTravelPopup();
            } else {
                this.renderPopup(id);
            }
        };
        
        // 双击编辑
        elm.ondblclick = (e) => {
             this.renderPopup(id);
        }
    },

    // ==========================================
    // 2. 动态渲染系统 (Render Engine)
    // ==========================================
    renderPopup: function(id) {
        const data = this.mapData[id];
        if (!data) return;
        
        const popup = document.getElementById('dynamic-popup');
        const content = document.getElementById('popup-content');
        const overlay = document.getElementById('general-overlay');

        // 构建 HTML
        let html = `
            <h3 contenteditable="${this.isEditing}" class="editable-text" onblur="window.GeneralMap.updateField('${id}', 'name', this.innerText)">${data.name}</h3>
            
            <p contenteditable="${this.isEditing}" class="editable-text" onblur="window.GeneralMap.updateField('${id}', 'desc', this.innerText)">${data.desc || "暂无描述"}</p>
        `;

        // 图片区域
        if (data.image) {
            html += `<img src="${data.image}" class="popup-image">`;
        } else if (this.isEditing) {
            html += `<div style="border:1px dashed #666; padding:20px; text-align:center; color:#666">暂无封面图</div>`;
        }

        // 编辑图片按钮
        if (this.isEditing) {
            html += `
                <div class="edit-controls">
                    <button class="general-btn small" onclick="document.getElementById('img-upload-${id}').click()">📷 更换封面</button>
                    <input type="file" id="img-upload-${id}" style="display:none" accept="image/*" onchange="window.GeneralMap.uploadImage('${id}', 'image', this)">
                    ${data.image ? `<button class="general-btn small danger" onclick="window.GeneralMap.updateField('${id}', 'image', '')">🗑️ 删除图</button>` : ''}
                </div>
            `;
        }

        // 按钮区域
        html += `<div style="text-align:center; margin-top:15px; display:flex; gap:10px; justify-content:center;">`;
        
        // "内部视图" 按钮
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

    // 渲染内部结构 (楼层/房间)
    renderInterior: function(id) {
        const data = this.mapData[id];
        const content = document.getElementById('popup-content');
        
        // 确保 floors 数组存在
        if (!data.floors) data.floors = [];

        let html = `
            <h3><span onclick="window.GeneralMap.renderPopup('${id}')" style="cursor:pointer; opacity:0.7">⬅️</span> ${data.name} - 内部</h3>
            <div class="interior-container">
        `;
        
        // 内部地图图片
        if (data.internalImage) {
            html += `<img src="${data.internalImage}" class="interior-image">`;
        } else {
            html += `<div style="height:200px; display:flex; align-items:center; justify-content:center; color:#666;">暂无内部示意图</div>`;
        }

        // 楼层列表
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
        
        // 编辑模式：添加楼层按钮
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

    // 显示楼层详情
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
        
        // 子项目 (Sub-Items) 逻辑
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
    // 3. 数据更新逻辑 (Updaters)
    // ==========================================
    
    toggleEditMode: function() {
        this.isEditing = !this.isEditing;
        const body = document.body;
        const label = document.getElementById('edit-mode-label');
        
        if (this.isEditing) {
            body.classList.add('general-editing-active');
            label.innerText = "✏️ 编辑中...";
            label.style.color = "#b38b59";
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
        this.mapData[id].floors.push({
            name: "新区域 " + (this.mapData[id].floors.length + 1),
            content: "在这里输入描述..."
        });
        this.mapData[id].type = 'complex'; 
        this.saveData();
        this.renderInterior(id); 
    },

    deleteFloor: function(id, index) {
        if(confirm("确定删除这个楼层/区域吗？")) {
            this.mapData[id].floors.splice(index, 1);
            this.saveData();
            this.renderInterior(id);
        }
    },

    // 图片上传处理
    uploadImage: function(id, field, input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            if (file.size > 2 * 1024 * 1024) {
                alert('图片过大 (>2MB)，可能会导致保存失败。建议压缩后上传。');
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                this.mapData[id][field] = e.target.result;
                this.saveData();
                if (field === 'image') this.renderPopup(id);
                if (field === 'internalImage') this.renderInterior(id);
            };
            reader.readAsDataURL(file);
        }
    },
    
    // 背景图处理
    changeBackground: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const bgData = e.target.result;
                document.getElementById('general-map-container').style.backgroundImage = `url(${bgData})`;
                localStorage.setItem('general_map_bg_v2', bgData);
            }
            reader.readAsDataURL(input.files[0]);
        }
    },

    loadBackground: function() {
        const bg = localStorage.getItem('general_map_bg_v2');
        if (bg) {
            document.getElementById('general-map-container').style.backgroundImage = `url(${bg})`;
        }
    },

    // ==========================================
    // 4. 其他辅助功能 (Travel, Popups)
    // ==========================================
    
    closeAllPopups: function() {
        $('#general-overlay').hide();
        $('.general-popup').hide();
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
            <div style="margin-bottom:10px; font-weight:bold;">目的地：${destination}</div>
            <button class="general-btn" onclick="window.GeneralMap.confirmTravel(true)">👤 独自前往</button>
            <button class="general-btn" onclick="window.GeneralMap.showCompanionInput()">👥 和……一起前往</button>
            <button class="general-btn" style="margin-top: 10px; border-color: #666; color: #888;" onclick="window.GeneralMap.closeAllPopups()">关闭</button>
        `);
        box.css('display', 'flex');
    },

    showCompanionInput: function() {
        $('#travel-menu-overlay .travel-options').html(`
            <p style="color: #888; margin: 0 0 10px 0;">和谁一起去？</p>
            <input type="text" id="companion-name" class="travel-input" placeholder="输入角色姓名">
            <button class="general-btn" onclick="window.GeneralMap.confirmTravel(false)">🤝 一起前往</button>
            <button class="general-btn" style="margin-top: 10px; border-color: #666; color: #888;" onclick="window.GeneralMap.openTravelMenu('${this.currentDestination}')">返回</button>
        `);
    },

    confirmTravel: function(isAlone) {
        const dest = this.currentDestination;
        let text = "";
        
        if (isAlone) {
            text = `{{user}} 决定独自前往${dest}。`;
        } else {
            const name = $('#companion-name').val();
            if (!name) return alert("请输入姓名");
            // 更新逻辑：{{user}} 邀请 {name} 前往 {dest}
            text = `{{user}} 邀请 ${name} 前往${dest}`;
        }
        
        if (stContext) {
            stContext.executeSlashCommandsWithOptions(`/setinput ${text}`);
            this.closeAllPopups();
            $('#general-map-panel').fadeOut(); // 选完地址后自动关闭地图
        } else {
            console.log("Mock Travel Command:", text);
            alert("指令已生成 (控制台可见): " + text);
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
    console.log("[General Map] Initializing V2...");

    // 清理旧DOM
    $('#general-map-panel').remove();
    $('#general-toggle-btn').remove();
    $('link[href*="General_Map/style.css"]').remove();

    // 加载 CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${extensionPath}/style.css`;
    document.head.appendChild(link);

    // 注入主面板
    const panelHTML = `
        <div id="general-toggle-btn" title="打开 General 地图" 
             style="position:fixed; top:130px; left:10px; z-index:9000; width:40px; height:40px; background:#b38b59; border-radius:50%; display:flex; justify-content:center; align-items:center; cursor:pointer; box-shadow:0 4px 10px rgba(0,0,0,0.3); color:#fff; font-size:20px;">
            🗺️
        </div>
        <div id="general-map-panel">
            <div id="general-drag-handle">
                <span>General 档案地图 (Data-Driven)</span>
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
        
        // 核心初始化
        window.GeneralMap.init();

    } catch (e) {
        console.error("[General Map] Error:", e);
        $('#general-content-area').html(`<p style="padding:20px; color:white;">加载失败: ${e.message}</p>`);
    }

    // 绑定面板开关
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
