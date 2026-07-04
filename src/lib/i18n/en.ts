/**
 * Flat key file — all UI strings for screens built from M3 onward go through
 * t() so Hebrew/RTL can be added later without a string hunt.
 */
export const en = {
  'lifts.title': 'LIFTS',
  'lifts.empty': 'No lifts yet. Add your first lift below.',
  'lifts.add': 'Add lift',
  'lifts.addPlaceholder': 'Lift name',
  'lifts.noMax': 'no 1RM',
  'lifts.delete': 'Delete lift',
  'lifts.deleteConfirm': 'Tap again to delete',
  'lift.current1rm': 'Current 1RM',
  'lift.new1rm': 'New 1RM',
  'lift.save': 'Save',
  'lift.percentTable': 'Percentages',
  'lift.customPercent': 'Custom %',
  'lift.history': '1RM history',
  'lift.noHistory': 'No entries yet — set your first 1RM above.',
  'lift.notFound': 'This lift doesn’t exist anymore.',
  'settings.title': 'SETTINGS',
  'settings.units': 'Units',
  'settings.plateIncrement': 'Smallest jump',
  'settings.plateIncrementHint':
    'Weights round to the nearest value you can load on a bar.',
  'settings.sound': 'Sound cues',
  'settings.vibrate': 'Vibration',
  'settings.timer': 'Timer',
  'settings.account': 'Account',
  'settings.accountHint': 'Sign in and cloud backup are coming soon.',
} as const

export type I18nKey = keyof typeof en
