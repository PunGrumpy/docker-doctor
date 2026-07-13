export interface ScoreData {
  readonly label: string;
  readonly background: string;
  readonly border: string;
}

export const getScoreData = (score: number): ScoreData => {
  if (score >= 90) {
    return {
      background: "bg-green-500/10",
      border: "border-green-500",
      label: "Excellent",
    };
  }
  if (score >= 75) {
    return {
      background: "bg-yellow-500/10",
      border: "border-yellow-500",
      label: "Good",
    };
  }
  return {
    background: "bg-red-500/10",
    border: "border-red-500",
    label: "Needs Work",
  };
};
