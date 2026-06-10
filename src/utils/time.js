'use strict';

// Formats an integer hour (e.g. 6) as a "HH:00" label.
function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

// Builds the list of hourly slots for a venue on a date, then marks each
// as 'booked' (with the booking id) or 'available' using the set of taken hours.
// `openHour` inclusive, `closeHour` exclusive end-of-day — so the last slot
// starts at closeHour-1.
function buildSlots({ venueId, date, openHour, closeHour, bookedByHour }) {
  const slots = [];
  for (let h = openHour; h < closeHour; h++) {
    const booking = bookedByHour.get(h);
    slots.push({
      venue_id: venueId,
      date,
      start_hour: h,
      start_time: hourLabel(h),
      end_time: hourLabel(h + 1),
      status: booking ? 'booked' : 'available',
      booking_id: booking ? booking.id : null,
    });
  }
  return slots;
}

// Strict YYYY-MM-DD check that also rejects impossible calendar dates.
function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

module.exports = { hourLabel, buildSlots, isValidDate };
