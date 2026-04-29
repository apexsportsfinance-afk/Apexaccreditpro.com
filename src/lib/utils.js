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
  { name: "Afghanistan", code: "AF", flag: "af" },
  { name: "Albania", code: "AL", flag: "al" },
  { name: "Algeria", code: "DZ", flag: "dz" },
  { name: "Andorra", code: "AD", flag: "ad" },
  { name: "Angola", code: "AO", flag: "ao" },
  { name: "Antigua and Barbuda", code: "AG", flag: "ag" },
  { name: "Argentina", code: "AR", flag: "ar" },
  { name: "Armenia", code: "AM", flag: "am" },
  { name: "Australia", code: "AU", flag: "au" },
  { name: "Austria", code: "AT", flag: "at" },
  { name: "Azerbaijan", code: "AZ", flag: "az" },
  { name: "Bahamas", code: "BS", flag: "bs" },
  { name: "Bahrain", code: "BH", flag: "bh" },
  { name: "Bangladesh", code: "BD", flag: "bd" },
  { name: "Barbados", code: "BB", flag: "bb" },
  { name: "Belarus", code: "BY", flag: "by" },
  { name: "Belgium", code: "BE", flag: "be" },
  { name: "Belize", code: "BZ", flag: "bz" },
  { name: "Benin", code: "BJ", flag: "bj" },
  { name: "Bhutan", code: "BT", flag: "bt" },
  { name: "Bolivia", code: "BO", flag: "bo" },
  { name: "Bosnia and Herzegovina", code: "BA", flag: "ba" },
  { name: "Botswana", code: "BW", flag: "bw" },
  { name: "Brazil", code: "BR", flag: "br" },
  { name: "Brunei", code: "BN", flag: "bn" },
  { name: "Bulgaria", code: "BG", flag: "bg" },
  { name: "Burkina Faso", code: "BF", flag: "bf" },
  { name: "Burundi", code: "BI", flag: "bi" },
  { name: "Cambodia", code: "KH", flag: "kh" },
  { name: "Cameroon", code: "CM", flag: "cm" },
  { name: "Canada", code: "CA", flag: "ca" },
  { name: "Cape Verde", code: "CV", flag: "cv" },
  { name: "Central African Republic", code: "CF", flag: "cf" },
  { name: "Chad", code: "TD", flag: "td" },
  { name: "Chile", code: "CL", flag: "cl" },
  { name: "China", code: "CN", flag: "cn" },
  { name: "Colombia", code: "CO", flag: "co" },
  { name: "Comoros", code: "KM", flag: "km" },
  { name: "Congo, Democratic Republic of the", code: "CD", flag: "cd" },
  { name: "Congo, Republic of the", code: "CG", flag: "cg" },
  { name: "Costa Rica", code: "CR", flag: "cr" },
  { name: "Croatia", code: "HR", flag: "hr" },
  { name: "Cuba", code: "CU", flag: "cu" },
  { name: "Cyprus", code: "CY", flag: "cy" },
  { name: "Czech Republic", code: "CZ", flag: "cz" },
  { name: "Denmark", code: "DK", flag: "dk" },
  { name: "Djibouti", code: "DJ", flag: "dj" },
  { name: "Dominica", code: "DM", flag: "dm" },
  { name: "Dominican Republic", code: "DO", flag: "do" },
  { name: "East Timor", code: "TL", flag: "tl" },
  { name: "Ecuador", code: "EC", flag: "ec" },
  { name: "Egypt", code: "EG", flag: "eg" },
  { name: "El Salvador", code: "SV", flag: "sv" },
  { name: "Equatorial Guinea", code: "GQ", flag: "gq" },
  { name: "Eritrea", code: "ER", flag: "er" },
  { name: "Estonia", code: "EE", flag: "ee" },
  { name: "Ethiopia", code: "ET", flag: "et" },
  { name: "Fiji", code: "FJ", flag: "fj" },
  { name: "Finland", code: "FI", flag: "fi" },
  { name: "France", code: "FR", flag: "fr" },
  { name: "Gabon", code: "GA", flag: "ga" },
  { name: "Gambia", code: "GM", flag: "gm" },
  { name: "Georgia", code: "GE", flag: "ge" },
  { name: "Germany", code: "DE", flag: "de" },
  { name: "Ghana", code: "GH", flag: "gh" },
  { name: "Greece", code: "GR", flag: "gr" },
  { name: "Grenada", code: "GD", flag: "gd" },
  { name: "Guatemala", code: "GT", flag: "gt" },
  { name: "Guinea", code: "GN", flag: "gn" },
  { name: "Guinea-Bissau", code: "GW", flag: "gw" },
  { name: "Guyana", code: "GY", flag: "gy" },
  { name: "Haiti", code: "HT", flag: "ht" },
  { name: "Honduras", code: "HN", flag: "hn" },
  { name: "Hungary", code: "HU", flag: "hu" },
  { name: "Iceland", code: "IS", flag: "is" },
  { name: "India", code: "IN", flag: "in" },
  { name: "Indonesia", code: "ID", flag: "id" },
  { name: "Iran", code: "IR", flag: "ir" },
  { name: "Iraq", code: "IQ", flag: "iq" },
  { name: "Ireland", code: "IE", flag: "ie" },
  { name: "Israel", code: "IL", flag: "il" },
  { name: "Italy", code: "IT", flag: "it" },
  { name: "Ivory Coast", code: "CI", flag: "ci" },
  { name: "Jamaica", code: "JM", flag: "jm" },
  { name: "Japan", code: "JP", flag: "jp" },
  { name: "Jordan", code: "JO", flag: "jo" },
  { name: "Kazakhstan", code: "KZ", flag: "kz" },
  { name: "Kenya", code: "KE", flag: "ke" },
  { name: "Kiribati", code: "KI", flag: "ki" },
  { name: "Korea, North", code: "KP", flag: "kp" },
  { name: "Korea, South", code: "KR", flag: "kr" },
  { name: "Kosovo", code: "XK", flag: "xk" },
  { name: "Kuwait", code: "KW", flag: "kw" },
  { name: "Kyrgyzstan", code: "KG", flag: "kg" },
  { name: "Laos", code: "LA", flag: "la" },
  { name: "Latvia", code: "LV", flag: "lv" },
  { name: "Lebanon", code: "LB", flag: "lb" },
  { name: "Lesotho", code: "LS", flag: "ls" },
  { name: "Liberia", code: "LR", flag: "lr" },
  { name: "Libya", code: "LY", flag: "ly" },
  { name: "Liechtenstein", code: "LI", flag: "li" },
  { name: "Lithuania", code: "LT", flag: "lt" },
  { name: "Luxembourg", code: "LU", flag: "lu" },
  { name: "Macedonia", code: "MK", flag: "mk" },
  { name: "Madagascar", code: "MG", flag: "mg" },
  { name: "Malawi", code: "MW", flag: "mw" },
  { name: "Malaysia", code: "MY", flag: "my" },
  { name: "Maldives", code: "MV", flag: "mv" },
  { name: "Mali", code: "ML", flag: "ml" },
  { name: "Malta", code: "MT", flag: "mt" },
  { name: "Marshall Islands", code: "MH", flag: "mh" },
  { name: "Mauritania", code: "MR", flag: "mr" },
  { name: "Mauritius", code: "MU", flag: "mu" },
  { name: "Mexico", code: "MX", flag: "mx" },
  { name: "Micronesia", code: "FM", flag: "fm" },
  { name: "Moldova", code: "MD", flag: "md" },
  { name: "Monaco", code: "MC", flag: "mc" },
  { name: "Mongolia", code: "MN", flag: "mn" },
  { name: "Montenegro", code: "ME", flag: "me" },
  { name: "Morocco", code: "MA", flag: "ma" },
  { name: "Mozambique", code: "MZ", flag: "mz" },
  { name: "Myanmar", code: "MM", flag: "mm" },
  { name: "Namibia", code: "NA", flag: "na" },
  { name: "Nauru", code: "NR", flag: "nr" },
  { name: "Nepal", code: "NP", flag: "np" },
  { name: "Netherlands", code: "NL", flag: "nl" },
  { name: "New Zealand", code: "NZ", flag: "nz" },
  { name: "Nicaragua", code: "NI", flag: "ni" },
  { name: "Niger", code: "NE", flag: "ne" },
  { name: "Nigeria", code: "NG", flag: "ng" },
  { name: "Norway", code: "NO", flag: "no" },
  { name: "Oman", code: "OM", flag: "om" },
  { name: "Pakistan", code: "PK", flag: "pk" },
  { name: "Palau", code: "PW", flag: "pw" },
  { name: "Palestine", code: "PS", flag: "ps" },
  { name: "Panama", code: "PA", flag: "pa" },
  { name: "Papua New Guinea", code: "PG", flag: "pg" },
  { name: "Paraguay", code: "PY", flag: "py" },
  { name: "Peru", code: "PE", flag: "pe" },
  { name: "Philippines", code: "PH", flag: "ph" },
  { name: "Poland", code: "PL", flag: "pl" },
  { name: "Portugal", code: "PT", flag: "pt" },
  { name: "Qatar", code: "QA", flag: "qa" },
  { name: "Romania", code: "RO", flag: "ro" },
  { name: "Russia", code: "RU", flag: "ru" },
  { name: "Rwanda", code: "RW", flag: "rw" },
  { name: "Saint Kitts and Nevis", code: "KN", flag: "kn" },
  { name: "Saint Lucia", code: "LC", flag: "lc" },
  { name: "Saint Vincent and the Grenadines", code: "VC", flag: "vc" },
  { name: "Samoa", code: "WS", flag: "ws" },
  { name: "San Marino", code: "SM", flag: "sm" },
  { name: "Sao Tome and Principe", code: "ST", flag: "st" },
  { name: "Saudi Arabia", code: "SA", flag: "sa" },
  { name: "Senegal", code: "SN", flag: "sn" },
  { name: "Serbia", code: "RS", flag: "rs" },
  { name: "Seychelles", code: "SC", flag: "sc" },
  { name: "Sierra Leone", code: "SL", flag: "sl" },
  { name: "Singapore", code: "SG", flag: "sg" },
  { name: "Slovakia", code: "SK", flag: "sk" },
  { name: "Slovenia", code: "SI", flag: "si" },
  { name: "Solomon Islands", code: "SB", flag: "sb" },
  { name: "Somalia", code: "SO", flag: "so" },
  { name: "South Africa", code: "ZA", flag: "za" },
  { name: "South Sudan", code: "SS", flag: "ss" },
  { name: "Spain", code: "ES", flag: "es" },
  { name: "Sri Lanka", code: "LK", flag: "lk" },
  { name: "Sudan", code: "SD", flag: "sd" },
  { name: "Suriname", code: "SR", flag: "sr" },
  { name: "Swaziland", code: "SZ", flag: "sz" },
  { name: "Sweden", code: "SE", flag: "se" },
  { name: "Switzerland", code: "CH", flag: "ch" },
  { name: "Syria", code: "SY", flag: "sy" },
  { name: "Taiwan", code: "TW", flag: "tw" },
  { name: "Tajikistan", code: "TJ", flag: "tj" },
  { name: "Tanzania", code: "TZ", flag: "tz" },
  { name: "Thailand", code: "TH", flag: "th" },
  { name: "Togo", code: "TG", flag: "tg" },
  { name: "Tonga", code: "TO", flag: "to" },
  { name: "Trinidad and Tobago", code: "TT", flag: "tt" },
  { name: "Tunisia", code: "TN", flag: "tn" },
  { name: "Turkey", code: "TR", flag: "tr" },
  { name: "Turkmenistan", code: "TM", flag: "tm" },
  { name: "Tuvalu", code: "TV", flag: "tv" },
  { name: "Uganda", code: "UG", flag: "ug" },
  { name: "Ukraine", code: "UA", flag: "ua" },
  { name: "United Arab Emirates", code: "AE", flag: "ae" },
  { name: "United Kingdom", code: "GB", flag: "gb" },
  { name: "United States", code: "US", flag: "us" },
  { name: "Uruguay", code: "UY", flag: "uy" },
  { name: "Uzbekistan", code: "UZ", flag: "uz" },
  { name: "Vanuatu", code: "VU", flag: "vu" },
  { name: "Vatican City", code: "VA", flag: "va" },
  { name: "Venezuela", code: "VE", flag: "ve" },
  { name: "Vietnam", code: "VN", flag: "vn" },
  { name: "Yemen", code: "YE", flag: "ye" },
  { name: "Zambia", code: "ZM", flag: "zm" },
  { name: "Zimbabwe", code: "ZW", flag: "zw" }
];

export const getCountryName = (code) => {
  if (!code) return "";
  const country = COUNTRIES.find(c => 
    c.code?.toUpperCase() === code.toUpperCase() || 
    c.name?.toLowerCase() === code.toLowerCase()
  );
  return country?.name || code;
};

export const getCountryFlag = (code) => {
  if (!code) return null;
  const country = COUNTRIES.find(c => 
    c.code?.toUpperCase() === code.toUpperCase() || 
    c.name?.toLowerCase() === code.toLowerCase()
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
