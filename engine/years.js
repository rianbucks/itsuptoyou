export function yearsBetween(fromYear, toYear) {
  const crossesYearZero = fromYear < 0 && toYear > 0;
  return toYear - fromYear - (crossesYearZero ? 1 : 0);
}

export function addYears(year, years) {
  const raw = year + years;
  const crossesYearZero = year < 0 && raw >= 0;
  return crossesYearZero ? raw + 1 : raw;
}

export function computeAge(born, year) {
  return yearsBetween(born, year);
}
