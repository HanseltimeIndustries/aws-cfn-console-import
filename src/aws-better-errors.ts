import type { ServiceException } from '@smithy/smithy-client'

/**
 * Simple wrapper function that calls the "awsLambda" that is expected to perform
 * one aws command and then clean up the command output, since it's pretty rough
 * because everything in the sdk is unbound.
 *
 * Note: this does simply repackages and throws a better eror
 *
 * @param commandName
 * @param awsLambda
 */
export async function awsBetterErrors<T>(
  commandName: string,
  awsLambda: () => Promise<T>,
): Promise<T> {
  try {
    return await awsLambda()
  } catch (err) {
    if ((err as ServiceException).name) {
      // this repackages and makes the stack a little less of a pain
      const cast = err as ServiceException
      throw new Error(`AWS SDK ${commandName}: ${cast.name} - ${cast.message}`)
    }
    throw err
  }
}
