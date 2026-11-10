import { isIP } from "node:net";

const IPV6_GROUPS = 8;

/** Eight 16-bit groups as lower-case hex strings, from a canonical (URL-normalised) address. */
function ipv6Groups(address: string): string[] | null {
  let canonical: string;
  try {
    canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  } catch {
    return null;
  }
  const [head = "", tail] = canonical.split("::");
  const headGroups = head ? head.split(":") : [];
  if (tail === undefined) return headGroups;
  const tailGroups = tail ? tail.split(":") : [];
  const zeros = Array<string>(
    IPV6_GROUPS - headGroups.length - tailGroups.length,
  ).fill("0");
  return [...headGroups, ...zeros, ...tailGroups];
}

function ipv4FromMapped(groups: string[]): string | null {
  const isMapped =
    groups.slice(0, 5).every((group) => Number.parseInt(group, 16) === 0) &&
    groups[5] === "ffff";
  if (!isMapped) return null;
  const high = Number.parseInt(groups[6] ?? "", 16);
  const low = Number.parseInt(groups[7] ?? "", 16);
  return [high >> 8, high & 255, low >> 8, low & 255].join(".");
}

/**
 * The identity used for the limits: an IPv4 address, or the /64 prefix of an IPv6 address
 * (one subscriber usually owns a whole /64, so single addresses would be trivial to rotate).
 * Returns null when the value is not an IP address.
 */
export function clientIdFromAddress(raw: string): string | null {
  const address = raw.trim();
  const family = isIP(address);
  if (family === 4) return address;
  if (family !== 6) return null;

  const groups = ipv6Groups(address);
  if (groups?.length !== IPV6_GROUPS) return null;
  const mapped = ipv4FromMapped(groups);
  if (mapped) return mapped;
  return `${groups
    .slice(0, 4)
    .map((group) => group.padStart(4, "0"))
    .join(":")}::/64`;
}

/**
 * Reads the client address only from the header the operator named (their proxy always
 * overwrites it). Without a named header (development only) the `x-forwarded-for` value that
 * Next fills in from the socket is used; its first entry is the client.
 */
export function resolveClientId(
  headers: Headers,
  trustedHeader: string | undefined,
): string | null {
  if (trustedHeader) {
    return clientIdFromAddress(headers.get(trustedHeader) ?? "");
  }
  const forwarded = headers.get("x-forwarded-for") ?? "";
  return clientIdFromAddress(forwarded.split(",")[0] ?? "");
}
