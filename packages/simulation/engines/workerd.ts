import '../host/worker.ts'
import { report } from './report.ts'

export default { fetch: (): Response => Response.json(report()) }
