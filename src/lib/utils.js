// Native alternatives to date-fns to avoid ESM issues
const format = (date, formatStr) => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return "";
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fullMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  if (formatStr === "MMM dd, yyyy") return `${months[m]} ${String(d).padStart(2, '0')}, ${y}`;
  if (formatStr === "MMMM dd, yyyy") return `${fullMonths[m]} ${String(d).padStart(2, '0')}, ${y}`;
  return date.toLocaleDateString();
};

const differenceInYears = (d1, d2) => {
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return NaN;
  const diff = d1.getTime() - d2.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

const differenceInDays = (d1, d2) => {
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const diff = d1.getTime() - d2.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const differenceInHours = (d1, d2) => {
  if (!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const diff = d1.getTime() - d2.getTime();
  return Math.floor(diff / (1000 * 60 * 60));
};

export const getThumbnailUrl = (originalUrl, width = 100) => {
  // Bypassed Supabase Image Transformations to prevent 400 errors on unsupported tiers.
  return originalUrl;
};

export const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};

export const calculateAge = (dateOfBirth, calculationYear) => {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  
  const targetYear = calculationYear || new Date().getFullYear();
  const calcDate = new Date(targetYear, 11, 31);
  const age = differenceInYears(calcDate, dob);
  return isNaN(age) ? null : age;
};

export const formatDate = (dateString, formatStr = "MMM dd, yyyy") => {
  if (!dateString) return "N/A";
  try {
    return format(new Date(dateString), formatStr);
  } catch {
    return dateString;
  }
};

export const isExpired = (expiresAt) => {
  if (!expiresAt) return false;
  try {
    return new Date(expiresAt) < new Date();
  } catch {
    return false;
  }
};

export const getExpirationLabel = (expiresAt) => {
  if (!expiresAt) return "Never";
  try {
    const expDate = new Date(expiresAt);
    const now = new Date();
    if (expDate < now) {
      return "Expired";
    }
    const daysLeft = differenceInDays(expDate, now);
    const hoursLeft = differenceInHours(expDate, now);
    if (daysLeft > 30) {
      return `${Math.floor(daysLeft / 30)} mos`;
    } else if (daysLeft > 1) {
      return `${daysLeft} days`;
    } else if (hoursLeft > 1) {
      return `${hoursLeft} hrs`;
    } else {
      return "Ending";
    }
  } catch {
    return "Unknown";
  }
};


export const generateBadgeNumber = (role, index) => {
  const prefixes = {
    athlete: "ATH",
    official: "OFF",
    coach: "COA",
    media: "MED",
    medical: "DOC",
    staff: "STF",
    vip: "VIP"
  };
  const prefix = prefixes[role?.toLowerCase()] || "GEN";
  return `${prefix}-${String(index).padStart(3, "0")}`;
};

export const ROLE_BADGE_PREFIXES = {
  "Athlete": "ATH",
  "Official": "OFF",
  "Coach": "COA",
  "Media": "MED",
  "Medical": "DOC",
  "Staff": "STF",
  "VIP": "VIP",
  "Photographer": "PHO",
  "Broadcaster": "BRD",
  "Journalist": "JRN",
  "Team Manager": "MGR",
  "Technical Official": "TOF",
  "Referee": "REF",
  "Judge": "JDG",
  "Doctor": "DOC",
  "Physiotherapist": "PHY",
  "Paramedic": "PMD",
  "Security": "SEC",
  "Volunteer": "VOL",
  "IT Support": "ITS",
  "Event Manager": "EMG",
  "Logistics": "LOG",
  "Guest": "GST",
  "Sponsor Representative": "SPR",
  "Dignitary": "DIG"
};

export const getBadgePrefix = (role, customPrefix = null) => {
  if (customPrefix) return customPrefix;
  return ROLE_BADGE_PREFIXES[role] || role?.substring(0, 3)?.toUpperCase() || "GEN";
};

export const ROLE_GROUPS = {
  "Media": ["Photographer", "Broadcaster", "Journalist", "Media"],
  "Officials": ["Official", "Technical Official", "Referee", "Judge"],
  "Medical": ["Doctor", "Physiotherapist", "Paramedic", "Medical"],
  "Team": ["Athlete", "Coach", "Team Manager"],
  "Staff": ["Security", "Volunteer", "IT Support", "Event Manager", "Logistics", "Staff"],
  "VIP": ["Guest", "Sponsor Representative", "Dignitary", "VIP"]
};

export const COUNTRIES = [
  { "name": "Afghanistan", "code": "AF", "flag": "af", "ioc": "AFG" },
  { "name": "Albania", "code": "AL", "flag": "al", "ioc": "ALB" },
  { "name": "Algeria", "code": "DZ", "flag": "dz", "ioc": "ALG" },
  { "name": "Andorra", "code": "AD", "flag": "ad", "ioc": "AND" },
  { "name": "Angola", "code": "AO", "flag": "ao", "ioc": "ANG" },
  { "name": "Antigua and Barbuda", "code": "AG", "flag": "ag", "ioc": "ANT" },
  { "name": "Argentina", "code": "AR", "flag": "ar", "ioc": "ARG" },
  { "name": "Armenia", "code": "AM", "flag": "am", "ioc": "ARM" },
  { "name": "Australia", "code": "AU", "flag": "au", "ioc": "AUS" },
  { "name": "Austria", "code": "AT", "flag": "at", "ioc": "AUT" },
  { "name": "Azerbaijan", "code": "AZ", "flag": "az", "ioc": "AZE" },
  { "name": "Bahamas", "code": "BS", "flag": "bs", "ioc": "BAH" },
  { "name": "Bahrain", "code": "BH", "flag": "bh", "ioc": "BRN" },
  { "name": "Bangladesh", "code": "BD", "flag": "bd", "ioc": "BAN" },
  { "name": "Barbados", "code": "BB", "flag": "bb", "ioc": "BAR" },
  { "name": "Belarus", "code": "BY", "flag": "by", "ioc": "BLR" },
  { "name": "Belgium", "code": "BE", "flag": "be", "ioc": "BEL" },
  { "name": "Belize", "code": "BZ", "flag": "bz", "ioc": "BIZ" },
  { "name": "Benin", "code": "BJ", "flag": "bj", "ioc": "BEN" },
  { "name": "Bhutan", "code": "BT", "flag": "bt", "ioc": "BHU" },
  { "name": "Bolivia", "code": "BO", "flag": "bo", "ioc": "BOL" },
  { "name": "Bosnia and Herzegovina", "code": "BA", "flag": "ba", "ioc": "BIH" },
  { "name": "Botswana", "code": "BW", "flag": "bw", "ioc": "BOT" },
  { "name": "Brazil", "code": "BR", "flag": "br", "ioc": "BRA" },
  { "name": "Brunei", "code": "BN", "flag": "bn", "ioc": "BRU" },
  { "name": "Bulgaria", "code": "BG", "flag": "bg", "ioc": "BUL" },
  { "name": "Burkina Faso", "code": "BF", "flag": "bf", "ioc": "BUR" },
  { "name": "Burundi", "code": "BI", "flag": "bi", "ioc": "BDI" },
  { "name": "Cambodia", "code": "KH", "flag": "kh", "ioc": "CAM" },
  { "name": "Cameroon", "code": "CM", "flag": "cm", "ioc": "CMR" },
  { "name": "Canada", "code": "CA", "flag": "ca", "ioc": "CAN" },
  { "name": "Cape Verde", "code": "CV", "flag": "cv", "ioc": "CPV" },
  { "name": "Central African Republic", "code": "CF", "flag": "cf", "ioc": "CAF" },
  { "name": "Chad", "code": "TD", "flag": "td", "ioc": "CHA" },
  { "name": "Chile", "code": "CL", "flag": "cl", "ioc": "CHI" },
  { "name": "China", "code": "CN", "flag": "cn", "ioc": "CHN" },
  { "name": "Colombia", "code": "CO", "flag": "co", "ioc": "COL" },
  { "name": "Comoros", "code": "KM", "flag": "km", "ioc": "COM" },
  { "name": "Congo, Democratic Republic of the", "code": "CD", "flag": "cd", "ioc": "COD" },
  { "name": "Congo, Republic of the", "code": "CG", "flag": "cg", "ioc": "CGO" },
  { "name": "Costa Rica", "code": "CR", "flag": "cr", "ioc": "CRC" },
  { "name": "Croatia", "code": "HR", "flag": "hr", "ioc": "CRO" },
  { "name": "Cuba", "code": "CU", "flag": "cu", "ioc": "CUB" },
  { "name": "Cyprus", "code": "CY", "flag": "cy", "ioc": "CYP" },
  { "name": "Czech Republic", "code": "CZ", "flag": "cz", "ioc": "CZE" },
  { "name": "Denmark", "code": "DK", "flag": "dk", "ioc": "DEN" },
  { "name": "Djibouti", "code": "DJ", "flag": "dj", "ioc": "DJI" },
  { "name": "Dominica", "code": "DM", "flag": "dm", "ioc": "DMA" },
  { "name": "Dominican Republic", "code": "DO", "flag": "do", "ioc": "DOM" },
  { "name": "East Timor", "code": "TL", "flag": "tl", "ioc": "TLS" },
  { "name": "Ecuador", "code": "EC", "flag": "ec", "ioc": "ECU" },
  { "name": "Egypt", "code": "EG", "flag": "eg", "ioc": "EGY" },
  { "name": "El Salvador", "code": "SV", "flag": "sv", "ioc": "ESA" },
  { "name": "Equatorial Guinea", "code": "GQ", "flag": "gq", "ioc": "GEQ" },
  { "name": "Eritrea", "code": "ER", "flag": "er", "ioc": "ERI" },
  { "name": "Estonia", "code": "EE", "flag": "ee", "ioc": "EST" },
  { "name": "Ethiopia", "code": "ET", "flag": "et", "ioc": "ETH" },
  { "name": "Fiji", "code": "FJ", "flag": "fj", "ioc": "FIJ" },
  { "name": "Finland", "code": "FI", "flag": "fi", "ioc": "FIN" },
  { "name": "France", "code": "FR", "flag": "fr", "ioc": "FRA" },
  { "name": "Gabon", "code": "GA", "flag": "ga", "ioc": "GAB" },
  { "name": "Gambia", "code": "GM", "flag": "gm", "ioc": "GAM" },
  { "name": "Georgia", "code": "GE", "flag": "ge", "ioc": "GEO" },
  { "name": "Germany", "code": "DE", "flag": "de", "ioc": "GER" },
  { "name": "Ghana", "code": "GH", "flag": "gh", "ioc": "GHA" },
  { "name": "Greece", "code": "GR", "flag": "gr", "ioc": "GRE" },
  { "name": "Grenada", "code": "GD", "flag": "gd", "ioc": "GRN" },
  { "name": "Guatemala", "code": "GT", "flag": "gt", "ioc": "GUA" },
  { "name": "Guinea", "code": "GN", "flag": "gn", "ioc": "GUI" },
  { "name": "Guinea-Bissau", "code": "GW", "flag": "gw", "ioc": "GBS" },
  { "name": "Guyana", "code": "GY", "flag": "gy", "ioc": "GUY" },
  { "name": "Haiti", "code": "HT", "flag": "ht", "ioc": "HAI" },
  { "name": "Honduras", "code": "HN", "flag": "hn", "ioc": "HON" },
  { "name": "Hungary", "code": "HU", "flag": "hu", "ioc": "HUN" },
  { "name": "Iceland", "code": "IS", "flag": "is", "ioc": "ISL" },
  { "name": "India", "code": "IN", "flag": "in", "ioc": "IND" },
  { "name": "Indonesia", "code": "ID", "flag": "id", "ioc": "INA" },
  { "name": "Iran", "code": "IR", "flag": "ir", "ioc": "IRI" },
  { "name": "Iraq", "code": "IQ", "flag": "iq", "ioc": "IRQ" },
  { "name": "Ireland", "code": "IE", "flag": "ie", "ioc": "IRL" },
  { "name": "Israel", "code": "IL", "flag": "il", "ioc": "ISR" },
  { "name": "Italy", "code": "IT", "flag": "it", "ioc": "ITA" },
  { "name": "Ivory Coast", "code": "CI", "flag": "ci", "ioc": "CIV" },
  { "name": "Jamaica", "code": "JM", "flag": "jm", "ioc": "JAM" },
  { "name": "Japan", "code": "JP", "flag": "jp", "ioc": "JPN" },
  { "name": "Jordan", "code": "JO", "flag": "jo", "ioc": "JOR" },
  { "name": "Kazakhstan", "code": "KZ", "flag": "kz", "ioc": "KAZ" },
  { "name": "Kenya", "code": "KE", "flag": "ke", "ioc": "KEN" },
  { "name": "Kiribati", "code": "KI", "flag": "ki", "ioc": "KIR" },
  { "name": "Korea, North", "code": "KP", "flag": "kp", "ioc": "PRK" },
  { "name": "Korea, South", "code": "KR", "flag": "kr", "ioc": "KOR" },
  { "name": "Kosovo", "code": "XK", "flag": "xk", "ioc": "KOS" },
  { "name": "Kuwait", "code": "KW", "flag": "kw", "ioc": "KUW" },
  { "name": "Kyrgyzstan", "code": "KG", "flag": "kg", "ioc": "KGZ" },
  { "name": "Laos", "code": "LA", "flag": "la", "ioc": "LAO" },
  { "name": "Latvia", "code": "LV", "flag": "lv", "ioc": "LAT" },
  { "name": "Lebanon", "code": "LB", "flag": "lb", "ioc": "LBN" },
  { "name": "Lesotho", "code": "LS", "flag": "ls", "ioc": "LES" },
  { "name": "Liberia", "code": "LR", "flag": "lr", "ioc": "LBR" },
  { "name": "Libya", "code": "LY", "flag": "ly", "ioc": "LBA" },
  { "name": "Liechtenstein", "code": "LI", "flag": "li", "ioc": "LIE" },
  { "name": "Lithuania", "code": "LT", "flag": "lt", "ioc": "LTU" },
  { "name": "Luxembourg", "code": "LU", "flag": "lu", "ioc": "LUX" },
  { "name": "Macedonia", "code": "MK", "flag": "mk", "ioc": "MKD" },
  { "name": "Madagascar", "code": "MG", "flag": "mg", "ioc": "MAD" },
  { "name": "Malawi", "code": "MW", "flag": "mw", "ioc": "MAW" },
  { "name": "Malaysia", "code": "MY", "flag": "my", "ioc": "MAS" },
  { "name": "Maldives", "code": "MV", "flag": "mv", "ioc": "MDV" },
  { "name": "Mali", "code": "ML", "flag": "ml", "ioc": "MLI" },
  { "name": "Malta", "code": "MT", "flag": "mt", "ioc": "MLT" },
  { "name": "Marshall Islands", "code": "MH", "flag": "mh", "ioc": "MHL" },
  { "name": "Mauritania", "code": "MR", "flag": "mr", "ioc": "MTN" },
  { "name": "Mauritius", "code": "MU", "flag": "mu", "ioc": "MRI" },
  { "name": "Mexico", "code": "MX", "flag": "mx", "ioc": "MEX" },
  { "name": "Micronesia", "code": "FM", "flag": "fm", "ioc": "FSM" },
  { "name": "Moldova", "code": "MD", "flag": "md", "ioc": "MDA" },
  { "name": "Monaco", "code": "MC", "flag": "mc", "ioc": "MON" },
  { "name": "Mongolia", "code": "MN", "flag": "mn", "ioc": "MGL" },
  { "name": "Montenegro", "code": "ME", "flag": "me", "ioc": "MNE" },
  { "name": "Morocco", "code": "MA", "flag": "ma", "ioc": "MAR" },
  { "name": "Mozambique", "code": "MZ", "flag": "mz", "ioc": "MOZ" },
  { "name": "Myanmar", "code": "MM", "flag": "mm", "ioc": "MYA" },
  { "name": "Namibia", "code": "NA", "flag": "na", "ioc": "NAM" },
  { "name": "Nauru", "code": "NR", "flag": "nr", "ioc": "NRU" },
  { "name": "Nepal", "code": "NP", "flag": "np", "ioc": "NEP" },
  { "name": "Netherlands", "code": "NL", "flag": "nl", "ioc": "NED" },
  { "name": "New Zealand", "code": "NZ", "flag": "nz", "ioc": "NZL" },
  { "name": "Nicaragua", "code": "NI", "flag": "ni", "ioc": "NCA" },
  { "name": "Niger", "code": "NE", "flag": "ne", "ioc": "NIG" },
  { "name": "Nigeria", "code": "NG", "flag": "ng", "ioc": "NGR" },
  { "name": "Norway", "code": "NO", "flag": "no", "ioc": "NOR" },
  { "name": "Oman", "code": "OM", "flag": "om", "ioc": "OMA" },
  { "name": "Pakistan", "code": "PK", "flag": "pk", "ioc": "PAK" },
  { "name": "Palau", "code": "PW", "flag": "pw", "ioc": "PLW" },
  { "name": "Palestine", "code": "PS", "flag": "ps", "ioc": "PLE" },
  { "name": "Panama", "code": "PA", "flag": "pa", "ioc": "PAN" },
  { "name": "Papua New Guinea", "code": "PG", "flag": "pg", "ioc": "PNG" },
  { "name": "Paraguay", "code": "PY", "flag": "py", "ioc": "PAR" },
  { "name": "Peru", "code": "PE", "flag": "pe", "ioc": "PER" },
  { "name": "Philippines", "code": "PH", "flag": "ph", "ioc": "PHI" },
  { "name": "Poland", "code": "PL", "flag": "pl", "ioc": "POL" },
  { "name": "Portugal", "code": "PT", "flag": "pt", "ioc": "POR" },
  { "name": "Qatar", "code": "QA", "flag": "qa", "ioc": "QAT" },
  { "name": "Romania", "code": "RO", "flag": "ro", "ioc": "ROU" },
  { "name": "Russia", "code": "RU", "flag": "ru", "ioc": "RUS" },
  { "name": "Rwanda", "code": "RW", "flag": "rw", "ioc": "RWA" },
  { "name": "Saint Kitts and Nevis", "code": "KN", "flag": "kn", "ioc": "SKN" },
  { "name": "Saint Lucia", "code": "LC", "flag": "lc", "ioc": "LCA" },
  { "name": "Saint Vincent and the Grenadines", "code": "VC", "flag": "vc", "ioc": "VIN" },
  { "name": "Samoa", "code": "WS", "flag": "ws", "ioc": "SAM" },
  { "name": "San Marino", "code": "SM", "flag": "sm", "ioc": "SMR" },
  { "name": "Sao Tome and Principe", "code": "ST", "flag": "st", "ioc": "STP" },
  { "name": "Saudi Arabia", "code": "SA", "flag": "sa", "ioc": "KSA" },
  { "name": "Senegal", "code": "SN", "flag": "sn", "ioc": "SEN" },
  { "name": "Serbia", "code": "RS", "flag": "rs", "ioc": "SRB" },
  { "name": "Seychelles", "code": "SC", "flag": "sc", "ioc": "SEY" },
  { "name": "Sierra Leone", "code": "SL", "flag": "sl", "ioc": "SLE" },
  { "name": "Singapore", "code": "SG", "flag": "sg", "ioc": "SGP" },
  { "name": "Slovakia", "code": "SK", "flag": "sk", "ioc": "SVK" },
  { "name": "Slovenia", "code": "SI", "flag": "si", "ioc": "SLO" },
  { "name": "Solomon Islands", "code": "SB", "flag": "sb", "ioc": "SOL" },
  { "name": "Somalia", "code": "SO", "flag": "so", "ioc": "SOM" },
  { "name": "South Africa", "code": "ZA", "flag": "za", "ioc": "RSA" },
  { "name": "South Sudan", "code": "SS", "flag": "ss", "ioc": "SSD" },
  { "name": "Spain", "code": "ES", "flag": "es", "ioc": "ESP" },
  { "name": "Sri Lanka", "code": "LK", "flag": "lk", "ioc": "SRI" },
  { "name": "Sudan", "code": "SD", "flag": "sd", "ioc": "SUD" },
  { "name": "Suriname", "code": "SR", "flag": "sr", "ioc": "SUR" },
  { "name": "Swaziland", "code": "SZ", "flag": "sz", "ioc": "SWZ" },
  { "name": "Sweden", "code": "SE", "flag": "se", "ioc": "SWE" },
  { "name": "Switzerland", "code": "CH", "flag": "ch", "ioc": "SUI" },
  { "name": "Syria", "code": "SY", "flag": "sy", "ioc": "SYR" },
  { "name": "Taiwan", "code": "TW", "flag": "tw", "ioc": "TPE" },
  { "name": "Tajikistan", "code": "TJ", "flag": "tj", "ioc": "TJK" },
  { "name": "Tanzania", "code": "TZ", "flag": "tz", "ioc": "TAN" },
  { "name": "Thailand", "code": "TH", "flag": "th", "ioc": "THA" },
  { "name": "Togo", "code": "TG", "flag": "tg", "ioc": "TOG" },
  { "name": "Tonga", "code": "TO", "flag": "to", "ioc": "TGA" },
  { "name": "Trinidad and Tobago", "code": "TT", "flag": "tt", "ioc": "TTO" },
  { "name": "Tunisia", "code": "TN", "flag": "tn", "ioc": "TUN" },
  { "name": "Turkey", "code": "TR", "flag": "tr", "ioc": "TUR" },
  { "name": "Turkmenistan", "code": "TM", "flag": "tm", "ioc": "TKM" },
  { "name": "Tuvalu", "code": "TV", "flag": "tv", "ioc": "TUV" },
  { "name": "Uganda", "code": "UG", "flag": "ug", "ioc": "UGA" },
  { "name": "Ukraine", "code": "UA", "flag": "ua", "ioc": "UKR" },
  { "name": "United Arab Emirates", "code": "AE", "flag": "ae", "ioc": "UAE" },
  { "name": "United Kingdom", "code": "GB", "flag": "gb", "ioc": "GBR" },
  { "name": "United States", "code": "US", "flag": "us", "ioc": "USA" },
  { "name": "Uruguay", "code": "UY", "flag": "uy", "ioc": "URU" },
  { "name": "Uzbekistan", "code": "UZ", "flag": "uz", "ioc": "UZB" },
  { "name": "Vanuatu", "code": "VU", "flag": "vu", "ioc": "VAN" },
  { "name": "Vatican City", "code": "VA", "flag": "va", "ioc": "VAT" },
  { "name": "Venezuela", "code": "VE", "flag": "ve", "ioc": "VEN" },
  { "name": "Vietnam", "code": "VN", "flag": "vn", "ioc": "VIE" },
  { "name": "Yemen", "code": "YE", "flag": "ye", "ioc": "YEM" },
  { "name": "Zambia", "code": "ZM", "flag": "zm", "ioc": "ZAM" },
  { "name": "Zimbabwe", "code": "ZW", "flag": "zw", "ioc": "ZIM" }
];

export const getCountryCode3 = (code) => {
  if (!code) return "";
  const country = COUNTRIES.find(c => 
    c.code?.toUpperCase() === code.toUpperCase() || 
    c.name?.toLowerCase() === code.toLowerCase() ||
    c.ioc?.toUpperCase() === code.toUpperCase()
  );
  return country?.ioc || code;
};

export const getCountryName = (code) => {
  if (!code) return "";
  const country = COUNTRIES.find(c => 
    c.code?.toUpperCase() === code.toUpperCase() || 
    c.name?.toLowerCase() === code.toLowerCase() ||
    c.ioc?.toUpperCase() === code.toUpperCase()
  );
  return country?.name || code;
};

export const getCountryFlag = (code) => {
  if (!code) return null;
  const country = COUNTRIES.find(c => 
    c.code?.toUpperCase() === code.toUpperCase() || 
    c.name?.toLowerCase() === code.toLowerCase() ||
    c.ioc?.toUpperCase() === code.toUpperCase()
  );
  if (country?.flag) {
    return `https://flagcdn.com/w80/${country.flag.toLowerCase()}.png`;
  }
  return null;
};

export const ROLES = [
  "Athlete",
  "Official",
  "Coach",
  "Media",
  "Medical",
  "Staff",
  "VIP"
];

export const validateFile = (file, maxSizeMB = 5) => {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  const maxSize = maxSizeMB * 1024 * 1024;
  if (!validTypes.includes(file.type)) {
    return { valid: false, error: "Invalid file type. Allowed: JPEG, PNG, WebP, PDF" };
  }
  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum size: ${maxSizeMB}MB` };
  }
  return { valid: true };
};

export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const printPdfBlob = (blobUrl) => {
  try {
    const printFrame = document.createElement("iframe");
    printFrame.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0;";
    printFrame.src = blobUrl;
    document.body.appendChild(printFrame);

    printFrame.onload = () => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        const win = window.open(blobUrl, "_blank");
        if (win) {
          win.addEventListener("load", () => {
            win.focus();
            win.print();
          });
        }
      }
      setTimeout(() => {
        if (printFrame.parentNode) {
          document.body.removeChild(printFrame);
        }
      }, 60000);
    };
  } catch (error) {
    console.error("Print error:", error);
    window.open(blobUrl, "_blank");
  }
};
