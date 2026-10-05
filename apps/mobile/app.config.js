/* eslint-env node */
const RELEASE_PROFILES = new Set(["production", "production-apk", "release-apk"]);
const DEVELOPMENT_VARIANT = "development";

const isPrivateHost = (hostname) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::" ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host)
  ) {
    return true;
  }

  const match172 = host.match(/^172\.(\d{1,3})\./);
  if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) {
    return true;
  }

  const match100 = host.match(/^100\.(\d{1,3})\./);
  return Boolean(match100 && Number(match100[1]) >= 64 && Number(match100[1]) <= 127);
};

const isPublicHttpsUrl = (value) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
};

export default ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || "";
  const isRelease = RELEASE_PROFILES.has(profile);
  const isDevelopmentVariant =
    process.env.APP_VARIANT?.trim().toLowerCase() === DEVELOPMENT_VARIANT;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

  if (isDevelopmentVariant) {
    config.name = "CampusX Dev";
    config.scheme = "campusx-dev";
    config.android = config.android || {};
    config.android.package = "com.campusx.mobile.dev";

    // The production Firebase client is registered only for com.campusx.mobile.
    // Timetable development does not require remote push registration, so never
    // copy that incompatible client into the side-by-side development app.
    delete config.android.googleServicesFile;
  }

  if (isRelease && !isPublicHttpsUrl(apiUrl)) {
    throw new Error(
      `${profile} requires EXPO_PUBLIC_API_URL to be a public HTTPS URL.`,
    );
  }

  if (isRelease && !isPublicHttpsUrl(socketUrl)) {
    throw new Error(
      `${profile} requires EXPO_PUBLIC_SOCKET_URL to be a public HTTPS URL.`,
    );
  }

  const allowDevelopmentCleartext =
    isDevelopmentVariant ||
    (!isRelease &&
      [apiUrl, socketUrl].some((value) => value?.startsWith("http://")));

  config.plugins = config.plugins || [];
  let buildProperties = config.plugins.find(
    (plugin) =>
      Array.isArray(plugin) && plugin[0] === "expo-build-properties",
  );

  if (!buildProperties) {
    buildProperties = ["expo-build-properties", {}];
    config.plugins.push(buildProperties);
  }

  buildProperties[1] = buildProperties[1] || {};
  buildProperties[1].android = buildProperties[1].android || {};
  buildProperties[1].android.usesCleartextTraffic =
    allowDevelopmentCleartext;

  config.android = config.android || {};
  if (config.android.usesCleartextTraffic !== undefined) {
    delete config.android.usesCleartextTraffic;
  }

  // Sync native applicationId to match variant for Expo CLI resolution
  try {
    const fs = require("fs");
    const path = require("path");
    // eslint-disable-next-line no-undef
    const buildGradlePath = path.join(__dirname, "android", "app", "build.gradle");
    if (fs.existsSync(buildGradlePath)) {
      let buildGradle = fs.readFileSync(buildGradlePath, "utf8");
      const targetPackage = isDevelopmentVariant ? "com.campusx.mobile.dev" : "com.campusx.mobile";
      const newBuildGradle = buildGradle.replace(/applicationId ['"].*['"]/, `applicationId '${targetPackage}'`);
      if (newBuildGradle !== buildGradle) {
        fs.writeFileSync(buildGradlePath, newBuildGradle, "utf8");
      }
    }
  } catch (e) {
    // ignore
  }

  return config;
};
