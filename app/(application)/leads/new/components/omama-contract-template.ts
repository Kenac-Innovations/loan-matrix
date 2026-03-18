import { format } from "date-fns";
import { ContractData } from "./contract-types";

const DOTS_PATTERN = "[\\._\\u2026]{3,}";
const HTML_SPACE_PATTERN = "(?:\\s|&nbsp;|&#xa0;|&#160;|&#xA0;)";
const HTML_SPACE_OPT = `${HTML_SPACE_PATTERN}*`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatCurrency = (amount?: number | null): string => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "";
  }
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatMaybeCurrency = (value?: string | number | null): string => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return formatCurrency(value);
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return formatCurrency(Number(trimmed));
  }
  const cleaned = trimmed.replace(/[,\\s]/g, "").replace(/[^0-9.-]/g, "");
  if (cleaned && /^-?\d+(\.\d+)?$/.test(cleaned)) {
    return formatCurrency(Number(cleaned));
  }
  return trimmed;
};

const formatDate = (value?: string | number | Date | null | any[]): string => {
  if (!value) return "";
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    ) {
      const d = new Date(year, month - 1, day);
      return Number.isNaN(d.getTime()) ? "" : format(d, "dd/MM/yyyy");
    }
  }
  if (value instanceof Date) {
    return format(value, "dd/MM/yyyy");
  }
  if (typeof value === "number") {
    return format(new Date(value), "dd/MM/yyyy");
  }
  if (typeof value === "string") {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, "dd/MM/yyyy");
    }
    return value;
  }
  return "";
};

const parseDate = (value?: string | number | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]) - 1;
      const year = Number(match[3]);
      const d = new Date(year, month, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const numberToWords = (value: number): string => {
  const ones = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ];
  const teens = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  const toWords = (num: number): string => {
    if (num < 10) return ones[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const remainder = num % 10;
      return `${tens[Math.floor(num / 10)]}${remainder ? "-" + ones[remainder] : ""}`;
    }
    if (num < 1000) {
      const remainder = num % 100;
      return `${ones[Math.floor(num / 100)]} hundred${remainder ? " " + toWords(remainder) : ""}`;
    }
    if (num < 1_000_000) {
      const remainder = num % 1000;
      return `${toWords(Math.floor(num / 1000))} thousand${remainder ? " " + toWords(remainder) : ""}`;
    }
    if (num < 1_000_000_000) {
      const remainder = num % 1_000_000;
      return `${toWords(Math.floor(num / 1_000_000))} million${remainder ? " " + toWords(remainder) : ""}`;
    }
    return String(num);
  };

  const integerPart = Math.floor(Math.abs(value));
  const words = toWords(integerPart);
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const getValueByPath = (obj: any, path: string): any => {
  if (!obj) return undefined;
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
};

const findValueByKeyMatch = (obj: any, pattern: RegExp): string | undefined => {
  if (!obj || typeof obj !== "object") return undefined;
  const queue: Array<{ key: string; value: any }> = Object.entries(obj).map(
    ([key, value]) => ({ key, value })
  );
  while (queue.length > 0) {
    const { key, value } = queue.shift()!;
    if (pattern.test(key)) {
      if (typeof value === "string" && value.trim()) return value;
      if (typeof value === "number" && !Number.isNaN(value)) return String(value);
    }
    if (value && typeof value === "object") {
      for (const [childKey, childVal] of Object.entries(value)) {
        queue.push({ key: childKey, value: childVal });
      }
    }
  }
  return undefined;
};

const formatAddressFromObject = (address: any): string | undefined => {
  if (!address || typeof address !== "object") return undefined;
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.addressLine3,
    address.street,
    address.streetAddress,
    address.city,
    address.townVillage,
    address.town,
    address.village,
    address.district,
    address.stateProvince,
    address.stateProvinceName,
    address.postalCode,
    address.address,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part: string) => part.trim());
  return parts.length > 0 ? parts.join(", ") : undefined;
};

const normalizeGender = (value?: string | null): "male" | "female" | "" => {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) {
    if (normalized === "1") return "male";
    if (normalized === "2") return "female";
  }
  if (normalized.startsWith("f") || normalized.includes("female")) return "female";
  if (normalized.startsWith("m") || normalized.includes("male")) return "male";
  return "";
};

const pickValue = (data: ContractData, keys: string[]): any => {
  const sources = [data, data.stateContext, data.stateMetadata];
  for (const key of keys) {
    for (const source of sources) {
      const value = getValueByPath(source, key);
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return undefined;
};

const replaceAfterLabel = (
  html: string,
  label: string,
  value?: string | number | null
): string => {
  if (value === undefined || value === null || value === "") return html;
  const safeValue = escapeHtml(String(value));
  const pattern = new RegExp(
    `(${escapeRegExp(label)}\\s*)${DOTS_PATTERN}`,
    "i"
  );
  return html.replace(pattern, `$1${safeValue}`);
};

const replaceAllAfterLabel = (
  html: string,
  label: string,
  value?: string | number | null
): string => {
  if (value === undefined || value === null || value === "") return html;
  const safeValue = escapeHtml(String(value));
  const pattern = new RegExp(
    `(${escapeRegExp(label)}\\s*)${DOTS_PATTERN}`,
    "gi"
  );
  return html.replace(pattern, `$1${safeValue}`);
};

export const fillOmamaContractTemplate = (
  html: string,
  data: ContractData
): string => {
  let output = html;

  const firstName =
    data.firstname ||
    pickValue(data, ["firstname", "firstName", "clientFirstName"]);
  const middleName =
    data.middlename ||
    pickValue(data, ["middlename", "middleName", "clientMiddleName"]);
  const lastName =
    data.lastname ||
    pickValue(data, ["lastname", "lastName", "surname", "clientLastName"]);

  const clientName = data.clientName || [firstName, middleName, lastName].filter(Boolean).join(" ");
  const firstNames =
    [firstName, middleName].filter(Boolean).join(" ") ||
    (clientName ? clientName.split(" ").slice(0, -1).join(" ") : "");
  const surname =
    lastName ||
    (clientName ? clientName.split(" ").slice(-1).join(" ") : "");

  const rawPhone =
    data.mobileNo ||
    pickValue(data, [
      "mobileNo",
      "phone",
      "cell",
      "cellNumber",
      "contactNumber",
      "primaryPhone",
    ]);
  const phone =
    rawPhone && data.countryCode && !String(rawPhone).startsWith("+")
      ? `${data.countryCode}${rawPhone}`
      : rawPhone;

  const accountNumber =
    data.accountNumber ||
    pickValue(data, ["accountNumber", "accountNo", "bankAccountNo"]);

  const loanAmount = formatCurrency(data.loanAmount);
  const schedule = Array.isArray(data.repaymentSchedule)
    ? data.repaymentSchedule
    : [];
  const scheduleTotal =
    schedule.length > 0
      ? schedule.reduce((sum, p) => sum + (p.paymentAmount || 0), 0)
      : undefined;
  const loanDate = formatDate(
    data.loanDate ||
      pickValue(data, ["expectedDisbursementDate", "submittedOnDate"]) ||
      null
  );
  const borrowingCount =
    data.existingLoans ||
    pickValue(data, ["existingLoans", "loanCount", "timesBorrowing"]);

  const idNumber =
    data.nrc ||
    pickValue(data, ["nrc", "idNumber", "nationalId", "nationalIdNumber"]);

  const stateContext = (data.stateContext ?? {}) as Record<string, any>;
  const stateMetadata = (data.stateMetadata ?? {}) as Record<string, any>;

  const gender =
    data.gender ||
    pickValue(data, ["gender", "sex", "clientGender"]) ||
    findValueByKeyMatch(stateContext, /gender|sex/i) ||
    findValueByKeyMatch(stateMetadata, /gender|sex/i);
  const rawDateOfBirth =
    data.dateOfBirth ||
    pickValue(data, ["dateOfBirth", "dob", "birthDate", "date_of_birth"]) ||
    findValueByKeyMatch(stateContext, /date.*birth|dob|birthDate/i) ||
    findValueByKeyMatch(stateMetadata, /date.*birth|dob|birthDate/i) ||
    null;
  const dateOfBirth = formatDate(rawDateOfBirth);

  const contextResidentialAddress =
    formatAddressFromObject((stateContext as any)?.clientAddress) ||
    formatAddressFromObject((stateMetadata as any)?.clientAddress);

  const residentialAddress =
    data.residentialAddress ||
    pickValue(data, [
      "residentialAddress",
      "physicalAddress",
      "homeAddress",
      "address",
    ]) ||
    contextResidentialAddress ||
    findValueByKeyMatch(
      stateContext,
      /(residential|physical|home).*address|addressLine|streetAddress|street|townVillage|town|city|village|district|postal|address(?!Type|Id)/i
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /(residential|physical|home).*address|addressLine|streetAddress|street|townVillage|town|city|village|district|postal|address(?!Type|Id)/i
    );

  const workAddress =
    data.workAddress ||
    pickValue(data, ["workAddress", "employerAddress", "placeOfWorkAddress"]) ||
    findValueByKeyMatch(
      stateContext,
      /work.*address|employer.*address|business.*address|office.*address|workplace/i
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /work.*address|employer.*address|business.*address|office.*address|workplace/i
    );
  const workPhone =
    pickValue(data, [
      "workPhone",
      "employerPhone",
      "businessPhone",
      "workContact",
      "employerContact",
      "officePhone",
    ]) ||
    findValueByKeyMatch(
      stateContext,
      /work.*phone|employer.*phone|business.*phone|office.*phone|work.*contact/i
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /work.*phone|employer.*phone|business.*phone|office.*phone|work.*contact/i
    );
  const title =
    pickValue(data, ["title", "salutation", "prefix", "honorific"]) ||
    findValueByKeyMatch(stateContext, /title|salutation|prefix|honorific/i) ||
    findValueByKeyMatch(stateMetadata, /title|salutation|prefix|honorific/i);
  const maritalStatus =
    pickValue(data, [
      "maritalStatus",
      "marital",
      "relationshipStatus",
      "familyStatus",
    ]);
  const businessLocation =
    pickValue(data, [
      "businessLocation",
      "workLocation",
      "placeOfWork",
      "businessAddress",
      "workPlace",
    ]) ||
    findValueByKeyMatch(
      stateContext,
      /business.*location|work.*location|placeOfWork|workplace/i
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /business.*location|work.*location|placeOfWork|workplace/i
    ) ||
    workAddress;

  const employmentStatus =
    data.employmentStatus ||
    pickValue(data, ["employmentStatus", "occupation", "jobTitle"]) ||
    findValueByKeyMatch(
      stateContext,
      /employmentStatus|occupation|jobTitle|job|work/i
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /employmentStatus|occupation|jobTitle|job|work/i
    );
  const businessType =
    data.businessType || pickValue(data, ["businessType", "business"]);
  const employerName =
    data.employer ||
    data.employerName ||
    pickValue(data, ["employer", "employerName", "placeOfWork"]);

  const yearsInBusiness =
    data.yearsEmployed ||
    data.yearsAtCurrentJob ||
    pickValue(data, ["yearsEmployed", "yearsAtCurrentJob", "yearsInBusiness"]);

  const monthlyIncome =
    data.monthlyIncome ||
    data.grossMonthlyIncome ||
    data.monthlyIncomeRange ||
    pickValue(data, [
      "monthlyIncome",
      "grossMonthlyIncome",
      "monthlyIncomeRange",
      "monthlyIncomeBand",
      "monthlySalary",
      "netMonthlyIncome",
      "salary",
      "incomePerMonth",
      "incomeMonthly",
    ]) ||
    findValueByKeyMatch(
      stateContext,
      /monthly.*income|monthly.*salary|salary|net.*income|gross.*income/i
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /monthly.*income|monthly.*salary|salary|net.*income|gross.*income/i
    );

  const requestedAmount =
    data.requestedAmount || pickValue(data, ["requestedAmount"]) || data.loanAmount;

  const loanPurpose =
    data.loanPurpose || pickValue(data, ["loanPurpose", "purpose"]);

  const spouseName =
    data.spouseName || pickValue(data, ["spouseName", "husbandName", "wifeName"]);
  const spousePhone =
    data.spousePhone || pickValue(data, ["spousePhone", "husbandPhone", "wifePhone"]);

  const familyMember = data.familyMembers?.[0];
  const guarantorMember = data.familyMembers?.find((member) => {
    const rel = (member.relationship || "").toLowerCase();
    return rel.includes("guarantor") || rel.includes("surety");
  });
  const closestRelativeName =
    data.closestRelativeName ||
    pickValue(data, ["closestRelativeName", "nextOfKinName", "relativeName"]) ||
    (familyMember
      ? [familyMember.firstname, familyMember.middlename, familyMember.lastname]
          .filter(Boolean)
          .join(" ")
      : undefined);
  const closestRelativePhone =
    data.closestRelativePhone ||
    pickValue(data, ["closestRelativePhone", "nextOfKinPhone", "relativePhone"]) ||
    familyMember?.mobileNo;
  const closestRelativeRelationship =
    data.closestRelativeRelationship ||
    pickValue(data, ["closestRelativeRelationship", "nextOfKinRelationship"]) ||
    familyMember?.relationship;

  const guarantorName =
    pickValue(data, [
      "guarantorName",
      "guarantorFullName",
      "guarantor.name",
      "guarantor.fullName",
      "suretyName",
    ]) ||
    (guarantorMember
      ? [guarantorMember.firstname, guarantorMember.middlename, guarantorMember.lastname]
          .filter(Boolean)
          .join(" ")
      : undefined);
  const guarantorId =
    pickValue(data, [
      "guarantorId",
      "guarantorIdNumber",
      "guarantor.idNumber",
      "guarantor.nationalId",
      "suretyId",
    ]);
  const guarantorPhone =
    pickValue(data, [
      "guarantorPhone",
      "guarantorTelephone",
      "guarantor.mobileNo",
      "suretyPhone",
    ]) ||
    guarantorMember?.mobileNo;
  const guarantorAddress =
    pickValue(data, [
      "guarantorAddress",
      "guarantor.address",
      "guarantor.residentialAddress",
      "suretyAddress",
    ]);

  const collateralType =
    data.collateralType || pickValue(data, ["collateralType", "securityType"]);
  const collateralValue =
    data.collateralValue || pickValue(data, ["collateralValue"]);

  const rawCollaterals =
    pickValue(data, [
      "loanTerms.collaterals",
      "collaterals",
      "collateralItems",
      "securityItems",
      "pledgedAssets",
      "assets",
    ]) || [];
  const collateralItems = Array.isArray(rawCollaterals)
    ? rawCollaterals
        .map((item: any) => {
          if (!item) return "";
          if (typeof item === "string") return item;
          const name =
            item.name ||
            item.type ||
            item.description ||
            item.collateralType ||
            item.asset ||
            "";
          const quantity =
            item.quantity !== undefined && item.quantity !== null
              ? ` x${item.quantity}`
              : "";
          const value =
            item.totalValue ?? item.value ?? item.totalCollateralValue ?? null;
          const valueText =
            value !== null && value !== undefined && value !== ""
              ? ` ($${formatCurrency(Number(value))})`
              : "";
          return `${name}${quantity}${valueText}`.trim();
        })
        .filter(Boolean)
    : [];
  const fallbackCollateralItem =
    collateralType || collateralValue
      ? `${collateralType || "Collateral"}${
          collateralValue ? ` ($${formatCurrency(Number(collateralValue))})` : ""
        }`
      : "";
  const securityItems =
    collateralItems.length > 0
      ? collateralItems
      : fallbackCollateralItem
        ? [fallbackCollateralItem]
        : [];

  const principalWords = data.loanAmount
    ? numberToWords(data.loanAmount)
    : "";

  const interestRatePct =
    data.nominalInterestRate ??
    data.monthlyPercentageRate ??
    pickValue(data, [
      "interestRate",
      "interestRatePct",
      "monthlyInterestRate",
      "annualInterestRate",
      "loanTerms.nominalInterestRate",
      "loanTerms.interestRate",
      "loanTerms.annualInterestRate",
      "stateMetadata.loanTerms.nominalInterestRate",
    ]) ??
    0;
  const interestRateStr =
    interestRatePct !== undefined && interestRatePct !== null && !Number.isNaN(Number(interestRatePct))
      ? String(Number(interestRatePct).toFixed(2))
      : "";
  const executionPlace =
    data.executionPlace ||
    data.branch ||
    pickValue(data, ["executionPlace", "branch", "officeName"]) ||
    "";
  const executionDay = data.executionDay ?? "";
  const executionMonth = data.executionMonth ?? "";
  const executionYear = data.executionYear ?? "";
  const executionDate = data.executionDate || loanDate || "";
  const disbursedAmountStr = formatCurrency(data.disbursedAmount ?? data.loanAmount);
  const totalDebtStr =
    formatCurrency(data.totalRepayment ?? scheduleTotal ?? data.loanAmount) ||
    loanAmount ||
    "";
  const paymentPerPeriodStr =
    formatCurrency(
      data.paymentPerPeriod ??
        (schedule.length > 0 ? scheduleTotal! / schedule.length : undefined)
    );
  const firstPaymentDateVal =
    data.firstPaymentDate ||
    data.loanDate ||
    loanDate;
  const firstPaymentDateStr = formatDate(firstPaymentDateVal || null);
  const scheduleDates = schedule
    .map((p: any) => formatDate(p?.dueDate || ""))
    .filter(Boolean);
  const lastScheduleDate = scheduleDates.length
    ? scheduleDates[scheduleDates.length - 1]
    : "";
  const paymentByDate = lastScheduleDate || firstPaymentDateStr || "";

  // Fix typos in template for readability
  output = output.replace(/\bPENALLTY\b/gi, "PENALTY");
  output = output.replace(/\bPEANALTY\b/gi, "PENALTY");
  output = output.replace(/domicilie\s+citationet\s+executandi/gi, "domicilium citandi et executandi");
  output = output.replace(/domicile\s+citation\s+et\s+executandi/gi, "domicilium citandi et executandi");

  // Current date on user's machine (for declaration and THUS DONE)
  const currentDateStr = format(new Date(), "dd/MM/yyyy");
  const currentDay = format(new Date(), "d");
  const currentMonth = format(new Date(), "MMMM");
  const currentYear = format(new Date(), "yyyy");

  // Header section – ensure spaces between label and value for readability
  output = replaceAfterLabel(output, "NAME OF INDIVIDUAL:", clientName);

  // CELL NUMBER and ACC No on two separate lines for readability
  const cellAccPattern = new RegExp(
    `(CELL NUMBER\\s*)${DOTS_PATTERN}\\s*(ACC No\\.?\\s*)${DOTS_PATTERN}`,
    "gi"
  );
  output = output.replace(cellAccPattern, () => {
    const phoneVal = phone ? escapeHtml(String(phone)) : "_____________________";
    const accVal = accountNumber ? escapeHtml(String(accountNumber)) : "_____________________";
    return `CELL NUMBER ${phoneVal} ACC No ${accVal}`;
  });
  output = replaceAfterLabel(output, "CELL NUMBER", phone);
  output = replaceAfterLabel(output, "ACC No", accountNumber);
  output = replaceAfterLabel(output, "ACC No\\.", accountNumber);
  if (loanAmount || loanDate) {
    const loanLinePattern =
      /LOAN PRINCIPAL\s*\$\s*[._\u2026]{3,}[\s\S]*?LOAN DATE[\s\S]*?LOAN PRINCIPAL\$[._\u2026]{3,}[\s\S]*?LOAN DATE[._\u2026]{3,}/i;
    output = output.replace(loanLinePattern, (line) => {
      const amt = loanAmount ? escapeHtml(loanAmount) : "__________";
      const dt = loanDate ? escapeHtml(loanDate) : "__________";
      let updated = line.replace(
        /(LOAN PRINCIPAL\s*\$\s*)[._\u2026]{3,}/i,
        `$1${amt}`
      );
      updated = updated.replace(
        /(LOAN DATE)\s*(?:[._\u2026]{3,}|\/\s*\/\s*\d{4})/i,
        `LOAN DATE ${dt}`
      );
      return updated;
    });
  }
  if (borrowingCount !== undefined && borrowingCount !== null && borrowingCount !== "") {
    const timesPattern = new RegExp(
      `(No of times borrowing)${DOTS_PATTERN}([\\s\\S]*?)(No of times borrowing)${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(timesPattern, (_m, label1, mid, label2) => {
      const val = escapeHtml(String(borrowingCount));
      return `${label1} ${val}${mid}${label2} ${"................"}`;
    });
  }

  // Loan application form – ensure spaces between fields for readability
  if (surname || firstNames || idNumber) {
    const pattern = new RegExp(
      `Surname:\\s*${DOTS_PATTERN}\\s*First names:\\s*${DOTS_PATTERN}\\s*ID\\s*${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(pattern, () => {
      const s = escapeHtml(surname || "");
      const f = escapeHtml(firstNames || "");
      const id = escapeHtml(String(idNumber || ""));
      return `Surname: ${s}  First names: ${f}  ID ${id}`;
    });
    output = output.replace(
      new RegExp(`Surname:\\s*${DOTS_PATTERN}`, "gi"),
      `Surname: ${escapeHtml(surname || "")} `
    );
    output = output.replace(
      new RegExp(`First names:\\s*${DOTS_PATTERN}`, "gi"),
      `First names: ${escapeHtml(firstNames || "")} `
    );
    output = output.replace(
      new RegExp(`ID\\s*${DOTS_PATTERN}`, "gi"),
      `ID ${escapeHtml(String(idNumber || ""))}`
    );
  }

  if (title || gender || dateOfBirth) {
    const normalizedGender = normalizeGender(gender);
    const maleSelected = normalizedGender === "male";
    const femaleSelected = normalizedGender === "female";
    const dobText = dateOfBirth ? escapeHtml(String(dateOfBirth)) : "__________";
    const titleText = title ? ` ${escapeHtml(String(title))}` : "";
    const titleGenderMarkup = `Title: Mr/Mrs., Miss, Dr, Reverend, other (Tick):${titleText} Gender<span style="font-weight:normal">: </span><span class="gender-choice${
      maleSelected ? " selected" : ""
    }" style="font-weight:normal">Male</span> / <span class="gender-choice${
      femaleSelected ? " selected" : ""
    }" style="font-weight:normal">Female</span><span style="font-weight:normal">. Date of Birth ${dobText}</span>`;

    const titleGenderPattern = new RegExp(
      `Title:[\\s\\S]{0,200}?Date of Birth${HTML_SPACE_OPT}${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(titleGenderPattern, titleGenderMarkup);
  }

  if (residentialAddress || phone) {
    const addressPattern = new RegExp(
      `Physical Res\\. Address${HTML_SPACE_OPT}${DOTS_PATTERN}[\\s\\S]*?Phone${HTML_SPACE_OPT}${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(addressPattern, () => {
      const addrText = residentialAddress
        ? escapeHtml(String(residentialAddress))
        : "________________________";
      const phoneText = phone ? escapeHtml(String(phone)) : "____________";
      return `Physical Res. Address ${addrText} Phone ${phoneText}`;
    });
  }

  if (employerName || workAddress || phone) {
    const workPattern = new RegExp(
      `Place of work & Physical Address${HTML_SPACE_OPT}${DOTS_PATTERN}[\\s\\S]*?Phone${HTML_SPACE_OPT}${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(workPattern, () => {
      const placeText = escapeHtml(String(employerName || workAddress || ""));
      const phoneVal = workPhone || phone;
      const phoneText = phoneVal ? escapeHtml(String(phoneVal)) : "____________";
      return `Place of work & Physical Address ${placeText} Phone ${phoneText}`;
    });
  }

  if (spouseName || spousePhone) {
    const spousePattern = /Name of wife\/husband\s*[._\u2026]{3,}Tel:\s*[._\u2026]{3,}/i;
    output = output.replace(spousePattern, () => {
      const nameText = spouseName ? escapeHtml(String(spouseName)) : "_____________________";
      const phoneText = spousePhone ? escapeHtml(String(spousePhone)) : "______________";
      return `Name of wife/husband ${nameText} Tel: ${phoneText}`;
    });
  }

  if (maritalStatus) {
    output = output.replace(
      /(Marital status:\s*)[_\u2026]{3,}/i,
      `$1${escapeHtml(String(maritalStatus))}`
    );
  }

  if (closestRelativeName || closestRelativePhone) {
    const relativePattern = /Name of closest relative:\s*[._\u2026]{3,}Tel:\s*[._\u2026]{3,}/i;
    output = output.replace(relativePattern, () => {
      const nameText = closestRelativeName
        ? escapeHtml(String(closestRelativeName))
        : "_____________________";
      const phoneText = closestRelativePhone
        ? escapeHtml(String(closestRelativePhone))
        : "______________";
      return `Name of closest relative: ${nameText} Tel: ${phoneText}`;
    });
  }

  if (closestRelativeRelationship) {
    output = output.replace(
      /(Relation\/[^_]*?)[_\u2026]{3,}/i,
      `$1${escapeHtml(String(closestRelativeRelationship))}`
    );
  }

  // Occupation / business (including Shona "Munoita nezvei?")
  const occupationText =
    employmentStatus ||
    businessType ||
    employerName ||
    findValueByKeyMatch(data.stateContext, /occupation|job|business|trade/i) ||
    findValueByKeyMatch(data.stateMetadata, /occupation|job|business|trade/i) ||
    "";
  if (occupationText) {
    output = output.replace(
      new RegExp(`(Munoita nezvei\\?${HTML_SPACE_OPT})${DOTS_PATTERN}`, "gi"),
      `$1${escapeHtml(String(occupationText))}`
    );
    output = output.replace(
      new RegExp(`(What business or job do you do\\?${HTML_SPACE_OPT})${DOTS_PATTERN}`, "gi"),
      `$1${escapeHtml(String(occupationText))}`
    );
  }
  output = output.replace(
    new RegExp(`(What business or job do you do\\?[^_]*?)${DOTS_PATTERN}`, "gi"),
    (match, prefix) => {
      const jobText = escapeHtml(String(occupationText || "_____________________"));
      return `${prefix}${jobText}`;
    }
  );

  if (businessLocation) {
    const locationPattern = new RegExp(
      `(Where do you operate your business from[\\s\\S]{0,400}?)(?:${HTML_SPACE_OPT})${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(locationPattern, (_match, prefix) => {
      return `${prefix}${escapeHtml(String(businessLocation))}`;
    });
  }

  if (yearsInBusiness || monthlyIncome) {
    const yearsText = yearsInBusiness ? escapeHtml(String(yearsInBusiness)) : "______";
    const incomeText = monthlyIncome
      ? escapeHtml(formatMaybeCurrency(monthlyIncome))
      : "______";
    const yearsPattern = new RegExp(
      `(Years\\/Months in Business or at work[\\s\\S]{0,120}?:${HTML_SPACE_OPT})${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(yearsPattern, `$1${yearsText}`);
    const salaryPattern = new RegExp(
      `(salary${HTML_SPACE_OPT}\\$)${HTML_SPACE_OPT}${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(salaryPattern, `$1${incomeText}`);
  }

  if (requestedAmount || loanPurpose) {
    const reqPattern =
      /Required Loan Amount[^$]*\$[_\u2026]{3,}[^L]*Loan Purpose\/[^_]*[_\u2026]{3,}/i;
    output = output.replace(reqPattern, () => {
      const amountText = requestedAmount
        ? escapeHtml(formatCurrency(Number(requestedAmount)))
        : "______";
      const purposeText = loanPurpose ? escapeHtml(String(loanPurpose)) : "__________________";
      return `Required Loan Amount $${amountText} Loan Purpose/ ${purposeText}`;
    });
  }

  if (securityItems.length > 0) {
    const proposedSecurityLine = /1[.\s\u2026]{3,}2[.\s\u2026]{3,}3[.\s\u2026]{3,}4[.\s\u2026]{3,}5[.\s\u2026]{3,}/i;
    const proposedText = [0, 1, 2, 3, 4]
      .map((idx) => `${idx + 1} ${escapeHtml(String(securityItems[idx] || "________________"))}`)
      .join(" ");
    output = output.replace(proposedSecurityLine, proposedText);
  }

  // Declaration & Signature: Date (isai zuva ranhasi) and Place – use current date on user's machine
  output = output.replace(
    new RegExp(
      `(Date \\(isai zuva ranhasi\\):\\s*)${DOTS_PATTERN}`,
      "gi"
    ),
    `Date (isai zuva ranhasi): ${escapeHtml(currentDateStr)}`
  );
  output = output.replace(
    new RegExp(
      `(Place \\(nyorai nzvimbo kana Guta ramuri\\)\\s*)${DOTS_PATTERN}`,
      "gi"
    ),
    `Place (nyorai nzvimbo kana Guta ramuri) ${escapeHtml(executionPlace || "___________________")}`
  );
  output = replaceAllAfterLabel(output, "Date (isai zuva ranhasi)", currentDateStr);
  output = replaceAfterLabel(output, "Place (nyorai nzvimbo", executionPlace);

  if (clientName) {
    const signaturePattern =
      /Borrower:\s*[._\u2026]{3,}\s*\(Signature\)/i;
    output = output.replace(signaturePattern, () => {
      return `Borrower: ${escapeHtml(String(clientName))} (Signature)`;
    });
  }

  if (clientName || idNumber) {
    const idPattern = /I[._\u2026]{3,}ID Number[._\u2026]{3,}/gi;
    output = output.replace(idPattern, () => {
      const nameText = clientName ? escapeHtml(String(clientName)) : "________________";
      const idText = idNumber ? escapeHtml(String(idNumber)) : "________________";
      return `I ${nameText} ID Number ${idText}`;
    });
  }

  if (clientName) {
    output = output.replace(/[._\u2026]{3,}\s*\(NAME IN\s*FULL\)/gi, `${escapeHtml(String(clientName))} (NAME IN FULL)`);
    output = output.replace(
      /I,?\s*[._\u2026]{3,}\s*\(NAME IN FULL\)/gi,
      `I, ${escapeHtml(String(clientName))} (NAME IN FULL)`
    );
  }

  if (clientName) {
    output = output.replace(/[._\u2026]{3,}\s*\(Borrower\)/i, `${escapeHtml(String(clientName))} (Borrower)`);
  }

  if (residentialAddress) {
    output = output.replace(/\(address\)/i, `(address) ${escapeHtml(String(residentialAddress))}`);
  }

  if (loanAmount || principalWords || loanPurpose) {
    const principalPattern =
      /Principal US\$ \(NOT RTGS\$\)\s*[._\u2026]{3,}\s*Word\s*[._\u2026]{3,}\s*Loan Purpose:\s*[._\u2026]{3,}/i;
    output = output.replace(principalPattern, () => {
      const amountText = loanAmount ? escapeHtml(loanAmount) : "________";
      const wordsText = principalWords ? escapeHtml(principalWords) : "__________________________";
      const purposeText = loanPurpose ? escapeHtml(String(loanPurpose)) : "__________";
      return `Principal US$ (NOT RTGS$) ${amountText} Word ${wordsText} Loan Purpose: ${purposeText}`;
    });
  }

  if (collateralType || collateralValue) {
    const collateralText = [
      collateralType ? `Type: ${collateralType}` : null,
      collateralValue ? `Value: ${formatCurrency(collateralValue)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    if (collateralText) {
      output = output.replace(
        /Some of the pledged assets include:/i,
        `Some of the pledged assets include: ${escapeHtml(collateralText)}`
      );
    }
  }

  if (securityItems.length > 0) {
    const pledgedLine = /1[.\s\u2026]{5,}2[.\s\u2026]{5,}3[.\s\u2026]{5,}/i;
    const pledgedText = [0, 1, 2]
      .map((idx) => `${idx + 1} ${escapeHtml(String(securityItems[idx] || "________________"))}`)
      .join(" ");
    output = output.replace(pledgedLine, pledgedText);
  }

  if (clientName) {
    output = output.replace(
      /PLEDGE AGREEMENT BETWEEN:\s*\(NAME\)[._\u2026]{3,}/i,
      `PLEDGE AGREEMENT BETWEEN: (NAME) ${escapeHtml(String(clientName))}`
    );
  }

  if (idNumber) {
    output = output.replace(
      /I\.D\s*[._\u2026]{3,}/i,
      `I.D ${escapeHtml(String(idNumber))}`
    );
  }

  if (securityItems.length > 0) {
    const regardingPattern =
      /Regarding:\s*1\.[_\u2026]{3,}\s*2\.[_\u2026]{3,}\s*3\.[_\u2026]{3,}\s*4\.[_\u2026]{3,}\s*5\.[_\u2026]{3,}/i;
    const regardingText = [0, 1, 2, 3, 4]
      .map((idx) => `${idx + 1}. ${escapeHtml(String(securityItems[idx] || "________________"))}`)
      .join(" ");
    output = output.replace(regardingPattern, `Regarding: ${regardingText}`);
  }

  if (guarantorName || guarantorAddress || guarantorId || guarantorPhone) {
    const nameText = guarantorName || "___________________";
    const addressText = guarantorAddress || "___________________";
    const idText = guarantorId || "___________________";
    const phoneText = guarantorPhone || "____________";
    output = output.replace(
      new RegExp(
        `I\\s*${DOTS_PATTERN}\\s*of\\s*${DOTS_PATTERN}\\s*\\(domicilium citandi\\/ serving address\\)\\s*ID no\\s*${DOTS_PATTERN}\\s*Tel\\s*${DOTS_PATTERN}`,
        "i"
      ),
      `I ${escapeHtml(String(nameText))} of ${escapeHtml(String(addressText))} (domicilium citandi/ serving address) ID no ${escapeHtml(String(idText))} Tel ${escapeHtml(String(phoneText))}`
    );
  }

  if (executionDate) {
    output = output.replace(
      new RegExp(`(from this date\\s*)${DOTS_PATTERN}\\s*\\(date\\)`, "i"),
      `from this date ${escapeHtml(String(executionDate))} (date)`
    );
  }

  if (clientName) {
    output = output.replace(
      /[_\u2026]{3,}\s*\(hereinafter called the [“"']Borrower[”"']\)/i,
      `${escapeHtml(String(clientName))} (hereinafter called the “Borrower”)`
    );
  }

  if (guarantorName) {
    output = output.replace(
      /Signed:\s*[._\u2026]{3,}\s*\(Guarantor\)/i,
      `Signed: ${escapeHtml(String(guarantorName))} (Guarantor)`
    );
  }

  // Interest rate % per month (e.g. "at the rate of........ % per month")
  if (interestRateStr) {
    output = output.replace(
      new RegExp(`(rate of\\s*)${DOTS_PATTERN}(\\s*%\\s*per\\s*month)`, "gi"),
      `rate of ${escapeHtml(interestRateStr)} % per month`
    );
    output = output.replace(
      /rate[\s\S]{0,120}?<span[^>]*>[._\u2026]{3,}<\/span>[\s\S]{0,40}?%/gi,
      (match) =>
        match.replace(
          /<span[^>]*>[._\u2026]{3,}<\/span>/i,
          escapeHtml(interestRateStr)
        )
    );
  }

  // Domicilium citandi et executandi (address)
  if (residentialAddress) {
    output = output.replace(
      new RegExp(
        `(domicilium citandi et executandi\\s+at\\s*)${DOTS_PATTERN}`,
        "gi"
      ),
      `domicilium citandi et executandi at ${escapeHtml(String(residentialAddress))}`
    );
    output = output.replace(
      new RegExp(`(choose domicilium citandi et executandi at\\s*)${DOTS_PATTERN}`, "gi"),
      `choose domicilium citandi et executandi at ${escapeHtml(String(residentialAddress))}`
    );
    output = output.replace(
      /domicilium citandi\s*\(address\)/i,
      `domicilium citandi (address) ${escapeHtml(String(residentialAddress))}`
    );
  }

  // Execution block: "THUS DONE and AGREED AT ... this ... day of ... 202..." – use current date on user's machine
  const thusDonePlace = executionPlace || "___________________";
  const thusDoneDay = currentDay || executionDay;
  const thusDoneMonth = currentMonth || executionMonth;
  const thusDoneYear = currentYear || executionYear;
  output = output.replace(
    new RegExp(
      `THUS DONE and AGREED AT\\s*${DOTS_PATTERN}\\s*this\\s*${DOTS_PATTERN}\\s*day of\\s*${DOTS_PATTERN}\\s*202[._\\u2026]*`,
      "gi"
    ),
    `THUS DONE and AGREED AT ${escapeHtml(thusDonePlace)} this ${escapeHtml(thusDoneDay)} day of ${escapeHtml(thusDoneMonth)} ${escapeHtml(thusDoneYear)}`
  );
  output = output.replace(
    new RegExp(
      `(THUS DONE and AGREED AT\\s*)${DOTS_PATTERN}`,
      "gi"
    ),
    `THUS DONE and AGREED AT ${escapeHtml(thusDonePlace)}`
  );
  output = output.replace(
    /THUS DONE and AGREED AT[\s\S]{0,300}?day[\s\S]{0,80}?of[\s\S]{0,160}?(202[._\u2026]*|\d{4})/gi,
    `THUS DONE and AGREED AT ${escapeHtml(thusDonePlace)} this ${escapeHtml(thusDoneDay)} day of ${escapeHtml(thusDoneMonth)} ${escapeHtml(thusDoneYear)}`
  );
  output = output.replace(
    /THUS DONE and AGREED AT[\s\S]{0,300}?(202[._\u2026]*|\d{4})/gi,
    `THUS DONE and AGREED AT ${escapeHtml(thusDonePlace)} this ${escapeHtml(thusDoneDay)} day of ${escapeHtml(thusDoneMonth)} ${escapeHtml(thusDoneYear)}`
  );

  // Acknowledgement of debt: sum of USD$, monthly payment, first payment date
  if (totalDebtStr) {
    output = replaceAllAfterLabel(output, "sum of USD$", totalDebtStr);
    output = replaceAllAfterLabel(output, "sum of $", totalDebtStr);
    output = replaceAllAfterLabel(output, "in the sum of USD$", totalDebtStr);
    output = output.replace(
      new RegExp(
        `(indebtedness to OMAMA FINANCE in the sum of USD\\$\\s*)${DOTS_PATTERN}`,
        "gi"
      ),
      `indebtedness to OMAMA FINANCE in the sum of USD$ ${escapeHtml(totalDebtStr)}`
    );
    output = output.replace(
      /(USD\$)\.?\s*<span[^>]*>[._\u2026]{3,}<\/span>/gi,
      `$1 ${escapeHtml(totalDebtStr)}`
    );
  }
  if (paymentPerPeriodStr) {
    output = replaceAllAfterLabel(output, "reduction of the debt of USD$", paymentPerPeriodStr);
    output = replaceAllAfterLabel(output, "minimum amount in reduction of the debt of USD$", paymentPerPeriodStr);
    output = output.replace(
      /(debt of USD\$)\s*<span[^>]*>[._\u2026]{3,}<\/span>/gi,
      `$1 ${escapeHtml(paymentPerPeriodStr)}`
    );
  }
  if (paymentByDate) {
    output = output.replace(
      new RegExp(
        `(first payment to be made by the${HTML_SPACE_OPT})${DOTS_PATTERN}`,
        "gi"
      ),
      `first payment to be made by the ${escapeHtml(String(paymentByDate))}`
    );
    output = output.replace(
      /(first payment to be made by the)\s*<span[^>]*>[._\u2026]{3,}<\/span>/gi,
      `$1 ${escapeHtml(String(paymentByDate))}`
    );
    output = output.replace(
      new RegExp(
        `(payment to be made${HTML_SPACE_OPT}by${HTML_SPACE_OPT}the${HTML_SPACE_OPT})${DOTS_PATTERN}`,
        "gi"
      ),
      `payment to be made by the ${escapeHtml(String(paymentByDate))}`
    );
    output = output.replace(
      /payment to be made\s*<span[^>]*>[^<]*<\/span>\s*by\s*<span[^>]*>[^<]*<\/span>\s*the\s*<span[^>]*>[._\u2026]{3,}<\/span>/gi,
      `payment to be made by the ${escapeHtml(String(paymentByDate))}`
    );
  }

  // Cash received (disbursed amount)
  if (disbursedAmountStr) {
    output = output.replace(
      /Cash Received:\s*US\$\(NOT RTGS\$\)\s*[._\u2026]{3,}/gi,
      `Cash Received: US$(NOT RTGS$) ${escapeHtml(disbursedAmountStr)}`
    );
    output = output.replace(
      /CASH RECEIVED:\s*US\$\(NOT RTGS\$\)\s*[._\u2026]{3,}/gi,
      `CASH RECEIVED: US$(NOT RTGS$) ${escapeHtml(disbursedAmountStr)}`
    );
  }

  if (executionPlace || executionDate) {
    const placeText = executionPlace || "___________________";
    const dateText = executionDate || currentDateStr;
    output = output.replace(
      /PLACE:\s*[._\u2026]{3,}\s*DATE ALL THIS DONE:\s*[._\u2026]{3,}/gi,
      `PLACE: ${escapeHtml(String(placeText))} DATE ALL THIS DONE: ${escapeHtml(String(dateText))}`
    );
  }

  if (clientName || data.loanOfficer) {
    const lenderName = data.loanOfficer || "Omama Finance";
    output = output.replace(
      /Signature:\s*Borrower[.\u2026]{3,}\s*Lender[.\u2026]{3,}/i,
      `Signature: Borrower ${escapeHtml(String(clientName || ""))} Lender ${escapeHtml(String(lenderName))}`
    );
  }

  // Voluntary surrender opening: "I................ of ................ do hereby voluntarily surrender"
  if (clientName || residentialAddress) {
    output = output.replace(
      new RegExp(
        `I\\s*${DOTS_PATTERN}\\s+of\\s*${DOTS_PATTERN}\\s*do hereby voluntarily surrender`,
        "i"
      ),
      `I ${escapeHtml(String(clientName || "_______________"))} of ${escapeHtml(String(residentialAddress || "_______________"))} do hereby voluntarily surrender`
    );
  }
  // "I owe Omama Finance to the tune of" – remove duplicate phrase and ensure correct amount (not $0)
  const tuneAmount = loanAmount || formatCurrency(data.loanAmount) || "";
  if (tuneAmount) {
    output = output.replace(
      /I owe Omama Finance to the tune of\s+I owe Omama Finance to the tune of/gi,
      "I owe Omama Finance to the tune of"
    );
    output = output.replace(
      new RegExp(
        `(I owe Omama Finance to the tune of\\s+(?:I owe Omama Finance to the tune of\\s+)?\\$)${DOTS_PATTERN}`,
        "gi"
      ),
      `I owe Omama Finance to the tune of $${escapeHtml(tuneAmount)}`
    );
    output = output.replace(
      new RegExp(
        `(I owe Omama Finance to the tune of \\$)${DOTS_PATTERN}`,
        "gi"
      ),
      `I owe Omama Finance to the tune of $${escapeHtml(tuneAmount)}`
    );
    output = output.replace(
      /to the tune of\s+\$0,?000\.00/gi,
      `to the tune of $${escapeHtml(tuneAmount)}`
    );
    output = output.replace(
      /to the tune of\s+\$0\.00/gi,
      `to the tune of $${escapeHtml(tuneAmount)}`
    );
  }

  // As Pledger / As Pledgee / Witnesses – fill name and place/date where we have them
  if (clientName) {
    output = output.replace(
      /As Pledger:\s*[._\u2026]{3,}/i,
      `As Pledger: ${escapeHtml(String(clientName))}`
    );
  }
  if (data.loanOfficer) {
    output = output.replace(
      /As Pledgee:\s*[._\u2026]{3,}/i,
      `As Pledgee: ${escapeHtml(String(data.loanOfficer))}`
    );
  }
  // Signature block place and date (only where "At" / "on" are followed by dotted placeholders)
  if (executionPlace) {
    output = output.replace(
      new RegExp(`(At\\s*)${DOTS_PATTERN}`, "g"),
      `At ${escapeHtml(executionPlace)}`
    );
  }
  if (loanDate) {
    output = output.replace(
      new RegExp(`(on\\s*)${DOTS_PATTERN}(?=\\s*</|\\s*$)`, "g"),
      `on ${escapeHtml(loanDate)}`
    );
  }

  // Repayment schedule table – inject rows into empty table body
  if (schedule.length > 0) {
    const rows = schedule
      .map(
        (p: { dueDate?: string; paymentAmount?: number; principal?: number; interestAndFees?: number }) =>
          `<tr><td>${escapeHtml(String(p.dueDate || ""))}</td><td>${escapeHtml(formatCurrency(p.paymentAmount))}</td><td>${escapeHtml(formatCurrency(p.principal))}</td><td>${escapeHtml(formatCurrency(p.interestAndFees))}</td></tr>`
      )
      .join("");

    // 1) Placeholder (if template was updated to use it)
    if (/\{\{\s*REPAYMENT_SCHEDULE_ROWS\s*\}\}/.test(output)) {
      output = output.replace(/\{\{\s*REPAYMENT_SCHEDULE_ROWS\s*\}\}/g, rows);
    } else if (!/\{\{\s*DATE_AMOUNT_1\s*\}\}/.test(output)) {
      // 2) Find empty tbody that appears after schedule table headers
      const scheduleTablePattern = new RegExp(
        `(Dates\\s+and\\s+Amounts|REPAYMENT\\s+DATES|Repayment\\s+Schedule|REPAYMENT\\s+SCHEDULE|Dates\\s*[/]\\s*Amounts|REPAYMENT\\s+DATES\\s+&\\s+INSTALMENTS|Instalments)[\\s\\S]{0,2000}?<tbody[^>]*>\\s*</tbody>`,
        "i"
      );
      const scheduleMatch = output.match(scheduleTablePattern);
      if (scheduleMatch) {
        output = output.replace(
          scheduleTablePattern,
          (match) =>
            match.replace(/<tbody[^>]*>\s*<\/tbody>/, `<tbody>${rows}</tbody>`)
        );
      } else {
        // 3) Tables without <tbody>: "Dates and Amounts" then </tr></table> – inject rows before </table>
        const noTbodyMatch = output.match(/(Dates\s+and\s+Amounts[\s\S]*)(<\/tr>)\s*<\/table>/i);
        if (noTbodyMatch) {
          output = output.replace(
            /(Dates\s+and\s+Amounts[\s\S]*)(<\/tr>)\s*<\/table>/i,
            (_m, before, trClose) => `${before}${trClose}${rows}</table>`
          );
        } else {
          // 4) Fallback: first empty <tbody></tbody> in the document
          const emptyTbody = /<tbody[^>]*>\s*<\/tbody>/i;
          const firstEmpty = output.match(emptyTbody);
          if (firstEmpty) {
            output = output.replace(
              firstEmpty[0],
              firstEmpty[0].replace(/>\s*<\/tbody/, `>${rows}</tbody`)
            );
          }
        }
      }
      // Force content below repayment table (not to the right): add clear after schedule table
      output = output.replace(
        /(REPAYMENT\s+DATES\s+&?\s*INSTALMENTS|Dates\s+and\s+Amounts)[\s\S]{0,4000}?(<\/tbody>\s*<\/table>|<\/tr>\s*<\/table>)/i,
        (m) => `${m}<div style="clear:both;"></div>`
      );
    }
  }

  // REFEREES section – if we have referees in stateContext/stateMetadata
  const referees =
    data.referees ||
    (data.stateContext as any)?.referees ||
    (data.stateMetadata as any)?.referees;
  if (Array.isArray(referees) && referees.length > 0) {
    const normalizeRef = (ref: any) => {
      const name =
        ref?.name ||
        [ref?.firstname, ref?.middlename, ref?.lastname].filter(Boolean).join(" ");
      return {
        name,
        occupation:
          ref?.occupation || ref?.job || ref?.work || ref?.employment || "",
        relation: ref?.relationship || ref?.relation || "",
        address: ref?.address || ref?.location || "",
        phone: ref?.phone || ref?.telephone || ref?.mobileNo || ref?.contact || "",
      };
    };
    const ref1 = normalizeRef(referees[0] || {});
    const ref2 = normalizeRef(referees[1] || {});
    const blank = "____________________";

    const namePattern = new RegExp(
      `(Name:\\s*)${DOTS_PATTERN}(\\s*Name:\\s*)${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(
      namePattern,
      `$1${escapeHtml(ref1.name || blank)} $2${escapeHtml(ref2.name || blank)}`
    );

    const occupationPattern = new RegExp(
      `(Occupation\\/[^:]*:\\s*)${DOTS_PATTERN}(\\s*Occupation\\/[^:]*:\\s*)${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(
      occupationPattern,
      `$1${escapeHtml(ref1.occupation || blank)} $2${escapeHtml(ref2.occupation || blank)}`
    );

    const relationPattern = new RegExp(
      `(Relation to applicant:\\s*)${DOTS_PATTERN}(\\s*Relation to applicant:\\s*)${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(
      relationPattern,
      `$1${escapeHtml(ref1.relation || blank)} $2${escapeHtml(ref2.relation || blank)}`
    );

    const addressPattern = new RegExp(
      `(Address:\\s*)${DOTS_PATTERN}(\\s*Address:\\s*)${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(
      addressPattern,
      `$1${escapeHtml(ref1.address || blank)} $2${escapeHtml(ref2.address || blank)}`
    );

    const phonePattern = new RegExp(
      `(Telephone No:\\s*)${DOTS_PATTERN}(\\s*Telephone No:\\s*)${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(
      phonePattern,
      `$1${escapeHtml(ref1.phone || blank)} $2${escapeHtml(ref2.phone || blank)}`
    );
  }

  const replaceToken = (token: string, value?: string | null) => {
    const replacement = value ? escapeHtml(String(value)) : "&nbsp;";
    output = output.replace(new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, "g"), replacement);
  };

  for (let i = 0; i < 8; i += 1) {
    replaceToken(`REPAY_DATE_${i + 1}`, scheduleDates[i]);
  }

  const dateAmounts = Array.isArray(schedule)
    ? schedule.slice(0, 4).map((p: any) => {
        const date = formatDate(p?.dueDate || "");
        const amount = formatCurrency(p?.paymentAmount);
        if (date && amount) return `${date} - $${amount}`;
        if (date) return date;
        return amount ? `$${amount}` : "";
      })
    : [];

  for (let i = 0; i < 4; i += 1) {
    replaceToken(`DATE_AMOUNT_${i + 1}`, dateAmounts[i]);
  }

  for (let i = 0; i < 8; i += 1) {
    replaceToken(`VOL_ITEM_${i + 1}`, securityItems[i]);
  }

  const lastDueDate = scheduleDates.length
    ? parseDate(scheduleDates[scheduleDates.length - 1])
    : null;
  if (lastDueDate) {
    const addDays = (date: Date, days: number) =>
      new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
    const penalty1 = addDays(lastDueDate, 7);
    const penalty2 = addDays(penalty1, 7);
    const penalty3 = addDays(penalty2, 30);
    replaceToken("PENALTY_DATE_1", formatDate(penalty1));
    replaceToken("PENALTY_DATE_2", formatDate(penalty2));
    replaceToken("PENALTY_DATE_3", formatDate(penalty3));
  } else {
    replaceToken("PENALTY_DATE_1", "");
    replaceToken("PENALTY_DATE_2", "");
    replaceToken("PENALTY_DATE_3", "");
  }

  return output;
};
