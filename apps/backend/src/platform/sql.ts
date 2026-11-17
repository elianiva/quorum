export interface SqlStatement {
  bind(...values: Array<unknown>): SqlStatement
  all<T = Record<string, unknown>>(): Promise<{ results: Array<T> }>
}

export interface SqlRunner {
  prepare(query: string): SqlStatement
}
