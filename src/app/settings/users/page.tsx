import { redirect } from "next/navigation";

// 用户管理已迁移至 /admin/users（独立一级菜单）
export default function SettingsUsersPage() {
  redirect("/admin/users");
}
