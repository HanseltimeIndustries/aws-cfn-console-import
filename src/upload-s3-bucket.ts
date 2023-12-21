import { readFileSync } from 'node:fs'
import { s3Client } from './client'
import { createHash } from 'node:crypto'

interface UploadToS3BucketOptions {
  // The S3 bucket
  s3Bucket: string
  contentType: string
  // This will be the file path in the bucket
  key: string
  // This will be the local file to upload
  importFile: string
}

export async function uploadToS3Bucket(options: UploadToS3BucketOptions): Promise<void> {
  const { s3Bucket, contentType, key, importFile } = options

  const body = readFileSync(importFile)

  const hash = createHash('sha256')
  const checksum = hash.update(body).digest('base64')

  await s3Client.putObject({
    Bucket: s3Bucket,
    ContentType: contentType,
    Key: key,
    Body: body,
    ChecksumSHA256: checksum,
  })
}
