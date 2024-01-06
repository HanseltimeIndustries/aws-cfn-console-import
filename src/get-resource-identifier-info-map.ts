import {
  Capability,
  GetTemplateSummaryCommand,
  GetTemplateSummaryCommandInput,
  ResourceIdentifierSummary,
} from '@aws-sdk/client-cloudformation'
import { cloudformationClient } from './client'
import { readFileSync } from 'fs'

interface GetResourceIdentifierInfoOptions {
  // url path relative to the cwd of the import file for local upload
  importFile?: string
  // The url where the s3 bucket was loaded previously
  s3Url?: string
}

/**
 * Given a file that we want to import, this uses the aws sdk to return a map of ResourceTypes and
 * their identifying traits from the template.
 *
 * @param {GetResourceIdentifierInfoOptions} options
 * @returns a map where the key is the fully qualified cloudformation resource type and the result is
 *          the resource identifier information
 */
export async function getResourceIdentifierInfoMap(
  options: GetResourceIdentifierInfoOptions,
): Promise<{
  resources: {
    [type: string]: ResourceIdentifierSummary
  }
  Capabilities: Capability[]
}> {
  const { importFile, s3Url } = options

  if (!importFile && !s3Url) {
    throw new Error('Must supply either importFile or s3Url')
  }

  let commandInput: GetTemplateSummaryCommandInput
  if (s3Url) {
    commandInput = {
      TemplateURL: s3Url,
    }
  } else {
    commandInput = {
      TemplateBody: readFileSync(importFile!).toString(),
    }
  }

  const getTemplateSummaryCommand = new GetTemplateSummaryCommand(commandInput)

  const summary = await cloudformationClient.send(getTemplateSummaryCommand)
  if (!summary.ResourceIdentifierSummaries) {
    throw new Error(`Could not get any resource identifier information for ${importFile}`)
  }

  return {
    resources: summary.ResourceIdentifierSummaries.reduce(
      (map, _summary) => {
        map[_summary.ResourceType!] = _summary
        return map
      },
      {} as { [type: string]: ResourceIdentifierSummary },
    ),
    Capabilities: summary.Capabilities ?? [],
  }
}
