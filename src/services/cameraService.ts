import { VisionCamera, PhotoFile, CameraPhotoOutput } from 'react-native-vision-camera';

export async function requestPermission(): Promise<boolean> {
  try {
    const granted = await VisionCamera.requestCameraPermission();
    return granted;
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
  photoOutput: CameraPhotoOutput
): Promise<string> {
  if (!photoOutput) {
    throw new Error(
      'Photo output is not initialized'
    );
  }

  const photo: PhotoFile =
    await photoOutput.capturePhotoToFile({
      flashMode: 'off',
      enableShutterSound: false,
    }, {});

  return `file://${photo.filePath}`;
}