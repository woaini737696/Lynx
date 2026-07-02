// ============ 登录页 ============
// 手机号 + 验证码登录，深邃星空蓝深色主题（对齐 Kotlin 端）
// 调用 /api/auth/sms-code 发送验证码，/api/auth/token 获取 JWT

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, MessageSquare, ArrowRight } from 'lucide-react-native';
import { useAuth, sendSmsCode, ApiError } from '@/lib/auth';
import { SMS_CODE_COOLDOWN_MS } from '@/config/env';
import {
  Void,
  Primary,
  TextPrimary,
  TextMuted,
  Liquid2,
  LiquidBorder,
  Danger,
} from '@/theme/colors';

export function LoginScreen() {
  const login = useAuth((s) => s.login);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 验证码倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 手机号格式校验（与后端一致：1[3-9] 开头的 11 位）
  const isPhoneValid = /^1[3-9]\d{9}$/.test(phone);
  const isCodeValid = code.length >= 4;
  const canSendCode = isPhoneValid && countdown === 0 && !sendingCode;
  const canLogin = isPhoneValid && isCodeValid && !loggingIn;

  // 发送验证码
  const handleSendCode = useCallback(async () => {
    if (!canSendCode) return;
    setError(null);
    setSendingCode(true);
    try {
      await sendSmsCode(phone);
      setCountdown(Math.ceil(SMS_CODE_COOLDOWN_MS / 1000));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '验证码发送失败';
      setError(msg);
    } finally {
      setSendingCode(false);
    }
  }, [canSendCode, phone]);

  // 登录
  const handleLogin = useCallback(async () => {
    if (!canLogin) return;
    setError(null);
    setLoggingIn(true);
    try {
      await login(phone, code);
      // 登录成功后 useAuth.isLoggedIn 变为 true，AppNavigator 自动切换到 MainTabs
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : '登录失败';
      setError(msg);
    } finally {
      setLoggingIn(false);
    }
  }, [canLogin, phone, code, login]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ============ 品牌标识 ============ */}
          <View style={styles.brandArea}>
            <Text style={styles.brandTitle}>LynxHub</Text>
            <Text style={styles.brandSubtitle}>Lynx AI 超级助理</Text>
            <Text style={styles.brandDesc}>桌面端补充版本</Text>
          </View>

          {/* ============ 深色玻璃卡片 ============ */}
          <View style={styles.glassCard}>
            {/* 手机号输入 */}
            <View style={styles.inputRow}>
              <Phone size={20} color={TextMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="请输入手机号"
                placeholderTextColor={TextMuted}
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/\D/g, '').slice(0, 11))}
                keyboardType="numeric"
                maxLength={11}
                autoComplete="tel"
              />
            </View>

            <View style={styles.divider} />

            {/* 验证码输入 + 发送按钮 */}
            <View style={styles.inputRow}>
              <MessageSquare size={20} color={TextMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder="验证码"
                placeholderTextColor={TextMuted}
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                keyboardType="numeric"
                maxLength={6}
                autoComplete="sms-otp"
              />
              <TouchableOpacity
                style={[styles.sendCodeBtn, !canSendCode && styles.sendCodeBtnDisabled]}
                onPress={handleSendCode}
                disabled={!canSendCode}
                activeOpacity={0.7}
              >
                <Text style={[styles.sendCodeText, !canSendCode && styles.sendCodeTextDisabled]}>
                  {countdown > 0 ? `${countdown}s` : sendingCode ? '发送中...' : '获取验证码'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 错误提示 */}
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {/* 登录按钮 */}
            <TouchableOpacity
              style={[styles.loginBtn, !canLogin && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={!canLogin}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>
                {loggingIn ? '登录中...' : '登录'}
              </Text>
              {!loggingIn && <ArrowRight size={20} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>

          {/* ============ 底部提示 ============ */}
          <Text style={styles.footerText}>
            登录即表示同意用户协议与隐私政策
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============ 样式（深邃星空蓝深色主题） ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Void, // 页面主背景
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  // 品牌标识
  brandArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: Primary, // 品牌色
    letterSpacing: 1,
  },
  brandSubtitle: {
    fontSize: 16,
    color: TextPrimary,
    marginTop: 8,
    fontWeight: '500',
  },
  brandDesc: {
    fontSize: 13,
    color: TextMuted,
    marginTop: 4,
  },
  // 深色玻璃卡片
  glassCard: {
    backgroundColor: Liquid2, // 二级液态玻璃
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: LiquidBorder,
    // iOS 阴影
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    // Android 阴影
    elevation: 4,
  },
  // 输入行
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: TextPrimary,
    paddingVertical: 0,
  },
  codeInput: {
    flex: 1,
  },
  sendCodeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(75, 159, 255, 0.16)',
    borderRadius: 12,
    marginLeft: 8,
  },
  sendCodeBtnDisabled: {
    opacity: 0.5,
  },
  sendCodeText: {
    fontSize: 13,
    color: Primary,
    fontWeight: '600',
  },
  sendCodeTextDisabled: {
    color: TextMuted,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: LiquidBorder,
    marginVertical: 4,
  },
  errorText: {
    fontSize: 13,
    color: Danger,
    marginTop: 12,
  },
  // 登录按钮
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    backgroundColor: Primary, // 品牌色
    marginTop: 24,
    gap: 8,
  },
  loginBtnDisabled: {
    opacity: 0.5,
  },
  loginBtnText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // 底部
  footerText: {
    fontSize: 12,
    color: TextMuted,
    textAlign: 'center',
    marginTop: 24,
  },
});
