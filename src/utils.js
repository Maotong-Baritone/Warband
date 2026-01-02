window.TimerManager = class TimerManager {
    constructor() { this.timers = []; }
    add(fn, delay) { const t = setTimeout(fn, delay); this.timers.push(t); return t; }
    clearAll() { this.timers.forEach(t => clearTimeout(t)); this.timers = []; }
}

window.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));