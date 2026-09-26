const RELEASE_PROFILES = new Set(["production", "production-apk", "release-apk"]);

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
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL?.trim();

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
    !isRelease &&
    [apiUrl, socketUrl].some((value) => value?.startsWith("http://"));

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

  return config;
};
