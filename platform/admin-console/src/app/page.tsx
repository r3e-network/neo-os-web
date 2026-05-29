"use client";

import {
  Activity,
  AlertTriangle,
  AppWindow,
  CheckCircle2,
  Server,
  Users,
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
  const {
    data: services,
    isLoading: servicesLoading,
    error: servicesError,
  } = useServicesHealth();
  const {
    data: miniapps,
    isLoading: miniappsLoading,
    error: miniappsError,
  } = useMiniApps();
  const {
    data: users,
    isLoading: usersLoading,
    error: usersError,
  } = useUsers();

  const healthyServices =
    services?.filter((service) => service.status === "healthy").length ?? 0;
  const totalServices = services?.length ?? 0;
  const activeMiniApps =
    miniapps?.filter((miniapp) => miniapp.status === "active").length ?? 0;
  const totalMiniApps = miniapps?.length ?? 0;
  const totalUsers = users?.length ?? 0;
  const hasDashboardError = Boolean(servicesError || miniappsError || usersError);
  const isLoading = servicesLoading || miniappsLoading || usersLoading;
  const allServicesHealthy =
    !servicesLoading &&
    !servicesError &&
    totalServices > 0 &&
    healthyServices === totalServices;
  const platformStatus = isLoading
    ? "Checking"
    : allServicesHealthy && !hasDashboardError
      ? "Online"
      : "Needs Review";

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Dashboard"
        highlightLastWord
        description="Live operating view for services, MiniApps, users, and platform readiness."
      />

      {hasDashboardError && (
        <AlertState
          label="Dashboard overview could not be loaded"
          title="Dashboard overview could not be loaded"
          message="One or more platform datasets failed to load. Existing rows are hidden until fresh data is available."
        />
      )}

      <section
        aria-label="Platform operations summary"
        className="dashboard-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          icon={Server}
          label="Services Health"
          value={servicesLoading ? "..." : `${healthyServices}/${totalServices}`}
          detail={allServicesHealthy ? "All services responding" : "Review service health"}
          tone={allServicesHealthy ? "success" : "warning"}
        />
        <SummaryCard
          icon={AppWindow}
          label="Active MiniApps"
          value={miniappsLoading ? "..." : activeMiniApps.toLocaleString()}
          detail={`Total: ${totalMiniApps.toLocaleString()}`}
          tone="info"
        />
        <SummaryCard
          icon={Users}
          label="Total Users"
          value={usersLoading ? "..." : totalUsers.toLocaleString()}
          detail="Registered platform users"
          tone="neutral"
        />
        <SummaryCard
          icon={platformStatus === "Online" ? CheckCircle2 : AlertTriangle}
          label="Platform Status"
          value={platformStatus}
          detail={
            platformStatus === "Online"
              ? "All systems operational"
              : "Operator attention needed"
          }
          tone={platformStatus === "Online" ? "success" : "warning"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card
          aria-label="Service health panel"
          className="dashboard-service-card overflow-hidden"
          variant="default"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Service Health</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                Latest status from platform services.
              </p>
            </div>
            <Badge variant={allServicesHealthy ? "success" : "warning"}>
              {allServicesHealthy ? "Healthy" : "Review"}
            </Badge>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <LoadingState />
            ) : servicesError ? (
              <AlertState
                label="Service health could not be loaded"
                title="Service health could not be loaded"
                message="Fresh service health data is unavailable."
              />
            ) : services && services.length > 0 ? (
              <ul className="space-y-3">
                {services.map((service) => (
                  <ServiceRow key={service.name} service={service} />
                ))}
              </ul>
            ) : (
              <EmptyState message="No services registered" />
            )}
          </CardContent>
        </Card>

        <Card
          aria-label="Recent MiniApps panel"
          className="dashboard-miniapps-card overflow-hidden"
          variant="default"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Recent MiniApps</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                Recently registered application surfaces.
              </p>
            </div>
            <Badge variant="info">{totalMiniApps.toLocaleString()} Total</Badge>
          </CardHeader>
          <CardContent>
            {miniappsLoading ? (
              <LoadingState />
            ) : miniappsError ? (
              <AlertState
                label="Recent MiniApps could not be loaded"
                title="Recent MiniApps could not be loaded"
                message="MiniApp activity is hidden until fresh data loads."
              />
            ) : miniapps && miniapps.length > 0 ? (
              <ul className="space-y-3">
                {miniapps.slice(0, 5).map((miniapp) => (
                  <MiniAppRow key={miniapp.app_id} miniapp={miniapp} />
                ))}
              </ul>
            ) : (
              <EmptyState message="No miniapps registered" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "info" | "neutral";
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: SummaryCardProps) {
  return (
    <Card variant="default">
      <CardContent className="flex min-h-36 flex-col justify-between gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {label}
            </p>
            <p className="mt-3 text-3xl font-black leading-none text-gray-950">
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              summaryToneClasses[tone],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-600">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ServiceRow({ service }: { service: ServiceHealth }) {
  return (
    <li className="dashboard-row flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-gray-900">
          {service.name}
        </p>
        <p className="mt-1 text-xs font-medium text-gray-500">
          Last check {formatRelativeTime(service.lastCheck)}
        </p>
      </div>
      <Badge variant={serviceStatusVariant(service.status)}>
        {service.status}
      </Badge>
    </li>
  );
}

function MiniAppRow({ miniapp }: { miniapp: MiniApp }) {
  return (
    <li className="dashboard-row flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-gray-900" title={miniapp.app_id}>
          {miniapp.app_id}
        </p>
        <p className="mt-1 text-xs font-medium text-gray-500">
          Created {formatRelativeTime(miniapp.created_at)}
        </p>
      </div>
      <Badge variant={miniAppStatusVariant(miniapp.status)}>
        {miniapp.status}
      </Badge>
    </li>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-32 items-center justify-center">
      <Spinner />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-medium text-gray-500">
      {message}
    </p>
  );
}

function AlertState({
  label,
  title,
  message,
}: {
  label: string;
  title: string;
  message: string;
}) {
  return (
    <div
      aria-label={label}
      className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3"
      role="alert"
    >
      <p className="text-sm font-bold text-warning-800">{title}</p>
      <p className="mt-1 text-sm text-warning-700">{message}</p>
    </div>
  );
}

function serviceStatusVariant(status: ServiceHealth["status"]) {
  if (status === "healthy") return "success";
  if (status === "unhealthy") return "danger";
  return "default";
}

function miniAppStatusVariant(status: MiniApp["status"]) {
  if (status === "active") return "success";
  if (status === "pending" || status === "beta") return "warning";
  return "danger";
}

const summaryToneClasses = {
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-warning-100 bg-warning-50 text-warning-700",
  info: "border-primary-100 bg-primary-50 text-primary-700",
  neutral: "border-gray-200 bg-gray-100 text-gray-700",
};
