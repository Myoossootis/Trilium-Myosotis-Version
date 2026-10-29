function commissionService(action, payload = {}) {
    if(api.getNote('MyoMarketData')?.getJsonContent()?.plugins.find(p=>p.id==='MyoQuestGroup')?.enabled===false)throw Error('该插件已关闭，请在插件管理器中开启。');
    // runOnBackend executes this synchronous operation in Trilium's transaction.
    const note = api.getNote('MyoQuestData');
    if (!note || note.isDeleted || note.isProtected || !note.hasLabel('commissionData'))
        throw new Error('委托数据未安装或不可访问');
    let state;
    try { state = JSON.parse(note.getContent()); } catch { throw new Error('委托数据损坏，已停止写入，请从备份恢复'); }
    if (state.version !== 1 || !Array.isArray(state.tasks) || !Array.isArray(state.events) || !Number.isInteger(state.revision))
        throw new Error('委托数据格式不兼容，已停止写入');
    // Existing v1 ledgers remain authoritative; add catalog without resetting them.
    if (state.products === undefined) state.products = [];
    if (!Array.isArray(state.products)) throw new Error('商店数据格式不兼容，已停止写入');
    if (state.categories === undefined) state.categories = [...new Set(state.tasks.map(task => task.category).filter(Boolean))];
    if (!Array.isArray(state.categories) || state.categories.some(name => typeof name !== 'string')) throw new Error('分类数据格式不兼容');
    const nowMs = Date.now();
    const wallet = () => {
        const result = { coins: 0, xp: 0, skills: Object.create(null), items: Object.create(null) };
        for (const event of state.events) {
            if (!Number.isSafeInteger(event.coins) || !Number.isSafeInteger(event.xp) ||
                !Number.isSafeInteger(event.itemQuantity) || typeof event.skill !== 'string' ||
                typeof event.itemName !== 'string') throw new Error('奖励记录损坏，已停止结算');
            result.coins += event.coins; result.xp += event.xp;
            if (event.skill) result.skills[event.skill] = (result.skills[event.skill] || 0) + event.xp;
            if (event.itemName) result.items[event.itemName] = (result.items[event.itemName] || 0) + event.itemQuantity;
        }
        if (!Number.isSafeInteger(result.coins) || !Number.isSafeInteger(result.xp) ||
            Object.values(result.skills).some(xp => !Number.isSafeInteger(xp) || xp < 0) ||
            Object.values(result.items).some(qty => !Number.isSafeInteger(qty) || qty < 0) || result.coins < 0 || result.xp < 0)
            throw new Error('资产记录异常，已停止结算');
        return result;
    };
    const recurrenceTypes = ['once', 'repeat', 'daily', 'weekly', 'weeklyMultiple'];
    const calendarKey = (timestamp, weekly = false) => {
        const local = new Date(timestamp + 8 * 3600000);
        if (weekly) local.setUTCDate(local.getUTCDate() - (local.getUTCDay() + 6) % 7);
        return local.toISOString().slice(0, 10);
    };
    const reversed = new Set(state.events.filter(event => event.kind === 'undo').map(event => event.reverses));
    const taskProgress = task => {
        const recurrence = task.recurrence || 'once';
        const weekly = recurrence === 'weekly' || recurrence === 'weeklyMultiple';
        const periodKey = recurrence === 'daily' || recurrence === 'repeat' ? calendarKey(nowMs) : weekly ? calendarKey(nowMs, true) : 'once';
        const completions = state.events.filter(event => event.kind === 'complete' && event.taskId === task.id && !reversed.has(event.id));
        const current = completions.filter(event => recurrence === 'once' || calendarKey(Date.parse(event.time), weekly) === periodKey);
        const target = recurrence === 'repeat' ? null : recurrence === 'weeklyMultiple' ? task.weeklyTarget : 1;
        const canComplete = recurrence === 'repeat' || (current.length < target && !(recurrence === 'once' && task.status === 'done'));
        return { recurrence, weeklyTarget: task.weeklyTarget || 3, importance: task.importance || 1, urgency: task.urgency || 1,
            periodKey, periodCount: current.length, completionCount: completions.length, target, canComplete,
            status: canComplete ? 'active' : 'done', completionEventId: completions.at(-1)?.id || null,
            completedAt: completions.at(-1)?.time || null };
    };
    const view = () => ({ version: state.version, revision: state.revision, tasks: state.tasks.map(task => ({ ...task, ...taskProgress(task) })),
        events: state.events, products: state.products.filter(product=>!product.deleted), inventoryProducts: state.products.filter(product=>!product.deleted),
        categories: state.categories, wallet: wallet(), serverNow: nowMs });
    wallet(); // Reject malformed existing records before any mutation.
    if (action === 'load') return view();
    const task = state.tasks.find(item => item.id === payload.id);
    if (['buy', 'useItem'].includes(action) && payload.requestId && state.events.some(event => event.requestId === payload.requestId && event.kind === (action === 'buy' ? 'purchase' : 'use'))) return view();
    // Idempotency takes precedence over stale requests for the same settlement.
    if (action === 'complete' && task) {
        if (payload.requestId && state.events.some(event => event.kind === 'complete' && event.taskId === task.id && event.requestId === payload.requestId)) return view();
        if (!taskProgress(task).canComplete) {
            if ((task.recurrence || 'once') !== 'once') throw new Error('本周期已完成目标，请等待下一周期');
            return view();
        }
    }
    if (action === 'undo' && task) {
        if ((task.recurrence || 'once') !== 'once' && !payload.eventId) throw new Error('请指定要撤销的结算记录');
        if (payload.eventId && reversed.has(payload.eventId)) return view();
        if (!payload.eventId && !taskProgress(task).completionEventId) return view();
    }
    if (payload.revision !== state.revision) throw new Error('数据已在另一窗口更新，请刷新后重试');
    const now = new Date().toISOString();
    const integer = (value, name, max) => {
        if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${name}必须是 0–${max} 的整数`);
        return value;
    };
    const categoryName = value => {
        const name = String(value || '').trim();
        if (name.length > 40) throw new Error('分类最多 40 字');
        return name;
    };
    const addCategory = name => { if (name && !state.categories.includes(name)) { if (state.categories.length >= 100) throw new Error('分类数量已达上限'); state.categories.push(name); } };
    const signed = (value, name) => {
        if (!Number.isSafeInteger(value) || Math.abs(value) > 100000) throw new Error(`${name}必须是 -100000–100000 的整数`);
        return value;
    };
    const effectsValue = input => {
        if (!Array.isArray(input) || input.length > 20) throw new Error('使用效果最多 20 项');
        return input.map(effect => {
            const type = effect.type;
            if (['coins', 'xp'].includes(type)) {
                const min = signed(effect.min ?? 0, '最小变化');
                const max = signed(effect.max ?? min, '最大变化');
                if (min > max) throw new Error('随机范围的最小值不能大于最大值');
                const skill = String(effect.skill || '').trim();
                if (skill.length > 80) throw new Error('技能名称过长');
                return { type, min, max, skill: type === 'xp' ? skill : '' };
            }
            if (['item', 'craft', 'chest'].includes(type)) {
                if (!Array.isArray(effect.items) || !effect.items.length || effect.items.length > 20) throw new Error('请选择 1–20 项道具');
                return { type, items: effect.items.map(item => {
                    const name = String(item.name || '').trim();
                    const quantity = signed(item.quantity, '道具变化');
                    if (!name || name.length > 80 || !quantity || (type !== 'item' && quantity < 1)) throw new Error('道具名称或数量无效');
                    const weight = type === 'chest' ? integer(item.weight ?? 1, '权重', 10000) : 1;
                    if (!weight) throw new Error('权重至少为 1');
                    return { name, quantity, weight };
                }) };
            }
            throw new Error('使用效果类型无效');
        });
    };
    const limitValue = input => {
        if (!input) return null;
        if (input.period === 'disabled') return { period: 'disabled' };
        if (!['daily', 'weekly', 'total'].includes(input.period)) throw new Error('限制周期无效');
        const count = integer(input.count, '限制次数', 100000);
        if (!count) throw new Error('限制次数至少为 1');
        return { period: input.period, count };
    };
    const checkLimit = (product, kind, quantity, limit) => {
        if (!limit || limit.period === 'disabled') return;
        const used = state.events.filter(event => event.kind === kind && event.productId === product.id &&
            (limit.period === 'total' || calendarKey(Date.parse(event.time), limit.period === 'weekly') === calendarKey(nowMs, limit.period === 'weekly')))
            .reduce((sum, event) => sum + Math.abs(event.itemQuantity), 0);
        if (used + quantity > limit.count) throw new Error(`已超过${limit.period === 'daily' ? '每日' : limit.period === 'weekly' ? '每周' : '累计'}${kind === 'purchase' ? '购买' : '使用'}限制`);
    };
    const fields = input => {
        const title = String(input.title || '').trim();
        const description = String(input.description || '').trim();
        const skill = String(input.skill || '').trim();
        if (skill.length > 80) throw new Error('技能名称最多 80 字');
        const itemName = String(input.itemName || '').trim();
        if (!title || title.length > 80) throw new Error('委托名称不能为空，最多 80 字');
        if (description.length > 2000 || itemName.length > 80) throw new Error('说明或奖励名称过长');
        const coins = integer(input.coins, '金币奖励', 100000);
        const xp = integer(input.xp ?? 0, '经验奖励', 100000);
        const recurrence = input.recurrence || 'once';
        if (!recurrenceTypes.includes(recurrence)) throw new Error('任务周期无效');
        const weeklyTarget = recurrence === 'weeklyMultiple' ? integer(input.weeklyTarget ?? 3, '每周次数', 99) : 3;
        if (recurrence === 'weeklyMultiple' && weeklyTarget < 2) throw new Error('每周多次至少为 2 次');
        const importance = integer(input.importance ?? 1, '重要程度', 4);
        const urgency = integer(input.urgency ?? 1, '紧急程度', 4);
        if (!importance || !urgency) throw new Error('任务等级必须为 Lv.1–Lv.4');
        const itemQuantity = itemName ? integer(input.itemQuantity, '道具数量', 999) : 0;
        if (itemName && !itemQuantity) throw new Error('道具数量至少为 1');
        const link = String(input.noteLink || '').trim();
        let noteId = '';
        if (link) {
            const path = link.startsWith('#root/') ? link.slice(6).split('?')[0] : link;
            if (!/^[a-zA-Z0-9_/-]+$/.test(path)) throw new Error('请输入 Trilium 笔记链接或笔记 ID');
            noteId = path.split('/').filter(Boolean).at(-1);
            const target = api.getNote(noteId);
            if (!target || target.isDeleted) throw new Error('关联笔记不存在');
        }
        const category = categoryName(input.category);
        addCategory(category);
        return { title, description, category, skill, coins, xp, recurrence, weeklyTarget, importance, urgency, itemName, itemQuantity, noteId };
    };
    const ledger = (kind, title, coins, itemName, itemQuantity, extra = {}) => {
        state.events.push({ id: api.randomString(16), kind, title, coins, xp: 0, skill: '',
            itemName, itemQuantity, time: now, ...extra });
    };
    if (['categoryCreate', 'categoryRename', 'categoryDelete'].includes(action)) {
        const name = categoryName(payload.name);
        if (!name) throw new Error('分类名称不能为空');
        if (action === 'categoryCreate') { if (state.categories.includes(name)) throw new Error('分类已存在'); addCategory(name); }
        else {
            if (!state.categories.includes(name)) throw new Error('分类不存在');
            const target = action === 'categoryRename' ? categoryName(payload.target) : '';
            if (action === 'categoryRename' && !target) throw new Error('新分类名称不能为空');
            if (target && !state.categories.includes(target)) state.categories.push(target);
            state.tasks.forEach(item => { if (item.category === name) { item.category = target; item.updatedAt = now; } });
            state.categories = state.categories.filter(item => item !== name || item === target);
        }
    } else if (action === 'taskCategory') {
        if (!task) throw new Error('委托不存在');
        task.category = categoryName(payload.category); addCategory(task.category); task.updatedAt = now;
    } else if (['productCreate', 'productEdit', 'productArchive', 'productRestore', 'productDelete', 'buy'].includes(action)) {
        const product = state.products.find(item => item.id === payload.id);
        if (product?.deleted) throw new Error('商品已删除');
        if (action === 'productCreate' || action === 'productEdit') {
            if (action === 'productEdit' && !product) throw new Error('商品不存在');
            if (action === 'productCreate' && state.products.length >= 2000) throw new Error('商品数量已达上限');
            const name = String(payload.name || '').trim();
            const description = String(payload.description || '').trim();
            const category = String(payload.category || '道具').trim();
            if (!name || name.length > 80 || description.length > 2000 || !category || category.length > 40)
                throw new Error('商品名称不能为空，或名称/说明/分类过长');
            if (state.products.some(item => !item.deleted && item.id !== product?.id && item.name === name)) throw new Error('同名商品已存在，请编辑现有商品');
            const price = integer(payload.price, '商品单价', 100000);
            const iconClass = String(payload.iconClass || 'bx bx-gift').trim();
            if (iconClass.length > 300 || !/^[a-zA-Z0-9_-]+(?: [a-zA-Z0-9_-]+){0,7}$/.test(iconClass)) throw new Error('商品图标格式无效，请使用图标选择器');
            const useMode = payload.useMode || 'none';
            if (!['none', 'disabled', 'custom'].includes(useMode)) throw new Error('使用方式无效');
            const useLabel = String(payload.useLabel || '使用 / 兑换').trim();
            if (!useLabel || useLabel.length > 30) throw new Error('使用按钮文案最多 30 字');
            const stock = payload.stock === null || payload.stock === undefined || payload.stock === '' ? null : integer(payload.stock, '累计可售数量', 100000);
            const effects = useMode === 'custom' ? effectsValue(payload.effects || []) : [];
            const values = { name, description, category, price, iconClass, stock, useMode, useLabel, effects,
                purchaseDisabled: payload.purchaseLimit?.period === 'disabled' || !!payload.purchaseDisabled,
                purchaseLimit: limitValue(payload.purchaseLimit), useLimit: limitValue(payload.useLimit), updatedAt: now };
            if (product) Object.assign(product, values);
            else state.products.unshift({ ...values, id: api.randomString(16), archived: false, createdAt: now });
        } else {
            if (!product) throw new Error('商品不存在');
            if (action === 'buy') {
                if (product.archived) throw new Error('商品已下架');
                if (product.purchaseDisabled) throw new Error('此商品不可直接购买');
                const quantity = integer(payload.quantity, '购买数量', 999);
                if (!quantity) throw new Error('购买数量至少为 1');
                const sold = state.events.filter(event => event.kind === 'purchase' && event.productId === product.id).reduce((sum, event) => sum + event.itemQuantity, 0);
                if (product.stock != null && sold + quantity > product.stock) throw new Error('商店库存不足');
                checkLimit(product, 'purchase', quantity, product.purchaseLimit);
                const cost = integer(product.price, '商品单价', 100000) * quantity;
                if (wallet().coins < cost) throw new Error('金币不足，完成委托后再来兑换');
                ledger('purchase', product.name, -cost, product.name, quantity,
                    { productId: product.id, unitPrice: product.price, description: product.description, category: product.category, iconClass: product.iconClass || 'bx bx-gift', requestId: String(payload.requestId || '') });
            } else if (action === 'productDelete') {
                // Preserve historical records while clearing all merged stock of this name.
                const quantity = wallet().items[product.name] || 0;
                ledger('discard', product.name, 0, product.name, -quantity, { productId: product.id });
                product.deleted = true; product.deletedAt = now; product.updatedAt = now;
            } else { product.archived = action === 'productArchive'; product.updatedAt = now; }
        }
    } else if (action === 'useItem') {
        const name = String(payload.itemName || '').trim();
        const quantity = integer(payload.quantity, '使用数量', 999);
        if (!name || name.length > 80 || !quantity) throw new Error('请选择道具，使用数量至少为 1');
        if ((wallet().items[name] || 0) < quantity) throw new Error('仓库数量不足');
        const product = payload.productId ? state.products.find(item => !item.deleted && item.id === payload.productId && item.name === name) : state.products.find(item => !item.deleted && item.name === name);
        if (payload.productId && !product) throw new Error('使用设置已变化，请刷新');
        if (product?.useMode === 'disabled') throw new Error('此商品不可使用');
        if (product) checkLimit(product, 'use', quantity, product.useLimit);
        const effects = product?.useMode === 'custom' ? effectsValue(product.effects || []) : [];
        // Usage anchors all effects; failed balances never persist partial changes.
        ledger('use', name, 0, name, -quantity, { productId: product?.id || '', requestId: String(payload.requestId || ''), effects });
        const useId = state.events.at(-1).id;
        for (const effect of effects) {
            if (effect.type === 'coins' || effect.type === 'xp') {
                let change = 0;
                for (let i = 0; i < quantity; i++) change += effect.min + Math.floor(Math.random() * (effect.max - effect.min + 1));
                ledger('effect', name, effect.type === 'coins' ? change : 0, '', 0, { useId,
                    xp: effect.type === 'xp' ? change : 0, skill: effect.skill || '' });
            } else if (['item', 'craft', 'chest'].includes(effect.type)) {
                const awards = new Map();
                if (effect.type === 'chest') {
                    const total = effect.items.reduce((sum, item) => sum + item.weight, 0);
                    for (let i = 0; i < quantity; i++) {
                        let roll = Math.random() * total;
                        const item = effect.items.find(item => (roll -= item.weight) < 0) || effect.items.at(-1);
                        awards.set(item.name, (awards.get(item.name) || 0) + item.quantity);
                    }
                } else effect.items.forEach(item => awards.set(item.name, (awards.get(item.name) || 0) + item.quantity * quantity));
                awards.forEach((count, itemName) => ledger('effect', name, 0, itemName, count, { useId }));
            }
        }
    } else if (action === 'create') {
        if (state.tasks.length >= 2000) throw new Error('委托数量已达上限，请先导出整理');
        state.tasks.unshift({ ...fields(payload), id: api.randomString(16), status: 'active', archived: false,
            createdAt: now, updatedAt: now, cycle: 0, completionEventId: null });
    } else {
        if (!task) throw new Error('委托不存在，请刷新');
        if (action === 'edit') {
            if ((task.recurrence || 'once') === 'once' && taskProgress(task).status === 'done') throw new Error('请先撤销完成，再修改委托和奖励');
            Object.assign(task, fields(payload), { updatedAt: now });
        } else if (action === 'complete') {
            if (payload.source === 'pomodoro' && (!Number.isSafeInteger(payload.focusedMinutes) || payload.focusedMinutes < 25)) throw new Error('模电委托需要完整完成至少 25 分钟专注');
            if (task.archived) throw new Error('请先恢复已归档的委托');
            const progress = taskProgress(task);
            const requestId = String(payload.requestId || '');
            if ((progress.recurrence !== 'once' || requestId) && !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId))
                throw new Error('重复任务缺少有效的结算标识，请刷新重试');
            const event = { id: api.randomString(16), kind: 'complete', taskId: task.id, title: task.title,
                skill: task.skill || '', coins: task.coins, xp: task.xp || 0, itemName: task.itemName,
                itemQuantity: task.itemQuantity, time: now, cycle: task.cycle,
                requestId, recurrence: progress.recurrence, periodKey: progress.periodKey,
                importance: task.importance || 1, urgency: task.urgency || 1 };
            if (payload.source === 'pomodoro') Object.assign(event, { completionSource: 'pomodoro', focusedMinutes: payload.focusedMinutes });
            state.events.push(event);
            Object.assign(task, { status: progress.recurrence === 'once' ? 'done' : 'active', completedAt: now, updatedAt: now, completionEventId: event.id });
        } else if (action === 'undo') {
            const eventId = payload.eventId || taskProgress(task).completionEventId;
            const original = state.events.find(event => event.id === eventId && event.taskId === task.id && event.kind === 'complete');
            if (!original || state.events.some(event => event.reverses === original.id)) throw new Error('结算记录异常，无法撤销');
            const balance = wallet();
            if (balance.coins < original.coins || balance.xp < original.xp ||
                (original.skill && (balance.skills[original.skill] || 0) < original.xp) ||
                (original.itemName && (balance.items[original.itemName] || 0) < original.itemQuantity))
                throw new Error('奖励已使用，无法直接撤销');
            state.events.push({ taskId: original.taskId, title: original.title, skill: original.skill, itemName: original.itemName, id: api.randomString(16), kind: 'undo', reverses: original.id,
                coins: -original.coins, xp: -original.xp, itemQuantity: -original.itemQuantity,
                time: now });
            reversed.add(original.id);
            Object.assign(task, { status: 'active', completedAt: null, updatedAt: now, completionEventId: null, cycle: task.cycle + 1 });
        } else if (action === 'archive') {
            task.archived = true; task.updatedAt = now;
        } else if (action === 'restore') {
            task.archived = false; task.updatedAt = now;
        } else throw new Error('未知委托操作');
    }
    wallet(); // Check resulting balances before persisting any changes.
    state.revision++;
    note.setContent(JSON.stringify(state));
    return view();
}
