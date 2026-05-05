import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChefHat, Copy, Check } from 'lucide-react';
import { registerSeller } from '../api/auth';
import Spinner from '../components/Spinner';

const WA_NUMBER = import.meta.env.VITE_CHATCHEF_WA_NUMBER ?? '';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', whatsapp_number: '', upi_id: '' });
  const [slug, setSlug] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof form, value: string) =>
    setForm(f => ({ ...f, [field]: value }));

  const mutation = useMutation({
    mutationFn: () => registerSeller(form),
    onSuccess: (data) => { setSlug(data.slug); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message ?? 'Registration failed. Try again.'),
  });

  const link = slug && WA_NUMBER ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(slug)}` : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  const valid = form.name && form.whatsapp_number && form.upi_id;

  if (slug) {
    return (
      <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#25D366]/10 mb-4">
              <ChefHat size={32} color="#25D366" />
            </div>
            <h1 className="text-2xl font-bold text-white">You're registered! 🎉</h1>
            <p className="text-[#888] text-sm mt-1">Share this link with your customers</p>
          </div>

          <div className="bg-[#111111] border border-[#262626] rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs text-[#888] mb-2">Your order link</p>
              <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-2.5">
                <span className="text-[#25D366] text-sm flex-1 truncate">{link}</span>
                <button onClick={copyLink} className="text-[#888] hover:text-white shrink-0">
                  {copied ? <Check size={16} color="#25D366" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-3">
              <p className="text-xs text-[#888] mb-1">Next step</p>
              <p className="text-sm text-white">DM <span className="text-[#25D366] font-medium">+{WA_NUMBER}</span> from your WhatsApp to add your menu items.</p>
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full bg-[#25D366] hover:bg-[#1ea855] text-white font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              Go to Dashboard Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#25D366]/10 mb-4">
            <ChefHat size={32} color="#25D366" />
          </div>
          <h1 className="text-2xl font-bold text-white">Join ChatChef</h1>
          <p className="text-[#888] text-sm mt-1">Start selling food via WhatsApp</p>
        </div>

        <div className="bg-[#111111] border border-[#262626] rounded-2xl p-6 space-y-4">
          {[
            { label: 'Shop / Your Name', key: 'name' as const, placeholder: 'Priya Home Kitchen', type: 'text' },
            { label: 'WhatsApp Number', key: 'whatsapp_number' as const, placeholder: '919876543210', type: 'tel' },
            { label: 'UPI ID', key: 'upi_id' as const, placeholder: 'yourname@upi', type: 'text' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key}>
              <label htmlFor={key} className="block text-xs text-[#888] font-medium mb-1.5">{label}</label>
              <input
                id={key}
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#333] rounded-xl px-3 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#25D366] transition-colors"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="w-full bg-[#25D366] hover:bg-[#1ea855] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Spinner size={16} /> : null}
            Register
          </button>

          <button
            onClick={() => navigate('/login')}
            className="w-full text-[#888] text-sm py-1 hover:text-white transition-colors"
          >
            Already registered? Login →
          </button>
        </div>
      </div>
    </div>
  );
}
