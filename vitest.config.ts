import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  oxc: {
    // vitest 4 使用 oxc 转换器，需在此覆盖 tsconfig 的 jsx: "preserve" 以支持 .tsx 中的 JSX
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov"],
      reportsDirectory: "./coverage",
      // 覆盖率统计范围：聚焦关键模块（已充分测试的模块）
      // 迭代124：从仅 src/lib 扩展到关键 API 路由 + 充分测试的 lib 模块
      // 策略：只纳入覆盖率>40%的模块，随测试覆盖扩大逐步增加 include 项
      // 下一迭代目标：纳入 auth-utils/ai-provider 等（需先补测试到 40%+），阈值提升到 50%
      include: [
        // lib 模块（已充分测试）
        "src/lib/crypto.ts",
        "src/lib/jwt.ts",
        "src/lib/rate-limit.ts",
        "src/lib/permissions.ts",
        "src/lib/semantic-match.ts",
        // API 路由（迭代124新增测试）
        "src/app/api/health/route.ts",
        "src/app/api/auth/register/route.ts",
        "src/app/api/auth/set-password/route.ts",
        "src/app/api/users/route.ts",
        "src/app/api/c-users/route.ts",
        // 组件（迭代124新增测试）
        "src/components/auth/SetPasswordModal.tsx",
      ],
      exclude: [
        "src/**/__tests__/**",
        "src/lib/**/*.d.ts",
        "src/lib/types/**",
      ],
      // 覆盖率阈值：迭代124 从 30% 提升到 40%（聚焦关键模块+逐步提升策略）
      // 下一迭代目标 50%，再下一迭代 60%
      thresholds: {
        statements: 40,
        branches: 40,
        functions: 40,
        lines: 40,
      },
    },
  },
});
