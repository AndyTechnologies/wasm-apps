export function add(a: number, b: number): number {
  return a + b;
}

export function mathTest(): void {
  console.log(`Math test: sin(0)=${Math.sin(0)} cos(0)=${Math.cos(0)} sqrt(4)=${Math.sqrt(4)}`);
  console.log(`PI=${Math.PI} abs(-5)=${Math.abs(-5)} floor(3.9)=${Math.floor(3.9)}`);
}

export function _start(): void {
  console.log("Hola desde AssemblyScript!");
  console.warn("Esto es un warning");
  console.error("Esto es un error");
  mathTest();
  console.log(`5 + 3 = ${add(5, 3)}`);
  console.log(`Factorial de 5 = ${factorial(5)}`);
}

export function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}
