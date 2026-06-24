import { post } from "./request.js";

/** 用户名密码登录，返回 { token, user } */
export function login(username, password) {
  return post("/api/auth/token", { username, password });
}
