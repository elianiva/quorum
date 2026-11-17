export { ApiError } from './errors.ts'
export {
  AGENT_PREFIX,
  AGENT_ROOM_PATH,
  API_PREFIX,
  POSTHOG_PROXY_PREFIX,
  MCP_PATH,
  ROOM_PATH,
  ROOMS_FULL_CLOSE_CODE,
  ROOM_SOCKET_PATH,
  RPC_PATH,
} from './paths.ts'
export { RoomInfo, RoomOpened, RoomPublish, RoomQuery, RoomRpc } from './room.ts'
export { SurveyExit, SurveyReceipt, SurveyRpc, SurveySubmission } from './survey.ts'
export { SystemRpc, SystemStatus } from './system.ts'

import { RoomRpc } from './room.ts'
import { SurveyRpc } from './survey.ts'
import { SystemRpc } from './system.ts'

export class Api extends SystemRpc.merge(SurveyRpc).merge(RoomRpc) {}
