/**
 * Auth Command - API Key Management
 * 
 * Handles authentication with RelayCore API.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.relaycore');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface Config {
    apiKey: string;
    baseUrl: string;
    environment: 'testnet' | 'mainnet';
}

export const authCommand = new Command('auth');

authCommand
    .command('login')
    .description('Authenticate with RelayCore')
    .action(async () => {
        console.log(chalk.bold.cyan('\n🔐 RelayCore Authentication\n'));

        const answers = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: 'Enter your RelayCore API key:',
                validate: (input) => {
                    if (!input.startsWith('rk_')) {
                        return 'API key must start with rk_';
                    }
                    return true;
                },
            },
            {
                type: 'list',
                name: 'environment',
                message: 'Select environment:',
                choices: ['testnet', 'mainnet'],
                default: 'testnet',
            },
        ]);

        const spinner = ora('Validating API key...').start();

        try {
            // TODO: Validate API key against RelayCore API
            const baseUrl = answers.environment === 'testnet'
                ? 'https://api-testnet.relaycore.io'
                : 'https://api.relaycore.io';

            const config: Config = {
                apiKey: answers.apiKey,
                baseUrl,
                environment: answers.environment,
            };

            await fs.ensureDir(CONFIG_DIR);
            await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });

            spinner.succeed('Authentication successful');
            console.log(chalk.green(`\n✅ Logged in to ${answers.environment}\n`));

        } catch (error) {
            spinner.fail('Authentication failed');
            console.error(chalk.red(error));
            process.exit(1);
        }
    });

authCommand
    .command('status')
    .description('Show authentication status')
    .action(async () => {
        try {
            const config = await loadConfig();
            console.log(chalk.cyan('\n📋 Authentication Status\n'));
            console.log(chalk.white(`Environment: ${config.environment}`));
            console.log(chalk.white(`API Key: ${config.apiKey.substring(0, 10)}...`));
            console.log(chalk.white(`Base URL: ${config.baseUrl}\n`));
        } catch (error) {
            console.log(chalk.yellow('\n⚠️  Not authenticated. Run `relaycore auth login`\n'));
        }
    });

authCommand
    .command('logout')
    .description('Log out from RelayCore')
    .action(async () => {
        try {
            await fs.remove(CONFIG_FILE);
            console.log(chalk.green('\n✅ Logged out successfully\n'));
        } catch (error) {
            console.error(chalk.red('Failed to logout'));
        }
    });

export async function loadConfig(): Promise<Config> {
    if (!await fs.pathExists(CONFIG_FILE)) {
        throw new Error('Not authenticated. Run `relaycore auth login`');
    }
    return await fs.readJson(CONFIG_FILE);
}
