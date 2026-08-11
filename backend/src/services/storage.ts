import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { Client as MinioClient } from 'minio';

import { env } from '../env.js';

export interface StoredFile {
  /** Storage key (MinIO object key or relative local path). */
  key: string;
  /** Public URL the API exposes. */
  url: string;
}

interface StorageBackend {
  put(key: string, data: Buffer, contentType?: string): Promise<StoredFile>;
}

/** Local-disk fallback used when S3_* env vars are absent. */
class LocalStorage implements StorageBackend {
  constructor(private readonly dir: string) {}

  async put(key: string, data: Buffer, _contentType?: string): Promise<StoredFile> {
    const full = path.join(process.cwd(), this.dir, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key, url: `/uploads/${key}` };
  }
}

/** MinIO / S3-compatible backend. */
class S3Storage implements StorageBackend {
  private readonly client: MinioClient;
  private readonly bucket: string;
  private ready: Promise<void> | null = null;

  constructor() {
    this.bucket = env.S3_BUCKET;
    this.client = new MinioClient({
      endPoint: env.S3_ENDPOINT,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      useSSL: env.S3_USE_SSL,
      region: env.S3_REGION,
    });
  }

  private ensureBucket(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) await this.client.makeBucket(this.bucket, env.S3_REGION);
      })().catch((err) => {
        this.ready = null;
        throw err;
      });
    }
    return this.ready;
  }

  async put(key: string, data: Buffer, contentType = 'application/octet-stream'): Promise<StoredFile> {
    await this.ensureBucket();
    await this.client.putObject(this.bucket, key, data, data.length, {
      'Content-Type': contentType,
    });
    return { key, url: `/s3/${key}` };
  }
}

const storage: StorageBackend = env.S3_ENDPOINT ? new S3Storage() : new LocalStorage(env.UPLOAD_DIR);

/** Storage key for a KYC document: kyc/{chamaId}/{memberId}/{kind}-{uuid}.{ext} */
export function kycObjectKey(chamaId: string, memberId: string, kind: string, ext: string): string {
  return `kyc/${chamaId}/${memberId}/${kind}-${randomUUID()}${ext}`;
}

export async function storeKycDocument(
  chamaId: string,
  memberId: string,
  kind: string,
  ext: string,
  data: Buffer,
  contentType?: string,
): Promise<StoredFile> {
  return storage.put(kycObjectKey(chamaId, memberId, kind, ext), data, contentType);
}

export async function storeConstitutionDocument(
  chamaId: string,
  ext: string,
  data: Buffer,
  contentType?: string,
): Promise<StoredFile> {
  return storage.put(`constitutions/${chamaId}/v-${Date.now()}${ext}`, data, contentType);
}

export { storage };
