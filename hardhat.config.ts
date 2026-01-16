import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        // Cronos zkEVM Testnet
        cronosZkevmTestnet: {
            type: "http",
            url: "https://testnet.zkevm.cronos.org",
            chainId: 240,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: 2500000000, // 2.5 gwei
        },
        // Cronos zkEVM Mainnet
        cronosZkevmMainnet: {
            type: "http",
            url: process.env.CRONOS_ZKEVM_RPC || "https://mainnet.zkevm.cronos.org",
            chainId: 388,
            accounts: [DEPLOYER_PRIVATE_KEY],
            gasPrice: 2500000000, // 2.5 gwei
        },
        // Cronos Mainnet (EVM)
        cronosMainnet: {
            type: "http",
            url: "https://evm.cronos.org",
            chainId: 25,
            accounts: [DEPLOYER_PRIVATE_KEY],
        },
        // Cronos Testnet (EVM)
        cronosTestnet: {
            type: "http",
            url: "https://evm-t3.cronos.org",
            chainId: 338,
            accounts: [DEPLOYER_PRIVATE_KEY],
        },
    },
    etherscan: {
        apiKey: {
            // Cronos zkEVM explorer
            cronosZkevmTestnet: process.env.CRONOS_ZKEVM_API_KEY || "no-api-key-needed",
            cronosZkevmMainnet: process.env.CRONOS_ZKEVM_API_KEY || "no-api-key-needed",
            // Cronos EVM explorer
            cronosTestnet: process.env.CRONOS_EXPLORER_API_KEY || "lXOKToGm0oIKGwSosA2mQFuujGHKgzwR",
            cronosMainnet: process.env.CRONOS_EXPLORER_API_KEY || "lXOKToGm0oIKGwSosA2mQFuujGHKgzwR",
        },
        customChains: [
            {
                network: "cronosTestnet",
                chainId: 338,
                urls: {
                    apiURL: "https://explorer-api.cronos.org/testnet3/api",
                    browserURL: "https://explorer.cronos.org/testnet"
                }
            },
            {
                network: "cronosMainnet",
                chainId: 25,
                urls: {
                    apiURL: "https://explorer-api.cronos.org/mainnet/api",
                    browserURL: "https://explorer.cronos.org"
                }
            },
            {
                network: "cronosZkevmTestnet",
                chainId: 240,
                urls: {
                    apiURL: "https://explorer-api.testnet.zkevm.cronos.org/api",
                    browserURL: "https://explorer.testnet.zkevm.cronos.org"
                }
            },
            {
                network: "cronosZkevmMainnet",
                chainId: 388,
                urls: {
                    apiURL: "https://explorer-api.zkevm.cronos.org/api",
                    browserURL: "https://explorer.zkevm.cronos.org"
                }
            }
        ]
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};

export default config;
