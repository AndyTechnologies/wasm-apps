import { add, multiply, fibonacci } from './math';

function printMenu(): void {
  console.log('=== Calculadora WASM ===');
  console.log('Operaciones disponibles:');
  console.log('  suma(5, 3)      = ' + add(5, 3).toString());
  console.log('  multiplica(4, 6) = ' + multiply(4, 6).toString());
}

function printFibonacci(n: number): void {
  console.log('Fibonacci(' + n.toString() + ') = ' + fibonacci(n).toString());
}

export function _start(): void {
  printMenu();
  console.log('');
  console.log('Serie de Fibonacci:');
  for (let i = 0; i <= 10; i++) {
    printFibonacci(i);
  }
}
