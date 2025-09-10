#!/usr/bin/env node

/**
 * Test All Services Script for QuantumMint Platform
 * This script runs all tests for backend services and frontend
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Function to print colored output
function printStatus(message) {
    console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
}

function printSuccess(message) {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`);
}

function printWarning(message) {
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`);
}

function printError(message) {
    console.log(`${colors.red}[ERROR]${colors.reset} ${message}`);
}

// Function to run a command and return a promise
function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'pipe',
            shell: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({ code, stdout, stderr });
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

// Function to run tests for a service
async function runServiceTests(serviceName, servicePath, showOutput = false) {
    printStatus(`Testing ${serviceName}...`);
    
    if (!fs.existsSync(servicePath)) {
        printWarning(`${serviceName} directory not found, skipping...`);
        return true;
    }
    
    const packageJsonPath = path.join(servicePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        printWarning(`${serviceName} package.json not found, skipping...`);
        return true;
    }
    
    // Check if dependencies are installed
    const nodeModulesPath = path.join(servicePath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
        printStatus(`Installing dependencies for ${serviceName}...`);
        try {
            const installResult = await runCommand('npm', ['install'], servicePath);
            if (installResult.code !== 0) {
                printError(`Failed to install dependencies for ${serviceName}`);
                if (showOutput) {
                    console.log(installResult.stderr);
                }
                return false;
            }
        } catch (error) {
            printError(`Failed to install dependencies for ${serviceName}: ${error.message}`);
            return false;
        }
    }
    
    // Run tests
    try {
        const testResult = await runCommand('npm', ['test'], servicePath);
        if (testResult.code === 0) {
            printSuccess(`${serviceName} tests passed ✅`);
            return true;
        } else {
            printError(`${serviceName} tests failed ❌`);
            if (showOutput) {
                console.log(testResult.stdout);
                console.log(testResult.stderr);
            }
            return false;
        }
    } catch (error) {
        printError(`Failed to run tests for ${serviceName}: ${error.message}`);
        return false;
    }
}

// Function to generate coverage reports
async function generateCoverageReports(projectRoot) {
    printStatus('Generating coverage reports...');
    console.log('------------------------------');
    
    const services = [
        'api-gateway',
        'auth-service', 
        'transaction-service',
        'payment-integration',
        'kyc-service',
        'money-generation',
        'domain-controller',
        'mail-server'
    ];
    
    // Run coverage for each service
    for (const service of services) {
        const servicePath = path.join(projectRoot, service);
        if (fs.existsSync(servicePath)) {
            printStatus(`Generating coverage for ${service}...`);
            try {
                await runCommand('npm', ['run', 'test:coverage'], servicePath);
            } catch (error) {
                printWarning(`Coverage generation failed for ${service}`);
            }
        }
    }
    
    // Frontend coverage
    const frontendPath = path.join(projectRoot, 'frontend');
    if (fs.existsSync(frontendPath)) {
        printStatus('Generating coverage for frontend...');
        try {
            await runCommand('npm', ['run', 'test:coverage'], frontendPath);
        } catch (error) {
            printWarning('Coverage generation failed for frontend');
        }
    }
}

// Main function
async function main() {
    console.log('🧪 Running QuantumMint Platform Tests');
    console.log('====================================');
    
    const args = process.argv.slice(2);
    const showOutput = args.includes('--verbose') || args.includes('-v');
    const generateCoverage = args.includes('--coverage');
    
    // Get project root
    const scriptDir = __dirname;
    const projectRoot = path.dirname(scriptDir);
    
    console.log(`Project root: ${projectRoot}`);
    console.log('');
    
    let testFailures = 0;
    const testResults = {};
    
    // Test backend services
    printStatus('Testing Backend Services...');
    console.log('----------------------------');
    
    const services = [
        { name: 'API Gateway', path: path.join(projectRoot, 'api-gateway') },
        { name: 'Auth Service', path: path.join(projectRoot, 'auth-service') },
        { name: 'Transaction Service', path: path.join(projectRoot, 'transaction-service') },
        { name: 'Payment Integration', path: path.join(projectRoot, 'payment-integration') },
        { name: 'KYC Service', path: path.join(projectRoot, 'kyc-service') },
        { name: 'Money Generation', path: path.join(projectRoot, 'money-generation') },
        { name: 'Domain Controller', path: path.join(projectRoot, 'domain-controller') },
        { name: 'Mail Server', path: path.join(projectRoot, 'mail-server') }
    ];
    
    for (const service of services) {
        const result = await runServiceTests(service.name, service.path, showOutput);
        testResults[service.name] = result;
        if (!result) {
            testFailures++;
        }
    }
    
    console.log('');
    
    // Test frontend
    printStatus('Testing Frontend...');
    console.log('-------------------');
    
    const frontendResult = await runServiceTests('Frontend', path.join(projectRoot, 'frontend'), showOutput);
    testResults['Frontend'] = frontendResult;
    if (!frontendResult) {
        testFailures++;
    }
    
    console.log('');
    
    // Generate coverage if requested
    if (generateCoverage) {
        await generateCoverageReports(projectRoot);
        console.log('');
    }
    
    // Summary
    console.log('Test Summary');
    console.log('============');
    
    if (testFailures === 0) {
        printSuccess('All tests passed! 🎉');
        console.log('');
        Object.keys(testResults).forEach(service => {
            if (testResults[service]) {
                console.log(`✅ ${service}`);
            }
        });
    } else {
        printError(`${testFailures} test suite(s) failed`);
        console.log('');
        Object.keys(testResults).forEach(service => {
            if (testResults[service]) {
                console.log(`✅ ${service}`);
            } else {
                console.log(`❌ ${service}`);
            }
        });
        process.exit(1);
    }
    
    console.log('');
    printStatus('Test execution completed successfully!');
}

// Run the main function
if (require.main === module) {
    main().catch(error => {
        printError(`Test execution failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { runServiceTests, generateCoverageReports };
