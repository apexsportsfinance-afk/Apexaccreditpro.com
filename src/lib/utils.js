import { format, differenceInYears, differenceInDays, differenceInHours } from "date-fns";

export const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};

export const calculateAge = (dateOfBirth, calculationYear) => {
  const dob = new Date(dateOfBirth);
  const calcDate = new Date(calculationYear, 11, 31);
  return differenceInYears(calcDate, dob);
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
  if (!expiresAt) return "No expiration";
  try {
    const expDate = new Date(expiresAt);
    const now = new Date();
    if (expDate < now) {
      return "Expired";
    }
    const daysLeft = differenceInDays(expDate, now);
    const hoursLeft = differenceInHours(expDate, now);
    if (daysLeft > 30) {
      return `${Math.floor(daysLeft / 30)} months left`;
    } else if (daysLeft > 1) {
      return `${daysLeft} days left`;
    } else if (hoursLeft > 1) {
      return `${hoursLeft} hours left`;
    } else {
      return "Expiring soon";
    }
  } catch {
    return "Unknown";
  }
};

export const getExpirationStatusColor = (expiresAt) => {
  if (!expiresAt) return "bg-slate-500/20 text-slate-300 border border-slate-500/40";
  try {
    const expDate = new Date(expiresAt);
    const now = new Date();
    if (expDate < now) {
      return "bg-red-500/20 text-red-300 border border-red-500/40";
    }
    const daysLeft = differenceInDays(expDate, now);
    if (daysLeft <= 7) {
      return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
    } else if (daysLeft <= 30) {
      return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40";
    } else {
      return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
    }
  } catch {
    return "bg-slate-500/20 text-slate-300 border border-slate-500/40";
  }
};

export const getStatusColor = (status) => {
  switch (status) {
    case "approved":
      return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
    case "rejected":
      return "bg-red-500/20 text-red-300 border border-red-500/40";
    case "pending":
    default:
      return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
  }
};

export const getRoleColor = (role) => {
  switch (role?.toLowerCase()) {
    case "athlete":
      return "bg-ocean-500/20 text-ocean-300 border border-ocean-500/40";
    case "official":
      return "bg-purple-500/20 text-purple-300 border border-purple-500/40";
    case "coach":
      return "bg-primary-500/20 text-primary-300 border border-primary-500/40";
    case "media":
      return "bg-orange-500/20 text-orange-300 border border-orange-500/40";
    case "medical":
      return "bg-rose-500/20 text-rose-300 border border-rose-500/40";
    case "staff":
      return "bg-slate-500/20 text-slate-300 border border-slate-500/40";
    default:
      return "bg-gray-500/20 text-gray-300 border border-gray-500/40";
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

// Role badge prefixes for accreditation badge numbers
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

// Role groups for hierarchical categorization
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
  const country = COUNTRIES.find(c => c.code === code);
  return country?.name || code;
};

export const getCountryFlag = (code) => {
  const country = COUNTRIES.find(c => c.code === code);
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

export const downloadPdfBlob = (blob, fileName) => {
  return new Promise((resolve, reject) => {
    if (!blob || blob.size === 0) {
      reject(new Error("Invalid PDF blob - empty or missing"));
      return;
    }

    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 5000);

      resolve(true);
    } catch (error) {
      console.error("Download error:", error);
      reject(new Error("Failed to download PDF"));
    }
  });
};

export const openPdfInNewTab = (blob) => {
  return new Promise((resolve, reject) => {
    if (!blob || blob.size === 0) {
      reject(new Error("Invalid PDF blob - empty or missing"));
      return;
    }

    try {
      const url = URL.createObjectURL(blob);
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");
      if (!newWindow) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 120000);
      resolve(true);
    } catch (error) {
      console.error("Open in tab error:", error);
      reject(error);
    }
  });
};

export const downloadPdfAsDataUrl = async (blob, fileName) => {
  if (!blob || blob.size === 0) {
    throw new Error("Invalid PDF blob - empty or missing");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = reader.result;
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        link.style.cssText = "position:fixed;left:0;top:0;opacity:0;";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (link.parentNode) {
            document.body.removeChild(link);
          }
          resolve(true);
        }, 500);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read PDF blob"));
    };
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
