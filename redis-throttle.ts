import { Redis } from 'ioredis'

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const redisThrottle = <T>({
  redis,
  key,
  limit,
  ttl,
  checkIntervalDivisor = 4,
  checkIntervalMilliseconds,
  fn
}: {
  redis: Redis
  key: string
  limit: number
  /**
   * the higher the divisor, the more accurate the throttling will be, but the more expensive it will be by using more redis.get calls, default is 4
   */
  checkIntervalDivisor?: number
  /**
   * optional, if not provided, it will be calculated from durationSeconds and checkIntervalDivisor
   */
  checkIntervalMilliseconds?: number
  ttl: number
  fn: (...args: any[]) => Promise<T>
}) => {
  let running: number
  let waiting = 0
  const getRunningRedisCount = async () => {
    running = parseInt((await redis.get(key)) ?? '0', 10)
    return running
  }

  const sleepMilliseconds =
    checkIntervalMilliseconds ?? (ttl / checkIntervalDivisor) * 1000
  const trampoline = async (
    args: any[],
    resolve: any,
    reject: any
  ): Promise<T | undefined> => {
    if (running && running > limit) {
      await sleep(sleepMilliseconds)
      return trampoline(args as [], resolve, reject) as Promise<T>
    }

    running = await getRunningRedisCount()

    if (running > limit) {
      await sleep(sleepMilliseconds)
      return trampoline(args as [], resolve, reject) as Promise<T>
    }
    const redisRes = await redis.multi().incr(key).expire(key, ttl).exec() // https://stackoverflow.com/a/50286772/671457 according to this multi is slowest. We could try to make it a bit faster

    // @ts-expect-error
    running = parseInt(redisRes[0][1], 10)
    if (running > limit) {
      running = await redis.decr(key)
      await sleep(sleepMilliseconds)
      return trampoline(args as [], resolve, reject) as Promise<T>
    }

    return fn(...(args as [])) as Promise<T>
  }

  return {
    waitingCount: () => waiting,
    runningCount: () => running ?? 0,
    runningRedisCount: getRunningRedisCount,
    reset: async () => {
      running = 0
      waiting = 0
      return redis.del(key)
    },
    call: async (...args: any[]): Promise<T> => {
      return new Promise((resolve, reject) => {
        waiting++
        trampoline(args as [], resolve, reject)
          .then(resolve as any)
          .catch(reject)
          .finally(async () => {
            running = await redis.decr(key)
            waiting = waiting - 1
          })
      })
    }
  }
}
