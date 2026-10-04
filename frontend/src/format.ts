// Delivery times in the recipient's zone and the sender's own, e.g.
// "00:00, 14 Mar in Tokyo (20:30, 13 Mar your time)".

import type { Capsule } from './api'

function moment(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const thisYear = String(new Date().getFullYear())
  const year = get('year') === thisYear ? '' : ` ${get('year')}`
  return `${get('hour')}:${get('minute')}, ${get('day')} ${get('month')}${year}`
}

export const cityName = (cityLabel: string) => cityLabel.split(',')[0]

/** "00:00, 14 Mar in Tokyo (20:30, 13 Mar your time)" */
export function deliveryMoment(deliverAt: string, tz: string, cityLabel: string): string {
  const at = new Date(deliverAt)
  const theirs = moment(at, tz)
  const mine = moment(at)
  const yours = theirs === mine ? 'the same for you' : `${mine} your time`
  return `${theirs} in ${cityName(cityLabel)} (${yours})`
}

/** One line for the history row, depending on status */
export function deliveryLine(c: Capsule): string {
  switch (c.status) {
    case 'scheduled':
      return c.send_mode === 'now' ? 'Sending now' : `Delivers ${deliveryMoment(c.deliver_at, c.tz, c.city_label)}`
    case 'delivered':
      return c.delivery_trouble
        ? "Delivery trouble: the email hasn't gone out yet. We'll keep retrying."
        : `Delivered ${deliveryMoment(c.deliver_at, c.tz, c.city_label)}`
    case 'opened':
      return c.opened_at ? `Opened ${deliveryMoment(c.opened_at, c.tz, c.city_label)}` : 'Opened'
    case 'cancelled':
      return 'Cancelled'
  }
}

/** The calendar date of `at` in `tz`, as a day number (for counting days between dates) */
function localDay(at: Date, tz: string): number {
  // en-CA writes dates as YYYY-MM-DD
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
  return Date.parse(ymd.format(at)) / 86_400_000
}

/** "today", "tomorrow" or "in 12 days" until their birthday, counted in their time zone */
export function countdown(nextDelivery: string, tz: string, now = new Date()): string {
  const at = new Date(nextDelivery)
  const days = at <= now ? 0 : Math.round(localDay(at, tz) - localDay(now, tz))
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`
}

/** "14 March" */
export const birthdayLabel = (month: number, day: number) => `${day} ${monthNames[month - 1]}`

export const monthNames = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1))),
)

/** Days in a month allowing Feb 29 (a birthday, not a date in a particular year) */
export const daysInMonth = (month: number) => new Date(Date.UTC(2000, month, 0)).getUTCDate()
