export interface ScoreData {
  background: string;
  border: string;
  color: string;
  label: string;
}

export const getScoreData = (score: number): ScoreData => {
  if (score >= 90) {
    return {
      background: "bg-green-500/10",
      border: "border-green-500",
      color: "#22c55e",
      label: "Excellent",
    };
  }
  if (score >= 75) {
    return {
      background: "bg-yellow-500/10",
      border: "border-yellow-500",
      color: "#eab308",
      label: "Good",
    };
  }
  return {
    background: "bg-red-500/10",
    border: "border-red-500",
    color: "#ef4444",
    label: "Needs Work",
  };
};
