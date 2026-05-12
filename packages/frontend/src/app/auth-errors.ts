"use client";

export function getSupabaseAuthMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : String(error ?? "").trim();
  const lowered = message.toLowerCase();

  if (!message) {
    return "Authentication failed. Please try again.";
  }

  if (lowered.includes("invalid login credentials")) {
    return "Sign-in failed. Either the account does not exist yet, the password is wrong, or the email still needs confirmation.";
  }

  if (lowered.includes("email not confirmed")) {
    return "This account exists, but the email address has not been confirmed yet. Check your inbox and verify the email first.";
  }

  if (lowered.includes("user already registered")) {
    return "This email already has an ArcPay account. Sign in instead, or reset the password if needed.";
  }

  if (lowered.includes("password should be at least")) {
    return message;
  }

  return message;
}
