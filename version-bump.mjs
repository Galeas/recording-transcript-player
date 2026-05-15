import fs from "node:fs";
import process from "node:process";

const manifestPath = "manifest.json";
const versionsPath = "versions.json";
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const versions = JSON.parse(fs.readFileSync(versionsPath, "utf8"));

manifest.version = packageJson.version;
versions[packageJson.version] = manifest.minAppVersion;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(versionsPath, `${JSON.stringify(versions, null, 2)}\n`);

process.stdout.write(`Updated manifest and versions to ${packageJson.version}\n`);
