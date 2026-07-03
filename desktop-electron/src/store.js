// 配置持久化：简单的 JSON 文件存储（不引入 electron-store 依赖，遵循"能少写不多写"原则）
// 存储位置：userData/config.json
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

let configPath = null;
let cache = null;

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

function save() {
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
    save();
  },
  delete(key) {
    const data = load();
    delete data[key];
    save();
  },
  getAll() {
    return load();
  },
};
