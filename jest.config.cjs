/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",
    transform: {
        "^.+\\.(ts|tsx)$": [
            "ts-jest",
            { tsconfig: "<rootDir>/tsconfig.test.json" },
        ],
    },
    testMatch: ["**/tests/**/*.test.ts", "**/tests/**/*.test.tsx"],
    clearMocks: true,
};
