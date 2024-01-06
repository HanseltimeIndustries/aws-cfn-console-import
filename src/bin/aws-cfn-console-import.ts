import { program } from 'commander'
import { importResourcesToStack } from '../import-resources-to-stack'

function collect(value: string, previous: string[]) {
  previous.push(value)
  return previous
}

interface CLIOptions {
  stackName: string
  templateFile: string
  importedResource: string[]
  maxWaitTime: string
  s3Bucket: string
}

program
  .requiredOption(
    '-s, --stackName <name>',
    'The name of the stack that you are either creating or that exists and you are importing into',
  )
  .requiredOption(
    '-f, --templateFile <path>',
    'The path to the template file with the import-only changes, relative to the cwd',
  )
  .requiredOption(
    '-i, --importedResource <name>',
    'The name of the resource in the template that is being imported.  You can supply multiple or these',
    collect,
    [],
  )
  .option(
    '--maxWaitTime <number>',
    'The max number of seconds to wait when creating changes sets and creating/importing stacks',
    '20000',
  )
  .option(
    '--s3Bucket',
    'An s3 bucket that the AWS sdk would have access to upload and run import operations aginst (required for files larger than 51200 bytes)',
  )

program.parse()
const options = program.opts<CLIOptions>()

// Run some further validations
if (options.importedResource.length <= 0) {
  throw new Error('Must supply at least 1 resource to import in the template file')
}
if (isNaN(parseInt(options.maxWaitTime))) {
  throw new Error(`Must supply an integer value for maxWaitTime: '${options.maxWaitTime}'`)
}

// Run the actual program
void importResourcesToStack({
  stackName: options.stackName,
  maxWaitTime: parseInt(options.maxWaitTime),
  importedResources: options.importedResource,
  s3Bucket: options.s3Bucket,
  importFile: options.templateFile,
})
