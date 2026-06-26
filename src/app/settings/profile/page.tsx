"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, User } from "lucide-react";
import { PageHeader, Card, Button, LoadingState } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  profession: string | null;
  avatarUrl: string | null;
  role: string;
  email: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员 (admin)",
  editor: "编辑 (editor)",
  viewer: "只读 (viewer)",
};

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 表单字段
  const [avatarUrl, setAvatarUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profession, setProfession] = useState("");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (!mounted) return;
        if (!res.ok) throw new Error("加载失败");
        const data = await res.json();
        const u = data.user as UserProfile;
        setProfile(u);
        setAvatarUrl(u.avatarUrl || "");
        setDisplayName(u.displayName || "");
        setProfession(u.profession || "");
      } catch {
        if (!mounted) return;
        toast("加载个人资料失败", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          profession: profession.trim(),
          avatarUrl: avatarUrl.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "保存失败");
      }
      const data = await res.json();
      const u = data.user as UserProfile;
      setProfile(u);
      setAvatarUrl(u.avatarUrl || "");
      setDisplayName(u.displayName || "");
      setProfession(u.profession || "");
      toast("个人资料已保存", "success");
    } catch (e) {
      toast("保存失败：" + (e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState title="个人资料" />;
  }

  if (!profile) {
    return (
      <div className="p-4 sm:p-8">
        <PageHeader title="个人资料" subtitle="加载失败" />
      </div>
    );
  }

  const previewInitial = (displayName || profile.username || "U").charAt(0).toUpperCase();

  return (
    <div className="p-4 sm:p-8">
      <PageHeader
        title="个人资料"
        subtitle="管理你的头像、昵称和职业信息"
      />

      <Card className="max-w-2xl">
        {/* 头像预览 */}
        <div className="mb-6 flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName || profile.username}
              className="h-16 w-16 rounded-full border border-border object-cover shadow-sm"
            />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground shadow-sm">
              {previewInitial}
            </span>
          )}
          <div>
            <div className="text-sm font-medium text-foreground">
              {displayName || profile.username}
            </div>
            <div className="text-xs text-muted-foreground">
              {ROLE_LABELS[profile.role] || profile.role}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* 头像 URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="avatarUrl">
              头像 URL
            </label>
            <input
              id="avatarUrl"
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png（留空则显示首字母）"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[10px] text-muted-foreground">
              粘贴图片地址，上方会实时预览
            </p>
          </div>

          {/* 昵称 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="displayName">
              昵称
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="显示在顶部栏和菜单中的名称"
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 姓名（只读） */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="username">
              用户名（登录名，不可修改）
            </label>
            <input
              id="username"
              type="text"
              value={profile.username}
              readOnly
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            />
          </div>

          {/* 职业 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="profession">
              职业
            </label>
            <input
              id="profession"
              type="text"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="如：产品经理、工程师、设计师"
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* 角色（只读） */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="role">
              角色（不可修改）
            </label>
            <input
              id="role"
              type="text"
              value={ROLE_LABELS[profile.role] || profile.role}
              readOnly
              disabled
              className="w-full cursor-not-allowed rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            />
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 保存中...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" /> 保存资料
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* 说明 */}
      <Card className="mt-4 max-w-2xl border-border/60 bg-muted/20">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <p>· 头像、昵称、职业可自由修改，保存后立即生效。</p>
            <p>· 用户名和角色由管理员管理，如需修改请联系管理员。</p>
            <p>· 修改昵称后，顶部栏显示可能需要刷新页面或重新登录才会更新。</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
