/* ============================================================
   Find Umbrella — shared UK tax engine
   Rates verified against GOV.UK (September 2026):
   - "Rates and thresholds for employers 2026 to 2027"
   - "Income Tax rates and Personal Allowances"
   - "National Insurance rates and categories"
   ============================================================ */
"use strict";

const TAX_YEAR = "2026/27";

const TAX = {
  personalAllowance: 12570,          // standard PA, tax code 1257L
  taperStart: 100000,                // PA reduces by £1 per £2 over £100k
  // England, Wales & Northern Ireland (on taxable income above PA)
  england: [
    { rate: 0.20, start: 12570, end: 50270 },
    { rate: 0.40, start: 50270, end: 125140 },
    { rate: 0.45, start: 125140, end: Infinity },
  ],
  // Scotland (taxable income above PA)
  scotland: [
    { rate: 0.19, start: 12570, end: 16537 },
    { rate: 0.20, start: 16537, end: 29526 },
    { rate: 0.21, start: 29526, end: 43662 },
    { rate: 0.42, start: 43662, end: 75000 },
    { rate: 0.45, start: 75000, end: 125140 },
    { rate: 0.48, start: 125140, end: Infinity },
  ],
  eeNi: { threshold: 12570, uel: 50270, mainRate: 0.08, upperRate: 0.02 }, // category A
  erNi: { threshold: 5000, rate: 0.15 },                                  // secondary threshold
  apprenticeshipLevyRate: 0.005,                                          // 0.5% of pay bill
  holidayAccrualRate: 0.1207,                                             // statutory 12.07%
  studentLoans: {
    plan1:        { threshold: 26900, rate: 0.09 },
    plan2:        { threshold: 29385, rate: 0.09 },
    plan4:        { threshold: 33795, rate: 0.09 },
    plan5:        { threshold: 25000, rate: 0.09 },
    postgraduate: { threshold: 21000, rate: 0.06 },
  },
};

function personalAllowance(income) {
  return Math.max(0, TAX.personalAllowance - Math.max(0, income - TAX.taperStart) / 2);
}

function incomeTax(taxableIncome, region) {
  const scot = region === "scotland";
  const pa = personalAllowance(taxableIncome);
  const bands = scot
    ? TAX.scotland.map((b) => ({ rate: b.rate, start: Math.max(b.start, pa), end: Math.max(b.end, pa) }))
    : [
        { rate: 0.20, start: pa, end: pa + 37700 },
        { rate: 0.40, start: pa + 37700, end: 125140 },
        { rate: 0.45, start: 125140, end: Infinity },
      ];
  let tax = 0;
  for (const b of bands) {
    if (taxableIncome <= b.start) break;
    tax += (Math.min(taxableIncome, b.end) - b.start) * b.rate;
  }
  return tax;
}

function employeeNi(earnings) {
  if (earnings <= TAX.eeNi.threshold) return 0;
  const main = Math.min(earnings, TAX.eeNi.uel) - TAX.eeNi.threshold;
  return main * TAX.eeNi.mainRate + Math.max(0, earnings - TAX.eeNi.uel) * TAX.eeNi.upperRate;
}

function studentLoanRepayment(earnings, plan) {
  const p = TAX.studentLoans[plan];
  if (!p || earnings <= p.threshold) return 0;
  return (earnings - p.threshold) * p.rate;
}

/* Umbrella take-home engine.
 * Employer costs (Employer NI + Apprenticeship Levy) are funded out of the
 * assignment value, then the umbrella margin, then employee deductions.
 * Solved iteratively because employer NI is charged on the salary itself. */
function umbrellaTakeHome(opts) {
  const weeks = Math.min(52, Math.max(1, opts.weeksPerYear));
  const assignment = opts.dayRate * opts.daysPerWeek * weeks;      // annual invoice value
  const margin = opts.marginPerWeek * weeks;

  let salary = Math.max(0, assignment - margin);
  for (let i = 0; i < 40; i++) {
    const levy = opts.includeLevy ? salary * TAX.apprenticeshipLevyRate : 0;
    const erNi = TAX.erNi.rate * Math.max(0, salary - TAX.erNi.threshold);
    const target = Math.max(0, assignment - margin - erNi - levy);
    if (Math.abs(target - salary) < 0.005) { salary = target; break; }
    salary = target;
  }
  const employerLevy = opts.includeLevy ? salary * TAX.apprenticeshipLevyRate : 0;
  const employerNi = TAX.erNi.rate * Math.max(0, salary - TAX.erNi.threshold);
  const pension = (opts.pensionPct / 100) * salary;
  const taxable = Math.max(0, salary - pension);
  const tax = incomeTax(taxable, opts.region);
  const eeNi = employeeNi(salary);
  const sl = studentLoanRepayment(salary, opts.studentLoan);
  const takeHome = Math.max(0, salary - pension - tax - eeNi - sl);
  const holidayPay = assignment * (TAX.holidayAccrualRate / (1 + TAX.holidayAccrualRate));

  return {
    assignment,
    margin,
    employerLevy,
    employerNi,
    grossSalary: salary,
    pension,
    tax,
    eeNi,
    studentLoan: sl,
    takeHome,
    holidayPay,
    weeks,
  };
}

/* ---- Dividend tax (allowance £500; 10.75% / 35.75% / 39.35%) ---- */
function dividendTax(dividends, otherIncome) {
  const pa = personalAllowance(otherIncome + dividends);
  const leftoverPa = Math.max(0, pa - otherIncome);                    // dividends can use unused PA
  const afterPa = Math.max(0, dividends - leftoverPa);
  const allowance = Math.min(500, afterPa);
  const taxed = afterPa - allowance;
  const basicRoom = Math.max(0, 50270 - Math.max(otherIncome, pa));
  const inBasic = Math.min(taxed, basicRoom);
  let tax = inBasic * 0.1075;
  const rest = taxed - inBasic;
  const higherRoom = Math.max(0, 125140 - Math.max(otherIncome, pa) - basicRoom);
  const inHigher = Math.min(rest, higherRoom);
  tax += inHigher * 0.3575 + Math.max(0, rest - inHigher) * 0.3935;
  return { tax, allowance };
}

/* ---- Capital gains tax (AEA £3,000; 18% basic band / 24% above; BADR 18%) ---- */
function capitalGainsTax(gain, otherTaxableIncome, opts) {
  const badr = !!(opts && opts.badr);
  const aea = 3000;
  const taxableGain = Math.max(0, gain - aea);
  const basicRoom = Math.max(0, 37700 - otherTaxableIncome);
  const inBasic = Math.min(taxableGain, basicRoom);
  const tax = badr
    ? taxableGain * 0.18
    : inBasic * 0.18 + (taxableGain - inBasic) * 0.24;
  return { taxableGain, tax, rateApplied: badr ? "18% (Business Asset Disposal Relief)" : "18% / 24%" };
}

/* ---- Child benefit + High Income Child Benefit Charge ---- */
function childBenefit(children, adjustedNetIncome) {
  const first = 27.05, extra = 17.9;
  const weekly = children >= 1 ? first + Math.max(0, children - 1) * extra : 0;
  const annual = weekly * 52;
  const chargeRate = Math.min(1, Math.max(0, (adjustedNetIncome - 60000) / 20000)); // £60k–£80k taper
  const charge = annual * chargeRate;
  return { weekly, annual, charge, net: annual - charge };
}

/* ---- Inheritance tax (NRB £325k, RNRB £175k tapered above £2m, 40%) ---- */
function inheritanceTax(estate, opts) {
  const homeToChildren = !!(opts && opts.homeToChildren);
  const partnerTransfer = !!(opts && opts.partnerTransfer);
  const nrb = 325000 * (partnerTransfer ? 2 : 1);
  let rnrb = homeToChildren ? 175000 * (partnerTransfer ? 2 : 1) : 0;
  if (estate > 2000000) rnrb = Math.max(0, rnrb - (estate - 2000000) / 2);
  const threshold = nrb + rnrb;
  const taxable = Math.max(0, estate - threshold);
  return { nrb, rnrb, threshold, taxable, tax: taxable * 0.4 };
}

/* ---- Pension lump sum (25% tax-free up to LSA £268,275) ---- */
function pensionLumpSum(lump, otherTaxableIncome) {
  const lsa = 268275;
  const taxFree = Math.min(lump * 0.25, lsa);
  const taxable = Math.max(0, lump - taxFree);
  const tax = incomeTax(otherTaxableIncome + taxable, "england") - incomeTax(otherTaxableIncome, "england");
  return { taxFree, taxable, tax, net: lump - tax, lsa };
}

/* ---- National Insurance only ---- */
function niOnly(earnings) {
  const ee = employeeNi(earnings);
  const er = TAX.erNi.rate * Math.max(0, earnings - TAX.erNi.threshold);
  return { ee, er, total: ee + er };
}

/* ---- Plain PAYE take-home (wages calculator) ---- */
function payeTakeHome(salary, region, studentLoan, pensionPct) {
  const pension = (pensionPct / 100) * salary;
  const taxable = Math.max(0, salary - pension);
  const tax = incomeTax(taxable, region);
  const eeNi = employeeNi(salary);
  const sl = studentLoanRepayment(salary, studentLoan);
  return { salary, pension, tax, eeNi, studentLoan: sl, takeHome: Math.max(0, salary - pension - tax - eeNi - sl) };
}

/* ---- IR35: inside (umbrella PAYE) vs outside (limited company) ---- */
function ir35Compare(opts) {
  const inside = umbrellaTakeHome(opts);
  const revenue = inside.assignment;
  const ltdSalary = Math.min(revenue, opts.ltdSalary || 12570);
  const erNi = 0; // Employment Allowance covers a single low payroll
  const profit = Math.max(0, revenue - ltdSalary - erNi);
  const ctRate = opts.ctRate || 0.19; // small profits rate
  const ct = profit * ctRate;
  const distributable = profit - ct;
  const divTax = dividendTax(distributable, ltdSalary).tax;
  const salaryTax = incomeTax(ltdSalary, opts.region);
  const salaryNi = employeeNi(ltdSalary);
  const takeHome = ltdSalary - salaryTax - salaryNi + distributable - divTax;
  return {
    revenue,
    inside,
    outside: { ltdSalary, profit, ct, distributable, salaryTax, salaryNi, divTax, takeHome },
    diff: takeHome - inside.takeHome,
  };
}

const fmtGBP = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const pct = (n) => Math.round(n * 10) / 10 + "%";

window.TaxCalc = {
  TAX_YEAR,
  TAX,
  personalAllowance,
  incomeTax,
  employeeNi,
  studentLoanRepayment,
  umbrellaTakeHome,
  dividendTax,
  capitalGainsTax,
  childBenefit,
  inheritanceTax,
  pensionLumpSum,
  niOnly,
  payeTakeHome,
  ir35Compare,
  fmtGBP,
  pct,
};
