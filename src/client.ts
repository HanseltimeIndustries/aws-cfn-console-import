import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { S3 } from '@aws-sdk/client-s3'

export const cloudformationClient = new CloudFormationClient()
export const s3Client = new S3()

/**
 * Gets the region for the AWS clients
 * @returns
 */
export async function getRegion(): Promise<string> {
  const type = typeof s3Client.config.region

  if (type === 'string') {
    return s3Client.config.region as string
  }
  if (type === 'function') {
    return s3Client.config.region()
  }
  throw new Error(`Unepected configuration property type: ${type}`)
}
