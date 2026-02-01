import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

function setRequiredEnv(): void {
  Deno.env.set("DATABASE_URL", "postgresql://localhost/test");
  Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  Deno.env.set("JWT_SECRET", "x".repeat(32));
  Deno.env.set("NEO_RPC_URL", "http://localhost:1234");
  Deno.env.set("SERVICE_LAYER_URL", "http://localhost:9000");
  Deno.env.set("TXPROXY_URL", "http://localhost:9001");
  Deno.env.set("EDGE_CORS_ORIGINS", "http://localhost");
  Deno.env.set("DENO_ENV", "development");
}

Deno.test({
  name: "miniapp-approve trigger_build calls build endpoint",
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  setRequiredEnv();

  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ user: { id: "admin-user", email: "admin@example.com" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rpc/rate_limit_bump")) {
      const payload = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(JSON.stringify({
        window_start: new Date().toISOString(),
        request_count: payload.p_identifier?.includes("service_role") ? 2 : 1,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/admin_emails")) {
      return new Response(JSON.stringify({ id: "admin-row" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/miniapp_submissions") && method === "GET") {
      return new Response(JSON.stringify({ id: "sub", app_id: "app", status: "pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/miniapp_submissions") && method === "PATCH") {
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.includes("/rest/v1/miniapp_approval_audit")) {
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.includes("/functions/v1/miniapp-build")) {
      called = true;
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { handler } = await import("../miniapp-approve/index.ts");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test",
      },
      body: JSON.stringify({ submission_id: "sub", action: "approve", trigger_build: true }),
    });

    await handler(req);
    assertEquals(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test({
  name: "miniapp-approve keeps status approved before triggering build",
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  setRequiredEnv();

  let updatePayload: Record<string, unknown> | null = null;
  let buildCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ user: { id: "admin-user", email: "admin@example.com" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rpc/rate_limit_bump")) {
      return new Response(JSON.stringify({ window_start: new Date().toISOString(), request_count: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/admin_emails")) {
      return new Response(JSON.stringify({ id: "admin-row" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/miniapp_submissions") && method === "GET") {
      return new Response(JSON.stringify({ id: "sub", app_id: "app", status: "pending" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/miniapp_submissions") && method === "PATCH") {
      updatePayload = init?.body ? JSON.parse(String(init.body)) : null;
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.includes("/rest/v1/miniapp_approval_audit")) {
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.includes("/functions/v1/miniapp-build")) {
      buildCalled = true;
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { handler } = await import("../miniapp-approve/index.ts");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test",
      },
      body: JSON.stringify({ submission_id: "sub", action: "approve", trigger_build: true }),
    });

    await handler(req);
    assertEquals(buildCalled, true);
    const status = updatePayload ? updatePayload["status"] : undefined;
    assertEquals(status, "approved");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test({
  name: "miniapp-build rate limit uses service role identifier",
  sanitizeOps: false,
  sanitizeResources: false,
}, async () => {
  setRequiredEnv();

  let sawServiceRoleIdentifier = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.includes("/rpc/rate_limit_bump")) {
      const payload = init?.body ? JSON.parse(String(init.body)) : {};
      if (typeof payload.p_identifier === "string" && payload.p_identifier.includes("service_role")) {
        sawServiceRoleIdentifier = true;
      }
      return new Response(JSON.stringify({ window_start: new Date().toISOString(), request_count: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/miniapp_submissions") && method === "GET") {
      return new Response(JSON.stringify({
        id: "sub",
        app_id: "app",
        status: "approved",
        build_mode: "manual",
        git_url: "https://github.com/example/repo.git",
        branch: "main",
        git_commit_sha: "sha",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/rest/v1/miniapp_submissions") && method === "PATCH") {
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { handler } = await import("../miniapp-build/index.ts");
    const req = new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer service-role-key",
      },
      body: JSON.stringify({ submission_id: "sub" }),
    });

    await handler(req);
    assertEquals(sawServiceRoleIdentifier, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
