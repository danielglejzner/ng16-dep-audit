#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const semver = require("semver");

function colorize(text, color) {
  const colors = {
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    reset: "\x1b[0m",
  };
  return `${colors[color]}${text}${colors.reset}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpGetWithRetry(url, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        https
          .get(url, (resp) => {
            let data = "";
            if (resp.statusCode === 404) {
              resolve(null); // Ignore 404 errors and resolve as null
              return;
            } else if (
              resp.statusCode === 429 ||
              resp.statusCode < 200 ||
              resp.statusCode > 299
            ) {
              let error =
                resp.statusCode === 429
                  ? "Rate limit exceeded"
                  : `HTTP status code ${resp.statusCode}`;
              if (attempt < retries) {
                reject(error);
              } else {
                // Last attempt, but we ignore 404, so only reject if it's not 404.
                reject(error);
              }
            } else {
              resp.on("data", (chunk) => {
                data += chunk;
              });
              resp.on("end", () => {
                resolve(JSON.parse(data));
              });
            }
          })
          .on("error", (err) => {
            reject("Error: " + err.message);
          });
      });
    } catch (error) {
      if (attempt < retries) {
        console.log(
          `Attempt ${attempt} failed for ${url}. Error: ${error}. Retrying in ${delayMs}ms...`,
        );
        await delay(delayMs * Math.pow(2, attempt - 1)); // Exponential backoff
      } else if (error !== "HTTP status code 404") {
        // Log error after all retries (except for 404s)
        console.error(`Failed to fetch ${url} after ${retries} attempts.`);
      }
    }
  }
}

function updateProgressBar(processedPackages, totalPackages) {
  process.stdout.write("\x1B[2J\x1B[0f");
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(
    `Processing: [${"#".repeat(processedPackages)}${".".repeat(totalPackages - processedPackages)}]`,
  );
}

async function checkAngularCompatibility(
  packageName,
  dependenciesToCheck,
  totalPackages,
  currentVersion,
) {
  const prefixesToUpgrade = ["@swimlane/ngx"]; // Extendable list of package name prefixes

  // Check if the packageName starts with any of the prefixes in prefixesToUpgrade
  const shouldUpgrade = prefixesToUpgrade.some((prefix) =>
    packageName.startsWith(prefix),
  );
  if (shouldUpgrade) {
    dependenciesToCheck.mayNeedUpgrade.push({
      packageName,
      currentVersion,
      latestVersion: "unknown",
    });
    return;
  }

  const url = `https://registry.npmjs.org/${packageName}/latest`;
  try {
    const packageInfo = await httpGetWithRetry(url);
    const latestVersion = packageInfo.version;
    console.log(colorize(`${packageName}:`, "yellow"));
    console.log(colorize(`Current version: ${currentVersion}`, "green"));
    console.log(colorize(`Latest version: ${latestVersion}`, "blue"));

    const allDependencies = {
      ...packageInfo.dependencies,
      ...packageInfo.devDependencies,
      ...packageInfo.peerDependencies,
    };
    const hasAngularCoreDependency = "@angular/core" in allDependencies;

    if (hasAngularCoreDependency) {
      const angularCoreVersion = allDependencies["@angular/core"];
      if (
        angularCoreVersion &&
        semver.lte(semver.minVersion(angularCoreVersion), "12.0.0")
      ) {
        dependenciesToCheck.reviewForRemoval.push({
          packageName,
          currentVersion,
          latestVersion,
        });
      } else {
        dependenciesToCheck.mayNeedUpgrade.push({
          packageName,
          currentVersion,
          latestVersion,
        });
      }
    } else {
      dependenciesToCheck.unknown.push(packageName);
    }
  } catch (error) {
    console.error(
      colorize(`Could not fetch data for package: ${packageName}`, "red"),
      error,
    );
  }
}

async function getDependenciesAndCheckCompatibility() {
  const packageJsonPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    console.error(
      colorize("No package.json found in the current directory", "red"),
    );
    return;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const dependencies = packageJson.dependencies || {};
  const totalPackages = Object.keys(dependencies).length;

  let dependenciesToCheck = {
    mayNeedUpgrade: [],
    reviewForRemoval: [],
    unknown: [],
    processedPackages: 0,
  };

  updateProgressBar(dependenciesToCheck.processedPackages, totalPackages);

  const promises = Object.keys(dependencies).map((packageName) =>
    checkAngularCompatibility(
      packageName,
      dependenciesToCheck,
      totalPackages,
      dependencies[packageName],
    )
      .then(() => {
        dependenciesToCheck.processedPackages++;
        if (
          dependenciesToCheck.processedPackages % 5 === 0 ||
          dependenciesToCheck.processedPackages === totalPackages
        ) {
          updateProgressBar(
            dependenciesToCheck.processedPackages,
            totalPackages,
          );
        }
      })
      .catch((error) =>
        console.error(
          colorize(`Could not fetch data for package: ${packageName}`, "red"),
          error,
        ),
      ),
  );

  await Promise.all(promises);

  updateProgressBar(dependenciesToCheck.processedPackages, totalPackages);
  console.log("\n\n");

  console.log(
    colorize(
      "\nDependencies without @angular/core or dependencies visible in NPM registry:",
      "yellow",
    ),
  );
  dependenciesToCheck.unknown.forEach((dep) =>
    console.log(colorize(`- ${dep}`, "yellow")),
  );

  console.log("\n\n");

  console.log(
    colorize(
      "Dependencies that are maintained but may need upgrading:",
      "green",
    ),
  );
  dependenciesToCheck.mayNeedUpgrade.forEach(
    ({ packageName, currentVersion, latestVersion }) => {
      console.log(
        `- ${colorize(packageName, "green")}\n (current: ${colorize(currentVersion, "yellow")}, latest: ${colorize(latestVersion, "blue")})\n`,
      );
    },
  );

  console.log(
    colorize("\nDependencies to review for removal or replacement:", "red"),
  );
  dependenciesToCheck.reviewForRemoval.forEach(
    ({ packageName, currentVersion, latestVersion }) => {
      console.log(
        `- ${colorize(packageName, "red")}\n (current: ${colorize(currentVersion, "yellow")}, latest: ${colorize(latestVersion, "blue")})\n`,
      );
    },
  );
}

getDependenciesAndCheckCompatibility();
