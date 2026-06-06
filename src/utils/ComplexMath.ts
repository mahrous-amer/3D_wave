/**
 * CPU-side complex number operations for FFT spectrum initialization.
 */

export interface Complex {
  real: number;
  imag: number;
}

export function complexMul(a: Complex, b: Complex): Complex {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real,
  };
}

export function complexAdd(a: Complex, b: Complex): Complex {
  return {
    real: a.real + b.real,
    imag: a.imag + b.imag,
  };
}

export function complexConj(a: Complex): Complex {
  return { real: a.real, imag: -a.imag };
}

export function complexExp(theta: number): Complex {
  return { real: Math.cos(theta), imag: Math.sin(theta) };
}

export function complexMag(a: Complex): number {
  return Math.sqrt(a.real * a.real + a.imag * a.imag);
}

export function complexScale(a: Complex, s: number): Complex {
  return { real: a.real * s, imag: a.imag * s };
}
