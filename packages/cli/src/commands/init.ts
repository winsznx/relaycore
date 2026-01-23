/**
 * Init Command - Scaffold Generator
 * 
 * Creates a new RelayCore agent project from templates.
 * This is the primary entry point for developers.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initCommand(projectName?: string) {
    console.log(chalk.bold.cyan('\n🚀 RelayCore Project Initializer\n'));

    // Prompt for project name if not provided
    if (!projectName) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name:',
                default: 'my-relaycore-agent',
                validate: (input) => {
                    if (!/^[a-z0-9-]+$/.test(input)) {
                        return 'Project name must be lowercase alphanumeric with hyphens';
                    }
                    return true;
                },
            },
        ]);
        projectName = answers.projectName;
    }

    // Ensure projectName is treated as a string after the check
    const projectPath = path.join(process.cwd(), projectName as string);

    // Check if directory exists
    if (await fs.pathExists(projectPath)) {
        console.log(chalk.red(`\n❌ Directory ${projectName} already exists\n`));
        process.exit(1);
    }

    const spinner = ora('Creating project structure...').start();

    try {
        // Create project directory
        await fs.ensureDir(projectPath);

        // Copy templates
        const templatesDir = path.join(__dirname, '../../templates');
        await fs.copy(templatesDir, projectPath);

        // Update package.json with project name
        const packageJsonPath = path.join(projectPath, 'package.json');
        const packageJson = await fs.readJson(packageJsonPath);
        packageJson.name = projectName;
        await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

        spinner.succeed('Project structure created');

        // Install dependencies
        spinner.start('Installing dependencies...');
        await execa('npm', ['install'], { cwd: projectPath });
        spinner.succeed('Dependencies installed');

        // Initialize git
        spinner.start('Initializing git repository...');
        await execa('git', ['init'], { cwd: projectPath });
        await execa('git', ['add', '.'], { cwd: projectPath });
        await execa('git', ['commit', '-m', 'Initial commit from RelayCore CLI'], { cwd: projectPath });
        spinner.succeed('Git repository initialized');

        // Success message
        console.log(chalk.green.bold('\n✅ Project created successfully!\n'));
        console.log(chalk.cyan('Next steps:\n'));
        console.log(chalk.white(`  cd ${projectName}`));
        console.log(chalk.white('  # Add your RelayCore API key to .env'));
        console.log(chalk.white('  relaycore dev\n'));

    } catch (error) {
        spinner.fail('Failed to create project');
        console.error(chalk.red(error));
        process.exit(1);
    }
}
