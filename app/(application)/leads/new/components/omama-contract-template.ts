import { format } from "date-fns";
import { ContractData } from "./contract-types";

const DOTS_PATTERN = "[\\._\\u2026]{3,}";

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

const formatDate = (value?: string | number | Date | null): string => {
  if (!value) return "";
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

  const gender =
    data.gender || pickValue(data, ["gender", "sex", "clientGender"]);
  const dateOfBirth = formatDate(
    data.dateOfBirth ||
      pickValue(data, ["dateOfBirth", "dob", "birthDate"]) ||
      null
  );

  const residentialAddress =
    data.residentialAddress ||
    pickValue(data, [
      "residentialAddress",
      "physicalAddress",
      "homeAddress",
      "address",
    ]);

  const workAddress =
    data.workAddress ||
    pickValue(data, ["workAddress", "employerAddress", "placeOfWorkAddress"]);

  const employmentStatus =
    data.employmentStatus ||
    pickValue(data, ["employmentStatus", "occupation", "jobTitle"]);
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
    pickValue(data, ["monthlyIncome", "grossMonthlyIncome", "salary"]);

  const requestedAmount =
    data.requestedAmount || pickValue(data, ["requestedAmount"]) || data.loanAmount;

  const loanPurpose =
    data.loanPurpose || pickValue(data, ["loanPurpose", "purpose"]);

  const spouseName =
    data.spouseName || pickValue(data, ["spouseName", "husbandName", "wifeName"]);
  const spousePhone =
    data.spousePhone || pickValue(data, ["spousePhone", "husbandPhone", "wifePhone"]);

  const familyMember = data.familyMembers?.[0];
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

  const collateralType =
    data.collateralType || pickValue(data, ["collateralType", "securityType"]);
  const collateralValue =
    data.collateralValue || pickValue(data, ["collateralValue"]);

  const principalWords = data.loanAmount
    ? numberToWords(data.loanAmount)
    : "";

  const interestRatePct =
    data.nominalInterestRate ?? data.monthlyPercentageRate ?? 0;
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
  const disbursedAmountStr = formatCurrency(data.disbursedAmount ?? data.loanAmount);
  const totalDebtStr = formatCurrency(data.totalRepayment ?? data.loanAmount);
  const paymentPerPeriodStr = formatCurrency(data.paymentPerPeriod);
  const firstPaymentDateVal =
    data.firstPaymentDate ||
    data.loanDate ||
    loanDate;

  // Fix typos in template for readability
  output = output.replace(/\bPENALLTY\b/gi, "PENALTY");
  output = output.replace(/\bPEANALTY\b/gi, "PENALTY");
  output = output.replace(/domicilie\s+citationet\s+executandi/gi, "domicilium citandi et executandi");

  // Header section – ensure spaces between label and value for readability
  output = replaceAfterLabel(output, "NAME OF INDIVIDUAL:", clientName);
  output = replaceAfterLabel(output, "CELL NUMBER", phone);
  output = replaceAfterLabel(output, "ACC No", accountNumber);
  output = replaceAfterLabel(output, "ACC No\\.", accountNumber);
  if (loanAmount || loanDate) {
    const principalDatePattern = new RegExp(
      `(LOAN PRINCIPAL\\s*\\$\\s*)${DOTS_PATTERN}(\\s*)(LOAN DATE\\s*)${DOTS_PATTERN}`,
      "i"
    );
    output = output.replace(principalDatePattern, () => {
      const amt = loanAmount ? escapeHtml(loanAmount) : "__________";
      const dt = loanDate ? escapeHtml(loanDate) : "__________";
      return `LOAN PRINCIPAL $ ${amt}  LOAN DATE ${dt}`;
    });
  }
  output = replaceAfterLabel(output, "LOAN PRINCIPAL $", loanAmount ? `${loanAmount} ` : undefined);
  if (loanDate) {
    output = output.replace(
      new RegExp(`(LOAN DATE\\s*)${DOTS_PATTERN}`, "gi"),
      `LOAN DATE ${escapeHtml(loanDate)}`
    );
  }
  output = replaceAfterLabel(output, "No of times borrowing", borrowingCount);

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

  if (gender || dateOfBirth) {
    const genderPattern = /Gender\s*:\s*[^.]*\.\s*Date of Birth\s*[._\u2026]{3,}/i;
    output = output.replace(genderPattern, () => {
      const genderText = gender ? escapeHtml(String(gender)) : "__________";
      const dobText = dateOfBirth ? escapeHtml(String(dateOfBirth)) : "__________";
      return `Gender: ${genderText} Date of Birth ${dobText}`;
    });
  }

  if (residentialAddress || phone) {
    const addressPattern = /Physical Res\. Address\s*[._\u2026]{3,}.*?Phone\s*[._\u2026]{3,}/i;
    output = output.replace(addressPattern, () => {
      const addrText = residentialAddress ? escapeHtml(String(residentialAddress)) : "________________________";
      const phoneText = phone ? escapeHtml(String(phone)) : "____________";
      return `Physical Res. Address ${addrText} Phone ${phoneText}`;
    });
  }

  if (employerName || workAddress || phone) {
    const workPattern = /Place of work & Physical Address[^\n]*Phone[._\u2026]{3,}/i;
    output = output.replace(workPattern, () => {
      const placeText = escapeHtml(String(employerName || workAddress || ""));
      const phoneText = phone ? escapeHtml(String(phone)) : "____________";
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
    output = replaceAfterLabel(output, "Relation", closestRelativeRelationship);
  }

  if (employmentStatus || businessType) {
    const jobPattern = /What business or job do you do\?[^_]*[_\u2026]{3,}/i;
    output = output.replace(jobPattern, (match) => {
      const jobText = escapeHtml(String(employmentStatus || businessType || ""));
      return match.replace(new RegExp(`${DOTS_PATTERN}`), jobText || "_____________________");
    });
  }

  if (yearsInBusiness || monthlyIncome) {
    const yearsPattern =
      /Years\/Months in Business or at work[^_]*:\s*[_\u2026]{3,}[^$]*salary\s*\$[_\u2026]{3,}pm\./i;
    output = output.replace(yearsPattern, () => {
      const yearsText = yearsInBusiness ? escapeHtml(String(yearsInBusiness)) : "______";
      const incomeText = monthlyIncome
        ? escapeHtml(formatCurrency(Number(monthlyIncome)))
        : "______";
      return `Years/Months in Business or at work : ${yearsText} sales or salary $${incomeText}pm.`;
    });
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

  // Signature date fields
  if (loanDate) {
    output = replaceAllAfterLabel(output, "Date:", loanDate);
  }

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

  if (clientName) {
    output = output.replace(
      /PLEDGE AGREEMENT BETWEEN:\s*\(NAME\)[._\u2026]{3,}/i,
      `PLEDGE AGREEMENT BETWEEN: (NAME) ${escapeHtml(String(clientName))}`
    );
  }

  // Interest rate % per month (e.g. "at the rate of........ % per month")
  if (interestRateStr) {
    output = output.replace(
      new RegExp(`(rate of\\s*)${DOTS_PATTERN}(\\s*%\\s*per\\s*month)`, "gi"),
      `rate of ${escapeHtml(interestRateStr)} % per month`
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

  // Execution block: "THUS DONE and AGREED AT ... this ... day of ... 202..."
  if (executionPlace || executionDay || executionMonth || executionYear) {
    output = output.replace(
      new RegExp(
        `THUS DONE and AGREED AT\\s*${DOTS_PATTERN}\\s*this\\s*${DOTS_PATTERN}\\s*day of\\s*${DOTS_PATTERN}\\s*202[._\\u2026]*`,
        "gi"
      ),
      `THUS DONE and AGREED AT ${escapeHtml(executionPlace)} this ${escapeHtml(executionDay)} day of ${escapeHtml(executionMonth)} ${escapeHtml(executionYear)}`
    );
  }
  if (loanDate) {
    output = replaceAllAfterLabel(output, "THUS DONE and AGREED AT", executionPlace || loanDate);
  }

  // Acknowledgement of debt: sum of USD$, monthly payment, first payment date
  if (totalDebtStr) {
    output = replaceAfterLabel(output, "sum of USD$", totalDebtStr);
    output = replaceAfterLabel(output, "sum of $", totalDebtStr);
  }
  if (paymentPerPeriodStr) {
    output = replaceAfterLabel(output, "reduction of the debt of USD$", paymentPerPeriodStr);
    output = replaceAfterLabel(output, "minimum amount in reduction of the debt of USD$", paymentPerPeriodStr);
  }
  if (firstPaymentDateVal) {
    output = output.replace(
      new RegExp(`(first payment to be made by the\\s*)${DOTS_PATTERN}`, "gi"),
      `first payment to be made by the ${escapeHtml(String(firstPaymentDateVal))}`
    );
  }

  // Cash received (disbursed amount)
  if (disbursedAmountStr) {
    output = replaceAfterLabel(output, "Cash Received", disbursedAmountStr);
    output = replaceAfterLabel(output, "CASH RECEIVED", disbursedAmountStr);
  }

  // Pledge agreement opening: "I................ of ................"
  if (clientName || residentialAddress) {
    output = output.replace(
      new RegExp(`I\\s*${DOTS_PATTERN}\\s+of\\s*${DOTS_PATTERN}`, "i"),
      `I ${escapeHtml(String(clientName || "_______________"))} of ${escapeHtml(String(residentialAddress || "_______________"))}`
    );
  }
  if (loanAmount) {
    output = output.replace(
      new RegExp(
        `(I owe Omama Finance to the tune of \\$)${DOTS_PATTERN}`,
        "i"
      ),
      `I owe Omama Finance to the tune of $${escapeHtml(loanAmount)}`
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
  const schedule = data.repaymentSchedule;
  if (schedule && schedule.length > 0) {
    const rows = schedule
      .map(
        (p: { dueDate?: string; paymentAmount?: number; principal?: number; interestAndFees?: number }) =>
          `<tr><td>${escapeHtml(String(p.dueDate || ""))}</td><td>${escapeHtml(formatCurrency(p.paymentAmount))}</td><td>${escapeHtml(formatCurrency(p.principal))}</td><td>${escapeHtml(formatCurrency(p.interestAndFees))}</td></tr>`
      )
      .join("");

    // 1) Placeholder (if template was updated to use it)
    output = output.replace(/\{\{\s*REPAYMENT_SCHEDULE_ROWS\s*\}\}/g, rows);

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
      // 3) Fallback: first empty <tbody></tbody> in the document
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

  // REFEREES section – if we have referees in stateContext/stateMetadata
  const referees = data.referees || (data.stateContext as any)?.referees || (data.stateMetadata as any)?.referees;
  if (Array.isArray(referees) && referees.length > 0) {
    const ref1 = referees[0];
    const ref2 = referees[1];
    const name1 = ref1?.name ?? "";
    const name2 = ref2?.name ?? "";
    const phone1 = ref1?.phone ?? "";
    const phone2 = ref2?.phone ?? "";
    output = output.replace(
      /REFEREES[^<]*?Name[^<]*?[._\u2026]{3,}[^<]*?Occupation[^<]*?[._\u2026]{3,}/gi,
      `REFEREES Name ${escapeHtml(name1)} Occupation ${escapeHtml(phone1)}`
    );
    if (name2 || phone2) {
      output = output.replace(
        /Relation[^<]*?[._\u2026]{3,}[^<]*?Address[^<]*?[._\u2026]{3,}/gi,
        `Relation ${escapeHtml(name2)} Address ${escapeHtml(phone2)}`
      );
    }
  }

  return output;
};
