import { extname, join } from 'path'
import { createChangeSetImportCommand } from './create-change-set-import-command'
import { getResourceIdentifierInfoMap } from './get-resource-identifier-info-map'
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import { uploadToS3Bucket } from './upload-s3-bucket'
import { getRegion } from './client'

jest.mock('./get-resource-identifier-info-map')
jest.mock('node:fs', () => {
  return {
    __esModule: true, // important for spying
    ...jest.requireActual('node:fs'),
  }
})
jest.mock('./upload-s3-bucket')
jest.mock('./client')

const mockGetResourceIdentifierInfoMap = getResourceIdentifierInfoMap as jest.Mock
const mockUploadToS3Bucket = uploadToS3Bucket as jest.Mock
const mockGetRegion = getRegion as jest.Mock

const CORRECT_CFN_IMPORT_FILE_YAML = join(__dirname, '..', 'test-fixtures', 'basic-cfn.yaml')
const CORRECT_CFN_IMPORT_FILE_JSON = join(__dirname, '..', 'test-fixtures', 'basic-cfn.json')
const REGION = 'us-east-2'

describe.each([
  ['yaml', 'local upload', CORRECT_CFN_IMPORT_FILE_YAML],
  ['json', 'local upload', CORRECT_CFN_IMPORT_FILE_JSON],
  ['yaml', 's3 upload', CORRECT_CFN_IMPORT_FILE_YAML],
  ['json', 's3 upload', CORRECT_CFN_IMPORT_FILE_JSON],
])(
  'createChangeSetImportCommand %s with %s',
  (type: string, uploadSource: string, importFile: string) => {
    beforeEach(() => {
      jest.resetAllMocks()
      // Mock the region we're in for all tests
      mockGetRegion.mockResolvedValue(REGION)
    })
    const isS3Upload = uploadSource === 's3 upload'
    const s3Bucket = 'my-s3-bucket'
    const expectedS3BucketUrl = `https://${s3Bucket}.s3.${REGION}.amazonaws.com`
    it('returns a correct command for the given template', async () => {
      mockGetResourceIdentifierInfoMap.mockResolvedValue({
        'AWS::IAM::User': {
          ResourceType: 'AWS::IAM::User',
          LogicalResourceIds: ['ImportUser2', 'ImportUser', 'ExistingUser', 'ExistingUser2'],
          ResourceIdentifiers: ['UserName', 'Path'],
        },
      })

      // Calculate the expected hash name
      const hash = createHash('sha256')
      const expectedChangeSetName = `import-${hash.update('ImportUser2ImportUser').digest('hex')}`

      const expectedTemplateParam = isS3Upload
        ? {
            TemplateURL: `${expectedS3BucketUrl}/${expectedChangeSetName}${extname(importFile)}`,
          }
        : {
            TemplateBody: `file://${importFile}`,
          }

      expect(
        await createChangeSetImportCommand({
          importFile: importFile,
          importedResources: ['ImportUser2', 'ImportUser'],
          stackName: 'my-special-stack-name',
          s3Bucket: isS3Upload ? s3Bucket : undefined,
        }),
      ).toEqual(
        expect.objectContaining({
          input: {
            ...expectedTemplateParam,
            ImportExistingResources: true,
            StackName: 'my-special-stack-name',
            // TODO: we may want to establish an upload here for uber-large cloudformation
            ChangeSetType: 'IMPORT',
            ResourcesToImport: [
              {
                ResourceType: 'AWS::IAM::User',
                LogicalResourceId: 'ImportUser2',
                ResourceIdentifier: {
                  UserName: 'imported-brian',
                  Path: '/',
                },
              },
              {
                ResourceType: 'AWS::IAM::User',
                LogicalResourceId: 'ImportUser',
                ResourceIdentifier: {
                  UserName: 'imported-john',
                  Path: '/',
                },
              },
            ],
            ChangeSetName: expectedChangeSetName,
          },
        }),
      )

      if (isS3Upload) {
        expect(mockUploadToS3Bucket).toHaveBeenCalledWith({
          s3Bucket,
          contentType: type === 'json' ? 'application/json' : 'application/yaml',
          key: `${expectedChangeSetName}${extname(importFile)}`,
          importFile,
        })
      }
    })
    it('throws an error if the template summary does not contain a resource summary for the resource', async () => {
      mockGetResourceIdentifierInfoMap.mockResolvedValue({
        // Just make it be a different key
        'AWS::IAM::Policy': {
          ResourceType: 'AWS::IAM::Policy',
          LogicalResourceIds: ['ImportUser2', 'ImportUser', 'ExistingUser', 'ExistingUser2'],
          ResourceIdentifiers: ['UserName', 'Path'],
        },
      })

      await expect(
        async () =>
          await createChangeSetImportCommand({
            importFile: importFile,
            importedResources: ['ImportUser2', 'ImportUser'],
            stackName: 'my-special-stack-name',
          }),
      ).rejects.toThrow(
        `Could not find a template summary entry for AWS::IAM::User for ImportUser2 in ${importFile}`,
      )
    })
    it('throws an error if a resource name is not found', async () => {
      mockGetResourceIdentifierInfoMap.mockResolvedValue({
        // We simulate a property that shouldn't be an identifier
        'AWS::IAM::User': {
          ResourceType: 'AWS::IAM::User',
          LogicalResourceIds: ['ImportUser2', 'ImportUser', 'ExistingUser', 'ExistingUser2'],
          ResourceIdentifiers: ['UserName'],
        },
      })
      await expect(
        async () =>
          await createChangeSetImportCommand({
            importFile: importFile,
            importedResources: ['ImportUser2', 'ImportUser32'],
            stackName: 'my-special-stack-name',
          }),
      ).rejects.toThrow(`Could not find imported resource ImportUser32 in ${importFile}`)
    })
    it('throws an error if a resource identifier property is not a string', async () => {
      mockGetResourceIdentifierInfoMap.mockResolvedValue({
        // We simulate a property that shouldn't be an identifier
        'AWS::IAM::User': {
          ResourceType: 'AWS::IAM::User',
          LogicalResourceIds: ['ImportUser2', 'ImportUser', 'ExistingUser', 'ExistingUser2'],
          ResourceIdentifiers: ['LoginProfile'],
        },
      })
      await expect(
        async () =>
          await createChangeSetImportCommand({
            importFile: importFile,
            importedResources: ['ImportUser2', 'ImportUser'],
            stackName: 'my-special-stack-name',
          }),
      ).rejects.toThrow(
        `Unexpected non-string value for identifier property LoginProfile: ${JSON.stringify({
          Password: 'myP@ssW0rd',
        })}`,
      )
    })
  },
)

beforeEach(() => {
  jest.resetAllMocks()
})

it('throws an error if the template file cannot be found', async () => {
  await expect(
    async () =>
      await createChangeSetImportCommand({
        importFile: 'does-not-exist.yaml',
        importedResources: ['ImportUser2', 'ImportUser'],
        stackName: 'my-special-stack-name',
      }),
  ).rejects.toThrow('Cannot find import file: does-not-exist.yaml')
})
it('throws an error if the file is over 51200 and does not have an s3', async () => {
  const statSyncSpy = jest.spyOn(fs, 'statSync')

  statSyncSpy.mockReturnValue({
    size: 51201,
    // the rest
  } as fs.Stats)

  await expect(
    async () =>
      await createChangeSetImportCommand({
        importFile: CORRECT_CFN_IMPORT_FILE_YAML,
        importedResources: ['ImportUser2', 'ImportUser'],
        stackName: 'my-special-stack-name',
      }),
  ).rejects.toThrow(
    'Must provide an S3 bucket for uploads for template files that are greater than 51200 - current size: 51201',
  )
})
it('throws an error if the file is over 460800 and has an s3', async () => {
  const statSyncSpy = jest.spyOn(fs, 'statSync')

  statSyncSpy.mockReturnValue({
    size: 460801,
    // the rest
  } as fs.Stats)

  await expect(
    async () =>
      await createChangeSetImportCommand({
        importFile: CORRECT_CFN_IMPORT_FILE_YAML,
        importedResources: ['ImportUser2', 'ImportUser'],
        stackName: 'my-special-stack-name',
        s3Bucket: 'somearn',
      }),
  ).rejects.toThrow('Cannot do work on a template greater than 460800 - current size: 460801')
})
