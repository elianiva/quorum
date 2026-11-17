import { css, keyframes, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

export type OtpAlphabet = 'digits' | 'alphanumeric'

const KEEP: Record<OtpAlphabet, RegExp> = {
  digits: /[^0-9]/g,
  alphanumeric: /[^0-9A-Z]/g,
}

export const normalizeOtpValue = (
  raw: string,
  length: number,
  alphabet: OtpAlphabet = 'digits',
): string => {
  const cased = alphabet === 'digits' ? raw : raw.toUpperCase()
  return cased.replace(KEEP[alphabet], '').slice(0, length)
}

export const isCompleteOtpValue = (
  value: string,
  length: number,
  alphabet: OtpAlphabet = 'digits',
): boolean => normalizeOtpValue(value, length, alphabet).length >= length

export type OtpSlotState = Readonly<{
  index: number
  char: string | null
  isActive: boolean
}>

export const otpSlotStates = (
  value: string,
  length: number,
  alphabet: OtpAlphabet = 'digits',
): ReadonlyArray<OtpSlotState> => {
  const digits = normalizeOtpValue(value, length, alphabet).split('')
  const activeIndex = digits.length >= length ? -1 : digits.length
  return Array.from({ length }, (_, index) => ({
    index,
    char: digits[index] ?? null,
    isActive: index === activeIndex,
  }))
}

export const inputOtpClass = css({
  gap: '2',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  '&:has(:disabled)': { opacity: 0.5 },
})

export const inputOtpGroupClass = css({
  '&:has([aria-invalid="true"])': {
    boxShadow: 'invalid',
    borderColor: 'destructive',
  },
  _dark: {
    '&:has([aria-invalid="true"])': {
      boxShadow: 'invalid',
    },
  },
  borderRadius: 'lg',
  display: 'flex',
  alignItems: 'center',
  gap: '1.5',
})

export const inputOtpInputClass = css({
  position: 'absolute',
  inset: '0',
  zIndex: '10',
  height: '100%',
  width: '100%',
  backgroundColor: 'transparent',
  color: 'transparent',
  caretColor: 'transparent',
  outlineStyle: 'none',
  _disabled: {
    cursor: 'not-allowed',
  },
})

export const inputOtpSlotClass = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderColor: 'transparent',
  '&[data-active="true"]': {
    borderColor: 'ring',
    boxShadow: 'focusWell',
    zIndex: '10',
    '&[aria-invalid="true"]': {
      boxShadow:
        'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
      borderColor: 'destructive',
    },
  },
  _dark: {
    '&[data-active="true"][aria-invalid="true"]': {
      boxShadow:
        'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
    },
  },
  '&[aria-invalid="true"]': { borderColor: 'destructive' },
  width: '9',
  height: '9',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  fontFamily: 'mono',
  fontSize: 'type.14',
  lineHeight: 'fine',
  transitionProperty: 'all',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  outlineStyle: 'none',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

export const inputOtpCaretClass = css({
  pointerEvents: 'none',
  position: 'absolute',
  inset: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const caretBlink = keyframes({
  '0%, 70%, 100%': { opacity: 1 },
  '20%, 50%': { opacity: 0 },
})

export const inputOtpCaretLineClass = css({
  animation: `${caretBlink} 1.25s ease-out infinite`,
  backgroundColor: 'foreground',
  height: '4',
  width: '1px',
})

export const inputOtpSeparatorClass = css({
  '& svg:not([data-svg-icon])': {
    width: '4',
    height: '4',
  },
  display: 'flex',
  alignItems: 'center',
})

export type InputOtpConfig<M> = Readonly<{
  length: number
  value: string
  onInput?: (value: string) => M
  onComplete?: (value: string) => M
  isDisabled?: boolean
  isInvalid?: boolean
  autoFocus?: boolean
  alphabet?: OtpAlphabet
  id?: string
  className?: string
  children?: ReadonlyArray<Child>
}>

export const inputOtpSeparator = <M>(
  config: Readonly<{ className?: string }>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.DataAttribute('slot', 'input-otp-separator'),
      h.Role('separator'),
      h.Class(cx(inputOtpSeparatorClass, config.className)),
    ],
    ['−'],
  )

export type InputOtpSlotConfig = Readonly<{
  index: number
  value: string
  length: number
  isInvalid?: boolean
  alphabet?: OtpAlphabet
  className?: string
}>

export const inputOtpSlot = <M>(config: InputOtpSlotConfig, h: HtmlBuilder<M>): Html => {
  const state = otpSlotStates(config.value, config.length, config.alphabet ?? 'digits')[
    config.index
  ] ?? {
    ...(config.index === undefined ? {} : { index: config.index }),
    char: null,
    isActive: false,
  }
  return h.div(
    [
      h.Class(cx(inputOtpSlotClass, config.className)),
      h.DataAttribute('slot', 'input-otp-slot'),
      h.DataAttribute('active', state.isActive ? 'true' : 'false'),
      ...(config.isInvalid === true ? [h.AriaInvalid(true)] : []),
    ],
    [
      state.char ?? '',
      state.isActive
        ? h.div([h.Class(inputOtpCaretClass)], [h.div([h.Class(inputOtpCaretLineClass)], [])])
        : null,
    ],
  )
}

export const inputOtpGroup = <M>(
  config: Readonly<{ className?: string }>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(inputOtpGroupClass, config.className)), h.DataAttribute('slot', 'input-otp-group')],
    children,
  )

export const inputOtp = <M>(config: InputOtpConfig<M>, h: HtmlBuilder<M>): Html => {
  const alphabet = config.alphabet ?? 'digits'
  const value = normalizeOtpValue(config.value, config.length, alphabet)

  return h.div(
    [h.Class(cx(inputOtpClass, config.className)), h.DataAttribute('slot', 'input-otp')],
    [
      h.input([
        h.Type('text'),
        h.InputMode(alphabet === 'digits' ? 'numeric' : 'text'),
        h.Attribute('autocomplete', 'one-time-code'),
        h.Spellcheck(false),
        ...(config.isDisabled === true ? [h.Disabled(true)] : []),
        ...(config.isInvalid === true ? [h.AriaInvalid(true)] : []),
        ...(config.autoFocus === true ? [h.Autofocus(true)] : []),
        ...(config.id === undefined ? [] : [h.Id(config.id)]),
        h.Value(value),
        h.Class(inputOtpInputClass),
        h.DataAttribute('slot', 'input-otp-input'),
        ...(config.onInput === undefined && config.onComplete === undefined
          ? []
          : [
              h.OnInput((raw) => {
                const next = normalizeOtpValue(raw, config.length, alphabet)
                if (config.onInput !== undefined) {
                  return config.onInput(next)
                }
                if (config.onComplete !== undefined) {
                  return config.onComplete(next)
                }
                throw new Error('unreachable: OnInput is only attached with a callback')
              }),
            ]),
      ]),
      ...(config.children === undefined
        ? [
            inputOtpGroup<M>(
              {},
              Array.from({ length: config.length }, (_, index) =>
                inputOtpSlot(
                  {
                    index,
                    value,
                    length: config.length,
                    alphabet,
                    ...(config.isInvalid === undefined ? {} : { isInvalid: config.isInvalid }),
                  },
                  h,
                ),
              ),
              h,
            ),
          ]
        : config.children),
    ],
  )
}
