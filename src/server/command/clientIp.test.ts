import { describe, expect, it } from "vitest";
import { clientIdFromAddress, resolveClientId } from "./clientIp";

describe("clientIdFromAddress", () => {
  it("keeps an IPv4 address", () => {
    expect(clientIdFromAddress(" 203.0.113.7 ")).toBe("203.0.113.7");
  });

  it("turns an IPv4-mapped IPv6 address into IPv4", () => {
    expect(clientIdFromAddress("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(clientIdFromAddress("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("reduces IPv6 to its /64 prefix, so rotating the lower bits changes nothing", () => {
    const first = clientIdFromAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    const second = clientIdFromAddress("2001:0db8:0001:0002::1");

    expect(first).toBe("2001:0db8:0001:0002::/64");
    expect(second).toBe(first);
  });

  it("separates different /64 prefixes", () => {
    expect(clientIdFromAddress("2001:db8:1:2::1")).not.toBe(
      clientIdFromAddress("2001:db8:1:3::1"),
    );
  });

  it("expands a compressed prefix", () => {
    expect(clientIdFromAddress("2001:db8::1")).toBe("2001:0db8:0000:0000::/64");
    expect(clientIdFromAddress("::1")).toBe("0000:0000:0000:0000::/64");
  });

  it.each(["", "not an ip", "999.1.1.1", "1.2.3", "203.0.113.7, 10.0.0.1"])(
    "rejects %j",
    (value) => {
      expect(clientIdFromAddress(value)).toBeNull();
    },
  );
});

describe("resolveClientId", () => {
  it("AC-19: reads only the named header and ignores x-forwarded-for", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.9",
    });

    expect(resolveClientId(headers, "x-real-ip")).toBe("203.0.113.7");
  });

  it("AC-19: a missing named header is not replaced by another one", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.9" });

    expect(resolveClientId(headers, "x-real-ip")).toBeNull();
  });

  it("rejects a named header that does not hold an IP", () => {
    const headers = new Headers({ "x-real-ip": "evil" });

    expect(resolveClientId(headers, "x-real-ip")).toBeNull();
  });

  it("uses the first x-forwarded-for entry when no header is named (development)", () => {
    const headers = new Headers({ "x-forwarded-for": "::1, 10.0.0.1" });

    expect(resolveClientId(headers, undefined)).toBe(
      "0000:0000:0000:0000::/64",
    );
  });

  it("finds no client without any header", () => {
    expect(resolveClientId(new Headers(), undefined)).toBeNull();
  });
});
