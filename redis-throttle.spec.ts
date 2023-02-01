import { describe, it, expect } from 'vitest'
import { redisThrottle } from './redis-throttle'
import Redis from 'ioredis'
import isCi from 'is-ci'

const redisClient = new Redis({
  host: isCi ? 'redis' : 'localhost'
})

const getTime = () => {
  {
    const hrTime = process.hrtime()
    return hrTime[0] * 1000 + hrTime[1] / 1000000
  }
}

describe('redis-throttle', () => {
  it('should resolve all promises without waiting', async () => {
    const throttled = redisThrottle({
      redis: redisClient,
      key: 'test',
      limit: 3,
      durationSeconds: 5,
      fn: async (n: number): Promise<number[]> => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([n, throttled.runningCount(), throttled.waitingCount()])
          }, 500)
        })
      }
    })
    await throttled.reset()
    const before = getTime()
    const res = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => throttled.call(n))
    )
    expect(getTime() - before).toBeLessThan(5000)
    expect(getTime() - before).toBeGreaterThan(4000)
    expect(throttled.runningCount()).toBe(1)
    expect(throttled.waitingCount()).toBe(1)

    expect(res).toMatchSnapshot() // this can be flaky, but most of the time it passes ok
    expect(res.length).toBe(10)
    expect(await throttled.runningRedisCount()).toBe(0)
    expect(throttled.runningCount()).toBe(0)
    expect(throttled.waitingCount()).toBe(0)
  })
})
