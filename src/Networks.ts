import ExplorerApi from './API/Explorer';
import RpcApi from './API/Rpc';

// AtomicHub's public per-network hosts, baked in as convenient defaults; each
// host serves both the API layer and chain RPC (the api/rpc split is kept so
// the shapes survive if the hosts ever diverge). Any compatible deployment
// can still be passed straight to the constructors.

export type AtomicHubNetwork = 'wax' | 'wax-testnet' | 'vaulta' | 'xpr' | 'xpr-testnet' | 'jungle4';

export const NETWORK_ENDPOINTS: Record<AtomicHubNetwork, {api: string, rpc: string}> = {
    'wax': {
        api: 'https://wax.api.atomicassets.io',
        rpc: 'https://wax.api.atomicassets.io'
    },
    'wax-testnet': {
        api: 'https://test.wax.api.atomicassets.io',
        rpc: 'https://test.wax.api.atomicassets.io'
    },
    'vaulta': {
        api: 'https://vaulta.api.atomicassets.io',
        rpc: 'https://vaulta.api.atomicassets.io'
    },
    'xpr': {
        api: 'https://xpr.api.atomicassets.io',
        rpc: 'https://xpr.api.atomicassets.io'
    },
    'xpr-testnet': {
        api: 'https://test.xpr.api.atomicassets.io',
        rpc: 'https://test.xpr.api.atomicassets.io'
    },
    'jungle4': {
        api: 'https://jungle4.api.atomicassets.io',
        rpc: 'https://jungle4.api.atomicassets.io'
    }
};

export function explorerApiForNetwork(
    network: AtomicHubNetwork, options?: ConstructorParameters<typeof ExplorerApi>[2]
): ExplorerApi {
    return new ExplorerApi(NETWORK_ENDPOINTS[network].api, 'atomicassets', options ?? {});
}

export function rpcApiForNetwork(
    network: AtomicHubNetwork, contract: string = 'atomicassets', options?: ConstructorParameters<typeof RpcApi>[2]
): RpcApi {
    return new RpcApi(NETWORK_ENDPOINTS[network].rpc, contract, options);
}
