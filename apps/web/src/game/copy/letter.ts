import type { AdviceAction, AdviceVars } from '@quorum/simulation/goals'

export interface Written {
  readonly subject: string
  readonly body: string
}

type Nothing = Record<never, never>

export interface From {
  readonly from: string
}

export type Letters<V = Nothing> = ReadonlyArray<(vars: V & From) => Written>

export type AdviceLetters = { readonly [T in keyof AdviceVars]: Letters<AdviceVars[T]> }

type Node = { readonly node: string }

export type EventVars = {
  readonly 'incident-instance': Node
  readonly 'incident-slow-query': Nothing
  readonly 'incident-poison': Nothing
  readonly 'incident-ddos': Nothing
  readonly 'incident-stampede': Nothing
  readonly 'incident-zone': { readonly zone: string }
  readonly 'incident-psp': Nothing
  readonly 'incident-breach': Nothing
  readonly 'incident-phishing': Nothing
  readonly resolved: { readonly incident: string }
  readonly 'resolved-action': { readonly incident: string; readonly action: string }
  readonly drawer: Nothing
  readonly oom: Node
  readonly credits: Node
  readonly alert: { readonly alert: string; readonly seconds: string }
  readonly 'alert-ignored': { readonly alert: string }
  readonly hired: Nothing
  readonly finished: { readonly item: string }
  readonly deployed: { readonly features: string }
  readonly 'deployed-bad': { readonly features: string }
  readonly migration: { readonly share: string }
  readonly blocked: { readonly item: string; readonly reason: string }
  readonly unhappy: { readonly pages: string; readonly gap: string }
  readonly 'patch-proposed': {
    readonly item: string
    readonly target: string
    readonly due: string
  }
}

export type EventTopic = keyof EventVars

export type EventMail = {
  readonly [T in EventTopic]: { readonly topic: T; readonly vars: EventVars[T] }
}[EventTopic]

export type EventLetters = { readonly [T in EventTopic]: Letters<EventVars[T]> }

export interface Pitch {
  readonly sender: string
  readonly actions?: ReadonlyArray<AdviceAction>
  readonly letters: Letters
}

export interface Cve {
  readonly id: string
  readonly title: string
  readonly what: string
}

export type CveVars = Cve & {
  readonly score: number
  readonly severity: 'critical' | 'high' | 'medium' | 'low'
  readonly exposed: string | null
}

export interface Rewrite {
  readonly language: string
  readonly letters: Letters
}
