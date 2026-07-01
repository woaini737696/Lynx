"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Eye,
  Power,
  KeyRound,
  Crown,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Shield,
  Copy,
  Check,
  UserCircle,
  Clock,
  Globe,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  LoadingState,
} from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import {
  SearchInput,
  FilterSelect,
  Pagination,
  useClientPagination,
} from "@/components/ui/ListControls";
import { PROFESSION_ICON_MAP } from "@/lib/permissions";
import { openContextMenu } from "@/components/ui/ContextMenu";

type CUser = {
  id: string;
  username: string;
  phone: string | null;
  email: string | null;
  displayName: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  registerIp: string | null;
  source: string;
  avatarUrl: string | null;
};

type LoginLog = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  loginAt: string;
};

type RoleOption = {
  id: string;
  name: string;
  displayName: string;
  profession?: string | null;
};

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "active", label: "启用" },
  { value: "disabled", label: "禁用" },
];

export default function CUsersPage() {
  const [users, setUsers] = useState<CUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");

  // 详情弹窗
  const [detailTarget, setDetailTarget] = useState<CUser | null>(null);
  const [detailData, setDetailData] = useState<{
    user: CUser;
    loginLogs: LoginLog[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 重置密码
  const [resetTarget, setResetTarget] = useState<CUser | null>(null);
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 角色提升
  const [promoteTarget, setPromoteTarget] = useState<CUser | null>(null);
  const [promoteRole, setPromoteRole] = useState<string>("");
  const [promoting, setPromoting] = useState(false);

  // 删除
  const [deleteTarget, setDeleteTarget] = useState<CUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 启用/禁用切换中
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // 角色 name → RoleOption 映射
  const roleMap = useMemo(() => {
    const m = new Map<string, RoleOption>();
    roles.forEach((r) => m.set(r.name, r));
    return m;
  }, [roles]);

  const formatRoleLabel = useCallback((r: RoleOption): string => {
    if (r.profession && PROFESSION_ICON_MAP[r.profession]) {
      return `${PROFESSION_ICON_MAP[r.profession]} ${r.displayName}`;
    }
    return `${r.displayName} (${r.name})`;
  }, []);

  const filterRoleOptions = useMemo(() => {
    return [
      { value: "all", label: "全部角色" },
      ...roles.map((r) => ({ value: r.name, label: formatRoleLabel(r) })),
    ];
  }, [roles, formatRoleLabel]);

  // 加载用户列表 + 角色列表
  const load = useCallback(async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/c-users"),
        fetch("/api/admin/roles"),
      ]);
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.roles || []);
      }
    } catch (e) {
      console.error("加载 C 端用户列表失败:", e);
      toast("加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 顶部统计（从列表数据计算）
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    return { total, active, disabled: total - active };
  }, [users]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const phone = (u.phone || "").toLowerCase();
        if (
          !u.username.toLowerCase().includes(q) &&
          !u.displayName.toLowerCase().includes(q) &&
          !phone.includes(q)
        ) {
          return false;
        }
      }
      if (filterStatus === "active" && !u.active) return false;
      if (filterStatus === "disabled" && u.active) return false;
      if (filterRole !== "all" && u.role !== filterRole) return false;
      return true;
    });
  }, [users, searchQuery, filterStatus, filterRole]);

  const { page, pageSize, total, paginated, onPageChange, onPageSizeChange } =
    useClientPagination(filtered);

  // 查看详情：拉取用户详情 + 最近 30 条登录历史
  const openDetail = useCallback(async (user: CUser) => {
    setDetailTarget(user);
    setDetailData(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/c-users/${user.id}?logLimit=30`);
      if (res.ok) {
        const data = await res.json();
        setDetailData({
          user: data.user as CUser,
          loginLogs: (data.loginLogs || []) as LoginLog[],
        });
      } else {
        toast("加载详情失败", "error");
        setDetailTarget(null);
      }
    } catch {
      toast("加载详情失败", "error");
      setDetailTarget(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailTarget(null);
    setDetailData(null);
  }, []);

  // 启用/禁用切换
  const toggleActive = useCallback(
    async (user: CUser) => {
      setTogglingId(user.id);
      try {
        const res = await fetch(`/api/c-users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !user.active }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || "操作失败", "error");
          return;
        }
        toast(user.active ? "已禁用" : "已启用", "success");
        await load();
      } catch {
        toast("操作失败，请重试", "error");
      } finally {
        setTogglingId(null);
      }
    },
    [load]
  );

  // 确认重置密码
  const confirmResetPassword = useCallback(async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/c-users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "重置失败", "error");
        return;
      }
      if (data.newPassword) {
        setNewPassword(data.newPassword as string);
        setResetTarget(null);
      } else {
        toast("重置成功", "success");
        setResetTarget(null);
      }
    } catch {
      toast("重置失败，请重试", "error");
    } finally {
      setResetting(false);
    }
  }, [resetTarget]);

  // 角色提升
  const openPromote = useCallback(
    (user: CUser) => {
      setPromoteTarget(user);
      setPromoteRole(user.role || roles[0]?.name || "");
    },
    [roles]
  );

  const confirmPromote = useCallback(async () => {
    if (!promoteTarget || !promoteRole) return;
    setPromoting(true);
    try {
      const res = await fetch(`/api/c-users/${promoteTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: promoteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "角色提升失败", "error");
        return;
      }
      toast("角色已更新", "success");
      setPromoteTarget(null);
      await load();
    } catch {
      toast("操作失败，请重试", "error");
    } finally {
      setPromoting(false);
    }
  }, [promoteTarget, promoteRole, load]);

  // 删除
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/c-users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "删除失败", "error");
        return;
      }
      toast("用户已删除", "success");
      setDeleteTarget(null);
      await load();
    } catch {
      toast("删除失败，请重试", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, load]);

  // 复制新密码
  const copyNewPassword = useCallback(async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast("已复制到剪贴板", "success");
    } catch {
      toast("复制失败，请手动复制", "error");
    }
  }, [newPassword]);

  if (loading) {
    return <LoadingState title="C 端用户管理" />;
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="C 端用户管理"
        subtitle="管理自注册的 C 端用户"
        action={<HelpButton contentKey="admin-c-users" />}
      />

      {/* 顶部统计卡片 */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl ios-glass-sm p-4">
          <div className="text-xs text-muted-foreground">C 端用户总数</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">
            {stats.total}
          </div>
        </div>
        <div className="rounded-2xl ios-glass-sm p-4">
          <div className="text-xs text-muted-foreground">启用</div>
          <div className="mt-1 text-2xl font-semibold text-task">
            {stats.active}
          </div>
        </div>
        <div className="rounded-2xl ios-glass-sm p-4">
          <div className="text-xs text-muted-foreground">禁用</div>
          <div className="mt-1 text-2xl font-semibold text-graveyard">
            {stats.disabled}
          </div>
        </div>
      </div>

      {/* 搜索 + 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="搜索手机号/用户名/显示名..."
          className="max-w-xs"
        />
        <FilterSelect
          value={filterStatus}
          onChange={setFilterStatus}
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          value={filterRole}
          onChange={setFilterRole}
          options={filterRoleOptions}
        />
      </div>

      {/* 用户列表 */}
      <Card className="overflow-hidden p-0">
        {/* 表头 */}
        <div className="hidden border-b border-border ios-glass-sm px-4 py-2.5 sm:flex sm:items-center sm:gap-3 text-xs font-medium text-muted-foreground">
          <div className="flex-1 min-w-0">用户</div>
          <div className="hidden md:block w-40 shrink-0">角色</div>
          <div className="hidden lg:block w-24 shrink-0">状态</div>
          <div className="hidden lg:block w-28 shrink-0">注册时间</div>
          <div className="hidden xl:block w-28 shrink-0">最后登录</div>
          <div className="hidden xl:block w-28 shrink-0">注册 IP</div>
          <div className="w-36 shrink-0 text-right">操作</div>
        </div>

        {/* 列表内容 */}
        <div className="divide-y divide-border/50">
          {users.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              暂无 C 端用户数据
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              没有匹配的用户
            </div>
          ) : (
            paginated.map((user) => {
              const initial = (
                user.displayName ||
                user.username ||
                "?"
              ).charAt(0).toUpperCase();
              const isToggling = togglingId === user.id;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-primary/5"
                  onContextMenu={(e) =>
                    openContextMenu(e, [
                      {
                        label: "查看详情",
                        icon: <Eye className="h-3.5 w-3.5" />,
                        onClick: () => openDetail(user),
                      },
                      {
                        label: user.active ? "禁用" : "启用",
                        icon: <Power className="h-3.5 w-3.5" />,
                        onClick: () => toggleActive(user),
                      },
                      {
                        label: "重置密码",
                        icon: <KeyRound className="h-3.5 w-3.5" />,
                        onClick: () => setResetTarget(user),
                      },
                      {
                        label: "角色提升",
                        icon: <Crown className="h-3.5 w-3.5" />,
                        onClick: () => openPromote(user),
                      },
                      { separator: true },
                      {
                        label: "删除用户",
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        danger: true,
                        onClick: () => setDeleteTarget(user),
                      },
                    ])
                  }
                >
                  {/* 用户信息 */}
                  <div className="flex flex-1 min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        user.active
                          ? "bg-primary/10 text-primary"
                          : "bg-graveyard/10 text-graveyard"
                      }`}
                    >
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {user.displayName || user.username}
                        </span>
                        {!user.active && (
                          <span className="rounded bg-graveyard/10 px-1.5 py-0.5 text-[10px] font-medium text-graveyard">
                            已禁用
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {user.phone ? (
                          <span className="text-northstar/80">
                            📱 {user.phone}
                          </span>
                        ) : (
                          <span className="text-destructive/70">
                            未绑定手机号
                          </span>
                        )}
                        <span className="ml-2 text-foreground/70">
                          @{user.username}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 角色 */}
                  <div className="hidden md:block w-40 shrink-0">
                    <RoleBadge role={user.role} roleMap={roleMap} />
                  </div>

                  {/* 状态 */}
                  <div className="hidden lg:block w-24 shrink-0">
                    {user.active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-task/10 px-2 py-0.5 text-xs font-medium text-task">
                        <span className="h-1.5 w-1.5 rounded-full bg-task" />
                        启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-graveyard/10 px-2 py-0.5 text-xs font-medium text-graveyard">
                        <span className="h-1.5 w-1.5 rounded-full bg-graveyard" />
                        禁用
                      </span>
                    )}
                  </div>

                  {/* 注册时间 */}
                  <div className="hidden lg:block w-28 shrink-0 text-xs text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </div>

                  {/* 最后登录 */}
                  <div className="hidden xl:block w-28 shrink-0 text-xs text-muted-foreground">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                  </div>

                  {/* 注册 IP */}
                  <div className="hidden xl:block w-28 shrink-0 truncate text-xs text-muted-foreground">
                    {user.registerIp || "—"}
                  </div>

                  {/* 操作 */}
                  <div className="flex w-36 shrink-0 items-center justify-end gap-0.5">
                    <button
                      onClick={() => openDetail(user)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="查看详情"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={isToggling}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-cognition/10 hover:text-cognition disabled:opacity-40"
                      title={user.active ? "禁用" : "启用"}
                    >
                      {isToggling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Power className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setResetTarget(user)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-campaign/10 hover:text-campaign"
                      title="重置密码"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openPromote(user)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-northstar/10 hover:text-northstar"
                      title="角色提升"
                    >
                      <Crown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(user)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-graveyard/10 hover:text-graveyard"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {filtered.length > 0 && (
          <div className="border-t border-border px-4 py-3">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </Card>

      {/* 详情弹窗 */}
      {detailTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={closeDetail}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl glass-modal p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <UserCircle className="h-5 w-5 text-northstar" />
                用户详情
              </h2>
              <button
                onClick={closeDetail}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailData ? (
              <div className="space-y-5">
                {/* 基本信息 */}
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold ${
                      detailData.user.active
                        ? "bg-primary/10 text-primary"
                        : "bg-graveyard/10 text-graveyard"
                    }`}
                  >
                    {(
                      detailData.user.displayName ||
                      detailData.user.username ||
                      "?"
                    ).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-foreground">
                        {detailData.user.displayName ||
                          detailData.user.username}
                      </span>
                      <RoleBadge
                        role={detailData.user.role}
                        roleMap={roleMap}
                      />
                      {detailData.user.active ? (
                        <span className="rounded-full bg-task/10 px-2 py-0.5 text-[10px] font-medium text-task">
                          启用
                        </span>
                      ) : (
                        <span className="rounded-full bg-graveyard/10 px-2 py-0.5 text-[10px] font-medium text-graveyard">
                          禁用
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{detailData.user.username}
                    </div>
                  </div>
                </div>

                {/* 字段信息 */}
                <div className="grid grid-cols-2 gap-3 rounded-xl ios-glass-sm p-4 text-sm">
                  <InfoRow
                    label="手机号"
                    value={detailData.user.phone || "—"}
                  />
                  <InfoRow
                    label="邮箱"
                    value={detailData.user.email || "—"}
                  />
                  <InfoRow
                    label="注册时间"
                    value={formatDateTime(detailData.user.createdAt)}
                  />
                  <InfoRow
                    label="最后登录"
                    value={
                      detailData.user.lastLoginAt
                        ? formatDateTime(detailData.user.lastLoginAt)
                        : "—"
                    }
                  />
                  <InfoRow
                    label="注册 IP"
                    value={detailData.user.registerIp || "—"}
                  />
                  <InfoRow
                    label="用户来源"
                    value={detailData.user.source}
                  />
                </div>

                {/* 登录历史 */}
                <div>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Clock className="h-4 w-4 text-cognition" />
                    登录历史（最近 {detailData.loginLogs.length} 条）
                  </h3>
                  {detailData.loginLogs.length === 0 ? (
                    <div className="rounded-xl ios-glass-sm px-4 py-6 text-center text-xs text-muted-foreground">
                      暂无登录记录
                    </div>
                  ) : (
                    <div className="max-h-64 space-y-1.5 overflow-y-auto">
                      {detailData.loginLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 rounded-lg ios-glass-sm px-3 py-2 text-xs"
                        >
                          <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">
                                {formatDateTime(log.loginAt)}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Globe className="h-3 w-3" />
                                {log.ip || "—"}
                              </span>
                            </div>
                            {log.userAgent && (
                              <div className="mt-0.5 truncate text-muted-foreground/70">
                                {log.userAgent}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeDetail}>
                    关闭
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 重置密码确认弹窗 */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setResetTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl glass-modal p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-campaign/10">
                <KeyRound className="h-5 w-5 text-campaign" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                确认重置密码
              </h2>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              确定要重置用户{" "}
              <code className="rounded ios-glass-sm px-1.5 py-0.5 text-xs text-foreground">
                {resetTarget.displayName || resetTarget.username}
              </code>
              的密码吗？重置后将生成一次性新密码供您转交。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setResetTarget(null)}
                disabled={resetting}
              >
                取消
              </Button>
              <Button onClick={confirmResetPassword} disabled={resetting}>
                {resetting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    重置中...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" />
                    确认重置
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 新密码展示弹窗 */}
      {newPassword && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setNewPassword(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl glass-modal p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-task/10">
                <Check className="h-5 w-5 text-task" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                密码重置成功
              </h2>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              请立即复制并安全转交给用户，此密码仅展示一次：
            </p>
            <div className="mb-5 flex items-center gap-2 rounded-xl ios-glass-sm px-3 py-3">
              <code className="flex-1 break-all font-mono text-sm font-semibold text-foreground">
                {newPassword}
              </code>
              <button
                onClick={copyNewPassword}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                title="复制"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-task" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setNewPassword(null)}>我已保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* 角色提升弹窗 */}
      {promoteTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setPromoteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl glass-modal p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Crown className="h-5 w-5 text-northstar" />
                角色提升
              </h2>
              <button
                onClick={() => setPromoteTarget(null)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              为{" "}
              <code className="rounded ios-glass-sm px-1.5 py-0.5 text-xs text-foreground">
                {promoteTarget.displayName || promoteTarget.username}
              </code>{" "}
              选择新角色：
            </p>
            <select
              value={promoteRole}
              onChange={(e) => setPromoteRole(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
            >
              {roles.length === 0 && <option value="">暂无可用角色</option>}
              {roles.map((r) => (
                <option key={r.name} value={r.name}>
                  {formatRoleLabel(r)}
                </option>
              ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPromoteTarget(null)}
                disabled={promoting}
              >
                取消
              </Button>
              <Button
                onClick={confirmPromote}
                disabled={promoting || !promoteRole}
              >
                {promoting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    保存中...
                  </>
                ) : (
                  "保存"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl glass-modal p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-graveyard/10">
                <AlertCircle className="h-5 w-5 text-graveyard" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                确认删除用户
              </h2>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              确定要删除 C 端用户{" "}
              <code className="rounded ios-glass-sm px-1.5 py-0.5 text-xs text-foreground">
                {deleteTarget.displayName || deleteTarget.username}
              </code>
              吗？此操作不可撤销，该用户关联的数据将保留但不再归属。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    确认删除
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 角色标签（动态：从 roleMap 查找 displayName 与 profession 图标）
function RoleBadge({
  role,
  roleMap,
}: {
  role: string;
  roleMap: Map<string, RoleOption>;
}) {
  const roleOpt = roleMap.get(role);
  const displayName = roleOpt?.displayName || role;
  const profession = roleOpt?.profession;
  const icon = profession ? PROFESSION_ICON_MAP[profession] : undefined;

  return (
    <span className="inline-flex items-center rounded-full ios-glass-sm px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
      {role === "admin" && <Shield className="mr-1 h-2.5 w-2.5" />}
      {icon && <span className="mr-1">{icon}</span>}
      {displayName}
    </span>
  );
}

// 详情信息行
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
        {label}
      </div>
      <div className="mt-0.5 break-all text-sm text-foreground">{value}</div>
    </div>
  );
}

// 格式化日期 YYYY-MM-DD
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 格式化日期时间 YYYY-MM-DD HH:mm
function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
