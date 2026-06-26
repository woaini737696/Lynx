// 用 isomorphic-git 执行 add + commit（不 push，需要 Gitee 认证）
import fs from "fs";
import path from "path";
import git from "isomorphic-git";

const dir = process.cwd();

console.log("[1] git add -A");
await git.add({ fs, dir, filepath: "." });

console.log("\n[2] git status (changed files)");
const status = await git.statusMatrix({ fs, dir });
const changed = status.filter((row) => row[1] !== 1 || row[2] !== 1);
console.log("changed files:", changed.length);
for (const row of changed.slice(0, 40)) {
  const flag = row[1] === 0 ? "NEW" : row[1] === 2 ? "MODIFIED" : "UNCHANGED";
  console.log(`  [${flag}] ${row[0]}`);
}

console.log("\n[3] git commit");
const commitSha = await git.commit({
  fs,
  dir,
  message: "feat: 迭代35 - 悬浮窗技能按钮修复+快捷消息填入输入框+角色管理按职位分配+按职业定制AI工作空间(4维度)",
  author: { name: "Admin", email: "admin@gitee.com" },
});
console.log("commit sha:", commitSha);

console.log("\n=== COMMIT DONE (push 需用户手动执行) ===");
console.log("请手动执行: git push origin master");
