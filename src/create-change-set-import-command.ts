import { CreateChangeSetCommand, ResourceToImport } from '@aws-sdk/client-cloudformation'
import { yamlParse } from 'yaml-cfn'
import { createHash } from 'node:crypto'
import { getResourceIdentifierInfoMap } from './get-resource-identifier-info-map'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { uploadToS3Bucket } from './upload-s3-bucket'
import { cloudformationClient, getRegion } from './client'
import { extname } from 'node:path'

interface CreateChangeSetImportCommandOptions {
  // url path relative to the cwd of the import file
  importFile: string
  // A list of all resource name in the import file that should be imported
  importedResources: string[]
  // The name of the stack we're importing to
  stackName: string
  // This is the s3 bucket that we will store the template to for operations
  // IMPORTANT - you must make sure that you have put and get permissions to the bucket for the role running this
  s3Bucket?: string
}

interface CloudformationYamlKinda {
  Resources: {
    [resourceName: string]: {
      Type: string
      Properties: {
        [prop: string]: unknown
      }
    }
  }
}

const MAX_FROM_LOCAL_SIZE_BYTES = 51200
const MAX_S3_SIZE_BYTES = 460800

export async function createChangeSetImportCommand(options: CreateChangeSetImportCommandOptions) {
  const { importFile, stackName, s3Bucket } = options
  // Provide a more meaningful failure than just letting readfile panic
  if (!existsSync(importFile)) {
    throw new Error(`Cannot find import file: ${importFile}`)
  }

  const isJson = importFile.endsWith('.json')
  const isYaml = importFile.endsWith('.yaml') || importFile.endsWith('.yml')
  if (!isJson && !isYaml) {
    throw new Error(`Please provide a .json, .yaml, or .yml file instead of ${importFile}`)
  }

  // Check whether or not this needs to be an s3 upload?
  const stats = statSync(importFile)
  if (!s3Bucket && stats.size > MAX_FROM_LOCAL_SIZE_BYTES) {
    throw new Error(
      `Must provide an S3 bucket for uploads for template files that are greater than ${MAX_FROM_LOCAL_SIZE_BYTES} - current size: ${stats.size}`,
    )
  } else if (s3Bucket && stats.size > MAX_S3_SIZE_BYTES) {
    throw new Error(
      `Cannot do work on a template greater than ${MAX_S3_SIZE_BYTES} - current size: ${stats.size}`,
    )
  }

  // Note - we get this parse for free with the json
  const templateFile = yamlParse(readFileSync(importFile, 'utf8')) as CloudformationYamlKinda

  // Create a hash from the resource names that we're importing
  const hash = createHash('sha256')

  const changesetHash = hash.update(options.importedResources.join('')).digest('hex')
  const changeSetName = `import-${changesetHash}`

  cloudformationClient.config.region

  const templateParam: {
    TemplateURL?: string
    TemplateBody?: string
  } = {}
  // Upload to the bucket
  if (s3Bucket) {
    const key = `${changeSetName}${extname(importFile)}`
    await uploadToS3Bucket({
      s3Bucket,
      contentType: isJson ? 'application/json' : 'application/yaml',
      key: key,
      importFile,
    })
    templateParam.TemplateURL = `https://${s3Bucket}.s3.${await getRegion()}.amazonaws.com/${key}`
  } else {
    templateParam.TemplateBody = `file://${importFile}`
  }

  const resourceIdentifierMap = await getResourceIdentifierInfoMap({
    importFile,
    s3Url: templateParam.TemplateURL,
  })

  const resourcesToImport = options.importedResources.map<ResourceToImport>((resourceName) => {
    const resource = templateFile.Resources[resourceName]
    if (!resource) {
      throw new Error(`Could not find imported resource ${resourceName} in ${importFile}`)
    }

    const identifierSummary = resourceIdentifierMap[resource.Type]
    if (!identifierSummary) {
      throw new Error(
        `Could not find a template summary entry for ${resource.Type} for ${resourceName} in ${importFile}`,
      )
    }

    return {
      ResourceType: resource.Type,
      LogicalResourceId: resourceName,
      ResourceIdentifier: identifierSummary.ResourceIdentifiers?.reduce(
        (idMap, identifier) => {
          // TODO: add some error
          const idValue = resource.Properties[identifier]
          if (typeof idValue !== 'string') {
            throw new Error(
              `Unexpected non-string value for identifier property ${identifier}: ${JSON.stringify(
                idValue,
              )}`,
            )
          }
          idMap[identifier] = resource.Properties[identifier] as string
          return idMap
        },
        {} as Record<string, string>,
      ),
    }
  })

  return new CreateChangeSetCommand({
    ImportExistingResources: true,
    StackName: stackName,
    ChangeSetType: 'IMPORT',
    ResourcesToImport: resourcesToImport,
    ChangeSetName: changeSetName,
    ...templateParam,
  })
}
