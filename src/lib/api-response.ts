// API 响应统一信封
// 所有新增 API 必须使用本模块的函数返回响应，保持格式一致
import { NextResponse } from "next/server";

// 统一成功响应
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

// 统一列表响应
export function listResponse<T>(data: T[], total?: number): NextResponse {
  return NextResponse.json({ success: true, data, total: total ?? data.length });
}

// 统一创建响应
export function createdResponse<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

// 统一错误响应
export function errorResponse(message: string, status: number = 400, code?: string): NextResponse {
  return NextResponse.json(
    { success: false, error: { code: code || "ERROR", message } },
    { status }
  );
}

// 常用错误快捷函数
export const badRequest = (msg: string) => errorResponse(msg, 400, "BAD_REQUEST");
export const unauthorized = (msg: string = "未登录") => errorResponse(msg, 401, "UNAUTHORIZED");
export const forbidden = (msg: string = "无权访问") => errorResponse(msg, 403, "FORBIDDEN");
export const notFound = (msg: string = "资源不存在") => errorResponse(msg, 404, "NOT_FOUND");
export const serverError = (msg: string = "服务器错误") => errorResponse(msg, 500, "INTERNAL_ERROR");
