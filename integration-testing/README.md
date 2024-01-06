# Integration Testing

This folder holds scripts for interacting with an actual AWS account to test the script.

To save on cost, this is currently just supposed to be run manually against an account with
the correct permissions.  The PR reviewers will run it manually after review and before approval.

If you are submitting a change, it is good to make sure that you've run this test against your own AWS sandbox.

## Usage

### To run tests

```shell
# In a shell that has AWS credentials to your test account
./int-test.sh
```

This will run and exit non-zero or exit 0 if successful

### Cleaning Up

The int-test.sh will attempt to run clean up if it can.  However, if your test failed during a test, you may look into the int-test.sh file to see what the clean-up script that would need to be called is.

At the very least, if you fail tests and don't want to re-run all tests, make sure to run the equivalent clean-up script by calling

```shell
./int-test.sh --cleanupOnly
```

## Development

If you have a new test case that you want to instantiate and test for your feature, please feel free to add a new set of .yaml stacks and augment the scripts as necessary.  While these tests are not automated, they allow the maintainers the fastest ability to check integration functionality
and are welcome!
