const { execSync } = require("node:child_process");

execSync(`git tag -d v${process.env.npm_package_version}`, { stdio: "inherit" });
