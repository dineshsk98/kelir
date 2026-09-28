"""Midnight engine: when does a birthday capsule go out?

Pure, synchronous date math with no web or database imports, so it can be
tested on its own. Every instant returned is a timezone-aware UTC datetime.

Rules (prd.md > Delivery at the recipient's midnight):
- Delivery is the first instant of the celebration date in the recipient's
  IANA time zone: normally 00:00, or the first valid moment after a daylight
  saving gap that swallows midnight.
- A Feb 29 birthday uses the sender's Feb 28 / Mar 1 choice in non-leap years.
- If the recipient's local date is already their celebration date, the
  birthday has started: send immediately.
- Otherwise it's the next occurrence (this year or next).
"""

from __future__ import annotations

import argparse
import calendar
from datetime import date, datetime, time, timezone
from typing import Literal
from zoneinfo import ZoneInfo

Feb29Pref = Literal["FEB_28", "MAR_1"]
SendMode = Literal["birthday", "now"]

FEB_28: Feb29Pref = "FEB_28"
MAR_1: Feb29Pref = "MAR_1"


def _zone(tz: str | ZoneInfo) -> ZoneInfo:
    return tz if isinstance(tz, ZoneInfo) else ZoneInfo(tz)


def _require_aware(now: datetime) -> datetime:
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(timezone.utc)


def validate_birthday(month: int, day: int, feb29_pref: Feb29Pref | None) -> None:
    """Raise ValueError unless (month, day) exists in some year and a Feb 29
    birthday carries a non-leap-year preference."""
    date(2000, month, day)  # 2000 is a leap year, so Feb 29 is allowed here
    if (month, day) == (2, 29) and feb29_pref not in (FEB_28, MAR_1):
        raise ValueError("a Feb 29 birthday needs feb29_pref FEB_28 or MAR_1")


def celebration_date(
    year: int, month: int, day: int, feb29_pref: Feb29Pref | None = None
) -> date:
    """The date the birthday is celebrated in `year`."""
    validate_birthday(month, day, feb29_pref)
    if (month, day) == (2, 29) and not calendar.isleap(year):
        return date(year, 3, 1) if feb29_pref == MAR_1 else date(year, 2, 28)
    return date(year, month, day)


def start_of_local_day(d: date, tz: str | ZoneInfo) -> datetime:
    """The first instant whose local date in `tz` is `d`, as UTC.

    Local midnight can be missing (a DST gap starting at or spanning 00:00)
    or occur twice (clocks set back across midnight). Try both readings of
    00:00, keep those that really fall on `d`, and take the earliest.
    """
    zone = _zone(tz)
    candidates = []
    for fold in (0, 1):
        instant = datetime.combine(d, time(0), tzinfo=zone).replace(fold=fold)
        utc = instant.astimezone(timezone.utc)
        if utc.astimezone(zone).date() == d:
            candidates.append(utc)
    if not candidates:
        # A zone that skipped the whole day (e.g. Samoa, 2011-12-30); there is no such day
        raise ValueError(f"{d} does not exist in {zone.key}")
    return min(candidates)


def next_delivery(
    month: int,
    day: int,
    feb29_pref: Feb29Pref | None,
    tz: str | ZoneInfo,
    now: datetime,
) -> datetime:
    """When a capsule for this birthday should be delivered, as seen from `now`."""
    zone = _zone(tz)
    now = _require_aware(now)
    local_today = now.astimezone(zone).date()
    for year in (local_today.year, local_today.year + 1):
        day_of = celebration_date(year, month, day, feb29_pref)
        if day_of == local_today:
            return now  # their birthday has already started
        if day_of > local_today:
            return start_of_local_day(day_of, zone)
    raise AssertionError("unreachable: next year's date is always in the future")


def due_now(
    send_mode: SendMode,
    month: int,
    day: int,
    feb29_pref: Feb29Pref | None,
    tz: str | ZoneInfo,
    now: datetime,
) -> datetime:
    """`deliver_at` for a capsule: now for "Send now", else its next birthday."""
    if send_mode == "now":
        validate_birthday(month, day, feb29_pref)
        return _require_aware(now)
    return next_delivery(month, day, feb29_pref, tz, now)


def _main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m app.engine.schedule",
        description="Show when a birthday capsule would be delivered.",
    )
    parser.add_argument("tz", help="IANA time zone, e.g. Asia/Tokyo")
    parser.add_argument("month", type=int)
    parser.add_argument("day", type=int)
    parser.add_argument("--feb29", choices=[FEB_28, MAR_1], default=None)
    parser.add_argument("--now", help="ISO instant to compute from (default: now)")
    args = parser.parse_args()

    now = datetime.fromisoformat(args.now) if args.now else datetime.now(timezone.utc)
    zone = ZoneInfo(args.tz)
    at = next_delivery(args.month, args.day, args.feb29, zone, now)
    local = at.astimezone(zone)
    print(f"now (UTC):        {_require_aware(now):%Y-%m-%d %H:%M:%S %Z}")
    print(f"delivers (UTC):   {at:%Y-%m-%d %H:%M:%S %Z}")
    print(f"delivers ({zone.key}): {local:%Y-%m-%d %H:%M:%S %Z (UTC%z)}")


if __name__ == "__main__":
    _main()
