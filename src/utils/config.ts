import * as bitcoin from 'bitcoinjs-lib';

export type NetworkType = 'mainnet' | 'testnet' | 'testnet4' | 'signet' | 'fractal' | 'fractal-testnet';

export interface ConfigData {
  networkType: NetworkType;
  unisatWalletUri: string;
  mempoolUri: string;
  network: bitcoin.networks.Network;
}

export const networkConfigs: Record<NetworkType, ConfigData> = {
  mainnet: {
    networkType: 'mainnet',
    unisatWalletUri: 'https://open-api.unisat.io',
    mempoolUri: 'https://mempool.space',
    network: bitcoin.networks.bitcoin,
  },
  testnet: {
    networkType: 'testnet',
    unisatWalletUri: 'https://open-api-testnet.unisat.io',
    mempoolUri: 'https://mempool.space/testnet',
    network: bitcoin.networks.testnet,
  },
  testnet4: {
    networkType: 'testnet4',
    unisatWalletUri: 'https://open-api-testnet4.unisat.io',
    mempoolUri: 'https://mempool.space/testnet4',
    network: bitcoin.networks.testnet,
  },
  signet: {
    networkType: 'signet',
    unisatWalletUri: 'https://open-api-signet.unisat.io',
    mempoolUri: 'https://mempool.space/signet',
    network: bitcoin.networks.testnet,
  },
  fractal: {
    networkType: 'fractal',
    unisatWalletUri: 'https://open-api-fractal.unisat.io',
    mempoolUri: 'https://mempool.fractalbitcoin.io',
    network: bitcoin.networks.bitcoin,
  },
  'fractal-testnet': {
    networkType: 'fractal-testnet',
    unisatWalletUri: 'https://open-api-fractal-testnet.unisat.io',
    mempoolUri: 'https://mempool-testnet.fractalbitcoin.io',
    network: bitcoin.networks.bitcoin,
  },
};

export function getNetworkConfig(networkType: NetworkType): ConfigData {
  return networkConfigs[networkType] || networkConfigs.testnet;
}
