export function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function _start(): void {
  const nums = [5, 7, 10];
  for (let i = 0; i < nums.length; i++) {
    console.log(`factorial(${nums[i]}) = ${factorial(nums[i])}`);
  }
}
