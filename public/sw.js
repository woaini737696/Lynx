// LynnHub Service Worker
// 策略：
// - 静态资源（_next/static, 图片, 字体）：缓存优先（Cache First）
// - 页面导航（HTML）：网络优先，失败回退缓存（Network First）
// - API 请求：网络优先，失败回退缓存（仅 GET）
// - 离线页面：网络失败时返回缓存的首页

const CACHE_VERSION = "lynnhub-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const API_CACHE = `${CACHE_VERSION}-api`;

// 预缓存的核心路由（安装时缓存）
const PRECACHE_URLS = ["/", "/board", "/inbox", "/cognition", "/memory"];

// ============ 安装：预缓存核心页面 ============
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {})),
      self.skipWaiting(),
    ])
  );
});

// ============ 激活：清理旧缓存 ============
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim(),
    ])
  );
});

// ============ 请求拦截：按策略分流 ============
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 仅处理同源请求
  if (url.origin !== self.location.origin) return;

  // 非 GET 请求不缓存
  if (request.method !== "GET") return;

  // 开发环境（localhost）：完全不缓存，直接透传到 dev server
  // 避免 HMR 热更新被 Service Worker 拦截导致浏览器显示旧版本
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    // 仍然拦截以避免默认缓存行为，但直接走网络
    event.respondWith(fetch(request).catch(() => new Response("网络错误", { status: 503 })));
    return;
  }

  // 静态资源：缓存优先
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|ico|webp)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // API 请求：网络优先，失败回退缓存
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE, 5000));
    return;
  }

  // 页面导航：网络优先，失败回退缓存
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, 8000));
    return;
  }
});

// ============ 缓存策略实现 ============

// 缓存优先：先查缓存，未命中再请求网络
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    // 离线且无缓存：返回基础离线页面
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>离线</title></head><body style="font-family:system-ui;padding:2rem;text-align:center"><h1>当前处于离线状态</h1><p>请检查网络连接后重试</p></body></html>',
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

// 网络优先：先请求网络，超时或失败回退缓存
async function networkFirst(request, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    // 带超时的网络请求
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (e) {
    // 网络失败：回退缓存
    const cached = await cache.match(request);
    if (cached) return cached;
    // 缓存也无：返回 503
    return new Response(
      JSON.stringify({ error: "离线且无缓存数据" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ============ 消息通信：允许页面主动更新缓存 ============
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
  if (event.data === "clearCache") {
    Promise.all([
      caches.delete(STATIC_CACHE),
      caches.delete(PAGE_CACHE),
      caches.delete(API_CACHE),
    ]).then(() => {
      event.source && event.source.postMessage({ type: "cacheCleared" });
    });
  }
});

// ============ Web Push 通知 ============
self.addEventListener("push", (event) => {
  let data = { title: "奇思 通知", body: "你有新消息" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "奇思 通知", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "lynnhub-notification",
      data: data.data || {},
    })
  );
});

// 通知点击：聚焦/打开窗口
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 如果已有窗口，聚焦它
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 通知关闭
self.addEventListener("notificationclose", (event) => {
  // 可用于分析通知效果
});
