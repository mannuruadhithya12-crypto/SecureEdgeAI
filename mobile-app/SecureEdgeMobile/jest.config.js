module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '\\.(tflite)$': '<rootDir>/__tests__/mocks/fileMock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/mocks/'
  ],
};
