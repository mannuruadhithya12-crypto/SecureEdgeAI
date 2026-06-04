import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

const blazeFacePath = `${RNFS.DocumentDirectoryPath}/blazeface_front.tflite`;
const mobileFaceNetPath = `${RNFS.DocumentDirectoryPath}/mobilefacenet.tflite`;

export const BLAZEFACE_FRONT_MODEL =
  Platform.OS === 'android'
    ? { url: `file://${blazeFacePath}` }
    : require('../assets/models/blazeface_front.tflite');

export const MOBILEFACENET_MODEL =
  Platform.OS === 'android'
    ? { url: `file://${mobileFaceNetPath}` }
    : require('../assets/models/mobilefacenet.tflite');

async function copyAndroidRawModel(resourceNames: string[], destinationPath: string): Promise<void> {
  const exists = await RNFS.exists(destinationPath);
  if (exists) {
    return;
  }

  let lastError: unknown = null;
  for (const resourceName of resourceNames) {
    try {
      try {
        await RNFS.copyFileAssets(resourceName, destinationPath);
        console.log(`[QA] MODEL_RESOURCE_COPIED ${resourceName}`);
        return;
      } catch {
        await RNFS.copyFileRes(resourceName, destinationPath);
        console.log(`[QA] MODEL_RESOURCE_COPIED ${resourceName}`);
        return;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to copy model resource to ${destinationPath}`);
}

export async function prepareTfliteModels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await copyAndroidRawModel(
    ['src_assets_models_blazeface_front', 'src_assets_models_blazeface_front.tflite', 'blazeface_front.tflite'],
    blazeFacePath
  );
  await copyAndroidRawModel(
    ['src_assets_models_mobilefacenet', 'src_assets_models_mobilefacenet.tflite', 'mobilefacenet.tflite'],
    mobileFaceNetPath
  );
}
