const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
export const url = `${protocol}://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
