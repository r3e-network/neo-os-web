module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // React must resolve to one copy. next.config.js already aliases it for the
    // build; jest needs the same, or a component rendered from the SDK package
    // gets a second React and every hook fails on a null dispatcher.
    "^react$": "<rootDir>/../../node_modules/react",
    "^react-dom$": "<rootDir>/../../node_modules/react-dom",
    "^react/jsx-runtime$": "<rootDir>/../../node_modules/react/jsx-runtime.js",
    "^react/jsx-dev-runtime$": "<rootDir>/../../node_modules/react/jsx-dev-runtime.js",
    "^@shared/(.*)$": "<rootDir>/../../node_modules/@r3e-network/neo-miniapp-shared/$1",
    "^@framework/(.*)$": "<rootDir>/../../node_modules/@r3e-network/neo-miniapp-framework/$1",
    "\\.(avif|gif|jpg|jpeg|png|svg|webp)$": "<rootDir>/__mocks__/fileMock.js",
  },
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "pages/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!pages/_app.tsx",
    "!pages/_document.tsx",
    "!pages/_error.tsx",
    "!pages/api/**",
    "!pages/index.tsx",
    "!pages/test.tsx",
    "!components/index.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 25,
      lines: 25,
      statements: 25,
    },
    // Core implementation files - realistic thresholds based on current coverage
    "./hooks/useRealtimeNotifications.ts": {
      branches: 75,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    "./components/AppDetailHeader.tsx": {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    "./components/AppNewsList.tsx": {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "@swc/jest",
      {
        sourceMaps: "inline",
        module: {
          type: "commonjs",
        },
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: true,
          },
          transform: {
            react: {
              runtime: "automatic",
            },
          },
          target: "es2022",
        },
      },
    ],
  },
};
