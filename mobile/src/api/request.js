// 统一请求封装：注入 Bearer Token、401 拦截跳登录、统一错误处理

const DEFAULT_BASE_URL = "http://localhost:3000";

const STORAGE_KEY_BASE_URL = "api_base_url";
const STORAGE_KEY_TOKEN = "auth_token";
const STORAGE_KEY_USER = "auth_user";

export function getBaseUrl() {
  return uni.getStorageSync(STORAGE_KEY_BASE_URL) || DEFAULT_BASE_URL;
}

export function setBaseUrl(url) {
  uni.setStorageSync(STORAGE_KEY_BASE_URL, url);
}

export function getToken() {
  return uni.getStorageSync(STORAGE_KEY_TOKEN) || "";
}

/**
 * 通用请求
 * @param {Object} options { url, method, data, header, responseType }
 * @returns {Promise<any>} 解析后的 JSON 响应
 */
export function request(options) {
  const { url, method = "GET", data, header = {} } = options;
  const fullUrl = url.startsWith("http") ? url : `${getBaseUrl()}${url}`;
  const token = getToken();

  return new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...header,
      },
      success: (res) => {
        // 401：token 失效，清除并跳转登录
        if (res.statusCode === 401) {
          uni.removeStorageSync(STORAGE_KEY_TOKEN);
          uni.removeStorageSync(STORAGE_KEY_USER);
          uni.reLaunch({ url: "/pages/login/login" });
          reject(new Error("未登录或登录已过期"));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const msg =
            (res.data && res.data.error) || `请求失败 (${res.statusCode})`;
          reject(new Error(msg));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || "网络请求失败"));
      },
    });
  });
}

export const get = (url, data) => request({ url, method: "GET", data });
export const post = (url, data) => request({ url, method: "POST", data });
export const put = (url, data) => request({ url, method: "PUT", data });
export const patch = (url, data) => request({ url, method: "PATCH", data });
export const del = (url, data) => request({ url, method: "DELETE", data });
