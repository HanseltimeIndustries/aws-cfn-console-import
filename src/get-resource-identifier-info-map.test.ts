import { GetTemplateSummaryCommandOutput } from '@aws-sdk/client-cloudformation'
import { cloudformationClient } from './client'
import { getResourceIdentifierInfoMap } from './get-resource-identifier-info-map'

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

describe('getResourceIdentifierInfoMap', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  it('throws an error if no resource summary is returned', async () => {
    jest.mocked(mockSend).mockResolvedValue({} as GetTemplateSummaryCommandOutput)

    await expect(async () =>
      getResourceIdentifierInfoMap({
        importFile: 'somefileAddress.txt',
      }),
    ).rejects.toThrow(`Could not get any resource identifier information for somefileAddress.txt`)

    expect(cloudformationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TemplateBody: `file://somefileAddress.txt`,
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
        importFile: 'somefileAddress.txt',
      }),
    ).toEqual({
      'AWS::EC2::ApplicationLoadBalancer': {
        ResourceIdentifiers: ['Prop1', 'Prop2'],
        ResourceType: 'AWS::EC2::ApplicationLoadBalancer',
      },
      'AWS::EC2::Instance': {
        ResourceIdentifiers: ['Id', 'Name'],
        ResourceType: 'AWS::EC2::Instance',
      },
    })

    expect(cloudformationClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TemplateBody: `file://somefileAddress.txt`,
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
        importFile: 'somefileAddress.txt',
        s3Url: 'some-s3/url',
      }),
    ).toEqual({
      'AWS::EC2::ApplicationLoadBalancer': {
        ResourceIdentifiers: ['Prop1', 'Prop2'],
        ResourceType: 'AWS::EC2::ApplicationLoadBalancer',
      },
      'AWS::EC2::Instance': {
        ResourceIdentifiers: ['Id', 'Name'],
        ResourceType: 'AWS::EC2::Instance',
      },
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
