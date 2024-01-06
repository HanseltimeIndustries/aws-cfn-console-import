import { awsBetterErrors } from './aws-better-errors'

describe('awsBetterErrors', () => {
  it('creates repackages the error message with command', async () => {
    const commandPrefix = 'SomethingCommand'
    await expect(
      async () =>
        await awsBetterErrors(commandPrefix, async () => {
          const mockError = new Error()
          mockError.message = 'Bad Thing reason'
          mockError.name = 'BadThingHappened'
          throw mockError
        }),
    ).rejects.toThrow(`AWS SDK ${commandPrefix}: BadThingHappened - Bad Thing reason`)
  })
})
