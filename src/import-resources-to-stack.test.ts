import {
  CreateChangeSetCommand,
  CreateChangeSetCommandOutput,
  ExecuteChangeSetCommand,
  ExecuteChangeSetCommandOutput,
  waitUntilChangeSetCreateComplete,
  waitUntilStackImportComplete,
} from '@aws-sdk/client-cloudformation'
import { createChangeSetImportCommand } from './create-change-set-import-command'
import { importResourcesToStack } from './import-resources-to-stack'
import { WaiterState } from '@smithy/util-waiter'
import { cloudformationClient } from './client'

const mockWaitUntilChangeSetCreateComplete = waitUntilChangeSetCreateComplete as jest.Mock
const mockWaitUntilStackImportComplete = waitUntilStackImportComplete as jest.Mock
const mockSend = cloudformationClient.send as jest.Mock
const mockCreateChangeSetImportCommand = createChangeSetImportCommand as jest.Mock
jest.mock('@aws-sdk/client-cloudformation', () => {
  const actual = jest.requireActual('@aws-sdk/client-cloudformation')
  return {
    ...actual,
    waitUntilChangeSetCreateComplete: jest.fn(),
    waitUntilStackImportComplete: jest.fn(),
  }
})
jest.mock('./create-change-set-import-command')
jest.mock('./client', () => {
  return {
    cloudformationClient: {
      send: jest.fn(),
    },
  }
})

describe('importResourcesToStack', () => {
  const changeSetName = 'my-change-set'
  const stackName = 'my-stack'

  const mockChangeSetCommand = new CreateChangeSetCommand({
    ChangeSetName: changeSetName,
    StackName: stackName,
  })

  beforeEach(() => {
    jest.resetAllMocks()

    // set up send and create change set since they do not try flow with exceptions
    mockCreateChangeSetImportCommand.mockResolvedValue(mockChangeSetCommand)
    mockSend.mockImplementation(async (command) => {
      if (command instanceof CreateChangeSetCommand) {
        return {} as CreateChangeSetCommandOutput
      } else if (command instanceof ExecuteChangeSetCommand) {
        return {} as ExecuteChangeSetCommandOutput
      } else {
        throw new Error(
          `Cloudformation send command got unexpected command: ${JSON.stringify(command)}`,
        )
      }
    })
  })

  it('uploads a file without an s3 bucket', async () => {
    mockWaitUntilChangeSetCreateComplete.mockResolvedValue({
      state: WaiterState.SUCCESS,
    })
    mockWaitUntilStackImportComplete.mockResolvedValue({
      state: WaiterState.SUCCESS,
    })
    // todo
    await importResourcesToStack({
      stackName: 'my-stack',
      importFile: 'somefile.json',
      importedResources: ['ResourceName1', 'ResourceName2'],
      maxWaitTime: 2000,
    })

    expect(mockCreateChangeSetImportCommand).toHaveBeenCalledWith({
      stackName: 'my-stack',
      importFile: 'somefile.json',
      importedResources: ['ResourceName1', 'ResourceName2'],
      maxWaitTime: 2000,
    })
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockSend).toHaveBeenCalledWith(mockChangeSetCommand)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          ChangeSetName: changeSetName,
          StackName: stackName,
        },
      }),
    )
    expect(mockWaitUntilChangeSetCreateComplete).toHaveBeenCalledWith(
      { client: cloudformationClient, maxWaitTime: 2000 },
      { ChangeSetName: changeSetName },
    )
    expect(mockWaitUntilStackImportComplete).toHaveBeenCalledWith(
      { client: cloudformationClient, maxWaitTime: 2000 },
      { StackName: stackName },
    )
  })
  it('uploads a file with an s3 bucket', async () => {
    mockWaitUntilChangeSetCreateComplete.mockResolvedValue({
      state: WaiterState.SUCCESS,
    })
    mockWaitUntilStackImportComplete.mockResolvedValue({
      state: WaiterState.SUCCESS,
    })
    // todo
    await importResourcesToStack({
      stackName: 'my-stack',
      importFile: 'somefile.json',
      importedResources: ['ResourceName1', 'ResourceName2'],
      maxWaitTime: 2000,
      s3Bucket: 'some-bucket',
    })

    expect(mockCreateChangeSetImportCommand).toHaveBeenCalledWith({
      stackName: 'my-stack',
      importFile: 'somefile.json',
      importedResources: ['ResourceName1', 'ResourceName2'],
      maxWaitTime: 2000,
      s3Bucket: 'some-bucket',
    })
    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(mockSend).toHaveBeenCalledWith(mockChangeSetCommand)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          ChangeSetName: changeSetName,
          StackName: stackName,
        },
      }),
    )
    expect(mockWaitUntilChangeSetCreateComplete).toHaveBeenCalledWith(
      { client: cloudformationClient, maxWaitTime: 2000 },
      { ChangeSetName: changeSetName },
    )
    expect(mockWaitUntilStackImportComplete).toHaveBeenCalledWith(
      { client: cloudformationClient, maxWaitTime: 2000 },
      { StackName: stackName },
    )
  })
  it.each([...Object.values(WaiterState).filter((s) => s !== WaiterState.SUCCESS)])(
    'throws an error if change set is not successful: %s',
    async (result) => {
      mockWaitUntilChangeSetCreateComplete.mockResolvedValue({
        state: result,
        reason: 'stuff did not work out, fam',
      })

      await expect(
        async () =>
          await importResourcesToStack({
            stackName: 'my-stack',
            importFile: 'somefile.json',
            importedResources: ['ResourceName1', 'ResourceName2'],
            maxWaitTime: 2000,
          }),
      ).rejects.toThrow(`Failed to create change set: ${result} stuff did not work out, fam`)
    },
  )
  it.each([...Object.values(WaiterState).filter((s) => s !== WaiterState.SUCCESS)])(
    'throws an error if stack update is not successful: %s',
    async (result) => {
      mockWaitUntilChangeSetCreateComplete.mockResolvedValue({
        state: WaiterState.SUCCESS,
      })
      mockWaitUntilStackImportComplete.mockResolvedValue({
        state: result,
        reason: 'stuff did not work out, fam',
      })

      await expect(
        async () =>
          await importResourcesToStack({
            stackName: 'my-stack',
            importFile: 'somefile.json',
            importedResources: ['ResourceName1', 'ResourceName2'],
            maxWaitTime: 2000,
          }),
      ).rejects.toThrow(
        `Failed to update stack with change set: ${result} stuff did not work out, fam`,
      )
    },
  )
})
