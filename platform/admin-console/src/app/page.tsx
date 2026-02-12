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
import { cn, formatRelativeTime } from "@/lib/utils";

export default function DashboardPage() {
  const { data: services, isLoading: servicesLoading } = useServicesHealth();
  const { data: miniappsData, isLoading: miniappsLoading } = useMiniApps();
  const { data: usersData, isLoading: usersLoading } = useUsers();

  const miniapps = miniappsData?.miniapps;
  const healthyServices = services?.filter((s) => s.status === "healthy").length || 0;
  const totalServices = services?.length || 0;
  const activeMiniApps = miniapps?.filter((m) => m.status === "active").length || 0;
  const totalUsers = usersData?.total || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your MiniApp platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm font-medium">Services Health</div>
            <div className="mt-2 flex items-baseline">
              <div className="text-3xl font-semibold text-foreground">
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
            <div className="text-muted-foreground text-sm font-medium">Active MiniApps</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">
              {miniappsLoading ? "..." : activeMiniApps}
            </div>
            <p className="text-muted-foreground mt-2 text-sm">Total: {miniapps?.length || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm font-medium">Total Users</div>
            <div className="mt-2 text-3xl font-semibold text-foreground">{usersLoading ? "..." : totalUsers}</div>
            <p className="text-muted-foreground mt-2 text-sm">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-muted-foreground text-sm font-medium">Platform Status</div>
            <div
              className={cn(
                "mt-2 text-3xl font-semibold",
                servicesLoading
                  ? "text-muted-foreground"
                  : healthyServices === totalServices
                    ? "text-emerald-400"
                    : "text-yellow-400"
              )}
            >
              {servicesLoading ? "..." : healthyServices === totalServices ? "Online" : "Degraded"}
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {servicesLoading
                ? "Checking services..."
                : healthyServices === totalServices
                  ? "All systems operational"
                  : `${totalServices - healthyServices} service(s) unhealthy`}
            </p>
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
          ) : !services?.length ? (
            <div className="text-muted-foreground py-8 text-center">No services configured</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="border-border/20 flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <div className="font-medium text-foreground">{service.name}</div>
                    <div className="text-muted-foreground text-sm">{formatRelativeTime(service.lastCheck)}</div>
                  </div>
                  <Badge
                    variant={
                      service.status === "healthy" ? "success" : service.status === "unhealthy" ? "danger" : "default"
                    }
                  >
                    {service.status}
                  </Badge>
                </div>
              ))}
            </div>
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
          ) : !miniapps?.length ? (
            <div className="text-muted-foreground py-8 text-center">No MiniApps registered yet</div>
          ) : (
            <div className="space-y-3">
              {miniapps.slice(0, 5).map((app) => (
                <div key={app.app_id} className="border-border/10 flex items-center justify-between border-b pb-3">
                  <div>
                    <div className="font-medium text-foreground">{app.app_id}</div>
                    <div className="text-muted-foreground text-sm">{formatRelativeTime(app.created_at)}</div>
                  </div>
                  <Badge
                    variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}
                  >
                    {app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
