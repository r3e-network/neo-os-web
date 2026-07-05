"use client";

import {
  Activity,
  AlertTriangle,
  AppWindow,
  CheckCircle2,
  Server,
  Users,
  ArrowRight,
  Search,
  RefreshCw,
  Download,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { useServicesHealth } from "@/lib/hooks/useServices";
import { useMiniApps } from "@/lib/hooks/useMiniApps";
import { useUsers } from "@/lib/hooks/useUsers";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { MiniApp, ServiceHealth } from "@/types";

export default function DashboardPage() {
  const { data: services, isLoading: sLoading, error: sErr } = useServicesHealth();
  const { data: miniapps, isLoading: mLoading, error: mErr } = useMiniApps();
  const { data: users, isLoading: uLoading, error: uErr } = useUsers();

  const healthySvc = services?.filter((s) => s.status === "healthy").length ?? 0;
  const totalSvc = services?.length ?? 0;
  const activeApps = miniapps?.filter((m) => m.status === "active").length ?? 0;
  const totalApps = miniapps?.length ?? 0;
  const totalUsers = users?.length ?? 0;
  const hasErr = Boolean(sErr || mErr || uErr);
  const loading = sLoading || mLoading || uLoading;
  const allHealthy = !sLoading && !sErr && totalSvc > 0 && healthySvc === totalSvc;
  const status = loading ? "Checking" : allHealthy && !hasErr ? "Online" : "Needs Review";

  const stats = [
    { icon: Server, label: "服务健康", value: loading ? "..." : `${healthySvc}/${totalSvc}`, detail: allHealthy ? "全部正常响应" : "需要关注", tone: allHealthy ? "success" : "warning" as const },
    { icon: AppWindow, label: "活跃小程序", value: mLoading ? "..." : activeApps.toLocaleString(), detail: `共 ${totalApps.toLocaleString()} 个`, tone: "info" as const },
    { icon: Users, label: "平台用户", value: uLoading ? "..." : totalUsers.toLocaleString(), detail: "已注册用户", tone: "neutral" as const },
    { icon: status === "Online" ? CheckCircle2 : AlertTriangle, label: "平台状态", value: status, detail: status === "Online" ? "一切正常运转" : "需要运营关注", tone: status === "Online" ? "success" : "warning" as const },
  ];

  const toneColors: Record<string, string> = {
    success: "border-neo-200 bg-neo-50 text-neo-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-accent-200 bg-accent-50 text-accent-600",
    neutral: "border-border-strong bg-canvas-alt text-ink-secondary",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="仪表盘" highlightLastWord description="实时监控平台服务、小程序和用户数据。" />
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-xs font-semibold text-ink-secondary transition-all hover:bg-canvas-alt hover:text-ink">
            <Download className="h-3.5 w-3.5" />
            导出报表
          </button>
          <button className="inline-flex items-center gap-2 rounded-full bg-neo-500 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-neo-600 hover:shadow-brand">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新数据
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {hasErr && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3" role="alert">
          <p className="text-sm font-bold text-amber-800">部分数据加载失败</p>
          <p className="mt-1 text-sm text-amber-700">数据集部分不可用，已缓存数据将被隐藏。</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-v3 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{s.label}</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{s.value}</p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", toneColors[s.tone])}>
                <s.icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-xs font-medium text-ink-secondary">{s.detail}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: AppWindow, label: "发布新版本", desc: "3 个待发布", color: "bg-neo-50 text-neo-600" },
          { icon: CheckCircle2, label: "审核队列", desc: "7 个待审核", color: "bg-accent-50 text-accent-600" },
          { icon: Settings, label: "合约部署", desc: "管理升级与迁移", color: "bg-amber-50 text-amber-600" },
        ].map((qa) => (
          <button key={qa.label} className="card-v3 flex items-center gap-4 p-4 text-left">
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", qa.color)}>
              <qa.icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-ink">{qa.label}</div>
              <div className="text-xs text-ink-muted">{qa.desc}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-faint" />
          </button>
        ))}
      </div>

      {/* Two Column */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Service Health */}
        <div className="card-v3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-ink">服务健康</h3>
              <p className="mt-0.5 text-xs text-ink-muted">平台服务最新状态</p>
            </div>
            <Badge variant={allHealthy ? "success" : "warning"}>
              {allHealthy ? "全部正常" : "需查看"}
            </Badge>
          </div>
          <div className="p-5">
            {sLoading ? (
              <div className="flex h-32 items-center justify-center"><Spinner /></div>
            ) : services && services.length > 0 ? (
              <ul className="space-y-2">
                {services.map((svc) => (
                  <li key={svc.name} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-canvas-alt px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{svc.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">上次检测 {formatRelativeTime(svc.lastCheck)}</p>
                    </div>
                    <Badge variant={svc.status === "healthy" ? "success" : "danger"}>
                      {svc.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-canvas-alt py-8 text-center text-sm text-ink-muted">暂无服务数据</p>
            )}
          </div>
        </div>

        {/* Recent Miniapps */}
        <div className="card-v3 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-ink">最近更新</h3>
              <p className="mt-0.5 text-xs text-ink-muted">已注册的应用列表</p>
            </div>
            <Badge variant="info">{totalApps.toLocaleString()} 总计</Badge>
          </div>
          <div className="p-5">
            {mLoading ? (
              <div className="flex h-32 items-center justify-center"><Spinner /></div>
            ) : miniapps && miniapps.length > 0 ? (
              <ul className="space-y-2">
                {miniapps.slice(0, 5).map((app) => (
                  <li key={app.app_id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-canvas-alt px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink" title={app.app_id}>{app.app_id}</p>
                      <p className="mt-0.5 text-[11px] text-ink-muted">创建于 {formatRelativeTime(app.created_at)}</p>
                    </div>
                    <Badge variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}>
                      {app.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-canvas-alt py-8 text-center text-sm text-ink-muted">暂无小程序数据</p>
            )}
          </div>
        </div>
      </div>

      {/* All Miniapps Table */}
      <div className="card-v3 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-ink">全部小程序</h3>
            <p className="mt-0.5 text-xs text-ink-muted">共 {totalApps.toLocaleString()} 个</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-full bg-canvas-inset p-1">
              {["全部","运行中","草稿","归档"].map((t,i) => (
                <button key={t} className={cn("rounded-full px-4 py-1.5 text-xs font-semibold transition-all", i===0 ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink")}>
                  {t}
                </button>
              ))}
            </div>
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input type="text" placeholder="搜索..." className="h-9 w-52 rounded-full border border-border-strong bg-surface pl-9 pr-4 text-xs text-ink outline-none transition-all placeholder:text-ink-faint focus:border-neo-400 focus:shadow-[0_0_0_3px_rgba(22,199,132,0.12)]" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-canvas-alt">
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted">小程序</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted">分类</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted">状态</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted">网络</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted">更新</th>
                <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-ink-muted">操作</th>
              </tr>
            </thead>
            <tbody>
              {(mLoading ? [] : (miniapps?.slice(0, 8) ?? [])).length > 0
                ? (miniapps?.slice(0, 8) ?? []).map((app) => (
                  <tr key={app.app_id} className="border-b border-border transition-colors hover:bg-canvas-alt/50 last:border-b-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neo-50 text-sm font-bold text-neo-600">
                          {String(app.status || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{app.app_id}</p>
                          <p className="text-[10px] font-mono text-ink-muted">{app.app_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-secondary capitalize">{"category" in app ? String((app as {category: unknown}).category) : "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}>
                        {app.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-ink-secondary">Mainnet</td>
                    <td className="px-5 py-3 text-xs text-ink-muted">{formatRelativeTime(app.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-canvas-alt hover:text-ink" title="编辑">✏️</button>
                        <button className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-canvas-alt hover:text-ink" title="设置">⚙️</button>
                      </div>
                    </td>
                  </tr>
                ))
                : (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-ink-muted">
                      {mLoading ? "加载中..." : "暂无小程序数据"}
                    </td>
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
