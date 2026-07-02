// ============ 环境配置 ============
// LynxHub Mobile 环境变量与常量定义

/** API 基础地址（云端服务） */
export const API_BASE_URL = 'https://ai.lynxdo.com';

/** WebSocket 网关地址（全双工语音 / Agent 通信） */
export const WS_GATEWAY_URL = 'wss://ai.lynxdo.com/api/ws/agent';

/** 设备类型标识（与服务端设备注册接口对齐） */
export const DEVICE_TYPE = 'mobile' as const;

/** AsyncStorage 中存储 JWT token 的 key */
export const TOKEN_STORAGE_KEY = 'lynnhub_token';

/** AsyncStorage 中存储用户信息的 key */
export const USER_STORAGE_KEY = 'lynnhub_user';

/** 验证码发送冷却时间（毫秒） */
export const SMS_CODE_COOLDOWN_MS = 60_000;
