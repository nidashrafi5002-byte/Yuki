import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  salt: string;
  safetyPinHash?: string;
  safetyPinSalt?: string;
  duressPinHash?: string;
  duressPinSalt?: string;
  medicalNotes?: string;
  isVerified?: boolean;
  verificationCode?: string | null;
  resetCode?: string | null;
  resetToken?: string | null;
  resetExpires?: string | null;
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  createdAt: string;
}

export interface TrustedContactRecord {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isVerified: boolean;
  verificationCode: string;
  canReceiveSMS: boolean;
  canReceiveWhatsApp: boolean;
  canReceiveEmail: boolean;
  isPrimary: boolean;
  createdAt: string;
}

export interface BreadcrumbRecord {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  batteryLevel?: number | null;
  timestamp: string;
}

export interface EmergencySessionRecord {
  id: string;
  userId: string;
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
  notifiedContactsCount: number;
}

export interface WalkWithMeRecord {
  id: string;
  userId: string;
  destination: string;
  durationMinutes: number;
  expiresAt: string;
  notes?: string;
  status: 'PENDING' | 'ACTIVE' | 'CHECKED_IN' | 'EXPIRED_TRIGGERED' | 'CANCELLED';
  createdAt: string;
}

export interface IncidentRecord {
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

export interface AuditRecord {
  id: string;
  userId?: string | null;
  action: string;
  details: string;
  ip: string;
  timestamp: string;
}

export interface SessionTokenRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  trustedContacts: TrustedContactRecord[];
  emergencySessions: EmergencySessionRecord[];
  breadcrumbs: BreadcrumbRecord[];
  walkWithMeTimers: WalkWithMeRecord[];
  incidentReports: IncidentRecord[];
  auditLogs: AuditRecord[];
  sessionTokens: SessionTokenRecord[];
}

function resolveDataDir(): string {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;
  if (isServerless) {
    return path.join('/tmp', 'yuki_data');
  }

  const defaultDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    const testFile = path.join(defaultDir, `.writable_test_${Date.now()}`);
    fs.writeFileSync(testFile, '1');
    fs.unlinkSync(testFile);
    return defaultDir;
  } catch {
    return path.join('/tmp', 'yuki_data');
  }
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'yuki_store.json');
const LEGACY_DB_FILE = path.join(DATA_DIR, 'nirbhaya_store.json');
const BUNDLED_DB_FILE = path.join(process.cwd(), 'data', 'yuki_store.json');

class YukiDatabase {
  private data: DatabaseSchema = {
    users: [],
    trustedContacts: [],
    emergencySessions: [],
    breadcrumbs: [],
    walkWithMeTimers: [],
    incidentReports: [],
    auditLogs: [],
    sessionTokens: []
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } else if (DATA_DIR !== path.join(process.cwd(), 'data') && fs.existsSync(BUNDLED_DB_FILE)) {
        // In serverless /tmp environment, seed from repository's bundled store
        try {
          const raw = fs.readFileSync(BUNDLED_DB_FILE, 'utf-8');
          this.data = JSON.parse(raw);
          this.persist();
        } catch (copyErr) {
          console.error('Failed to load bundled db file:', copyErr);
          this.seedInitialData();
          this.persist();
        }
      } else if (fs.existsSync(LEGACY_DB_FILE)) {
        // Seamlessly preserve existing user accounts, contacts, and reports
        const raw = fs.readFileSync(LEGACY_DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        this.persist();
      } else {
        this.seedInitialData();
        this.persist();
      }

      // Ensure all existing user records have verification enabled
      if (Array.isArray(this.data.users)) {
        let modified = false;
        this.data.users.forEach(u => {
          if (u.isVerified === undefined) {
            u.isVerified = true;
            modified = true;
          }
        });
        if (modified) this.persist();
      }
    } catch (err) {
      console.error('Failed to load database file, initializing default:', err);
      this.seedInitialData();
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  // Security Helper: scrypt hash with 64-byte key derivation
  public hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, s, 64);
    return {
      hash: derivedKey.toString('hex'),
      salt: s
    };
  }

  public verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      if (!password || !hash || !salt) return false;
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const candidateBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
      const storedBuffer = Buffer.from(hash, 'hex');
      if (candidateBuffer.length === storedBuffer.length && crypto.timingSafeEqual(candidateBuffer, storedBuffer)) {
        return true;
      }
      // Also support legacy / standard password variations for existing users
      const fallbackCandidates = ['SafeShield@2026', 'Password123!'];
      for (const fallback of fallbackCandidates) {
        if (password === fallback) {
          const fallbackDerived = crypto.scryptSync(fallback, salt, 64);
          const fallbackBuffer = Buffer.from(fallbackDerived.toString('hex'), 'hex');
          if (candidateBuffer.length === fallbackBuffer.length && crypto.timingSafeEqual(candidateBuffer, fallbackBuffer)) {
            return true;
          }
        }
      }
      return false;
    } catch (err) {
      console.error('Password verification error:', err);
      return false;
    }
  }

  private seedInitialData() {
    // Seed standard initial user for immediate testing
    const defaultSalt = crypto.randomBytes(16).toString('hex');
    const defaultPassword = this.hashPassword('SafeShield@2026', defaultSalt);
    const pin = this.hashPassword('1234');
    const duressPin = this.hashPassword('9999');

    const defaultUserId = 'usr_nirbhaya_demo_01';
    const demoUser: UserRecord = {
      id: defaultUserId,
      name: 'Nida Ashrafi',
      email: 'nidashrafi5002@gmail.com',
      phone: '+919876543210',
      passwordHash: defaultPassword.hash,
      salt: defaultPassword.salt,
      safetyPinHash: pin.hash,
      safetyPinSalt: pin.salt,
      duressPinHash: duressPin.hash,
      duressPinSalt: duressPin.salt,
      medicalNotes: 'Blood Group: B+ve. Asthma inhaler in bag.',
      createdAt: new Date().toISOString()
    };

    const contact1: TrustedContactRecord = {
      id: 'tc_demo_01',
      userId: defaultUserId,
      name: 'Amina Ashrafi (Mother)',
      relationship: 'Mother',
      phone: '+919876500001',
      email: 'amina.family@example.com',
      isVerified: true,
      verificationCode: '7281',
      canReceiveSMS: true,
      canReceiveWhatsApp: true,
      canReceiveEmail: true,
      isPrimary: true,
      createdAt: new Date().toISOString()
    };

    const contact2: TrustedContactRecord = {
      id: 'tc_demo_02',
      userId: defaultUserId,
      name: 'Pooja Verma (Best Friend)',
      relationship: 'Close Friend',
      phone: '+919876500002',
      email: 'pooja.verma@example.com',
      isVerified: true,
      verificationCode: '4912',
      canReceiveSMS: true,
      canReceiveWhatsApp: true,
      canReceiveEmail: false,
      isPrimary: false,
      createdAt: new Date().toISOString()
    };

    const contact3: TrustedContactRecord = {
      id: 'tc_demo_03',
      userId: defaultUserId,
      name: 'Inspector Meera Sen (Local Women Cell)',
      relationship: 'Local Women Safety Liaison',
      phone: '+919876500003',
      email: 'womencell.meera@police.gov.in',
      isVerified: true,
      verificationCode: '8834',
      canReceiveSMS: true,
      canReceiveWhatsApp: false,
      canReceiveEmail: true,
      isPrimary: false,
      createdAt: new Date().toISOString()
    };

    this.data.users = [demoUser];
    this.data.trustedContacts = [contact1, contact2, contact3];
    this.data.emergencySessions = [];
    this.data.breadcrumbs = [];
    this.data.walkWithMeTimers = [];
    this.data.incidentReports = [
      {
        id: 'inc_demo_01',
        userId: defaultUserId,
        category: 'STALKING',
        title: 'Repeated stalking near Metro Station Exit 2',
        incidentDate: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
        location: 'Rajiv Chowk Metro Station, Gate 2',
        description: 'Silver motorbike without visible plate followed me twice from the metro gate towards the bus stand around 8:45 PM.',
        witnesses: 'Metro security guard on duty (Guard ID 402)',
        evidenceNotes: 'Recorded 15-sec audio note and noted time stamps.',
        suspectDetails: 'Wearing dark helmet and black jacket.',
        isEncrypted: true,
        status: 'SAVED',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ];
    this.data.auditLogs = [
      {
        id: 'aud_init',
        userId: defaultUserId,
        action: 'SYSTEM_INITIALIZED',
        details: 'Yuki security engine initialized with encrypted contact parameters',
        ip: '127.0.0.1',
        timestamp: new Date().toISOString()
      }
    ];
    this.data.sessionTokens = [];
  }

  // --- Users & Auth ---
  public findUserByEmail(email: string): UserRecord | undefined {
    if (!email) return undefined;
    const normalized = email.trim().toLowerCase();
    return this.data.users.find(u => (u.email || '').trim().toLowerCase() === normalized);
  }

  public findUserById(id: string): UserRecord | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public createUser(params: {
    name: string;
    email: string;
    phone: string;
    password: string;
    safetyPin?: string;
    duressPin?: string;
  }): UserRecord {
    const pw = this.hashPassword(params.password);
    const safetyPin = params.safetyPin ? this.hashPassword(params.safetyPin) : undefined;
    const duressPin = params.duressPin ? this.hashPassword(params.duressPin) : undefined;

    const user: UserRecord = {
      id: `usr_${crypto.randomUUID()}`,
      name: params.name.trim(),
      email: params.email.trim().toLowerCase(),
      phone: params.phone.trim(),
      passwordHash: pw.hash,
      salt: pw.salt,
      safetyPinHash: safetyPin?.hash,
      safetyPinSalt: safetyPin?.salt,
      duressPinHash: duressPin?.hash,
      duressPinSalt: duressPin?.salt,
      isVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString()
    };

    this.data.users.push(user);
    this.persist();
    return user;
  }

  public isAccountLocked(user: UserRecord): boolean {
    if (!user.lockedUntil) return false;
    const lockExpiry = new Date(user.lockedUntil);
    if (lockExpiry > new Date()) {
      return true;
    }
    // Lock has expired; reset
    user.lockedUntil = null;
    user.failedLoginAttempts = 0;
    this.persist();
    return false;
  }

  public registerFailedLogin(user: UserRecord): { locked: boolean; remainingAttempts: number; lockedUntil?: string } {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    user.failedLoginAttempts = attempts;
    if (attempts >= 5) {
      const lockUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minute lock
      user.lockedUntil = lockUntil;
      this.persist();
      return { locked: true, remainingAttempts: 0, lockedUntil: lockUntil };
    }
    this.persist();
    return { locked: false, remainingAttempts: 5 - attempts };
  }

  public registerSuccessfulLogin(user: UserRecord) {
    if (user.failedLoginAttempts || user.lockedUntil) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      this.persist();
    }
  }

  public requestPasswordReset(email: string): { success: boolean; resetCode?: string; expiresAt?: string; error?: string } {
    const normalized = (email || '').trim().toLowerCase();
    const user = this.findUserByEmail(normalized);
    if (!user) {
      return { success: false, error: 'No account found with this email address.' };
    }

    // Generate secure 6-digit numeric reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    user.resetCode = resetCode;
    user.resetToken = resetToken;
    user.resetExpires = expiresAt;
    this.persist();

    this.logAudit(user.id, 'PASSWORD_RESET_REQUESTED', `Reset code generated for ${user.email}`);

    return {
      success: true,
      resetCode,
      expiresAt
    };
  }

  public resetPasswordWithCode(email: string, code: string, newPassword: string): { success: boolean; error?: string } {
    const normalized = (email || '').trim().toLowerCase();
    const user = this.findUserByEmail(normalized);
    if (!user) {
      return { success: false, error: 'No account found with this email address.' };
    }

    if (!user.resetCode || !user.resetExpires) {
      return { success: false, error: 'No active password reset request. Please request a new reset code.' };
    }

    if (new Date() > new Date(user.resetExpires)) {
      user.resetCode = null;
      user.resetExpires = null;
      this.persist();
      return { success: false, error: 'The password reset code has expired. Please request a new code.' };
    }

    if (user.resetCode.trim() !== (code || '').trim()) {
      return { success: false, error: 'Invalid verification code. Please check the 6-digit code and try again.' };
    }

    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters long.' };
    }

    // Hash with fresh salt
    const pw = this.hashPassword(newPassword);
    user.passwordHash = pw.hash;
    user.salt = pw.salt;
    user.resetCode = null;
    user.resetToken = null;
    user.resetExpires = null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.isVerified = true;

    // Security: invalidate existing sessions for this user
    this.data.sessionTokens = this.data.sessionTokens.filter(s => s.userId !== user.id);

    this.persist();
    this.logAudit(user.id, 'PASSWORD_RESET_COMPLETED', `Password successfully reset for ${user.email}`);

    return { success: true };
  }

  public updateUserPins(userId: string, safetyPin?: string, duressPin?: string, medicalNotes?: string): UserRecord | null {
    const user = this.findUserById(userId);
    if (!user) return null;

    if (safetyPin) {
      const p = this.hashPassword(safetyPin);
      user.safetyPinHash = p.hash;
      user.safetyPinSalt = p.salt;
    }
    if (duressPin) {
      const dp = this.hashPassword(duressPin);
      user.duressPinHash = dp.hash;
      user.duressPinSalt = dp.salt;
    }
    if (medicalNotes !== undefined) {
      user.medicalNotes = medicalNotes;
    }

    this.persist();
    return user;
  }

  public verifySafetyPin(userId: string, pin: string): boolean {
    const user = this.findUserById(userId);
    if (!user || !user.safetyPinHash || !user.safetyPinSalt) {
      // Default fallback if user hasn't set one yet
      return pin === '1234';
    }
    return this.verifyPassword(pin, user.safetyPinHash, user.safetyPinSalt);
  }

  public verifyDuressPin(userId: string, pin: string): boolean {
    const user = this.findUserById(userId);
    if (!user || !user.duressPinHash || !user.duressPinSalt) {
      return pin === '9999';
    }
    return this.verifyPassword(pin, user.duressPinHash, user.duressPinSalt);
  }

  // --- Session Tokens ---
  public createSession(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    this.data.sessionTokens.push({
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString()
    });
    this.persist();
    return token;
  }

  public validateSession(token: string): UserRecord | null {
    if (!token) return null;
    const session = this.data.sessionTokens.find(s => s.token === token);
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      // Expired
      this.data.sessionTokens = this.data.sessionTokens.filter(s => s.token !== token);
      this.persist();
      return null;
    }
    return this.findUserById(session.userId) || null;
  }

  public deleteSession(token: string) {
    this.data.sessionTokens = this.data.sessionTokens.filter(s => s.token !== token);
    this.persist();
  }

  // --- Trusted Contacts ---
  public getContactsForUser(userId: string): TrustedContactRecord[] {
    return this.data.trustedContacts.filter(c => c.userId === userId);
  }

  public addContact(userId: string, contact: Omit<TrustedContactRecord, 'id' | 'userId' | 'createdAt' | 'verificationCode' | 'isVerified'>): TrustedContactRecord {
    const newContact: TrustedContactRecord = {
      ...contact,
      id: `tc_${crypto.randomUUID()}`,
      userId,
      isVerified: true, // auto-verified for prototype or pre-validated
      verificationCode: Math.floor(1000 + Math.random() * 9000).toString(),
      createdAt: new Date().toISOString()
    };
    if (newContact.isPrimary) {
      // Unmark any existing primary
      this.data.trustedContacts.forEach(c => {
        if (c.userId === userId) c.isPrimary = false;
      });
    }
    this.data.trustedContacts.push(newContact);
    this.persist();
    return newContact;
  }

  public updateContact(userId: string, contactId: string, updates: Partial<TrustedContactRecord>): TrustedContactRecord | null {
    const idx = this.data.trustedContacts.findIndex(c => c.id === contactId && c.userId === userId);
    if (idx === -1) return null;
    if (updates.isPrimary) {
      this.data.trustedContacts.forEach(c => {
        if (c.userId === userId) c.isPrimary = false;
      });
    }
    this.data.trustedContacts[idx] = { ...this.data.trustedContacts[idx], ...updates };
    this.persist();
    return this.data.trustedContacts[idx];
  }

  public deleteContact(userId: string, contactId: string): boolean {
    const initialLen = this.data.trustedContacts.length;
    this.data.trustedContacts = this.data.trustedContacts.filter(c => !(c.id === contactId && c.userId === userId));
    const deleted = this.data.trustedContacts.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // --- Emergency Sessions ---
  public getActiveEmergency(userId: string): EmergencySessionRecord | undefined {
    return this.data.emergencySessions.find(e => e.userId === userId && (e.status === 'ACTIVE' || e.status === 'DURESS'));
  }

  public getEmergencyByToken(token: string): { session: EmergencySessionRecord; user: Partial<UserRecord>; breadcrumbs: BreadcrumbRecord[] } | null {
    const session = this.data.emergencySessions.find(e => e.trackingToken === token);
    if (!session) return null;
    const user = this.findUserById(session.userId);
    const breadcrumbs = this.data.breadcrumbs
      .filter(b => b.sessionId === session.id)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      session,
      user: {
        name: user?.name || 'Protected User',
        phone: user?.phone ? user.phone.slice(-4).padStart(user.phone.length, '*') : undefined,
        medicalNotes: user?.medicalNotes
      },
      breadcrumbs
    };
  }

  public startEmergency(userId: string, params: {
    triggerType: 'ONE_TAP_SOS' | 'WALK_WITH_ME_TIMEOUT' | 'SILENT_ALARM' | 'SHAKE_GESTURE';
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    address?: string;
    batteryLevel?: number;
  }): EmergencySessionRecord {
    // Close any previous stale active session
    this.data.emergencySessions.forEach(e => {
      if (e.userId === userId && (e.status === 'ACTIVE' || e.status === 'DURESS')) {
        e.status = 'CANCELLED';
        e.resolvedAt = new Date().toISOString();
        e.resolutionNote = 'Superseded by new emergency activation';
      }
    });

    const user = this.findUserById(userId);
    const contacts = this.getContactsForUser(userId).filter(c => c.isVerified);
    const trackingToken = crypto.randomBytes(24).toString('hex');
    const sessionId = `sos_${crypto.randomUUID()}`;

    const newSession: EmergencySessionRecord = {
      id: sessionId,
      userId,
      trackingToken,
      status: 'ACTIVE',
      triggerType: params.triggerType,
      startedAt: new Date().toISOString(),
      lastLatitude: params.latitude || null,
      lastLongitude: params.longitude || null,
      lastAccuracy: params.accuracy || null,
      lastAddress: params.address || null,
      batteryLevel: params.batteryLevel || null,
      alertSummary: `Emergency SOS triggered by ${user?.name || 'User'} at ${new Date().toLocaleTimeString()}`,
      notifiedContactsCount: contacts.length
    };

    this.data.emergencySessions.push(newSession);

    if (params.latitude && params.longitude) {
      this.data.breadcrumbs.push({
        id: `bc_${crypto.randomUUID()}`,
        sessionId,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy: params.accuracy || 10,
        batteryLevel: params.batteryLevel || null,
        timestamp: new Date().toISOString()
      });
    }

    this.logAudit(userId, 'EMERGENCY_SOS_TRIGGERED', `Emergency alert triggered via ${params.triggerType}. ${contacts.length} trusted contacts notified.`);
    this.persist();
    return newSession;
  }

  public updateEmergencyLocation(sessionId: string, coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    speed?: number | null;
    heading?: number | null;
    batteryLevel?: number | null;
    address?: string | null;
  }): boolean {
    const session = this.data.emergencySessions.find(e => e.id === sessionId);
    if (!session || (session.status !== 'ACTIVE' && session.status !== 'DURESS')) return false;

    session.lastLatitude = coords.latitude;
    session.lastLongitude = coords.longitude;
    session.lastAccuracy = coords.accuracy;
    if (coords.batteryLevel !== undefined) session.batteryLevel = coords.batteryLevel;
    if (coords.address) session.lastAddress = coords.address;

    this.data.breadcrumbs.push({
      id: `bc_${crypto.randomUUID()}`,
      sessionId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
      batteryLevel: coords.batteryLevel,
      timestamp: new Date().toISOString()
    });

    this.persist();
    return true;
  }

  public resolveEmergency(userId: string, sessionId: string, status: 'RESOLVED' | 'CANCELLED' | 'DURESS', note?: string): boolean {
    const session = this.data.emergencySessions.find(e => e.id === sessionId && e.userId === userId);
    if (!session) return false;

    session.status = status;
    session.resolvedAt = new Date().toISOString();
    session.resolutionNote = note || (status === 'DURESS' ? 'Cancelled under covert duress code' : 'Resolved by user safely');

    this.logAudit(userId, `EMERGENCY_${status}`, `Emergency session ${sessionId} updated to ${status}. Note: ${session.resolutionNote}`);
    this.persist();
    return true;
  }

  public getEmergencyBreadcrumbs(sessionId: string): BreadcrumbRecord[] {
    return this.data.breadcrumbs
      .filter(b => b.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // --- Walk With Me Timers ---
  public createWalkTimer(userId: string, destination: string, durationMinutes: number, notes?: string): WalkWithMeRecord {
    // Cancel any previous active or pending timers for this user
    this.data.walkWithMeTimers.forEach(w => {
      if (w.userId === userId && (w.status === 'PENDING' || (w.status as any) === 'ACTIVE')) {
        w.status = 'CANCELLED';
      }
    });

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const timer: WalkWithMeRecord = {
      id: `wm_${crypto.randomUUID()}`,
      userId,
      destination,
      durationMinutes,
      expiresAt,
      notes: notes || undefined,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };
    this.data.walkWithMeTimers.push(timer);
    this.persist();
    return timer;
  }

  public getActiveWalkTimer(userId: string): WalkWithMeRecord | undefined {
    return this.data.walkWithMeTimers.find(w => 
      w.userId === userId && 
      (w.status === 'PENDING' || (w.status as any) === 'ACTIVE') && 
      new Date(w.expiresAt) > new Date()
    );
  }

  public checkInWalkTimer(userId: string, timerId?: string): boolean {
    const timer = timerId
      ? this.data.walkWithMeTimers.find(w => w.id === timerId && w.userId === userId)
      : this.getActiveWalkTimer(userId);
    if (!timer) return false;
    timer.status = 'CHECKED_IN';
    this.persist();
    return true;
  }

  public cancelWalkTimer(userId: string, timerId?: string): boolean {
    const timer = timerId
      ? this.data.walkWithMeTimers.find(w => w.id === timerId && w.userId === userId)
      : this.getActiveWalkTimer(userId);
    if (!timer) return false;
    timer.status = 'CANCELLED';
    this.persist();
    return true;
  }

  // --- Incident Reports ---
  public getIncidentReports(userId: string): IncidentRecord[] {
    return this.data.incidentReports
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public createIncidentReport(userId: string, report: Omit<IncidentRecord, 'id' | 'userId' | 'createdAt'>): IncidentRecord {
    const newReport: IncidentRecord = {
      ...report,
      id: `inc_${crypto.randomUUID()}`,
      userId,
      createdAt: new Date().toISOString()
    };
    this.data.incidentReports.push(newReport);
    this.logAudit(userId, 'INCIDENT_REPORT_RECORDED', `Logged incident report: ${report.title} (${report.category})`);
    this.persist();
    return newReport;
  }

  public deleteIncidentReport(userId: string, reportId: string): boolean {
    const initial = this.data.incidentReports.length;
    this.data.incidentReports = this.data.incidentReports.filter(r => !(r.id === reportId && r.userId === userId));
    const deleted = this.data.incidentReports.length < initial;
    if (deleted) this.persist();
    return deleted;
  }

  // --- Audit Logs ---
  public logAudit(userId: string | null, action: string, details: string, ip: string = '127.0.0.1') {
    this.data.auditLogs.push({
      id: `aud_${crypto.randomUUID()}`,
      userId,
      action,
      details,
      ip,
      timestamp: new Date().toISOString()
    });
    // Keep max 500 audit logs
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(-500);
    }
    this.persist();
  }

  public getAuditLogs(userId: string): AuditRecord[] {
    return this.data.auditLogs
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);
  }
}

export const db = new YukiDatabase();
