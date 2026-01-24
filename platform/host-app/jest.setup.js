require("@testing-library/jest-dom");

jest.mock("@t3-oss/env-nextjs", () => ({
  createEnv: (config) => ({
    ...config.runtimeEnv,
  }),
}));

// Mock Supabase client
const createQueryBuilder = (data = []) => {
  const builder = {};
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn(() => builder);
  builder.in = jest.fn(() => builder);
  builder.not = jest.fn(() => builder);
  builder.order = jest.fn(() => builder);
  builder.limit = jest.fn(() => builder);
  builder.range = jest.fn(() => builder);
  builder.insert = jest.fn(() => builder);
  builder.update = jest.fn(() => builder);
  builder.delete = jest.fn(() => builder);
  builder.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
  builder.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
  builder.then = (resolve, reject) => Promise.resolve({ data, error: null }).then(resolve, reject);
  return builder;
};

const mockSupabaseClient = {
  from: jest.fn(() => createQueryBuilder([])),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  },
  channel: jest.fn(() => ({
    on: jest.fn(() => ({ subscribe: jest.fn() })),
    subscribe: jest.fn(),
  })),
};

jest.mock("@/lib/supabase", () => ({
  supabase: mockSupabaseClient,
  supabaseAdmin: mockSupabaseClient,
  isSupabaseConfigured: true,
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => mockSupabaseClient),
  REALTIME_SUBSCRIBE_STATES: {
    SUBSCRIBED: "SUBSCRIBED",
    CHANNEL_ERROR: "CHANNEL_ERROR",
    TIMED_OUT: "TIMED_OUT",
    CLOSED: "CLOSED",
  },
}));

// Mock Next.js router
jest.mock("next/router", () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    pathname: "/",
    query: {},
    asPath: "/",
  })),
}));

// Mock window.matchMedia (only in jsdom environment)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}
