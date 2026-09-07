import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User,
  Phone,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  PhoneCall,
  ChevronRight,
  Info,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';

interface AuthViewProps {
  onLogin: (credentials: { email: string; password: string }) => Promise<void>;
  onRegister: (data: {
    name: string;
    phone: string;
    email: string;
    password: string;
    safetyPin?: string;
  }) => Promise<void>;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AuthView: React.FC<AuthViewProps> = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [safetyPin, setSafetyPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Structured Error State
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Forgot Password State
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetCode, setResetCode] = useState('');
  const [generatedCodeDisplay, setGeneratedCodeDisplay] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Emergency safety guidance drawer/accordion
  const [showSafetyGuide, setShowSafetyGuide] = useState(false);

  const clearNotifications = () => {
    setErrorMessage('');
    setErrorCode(null);
    setSuccessMessage('');
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    clearNotifications();
    if (newMode !== 'forgot_password') {
      setResetStep(1);
      setGeneratedCodeDisplay(null);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both your email address and password.');
      setErrorCode('MISSING_FIELDS');
      return;
    }

    setIsLoading(true);
    try {
      await onLogin({ email: cleanEmail, password });
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to log in. Please check your credentials.');
      setErrorCode(err.code || null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();

    if (!cleanName || !cleanEmail || !cleanPhone || !password) {
      setErrorMessage('Please fill in all required fields (Name, Phone, Email, and Password).');
      setErrorCode('MISSING_FIELDS');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      setErrorCode('WEAK_PASSWORD');
      return;
    }

    setIsLoading(true);
    try {
      await onRegister({
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        password,
        safetyPin: safetyPin || undefined
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
      setErrorCode(err.code || null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter the email address registered with your Yuki account.');
      setErrorCode('EMAIL_REQUIRED');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to request password reset code.');
        setErrorCode(data.code || null);
        return;
      }

      setGeneratedCodeDisplay(data.resetCode);
      setResetCode(data.resetCode || '');
      setResetStep(2);
      setSuccessMessage(`Password reset code generated. Please set your new password below.`);
    } catch (err: any) {
      setErrorMessage('Network or server error. Could not connect to Yuki authentication service.');
      setErrorCode('SERVICE_UNAVAILABLE');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    clearNotifications();

    if (!resetCode.trim()) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both password entries.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: resetCode.trim(),
          newPassword
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to reset password.');
        setErrorCode(data.code || null);
        return;
      }

      setSuccessMessage('Password reset successfully! You can now log in with your new password.');
      setMode('login');
      setPassword(newPassword);
      setResetStep(1);
      setGeneratedCodeDisplay(null);
    } catch {
      setErrorMessage('Network or server error. Could not reset password.');
      setErrorCode('SERVICE_UNAVAILABLE');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-rose-600 selection:text-white">
      {/* Top Helpline Emergency Strip */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span className="font-semibold tracking-wide text-white">Emergency Helplines (Toll-Free):</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300 flex-wrap">
            <a
              href="tel:112"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/70 border border-rose-700/50 text-rose-300 hover:bg-rose-900/80 transition-colors font-mono font-bold"
            >
              <PhoneCall size={12} /> Police &amp; Emergency: 112
            </a>
            <a
              href="tel:1091"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-rose-300 hover:bg-slate-700 transition-colors font-mono font-bold"
            >
              <PhoneCall size={12} /> Women Helpline: 1091
            </a>
            <button
              onClick={() => setShowSafetyGuide(!showSafetyGuide)}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            >
              <Info size={13} /> Immediate Safety Guide
            </button>
          </div>
        </div>
      </header>

      {/* Immediate Emergency Safety Guide Modal / Drawer */}
      {showSafetyGuide && (
        <div className="bg-slate-900 border-b border-slate-800 p-4 shadow-xl">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Shield className="text-rose-500" size={20} />
                <h3 className="text-sm font-bold text-white tracking-wide uppercase">
                  Immediate Emergency Guidance (No Login Required)
                </h3>
              </div>
              <button
                onClick={() => setShowSafetyGuide(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <p className="font-semibold text-rose-400 mb-1">1. If Actively Followed</p>
                <p className="text-slate-400 leading-relaxed">
                  Head immediately toward well-lit, populated areas (metro station, open pharmacy, fuel station, bank ATM with guard). Do not walk directly to an isolated home entrance.
                </p>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <p className="font-semibold text-amber-400 mb-1">2. Instant Voice Distress</p>
                <p className="text-slate-400 leading-relaxed">
                  Call <strong>112</strong> immediately. Leave the line open and clearly speak your current landmark or street intersection even if you cannot hold a normal conversation.
                </p>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <p className="font-semibold text-emerald-400 mb-1">3. In Transit / Cabs</p>
                <p className="text-slate-400 leading-relaxed">
                  Note the vehicle registration number. Ensure rear door child locks are disengaged. If route deviates without explanation, instruct driver firmly to pull over at the nearest lit signal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Authentication Container */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-500 shadow-lg shadow-rose-950/50 mb-3">
              <Shield size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              <span>Yuki</span>
              <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold tracking-wider">
                Safety
              </span>
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Production Women's Safety, Emergency SOS &amp; Threat Defense Platform
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-slate-900/95 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-sm">
            {/* Mode Switcher Tabs */}
            {mode !== 'forgot_password' && (
              <div className="flex rounded-xl bg-slate-950/80 p-1 mb-6 border border-slate-800">
                <button
                  type="button"
                  id="tab-sign-in"
                  onClick={() => handleModeChange('login')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'login'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  id="tab-register"
                  onClick={() => handleModeChange('register')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    mode === 'register'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Forgot Password Header */}
            {mode === 'forgot_password' && (
              <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-3">
                <button
                  type="button"
                  onClick={() => handleModeChange('login')}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Password Recovery
                </span>
              </div>
            )}

            {/* Contextual Feedback Messages */}
            {successMessage && (
              <div className="mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-400" />
                <div className="flex-1">{successMessage}</div>
              </div>
            )}

            {errorMessage && (
              <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-700/50 text-rose-200 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1">
                    <p className="font-medium leading-relaxed">{errorMessage}</p>

                    {/* Actionable buttons based on error codes */}
                    {errorCode === 'ACCOUNT_NOT_FOUND' && mode === 'login' && (
                      <div className="mt-2.5 pt-2 border-t border-rose-900/60 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleModeChange('register')}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors"
                        >
                          Register with this email
                        </button>
                      </div>
                    )}

                    {(errorCode === 'INVALID_CREDENTIALS' || errorCode === 'ACCOUNT_LOCKED') && mode === 'login' && (
                      <div className="mt-2.5 pt-2 border-t border-rose-900/60 flex items-center justify-between">
                        <span className="text-slate-300">Need to reset your credentials?</span>
                        <button
                          type="button"
                          onClick={() => handleModeChange('forgot_password')}
                          className="text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2"
                        >
                          Reset Password
                        </button>
                      </div>
                    )}

                    {errorCode === 'SERVICE_UNAVAILABLE' && (
                      <div className="mt-2 pt-2 border-t border-rose-900/60 text-slate-400">
                        Our security infrastructure is verifying database availability. Please try again.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 1. SIGN IN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="login-email">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail size={16} />
                    </div>
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      autoComplete="email"
                      required
                      className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300" htmlFor="login-password">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => handleModeChange('forgot_password')}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock size={16} />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      autoComplete="current-password"
                      required
                      className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="btn-login-submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 disabled:opacity-60 cursor-pointer min-h-[44px]"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In Securely</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 2. REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="reg-name">
                    Full Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <User size={16} />
                    </div>
                    <input
                      id="reg-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Nida Ashrafi"
                      required
                      className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="reg-phone">
                    Mobile Phone (For Emergency Dispatch) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Phone size={16} />
                    </div>
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      required
                      className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="reg-email">
                    Email Address *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail size={16} />
                    </div>
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      autoComplete="email"
                      required
                      className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300" htmlFor="reg-password">
                      Password (Min 8 characters) *
                    </label>
                    <span className="text-[10px] text-slate-500">scrypt encrypted</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock size={16} />
                    </div>
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="reg-pin">
                    Emergency Disarm PIN (Optional, 4 Digits)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <KeyRound size={16} />
                    </div>
                    <input
                      id="reg-pin"
                      type="password"
                      maxLength={4}
                      value={safetyPin}
                      onChange={(e) => setSafetyPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Default: 1234"
                      className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Used to safely cancel or stand down SOS emergencies.</p>
                </div>

                <button
                  type="submit"
                  id="btn-register-submit"
                  disabled={isLoading}
                  className="w-full mt-3 py-3 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 disabled:opacity-60 cursor-pointer min-h-[44px]"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Register &amp; Activate Yuki</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* 3. FORGOT PASSWORD FLOW */}
            {mode === 'forgot_password' && (
              <div className="space-y-4">
                {resetStep === 1 ? (
                  <form onSubmit={handleRequestResetCode} className="space-y-4">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Enter the email address associated with your Yuki account. We will immediately generate a secure 6-digit reset code.
                    </p>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="forgot-email">
                        Registered Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                          <Mail size={16} />
                        </div>
                        <input
                          id="forgot-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@domain.com"
                          required
                          className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      {isLoading ? <RefreshCw size={16} className="animate-spin" /> : 'Request 6-Digit Reset Code'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                    {generatedCodeDisplay && (
                      <div className="p-3 bg-slate-950 border border-rose-500/40 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                          Generated Reset Code (Valid for 15 minutes)
                        </span>
                        <span className="text-xl font-mono font-bold tracking-widest text-rose-400 select-all">
                          {generatedCodeDisplay}
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="reset-code-input">
                        Verification Code (6 Digits)
                      </label>
                      <input
                        id="reset-code-input"
                        type="text"
                        maxLength={6}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="e.g. 123456"
                        required
                        className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="new-pw-input">
                        New Password (Min 8 characters)
                      </label>
                      <div className="relative">
                        <input
                          id="new-pw-input"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          required
                          minLength={8}
                          className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl pl-3 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                        >
                          {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5" htmlFor="confirm-pw-input">
                        Confirm New Password
                      </label>
                      <input
                        id="confirm-pw-input"
                        type={showNewPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        minLength={8}
                        className="w-full bg-slate-950/90 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                    >
                      {isLoading ? <RefreshCw size={16} className="animate-spin" /> : 'Set New Password & Log In'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Direct Public Emergency Support Note */}
          <div className="mt-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
            <p className="flex items-center justify-center gap-1.5 font-medium text-slate-300 mb-1">
              <Shield size={14} className="text-rose-500" />
              <span>Immediate Assistance Guarantee</span>
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Emergency assistance helplines (112, 1091) and public safety guides are always accessible without logging in.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-slate-600 border-t border-slate-900 bg-slate-950">
        Yuki &bull; Confidential &bull; End-to-End Encrypted &bull; 24/7 Monitored
      </footer>
    </div>
  );
};
