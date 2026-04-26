// =============================================================================
// Dashboard Home Page
// =============================================================================

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useServicesHealth } from "@/lib/hooks/useServices";
import { useMiniApps } from "@/lib/hooks/useMiniApps";
import { useUsers } from "@/lib/hooks/useUsers";
import { formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { data: services, isLoading: servicesLoading } = useServicesHealth();
  const { data: miniapps, isLoading: miniappsLoading } = useMiniApps();
  const { data: users, isLoading: usersLoading } = useUsers();

  const healthyServices =
    services?.filter((s) => s.status === "healthy").length || 0;
  const totalServices = services?.length || 0;
  const activeMiniApps =
    miniapps?.filter((m) => m.status === "active").length || 0;
  const totalUsers = users?.length || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative z-10">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">
          System{" "}
          <span className="text-neo drop-shadow-[0_0_8px_rgba(0,229,153,0.5)]">
            Dashboard
          </span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mt-1 font-medium">
          Overview of your Neo MiniApp platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass" className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-neo/5 group-hover:bg-neo/10 blur-[30px] rounded-full transition-all duration-500 -z-10" />
          <CardContent className="pt-6">
            <div className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">
              Services Health
            </div>
            <div className="mt-3 flex items-baseline">
              <div className="text-4xl font-black text-gray-900 dark:text-white drop-shadow-sm">
                {servicesLoading
                  ? "..."
                  : `${healthyServices}/${totalServices}`}
              </div>
            </div>
            <Badge
              variant={
                healthyServices === totalServices ? "success" : "warning"
              }
              className="mt-4"
            >
              {healthyServices === totalServices
                ? "All Healthy"
                : "Issues Detected"}
            </Badge>
          </CardContent>
        </Card>

        <Card variant="glass" className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 group-hover:bg-blue-500/10 blur-[30px] rounded-full transition-all duration-500 -z-10" />
          <CardContent className="pt-6">
            <div className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">
              Active MiniApps
            </div>
            <div className="mt-3 text-4xl font-black text-gray-900 dark:text-white drop-shadow-sm">
              {miniappsLoading ? "..." : activeMiniApps}
            </div>
            <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              Total: {miniapps?.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#7000FF]/5 group-hover:bg-[#7000FF]/10 blur-[30px] rounded-full transition-all duration-500 -z-10" />
          <CardContent className="pt-6">
            <div className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">
              Total Users
            </div>
            <div className="mt-3 text-4xl font-black text-gray-900 dark:text-white drop-shadow-sm">
              {usersLoading ? "..." : totalUsers}
            </div>
            <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              Registered users
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 group-hover:bg-emerald-500/10 blur-[30px] rounded-full transition-all duration-500 -z-10" />
          <CardContent className="pt-6">
            <div className="text-sm font-bold uppercase text-gray-500 dark:text-gray-400">
              Platform Status
            </div>
            <div className="mt-3 text-4xl font-black text-neo drop-shadow-sm">
              Online
            </div>
            <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              All systems operational
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Service Health Grid */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Service Health</CardTitle>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            ) : services && services.length > 0 ? (
              <ul className="space-y-3">
                {services.map((service) => (
                  <li
                    key={service.name}
                    className="flex items-center justify-between rounded-xl border border-gray-200/50 dark:border-white/5 bg-black/20 backdrop-blur-md p-4 transition-all hover:bg-white/5"
                  >
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {service.name}
                      </div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatRelativeTime(service.lastCheck)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        service.status === "healthy"
                          ? "success"
                          : service.status === "unhealthy"
                            ? "danger"
                            : "default"
                      }
                    >
                      {service.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-6">
                No services registered
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent MiniApps */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle>Recent MiniApps</CardTitle>
          </CardHeader>
          <CardContent>
            {miniappsLoading ? (
              <div className="flex justify-center p-8">
                <Spinner />
              </div>
            ) : miniapps && miniapps.length > 0 ? (
              <ul className="space-y-3">
                {miniapps.slice(0, 5).map((app) => (
                  <li
                    key={app.app_id}
                    className="flex items-center justify-between rounded-xl border border-gray-200/50 dark:border-white/5 bg-black/20 backdrop-blur-md p-4 transition-all hover:bg-white/5"
                  >
                    <div className="min-w-0 pr-4">
                      <div
                        className="font-semibold text-gray-900 dark:text-white truncate"
                        title={app.app_id}
                      >
                        {app.app_id}
                      </div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatRelativeTime(app.created_at)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        app.status === "active"
                          ? "success"
                          : app.status === "pending"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {app.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-6">
                No miniapps registered
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
