import {
  ExecuteChangeSetCommand,
  waitUntilChangeSetCreateComplete,
  waitUntilStackImportComplete,
} from '@aws-sdk/client-cloudformation'
import { WaiterState } from '@smithy/util-waiter'
import { cloudformationClient } from './client'
import { createChangeSetImportCommand } from './create-change-set-import-command'

interface ImportResourcesToStackOptions {
  stackName: string
  importFile: string
  importedResources: string[]
  /**
   * The max number of seconds to wait for the change set to be in a resolved state
   */
  maxWaitTime: number
  /**
   * The S3 bucket to upload the template file up to before imports.
   *
   * This is necessary if the file is too large for "from local" uploads
   */
  s3Bucket?: string
}

export async function importResourcesToStack(options: ImportResourcesToStackOptions) {
  const changeSetCmd = await createChangeSetImportCommand(options)

  await cloudformationClient.send(changeSetCmd)

  const changeSetResult = await waitUntilChangeSetCreateComplete(
    { client: cloudformationClient, maxWaitTime: options.maxWaitTime },
    { ChangeSetName: changeSetCmd.input.ChangeSetName, StackName: changeSetCmd.input.StackName },
  )
  if (changeSetResult.state !== WaiterState.SUCCESS) {
    throw new Error(
      `Failed to create change set: ${changeSetResult.state} ${changeSetResult.reason}`,
    )
  }

  await cloudformationClient.send(
    new ExecuteChangeSetCommand({
      ChangeSetName: changeSetCmd.input.ChangeSetName,
      StackName: changeSetCmd.input.StackName,
    }),
  )

  // TODO: we could describe the change set with a prompt

  const importResult = await waitUntilStackImportComplete(
    { client: cloudformationClient, maxWaitTime: options.maxWaitTime },
    { StackName: changeSetCmd.input.StackName },
  )

  if (importResult.state !== WaiterState.SUCCESS) {
    throw new Error(
      `Failed to update stack with change set: ${importResult.state} ${importResult.reason}`,
    )
  }
}
