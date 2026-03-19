import { format } from "date-fns";
import { ContractData } from "./contract-types";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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
    ([key, value]) => ({ key, value }),
  );
  while (queue.length > 0) {
    const { key, value } = queue.shift()!;
    if (pattern.test(key)) {
      if (typeof value === "string" && value.trim()) return value;
      if (typeof value === "number" && !Number.isNaN(value))
        return String(value);
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
  if (normalized.startsWith("f") || normalized.includes("female"))
    return "female";
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

export const fillOmamaContractTemplate = (
  html: string,
  data: ContractData,
  logoUrl?: string | null,
  signatures?: {
    borrower?: string | null;
    guarantor?: string | null;
    loanOfficer?: string | null;
  },
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

  const clientName =
    data.clientName ||
    [firstName, middleName, lastName].filter(Boolean).join(" ");
  const firstNames =
    [firstName, middleName].filter(Boolean).join(" ") ||
    (clientName ? clientName.split(" ").slice(0, -1).join(" ") : "");
  const surname =
    lastName || (clientName ? clientName.split(" ").slice(-1).join(" ") : "");

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
      null,
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
      /(residential|physical|home).*address|addressLine|streetAddress|street|townVillage|town|city|village|district|postal|address(?!Type|Id)/i,
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /(residential|physical|home).*address|addressLine|streetAddress|street|townVillage|town|city|village|district|postal|address(?!Type|Id)/i,
    );

  const workAddress =
    data.workAddress ||
    pickValue(data, ["workAddress", "employerAddress", "placeOfWorkAddress"]) ||
    findValueByKeyMatch(
      stateContext,
      /work.*address|employer.*address|business.*address|office.*address|workplace/i,
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /work.*address|employer.*address|business.*address|office.*address|workplace/i,
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
      /work.*phone|employer.*phone|business.*phone|office.*phone|work.*contact/i,
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /work.*phone|employer.*phone|business.*phone|office.*phone|work.*contact/i,
    );
  const title =
    pickValue(data, ["title", "salutation", "prefix", "honorific"]) ||
    findValueByKeyMatch(stateContext, /title|salutation|prefix|honorific/i) ||
    findValueByKeyMatch(stateMetadata, /title|salutation|prefix|honorific/i);
  const maritalStatus =
    data.maritalStatus ||
    pickValue(data, [
      "maritalStatus",
      "marital",
      "relationshipStatus",
      "familyStatus",
    ]);
  const businessLocation =
    data.businessAddress ||
    pickValue(data, [
      "businessLocation",
      "workLocation",
      "placeOfWork",
      "businessAddress",
      "workPlace",
    ]) ||
    findValueByKeyMatch(
      stateContext,
      /business.*location|work.*location|placeOfWork|workplace/i,
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /business.*location|work.*location|placeOfWork|workplace/i,
    ) ||
    workAddress;

  const employmentStatus =
    data.employmentStatus ||
    pickValue(data, ["employmentStatus", "occupation", "jobTitle"]) ||
    data.businessSector ||
    findValueByKeyMatch(
      stateContext,
      /employmentStatus|occupation|jobTitle|job|work/i,
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /employmentStatus|occupation|jobTitle|job|work/i,
    );
  const businessType =
    data.businessType ||
    data.businessSector ||
    pickValue(data, ["businessType", "businessSector", "business"]);
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
      /monthly.*income|monthly.*salary|salary|net.*income|gross.*income/i,
    ) ||
    findValueByKeyMatch(
      stateMetadata,
      /monthly.*income|monthly.*salary|salary|net.*income|gross.*income/i,
    );

  const requestedAmount =
    data.requestedAmount ||
    pickValue(data, ["requestedAmount"]) ||
    data.loanAmount;

  const loanPurpose =
    data.loanPurpose || pickValue(data, ["loanPurpose", "purpose"]);

  const spouseName =
    data.spouseName ||
    pickValue(data, ["spouseName", "husbandName", "wifeName"]);
  const spousePhone =
    data.spousePhone ||
    pickValue(data, ["spousePhone", "husbandPhone", "wifePhone"]);

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
    pickValue(data, [
      "closestRelativePhone",
      "nextOfKinPhone",
      "relativePhone",
    ]) ||
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
      ? [
          guarantorMember.firstname,
          guarantorMember.middlename,
          guarantorMember.lastname,
        ]
          .filter(Boolean)
          .join(" ")
      : undefined);
  const guarantorId = pickValue(data, [
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
    ]) || guarantorMember?.mobileNo;
  const guarantorAddress = pickValue(data, [
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
    (Array.isArray(data.collaterals) && data.collaterals.length > 0
      ? data.collaterals
      : null) ||
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
          collateralValue
            ? ` ($${formatCurrency(Number(collateralValue))})`
            : ""
        }`
      : "";
  const securityItems =
    collateralItems.length > 0
      ? collateralItems
      : fallbackCollateralItem
        ? [fallbackCollateralItem]
        : [];

  const principalWords = data.loanAmount ? numberToWords(data.loanAmount) : "";

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
    interestRatePct !== undefined &&
    interestRatePct !== null &&
    !Number.isNaN(Number(interestRatePct))
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
  const disbursedAmountStr = formatCurrency(
    data.disbursedAmount ?? data.loanAmount,
  );
  const totalDebtStr =
    formatCurrency(data.totalRepayment ?? scheduleTotal ?? data.loanAmount) ||
    loanAmount ||
    "";
  const paymentPerPeriodStr = formatCurrency(
    data.paymentPerPeriod ??
      (schedule.length > 0 ? scheduleTotal! / schedule.length : undefined),
  );
  const firstPaymentDateVal =
    data.firstPaymentDate || data.loanDate || loanDate;
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
  output = output.replace(
    /domicilie\s+citationet\s+executandi/gi,
    "domicilium citandi et executandi",
  );
  output = output.replace(
    /domicile\s+citation\s+et\s+executandi/gi,
    "domicilium citandi et executandi",
  );

  // Current date on user's machine (for declaration and THUS DONE)
  const currentDateStr = format(new Date(), "dd/MM/yyyy");
  const currentDay = format(new Date(), "d");
  const currentMonth = format(new Date(), "MMMM");
  const currentYear = format(new Date(), "yyyy");

  const occupationText =
    employmentStatus ||
    businessType ||
    data.businessSector ||
    employerName ||
    findValueByKeyMatch(data.stateContext, /occupation|job|business|trade/i) ||
    findValueByKeyMatch(data.stateMetadata, /occupation|job|business|trade/i) ||
    "";

  // Repayment schedule table – inject rows into empty table body
  if (schedule.length > 0) {
    const rows = schedule
      .map(
        (p: {
          dueDate?: string;
          paymentAmount?: number;
          principal?: number;
          interestAndFees?: number;
        }) =>
          `<tr><td>${escapeHtml(String(p.dueDate || ""))}</td><td>${escapeHtml(formatCurrency(p.paymentAmount))}</td><td>${escapeHtml(formatCurrency(p.principal))}</td><td>${escapeHtml(formatCurrency(p.interestAndFees))}</td></tr>`,
      )
      .join("");

    // 1) Placeholder (if template was updated to use it)
    if (/\{\{\s*REPAYMENT_SCHEDULE_ROWS\s*\}\}/.test(output)) {
      output = output.replace(/\{\{\s*REPAYMENT_SCHEDULE_ROWS\s*\}\}/g, rows);
    } else if (!/\{\{\s*DATE_AMOUNT_1\s*\}\}/.test(output)) {
      // 2) Find empty tbody that appears after schedule table headers
      const scheduleTablePattern = new RegExp(
        `(Dates\\s+and\\s+Amounts|REPAYMENT\\s+DATES|Repayment\\s+Schedule|REPAYMENT\\s+SCHEDULE|Dates\\s*[/]\\s*Amounts|REPAYMENT\\s+DATES\\s+&\\s+INSTALMENTS|Instalments)[\\s\\S]{0,2000}?<tbody[^>]*>\\s*</tbody>`,
        "i",
      );
      const scheduleMatch = output.match(scheduleTablePattern);
      if (scheduleMatch) {
        output = output.replace(scheduleTablePattern, (match) =>
          match.replace(/<tbody[^>]*>\s*<\/tbody>/, `<tbody>${rows}</tbody>`),
        );
      } else {
        // 3) Tables without <tbody>: "Dates and Amounts" then </tr></table> – inject rows before </table>
        const noTbodyMatch = output.match(
          /(Dates\s+and\s+Amounts[\s\S]*)(<\/tr>)\s*<\/table>/i,
        );
        if (noTbodyMatch) {
          output = output.replace(
            /(Dates\s+and\s+Amounts[\s\S]*)(<\/tr>)\s*<\/table>/i,
            (_m, before, trClose) => `${before}${trClose}${rows}</table>`,
          );
        } else {
          // 4) Fallback: first empty <tbody></tbody> in the document
          const emptyTbody = /<tbody[^>]*>\s*<\/tbody>/i;
          const firstEmpty = output.match(emptyTbody);
          if (firstEmpty) {
            output = output.replace(
              firstEmpty[0],
              firstEmpty[0].replace(/>\s*<\/tbody/, `>${rows}</tbody`),
            );
          }
        }
      }
      // Force content below repayment table (not to the right): add clear after schedule table
      output = output.replace(
        /(REPAYMENT\s+DATES\s+&?\s*INSTALMENTS|Dates\s+and\s+Amounts)[\s\S]{0,4000}?(<\/tbody>\s*<\/table>|<\/tr>\s*<\/table>)/i,
        (m) => `${m}<div style="clear:both;"></div>`,
      );
    }
  }

  const UNDERLINE = (len: number) => "_".repeat(len);

  const replaceToken = (
    token: string,
    value?: string | null,
    underlineLen: number = 20,
  ) => {
    const replacement = value
      ? ` ${escapeHtml(String(value))} `
      : ` ${UNDERLINE(underlineLen)} `;
    output = output.replace(
      new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, "g"),
      replacement,
    );
  };

  const replaceSignatureToken = (token: string, imgSrc?: string | null) => {
    const replacement = imgSrc
      ? `<img src="${escapeHtml(imgSrc)}" style="height:60px; max-width:200px; object-fit:contain; vertical-align:middle;" />`
      : ` ${UNDERLINE(35)} `;
    output = output.replace(
      new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, "g"),
      replacement,
    );
  };

  // Tenant logo
  if (logoUrl) {
    output = output.replace(
      /\{\{\s*TENANT_LOGO_URL\s*\}\}/g,
      escapeHtml(logoUrl),
    );
  }

  // Gender display – show the resolved gender, fall back to "Male / Female" if unknown
  const normalizedGender = normalizeGender(gender);
  const genderDisplay =
    normalizedGender === "male"
      ? "Male"
      : normalizedGender === "female"
        ? "Female"
        : "Male / Female";
  output = output.replace(/\{\{\s*GENDER_DISPLAY\s*\}\}/g, genderDisplay);

  // Title based on gender + marital status: Mr / Mrs / Miss
  const normalizedMarital = maritalStatus
    ? String(maritalStatus).trim().toLowerCase()
    : "";
  const isMarried =
    normalizedMarital === "married" || normalizedMarital.includes("married");
  let titleDisplay: string;
  if (normalizedGender === "male") {
    titleDisplay = "Mr";
  } else if (normalizedGender === "female") {
    titleDisplay = isMarried ? "Mrs" : "Miss";
  } else {
    titleDisplay = "Mr / Mrs / Miss";
  }
  output = output.replace(/\{\{\s*TITLE_DISPLAY\s*\}\}/g, titleDisplay);

  // Page 1: Loan Application Form
  replaceToken("SURNAME", surname, 25);
  replaceToken("FIRST_NAMES", firstNames, 25);
  replaceToken("ID_NUMBER", idNumber ? String(idNumber) : null, 20);
  replaceToken("DATE_OF_BIRTH", dateOfBirth, 15);
  replaceToken(
    "RESIDENTIAL_ADDRESS",
    residentialAddress ? String(residentialAddress) : null,
    45,
  );
  replaceToken("PHONE", phone ? String(phone) : null, 15);
  replaceToken("WORK_ADDRESS", workAddress ? String(workAddress) : null, 45);
  replaceToken("WORK_PHONE", workPhone ? String(workPhone) : null, 15);
  replaceToken(
    "MARITAL_STATUS",
    maritalStatus ? String(maritalStatus) : null,
    20,
  );
  replaceToken("SPOUSE_NAME", spouseName ? String(spouseName) : null, 30);
  replaceToken("SPOUSE_PHONE", spousePhone ? String(spousePhone) : null, 15);
  replaceToken(
    "CLOSEST_RELATIVE_NAME",
    closestRelativeName ? String(closestRelativeName) : null,
    30,
  );
  replaceToken(
    "CLOSEST_RELATIVE_PHONE",
    closestRelativePhone ? String(closestRelativePhone) : null,
    15,
  );
  replaceToken(
    "CLOSEST_RELATIVE_RELATIONSHIP",
    closestRelativeRelationship ? String(closestRelativeRelationship) : null,
    30,
  );
  replaceToken(
    "OCCUPATION",
    occupationText ? String(occupationText) : null,
    35,
  );
  replaceToken(
    "BUSINESS_LOCATION",
    businessLocation ? String(businessLocation) : null,
    50,
  );
  replaceToken(
    "BUSINESS_ADDRESS",
    businessLocation ? String(businessLocation) : null,
    50,
  );
  replaceToken(
    "BUSINESS_SECTOR",
    occupationText ? String(occupationText) : null,
    30,
  );
  replaceToken(
    "YEARS_IN_BUSINESS",
    yearsInBusiness ? String(yearsInBusiness) : null,
    10,
  );
  replaceToken(
    "MONTHLY_INCOME",
    monthlyIncome ? formatMaybeCurrency(monthlyIncome) : null,
    10,
  );
  replaceToken(
    "REQUESTED_AMOUNT",
    requestedAmount ? formatCurrency(Number(requestedAmount)) : null,
    12,
  );
  replaceToken("LOAN_PURPOSE", loanPurpose ? String(loanPurpose) : null, 25);

  for (let i = 0; i < 5; i += 1) {
    replaceToken(`SECURITY_${i + 1}`, securityItems[i], 25);
  }

  // Referees
  const referees =
    data.referees ||
    (data.stateContext as any)?.referees ||
    (data.stateMetadata as any)?.referees;
  const normalizeRef = (ref: any) => {
    const name =
      ref?.name ||
      [ref?.firstname, ref?.middlename, ref?.lastname]
        .filter(Boolean)
        .join(" ");
    return {
      name,
      occupation:
        ref?.occupation || ref?.job || ref?.work || ref?.employment || "",
      relation: ref?.relationship || ref?.relation || "",
      address: ref?.address || ref?.location || "",
      phone:
        ref?.phone || ref?.telephone || ref?.mobileNo || ref?.contact || "",
    };
  };
  const ref1 = normalizeRef(Array.isArray(referees) ? referees[0] : {});
  const ref2 = normalizeRef(Array.isArray(referees) ? referees[1] : {});
  replaceToken("REF1_NAME", ref1.name || null, 25);
  replaceToken("REF1_OCCUPATION", ref1.occupation || null, 20);
  replaceToken("REF1_RELATION", ref1.relation || null, 20);
  replaceToken("REF1_ADDRESS", ref1.address || null, 25);
  replaceToken("REF1_PHONE", ref1.phone || null, 20);
  replaceToken("REF2_NAME", ref2.name || null, 25);
  replaceToken("REF2_OCCUPATION", ref2.occupation || null, 20);
  replaceToken("REF2_RELATION", ref2.relation || null, 20);
  replaceToken("REF2_ADDRESS", ref2.address || null, 25);
  replaceToken("REF2_PHONE", ref2.phone || null, 20);

  replaceSignatureToken("APPLICANT_SIGNATURE", signatures?.borrower);
  replaceToken("DECLARATION_DATE", currentDateStr, 15);
  replaceToken("DECLARATION_PLACE", executionPlace || null, 25);

  // Acknowledgement of Debt / used across pages
  replaceToken("CLIENT_NAME", clientName, 40);
  replaceToken(
    "CLIENT_ADDRESS",
    residentialAddress ? String(residentialAddress) : null,
    50,
  );
  replaceToken("TOTAL_DEBT", totalDebtStr || null, 15);

  // Voluntary Surrender items
  for (let i = 0; i < 8; i += 1) {
    replaceToken(`VOL_ITEM_${i + 1}`, securityItems[i], 30);
  }

  // Loan Agreement
  replaceToken("LOAN_AMOUNT", loanAmount || null, 15);
  replaceToken("PRINCIPAL_WORDS", principalWords || null, 35);
  replaceSignatureToken("BORROWER_SIGNATURE", signatures?.borrower);
  replaceSignatureToken("LENDER_SIGNATURE", signatures?.loanOfficer);
  replaceToken("DISBURSED_AMOUNT", disbursedAmountStr || null, 15);
  replaceSignatureToken("CASH_RECEIVED_SIGNATURE", signatures?.borrower);
  replaceToken("EXECUTION_PLACE", executionPlace || null, 25);
  replaceToken("EXECUTION_DATE", executionDate || currentDateStr, 15);

  // Misc tokens
  replaceToken(
    "ACCOUNT_NUMBER",
    accountNumber ? String(accountNumber) : null,
    15,
  );
  replaceToken("LOAN_DATE", loanDate || null, 15);
  replaceToken(
    "BORROWING_COUNT",
    borrowingCount !== undefined && borrowingCount !== null
      ? String(borrowingCount)
      : null,
    10,
  );
  replaceToken("LOAN_AMOUNT_2", null, 15);
  replaceToken("LOAN_DATE_2", null, 15);
  replaceToken("BORROWING_COUNT_2", null, 10);
  for (let i = 0; i < 8; i += 1) {
    replaceToken(`REPAY_DATE_${i + 1}`, scheduleDates[i], 12);
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
    replaceToken("PENALTY_DATE_1", formatDate(penalty1), 12);
    replaceToken("PENALTY_DATE_2", formatDate(penalty2), 12);
    replaceToken("PENALTY_DATE_3", formatDate(penalty3), 12);
  } else {
    replaceToken("PENALTY_DATE_1", null, 12);
    replaceToken("PENALTY_DATE_2", null, 12);
    replaceToken("PENALTY_DATE_3", null, 12);
  }

  // Acknowledgement of Debt
  replaceToken("PAYMENT_PER_PERIOD", paymentPerPeriodStr || null, 15);
  replaceToken("FIRST_PAYMENT_DATE", firstPaymentDateStr || null, 25);
  replaceToken("INTEREST_RATE", interestRateStr || null, 8);
  replaceToken(
    "EXECUTION_DAY",
    currentDay || executionDay ? String(currentDay || executionDay) : null,
    8,
  );
  replaceToken(
    "EXECUTION_MONTH",
    currentMonth || executionMonth
      ? String(currentMonth || executionMonth)
      : null,
    15,
  );
  replaceToken(
    "EXECUTION_YEAR",
    currentYear || executionYear ? String(currentYear || executionYear) : null,
    8,
  );
  replaceSignatureToken("DEBTOR_SIGNATURE", signatures?.borrower);
  replaceToken("AOD_WITNESS_1", null, 45);
  replaceToken("AOD_WITNESS_2", null, 45);

  // Guarantee
  replaceToken(
    "GUARANTOR_NAME",
    guarantorName ? String(guarantorName) : null,
    40,
  );
  replaceToken(
    "GUARANTOR_ADDRESS",
    guarantorAddress ? String(guarantorAddress) : null,
    40,
  );
  replaceToken("GUARANTOR_ID", guarantorId ? String(guarantorId) : null, 20);
  replaceToken(
    "GUARANTOR_PHONE",
    guarantorPhone ? String(guarantorPhone) : null,
    15,
  );
  replaceSignatureToken("GUARANTOR_SIGNATURE", signatures?.guarantor);
  replaceToken("GUARANTEE_DATE", executionDate || currentDateStr, 15);
  replaceToken("GUARANTEE_WITNESS_1", null, 30);
  replaceToken("GUARANTEE_WITNESS_1_DATE", null, 15);
  replaceToken("GUARANTEE_WITNESS_2", null, 30);
  replaceToken("GUARANTEE_WITNESS_2_DATE", null, 15);

  // Pledge Agreement
  for (let i = 0; i < 5; i += 1) {
    replaceToken(`PLEDGE_ITEM_${i + 1}`, securityItems[i], 20);
  }
  replaceSignatureToken("PLEDGER_SIGNATURE", signatures?.borrower);
  replaceSignatureToken("PLEDGEE_SIGNATURE", signatures?.loanOfficer);
  replaceToken("PLEDGE_WITNESS_1", null, 25);
  replaceToken("PLEDGE_WITNESS_2", null, 25);

  // Voluntary surrender form signatures
  replaceSignatureToken("SURRENDER_DEBTOR_SIGNATURE", signatures?.borrower);
  replaceSignatureToken("SURRENDER_GUARANTOR_SIGNATURE", signatures?.guarantor);
  replaceToken("DEBTOR_WITNESS_1", null, 30);
  replaceToken("DEBTOR_WITNESS_2", null, 30);
  replaceToken("SURRENDER_WITNESS_1", null, 30);
  replaceToken("SURRENDER_WITNESS_2", null, 30);
  replaceToken("AGREEMENT_WITNESS_1", null, 30);
  replaceToken("AGREEMENT_WITNESS_2", null, 30);

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
    replaceToken(`DATE_AMOUNT_${i + 1}`, dateAmounts[i], 20);
  }

  // Catch any remaining unreplaced tokens
  output = output.replace(/\{\{\s*[A-Z_0-9]+\s*\}\}/g, ` ${UNDERLINE(20)} `);

  return output;
};
