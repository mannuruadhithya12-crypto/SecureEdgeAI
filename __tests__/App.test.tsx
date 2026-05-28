import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { NativeModules } from 'react-native';

// Mock react-native-vision-camera
jest.mock('react-native-vision-camera', () => {
  return {
    Camera: ({ children }: any) => children,
    useCameraDevice: jest.fn(() => ({ id: 'front-camera', position: 'front' })),
    useCameraFormat: jest.fn(() => ({ maxFps: 30, videoWidth: 1280, videoHeight: 720 })),
    useCameraPermission: jest.fn(() => ({ hasPermission: true, requestPermission: jest.fn(() => Promise.resolve(true)) })),
    useFrameProcessor: jest.fn(),
    runAtTargetFps: jest.fn(),
    Templates: { FrameProcessing: [] }
  };
});

// Mock react-native-fast-tflite
jest.mock('react-native-fast-tflite', () => {
  return {
    useTensorflowModel: jest.fn(() => ({
      state: 'loaded',
      model: {
        inputs: [{ name: 'input', dataType: 'float32', shape: [1, 128, 128, 3] }],
        outputs: [
          { name: 'regressors', dataType: 'float32', shape: [1, 896, 16] },
          { name: 'classificators', dataType: 'float32', shape: [1, 896, 1] }
        ],
      }
    }))
  };
});

// Mock react-native-nitro-modules
jest.mock('react-native-nitro-modules', () => {
  return {
    NitroModules: {
      box: jest.fn((model) => ({ unbox: () => model }))
    }
  };
});

// Mock react-native-worklets-core
jest.mock('react-native-worklets-core', () => {
  return {
    useRunOnJS: jest.fn((fn) => fn),
  };
});

// Mock vision-camera-resize-plugin
jest.mock('vision-camera-resize-plugin', () => {
  return {
    createResizePlugin: jest.fn(() => ({
      resize: jest.fn()
    }))
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaView: ({ children }: any) => children,
    useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
  };
});

// Mock react-native-sqlite-storage
jest.mock('react-native-sqlite-storage', () => {
  return {
    enablePromise: jest.fn(),
    openDatabase: jest.fn(() => Promise.resolve({
      executeSql: jest.fn(() => Promise.resolve([])),
      transaction: jest.fn((cb) => {
        const tx = { executeSql: jest.fn() };
        cb(tx);
        return Promise.resolve();
      })
    }))
  };
});

// Mock react-native-sqlcipher-storage
jest.mock('react-native-sqlcipher-storage', () => {
  return {
    enablePromise: jest.fn(),
    openDatabase: jest.fn(() => Promise.resolve({
      executeSql: jest.fn(() => Promise.resolve([])),
      transaction: jest.fn((cb) => {
        const tx = { executeSql: jest.fn() };
        cb(tx);
        return Promise.resolve();
      })
    }))
  };
});

// Mock react-native-fs
jest.mock('react-native-fs', () => {
  return {
    DocumentDirectoryPath: '/mock-doc-dir',
    writeFile: jest.fn(() => Promise.resolve()),
    readFile: jest.fn(() => Promise.resolve('')),
    exists: jest.fn(() => Promise.resolve(false)),
    mkdir: jest.fn(() => Promise.resolve()),
    readDir: jest.fn(() => Promise.resolve([])),
    unlink: jest.fn(() => Promise.resolve()),
  };
});

// Mock react-native-aes-crypto
jest.mock('react-native-aes-crypto', () => ({
  encrypt: jest.fn((text) => Promise.resolve('enc_' + text)),
  decrypt: jest.fn((ciphertext) => Promise.resolve(ciphertext.substring(4))),
}));

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(() => Promise.resolve({ password: 'test_key' })),
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

// Mock react-native-encrypted-storage
jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock native SecurityModule
NativeModules.SecurityModule = {
  isDeviceRooted: jest.fn(() => Promise.resolve(false)),
  isDebuggerAttached: jest.fn(() => Promise.resolve(false)),
  checkApkSignature: jest.fn(() => Promise.resolve('MOCK_SIGNATURE_HASH')),
};

// Mock react-native-netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

import App from '../App';

jest.useFakeTimers();

test('renders correctly', async () => {
  let renderer: any;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });
  
  // Fast-forward and exhaust all splash screen timeouts inside act()
  await ReactTestRenderer.act(async () => {
    jest.runAllTimers();
  });
});
