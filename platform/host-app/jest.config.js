module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx"],
  moduleDirectories: ["node_modules", "<rootDir>/../../node_modules"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@neo/shared$": "<rootDir>/../shared",
    "^@neo/shared/(.*)$": "<rootDir>/../shared/$1",
    "^@noble/hashes/(.*)$": "<rootDir>/node_modules/@noble/hashes/$1",
    "^react$": "<rootDir>/../../node_modules/.pnpm/react@18.3.1/node_modules/react",
    "^react/jsx-runtime$": "<rootDir>/../../node_modules/.pnpm/react@18.3.1/node_modules/react/jsx-runtime",
    "^react/jsx-dev-runtime$": "<rootDir>/../../node_modules/.pnpm/react@18.3.1/node_modules/react/jsx-dev-runtime",
    "^react-dom$": "<rootDir>/../../node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom",
    "^react-dom/client$":
      "<rootDir>/../../node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client",
    "^react-dom/test-utils$":
      "<rootDir>/../../node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/test-utils",
    "^react-is$": "<rootDir>/../../node_modules/.pnpm/react-is@18.3.1/node_modules/react-is",
  },
  collectCoverageFrom: [
    "components/**/*.{ts,tsx}",
    "pages/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!pages/_app.tsx",
    "!pages/_document.tsx",
    "!pages/_error.tsx",
    // pages/api/** now included in coverage collection
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
      branches: 25,
      functions: 25,
      lines: 30,
      statements: 30,
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
    "./lib/security/wallet-auth.ts": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  transform: {
    "^.+\\.(ts|tsx|js)$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
          allowJs: true,
          module: "commonjs",
        },
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(@noble/hashes|\\.pnpm/@noble\\+hashes))"],
};
