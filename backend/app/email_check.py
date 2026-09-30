"""Recipient email checks: a strict-enough format rule and a DNS lookup that the
domain can actually receive mail."""

import re
import time

import dns.asyncresolver
import dns.exception
import dns.resolver

# Practical address format: dot-atom local part, dotted domain labels, alphabetic TLD.
EMAIL_RE = re.compile(
    r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
    r"@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$"
)

DNS_TIMEOUT_SECONDS = 3.0
_CACHE_SECONDS = 600
_cache: dict[str, tuple[float, bool | None]] = {}


def is_valid_format(email: str) -> bool:
    if len(email) > 254 or not EMAIL_RE.match(email):
        return False
    return len(email.split("@", 1)[0]) <= 64


async def _has_records(domain: str, rdtype: str) -> list:
    resolver = dns.asyncresolver.Resolver()
    resolver.lifetime = DNS_TIMEOUT_SECONDS
    try:
        return list(await resolver.resolve(domain, rdtype))
    except dns.resolver.NoAnswer:
        return []


async def _lookup(domain: str) -> bool | None:
    try:
        mx = await _has_records(domain, "MX")
        if mx:
            # A "null MX" (RFC 7505: priority 0, target ".") means the domain accepts no mail
            return not all(str(r.exchange) == "." for r in mx)
        # No MX: mail falls back to the domain's own address (RFC 5321 implicit MX)
        return bool(await _has_records(domain, "A") or await _has_records(domain, "AAAA"))
    except dns.resolver.NXDOMAIN:
        return False  # the domain doesn't exist
    except (dns.exception.Timeout, dns.resolver.NoNameservers, dns.exception.DNSException):
        return None  # couldn't check (offline, DNS trouble): don't block the sender


async def domain_accepts_mail(email: str) -> bool | None:
    """True if the email's domain can receive mail, False if it definitely can't,
    None if DNS couldn't be checked right now."""
    domain = email.rsplit("@", 1)[-1].lower().rstrip(".")
    cached = _cache.get(domain)
    if cached and time.monotonic() - cached[0] < _CACHE_SECONDS:
        return cached[1]
    result = await _lookup(domain)
    if result is not None:  # only remember definite answers
        _cache[domain] = (time.monotonic(), result)
    return result
