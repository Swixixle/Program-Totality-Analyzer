export function buildColdStartRevenueRamp(): number[] {
  // Example: 0 for 9 months, then ramp up
  const months = 60;
  const arr = Array(months).fill(0);

  // Months 10–18: modest ramp to 60k annualized (~5k/mo)
  for (let m = 9; m < 18; m++) arr[m] = 3000 + (m - 9) * 250;

  // Months 19–36: ramp toward ~184k/yr (~15.3k/mo)
  for (let m = 18; m < 36; m++) arr[m] = 7000 + (m - 18) * 450;

  // Months 37–60: stabilize ~185k/yr
  for (let m = 36; m < 60; m++) arr[m] = 15400;

  return arr;
}

export function buildDrawRamp(): number[] {
  const months = 60;
  const arr = Array(months).fill(0);

  // No draw for 9 months
  // Then start draw slowly; adjust later in inputs UI
  for (let m = 18; m < 36; m++) arr[m] = 5000 + (m - 18) * 150; // gross/mo

  for (let m = 36; m < 60; m++) arr[m] = 11000; // gross/mo

  return arr;
}
