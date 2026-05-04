// In-memory OTP store. Replace with Redis in production.
interface OtpEntry {
  otp: string;
  expiresAt: Date;
}

const otpStore = new Map<string, OtpEntry>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateOtp(phone: string): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { otp, expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  return otp;
}

export function verifyOtp(phone: string, otp: string): boolean {
  const entry = otpStore.get(phone);
  if (!entry) return false;
  if (new Date() > entry.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  if (entry.otp !== otp) return false;
  otpStore.delete(phone); // single-use
  return true;
}
