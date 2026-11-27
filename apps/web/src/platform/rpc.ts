import { Context, Layer } from 'effect'
import { FetchHttpClient, HttpClient } from 'effect/http'
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'
import { Api, RPC_PATH } from '@quorum/rpc'

export class ApiRpc extends Context.Service<
  ApiRpc,
  RpcClient.FromGroup<typeof Api, RpcClientError.RpcClientError>
>()('quorum/web/ApiRpc') {
  static readonly layer = Layer.effect(ApiRpc, RpcClient.make(Api)).pipe(
    Layer.provide(RpcClient.layerProtocolHttp({ url: RPC_PATH })),
    Layer.provide(RpcSerialization.layerJson),
    Layer.provide(
      Layer.provide(
        FetchHttpClient.layer,
        Layer.succeed(HttpClient.TracerPropagationEnabled, false),
      ),
    ),
  )
}
