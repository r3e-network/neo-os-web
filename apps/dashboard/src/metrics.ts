import type { ClientConfig } from "./api";

export type MetricSample = {
  metric: Record<string, string>;
  value: [number, string];
};

export type TimeSeries = {
  metric: Record<string, string>;
  values: [number, string][];
};

export type QueryResult = {
  status: string;
  data?: {
    resultType: string;
    result: MetricSample[] | TimeSeries[];
  };
  error?: string;
};

export type MetricsConfig = ClientConfig & {
  prometheusBaseUrl: string;
};

export async function promQuery(query: string, config: MetricsConfig): Promise<MetricSample[]> {
  const url = new URL(`${config.prometheusBaseUrl}/api/v1/query`);
  url.searchParams.set("query", query);
  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  const body = (await resp.json()) as QueryResult;
  if (body.status !== "success" || !body.data?.result) {
    throw new Error(body.error || "prometheus query failed");
  }
  return body.data.result as MetricSample[];
}

export async function promQueryRange(query: string, start: number, end: number, stepSeconds: number, config: MetricsConfig): Promise<TimeSeries[]> {
  const url = new URL(`${config.prometheusBaseUrl}/api/v1/query_range`);
  url.searchParams.set("query", query);
  url.searchParams.set("start", start.toString());
  url.searchParams.set("end", end.toString());
  url.searchParams.set("step", `${stepSeconds}s`);
  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status} ${resp.statusText}: ${text}`);
  }
  const body = (await resp.json()) as QueryResult;
  if (body.status !== "success" || !body.data?.result) {
    throw new Error(body.error || "prometheus query failed");
  }
  return body.data.result as TimeSeries[];
}
