export type PlanInputs = {
  homePrice: number;
  downPaymentPct: number;
  startingSavings: number;

  monthlyPersonalExpenses: number;
  weeklyCompanyBudget: number;

  effectiveTaxRate: number; // e.g. 0.25

  // 60-length arrays for ramp behavior:
  revenueByMonth: number[];          // gross company revenue
  personalDrawGrossByMonth: number[]; // founder draw (gross)
};

export type MonthRow = {
  m: number;
  label: string;

  revenue: number;
  companyCosts: number;

  personalDrawGross: number;
  personalTaxes: number;
  personalNet: number;

  personalExpenses: number;
  personalSavingsDelta: number;
  totalSavings: number;

  targetDownPayment: number;
  gapRemaining: number;
};

export function runSovereigntyPlan(inputs: PlanInputs): MonthRow[] {
  const months = 60;

  const targetDownPayment = inputs.homePrice * (inputs.downPaymentPct / 100); // inputs.downPaymentPct is expected as 0-100 or 0-1? Let's assume percentage whole number (e.g. 60) based on UI, but spec says 0.6. Let's normalize.
  // Actually spec says "downPaymentPct (0.6 default)". Let's treat it as a decimal 0-1.
  
  const monthlyCompanyCosts = (inputs.weeklyCompanyBudget * 52) / 12;

  let totalSavings = inputs.startingSavings;

  const rows: MonthRow[] = [];

  for (let m = 0; m < months; m++) {
    const revenue = inputs.revenueByMonth[m] ?? 0;
    const companyCosts = monthlyCompanyCosts;

    const personalDrawGross = inputs.personalDrawGrossByMonth[m] ?? 0;
    const personalTaxes = personalDrawGross * inputs.effectiveTaxRate;
    const personalNet = personalDrawGross - personalTaxes;

    const personalExpenses = inputs.monthlyPersonalExpenses;
    const personalSavingsDelta = Math.max(0, personalNet - personalExpenses);

    totalSavings += personalSavingsDelta;

    const gapRemaining = Math.max(0, targetDownPayment - totalSavings);

    rows.push({
      m,
      label: `Y${Math.floor(m / 12) + 1} M${(m % 12) + 1}`,
      revenue,
      companyCosts,
      personalDrawGross,
      personalTaxes,
      personalNet,
      personalExpenses,
      personalSavingsDelta,
      totalSavings,
      targetDownPayment,
      gapRemaining,
    });
  }

  return rows;
}
