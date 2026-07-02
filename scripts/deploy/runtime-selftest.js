// 运行时自测脚本：登录 + 验证 bug 修复在线上实际生效
// 在服务器上用 node 执行
const BASE = process.env.BASE_URL || "http://localhost:5176";

// 简易 cookie jar
const jar = new Map();
function mergeCookies(setCookieHeader) {
  if (!setCookieHeader) return;
  // set-cookie 可能是数组或单个字符串
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const entry of list) {
    // 每条 set-cookie 用逗号分隔多个？不会，一条 cookie 内的 expires 含逗号
    // 用 name= 取第一段
    const pair = entry.split(";")[0].trim();
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    jar.set(name, val);
  }
}
function cookieHeader() {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  const phone = process.env.PHONE || "13800000001";
  const password = process.env.PASSWORD || "Test1234!";

  // 1. 拿 CSRF token + cookie
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  mergeCookies(csrfRes.headers.get("set-cookie"));
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson.csrfToken;
  console.log(`[1] CSRF token: ${csrfToken ? "OK" : "FAIL"} (cookie count=${jar.size})`);

  // 2. 登录
  const loginBody = new URLSearchParams({
    phone,
    password,
    csrfToken,
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(),
    },
    body: loginBody.toString(),
    redirect: "manual",
  });
  mergeCookies(loginRes.headers.get("set-cookie"));
  console.log(`[2] Login status: ${loginRes.status} (cookie count=${jar.size})`);

  // 3. session 校验
  const sessRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: cookieHeader() },
  });
  mergeCookies(sessRes.headers.get("set-cookie"));
  const sessJson = await sessRes.json();
  console.log(`[3] Session: user=${sessJson?.user?.name || "NONE"} role=${sessJson?.user?.role || "NONE"}`);

  if (!sessJson?.user) {
    console.log("[FAIL] 登录失败，停止后续测试");
    console.log("       登录响应 set-cookie:", (loginRes.headers.get("set-cookie") || "").slice(0, 200));
    return;
  }

  // 4. C2 SSRF：测试 webhook 域名白名单（应拒绝非飞书域名）
  const ssrfRes = await fetch(`${BASE}/api/lark-bot/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ webhookUrl: "http://169.254.169.254/latest/meta-data/" }),
  });
  const ssrfJson = await ssrfRes.json();
  const ssrfBlocked =
    ssrfRes.status === 400 &&
    typeof ssrfJson.error === "string" &&
    ssrfJson.error.includes("域名不被允许");
  console.log(`[4] C2 SSRF 防护: ${ssrfBlocked ? "PASS (已拒绝内网地址)" : "FAIL"} [${ssrfRes.status}] ${JSON.stringify(ssrfJson).slice(0, 120)}`);

  // 5. C2 飞书官方域名应通过域名白名单（即使后续返回业务错误，域名校验应通过）
  const legitRes = await fetch(`${BASE}/api/lark-bot/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/test-nonexistent" }),
  });
  const legitJson = await legitRes.json();
  const legitNotBlockedByDomain =
    !(legitRes.status === 400 && typeof legitJson.error === "string" && legitJson.error.includes("域名不被允许"));
  console.log(`[5] C2 飞书域名放行: ${legitNotBlockedByDomain ? "PASS (域名校验通过)" : "FAIL"} [${legitRes.status}]`);

  // 6. H4 用户资料部分更新：仅传 displayName，profession 不被清空
  const profileRes = await fetch(`${BASE}/api/user/profile`, {
    headers: { Cookie: cookieHeader() },
  });
  const profileJson = await profileRes.json();
  const beforeProfession = profileJson?.user?.profession ?? null;
  console.log(`[6] H4 当前 profession: ${beforeProfession}`);

  const updRes = await fetch(`${BASE}/api/user/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ displayName: "Lynn-test" }),
  });
  const updJson = await updRes.json();
  const afterProfession = updJson?.user?.profession ?? null;
  const professionPreserved = beforeProfession === afterProfession;
  console.log(`[7] H4 部分更新: displayName="Lynn-test" → profession 保持 ${afterProfession} ${professionPreserved ? "PASS" : "FAIL"}`);

  // 恢复 displayName
  await fetch(`${BASE}/api/user/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({ displayName: profileJson?.user?.displayName || "Lynn" }),
  });

  // 8. H4 空更新应 400
  const emptyRes = await fetch(`${BASE}/api/user/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader() },
    body: JSON.stringify({}),
  });
  const emptyJson = await emptyRes.json();
  console.log(`[8] H4 空更新拒绝: ${emptyRes.status === 400 ? "PASS" : "FAIL"} [${emptyRes.status}] ${JSON.stringify(emptyJson).slice(0, 100)}`);

  console.log("\n===== 自测完成 =====");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
