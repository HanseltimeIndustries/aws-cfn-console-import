#!/bin/bash -e

##################################################################################
#
# stack-import-test.sh --stackName <stackName> --consoleRoleName <consoleRoleName> [--makeExisting]
#
# This script runs an optional stack setup, creates a role via cli
# and then imports the same element using the aws-cfn-consolep-import script.
# 
# It also tests the import to ensure that the resource exists in the stack.
#
# Parameters:
#   stackName: the name of the stack to apply imports to
#   consoleRoleName: the name of the role we will create in console
#   makeExisting: if set, this means that we will be creating the stack first via test-import-stack.yaml
#
##################################################################################

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Parse args
makeExisting=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --stackName)
      stackName="$2"
      shift 2
      ;;
    --consoleRoleName)
      consoleRoleName="$2"
      shift 2
      ;;
    --makeExisting)
      makeExisting=true
      shift
      ;;
    *)
      echo "Unrecognized argument: $1"
      exit 2
      ;;
  esac
done

# Disable pager
export AWS_PAGER=""

if [ "$makeExisting" == "true" ]; then
    echo "Deploying stack in advance"
    aws cloudformation deploy --no-paginate --template-file $SCRIPT_DIR/test-import-stack.yaml --stack-name $stackName --capabilities CAPABILITY_IAM
fi

# Create the resource "in console"
echo "Creating role ${consoleRoleName} via cli"
aws iam create-role --no-paginate --role-name $consoleRoleName --tags "Key=testTag,Value=testValue" --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "Service": "ec2.amazonaws.com"
            },
            "Action": "sts:AssumeRole"
        }
    ]
}'

importedResourceName=ImportedRole

templateFile=test-import-stack-add.yaml
if [ "$makeExisting" == "false" ]; then
    templateFile=test-import-stack-new.yaml
fi
echo $templateFile

# call the import
echo "Calling cfn console import"
yarn aws-cfn-console-import --stackName $stackName --templateFile $SCRIPT_DIR/$templateFile -i $importedResourceName --parameterOverrides ImportRoleName=$consoleRoleName

# check to see if the stack contains what we expect
resources=$(aws cloudformation --no-paginate list-stack-resources --stack-name $stackName)

imported=$(echo $resources | jq ".StackResourceSummaries[] | select(.LogicalResourceId == \"$importedResourceName\")")
if [ -z "$imported" ]; then
    echo "Could not find imported Resource with name ${importedResourceName}!"
    exit 1
fi

echo "Imported Seems to have succeeded!  Be sure to clean up that stack"