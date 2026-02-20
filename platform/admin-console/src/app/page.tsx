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

  const healthyServices = services?.filter((s) => s.status === "healthy").length || 0;
  const totalServices = services?.length || 0;
  const activeMiniApps = miniapps?.filter((m) => m.status === "active").length || 0;
  const totalUsers = users?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Overview of your MiniApp platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Services Health</div>
            <div className="mt-2 flex items-baseline">
              <div className="text-3xl font-semibold text-gray-900 dark:text-white">
                {servicesLoading ? "..." : `${healthyServices}/${totalServices}`}
              </div>
            </div>
            <Badge variant={healthyServices === totalServices ? "success" : "warning"} className="mt-2">
              {healthyServices === totalServices ? "All Healthy" : "Issues Detected"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Active MiniApps</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{miniappsLoading ? "..." : activeMiniApps}</div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Total: {miniapps?.length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Users</div>
            <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{usersLoading ? "..." : totalUsers}</div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Platform Status</div>
            <div className="mt-2 text-3xl font-semibold text-success-600 dark:text-success-400">Online</div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">All systems operational</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Health Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Service Health</CardTitle>
        </CardHeader>
        <CardContent>
          {servicesLoading ? (
            <Spinner />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services?.map((service) => (
                <li
                  key={service.name}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{service.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{formatRelativeTime(service.lastCheck)}</div>
                  </div>
                  <Badge
                    variant={
                      service.status === "healthy" ? "success" : service.status === "unhealthy" ? "danger" : "default"
                    }
                  >
                    {service.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent MiniApps */}
      <Card>
        <CardHeader>
          <CardTitle>Recent MiniApps</CardTitle>
        </CardHeader>
        <CardContent>
          {miniappsLoading ? (
            <Spinner />
          ) : (
            <ul className="space-y-3">
              {miniapps?.slice(0, 5).map((app) => (
                <li key={app.app_id} className="flex items-center justify-between rounded-lg border-b border-gray-100 dark:border-gray-800 pb-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate" title={app.app_id}>{app.app_id}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{formatRelativeTime(app.created_at)}</div>
                  </div>
                  <Badge
                    variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}
                  >
                    {app.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
