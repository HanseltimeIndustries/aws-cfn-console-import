# aws-cfn-console-import

This package is a programmatic adaptation of the 
[AWS Cloudformation Import instructions](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/resource-import.html). 
It is meant to provide a means for you to run imports of console resources as a part of CI/CD and is recommended as part of a version
controlled flow so that you can verify import changes and restrict the ability for Developers or DevOps engineers
to perform undocumented/unreviewed actions on your infrastructure.

**Important Note** This should not be a tool to excuse IAC.  In reality, this should be a tool to help you bring your
console created AWS resources into alignment with your CDK or Cloudformation IAC.  I suggest that you make a place for
imports in your IA repo and version control process and then set a goal to never have to use this tool again.

- [aws-cfn-console-import](#aws-cfn-console-import)
- [Usage](#usage)
  - [1. Getting the Cloudformation Template](#1-getting-the-cloudformation-template)
    - [From Console](#from-console)
    - [From Cloudformation IAC](#from-cloudformation-iac)
    - [From AWS CDK](#from-aws-cdk)
  - [2. Updating the template with imports](#2-updating-the-template-with-imports)
    - [For AWS CDK](#for-aws-cdk)
  - [3. Calling aws-cfn-console-import](#3-calling-aws-cfn-console-import)
    - [About the above](#about-the-above)
      - [stackName](#stackname)
      - [templateFile](#templatefile)
    - [i (importedResource)](#i-importedresource)
    - [s3Bucket](#s3bucket)
- [Programmatic API](#programmatic-api)
- [AWS CDK Native Import](#aws-cdk-native-import)
  
*Table of Contents generated with VSCode Markdown All In One extension*

# Usage

At it's most basic, you still need to get your current cloudformation template and **just** add your resources to that template.

## 1. Getting the Cloudformation Template

### From Console

If you do not trust your IAC, you may always go the the cloudformation console and copy the Template for the stack.

### From Cloudformation IAC

If you have a cloudformation IAC that you know is up-to-date (either because it's new or trusted), then you can update that IAC in place.

### From AWS CDK

If you have the AWS CDK set up, you will need to find the stack you want to add to and add a new construct for the resource in question.

## 2. Updating the template with imports

You will need to make adjustments to the newest cloudformation to **only** include the imported resource that you want to import.  Importantly,
Please note that you are going to need to do your homework, either via a tool that can export CFN or by manually examining the resource to import
and constructing the expected cloudformation.

**Valuable Note:** Keep in mind that if you are creating a new stack for the imported resources, you will need to make sure that only the resource
is in the stack for the use of this script.  This is a limitation of Cloudformation and not the script itself.  This also means that `Outputs`
cannot be added, since they are seen as unique items by Cloudformation.  This is particularly important for things like CDK, that my create some
auto-exports if you try using resources in other stacks.  You will need to create the Zero-output stack and then add them back afterwards.

### For AWS CDK

As noted above, if you want to use CDK and it's contructs exclusively, you will need to create a construct that represents the resource.  
Keep in mind, that the construct itself may be adding new settings that are best practice as compared to the console's more loose 
implementation.  Because of this, you may need to perform property overrides so that that synthesized resource looks the same as 
expected for importing.  [Raw Propety Overrides](https://docs.aws.amazon.com/cdk/v2/guide/cfn_layer.html#cfn_layer_raw)

To check this, you should make usage of the `cdk synth` command.

You could either then copy the stack's synth'ed output to a file or just take note of it's location and ensure you have synthed before
you point to the cdk.out folder file.

## 3. Calling aws-cfn-console-import

**CDK Note:** if you already have CDK related stacks, the typescript CDK actually provides a way of updating its own
stacks for import.  See [AWS CDK Native Import](#aws-cdk-native-import)

**Note:** you will need to make sure that you have the correct permissions for aws under the role that runs this:

* Cloudformation
    * CreateChangeSet
    * ExecuteChangeSet
    * GetTemplateSummary
    * DescribeStack*
    * DescribeChangeSet*
* S3 (for cloudformation files that are bigger than 51200 bytes)
  Note - the permissions needs to be for the bucket that you supply
    * PutObject
    * GetObject
    * List*
    * 

With the corresponding role available to the console, you can call:

```shell
# for yarm
yarn aws-cfn-console-import --stackName \<your stack name\> --templateFile \<cloudformation template file\> -i ResourceName
```

### About the above

#### stackName

If you were using a template of an existing stack, you would need this to match the same stack name that already exists.  Otherwise,
if this was new, you would need to just make sure this is a unique stack name

#### templateFile

The templateFile needs to be a local file path to the file that you have created from Step 1 and 2.

### i (importedResource)

This will be the cloudformation name of the resource that you added.  You will add multiple of those if you are importing multiple resources

### s3Bucket

In the event that you want to load to an S3 bucket before doing the deployment, you will provide the s3 bucket.  This is required if the 
size of the template file is over 51200 bytes.

# Programmatic API

We also provide a programmatic API so that you can import the package and use it in your scripts:

```typescript
import { importResourcesToStack } from '@hanseltime/aws-cfn-console-import';

void importResourcesToStack({
  stackName: 'my-stack',
  maxWaitTime: 60,
  importedResources: ['Resource1'],
  s3Bucket: 'my-upload-s3',
  importFile: 'path/to/my/template',
  parameterOverrides: {
    Param1: 'some value'
  },
})
```

# AWS CDK Native Import

If you are already using the CDK, it is recommended that you use the CDK import function.

In order to use this, you can follow steps 1 and 2 from above.  Then, you will want to make a resource
import file that describes every new addition like:

```json
{
  "MyResourceId": {
    // You would need to identify the "logical resource id" property that can be used to find the resource
    // this can be done via `aws cloudformation get-template-summary`
    "RoleName": "value"
  }
}
```

Then you would need to run this cdk command:

```shell
cdk import my-stack --resource-mapping <file path>
```
