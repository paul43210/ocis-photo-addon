/**
 * Simple i18n composable for the photo addon
 *
 * Provides a translation function that returns localized strings.
 * Currently supports English only, but designed for easy expansion.
 */

import { ref, computed } from 'vue'

// Supported locales
export type Locale = 'en' | 'de' | 'fr' | 'es'

// Translation keys type for type safety
export interface TranslationKeys {
  // App header
  'app.title': string
  'app.photosInView': string
  'app.photoCount': string
  'app.allPhotosLoaded': string

  // View selector
  'view.calendar': string
  'view.map': string

  // Date filter
  'filter.jumpTo': string
  'filter.today': string
  'filter.exifOnly': string

  // Loading states
  'loading.status': string
  'loading.more': string
  'loading.recentPhotos': string
  'loading.searchingAll': string

  // Empty states
  'empty.noPhotos': string
  'empty.hint': string
  'empty.noGpsPhotos': string

  // Lightbox
  'lightbox.close': string
  'lightbox.previous': string
  'lightbox.next': string
  'lightbox.photoOptions': string

  // Metadata labels
  'metadata.dateTaken': string
  'metadata.camera': string
  'metadata.aperture': string
  'metadata.focalLength': string
  'metadata.iso': string
  'metadata.exposure': string
  'metadata.orientation': string
  'metadata.location': string
  'metadata.altitude': string
  'metadata.fileSize': string
  'metadata.type': string
  'metadata.dateSource': string

  // Orientation labels
  'orientation.normal': string
  'orientation.flippedH': string
  'orientation.rotated180': string
  'orientation.flippedV': string
  'orientation.rotated90cwFlipped': string
  'orientation.rotated90cw': string
  'orientation.rotated90ccwFlipped': string
  'orientation.rotated90ccw': string

  // Context menu
  'menu.download': string
  'menu.openInFiles': string
  'menu.copyLink': string
  'menu.delete': string
  'menu.viewOnMap': string

  // Confirmations and alerts
  'confirm.delete': string
  'alert.linkCopied': string
  'alert.linkCopyFailed': string
  'alert.downloadFailed': string
  'alert.deleteFailed': string

  // Date formatting
  'date.today': string
  'date.yesterday': string

  // Stack
  'stack.morePhotos': string

  // Map
  'map.photosInView': string
  'map.photos': string

  // Months (for dropdowns)
  'month.january': string
  'month.february': string
  'month.march': string
  'month.april': string
  'month.may': string
  'month.june': string
  'month.july': string
  'month.august': string
  'month.september': string
  'month.october': string
  'month.november': string
  'month.december': string

  // Group modes
  'groupMode.day': string
  'groupMode.week': string
  'groupMode.month': string
  'groupMode.year': string
}

// English translations (default)
const en: TranslationKeys = {
  // App header
  'app.title': 'Photos',
  'app.photosInView': '{visible} of {total} in view',
  'app.photoCount': '{count}',
  'app.allPhotosLoaded': 'All photos loaded',

  // View selector
  'view.calendar': 'Calendar',
  'view.map': 'Map',

  // Date filter
  'filter.jumpTo': 'Jump to:',
  'filter.today': 'Today',
  'filter.exifOnly': 'EXIF only',

  // Loading states
  'loading.status': 'Loading {range}... {count} photos',
  'loading.more': 'Loading more photos...',
  'loading.recentPhotos': 'Loading recent photos...',
  'loading.searchingAll': 'Searching all photos...',

  // Empty states
  'empty.noPhotos': 'No photos found',
  'empty.hint': 'Photos will appear here after EXIF tags are synced',
  'empty.noGpsPhotos': 'No photos with GPS data found',

  // Lightbox
  'lightbox.close': 'Close',
  'lightbox.previous': 'Previous photo',
  'lightbox.next': 'Next photo',
  'lightbox.photoOptions': 'Photo options',

  // Metadata labels
  'metadata.dateTaken': 'Date Taken',
  'metadata.camera': 'Camera',
  'metadata.aperture': 'Aperture',
  'metadata.focalLength': 'Focal Length',
  'metadata.iso': 'ISO',
  'metadata.exposure': 'Exposure',
  'metadata.orientation': 'Orientation',
  'metadata.location': 'Location',
  'metadata.altitude': 'Altitude',
  'metadata.fileSize': 'File Size',
  'metadata.type': 'Type',
  'metadata.dateSource': 'Date Source',

  // Orientation labels
  'orientation.normal': 'Normal',
  'orientation.flippedH': 'Flipped horizontally',
  'orientation.rotated180': 'Rotated 180°',
  'orientation.flippedV': 'Flipped vertically',
  'orientation.rotated90cwFlipped': 'Rotated 90° CW + flipped',
  'orientation.rotated90cw': 'Rotated 90° CW',
  'orientation.rotated90ccwFlipped': 'Rotated 90° CCW + flipped',
  'orientation.rotated90ccw': 'Rotated 90° CCW',

  // Context menu
  'menu.download': 'Download',
  'menu.openInFiles': 'Open in Files',
  'menu.copyLink': 'Copy Link',
  'menu.delete': 'Delete',
  'menu.viewOnMap': 'View on Map',

  // Confirmations and alerts
  'confirm.delete': 'Are you sure you want to delete "{name}"?\n\nThe file will be moved to the recycle bin.',
  'alert.linkCopied': 'Link copied to clipboard!',
  'alert.linkCopyFailed': 'Failed to copy link. Please try again.',
  'alert.downloadFailed': 'Failed to download photo. Please try again.',
  'alert.deleteFailed': 'Failed to delete photo. Please try again.',

  // Date formatting
  'date.today': 'Today',
  'date.yesterday': 'Yesterday',

  // Stack
  'stack.morePhotos': '+{count} more',

  // Map
  'map.photosInView': '{visible} of {total} photos in view',
  'map.photos': '{count} photos',

  // Months
  'month.january': 'January',
  'month.february': 'February',
  'month.march': 'March',
  'month.april': 'April',
  'month.may': 'May',
  'month.june': 'June',
  'month.july': 'July',
  'month.august': 'August',
  'month.september': 'September',
  'month.october': 'October',
  'month.november': 'November',
  'month.december': 'December',

  // Group modes
  'groupMode.day': 'Day',
  'groupMode.week': 'Week',
  'groupMode.month': 'Month',
  'groupMode.year': 'Year',
}

// German translations
const de: Partial<TranslationKeys> = {
  'app.title': 'Fotos',
  'app.allPhotosLoaded': 'Alle Fotos geladen',
  'view.calendar': 'Kalender',
  'view.map': 'Karte',
  'filter.jumpTo': 'Gehe zu:',
  'filter.today': 'Heute',
  'filter.exifOnly': 'Nur EXIF',
  'loading.more': 'Lade mehr Fotos...',
  'empty.noPhotos': 'Keine Fotos gefunden',
  'empty.noGpsPhotos': 'Keine Fotos mit GPS-Daten gefunden',
  'lightbox.close': 'Schließen',
  'metadata.dateTaken': 'Aufnahmedatum',
  'metadata.camera': 'Kamera',
  'metadata.aperture': 'Blende',
  'metadata.focalLength': 'Brennweite',
  'metadata.exposure': 'Belichtung',
  'metadata.location': 'Standort',
  'metadata.altitude': 'Höhe',
  'metadata.fileSize': 'Dateigröße',
  'menu.download': 'Herunterladen',
  'menu.openInFiles': 'In Dateien öffnen',
  'menu.copyLink': 'Link kopieren',
  'menu.delete': 'Löschen',
  'menu.viewOnMap': 'Auf Karte zeigen',
  'alert.linkCopied': 'Link in Zwischenablage kopiert!',
  'date.today': 'Heute',
  'date.yesterday': 'Gestern',
  'month.january': 'Januar',
  'month.february': 'Februar',
  'month.march': 'März',
  'month.april': 'April',
  'month.may': 'Mai',
  'month.june': 'Juni',
  'month.july': 'Juli',
  'month.august': 'August',
  'month.september': 'September',
  'month.october': 'Oktober',
  'month.november': 'November',
  'month.december': 'Dezember',
  'groupMode.day': 'Tag',
  'groupMode.week': 'Woche',
  'groupMode.month': 'Monat',
  'groupMode.year': 'Jahr',
}

// French translations
const fr: Partial<TranslationKeys> = {
  'app.title': 'Photos',
  'app.allPhotosLoaded': 'Toutes les photos chargées',
  'view.calendar': 'Calendrier',
  'view.map': 'Carte',
  'filter.jumpTo': 'Aller à:',
  'filter.today': "Aujourd'hui",
  'filter.exifOnly': 'EXIF seulement',
  'loading.more': 'Chargement de plus de photos...',
  'empty.noPhotos': 'Aucune photo trouvée',
  'empty.noGpsPhotos': 'Aucune photo avec données GPS trouvée',
  'lightbox.close': 'Fermer',
  'metadata.dateTaken': 'Date de prise',
  'metadata.camera': 'Appareil photo',
  'metadata.aperture': 'Ouverture',
  'metadata.focalLength': 'Focale',
  'metadata.exposure': 'Exposition',
  'metadata.location': 'Lieu',
  'metadata.altitude': 'Altitude',
  'metadata.fileSize': 'Taille du fichier',
  'menu.download': 'Télécharger',
  'menu.openInFiles': 'Ouvrir dans Fichiers',
  'menu.copyLink': 'Copier le lien',
  'menu.delete': 'Supprimer',
  'menu.viewOnMap': 'Voir sur la carte',
  'alert.linkCopied': 'Lien copié !',
  'date.today': "Aujourd'hui",
  'date.yesterday': 'Hier',
  'month.january': 'Janvier',
  'month.february': 'Février',
  'month.march': 'Mars',
  'month.april': 'Avril',
  'month.may': 'Mai',
  'month.june': 'Juin',
  'month.july': 'Juillet',
  'month.august': 'Août',
  'month.september': 'Septembre',
  'month.october': 'Octobre',
  'month.november': 'Novembre',
  'month.december': 'Décembre',
  'groupMode.day': 'Jour',
  'groupMode.week': 'Semaine',
  'groupMode.month': 'Mois',
  'groupMode.year': 'Année',
}

// All translations
const translations: Record<Locale, TranslationKeys | Partial<TranslationKeys>> = {
  en,
  de,
  fr,
  es: {} // Spanish placeholder
}

// Current locale (reactive)
const currentLocale = ref<Locale>('en')

/**
 * Detect browser locale
 */
function detectLocale(): Locale {
  const browserLang = navigator.language.split('-')[0]
  if (browserLang in translations) {
    return browserLang as Locale
  }
  return 'en'
}

/**
 * i18n composable
 */
export function useI18n() {
  /**
   * Set the current locale
   */
  function setLocale(locale: Locale) {
    currentLocale.value = locale
  }

  /**
   * Get the current locale
   */
  const locale = computed(() => currentLocale.value)

  /**
   * Translate a key with optional parameter substitution
   * @param key - Translation key
   * @param params - Optional parameters for substitution (e.g., { count: 5 })
   */
  function t(key: keyof TranslationKeys, params?: Record<string, string | number>): string {
    const localeTranslations = translations[currentLocale.value]
    let text = (localeTranslations as any)[key] || (translations.en as any)[key] || key

    // Parameter substitution: {name} -> value
    if (params) {
      for (const [param, value] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value))
      }
    }

    return text
  }

  /**
   * Get month names array for the current locale
   */
  function getMonthNames(): string[] {
    return [
      t('month.january'),
      t('month.february'),
      t('month.march'),
      t('month.april'),
      t('month.may'),
      t('month.june'),
      t('month.july'),
      t('month.august'),
      t('month.september'),
      t('month.october'),
      t('month.november'),
      t('month.december'),
    ]
  }

  /**
   * Get orientation label
   */
  function getOrientationLabel(orientation: number): string {
    const labels: Record<number, keyof TranslationKeys> = {
      1: 'orientation.normal',
      2: 'orientation.flippedH',
      3: 'orientation.rotated180',
      4: 'orientation.flippedV',
      5: 'orientation.rotated90cwFlipped',
      6: 'orientation.rotated90cw',
      7: 'orientation.rotated90ccwFlipped',
      8: 'orientation.rotated90ccw'
    }
    const key = labels[orientation]
    return key ? t(key) : String(orientation)
  }

  // Initialize with browser locale
  if (currentLocale.value === 'en') {
    currentLocale.value = detectLocale()
  }

  return {
    t,
    locale,
    setLocale,
    getMonthNames,
    getOrientationLabel,
    detectLocale
  }
}
