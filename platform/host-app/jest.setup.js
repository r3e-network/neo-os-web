require("@testing-library/jest-dom");

jest.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config) => config,
}));

jest.mock("@t3-oss/env-nextjs", () => ({
  createEnv: (config) => ({
    ...config.runtimeEnv,
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  }),
}));

// Mock Supabase client
const createMockQuery = ({ data = [], error = null } = {}) => {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => query),
    is: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve, reject) => Promise.resolve({ data, error }).then(resolve, reject),
  };
  return query;
};

const mockSupabaseClient = {
  from: jest.fn(() => {
    const query = createMockQuery();
    return {
      ...query,
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    };
  }),
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
