// WS 网关本地预编译脚本
//
// 用途：把 src/lib/ws-gateway.ts 用 esbuild 预编译成纯 CJS JavaScript 单文件
//       服务器只需 `node scripts/ws-gateway.compiled.js` 即可运行，零额外依赖（tsx/pnpm 都不需要）
//
// 调用：node scripts/compile-ws-gateway.mjs
// 时机：在 build.ps1 的 prisma generate 之后、next build 之前执行
//
// 设计要点：
// 1. bundle: true — 把 ws 等 npm 依赖打进单文件，服务器无需再装任何包
// 2. external: ["@prisma/client"] — Prisma Client 含生成的 .prisma/client 二进制，需运行时从 node_modules 解析（standalone 已包含）
// 3. format: cjs — standalone server.js 是 CommonJS，保持一致
// 4. target: node18 — 服务器 Node.js 20 向下兼容
//
// 输出：scripts/ws-gateway.compiled.js（由 build.ps1 复制到 standalone/scripts/）

import esbuild from "esbuild";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const entry = path.join(root, "src/lib/ws-gateway.ts");
const outdir = path.join(root, "scripts");
const outfile = path.join(outdir, "ws-gateway.compiled.js");

// 确保输出目录存在
fs.mkdirSync(outdir, { recursive: true });

try {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node18",
    outfile,
    external: ["@prisma/client"],
    banner: {
      js: [
        "// 此文件由 scripts/compile-ws-gateway.mjs 本地预编译生成。",
        "// 服务器零依赖，直接 `node scripts/ws-gateway.compiled.js` 运行。",
        "// 请勿手动编辑；修改源码后请重新执行：node scripts/compile-ws-gateway.mjs",
      ].join("\n"),
    },
    logLevel: "info",
    color: true,
  });

  if (result.warnings.length > 0) {
    console.warn(`[compile-ws-gateway] 完成，但有 ${result.warnings.length} 条警告`);
  } else {
    console.log(`[compile-ws-gateway] 编译成功 -> ${path.relative(root, outfile)}`);
  }
} catch (err) {
  console.error("[compile-ws-gateway] 编译失败:", err);
  process.exit(1);
}
