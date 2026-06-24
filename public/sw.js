// LynnHub Service Worker
// 策略：
// - 静态资源（_next/static, 图片, 字体）：缓存优先（Cache First）
// - 页面导航（HTML）：网络优先，失败回退缓存（Network First）
// - API 请求：网络优先，失败回退缓存（仅 GET）
// - 离线页面：网络失败时返回缓存的首页

const CACHE_VERSION = "lynnhub-v1";
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
