declare function multiply_by_two(x: i32): i32;

export function _start(): void {
  const nums: i32[] = [1, 2, 3, 4, 5];
  for (let i = 0; i < nums.length; i++) {
    const result = multiply_by_two(nums[i]);
    console.log(`${nums[i].toString()} * 2 = ${result.toString()}`);
  }
}
