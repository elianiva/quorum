import { UiSchema } from '@effect/ui'
import { Schema } from 'effect'
import { Locale } from '../i18n/index.ts'
import type { Prefs } from './model.ts'
import type { UpdateReturn } from './step.ts'
import { volumeIn } from './prefs-schema.ts'

export { volumeIn } from './prefs-schema.ts'

export const PrefsMessage = UiSchema.TaggedEnum({
  LocaleChosen: { locale: Locale },
  MuteToggled: {},
  VolumeChanged: { volume: Schema.Finite },
  AutoPauseToggled: {},
  BlurPauseToggled: {},
  EasyModeToggled: {},
  AgentAccessToggled: {},
  MotionToggled: {},
  AnalyticsToggled: {},
  TextToggled: {},
  ThemeToggled: {},
})
export type PrefsMessage = typeof PrefsMessage.Type

export const updatePrefs = (
  prefs: Prefs,
  message: PrefsMessage,
): UpdateReturn<Prefs, PrefsMessage> =>
  PrefsMessage.match(message, {
    LocaleChosen: ({ locale }) => ({ model: { ...prefs, locale } }),
    MuteToggled: () => ({ model: { ...prefs, muted: !prefs.muted } }),
    VolumeChanged: ({ volume }) => ({ model: { ...prefs, volume: volumeIn(volume) } }),
    AutoPauseToggled: () => ({ model: { ...prefs, autoPause: !prefs.autoPause } }),
    BlurPauseToggled: () => ({ model: { ...prefs, blurPause: !prefs.blurPause } }),
    EasyModeToggled: () => ({ model: { ...prefs, easyMode: !prefs.easyMode } }),
    AgentAccessToggled: () => ({ model: { ...prefs, agentAccess: !prefs.agentAccess } }),
    MotionToggled: () => ({
      model: { ...prefs, motion: prefs.motion === 'reduce' ? 'system' : 'reduce' },
    }),
    AnalyticsToggled: () => ({ model: { ...prefs, analytics: !prefs.analytics } }),
    TextToggled: () => ({
      model: { ...prefs, text: prefs.text === 'large' ? 'normal' : 'large' },
    }),
    ThemeToggled: () => ({
      model: { ...prefs, theme: prefs.theme === 'dark' ? 'light' : 'dark' },
    }),
  }) as UpdateReturn<Prefs, PrefsMessage>
