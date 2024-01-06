#!/bin/bash +e

##################################################################################
#
# cleanup-stack-import-test.sh --stackName <stackName> --consoleRoleName <consoleRoleName>
#
# Deletes what should've been set up via stack-import-test.sh
#
# Parameters:
#   stackName: the name of the stack to apply imports to
#   consoleRoleName: the name of the role we will create in console
#
##################################################################################

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Parse args
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
    *)
      echo "Unrecognized argument: $1"
      exit 2
      ;;
  esac
done

# Disable pager
export AWS_PAGER=""

echo "Attempting to Delete iam role $consoleRoleName"
aws iam delete-role --role-name $consoleRoleName

echo "Attempting to Delete stack $stackName"
aws cloudformation delete-stack --stack-name $stackName
aws cloudformation wait stack-delete-complete --stack-name $stackName