// Removes personal data from text before it is logged. Pure and dependency-free.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// 6 or more digits in a row, also when grouped with single spaces or hyphens
// (phone numbers like "0803 123 4567" and cards like "4111-1111-1111-1111").
const NUMBER = /\d(?:[ -]?\d){5,}/g;

export function redact(text: string): string {
  return text.replace(EMAIL, "[email]").replace(NUMBER, "[number]");
}
