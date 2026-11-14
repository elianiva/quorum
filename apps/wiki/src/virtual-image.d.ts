declare module 'virtual:image-sizes' {
  export const IMAGE_SIZES: Readonly<
    Record<string, Readonly<{ width: number; height: number }>>
  >
}
