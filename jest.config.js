module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '\\.(tflite)$': '<rootDir>/__tests__/mocks/fileMock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/mocks/',
    '/mobile-app/',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community)/)',
  ],
};
