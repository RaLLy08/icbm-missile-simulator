/** @jest-config-loader ts-node */
import type { Config } from 'jest';

const config: Config = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^app/(.*)$': '<rootDir>/src/app/$1',
    '^public/(.*)$': '<rootDir>/src/public/$1',
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};

export default config;
