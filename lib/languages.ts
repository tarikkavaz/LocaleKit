export interface Language {
  code: string;
  name: string;
  isDefault: boolean;
}

const DEFAULT_LANGUAGES: Language[] = [
  { code: "en_gb", name: "English United Kingdom", isDefault: true },
  { code: "en_us", name: "English United States", isDefault: true },
  { code: "en_sc", name: "English Seychelles", isDefault: true },
  { code: "ru_ru", name: "Russian", isDefault: true },
  { code: "sv_se", name: "Swedish", isDefault: true },
  { code: "fi_fi", name: "Finnish", isDefault: true },
  { code: "et_ee", name: "Estonian", isDefault: true },
  { code: "ro_ro", name: "Romanian", isDefault: true },
  { code: "da_dk", name: "Danish", isDefault: true },
  { code: "de_de", name: "German", isDefault: true },
  { code: "nl_nl", name: "Dutch Netherlands", isDefault: true },
  { code: "nl_be", name: "Dutch Belgium", isDefault: true },
  { code: "zh_cn", name: "Simplified Chinese China", isDefault: true },
  { code: "zh_tw", name: "Traditional Chinese Taiwan", isDefault: true },
  { code: "th_th", name: "Thai", isDefault: true },
  { code: "tr_tr", name: "Turkish", isDefault: true },
  { code: "ja_jp", name: "Japanese", isDefault: true },
  { code: "pl_pl", name: "Polish", isDefault: true },
  { code: "pt_pt", name: "Portuguese Portugal", isDefault: true },
  { code: "pt_br", name: "Portuguese Brazil", isDefault: true },
  { code: "es_es", name: "Spanish Spain", isDefault: true },
  { code: "es_mx", name: "Spanish Mexico", isDefault: true },
  { code: "es_co", name: "Spanish Colombia", isDefault: true },
  { code: "ko_kr", name: "Korean", isDefault: true },
  { code: "vi_vn", name: "Vietnamese", isDefault: true },
  { code: "cs_cz", name: "Czech", isDefault: true },
  { code: "id_id", name: "Indonesian", isDefault: true },
  { code: "it_it", name: "Italian", isDefault: true },
  { code: "km_kh", name: "Khmer", isDefault: true },
  { code: "fr_fr", name: "French France", isDefault: true },
  { code: "fr_be", name: "French Belgium", isDefault: true },
  { code: "el_gr", name: "Greek", isDefault: true },
  { code: "lt_lt", name: "Lithuanian", isDefault: true },
  { code: "ms_my", name: "Malay", isDefault: true },
  { code: "hu_hu", name: "Hungarian", isDefault: true },
  { code: "nb_no", name: "Norwegian Bokmål Norway", isDefault: true },
  { code: "no_no", name: "Norwegian Norway", isDefault: true },
  { code: "hr_hr", name: "Croatian", isDefault: true },
  { code: "sk_sk", name: "Slovak", isDefault: true },
  { code: "lv_lv", name: "Latvian", isDefault: true },
  { code: "uk_ua", name: "Ukrainian", isDefault: true },
  { code: "ka_ge", name: "Georgian", isDefault: true },
];

const STORAGE_KEY = "localekit-custom-languages";

/**
 * Load all languages (default + custom)
 */
export function getAllLanguages(): Language[] {
  const customLanguages = getCustomLanguages();
  return [...DEFAULT_LANGUAGES, ...customLanguages];
}

/**
 * Get default languages only
 */
export function getDefaultLanguages(): Language[] {
  return DEFAULT_LANGUAGES;
}

/**
 * Get custom languages from storage
 */
export function getCustomLanguages(): Language[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as Language[];
    return parsed.map((lang) => ({ ...lang, isDefault: false }));
  } catch (error) {
    console.error("Failed to load custom languages:", error);
    return [];
  }
}

/**
 * Save custom languages to storage
 */
export function saveCustomLanguages(languages: Language[]): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    // Filter out default languages and only save custom ones
    const customOnly = languages.filter((lang) => !lang.isDefault);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
  } catch (error) {
    console.error("Failed to save custom languages:", error);
    throw new Error("Failed to save custom languages");
  }
}

/**
 * Add a custom language
 */
export function addCustomLanguage(code: string, name: string): void {
  const customLanguages = getCustomLanguages();

  // Check if language code already exists
  if (customLanguages.some((lang) => lang.code === code)) {
    throw new Error(`Language with code "${code}" already exists`);
  }

  // Check if it's a default language
  if (DEFAULT_LANGUAGES.some((lang) => lang.code === code)) {
    throw new Error(`Language with code "${code}" is a default language`);
  }

  const newLanguage: Language = {
    code: code.trim(),
    name: name.trim(),
    isDefault: false,
  };

  customLanguages.push(newLanguage);
  saveCustomLanguages(customLanguages);
}

/**
 * Update a custom language
 */
export function updateCustomLanguage(
  oldCode: string,
  newCode: string,
  newName: string
): void {
  const customLanguages = getCustomLanguages();
  const index = customLanguages.findIndex((lang) => lang.code === oldCode);

  if (index === -1) {
    throw new Error(`Language with code "${oldCode}" not found`);
  }

  // If code changed, check for conflicts
  if (oldCode !== newCode.trim()) {
    if (
      customLanguages.some(
        (lang) => lang.code === newCode.trim() && lang.code !== oldCode
      )
    ) {
      throw new Error(`Language with code "${newCode}" already exists`);
    }
    if (DEFAULT_LANGUAGES.some((lang) => lang.code === newCode.trim())) {
      throw new Error(`Language with code "${newCode}" is a default language`);
    }
  }

  customLanguages[index] = {
    code: newCode.trim(),
    name: newName.trim(),
    isDefault: false,
  };

  saveCustomLanguages(customLanguages);
}

/**
 * Delete a custom language
 */
export function deleteCustomLanguage(code: string): void {
  const customLanguages = getCustomLanguages();
  const filtered = customLanguages.filter((lang) => lang.code !== code);

  if (filtered.length === customLanguages.length) {
    throw new Error(`Language with code "${code}" not found`);
  }

  saveCustomLanguages(filtered);
}

/**
 * Validate language code format
 */
export function validateLanguageCode(code: string): boolean {
  // Language codes should be lowercase, alphanumeric with underscores
  // Format: xx_xx or xx_xx_xx
  const pattern = /^[a-z]{2}_[a-z]{2}(_[a-z]{2})?$/;
  return pattern.test(code.trim());
}

/**
 * Get language by code
 */
export function getLanguageByCode(code: string): Language | undefined {
  const allLanguages = getAllLanguages();
  return allLanguages.find((lang) => lang.code === code);
}
