// Un modulo simple que exporta una funcion de suma
export function add(a: number, b: number): number {
  return a + b;
}

export function factorial(n: number): number {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function _start(): void{
  add(2, 3);
  console.log(`Suma de dos numeros: ${add(2, 3)}`);
}