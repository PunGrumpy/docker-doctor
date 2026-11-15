const MAX_SUGGESTION_DISTANCE = 2;

const editDistance = (from: string, to: string): number => {
  let previous = Array.from({ length: to.length + 1 }, (_, index) => index);

  for (let row = 1; row <= from.length; row += 1) {
    const current = [row];

    for (let column = 1; column <= to.length; column += 1) {
      const substitution = from[row - 1] === to[column - 1] ? 0 : 1;

      current.push(
        Math.min(
          previous[column] + 1,
          current[column - 1] + 1,
          previous[column - 1] + substitution
        )
      );
    }

    previous = current;
  }

  return previous[to.length];
};

// Returns the candidate closest to the input, ignoring case, when it is at
// most two edits away. The earlier candidate wins a tie. A candidate whose
// length differs by more than that cannot match, and skipping it keeps a very
// long input from filling a table for every candidate.
export const closestMatch = (
  input: string,
  candidates: readonly string[]
): string | undefined => {
  const folded = input.toLowerCase();
  let best: string | undefined;
  let bestDistance = MAX_SUGGESTION_DISTANCE + 1;

  for (const candidate of candidates) {
    if (Math.abs(candidate.length - folded.length) > MAX_SUGGESTION_DISTANCE) {
      continue;
    }

    const distance = editDistance(folded, candidate.toLowerCase());

    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
};
