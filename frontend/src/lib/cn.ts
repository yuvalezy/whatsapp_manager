import clsx, { type ClassValue } from 'clsx';

/** Conditional className helper. Thin wrapper around clsx used by every component. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
