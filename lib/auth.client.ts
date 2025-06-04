import { createAuthClient } from "better-auth/client";

// Needed for auth login google 
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BASE_URL!,
})