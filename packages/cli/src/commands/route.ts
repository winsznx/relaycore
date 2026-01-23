/**
 * Route Command - API Route Proxy Management
 * 
 * Create x402-protected proxy routes for any API endpoint.
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig } from './auth.js';

export const routeCommand = new Command('route');

routeCommand
    .command('add')
    .description('Create a new x402-protected route')
    .option('-u, --url <url>', 'Upstream API URL to proxy')
    .option('-m, --method <method>', 'HTTP method (GET, POST, PUT, DELETE)', 'GET')
    .option('-p, --price <price>', 'Price per call in USDC', '0.01')
    .option('-n, --name <name>', 'Display name for the route')
    .option('--pay-to <address>', 'Wallet address to receive payments')
    .action(async (options) => {
        console.log(chalk.bold.cyan('\n  Route Proxy Setup\n'));

        try {
            const config = await loadConfig();

            let url = options.url;
            let method = options.method;
            let price = options.price;
            let name = options.name;
            let payTo = options.payTo;

            if (!url || !name) {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'name',
                        message: 'Route name:',
                        when: !name,
                        validate: (input) => input.length > 0 || 'Name is required'
                    },
                    {
                        type: 'input',
                        name: 'url',
                        message: 'Upstream API URL:',
                        when: !url,
                        validate: (input) => {
                            try {
                                new URL(input);
                                return true;
                            } catch {
                                return 'Please enter a valid URL';
                            }
                        }
                    },
                    {
                        type: 'list',
                        name: 'method',
                        message: 'HTTP Method:',
                        choices: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
                        when: !method || method === 'GET',
                        default: 'GET'
                    },
                    {
                        type: 'input',
                        name: 'price',
                        message: 'Price per call (USDC):',
                        when: !price || price === '0.01',
                        default: '0.01',
                        validate: (input) => !isNaN(parseFloat(input)) || 'Please enter a valid number'
                    }
                ]);

                url = url || answers.url;
                method = answers.method || method;
                price = answers.price || price;
                name = name || answers.name;
            }

            const spinner = ora('Creating route...').start();

            const response = await fetch(`${config.baseUrl}/api/routes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey
                },
                body: JSON.stringify({
                    name,
                    upstreamUrl: url,
                    method: method.toUpperCase(),
                    priceUsdc: price,
                    payTo: payTo
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create route');
            }

            const route = await response.json();

            spinner.succeed('Route created');

            console.log(chalk.green('\n  Route Created Successfully\n'));
            console.log(chalk.white(`  Route ID:    ${route.id}`));
            console.log(chalk.white(`  Name:        ${route.name}`));
            console.log(chalk.white(`  Method:      ${route.method}`));
            console.log(chalk.white(`  Price:       $${route.priceUsdc} USDC`));
            console.log(chalk.cyan(`\n  Proxy URL:   ${route.proxyUrl}\n`));
            console.log(chalk.gray('  Requests to the proxy URL will require x402 payment.\n'));

        } catch (error: any) {
            console.error(chalk.red('\nError: ' + (error.message || error)));
            process.exit(1);
        }
    });

routeCommand
    .command('list')
    .description('List all your routes')
    .action(async () => {
        console.log(chalk.bold.cyan('\n  Your Routes\n'));

        try {
            const config = await loadConfig();
            const spinner = ora('Fetching routes...').start();

            const response = await fetch(`${config.baseUrl}/api/routes`, {
                headers: {
                    'x-api-key': config.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch routes');
            }

            const data = await response.json();
            spinner.stop();

            if (!data.routes || data.routes.length === 0) {
                console.log(chalk.yellow('  No routes found. Create one with `relaycore route add`\n'));
                return;
            }

            console.log(chalk.white(`  Found ${data.routes.length} route(s):\n`));

            for (const route of data.routes) {
                console.log(chalk.cyan(`  ${route.name}`));
                console.log(chalk.gray(`    ID:       ${route.id}`));
                console.log(chalk.gray(`    Method:   ${route.method}`));
                console.log(chalk.gray(`    Price:    $${route.priceUsdc} USDC`));
                console.log(chalk.gray(`    Proxy:    ${route.proxyUrl}`));
                console.log(chalk.gray(`    Requests: ${route.requestCount || 0}`));
                console.log(chalk.gray(`    Revenue:  $${route.revenue || '0.00'} USDC`));
                console.log('');
            }

        } catch (error: any) {
            console.error(chalk.red('\nError: ' + (error.message || error)));
            process.exit(1);
        }
    });

routeCommand
    .command('remove <routeId>')
    .description('Remove a route')
    .action(async (routeId) => {
        console.log(chalk.bold.cyan('\n  Remove Route\n'));

        try {
            const config = await loadConfig();

            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to remove route ${routeId}?`,
                    default: false
                }
            ]);

            if (!confirm) {
                console.log(chalk.yellow('\n  Cancelled\n'));
                return;
            }

            const spinner = ora('Removing route...').start();

            const response = await fetch(`${config.baseUrl}/api/routes/${routeId}`, {
                method: 'DELETE',
                headers: {
                    'x-api-key': config.apiKey
                }
            });

            if (!response.ok) {
                throw new Error('Failed to remove route');
            }

            spinner.succeed('Route removed');
            console.log(chalk.green('\n  Route removed successfully\n'));

        } catch (error: any) {
            console.error(chalk.red('\nError: ' + (error.message || error)));
            process.exit(1);
        }
    });

routeCommand
    .command('test <routeId>')
    .description('Test a route (shows payment requirements)')
    .action(async (routeId) => {
        console.log(chalk.bold.cyan('\n  Test Route\n'));

        try {
            const config = await loadConfig();
            const spinner = ora('Testing route...').start();

            const response = await fetch(`${config.baseUrl}/proxy/${routeId}`, {
                method: 'GET'
            });

            spinner.stop();

            if (response.status === 402) {
                const requirements = await response.json();
                console.log(chalk.yellow('  Payment Required (402)\n'));
                console.log(chalk.white('  Payment Requirements:'));
                console.log(chalk.gray(`    Network:  ${requirements.paymentRequirements?.network}`));
                console.log(chalk.gray(`    Amount:   ${requirements.paymentRequirements?.maxAmountRequired} base units`));
                console.log(chalk.gray(`    Pay To:   ${requirements.paymentRequirements?.payTo}`));
                console.log(chalk.gray(`    Asset:    ${requirements.paymentRequirements?.asset}`));
                console.log('');
            } else if (response.ok) {
                console.log(chalk.green('  Route is accessible (no payment required)\n'));
            } else {
                console.log(chalk.red(`  Route returned ${response.status}\n`));
            }

        } catch (error: any) {
            console.error(chalk.red('\nError: ' + (error.message || error)));
            process.exit(1);
        }
    });
