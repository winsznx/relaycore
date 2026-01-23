/**
 * Dev Command - Development Environment Orchestration
 * 
 * Starts agent server + Next.js frontend with live reloading.
 */

import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import concurrently from 'concurrently';
import path from 'path';
import fs from 'fs-extra';

export async function devCommand(options: { port: string }) {
    console.log(chalk.bold.cyan('\n🚀 Starting RelayCore Development Environment\n'));

    // Check if we're in a RelayCore project
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!await fs.pathExists(packageJsonPath)) {
        console.log(chalk.red('❌ Not in a RelayCore project directory\n'));
        process.exit(1);
    }

    const spinner = ora('Checking configuration...').start();

    // Check for .env file
    const envPath = path.join(process.cwd(), '.env');
    if (!await fs.pathExists(envPath)) {
        spinner.warn('.env file not found');
        console.log(chalk.yellow('\n⚠️  Create a .env file with your RELAYCORE_API_KEY\n'));
        process.exit(1);
    }

    spinner.succeed('Configuration valid');

    console.log(chalk.cyan('\n📦 Starting services...\n'));

    try {
        // Run agent server + frontend concurrently
        const { result } = concurrently([
            {
                command: 'npm run dev --workspace=apps/agent-server',
                name: 'agent',
                prefixColor: 'blue',
            },
            {
                command: 'npm run dev --workspace=apps/web',
                name: 'web',
                prefixColor: 'magenta',
            },
        ], {
            prefix: 'name',
            killOthers: ['failure', 'success'],
            restartTries: 3,
        });

        await result;

    } catch (error) {
        console.error(chalk.red('\n❌ Development server failed\n'));
        process.exit(1);
    }
}
