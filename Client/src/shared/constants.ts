/** Proctoring: number of focus-loss violations tolerated before auto-submit. */
export const VIOLATION_THRESHOLD = 2;
/** Seconds of grace the server allows after the timer hits zero. */
export const SUBMISSION_GRACE_SECONDS = 10;
/** Share token length (nanoid, URL-safe alphabet => ~128 bits of entropy at 22 chars). */
export const SHARE_TOKEN_LENGTH = 22;
export const INVITE_TOKEN_LENGTH = 22;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MIN_DURATION_SECONDS = 30;
export const MAX_DURATION_SECONDS = 6 * 60 * 60;
