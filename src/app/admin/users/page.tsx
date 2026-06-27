"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Shield,
  UserCircle,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  LoadingState,
} from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { SearchInput, FilterSelect, Pagination, useClientPagination } from "@/components/ui/ListControls";
import { PROFESSION_ICON_MAP } from "@/lib/permissions";
import { openContextMenu } from "@/components/ui/ContextMenu";

type User = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  role: string;
  profession?: string | null;
  active: boolean;
  createdAt: string;
};

type CurrentUser = {
  id: string;
  role: string;
} | null;

// 角色选项（从 /api/admin/roles 动态拉取）
type RoleOption = {
  id: string;
  name: string;
  displayName: string;
  profession?: string | null;
};

type FormData = {
  username: string;
  password: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
};

const EMPTY_FORM: FormData = {
  username: "",
  password: "",
  email: "",
  displayName: "",
  role: "",
  active: true,
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  // 筛选角色：动态拉取，"all" 表示全部
  const [filterRole, setFilterRole] = useState<string>("all");

  // 角色 name → RoleOption 映射，便于展示 displayName 与 profession 图标
  const roleMap = useMemo(() => {
    const m = new Map<string, RoleOption>();
    roles.forEach((r) => m.set(r.name, r));
    return m;
  }, [roles]);

  // 拼接角色选项的展示文本：绑定了职业则显示"职业图标 + displayName"，否则"displayName (name)"
  const formatRoleLabel = useCallback((r: RoleOption): string => {
    if (r.profession && PROFESSION_ICON_MAP[r.profession]) {
      return `${PROFESSION_ICON_MAP[r.profession]} ${r.displayName}`;
    }
    return `${r.displayName} (${r.name})`;
  }, []);

  // 筛选器角色选项（动态）
  const filterOptions = useMemo(() => {
    return [
      { value: "all", label: "全部角色" },
      ...roles.map((r) => ({ value: r.name, label: formatRoleLabel(r) })),
    ];
  }, [roles, formatRoleLabel]);

  // 加载用户列表、角色列表和当前用户
  const load = useCallback(async () => {
    try {
      const [usersRes, sessionRes, rolesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/auth/session"),
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
      if (sessionRes.ok) {
        const session = await sessionRes.json();
        if (session?.user) {
          setCurrentUser({
            id: (session.user as { id?: string }).id || "",
            role: (session.user as { role?: string }).role || "viewer",
          });
        }
      }
    } catch (e) {
      console.error("加载用户列表失败:", e);
      toast("加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 打开创建弹窗（默认选第一个角色，避免空值）
  const openCreate = () => {
    setForm({
      ...EMPTY_FORM,
      role: roles[0]?.name || "",
    });
    setEditingId(null);
    setModalMode("create");
  };

  // 打开编辑弹窗
  const openEdit = (user: User) => {
    setForm({
      username: user.username,
      password: "",
      email: user.email || "",
      displayName: user.displayName,
      role: user.role,
      active: user.active,
    });
    setEditingId(user.id);
    setModalMode("edit");
  };

  // 关闭弹窗
  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (modalMode === "create") {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username,
            password: form.password,
            email: form.email || undefined,
            displayName: form.displayName || undefined,
            role: form.role,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || "创建失败", "error");
          return;
        }
        toast("用户创建成功", "success");
      } else if (modalMode === "edit" && editingId) {
        const body: Record<string, unknown> = {
          email: form.email || undefined,
          displayName: form.displayName,
          role: form.role,
          active: form.active,
        };
        if (form.password) {
          body.password = form.password;
        }
        const res = await fetch(`/api/users/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || "更新失败", "error");
          return;
        }
        toast("用户更新成功", "success");
      }
      closeModal();
      await load();
    } catch {
      toast("操作失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
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
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!u.username.toLowerCase().includes(q) && !u.displayName.toLowerCase().includes(q)) return false;
      }
      if (filterRole !== "all" && u.role !== filterRole) return false;
      return true;
    });
  }, [users, searchQuery, filterRole]);

  const { page, pageSize, total, paginated, onPageChange, onPageSizeChange } = useClientPagination(filtered);

  if (loading) {
    return <LoadingState title="用户管理" />;
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="用户管理"
        subtitle="管理系统用户账户与权限"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              创建用户
            </Button>
            <HelpButton contentKey="admin-users" />
          </div>
        }
      />

      {/* 搜索 + 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索用户名或显示名..." className="max-w-xs" />
        <FilterSelect
          value={filterRole}
          onChange={setFilterRole}
          options={filterOptions}
        />
      </div>

      {/* 用户列表 */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">用户名</th>
                <th className="px-4 py-3 text-left font-medium">显示名</th>
                <th className="px-4 py-3 text-left font-medium">邮箱</th>
                <th className="px-4 py-3 text-left font-medium">角色</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">创建时间</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    暂无用户数据
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    没有匹配的用户
                  </td>
                </tr>
              ) : (
                paginated.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/20"
                    onContextMenu={(e) => openContextMenu(e, [
                      { label: "编辑用户", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(user) },
                      { separator: true },
                      { label: "删除用户", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, disabled: currentUser?.id === user.id, onClick: () => setDeleteTarget(user) },
                    ])}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {user.username}
                        </span>
                        {currentUser?.id === user.id && (
                          <span className="rounded bg-northstar/10 px-1.5 py-0.5 text-[10px] text-northstar">
                            我
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {user.displayName || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} roleMap={roleMap} />
                    </td>
                    <td className="px-4 py-3">
                      {user.active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-task">
                          <span className="h-1.5 w-1.5 rounded-full bg-task" />
                          启用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-graveyard">
                          <span className="h-1.5 w-1.5 rounded-full bg-graveyard" />
                          禁用
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          disabled={currentUser?.id === user.id}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-graveyard/10 hover:text-graveyard disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          title={
                            currentUser?.id === user.id
                              ? "不能删除自己"
                              : "删除"
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
          </div>
        )}
      </Card>

      {/* 创建/编辑弹窗 */}
      {modalMode && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                {modalMode === "create" ? (
                  <>
                    <UserCircle className="h-5 w-5 text-northstar" />
                    创建用户
                  </>
                ) : (
                  <>
                    <Pencil className="h-5 w-5 text-cognition" />
                    编辑用户
                  </>
                )}
              </h2>
              <button
                onClick={closeModal}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 用户名 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  用户名
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  disabled={modalMode === "edit"}
                  required
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20 disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="登录用户名"
                />
                {modalMode === "edit" && (
                  <p className="text-[10px] text-muted-foreground">
                    用户名创建后不可修改
                  </p>
                )}
              </div>

              {/* 密码 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  密码
                  {modalMode === "edit" && (
                    <span className="ml-1 text-muted-foreground/70">
                      （留空则不修改）
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required={modalMode === "create"}
                  minLength={modalMode === "create" ? 6 : undefined}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                  placeholder={
                    modalMode === "create"
                      ? "至少 6 位"
                      : "输入新密码以修改"
                  }
                />
              </div>

              {/* 显示名 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  显示名
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                  placeholder="用户显示名称"
                />
              </div>

              {/* 邮箱 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  邮箱（可选）
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                  placeholder="user@example.com"
                />
              </div>

              {/* 角色（动态拉取，下拉选择） */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  角色
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                >
                  {roles.length === 0 && <option value="">暂无可用角色</option>}
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>
                      {formatRoleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>

              {/* 状态（仅编辑模式） */}
              {modalMode === "edit" && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-background/30 px-3 py-2.5">
                  <span className="text-xs font-medium text-foreground">
                    账户状态
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, active: !form.active })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${
                      form.active ? "bg-task" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        form.active ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* 按钮组 */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeModal} type="button">
                  取消
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      保存中...
                    </>
                  ) : modalMode === "create" ? (
                    "创建"
                  ) : (
                    "保存"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl"
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
              确定要删除用户{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                {deleteTarget.username}
              </code>
              吗？此操作不可撤销，该用户关联的数据将保留但不再归属。
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                type="button"
                disabled={deleting}
              >
                取消
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                type="button"
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
    <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80">
      {role === "admin" && <Shield className="mr-1 h-2.5 w-2.5" />}
      {icon && <span className="mr-1">{icon}</span>}
      {displayName}
    </span>
  );
}

// 格式化日期
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
