#!/bin/bash -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# Parse args
cleanupOnly=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --cleanupOnly)
      cleanupOnly=true
      shift 1
      ;;
    *)
      echo "Unrecognized argument: $1"
      exit 2
      ;;
  esac
done


echo "Setup: Ensuring clean environment"
${SCRIPT_DIR}/cleanup-stack-import-test.sh --stackName test-existing-import-stack --consoleRoleName existing-import-test
${SCRIPT_DIR}/cleanup-stack-import-test.sh --stackName test-new-import-stack --consoleRoleName new-import-test
echo ""

if [ "$cleanupOnly" == "true" ]; then
  echo "Clean up only performed, exiting"
fi


echo "-----------Test: importing into an existing stack-------------"
${SCRIPT_DIR}/stack-import-test.sh --stackName test-existing-import-stack --consoleRoleName existing-import-test --makeExisting

echo "Attempting to clean up resources"
${SCRIPT_DIR}/cleanup-stack-import-test.sh --stackName test-existing-import-stack --consoleRoleName existing-import-test
echo "-----------End Test: importing into an existing stack-------------"
echo ""

echo "-----------Test: importing into a newly created stack-------------"
${SCRIPT_DIR}/stack-import-test.sh --stackName test-new-import-stack --consoleRoleName new-import-test

echo "Attempting to clean up resources"
${SCRIPT_DIR}/cleanup-stack-import-test.sh --stackName test-new-import-stack --consoleRoleName new-import-test
echo "-----------End Test: importing into a newly created stack-------------"


echo "Success"