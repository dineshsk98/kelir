"""Recipient email checks: format rules and the DNS "can this domain receive mail?" lookup."""

from types import SimpleNamespace

import dns.exception
import dns.resolver
import pytest

from app import email_check
from app.email_check import is_valid_format

REAL_LOOKUP = email_check._lookup  # captured before the autouse fake_dns fixture replaces it


@pytest.mark.parametrize(
    "email",
    ["aiko@example.com", "first.last+tag@mail.co.uk", "o'brien@example.ie", "x@sub.domain.travel"],
)
def test_valid_formats(email):
    assert is_valid_format(email)


@pytest.mark.parametrize(
    "email",
    [
        "no-at-sign.com",
        "two@@example.com",
        "space in@example.com",
        "trailing.dot.@example.com",
        "double..dot@example.com",
        "user@nodot",
        "user@example.c",  # TLD too short
        "user@example.123",  # numeric TLD
        "user@-bad.com",
        "user@bad-.com",
        "user@example..com",
        "a" * 65 + "@example.com",  # local part over 64
        "user@" + "a" * 250 + ".com",  # over 254 total
    ],
)
def test_invalid_formats(email):
    assert not is_valid_format(email)


def fake_resolver(monkeypatch, answers):
    """answers: {(domain, rdtype): list | exception class}"""

    async def has_records(domain, rdtype):
        result = answers.get((domain, rdtype), [])
        if isinstance(result, type) and issubclass(result, Exception):
            raise result()
        return result

    monkeypatch.setattr(email_check, "_has_records", has_records)


MX = SimpleNamespace(exchange="mx.example.net.")
NULL_MX = SimpleNamespace(exchange=".")


@pytest.mark.parametrize(
    ("answers", "expected"),
    [
        ({("d.com", "MX"): [MX]}, True),
        ({("d.com", "MX"): [NULL_MX]}, False),  # RFC 7505: accepts no mail
        ({("d.com", "A"): ["192.0.2.1"]}, True),  # no MX: implicit MX via A record
        ({("d.com", "AAAA"): ["2001:db8::1"]}, True),
        ({}, False),  # exists but has no mail or address records
        ({("d.com", "MX"): dns.resolver.NXDOMAIN}, False),  # domain doesn't exist
        ({("d.com", "MX"): dns.exception.Timeout}, None),  # couldn't check: don't block
        ({("d.com", "MX"): dns.resolver.NoNameservers}, None),
    ],
)
async def test_lookup(monkeypatch, answers, expected):
    fake_resolver(monkeypatch, answers)
    assert await REAL_LOOKUP("d.com") is expected


async def test_only_definite_answers_are_cached(monkeypatch):
    calls = []

    async def lookup(domain):
        calls.append(domain)
        return None if domain == "flaky.com" else True

    monkeypatch.setattr(email_check, "_lookup", lookup)
    email_check._cache.clear()
    await email_check.domain_accepts_mail("a@good.com")
    await email_check.domain_accepts_mail("b@GOOD.com")
    await email_check.domain_accepts_mail("a@flaky.com")
    await email_check.domain_accepts_mail("a@flaky.com")
    assert calls == ["good.com", "flaky.com", "flaky.com"]
