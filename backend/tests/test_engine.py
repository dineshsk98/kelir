"""Time-zone matrix for the midnight engine (pure, no database)."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.engine.schedule import (
    FEB_28,
    MAR_1,
    celebration_date,
    due_now,
    next_delivery,
    start_of_local_day,
)


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=timezone.utc)


NEW_YEAR_2027 = utc(2027, 1, 1)


@pytest.mark.parametrize(
    ("tz", "month", "day", "expected"),
    [
        # Whole-hour, half-hour and 45-minute offsets
        ("Asia/Tokyo", 3, 14, utc(2027, 3, 13, 15, 0)),
        ("Asia/Kolkata", 3, 14, utc(2027, 3, 13, 18, 30)),
        ("Asia/Kathmandu", 3, 14, utc(2027, 3, 13, 18, 15)),
        ("Australia/Eucla", 3, 14, utc(2027, 3, 13, 15, 15)),  # +8:45
        ("America/St_Johns", 7, 4, utc(2027, 7, 4, 2, 30)),  # -2:30 in summer
        ("UTC", 3, 14, utc(2027, 3, 14)),
        # US daylight saving: starts Sun 14 Mar 2027 02:00, ends Sun 7 Nov 2027 02:00
        ("America/New_York", 3, 13, utc(2027, 3, 13, 5, 0)),  # EST
        ("America/New_York", 3, 14, utc(2027, 3, 14, 5, 0)),  # midnight still EST
        ("America/New_York", 3, 15, utc(2027, 3, 15, 4, 0)),  # EDT
        ("America/New_York", 11, 7, utc(2027, 11, 7, 4, 0)),  # midnight still EDT
        ("America/New_York", 11, 8, utc(2027, 11, 8, 5, 0)),  # EST again
        # EU daylight saving: starts Sun 28 Mar 2027 01:00 UTC
        ("Europe/Berlin", 3, 28, utc(2027, 3, 27, 23, 0)),  # CET
        ("Europe/Berlin", 3, 29, utc(2027, 3, 28, 22, 0)),  # CEST
        # Southern hemisphere: Sydney is on DST in January, not in July
        ("Australia/Sydney", 1, 10, utc(2027, 1, 9, 13, 0)),  # AEDT +11
        ("Australia/Sydney", 7, 10, utc(2027, 7, 9, 14, 0)),  # AEST +10
    ],
)
def test_delivers_at_recipients_local_midnight(tz, month, day, expected):
    at = next_delivery(month, day, None, tz, NEW_YEAR_2027)
    assert at == expected
    local = at.astimezone(ZoneInfo(tz))
    assert (local.month, local.day, local.hour, local.minute) == (month, day, 0, 0)


@pytest.mark.parametrize(
    ("tz", "d", "expected_local_hour"),
    [
        # Cuba springs forward at 00:00 -> 01:00 on the second Sunday of March
        ("America/Havana", date(2027, 3, 14), 1),
        # Chile springs forward at 24:00 Saturday -> 01:00 Sunday in September
        ("America/Santiago", date(2027, 9, 5), 1),
    ],
)
def test_dst_gap_at_midnight_uses_first_valid_instant(tz, d, expected_local_hour):
    zone = ZoneInfo(tz)
    at = start_of_local_day(d, zone)
    local = at.astimezone(zone)
    assert local.date() == d
    assert (local.hour, local.minute) == (expected_local_hour, 0)
    # One second earlier is still the previous day: nothing on `d` comes before it
    assert (at - timedelta(seconds=1)).astimezone(zone).date() == d - timedelta(days=1)


def test_havana_gap_exact_instant():
    # 01:00 CDT (UTC-4) on 14 Mar 2027
    assert start_of_local_day(date(2027, 3, 14), "America/Havana") == utc(2027, 3, 14, 5, 0)


def test_midnight_that_happens_twice_uses_the_first():
    # Cuba falls back 01:00 CDT -> 00:00 CST on Sun 7 Nov 2027, so 00:xx occurs twice.
    zone = ZoneInfo("America/Havana")
    at = start_of_local_day(date(2027, 11, 7), zone)
    assert at == utc(2027, 11, 7, 4, 0)  # 00:00 CDT, the earlier occurrence
    assert (at - timedelta(seconds=1)).astimezone(zone).date() == date(2027, 11, 6)


@pytest.mark.parametrize(
    ("year", "pref", "expected"),
    [
        (2027, FEB_28, date(2027, 2, 28)),
        (2027, MAR_1, date(2027, 3, 1)),
        (2028, FEB_28, date(2028, 2, 29)),  # leap year: always Feb 29
        (2028, MAR_1, date(2028, 2, 29)),
        (2100, MAR_1, date(2100, 3, 1)),  # century non-leap year
    ],
)
def test_feb29_celebration_date(year, pref, expected):
    assert celebration_date(year, 2, 29, pref) == expected


def test_feb29_delivery_non_leap_and_leap():
    tz = "Asia/Tokyo"
    assert next_delivery(2, 29, FEB_28, tz, NEW_YEAR_2027) == utc(2027, 2, 27, 15)
    assert next_delivery(2, 29, MAR_1, tz, NEW_YEAR_2027) == utc(2027, 2, 28, 15)
    after_2027 = utc(2027, 3, 5)
    assert next_delivery(2, 29, MAR_1, tz, after_2027) == utc(2028, 2, 28, 15)


def test_birthday_already_started_sends_immediately():
    now = utc(2027, 3, 14, 3, 0)  # 12:00 on 14 Mar in Tokyo
    assert next_delivery(3, 14, None, "Asia/Tokyo", now) == now


def test_birthday_starts_exactly_now_sends_immediately():
    now = utc(2027, 3, 13, 15, 0)  # exactly 00:00 on 14 Mar in Tokyo
    assert next_delivery(3, 14, None, "Asia/Tokyo", now) == now


def test_birthday_today_in_utc_but_not_yet_for_recipient():
    now = utc(2027, 3, 14, 3, 0)  # 19:00 on 13 Mar in Los Angeles
    # 14 Mar 2027 is the US DST switch day; its midnight is still PST (UTC-8)
    assert next_delivery(3, 14, None, "America/Los_Angeles", now) == utc(2027, 3, 14, 8, 0)


def test_birthday_already_passed_goes_to_next_year():
    now = utc(2027, 6, 1)
    assert next_delivery(3, 14, None, "Asia/Tokyo", now) == utc(2028, 3, 13, 15, 0)


def test_birthday_just_ended_goes_to_next_year():
    now = utc(2027, 3, 14, 15, 0)  # 00:00 on 15 Mar in Tokyo
    assert next_delivery(3, 14, None, "Asia/Tokyo", now) == utc(2028, 3, 13, 15, 0)


def test_send_now_ignores_the_birthday():
    now = utc(2027, 6, 1, 12, 34)
    assert due_now("now", 3, 14, None, "Asia/Tokyo", now) == now
    assert due_now("birthday", 3, 14, None, "Asia/Tokyo", now) == utc(2028, 3, 13, 15, 0)


def test_results_are_utc_even_when_now_is_not():
    now = datetime(2027, 1, 1, 9, 0, tzinfo=ZoneInfo("Asia/Tokyo"))
    at = next_delivery(3, 14, None, "Asia/Tokyo", now)
    assert at.tzinfo == timezone.utc


@pytest.mark.parametrize(
    ("month", "day", "pref"),
    [
        (4, 31, None),  # no such date
        (13, 1, None),
        (2, 30, None),
        (2, 29, None),  # Feb 29 without a non-leap-year choice
    ],
)
def test_invalid_birthdays_are_rejected(month, day, pref):
    with pytest.raises(ValueError):
        next_delivery(month, day, pref, "Asia/Tokyo", NEW_YEAR_2027)
    with pytest.raises(ValueError):
        due_now("now", month, day, pref, "Asia/Tokyo", NEW_YEAR_2027)


def test_naive_now_is_rejected():
    with pytest.raises(ValueError):
        next_delivery(3, 14, None, "Asia/Tokyo", datetime(2027, 1, 1))
