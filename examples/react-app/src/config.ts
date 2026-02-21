/**
 * Base URL of the NestJS API.
 * Override by setting VITE_API_URL in a .env file.
 */
export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
