import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { AuthLayout } from '../components/auth/AuthLayout';
import { AuthInput } from '../components/auth/AuthInput';

export const ForgotPassword: React.FC = () => {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError(undefined);
    setSuccessMessage(undefined);

    try {
      const res = await forgotPassword(email);
      setSuccessMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="space-y-1 text-left">
          <h2 className="text-2xl font-bold text-white tracking-tight">Reset your password</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Enter your email and we'll help you get back into your account.
          </p>
        </div>

        {/* Success State Banner */}
        {successMessage ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-200 text-xs leading-relaxed flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-cyan-100">Reset email requested</p>
                <p className="text-white/80">{successMessage}</p>
              </div>
            </div>

            <Link
              to="/login"
              className="w-full bg-white/10 hover:bg-white/15 border border-white/20 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Login</span>
            </Link>
          </div>
        ) : (
          /* Reset Form */
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <AuthInput
              id="reset-email"
              label="Email"
              type="email"
              placeholder="developer@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(undefined);
              }}
              error={error}
              icon={Mail}
              autoComplete="email"
              required
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(56,189,248,0.3)] hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <span>Send reset link</span>
              )}
            </button>

            {/* Back to Login link */}
            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-cyan-300 transition-colors font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
