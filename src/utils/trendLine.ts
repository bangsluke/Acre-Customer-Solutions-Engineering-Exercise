export function computeLinearTrend(values: number[]): number[] {
  if (values.length < 2) {
    return values.slice();
  }

  const n = values.length;
  const sumX = (n - 1) * n * 0.5;
  const sumY = values.reduce((sum, value) => sum + value, 0);
  const sumXY = values.reduce((sum, value, index) => sum + index * value, 0);
  const sumXSquare = values.reduce((sum, _value, index) => sum + index * index, 0);
  const denominator = n * sumXSquare - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return values.map((_, index) => slope * index + intercept);
}
