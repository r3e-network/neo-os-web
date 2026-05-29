// =============================================================================
// Services Health Page
// =============================================================================

"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Server,
  Settings,
  ShieldQuestion,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { PageHeader } from "@/components/layout/PageHeader";
import { useServicesHealth } from "@/lib/hooks/useServices";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ServiceHealth } from "@/types";

const SERVICE_POLL_INTERVAL_MS = 30000;
const SERVICE_POLL_INTERVAL_LABEL = "30s";

export default function ServicesPage() {
  const { data: services, isLoading, error } = useServicesHealth(
    SERVICE_POLL_INTERVAL_MS,
  );

  const serviceList = services ?? [];
  const totalServices = serviceList.length;
  const healthyServices = serviceList.filter(
    (service) => service.status === "healthy",
  ).length;
  const unhealthyServices = serviceList.filter(
    (service) => service.status === "unhealthy",
  ).length;
  const unknownServices = serviceList.filter(
    (service) => service.status === "unknown",
  ).length;
  const allServicesHealthy =
    !isLoading &&
    !error &&
    totalServices > 0 &&
    healthyServices === totalServices;
  const hasHealthError = Boolean(error);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Monitor service health, release versions, endpoints, and configuration readiness."
        highlightLastWord
      />

      <section
        aria-label="Services operations summary"
        className="services-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          icon={allServicesHealthy ? CheckCircle2 : Server}
          label="Healthy Services"
          value={
            isLoading
              ? "..."
              : hasHealthError
                ? "Unavailable"
                : `${healthyServices}/${totalServices}`
          }
          detail={
            hasHealthError
              ? "Fresh health check failed"
              : allServicesHealthy
                ? "All monitored services responding"
                : "Review service status below"
          }
          tone={
            hasHealthError
              ? "danger"
              : allServicesHealthy
                ? "success"
                : "warning"
          }
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Unhealthy"
          value={isLoading ? "..." : unhealthyServices.toLocaleString()}
          detail={
            unhealthyServices === 1
              ? "1 service needs attention"
              : `${unhealthyServices.toLocaleString()} services need attention`
          }
          tone={unhealthyServices > 0 ? "danger" : "success"}
        />
        <SummaryCard
          icon={ShieldQuestion}
          label="Unknown"
          value={isLoading ? "..." : unknownServices.toLocaleString()}
          detail="Services without a confirmed state"
          tone={unknownServices > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          icon={Clock3}
          label="Polling"
          value={SERVICE_POLL_INTERVAL_LABEL}
          detail="Automatic health refresh interval"
          tone="info"
        />
      </section>

      <Card
        aria-label="Services health panel"
        className="services-health-card overflow-hidden"
        variant="default"
      >
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Service Health Status</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Current service checks with direct access to configuration.
            </p>
          </div>
          <Badge variant={allServicesHealthy ? "success" : "warning"}>
            {allServicesHealthy ? "Healthy" : "Review"}
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <AlertState
              label="Services health could not be loaded"
              title="Services health could not be loaded"
              message="Fresh service status is unavailable. Existing rows are hidden until the next successful health check."
            />
          ) : serviceList.length > 0 ? (
            <ServicesInventory services={serviceList} />
          ) : (
            <EmptyState message="No services registered" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ServicesInventory({ services }: { services: ServiceHealth[] }) {
  return (
    <>
      <div className="services-desktop-table hidden md:block">
        <Table
          aria-label="Services status"
          className="services-status-table table-fixed"
        >
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[9%]" />
            <col className="w-[13%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Service Name</TableHead>
              <TableHead className="px-4">Status</TableHead>
              <TableHead className="px-4">Endpoint</TableHead>
              <TableHead className="px-4">Version</TableHead>
              <TableHead className="px-4">Last Check</TableHead>
              <TableHead className="px-4">Error</TableHead>
              <TableHead className="px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.name}>
                <TableCell className="truncate px-4 font-bold text-gray-900">
                  {service.name}
                </TableCell>
                <TableCell className="px-4">
                  <ServiceStatusBadge status={service.status} />
                </TableCell>
                <TableCell
                  className="truncate px-4 text-xs font-medium text-gray-500"
                  title={service.url}
                >
                  {service.url}
                </TableCell>
                <TableCell className="truncate px-4 text-sm text-gray-700">
                  {service.version || "N/A"}
                </TableCell>
                <TableCell className="truncate px-4 text-sm text-gray-500">
                  {formatRelativeTime(service.lastCheck)}
                </TableCell>
                <TableCell
                  className={cn(
                    "truncate px-4 text-sm",
                    service.error ? "text-danger-700" : "text-gray-500",
                  )}
                  title={service.error || "Clear"}
                >
                  {service.error || "Clear"}
                </TableCell>
                <TableCell className="px-4">
                  <ConfigureLink
                    ariaLabel={`Configure ${service.name}`}
                    serviceName={service.name}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul
        aria-label="Mobile services list"
        className="services-mobile-list space-y-3 md:hidden"
      >
        {services.map((service) => (
          <MobileServiceCard key={service.name} service={service} />
        ))}
      </ul>
    </>
  );
}

function MobileServiceCard({ service }: { service: ServiceHealth }) {
  return (
    <li className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-900">
            {service.name}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-gray-500">
            {service.url}
          </p>
        </div>
        <ServiceStatusBadge status={service.status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Version
          </dt>
          <dd className="mt-1 font-semibold text-gray-800">
            {service.version || "N/A"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Last Check
          </dt>
          <dd className="mt-1 font-semibold text-gray-800">
            {formatRelativeTime(service.lastCheck)}
          </dd>
        </div>
      </dl>
      {service.error && (
        <p className="mt-4 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700">
          {service.error}
        </p>
      )}
      <div className="mt-4">
        <ConfigureLink
          ariaLabel={`Open configuration for ${service.name}`}
          serviceName={service.name}
        />
      </div>
    </li>
  );
}

function ConfigureLink({
  ariaLabel,
  serviceName,
}: {
  ariaLabel: string;
  serviceName: string;
}) {
  return (
    <Link
      aria-label={ariaLabel}
      className="inline-flex h-9 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
      href={`/services/${serviceName}`}
    >
      <Settings className="h-4 w-4" aria-hidden="true" />
      <span className="truncate">Configure</span>
    </Link>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
}) {
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

function ServiceStatusBadge({ status }: { status: ServiceHealth["status"] }) {
  return <Badge variant={serviceStatusVariant(status)}>{status}</Badge>;
}

function LoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center">
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

const summaryToneClasses = {
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-warning-100 bg-warning-50 text-warning-700",
  danger: "border-danger-100 bg-danger-50 text-danger-700",
  info: "border-primary-100 bg-primary-50 text-primary-700",
  neutral: "border-gray-200 bg-gray-100 text-gray-700",
};
