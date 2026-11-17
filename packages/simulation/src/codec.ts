const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

const asciiJson = (value: unknown): string =>
  JSON.stringify(value).replace(
    /[\u0080-\uffff]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )

const toBase64Url = (text: string): string => {
  let out = ''
  for (let index = 0; index < text.length; index += 3) {
    const a = text.charCodeAt(index)
    const b = index + 1 < text.length ? text.charCodeAt(index + 1) : 0
    const c = index + 2 < text.length ? text.charCodeAt(index + 2) : 0
    const triple = (a << 16) | (b << 8) | c
    out += ALPHABET[(triple >> 18) & 63] ?? ''
    out += ALPHABET[(triple >> 12) & 63] ?? ''
    if (index + 1 < text.length) out += ALPHABET[(triple >> 6) & 63] ?? ''
    if (index + 2 < text.length) out += ALPHABET[triple & 63] ?? ''
  }
  return out
}

const fromBase64Url = (text: string): string | null => {
  let out = ''
  for (let index = 0; index < text.length; index += 4) {
    const chunk = text.slice(index, index + 4)
    const values = Array.from(chunk, (char) => ALPHABET.indexOf(char))
    if (values.some((value) => value < 0) || chunk.length === 1) return null
    const [a = 0, b = 0, c = 0, d = 0] = values
    const triple = (a << 18) | (b << 12) | (c << 6) | d
    out += String.fromCharCode((triple >> 16) & 255)
    if (chunk.length > 2) out += String.fromCharCode((triple >> 8) & 255)
    if (chunk.length > 3) out += String.fromCharCode(triple & 255)
  }
  return out
}

export const encodeText = (prefix: string, value: unknown): string =>
  `${prefix}${toBase64Url(asciiJson(value))}`

export const decodeText = (prefix: string, text: string): unknown => {
  const trimmed = text.trim()
  if (!trimmed.startsWith(prefix)) return undefined
  const json = fromBase64Url(trimmed.slice(prefix.length))
  if (json === null) return undefined
  try {
    return JSON.parse(json) as unknown
  } catch {
    return undefined
  }
}
