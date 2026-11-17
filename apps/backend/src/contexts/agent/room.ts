import type { Ack, Status, Upload } from '@quorum/agent/snapshot'

export type AgentRoomStub = Readonly<{
  write: (upload: Upload, key: string) => Promise<Ack>
  clear: (key: string) => Promise<void>
  read: (name: string, input: Record<string, unknown>) => Promise<string>
  status: () => Promise<Status | null>
}>

export type AgentRooms = Readonly<{
  getByName: (id: string) => AgentRoomStub
}>
