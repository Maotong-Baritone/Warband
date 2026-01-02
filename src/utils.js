// Global utility for waiting (Promisified setTimeout)
// Keeping this global for now as it's used extensively in async functions
window.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
