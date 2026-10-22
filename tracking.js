(function () {
    'use strict';

    const own = (object, key) => object != null && Object.prototype.hasOwnProperty.call(object, key);
    const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    const forbidden = key => ['__proto__', 'constructor', 'prototype'].includes(key);
    const normalizeName = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\s·・]/g, '');
    const splitAliases = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(/[,，、\n]/)).map(x => String(x).trim()).filter(Boolean))];

    function decode(value) {
        if (typeof value !== 'string') return value;
        try { return JSON.parse(value); } catch { return value; }
    }

    function unwrap(value) {
        value = decode(value);
        return Array.isArray(value) && value.length === 2 && typeof value[1] === 'string' ? decode(value[0]) : value;
    }

    // JSON segment arrays allow names containing dots without evaluating user input.
    function pathParts(path) {
        if (!path.trim()) return [];
        const parts = path.trim().startsWith('[') ? JSON.parse(path) : path.split('.');
        if (!Array.isArray(parts) || !parts.length || parts.some(p => typeof p !== 'string' || !p || forbidden(p))) {
            throw new Error('变量路径格式无效');
        }
        return parts;
    }

    function readPath(data, path) {
        const parts = Array.isArray(path) ? path : pathParts(path);
        let value = decode(data);
        // STscript also permits literal dotted keys, e.g. npc.关祁.location.
        if (parts.length && !parts.some(forbidden) && own(value, parts.join('.'))) return unwrap(value[parts.join('.')]);
        for (const part of parts) {
            value = unwrap(value);
            if (forbidden(part) || !own(value, part)) return undefined;
            value = value[part];
        }
        return unwrap(value);
    }

    function safeImage(value) {
        if (typeof value !== 'string') return '';
        const url = value.trim();
        if (/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;
        try {
            const parsed = new URL(url, window.location.href);
            return url && ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch { return ''; }
    }

    function chatKey(context) {
        if (!context) return null;
        const id = context.getCurrentChatId?.() ?? context.chatId;
        if (id == null || id === '') return null;
        const owner = context.groupId != null ? ['group', context.groupId] : ['character', context.characters?.[context.characterId]?.avatar ?? context.characterId];
        return JSON.stringify([...owner, id]);
    }

    function normalizeConfig(value) {
        const profiles = Object.create(null);
        if (record(value?.profiles)) {
            for (const [key, profile] of Object.entries(value.profiles)) {
                if (forbidden(key) || !record(profile) || !Array.isArray(profile.characters)) continue;
                const ids = new Set();
                profiles[key] = { characters: profile.characters.filter(record).map((character, index) => {
                    let id = typeof character.id === 'string' && !forbidden(character.id) ? character.id : `tracked-${index}`;
                    while (ids.has(id)) id += '-copy';
                    ids.add(id);
                    return {
                        id, name: String(character.name || '未命名角色'), aliases: splitAliases(character.aliases),
                        avatar: safeImage(character.avatar), enabled: character.enabled !== false,
                        source: ['auto', 'message', 'chat', 'global', 'manual'].includes(character.source) ? character.source : 'auto',
                        path: typeof character.path === 'string' ? character.path : '',
                        manualLocation: String(character.manualLocation || ''), mapId: String(character.mapId || ''),
                    };
                }) };
            }
        }
        return { profiles };
    }

    function messageVariables(message) {
        const raw = decode(message?.variables ?? message?.data?.variables);
        const swipe = message?.swipe_id ?? 0;
        // Never search other swipes when the selected swipe has no snapshot.
        return decode(Array.isArray(raw) || (record(raw) && own(raw, String(swipe))) ? raw[swipe] : raw);
    }

    async function readSources(context, helper, needsGlobal = false) {
        const result = { message: null, chat: null, global: null };
        const get = async option => {
            try { return decode(await helper?.getVariables?.(option)); } catch { return null; }
        };
        const chat = context.chat || [];
        for (let i = chat.length - 1; i >= 0; i--) {
            if (chat[i]?.is_system) continue;
            let value = await get({ type: 'message', message_id: i });
            if (!record(value) || !Object.keys(value).length) value = messageVariables(chat[i]);
            if (record(value) && Object.keys(value).length) {
                result.message = { data: value, label: `消息 #${i} / 分支 ${(chat[i].swipe_id ?? 0) + 1}` };
                break;
            }
        }
        const chatVars = await get({ type: 'chat' });
        result.chat = { data: record(chatVars) ? chatVars : decode(context.chatMetadata?.variables) || {}, label: '聊天变量' };
        if (needsGlobal) {
            const globalVars = await get({ type: 'global' });
            result.global = { data: record(globalVars) ? globalVars : decode(context.extensionSettings?.variables?.global) || {}, label: '全局变量' };
        }
        return result;
    }

    function resolveLocation(character, sources) {
        if (character.source === 'manual') return { location: character.manualLocation.trim(), source: '手动位置' };
        const snapshot = character.source === 'auto' ? sources.message || sources.chat : sources[character.source];
        if (!snapshot) return { location: '', source: '尚无变量快照' };
        if (character.path.trim()) {
            try {
                const value = readPath(snapshot.data, character.path);
                return { location: typeof value === 'string' ? value.trim() : '', source: snapshot.label };
            } catch { return { location: '', source: '变量路径格式无效' }; }
        }
        const names = [character.name, ...character.aliases].map(normalizeName).filter(Boolean);
        const matches = [];
        const data = snapshot.data;
        const stat = readPath(data, ['stat_data']) ?? data;
        for (const root of [stat, ...['主要角色', '重要角色', '当前角色', 'MainCharacters', 'characters', 'npc'].map(k => readPath(stat, [k]))]) {
            if (!record(root)) continue;
            for (const [name, value] of Object.entries(root)) {
                if (!names.includes(normalizeName(name))) continue;
                for (const field of ['位置', '当前地点', '地点', 'location']) {
                    const location = readPath(value, [field]);
                    if (typeof location === 'string' && location.trim()) { matches.push(location.trim()); break; }
                }
            }
        }
        const locations = [...new Set(matches)];
        return { location: locations.length === 1 ? locations[0] : '', source: locations.length > 1 ? '角色变量有多个位置，请指定路径' : snapshot.label };
    }

    function matchLocation(location, maps, mapId = '') {
        const needle = normalizeName(location);
        if (!needle) return { status: 'missing', matches: [] };
        const candidates = [];
        for (const [id, map] of Object.entries(maps)) {
            if (mapId && id !== mapId) continue;
            for (const [pinId, pin] of Object.entries(map.pins)) {
                if (pin.type === 'portal' || pin.type === 'custom') continue;
                const names = [pin.name, ...splitAliases(pin.aliases), ...(pin.floors || []).flatMap(f => [f.name, ...(f.subItems || [])])];
                let score = 0;
                for (const name of names) {
                    const token = normalizeName(name);
                    if (!token) continue;
                    const value = needle === token ? 100000 + token.length : token.length >= 2 && needle.includes(token) ? token.length : 0;
                    score = Math.max(score, value);
                }
                if (score) candidates.push({ mapId: id, pinId, pin, score });
            }
        }
        const best = Math.max(0, ...candidates.map(x => x.score));
        const matches = candidates.filter(x => x.score === best);
        return { status: matches.length === 1 ? 'matched' : matches.length ? 'ambiguous' : 'unknown', matches };
    }

    function create({ map, icons, compressImage, getContext }) {
        let scope = null;
        let rows = [];
        let revision = 0;
        let timer;
        let poll;
        let editingId = null;
        let draftAvatar = '';
        let uploadRevision = 0;
        let uploading = false;
        let lastRender = '';
        const cleanups = [];
        const el = id => document.getElementById(`gm-track-${id}`);
        const profile = () => scope ? map.worldData.tracking.profiles[scope] || { characters: [] } : { characters: [] };
        const status = text => { el('notice').textContent = text; };
        const button = (icon, title, action) => {
            const node = document.createElement('button');
            node.type = 'button'; node.className = 'general-btn gm-icon-button';
            node.title = title; node.setAttribute('aria-label', title); node.innerHTML = icons.svg(icon);
            node.addEventListener('click', action); return node;
        };
        const persist = async characters => {
            if (!scope || scope !== chatKey(getContext())) return false;
            map.worldData.tracking.profiles[scope] = { characters };
            const saved = await map.saveData();
            if (!saved) status('保存失败，修改仅保留在当前页面，请重试或导出备份。');
            return saved;
        };

        function avatar(character, context) {
            const span = document.createElement('span');
            span.className = 'gm-avatar'; span.textContent = Array.from(character.name)[0] || '?';
            let url = safeImage(character.avatar);
            if (!url) {
                const names = [character.name, ...character.aliases].map(normalizeName);
                const cards = (context?.characters || []).filter(c => names.includes(normalizeName(c.name)));
                if (cards.length === 1 && cards[0].avatar && context.getThumbnailUrl) url = safeImage(context.getThumbnailUrl('avatar', cards[0].avatar));
            }
            if (url) {
                const image = document.createElement('img');
                image.alt = character.name; image.referrerPolicy = 'no-referrer'; image.src = url;
                image.addEventListener('error', () => image.remove(), { once: true }); span.appendChild(image);
            }
            return span;
        }

        function closeEditor() {
            editingId = null; draftAvatar = ''; uploading = false; uploadRevision++;
            el('save').disabled = false; el('form').hidden = true; el('form').reset();
        }

        function syncScope() {
            const context = getContext();
            const next = chatKey(context);
            if (next !== scope) { scope = next; rows = []; revision++; lastRender = ''; closeEditor(); }
            el('chat').textContent = next ? String(context.chatId ?? context.getCurrentChatId?.() ?? '') : '未打开聊天';
            el('add').disabled = !next;
            return context;
        }

        function openEditor(character) {
            const previousScope = scope;
            syncScope();
            if (!scope || (character && previousScope !== scope)) return;
            closeEditor();
            editingId = character?.id || null;
            draftAvatar = character?.avatar || '';
            el('name').value = character?.name || '';
            el('aliases').value = (character?.aliases || []).join('、');
            el('source').value = character?.source || 'auto';
            el('path').value = character?.path || '';
            el('location').value = character?.manualLocation || '';
            el('avatar').value = draftAvatar.startsWith('data:') ? '' : draftAvatar;
            el('avatar-state').textContent = draftAvatar.startsWith('data:') ? '已上传头像' : '';
            el('enabled').checked = character?.enabled !== false;
            el('map').replaceChildren(new Option('全部地图', ''));
            Object.entries(map.worldData.maps).forEach(([id, value]) => el('map').add(new Option(value.name, id)));
            if (character?.mapId && !own(map.worldData.maps, character.mapId)) el('map').add(new Option(`已删除的地图 (${character.mapId})`, character.mapId));
            el('map').value = character?.mapId || '';
            sourceChanged();
            el('form').hidden = false; el('name').focus();
        }

        function sourceChanged() {
            const manual = el('source').value === 'manual';
            el('manual-field').hidden = !manual; el('path-field').hidden = manual;
        }

        async function saveEditor(event) {
            event.preventDefault();
            if (!scope || scope !== chatKey(getContext())) { syncScope(); return; }
            if (uploading) return;
            const name = el('name').value.trim();
            if (!name) return;
            const path = el('path').value.trim();
            try { pathParts(path); } catch (error) { status(error.message); return; }
            const avatarText = el('avatar').value.trim();
            if (avatarText && !safeImage(avatarText)) { status('头像地址无效'); return; }
            const character = {
                id: editingId || (crypto.randomUUID?.() || `tracked-${Date.now()}-${Math.random().toString(36).slice(2)}`), name, aliases: splitAliases(el('aliases').value),
                source: el('source').value, path, manualLocation: el('location').value.trim(),
                mapId: el('map').value, avatar: avatarText ? safeImage(avatarText) : draftAvatar,
                enabled: el('enabled').checked,
            };
            const characters = profile().characters.slice();
            const index = characters.findIndex(x => x.id === editingId);
            if (index < 0) characters.push(character); else characters[index] = character;
            const savedScope = scope;
            const saved = await persist(characters);
            if (saved && savedScope === chatKey(getContext())) { closeEditor(); status('已保存'); }
            await refresh();
        }

        async function upload(event) {
            const file = event.target.files[0];
            if (!file) return;
            const currentScope = scope;
            const ticket = ++uploadRevision;
            uploading = true; el('save').disabled = true;
            try {
                const value = await compressImage(file, 160, 0.8);
                if (ticket !== uploadRevision || currentScope !== chatKey(getContext())) return;
                draftAvatar = value; el('avatar').value = ''; el('avatar-state').textContent = '已上传头像';
            } catch { if (ticket === uploadRevision) status('头像读取失败'); }
            finally {
                event.target.value = '';
                if (ticket === uploadRevision) { uploading = false; el('save').disabled = false; }
            }
        }

        async function refresh() {
            const context = syncScope();
            const ticket = ++revision;
            const currentScope = scope;
            const world = map.worldData;
            const characters = profile().characters;
            if (!scope || !characters.length) { rows = []; render(true); return; }
            try {
                const sources = await readSources(context, window.TavernHelper, characters.some(c => c.enabled && c.source === 'global'));
                if (ticket !== revision || currentScope !== chatKey(getContext()) || world !== map.worldData) return;
                rows = characters.map(character => {
                    const position = character.enabled ? resolveLocation(character, sources) : { location: '', source: '已暂停' };
                    return { character, ...position, ...matchLocation(position.location, world.maps, character.mapId) };
                });
                render();
            } catch (error) {
                if (ticket !== revision) return;
                rows = []; render(true); status(`读取位置失败：${error.message}`);
            }
        }

        function schedule() {
            syncScope();
            render(true);
            clearTimeout(timer);
            timer = setTimeout(refresh, 80);
        }

        async function locate(row) {
            if (scope !== chatKey(getContext()) || row.status !== 'matched') return;
            const match = row.matches[0];
            if (map.worldData.currentMapId !== match.mapId) await map.switchMap(match.mapId);
            map.renderPopup(match.pinId);
        }

        function render(force = false) {
            const context = getContext();
            const signature = JSON.stringify([scope, map.worldData.currentMapId, rows.map(row => [row.character, row.location, row.source, row.status,
                row.matches.map(match => [match.mapId, match.pinId, match.pin.x, match.pin.y])])]);
            if (!force && signature === lastRender) return;
            lastRender = signature;
            const list = el('list');
            list.replaceChildren();
            let layer = document.getElementById('gm-character-layer');
            if (!layer) {
                layer = document.createElement('div'); layer.id = 'gm-character-layer';
                document.getElementById('general-map-container').appendChild(layer);
            }
            layer.replaceChildren();
            const groups = new Map();
            let visible = 0;
            for (const row of rows) {
                const { character } = row;
                const item = document.createElement('div'); item.className = 'gm-tracked-row';
                item.appendChild(avatar(character, context));
                const info = document.createElement('div'); info.className = 'gm-tracked-info';
                const name = document.createElement('strong'); name.textContent = character.name;
                const location = document.createElement('span');
                const states = { missing: '位置未知', unknown: '未匹配地标', ambiguous: '多个地标匹配，待确认' };
                const match = row.matches[0];
                location.textContent = !character.enabled ? '已暂停' : row.status === 'matched'
                    ? `${row.location} · ${map.worldData.maps[match.mapId].name}`
                    : [row.location, states[row.status]].filter(Boolean).join(' · ');
                const source = document.createElement('small'); source.textContent = row.source;
                info.append(name, location, source); item.appendChild(info);
                if (row.status === 'matched') item.appendChild(button('pin', '查看角色位置', () => locate(row)));
                const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = character.enabled;
                toggle.title = '启用追踪'; toggle.setAttribute('aria-label', `追踪${character.name}`);
                toggle.addEventListener('change', async () => {
                    await persist(profile().characters.map(c => c.id === character.id ? { ...c, enabled: toggle.checked } : c));
                    refresh();
                });
                item.append(toggle, button('edit', `编辑${character.name}`, () => openEditor(character)), button('trash', `删除${character.name}`, async () => {
                    if (confirm(`停止追踪“${character.name}”？`)) {
                        await persist(profile().characters.filter(c => c.id !== character.id));
                        if (editingId === character.id) closeEditor();
                        refresh();
                    }
                }));
                list.appendChild(item);
                if (character.enabled && row.status === 'matched' && match.mapId === map.worldData.currentMapId) {
                    if (!groups.has(match.pinId)) groups.set(match.pinId, []);
                    groups.get(match.pinId).push(row); visible++;
                }
            }
            for (const groupRows of groups.values()) {
                const pin = groupRows[0].matches[0].pin;
                const group = document.createElement('div'); group.className = 'gm-character-group';
                group.style.left = pin.x; group.style.top = pin.y;
                const x = parseFloat(pin.x), y = parseFloat(pin.y);
                if (x < 15) group.classList.add('gm-align-left');
                if (x > 85) group.classList.add('gm-align-right');
                if (y < 15) group.classList.add('gm-below-pin');
                for (const row of groupRows.slice(0, 3)) {
                    const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'gm-character-marker';
                    marker.title = `${row.character.name}：${row.location}`; marker.setAttribute('aria-label', marker.title);
                    marker.appendChild(avatar(row.character, context)); marker.addEventListener('click', () => locate(row));
                    group.appendChild(marker);
                }
                if (groupRows.length > 3) {
                    const more = document.createElement('button'); more.type = 'button'; more.className = 'gm-character-marker gm-more-characters';
                    more.textContent = `+${groupRows.length - 3}`; more.title = groupRows.map(r => r.character.name).join('、');
                    more.setAttribute('aria-label', more.title); more.addEventListener('click', () => { el('panel').hidden = false; el('panel').scrollIntoView({ block: 'nearest' }); });
                    group.appendChild(more);
                }
                layer.appendChild(group);
            }
            if (!rows.length) {
                const empty = document.createElement('p'); empty.className = 'gm-tracking-empty';
                empty.textContent = scope ? '当前聊天暂无追踪角色' : '请先打开一段聊天'; list.appendChild(empty);
            }
            el('count').textContent = `${visible} / ${rows.filter(r => r.character.enabled).length}`;
        }

        function init() {
            el('form').addEventListener('submit', saveEditor);
            el('add').onclick = () => openEditor();
            el('cancel').onclick = closeEditor;
            el('refresh').onclick = () => { status(''); refresh(); };
            el('source').onchange = sourceChanged;
            el('upload').onchange = upload;
            el('clear-avatar').onclick = () => { draftAvatar = ''; el('avatar').value = ''; el('avatar-state').textContent = ''; uploadRevision++; uploading = false; el('save').disabled = false; };
            el('toggle').onclick = () => {
                el('panel').hidden = !el('panel').hidden;
                el('toggle').setAttribute('aria-expanded', String(!el('panel').hidden)); refresh();
            };
            const context = getContext();
            const types = context?.eventTypes || context?.event_types || {};
            const names = ['CHAT_CHANGED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'GENERATION_ENDED'];
            const events = new Set([...names.map(n => types[n]).filter(Boolean), 'mag_variable_initialized', 'mag_variable_update_ended']);
            if (context?.eventSource?.on) for (const event of events) {
                context.eventSource.on(event, schedule);
                cleanups.push(() => context.eventSource.removeListener?.(event, schedule));
            }
            poll = setInterval(() => {
                if (document.visibilityState !== 'hidden' && document.getElementById('general-map-panel')?.getClientRects().length) refresh();
            }, 2000);
            refresh();
        }

        return { init, refresh, render: () => { rows = rows.map(row => ({ ...row, ...matchLocation(row.location, map.worldData.maps, row.character.mapId) })); render(true); },
            reset: () => { revision++; rows = []; lastRender = ''; closeEditor(); refresh(); },
            destroy: () => { revision++; clearTimeout(timer); clearInterval(poll); cleanups.forEach(fn => fn()); } };
    }

    window.GeneralMapTracking = { create, normalizeConfig, matchLocation, readSources, resolveLocation, messageVariables, readPath, pathParts, chatKey, safeImage, splitAliases };
})();
