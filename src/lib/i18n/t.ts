import { en, type I18nKey } from './en'

export function t(key: I18nKey): string {
  return en[key]
}
