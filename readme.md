## @capaj/redis-throttle

```ts
import { redisThrottle } from '@capaj/redis-throttle'

const throttled = redisThrottle({
  redis: redisClient,
  key: 'showcase',
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

console.log(res) // [
//   [ 1, 3, 10 ], [ 2, 3, 10 ],
//   [ 3, 3, 10 ], [ 4, 3, 7 ],
//   [ 5, 3, 7 ],  [ 6, 3, 7 ],
//   [ 7, 3, 4 ],  [ 8, 3, 4 ],
//   [ 9, 3, 4 ],  [ 10, 1, 1 ]
// ]
expect(getTime() - before).toBeLessThan(5000) // all the call take around 4200 ms
expect(getTime() - before).toBeGreaterThan(4000)
expect(throttled.runningCount()).toBe(1)
expect(throttled.waitingCount()).toBe(1)

expect(res.length).toBe(10)
expect(await throttled.runningRedisCount()).toBe(0)
expect(throttled.runningCount()).toBe(0)
expect(throttled.waitingCount()).toBe(0)
```

### Why

For example when you have a single API key shared on multiple instances and you need to ensure you stay under the API rate limit.
