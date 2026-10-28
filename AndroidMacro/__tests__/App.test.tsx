/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    NativeModules: {
      ...actual.NativeModules,
      AndroidMacro: {
        getTimeoutSeconds: jest.fn(async () => 20),
        setTimeoutSeconds: jest.fn(async (seconds: number) => seconds),
        getEnabled: jest.fn(async () => true),
        setEnabled: jest.fn(async (enabled: boolean) => enabled),
        isAccessibilityEnabled: jest.fn(async () => false),
        openAccessibilitySettings: jest.fn(async () => undefined),
        getInstalledApps: jest.fn(async () => []),
        getSkippedPackages: jest.fn(async () => []),
        setAppSkipped: jest.fn(async () => []),
      },
    },
  };
});

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(<App />);
  });
});
