const isPrivateHost = (hostname: string) => {
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

export function requireServiceUrl(name: string, value: string | undefined) {
  const configured = value?.trim();
  if (!configured) {
    throw new Error(`${name} is required.`);
  }

  if (!__DEV__) {
    let parsed: URL;
    try {
      parsed = new URL(configured);
    } catch {
      throw new Error(`${name} must be a valid public HTTPS URL.`);
    }

    if (parsed.protocol !== "https:" || isPrivateHost(parsed.hostname)) {
      throw new Error(`${name} must be a valid public HTTPS URL.`);
    }
  }

  return configured;
}
