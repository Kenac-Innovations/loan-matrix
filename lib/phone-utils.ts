export const USER_LOGIN_PHONE_MAX_LENGTH = 15;
export const DEFAULT_AFRICAN_COUNTRY_CODE = "+260";

export type AfricanCountryCode = {
  code: string;
  country: string;
  iso2: string;
  label: string;
};

export const AFRICAN_COUNTRY_CODES: AfricanCountryCode[] = [
  { code: "+213", country: "Algeria", iso2: "DZ", label: "Algeria (+213)" },
  { code: "+244", country: "Angola", iso2: "AO", label: "Angola (+244)" },
  { code: "+229", country: "Benin", iso2: "BJ", label: "Benin (+229)" },
  { code: "+267", country: "Botswana", iso2: "BW", label: "Botswana (+267)" },
  { code: "+226", country: "Burkina Faso", iso2: "BF", label: "Burkina Faso (+226)" },
  { code: "+257", country: "Burundi", iso2: "BI", label: "Burundi (+257)" },
  { code: "+238", country: "Cabo Verde", iso2: "CV", label: "Cabo Verde (+238)" },
  { code: "+237", country: "Cameroon", iso2: "CM", label: "Cameroon (+237)" },
  {
    code: "+236",
    country: "Central African Republic",
    iso2: "CF",
    label: "Central African Republic (+236)",
  },
  { code: "+235", country: "Chad", iso2: "TD", label: "Chad (+235)" },
  { code: "+269", country: "Comoros", iso2: "KM", label: "Comoros (+269)" },
  {
    code: "+242",
    country: "Congo (Brazzaville)",
    iso2: "CG",
    label: "Congo (Brazzaville) (+242)",
  },
  {
    code: "+243",
    country: "Congo (Kinshasa)",
    iso2: "CD",
    label: "Congo (Kinshasa) (+243)",
  },
  {
    code: "+225",
    country: "Cote d'Ivoire",
    iso2: "CI",
    label: "Cote d'Ivoire (+225)",
  },
  { code: "+253", country: "Djibouti", iso2: "DJ", label: "Djibouti (+253)" },
  { code: "+20", country: "Egypt", iso2: "EG", label: "Egypt (+20)" },
  {
    code: "+240",
    country: "Equatorial Guinea",
    iso2: "GQ",
    label: "Equatorial Guinea (+240)",
  },
  { code: "+291", country: "Eritrea", iso2: "ER", label: "Eritrea (+291)" },
  { code: "+268", country: "Eswatini", iso2: "SZ", label: "Eswatini (+268)" },
  { code: "+251", country: "Ethiopia", iso2: "ET", label: "Ethiopia (+251)" },
  { code: "+241", country: "Gabon", iso2: "GA", label: "Gabon (+241)" },
  { code: "+220", country: "Gambia", iso2: "GM", label: "Gambia (+220)" },
  { code: "+233", country: "Ghana", iso2: "GH", label: "Ghana (+233)" },
  { code: "+224", country: "Guinea", iso2: "GN", label: "Guinea (+224)" },
  {
    code: "+245",
    country: "Guinea-Bissau",
    iso2: "GW",
    label: "Guinea-Bissau (+245)",
  },
  { code: "+254", country: "Kenya", iso2: "KE", label: "Kenya (+254)" },
  { code: "+266", country: "Lesotho", iso2: "LS", label: "Lesotho (+266)" },
  { code: "+231", country: "Liberia", iso2: "LR", label: "Liberia (+231)" },
  { code: "+218", country: "Libya", iso2: "LY", label: "Libya (+218)" },
  {
    code: "+261",
    country: "Madagascar",
    iso2: "MG",
    label: "Madagascar (+261)",
  },
  { code: "+265", country: "Malawi", iso2: "MW", label: "Malawi (+265)" },
  { code: "+223", country: "Mali", iso2: "ML", label: "Mali (+223)" },
  {
    code: "+222",
    country: "Mauritania",
    iso2: "MR",
    label: "Mauritania (+222)",
  },
  { code: "+230", country: "Mauritius", iso2: "MU", label: "Mauritius (+230)" },
  { code: "+212", country: "Morocco", iso2: "MA", label: "Morocco (+212)" },
  {
    code: "+258",
    country: "Mozambique",
    iso2: "MZ",
    label: "Mozambique (+258)",
  },
  { code: "+264", country: "Namibia", iso2: "NA", label: "Namibia (+264)" },
  { code: "+227", country: "Niger", iso2: "NE", label: "Niger (+227)" },
  { code: "+234", country: "Nigeria", iso2: "NG", label: "Nigeria (+234)" },
  { code: "+250", country: "Rwanda", iso2: "RW", label: "Rwanda (+250)" },
  {
    code: "+239",
    country: "Sao Tome and Principe",
    iso2: "ST",
    label: "Sao Tome and Principe (+239)",
  },
  { code: "+221", country: "Senegal", iso2: "SN", label: "Senegal (+221)" },
  { code: "+248", country: "Seychelles", iso2: "SC", label: "Seychelles (+248)" },
  {
    code: "+232",
    country: "Sierra Leone",
    iso2: "SL",
    label: "Sierra Leone (+232)",
  },
  { code: "+252", country: "Somalia", iso2: "SO", label: "Somalia (+252)" },
  {
    code: "+27",
    country: "South Africa",
    iso2: "ZA",
    label: "South Africa (+27)",
  },
  {
    code: "+211",
    country: "South Sudan",
    iso2: "SS",
    label: "South Sudan (+211)",
  },
  { code: "+249", country: "Sudan", iso2: "SD", label: "Sudan (+249)" },
  { code: "+255", country: "Tanzania", iso2: "TZ", label: "Tanzania (+255)" },
  { code: "+228", country: "Togo", iso2: "TG", label: "Togo (+228)" },
  { code: "+216", country: "Tunisia", iso2: "TN", label: "Tunisia (+216)" },
  { code: "+256", country: "Uganda", iso2: "UG", label: "Uganda (+256)" },
  { code: "+260", country: "Zambia", iso2: "ZM", label: "Zambia (+260)" },
  { code: "+263", country: "Zimbabwe", iso2: "ZW", label: "Zimbabwe (+263)" },
];

const AFRICAN_COUNTRY_CODE_SET = new Set(
  AFRICAN_COUNTRY_CODES.map((entry) => entry.code)
);

export function normalizeCountryDialCode(
  countryCode?: string | null
): string | null {
  if (typeof countryCode !== "string") {
    return null;
  }

  const digits = countryCode.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

export function isAfricanCountryDialCode(
  countryCode?: string | null
): boolean {
  const normalizedCountryCode = normalizeCountryDialCode(countryCode);
  return normalizedCountryCode
    ? AFRICAN_COUNTRY_CODE_SET.has(normalizedCountryCode)
    : false;
}

export function getAfricanCountryDialCodeOrDefault(
  countryCode?: string | null,
  fallback = DEFAULT_AFRICAN_COUNTRY_CODE
): string {
  return isAfricanCountryDialCode(countryCode)
    ? (normalizeCountryDialCode(countryCode) as string)
    : fallback;
}

export function normalizePhoneDigits(
  phone?: string | null
): string | null {
  if (typeof phone !== "string") {
    return null;
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\D/g, "") || null;
}

export function getNumericPhoneValidationError(
  phone?: string | null,
  maxLength = USER_LOGIN_PHONE_MAX_LENGTH
): string | null {
  if (typeof phone !== "string") {
    return null;
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^\d+$/.test(trimmed)) {
    return "Phone number must contain only numbers";
  }

  if (trimmed.length > maxLength) {
    return `Phone number must not exceed ${maxLength} digits`;
  }

  return null;
}

export function normalizeSmsPhoneNumber(
  phone: string,
  countryCode?: string | null
): string | null {
  const raw = String(phone || "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) {
    return `+${digits}`;
  }

  if (raw.startsWith("00")) {
    const internationalDigits = digits.slice(2);
    return internationalDigits ? `+${internationalDigits}` : null;
  }

  const normalizedCountryCode = normalizeCountryDialCode(countryCode);

  if (normalizedCountryCode) {
    const countryDigits = normalizedCountryCode.slice(1);

    if (digits.startsWith(countryDigits)) {
      return `+${digits}`;
    }

    const localDigits = digits.startsWith("0") ? digits.slice(1) : digits;
    return localDigits ? `${normalizedCountryCode}${localDigits}` : null;
  }

  if (digits.length >= 11) {
    return `+${digits}`;
  }

  return digits;
}

export function formatPhoneWithCountryCode(
  phone?: string | null,
  countryCode?: string | null
): string | null {
  const normalizedPhone = normalizePhoneDigits(phone);

  if (!normalizedPhone) {
    return null;
  }

  const normalizedCountryCode = normalizeCountryDialCode(countryCode);
  return normalizedCountryCode
    ? `${normalizedCountryCode} ${normalizedPhone}`
    : normalizedPhone;
}
