module.exports = {
  preset: "ts-jest",
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
    "!components/MiniAppDetail.tsx",
    "!components/Header.tsx",
    "!components/MiniAppCard.tsx",
    "!components/NotificationCard.tsx",
    "!components/index.ts",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 35,
      lines: 35,
      statements: 35,
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
    "./components/AppStatsCard.tsx": {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
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
      branches: 65,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    "./pages/launch/[id].tsx": {
      branches: 50,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
        },
      },
    ],
  },
};
