"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  Users as UsersIcon,
  Pencil,
  X,
  Loader2,
  Lock,
  Check,
  Briefcase,
  ExternalLink,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  LoadingState,
} from "@/components/layout/PageHeader";
import { HelpButton } from "@/components/layout/HelpButton";
import { toast } from "@/components/ui/toast";
import { PROFESSIONS } from "@/lib/permissions";

type PermissionDef = {
  key: string;
  label: string;
  description: string;
};

type Role = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  profession?: string | null;
};

type CurrentUser = {
  id: string;
  role: string;
} | null;

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [loading, setLoading] = useState(true);

  // 弹窗模式：create 新建 / edit 编辑 / null 关闭
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Role | null>(null);

  // 共享表单字段
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formProfession, setFormProfession] = useState("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = currentUser?.role === "admin";

  const load = useCallback(async () => {
    try {
      const [rolesRes, sessionRes] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch("/api/auth/session"),
      ]);
      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.roles || []);
        setPermissions(data.permissions || []);
      } else if (rolesRes.status === 403) {
        toast("权限不足，需要管理员角色", "error");
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
      console.error("加载角色列表失败:", e);
      toast("加载失败", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 打开新建弹窗
  const openCreate = () => {
    setFormName("");
    setFormDisplayName("");
    setFormDescription("");
    setFormProfession("");
    setFormPermissions([]);
    setEditTarget(null);
    setModalMode("create");
  };

  // 打开编辑弹窗
  const openEdit = (role: Role) => {
    setEditTarget(role);
    setFormName(role.name);
    setFormDisplayName(role.displayName);
    setFormDescription(role.description);
    setFormProfession(role.profession || "");
    setFormPermissions([...role.permissions]);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditTarget(null);
    setFormName("");
    setFormDisplayName("");
    setFormDescription("");
    setFormProfession("");
    setFormPermissions([]);
  };

  const togglePermission = (key: string) => {
    setFormPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // 保存（新建走 POST，编辑走 PUT）
  const handleSave = async () => {
    // profession 必选校验（新建和编辑均要求）
    if (!formProfession) {
      toast("请选择关联职业", "error");
      return;
    }
    setSaving(true);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/admin/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            displayName: formDisplayName,
            description: formDescription,
            profession: formProfession,
            permissions: formPermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || "创建失败", "error");
          return;
        }
        toast("角色创建成功", "success");
      } else if (modalMode === "edit" && editTarget) {
        const res = await fetch("/api/admin/roles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editTarget.name,
            description: formDescription,
            profession: formProfession || null,
            permissions: formPermissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error || "保存失败", "error");
          return;
        }
        toast("角色更新成功", "success");
      }
      closeModal();
      await load();
    } catch {
      toast("保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

  // 确认删除角色
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/roles?name=${encodeURIComponent(deleteTarget.name)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "删除失败", "error");
        return;
      }
      toast("角色已删除", "success");
      setDeleteTarget(null);
      await load();
    } catch {
      toast("删除失败，请重试", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingState title="角色管理" />;
  }

  // 非管理员只读视图
  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="角色管理" subtitle="查看系统角色与权限配置" />
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">权限不足</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            仅管理员可访问角色管理页面
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="角色管理"
        subtitle="管理系统角色与权限配置"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              新建角色
            </Button>
            <HelpButton contentKey="admin-roles" />
          </div>
        }
      />

      {/* 权限目录说明 */}
      {permissions.length > 0 && (
        <Card className="mb-6 bg-muted/20">
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              权限目录（共 {permissions.length} 项）
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {permissions.map((p) => (
              <div
                key={p.key}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground">
                    {p.key}
                  </code>
                  <span className="text-xs font-medium text-foreground">
                    {p.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 角色卡片列表 */}
      <div className="space-y-4">
        {roles.length === 0 ? (
          <Card className="py-12 text-center text-muted-foreground">
            暂无角色数据
          </Card>
        ) : (
          roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              permissions={permissions}
              onEdit={() => openEdit(role)}
              onDelete={() => setDeleteTarget(role)}
            />
          ))
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      {modalMode && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                {modalMode === "create" ? (
                  <>
                    <Plus className="h-5 w-5 text-northstar" />
                    新建角色
                  </>
                ) : (
                  <>
                    <Pencil className="h-5 w-5 text-cognition" />
                    编辑角色 · {editTarget?.displayName}
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

            {/* 内容（可滚动） */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {modalMode === "create" ? (
                <>
                  {/* 新建模式：name 可编辑 */}
                  <div className="mb-4 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      角色标识 (name)
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                      placeholder="英文标识，如 pm_lead"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      不可与系统内置角色（admin/editor/viewer）冲突
                    </p>
                  </div>

                  {/* 新建模式：displayName 可编辑 */}
                  <div className="mb-5 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      显示名称 (displayName)
                    </label>
                    <input
                      type="text"
                      value={formDisplayName}
                      onChange={(e) => setFormDisplayName(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                      placeholder="如：产品负责人"
                    />
                  </div>
                </>
              ) : (
                /* 编辑模式：name 只读 */
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    角色标识
                  </span>
                  <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-foreground">
                    {editTarget?.name}
                  </code>
                  {editTarget?.isSystem && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      系统内置
                    </span>
                  )}
                </div>
              )}

              {/* 描述 */}
              <div className="mb-5 space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  角色描述
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                  placeholder="描述该角色的职责与权限范围"
                />
              </div>

              {/* 关联职业（必选，按职位分配角色和功能权限） */}
              <div className="mb-5 space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Briefcase className="h-3.5 w-3.5 text-cognition" />
                  关联职业
                  <span className="text-[10px] font-normal text-graveyard">
                    *必选
                  </span>
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (绑定后用户被分配此角色时自动应用该职业的 AI 工作空间)
                  </span>
                </label>
                <select
                  value={formProfession}
                  onChange={(e) => setFormProfession(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background/50 px-3 py-2 text-sm text-foreground transition-colors focus:border-northstar/50 focus:outline-none focus:ring-2 focus:ring-northstar/20"
                >
                  <option value="">请选择职业</option>
                  {PROFESSIONS.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.icon} {p.label}（{p.key}）
                    </option>
                  ))}
                </select>
                {formProfession && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {PROFESSIONS.find((p) => p.key === formProfession)?.description}
                  </p>
                )}
              </div>

              {/* 权限选择 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">
                    权限配置
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    已选 {formPermissions.length} / {permissions.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {permissions.map((p) => {
                    const checked = formPermissions.includes(p.key);
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => togglePermission(p.key)}
                        className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          checked
                            ? "border-northstar/40 bg-northstar/5"
                            : "border-border bg-background/30 hover:bg-muted"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                            checked
                              ? "border-northstar bg-northstar text-primary-foreground"
                              : "border-border bg-card"
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-foreground">
                              {p.label}
                            </span>
                            <code className="rounded bg-muted px-1 py-0 text-[9px] font-mono text-muted-foreground">
                              {p.key}
                            </code>
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {p.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={closeModal} type="button">
                取消
              </Button>
              <Button onClick={handleSave} disabled={saving}>
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
                确认删除角色
              </h2>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              确定要删除角色{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                {deleteTarget.displayName}
              </code>
              （{deleteTarget.name}）吗？此操作不可撤销。
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

// 角色卡片
function RoleCard({
  role,
  permissions,
  onEdit,
  onDelete,
}: {
  role: Role;
  permissions: PermissionDef[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  // 角色 accent 色
  const accent =
    role.name === "admin"
      ? "graveyard"
      : role.name === "editor"
        ? "campaign"
        : "muted";

  const accentStyles: Record<string, { ring: string; icon: string; badge: string }> = {
    graveyard: {
      ring: "border-graveyard/20",
      icon: "bg-graveyard/10 text-graveyard",
      badge: "bg-graveyard/10 text-graveyard border-graveyard/20",
    },
    campaign: {
      ring: "border-campaign/20",
      icon: "bg-campaign/10 text-campaign",
      badge: "bg-campaign/10 text-campaign border-campaign/20",
    },
    muted: {
      ring: "border-border",
      icon: "bg-muted text-muted-foreground",
      badge: "bg-muted text-muted-foreground border-border",
    },
  };
  const style = accentStyles[accent] || accentStyles.muted;

  // 权限 key → label 映射
  const permLabelMap = Object.fromEntries(
    permissions.map((p) => [p.key, p.label])
  );

  return (
    <Card className={style.ring}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* 左：角色信息 */}
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${style.icon}`}
            >
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {role.displayName}
                </h3>
                <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                  {role.name}
                </code>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {role.description}
              </p>
            </div>
          </div>

          {/* 权限列表 */}
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span>
                权限（{role.permissions.length} / {permissions.length}）
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {role.permissions.length === 0 ? (
                <span className="text-xs text-muted-foreground">无权限</span>
              ) : (
                role.permissions.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center rounded-full border border-border bg-background/50 px-2 py-0.5 text-[11px] text-foreground/80"
                  >
                    {permLabelMap[key] || key}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 右：用户数 + 操作 */}
        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${style.badge}`}
          >
            <UsersIcon className="h-3 w-3" />
            {role.userCount} 个用户
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
              编辑
            </Button>
            {/* 非系统角色显示删除按钮 */}
            {!role.isSystem && (
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-graveyard/30 hover:bg-graveyard/10 hover:text-graveyard"
                title="删除角色"
              >
                <Trash2 className="h-3 w-3" />
                删除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 底部行：职业绑定 + 跳转工作空间配置 */}
      <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Briefcase className="h-3 w-3 text-muted-foreground" />
          {role.profession ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-cognition/30 bg-cognition/5 px-2 py-0.5 text-cognition">
              <span>{role.profession}</span>
              <span className="text-[10px] text-cognition/70">已绑定职业</span>
            </span>
          ) : (
            <span className="text-muted-foreground">未绑定职业</span>
          )}
        </div>
        {role.profession && (
          <a
            href={`/admin/profession-workspaces#${role.profession}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded text-[10px] text-cognition hover:underline"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            配置工作空间
          </a>
        )}
      </div>
    </Card>
  );
}
