import { Schema } from 'effect'

export class ApiError extends Schema.TaggedError<ApiError, { readonly brand: unique symbol }>()(
  'ApiError',
  {
    message: Schema.String,
  },
) {}
