const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// 获取 Expo 默认 Metro 配置
const config = getDefaultConfig(__dirname);

// ============ Monorepo 支持 ============

// 监听根目录（包含 packages/* 共享包的源码变更）
config.watchFolders = [path.resolve(__dirname, '..')];

// 依赖解析路径：先查 mobile/node_modules，再查根 node_modules
// 这样 monorepo 的 workspace 依赖（@lynnhub/shared 等）可正确解析
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', 'node_modules'),
];

// 允许 Metro 解析 monorepo 中 packages/* 的源码
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
