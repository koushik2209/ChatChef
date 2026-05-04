import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Phone, KeyRound, ChefHat } from 'lucide-react';
import { requestOtp, verifyOtp } from '../api/auth';
import { useAuth } from '../hooks/useAuth';
import Spinner from '../components/Spinner';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState('');

  const otpMutation = useMutation({
    mutationFn: () => requestOtp(phone),
    onSuccess: () => { setStep('otp'); setError(''); },
    onError: () => setError('Failed to send OTP. Check the phone number.'),
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyOtp(phone, otp),
    onSuccess: ({ token, seller }) => {
      login(token, seller);
      navigate('/', { replace: true });
    },
    onError: () => setError('Invalid or expired OTP. Try again.'),
  });

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#25D366]/10 mb-4">
            <ChefHat size={32} color="#25D366" />
          </div>
          <h1 className="text-2xl font-bold text-white">ChatChef</h1>
          <p className="text-[#888] text-sm mt-1">Seller Dashboard</p>
        </div>

        {/* Card */}
        <div className="bg-[#111111] border border-[#262626] rounded-2xl p-6 space-y-4">
          {step === 'phone' ? (
            <>
              <div>
                <label className="block text-xs text-[#888] font-medium mb-1.5">WhatsApp Number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#25D366] transition-colors"
                    onKeyDown={e => e.key === 'Enter' && otpMutation.mutate()}
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                onClick={() => otpMutation.mutate()}
                disabled={!phone || otpMutation.isPending}
                className="w-full bg-[#25D366] hover:bg-[#1ea855] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {otpMutation.isPending ? <Spinner size={16} /> : null}
                Send OTP
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-[#888] font-medium mb-1.5">
                  OTP sent to {phone}
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit OTP"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-[#555] tracking-widest focus:outline-none focus:border-[#25D366] transition-colors"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && verifyMutation.mutate()}
                  />
                </div>
                <p className="text-[#555] text-xs mt-2">
                  Check the server console for the OTP (dev mode)
                </p>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                onClick={() => verifyMutation.mutate()}
                disabled={otp.length < 6 || verifyMutation.isPending}
                className="w-full bg-[#25D366] hover:bg-[#1ea855] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
              >
                {verifyMutation.isPending ? <Spinner size={16} /> : null}
                Verify & Login
              </button>

              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
                className="w-full text-[#888] text-sm py-1 hover:text-white transition-colors"
              >
                ← Change number
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
