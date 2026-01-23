#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { authCommand } from './commands/auth.js';
import { agentCommand } from './commands/agent.js';
import { serviceCommand } from './commands/service.js';
import { devCommand } from './commands/dev.js';

const program = new Command();

program
    .name('relaycore')
    .description('RelayCore CLI - Build and deploy AI agents on Bitcoin')
    .version('0.1.0');

program
    .command('init [project-name]')
    .description('Initialize a new RelayCore project')
    .action(initCommand);

program.addCommand(authCommand);
program.addCommand(agentCommand);
program.addCommand(serviceCommand);

program
    .command('dev')
    .description('Start development environment')
    .option('-p, --port <port>', 'Port for development server', '3000')
    .action(devCommand);

program.parse();
