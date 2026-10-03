"""Shared date checks for user-supplied "this already happened" dates."""

from datetime import date, timedelta

# A caregiver whose local date is ahead of the server's (e.g. UTC server,
# user just past midnight in Asia) legitimately sends "tomorrow", so allow
# a day of slack rather than rejecting their real, same-day entry.
_FUTURE_TOLERANCE = timedelta(days=1)


def is_in_future(d: date) -> bool:
    return d > date.today() + _FUTURE_TOLERANCE
