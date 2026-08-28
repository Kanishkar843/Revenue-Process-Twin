import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, ArrowRight, Lock, Mail, User, Building2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signUpWithEmail(email, password, name, company);
      // After signup, go to onboarding to set up business profile
      navigate("/onboarding");
    } catch (err: any) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || "Google sign-up failed.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] overflow-y-auto flex flex-col justify-start py-10 px-4 relative">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-[var(--color-accent-light)] rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-100/50 rounded-full blur-3xl opacity-60 pointer-events-none" />

      <div className="mx-auto w-full max-w-xl z-10">
        <Link to="/" className="flex items-center justify-center gap-3 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-white border border-black/[0.08] shadow-sm flex items-center justify-center p-1 group-hover:scale-105 transition-transform">
            <img src="/logo.png" alt="Revenue Process Twin" className="w-full h-full object-contain" />
          </div>
          <span className="font-display font-bold text-xl text-[var(--color-ink)]">Revenue Process Twin</span>
        </Link>

        <h2 className="text-center text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Create your free workspace
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--color-muted)]">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-[var(--color-accent)] hover:underline">
            Sign in →
          </Link>
        </p>
      </div>

      <div className="mt-8 mx-auto w-full max-w-xl z-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white py-8 px-8 shadow-[var(--shadow-elevation-2)] rounded-2xl border border-[var(--color-border)]"
        >
          {/* Step progress pills */}
          <div className="mb-7 flex items-center justify-center gap-1 flex-wrap">
            {["Create Account", "Business Setup", "Connect Data", "Dashboard"].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-full ${i === 0 ? "bg-[var(--color-ink)] text-white" : "bg-gray-100 text-gray-400"}`}>
                  {i === 0 ? "● " : `${i + 1}. `}{s}
                </span>
                {i < 3 && <span className="text-gray-300 text-[10px]">›</span>}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200/60 rounded-xl text-xs text-red-800 font-semibold">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[var(--color-border)] bg-white hover:bg-gray-50 active:bg-gray-100 transition-all text-sm font-semibold text-[var(--color-ink)] shadow-sm hover:shadow-md disabled:opacity-60 mb-5"
          >
            {isGoogleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <GoogleLogo />
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">or sign up with email</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <User size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dharanish Purusothaman"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">Company Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Building2 size={15} />
                  </div>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Acme Global Systems"
                    className="block w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">Work Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail size={15} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--color-ink)] mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={15} />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password (min 6 chars)"
                  className="block w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
              <input type="checkbox" required id="terms" className="mt-0.5 rounded border-gray-300 text-[var(--color-accent)] focus:ring-[var(--color-accent)]" />
              <label htmlFor="terms">
                I agree to the{" "}
                <a href="#terms" onClick={(e) => e.preventDefault()} className="text-[var(--color-accent)] hover:underline">Terms of Service</a>{" "}
                and{" "}
                <a href="#privacy" onClick={(e) => e.preventDefault()} className="text-[var(--color-accent)] hover:underline">Privacy Policy</a>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[var(--color-ink)] hover:bg-black transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Create Account & Set Up Workspace
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 border-t border-[var(--color-border)] pt-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
              <Shield size={12} />
              SOC2 Type II · Enterprise-grade encryption · No credit card required
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
