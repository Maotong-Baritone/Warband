// src/mechanics/HookManager.js

/**
 * HookManager (钩子管理器)
 * 负责管理游戏内的逻辑挂载点。
 * 允许遗物、被动技能、状态效果在特定时机介入并修改游戏逻辑。
 */
export const HookManager = {
    // 存储所有注册的钩子
    // 结构: { 'hookName': [ { id: 'relic_id', priority: 0, fn: callback }, ... ] }
    listeners: {},

    /**
     * 注册一个钩子
     * @param {string} hookName - 钩子名称 (e.g. 'onTurnStart', 'modifyCardCost')
     * @param {string} sourceId - 来源ID (e.g. 'relic_baton', 'role_pianist')
     * @param {Function} callback - 回调函数
     * @param {number} priority - 优先级 (越高越先执行，默认为 0)
     */
    register(hookName, sourceId, callback, priority = 0) {
        if (!this.listeners[hookName]) {
            this.listeners[hookName] = [];
        }
        this.listeners[hookName].push({ id: sourceId, priority, fn: callback });
        // 按优先级降序排序
        this.listeners[hookName].sort((a, b) => b.priority - a.priority);
    },

    /**
     * 注销来自特定来源的所有钩子 (例如卸下遗物时)
     */
    unregisterAll(sourceId) {
        Object.keys(this.listeners).forEach(key => {
            this.listeners[key] = this.listeners[key].filter(l => l.id !== sourceId);
        });
    },

    /**
     * 触发钩子 (无返回值/副作用模式)
     * 用于执行动作，如 "回合开始时抽1张牌"
     * @param {string} hookName 
     * @param {Object} context - 上下文对象 (包含 battle, caster 等)
     */
    async trigger(hookName, context) {
        if (!this.listeners[hookName]) return;
        
        for (const listener of this.listeners[hookName]) {
            try {
                // 支持异步操作 (如等待动画)
                await listener.fn(context);
            } catch (e) {
                console.error(`Error in hook ${hookName} from ${listener.id}:`, e);
            }
        }
    },

    /**
     * 触发钩子 (数值修改模式)
     * 用于修改数值，如 "伤害增加 5"
     * @param {string} hookName 
     * @param {number} baseValue - 初始值
     * @param {Object} context - 上下文
     * @returns {number} 修改后的值
     */
    processValue(hookName, baseValue, context) {
        if (!this.listeners[hookName]) return baseValue;

        let currentValue = baseValue;
        for (const listener of this.listeners[hookName]) {
            try {
                const result = listener.fn(currentValue, context);
                if (result !== undefined && result !== null) {
                    currentValue = result;
                }
            } catch (e) {
                console.error(`Error in value hook ${hookName} from ${listener.id}:`, e);
            }
        }
        return currentValue;
    }
};
