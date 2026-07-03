// 配置持久化：简单的 JSON 文件存储（不引入 electron-store 依赖，遵循"能少写不多写"原则）
// 存储位置：userData/config.json
// P0-2: 防抖写入，避免高频 set 阻塞主进程
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let configPath = null;
let cache = null;
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 500;

function getConfigPath() {
  if (!configPath) {
    configPath = path.join(app.getPath('userData'), 'config.json');
  }
  return configPath;
}

function load() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  }
  return cache;
}

// 防抖写入：500ms 内多次 set 只写一次磁盘（P0-2）
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushSave();
  }, SAVE_DEBOUNCE_MS);
}

// 立即写入（用于退出前强制落盘）
function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!cache) return;
  try {
    fs.writeFileSync(getConfigPath(), JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.error('[store] 保存配置失败:', e);
  }
}

module.exports = {
  get(key, defaultValue) {
    const data = load();
    return key in data ? data[key] : defaultValue;
  },
  set(key, value) {
    const data = load();
    data[key] = value;
    scheduleSave();
  },
  delete(key) {
    const data = load();
    delete data[key];
    scheduleSave();
  },
  getAll() {
    return load();
  },
  // 退出前调用，确保缓冲数据落盘
  flush() {
    flushSave();
  },
};
