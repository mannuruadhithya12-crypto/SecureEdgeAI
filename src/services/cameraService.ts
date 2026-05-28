import { Camera, PhotoFile } from 'react-native-vision-camera';

export async function requestPermission(): Promise<boolean> {
  try {
    const status = await Camera.requestCameraPermission();
    return status === 'granted';
  } catch (error) {
    console.error(
      '[CameraService] Permission request failed:',
      error
    );
    return false;
  }
}

export function startPreview(): boolean {
  console.log(
    '[CameraService] Starting camera preview stream'
  );
  return true;
}

export async function captureImage(
  cameraRef: React.RefObject<any>
): Promise<string> {
  if (!cameraRef.current) {
    throw new Error(
      'Camera ref is not initialized'
    );
  }

  const photo: PhotoFile = await cameraRef.current.takePhoto({
    flash: 'off',
    enableShutterSound: false,
  });

  return `file://${photo.path}`;
}