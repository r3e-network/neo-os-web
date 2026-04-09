module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
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
    "!pages/federated.tsx",
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
    "./components/LaunchDock.tsx": {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    "./pages/app/[id].tsx": {
      branches: 50,
      functions: 50,
      lines: 60,
      statements: 60,
    },
    "./pages/launch/[id].tsx": {
      branches: 10,
      functions: 15,
      lines: 25,
      statements: 25,
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
