import RNFS from 'react-native-fs';

const EMBEDDING_DIR = `${RNFS.DocumentDirectoryPath}/embeddings`;

async function ensureDirectoryExists(): Promise<void> {
  const exists = await RNFS.exists(EMBEDDING_DIR);
  if (!exists) {
    await RNFS.mkdir(EMBEDDING_DIR);
  }
}

export async function saveEmbedding(userId: string, embedding: Float32Array): Promise<void> {
  await ensureDirectoryExists();
  const filePath = `${EMBEDDING_DIR}/${userId}.json`;
  const data = JSON.stringify(Array.from(embedding));
  await RNFS.writeFile(filePath, data, 'utf8');
  console.log(`[Storage] Embedding saved successfully for user: ${userId}`);
  console.log('Embedding saved successfully');
}

export async function loadEmbeddings(): Promise<{ [userId: string]: Float32Array }> {
  await ensureDirectoryExists();
  const files = await RNFS.readDir(EMBEDDING_DIR);
  const embeddings: { [userId: string]: Float32Array } = {};
  
  for (const file of files) {
    if (file.isFile() && file.name.endsWith('.json')) {
      const userId = file.name.replace('.json', '');
      const data = await RNFS.readFile(file.path, 'utf8');
      const array = JSON.parse(data) as number[];
      embeddings[userId] = new Float32Array(array);
    }
  }
  console.log(`[Storage] Loaded embeddings for ${Object.keys(embeddings).length} users`);
  console.log('Loaded embeddings');
  return embeddings;
}

export async function deleteEmbedding(userId: string): Promise<void> {
  await ensureDirectoryExists();
  const filePath = `${EMBEDDING_DIR}/${userId}.json`;
  const exists = await RNFS.exists(filePath);
  if (exists) {
    await RNFS.unlink(filePath);
    console.log(`[Storage] Deleted embedding for user: ${userId}`);
  }
}

