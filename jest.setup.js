jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const Camera = React.forwardRef((props, ref) => {
    return null;
  });
  return {
    Camera: Camera,
    useCameraDevice: jest.fn().mockReturnValue({ id: 'front' }),
    useCameraPermission: jest.fn().mockReturnValue({
      hasPermission: true,
      requestPermission: jest.fn().mockResolvedValue(true),
    }),
    usePhotoOutput: jest.fn().mockReturnValue({
      capturePhotoToFile: jest.fn().mockResolvedValue({ filePath: 'test-path.jpg' }),
    }),
    VisionCamera: {
      cameraPermissionStatus: 'authorized',
      requestCameraPermission: jest.fn().mockResolvedValue(true),
    },
  };
});

jest.mock('react-native-sqlite-storage', () => {
  return {
    enablePromise: jest.fn(),
    openDatabase: jest.fn().mockResolvedValue({
      executeSql: jest.fn().mockResolvedValue([{ rows: { length: 0, item: () => null } }]),
    }),
  };
}, { virtual: true });

jest.mock('react-native-sqlcipher-storage', () => {
  return {
    enablePromise: jest.fn(),
    openDatabase: jest.fn().mockResolvedValue({
      executeSql: jest.fn().mockResolvedValue([{ rows: { length: 0, item: () => null } }]),
    }),
  };
}, { virtual: true });
