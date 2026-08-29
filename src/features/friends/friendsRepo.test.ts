import { beforeEach, describe, expect, it, vi } from 'vitest'

const realtime = vi.hoisted(() => {
  type MockChannel = {
    name: string
    subscribed: boolean
    on: () => MockChannel
    subscribe: () => MockChannel
  }

  const channels = new Map<string, MockChannel>()
  const names: string[] = []
  const removeChannel = vi.fn(async () => 'ok')

  return {
    channels,
    names,
    removeChannel,
    client: {
      channel(name: string) {
        names.push(name)
        const existing = channels.get(name)
        if (existing) return existing

        const channel: MockChannel = {
          name,
          subscribed: false,
          on() {
            if (this.subscribed) throw new Error(`cannot add callbacks for ${this.name} after subscribe()`)
            return this
          },
          subscribe() {
            this.subscribed = true
            return this
          },
        }
        channels.set(name, channel)
        return channel
      },
      removeChannel,
    },
  }
})

vi.mock('@/lib/sync/supabase', () => ({ supabase: realtime.client }))

import { subscribeToFriendChanges } from './friendsRepo'

describe('subscribeToFriendChanges', () => {
  beforeEach(() => {
    realtime.channels.clear()
    realtime.names.length = 0
    realtime.removeChannel.mockClear()
  })

  it('uses a fresh channel while an earlier subscription is still being removed', () => {
    const stopFirst = subscribeToFriendChanges(() => undefined)
    stopFirst()

    expect(() => subscribeToFriendChanges(() => undefined)).not.toThrow()
    expect(realtime.names).toHaveLength(2)
    expect(new Set(realtime.names).size).toBe(2)
    expect(realtime.removeChannel).toHaveBeenCalledTimes(1)
  })
})
