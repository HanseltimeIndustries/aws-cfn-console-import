import { GetTemplateSummaryCommandOutput } from '@aws-sdk/client-cloudformation'
import { cloudformationClient } from './client'
import { getResourceIdentifierInfoMap } from './get-resource-identifier-info-map'
import { join } from 'path'
import { readFileSync } from 'fs'

// eslint-disable-next-line no-var
var mockSend: jest.Mock
jest.mock('./client', () => {
  mockSend = jest.fn()
  return {
    cloudformationClient: {
      send: mockSend,
    },
  }
})

const CORRECT_CFN_IMPORT_FILE_YAML = join(__dirname, '..', 'test-fixtures', 'basic-cfn.yaml')

describe('getResourceIdentifierInfoMap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('throws an error if no resource summary is returned', async () => {
    jest.mocked(mockSend).mockResolvedValue({} as GetTemplateSummaryCommandOutput)

    await expect(async () =>
      getResourceIdentifierInfoMap({
        importFile: CORRECT_CFN_IMPORT_FILE_YAML,
      }),
    ).rejects.toThrow(
      `Could not get any resource identifier information for ${CORRECT_CFN_IMPORT_FILE_YAML}`,
    )

    expect(cloudformationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TemplateBody: readFileSync(CORRECT_CFN_IMPORT_FILE_YAML).toString(),
        },
      }),
    )
  })
  it('returns a map of all resource types available in the template', async () => {
    mockSend.mockResolvedValue({
      ResourceIdentifierSummaries: [
        {
          ResourceIdentifiers: ['Prop1', 'Prop2'],
          ResourceType: 'AWS::EC2::ApplicationLoadBalancer',
        },
        {
          ResourceIdentifiers: ['Id', 'Name'],
          ResourceType: 'AWS::EC2::Instance',
        },
      ],
    } as GetTemplateSummaryCommandOutput)

    expect(
      await getResourceIdentifierInfoMap({
        importFile: CORRECT_CFN_IMPORT_FILE_YAML,
      }),
    ).toEqual({
      resources: {
        'AWS::EC2::ApplicationLoadBalancer': {
          ResourceIdentifiers: ['Prop1', 'Prop2'],
          ResourceType: 'AWS::EC2::ApplicationLoadBalancer',
        },
        'AWS::EC2::Instance': {
          ResourceIdentifiers: ['Id', 'Name'],
          ResourceType: 'AWS::EC2::Instance',
        },
      },
      Capabilities: [],
    })

    expect(cloudformationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TemplateBody: readFileSync(CORRECT_CFN_IMPORT_FILE_YAML).toString(),
        },
      }),
    )
  })
  it('returns a map of all resource types available in the template when uploaded to an s3 bucket', async () => {
    mockSend.mockResolvedValue({
      ResourceIdentifierSummaries: [
        {
          ResourceIdentifiers: ['Prop1', 'Prop2'],
          ResourceType: 'AWS::EC2::ApplicationLoadBalancer',
        },
        {
          ResourceIdentifiers: ['Id', 'Name'],
          ResourceType: 'AWS::EC2::Instance',
        },
      ],
    } as GetTemplateSummaryCommandOutput)

    expect(
      await getResourceIdentifierInfoMap({
        importFile: CORRECT_CFN_IMPORT_FILE_YAML,
        s3Url: 'some-s3/url',
      }),
    ).toEqual({
      resources: {
        'AWS::EC2::ApplicationLoadBalancer': {
          ResourceIdentifiers: ['Prop1', 'Prop2'],
          ResourceType: 'AWS::EC2::ApplicationLoadBalancer',
        },
        'AWS::EC2::Instance': {
          ResourceIdentifiers: ['Id', 'Name'],
          ResourceType: 'AWS::EC2::Instance',
        },
      },
      Capabilities: [],
    })

    expect(cloudformationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TemplateURL: 'some-s3/url',
        },
      }),
    )
  })
})
