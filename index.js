#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const semver = require('semver');

function colorize(text, color) {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m', 
        reset: '\x1b[0m'
    };
    return `${colors[color]}${text}${colors.reset}`;
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (resp) => {
            let data = '';
            resp.on('data', (chunk) => { data += chunk; });
            resp.on('end', () => { resolve(JSON.parse(data)); });
        }).on("error", (err) => {
            reject("Error: " + err.message);
        });
    });
}

async function checkAngularCompatibility(packageName, dependenciesToCheck, totalPackages, currentVersion) {
    const url = `https://registry.npmjs.org/${packageName}`;
    try {
        const packageInfo = await httpGet(url);

        // Get the latest and last published versions
        const latestVersion = packageInfo['dist-tags'].latest;
        const lastPublishedVersion = Object.keys(packageInfo.time).pop(); // Last key in the time object

        // Display current, latest, and last published versions
        console.log(colorize(`${packageName}:`, 'yellow'));
        console.log(colorize(`Current version: ${currentVersion}`, 'green'));
        console.log(colorize(`Latest version: ${latestVersion}`, 'blue'));
        console.log(colorize(`Last published version: ${lastPublishedVersion}`, 'red'));

        // Combine dependencies and devDependencies
        const allDependencies = {
            ...packageInfo.versions[latestVersion].dependencies,
            ...packageInfo.versions[latestVersion].devDependencies,
            ...packageInfo.versions[latestVersion].peerDependencies
        };

        // Check if any of the combined dependencies include @angular/core
        const hasAngularCoreDependency = '@angular/core' in allDependencies;

        if (hasAngularCoreDependency) {
            // Extract the version of @angular/core listed
            const angularCoreVersion = allDependencies['@angular/core'];

            // Check if the specified version of @angular/core is compatible with Angular 16
            if (angularCoreVersion && semver.satisfies(semver.minVersion(angularCoreVersion), '>=12.0.0')) {
                dependenciesToCheck.mayNeedUpgrade.push({ packageName, currentVersion, latestVersion });
            } else {
                dependenciesToCheck.reviewForRemoval.push({ packageName, currentVersion, latestVersion });
            }
        } else {
            // No @angular/core dependency found
            dependenciesToCheck.unknown.push(packageName);
        }
        process.stdout.write('\x1B[2J\x1B[0f');

        // Update progress bar
        process.stdout.cursorTo(0);
        process.stdout.write(`Processing: [${'#'.repeat(dependenciesToCheck.processedPackages)}${'.'.repeat(totalPackages - dependenciesToCheck.processedPackages)}]`);

        // Output summary
        console.log(colorize('\nSummary:', 'yellow'));
        console.log(`Total dependencies checked: ${totalPackages}`);
        console.log(colorize(`May need upgrading: ${dependenciesToCheck.mayNeedUpgrade.length}`, 'green'));
        console.log(colorize(`Review for removal: ${dependenciesToCheck.reviewForRemoval.length}`, 'red'));
        dependenciesToCheck.reviewForRemoval.forEach(({ packageName}) => {
            console.log(colorize(`- ${packageName}`, 'red'));
        });        console.log(colorize(`Unknown (no @angular/core dependency or dependencies visible in NPM registry): ${dependenciesToCheck.unknown.length}`, 'yellow'));

    } catch (error) {
        console.error(colorize(`Could not fetch data for package: ${packageName}`, 'red'), error);
    } finally {
        dependenciesToCheck.processedPackages++;
    }
}

async function getDependenciesAndCheckCompatibility() {
    const packageJsonPath = path.join(process.cwd(), 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        console.error(colorize('No package.json found in the current directory', 'red'));
        return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = packageJson.dependencies || {};
    const totalPackages = Object.keys(dependencies).length;

    let dependenciesToCheck = {
        mayNeedUpgrade: [],
        reviewForRemoval: [],
        unknown: [],
        processedPackages: 0
    };

    // Output initial progress bar
    process.stdout.write(`Processing: [${'.'.repeat(totalPackages)}]`);

    for (let packageName of Object.keys(dependencies)) {
        await checkAngularCompatibility(packageName, dependenciesToCheck, totalPackages, dependencies[packageName]);
    }

    console.log('\n\n');
    console.log(colorize('Dependencies that are maintained but may need upgrading:', 'green'));
    dependenciesToCheck.mayNeedUpgrade.forEach(({ packageName, currentVersion, latestVersion }) => {
        console.log(`- ${colorize(packageName, 'green')}\n (current: ${colorize(currentVersion, 'yellow')}, latest: ${colorize(latestVersion, 'blue')})\n`);
    });

    console.log(colorize('\nDependencies to review for removal or replacement:', 'red'));
    dependenciesToCheck.reviewForRemoval.forEach(({ packageName, currentVersion, latestVersion}) => {
        console.log(`- ${colorize(packageName, 'red')}\n (current: ${colorize(currentVersion, 'yellow')}, latest: ${colorize(latestVersion, 'blue')})\n`);
    });

    console.log(colorize('\nDependencies without @angular/core or dependencies visible in NPM registry:', 'yellow'));
    dependenciesToCheck.unknown.forEach(dep => console.log(colorize(`- ${dep}`, 'yellow')));
}

getDependenciesAndCheckCompatibility();
