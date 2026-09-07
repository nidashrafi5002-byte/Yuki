import React from 'react';
import {
  Shield,
  Users,
  Bot,
  PhoneCall,
  FileText,
  Clock,
  Settings,
  Calculator,
  LogOut,
  AlertTriangle,
  EyeOff
} from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
  onCamouflage: () => void;
  hasActiveSOS: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onCamouflage,
  hasActiveSOS
}) => {
  const handleQuickExit = () => {
    // Discreet immediate redirect to neutral safe site (e.g. Google News or Weather)
    window.location.replace('https://www.google.com');
  };

  const navItems = [
    { id: 'sos', label: 'SOS & Safety', icon: Shield, isSos: true },
    { id: 'contacts', label: 'Trusted Contacts', icon: Users },
    { id: 'ai', label: 'AI Safety Advisor', icon: Bot },
    { id: 'helplines', label: 'Verified Helplines', icon: PhoneCall },
    { id: 'walk', label: 'Walk With Me', icon: Clock },
    { id: 'incidents', label: 'Incident Vault', icon: FileText },
    { id: 'settings', label: 'Security & PINs', icon: Settings },
  ];

  return (
    <header className="bg-slate-950/90 border-bottom border-slate-800 sticky-top shadow-md z-3" style={{ backgroundColor: 'rgba(2, 6, 23, 0.92)', borderColor: '#1e293b', backdropFilter: 'blur(12px)' }}>
      {/* Top Utility Bar */}
      <div className="border-bottom py-1.5 px-3 small" style={{ backgroundColor: '#020617', borderColor: '#1e293b' }}>
        <div className="container-fluid max-w-7xl d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <span className="badge text-uppercase px-2.5 py-1 rounded-pill" style={{ backgroundColor: 'rgba(225, 29, 72, 0.15)', color: '#fb7185', border: '1px solid rgba(225, 29, 72, 0.3)' }}>
              24/7 Safety System
            </span>
            <span className="text-slate-400 d-none d-sm-inline" style={{ color: '#94a3b8' }}>
              Emergency Police: <strong className="text-slate-200">112</strong> &bull; Women Helpline: <strong className="text-slate-200">1091</strong>
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Quick Camouflage Button */}
            <button
              type="button"
              className="btn btn-sm py-1 px-2.5 d-flex align-items-center gap-1.5 rounded-2"
              style={{ backgroundColor: '#0f172a', color: '#cbd5e1', borderColor: '#334155' }}
              onClick={onCamouflage}
              title="Disguise as standard Calculator"
            >
              <Calculator size={13} className="text-slate-400" />
              <span className="d-none d-md-inline small font-medium">Disguise Mode</span>
            </button>

            {/* Quick Exit Button (Safety protection against coercive checks) */}
            <button
              type="button"
              className="btn btn-sm py-1 px-2.5 fw-bold d-flex align-items-center gap-1.5 rounded-2 shadow-sm"
              style={{ backgroundColor: '#e11d48', color: '#ffffff', borderColor: '#e11d48' }}
              onClick={handleQuickExit}
              title="Instantly exit to Google"
            >
              <EyeOff size={13} />
              <span className="small">Quick Exit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="container-fluid max-w-7xl py-2.5 px-3">
        <div className="d-flex align-items-center justify-content-between">
          {/* Logo Branding */}
          <div
            className="d-flex align-items-center gap-2.5 cursor-pointer text-decoration-none"
            onClick={() => setActiveTab('sos')}
            style={{ cursor: 'pointer' }}
          >
            <div
              className="rounded-3 d-flex align-items-center justify-content-center shadow-lg"
              style={{ backgroundColor: '#e11d48', color: '#ffffff', width: '40px', height: '40px', boxShadow: '0 4px 20px rgba(225, 29, 72, 0.35)' }}
            >
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h4 className="fw-bold text-white mb-0 tracking-tight" style={{ letterSpacing: '0.5px' }}>
                  Yuki<span style={{ color: '#f43f5e', fontSize: '12px', marginLeft: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Safety</span>
                </h4>
                {hasActiveSOS ? (
                  <span className="badge text-white px-2 py-0.5 rounded-pill font-mono" style={{ backgroundColor: '#e11d48', animation: 'pulse 1s infinite' }}>
                    SOS LIVE
                  </span>
                ) : (
                  <div className="d-none d-md-flex align-items-center gap-1.5 px-2.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                    <span className="text-uppercase fw-semibold" style={{ fontSize: '10px', color: '#34d399', letterSpacing: '0.5px' }}>Protected &amp; Live</span>
                  </div>
                )}
              </div>
              <small className="d-none d-sm-block" style={{ fontSize: '11px', color: '#64748b' }}>
                Production Women’s Safety &amp; Emergency Platform
              </small>
            </div>
          </div>

          {/* User Status / Auth Indicator */}
          {user && (
            <div className="d-flex align-items-center gap-3">
              <div className="text-end d-none d-md-block">
                <div className="fw-semibold text-slate-200 small" style={{ color: '#e2e8f0' }}>{user.name}</div>
                <div className="small" style={{ fontSize: '11px', color: '#64748b' }}>{user.email}</div>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center fw-bold small"
                style={{ width: '36px', height: '36px', backgroundColor: '#1e293b', border: '1px solid #334155', color: '#cbd5e1' }}
                title={user.name}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <button
                type="button"
                className="btn btn-sm p-1.5 rounded-3"
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#94a3b8' }}
                onClick={onLogout}
                title="Log out of account"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs Scrollable Menu */}
        <nav className="d-flex gap-1.5 overflow-x-auto py-2 border-top mt-2" style={{ whiteSpace: 'nowrap', borderColor: '#1e293b' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="btn btn-sm px-3 py-1.5 rounded-3 d-flex align-items-center gap-2 fw-semibold transition-all"
                style={{
                  backgroundColor: isActive
                    ? item.isSos
                      ? '#e11d48'
                      : '#1e293b'
                    : '#020617',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  border: isActive
                    ? item.isSos
                      ? '1px solid #f43f5e'
                      : '1px solid #334155'
                    : '1px solid #1e293b',
                  boxShadow: isActive && item.isSos ? '0 0 15px rgba(225, 29, 72, 0.4)' : 'none'
                }}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={16} style={{ color: isActive ? '#ffffff' : item.isSos ? '#f43f5e' : '#64748b' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
