export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  hasSafetyPin: boolean;
  hasDuressPin: boolean;
  medicalNotes?: string;
  createdAt: string;
}

export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isVerified: boolean;
  verificationCode?: string;
  canReceiveSMS: boolean;
  canReceiveWhatsApp: boolean;
  canReceiveEmail: boolean;
  isPrimary: boolean;
  createdAt: string;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  speed?: number | null;
  heading?: number | null;
  batteryLevel?: number | null;
}

export interface EmergencySession {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  trackingToken: string;
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED' | 'DURESS';
  triggerType: 'ONE_TAP_SOS' | 'WALK_WITH_ME_TIMEOUT' | 'SILENT_ALARM' | 'SHAKE_GESTURE';
  startedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastAccuracy?: number | null;
  lastAddress?: string | null;
  batteryLevel?: number | null;
  alertSummary: string;
  breadcrumbs: LocationPoint[];
  notifiedContactsCount?: number;
}

export interface WalkWithMeTimer {
  id: string;
  userId: string;
  destination: string;
  durationMinutes: number;
  expiresAt?: string;
  endsAt: string;
  notes?: string;
  status: 'ACTIVE' | 'PENDING' | 'CHECKED_IN' | 'EXPIRED_TRIGGERED' | 'CANCELLED';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  details?: any;
  ipAddress?: string;
  timestamp: string;
}

export interface IncidentReport {
  id: string;
  userId: string;
  category: 'HARASSMENT' | 'STALKING' | 'DOMESTIC_ABUSE' | 'CYBER_HARASSMENT' | 'TRAFFICKING_SUSPICION' | 'ASSAULT' | 'OTHER';
  title: string;
  incidentDate: string;
  location: string;
  description: string;
  witnesses?: string;
  evidenceNotes?: string;
  suspectDetails?: string;
  isEncrypted?: boolean;
  status: 'DRAFT' | 'SAVED' | 'EXPORTED';
  createdAt: string;
}

export interface VerifiedHelpline {
  id: string;
  name: string;
  category: 'National Emergency' | 'Women Helpline' | 'Cyber Crime' | 'Child Protection' | 'Legal & NCW' | 'Mental Health';
  number: string;
  hours: string;
  description: string;
  region: string;
  tollFree: boolean;
  whatsapp?: string;
  website?: string;
}

export interface AIChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedActions?: string[];
  isEmergencyAlert?: boolean;
}
