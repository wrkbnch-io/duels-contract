import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import dotenv from 'dotenv';

dotenv.config();

const node_url = process.env.ARB_MAINNET_NODE;
if (!node_url) throw new Error('No mainnet node provided.');

const config: HardhatUserConfig = {
  solidity: '0.8.28',
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: node_url,
      },
      chainId: 42161,
    },
  },
};

export default config;
