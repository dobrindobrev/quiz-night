const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/1/O/I

export function generateCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateQuizCode(): string {
  // 8 chars, hyphen — looks like WORD-XXXX
  const front = Array.from({ length: 4 })
    .map(() => ALPHABET[Math.floor(Math.random() * 26)])
    .join("");
  const back = Array.from({ length: 3 })
    .map(() => ALPHABET[26 + Math.floor(Math.random() * 6)])
    .join("");
  return `${front}-${back}`;
}
