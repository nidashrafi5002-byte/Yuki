import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { db } from './db.ts';
import { generateSafetyGuidance } from './gemini.ts';

export function createYukiApp(): express.Express {
  const app = express();

  // Trust proxy for proper HTTPS protocol detection on Vercel, Cloud Run, Cloudflare, Render, etc.
  app.set('trust proxy', true);

  // Global Middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Bullet-proof CORS configuration supporting cross-origin Vercel / mobile deployments
  const corsMiddleware = cors({
    origin: (origin, callback) => {
      // Allow all origins (reflection) or requests without origin (curl, mobile apps, Postman)
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'Pragma',
      'X-Auth-Token',
      'sec-ch-ua',
      'sec-ch-ua-mobile',
      'sec-ch-ua-platform',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'sec-fetch-site',
      'Accept-Language',
      'X-Client-Platform'
    ],
    exposedHeaders: ['Set-Cookie', 'Authorization']
  });

  app.use(corsMiddleware);
  app.options('*', corsMiddleware);

  // Helper to reliably detect HTTPS across Cloud Run, Vercel, reverse proxies, and direct connections
  const getIsHttps = (req: express.Request): boolean => {
    if (req.secure) return true;
    const protoHeader = req.headers['x-forwarded-proto'];
    if (typeof protoHeader === 'string' && protoHeader.toLowerCase().includes('https')) {
      return true;
    }
    if (Array.isArray(protoHeader) && protoHeader.some(p => p.toLowerCase().includes('https'))) {
      return true;
    }
    if (process.env.NODE_ENV === 'production' || !!process.env.VERCEL) {
      return true;
    }
    return false;
  };

  // Helper for cookie options compatible with Android Chrome and HTTPS
  const getCookieOptions = (req: express.Request): express.CookieOptions => {
    const isHttps = getIsHttps(req);
    // Detect if the request originates from a cross-origin context / iframe
    const fetchDest = req.headers['sec-fetch-dest'];
    const fetchSite = req.headers['sec-fetch-site'];
    const isCrossSite = fetchSite === 'cross-site' || fetchDest === 'iframe';

    const options: express.CookieOptions = {
      httpOnly: true,
      secure: isHttps,
      // For first-party production top-level browser navigation (e.g. Android Chrome): SameSite=Lax is standard and never blocked
      // For cross-site / iframe embedded preview: SameSite=None + Secure + Partitioned
      sameSite: (isCrossSite ? 'none' : 'lax'),
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    };

    if (isCrossSite && isHttps) {
      (options as any).partitioned = true;
    }

    return options;
  };

  const getClearCookieOptions = (req: express.Request): express.CookieOptions => {
    const isHttps = getIsHttps(req);
    const fetchDest = req.headers['sec-fetch-dest'];
    const fetchSite = req.headers['sec-fetch-site'];
    const isCrossSite = fetchSite === 'cross-site' || fetchDest === 'iframe';

    const options: express.CookieOptions = {
      httpOnly: true,
      secure: isHttps,
      sameSite: (isCrossSite ? 'none' : 'lax'),
      path: '/'
    };

    if (isCrossSite && isHttps) {
      (options as any).partitioned = true;
    }

    return options;
  };

  // Auth Middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      let token: string | undefined;

      // 1. Check Authorization header (Bearer token)
      const authHeader = req.headers.authorization;
      if (authHeader && typeof authHeader === 'string') {
        const candidate = authHeader.replace(/^[Bb]earer\s+/i, '').trim();
        if (candidate && candidate !== 'undefined' && candidate !== 'null') {
          token = candidate;
        }
      }

      // 2. Check X-Auth-Token header
      if (!token && typeof req.headers['x-auth-token'] === 'string') {
        const candidate = req.headers['x-auth-token'].trim();
        if (candidate && candidate !== 'undefined' && candidate !== 'null') {
          token = candidate;
        }
      }

      // 3. Fall back to cookie
      const cookieToken = req.cookies?.auth_token;
      let user = null;

      if (token) {
        user = db.validateSession(token);
      }

      // If header token didn't validate or was missing, try the cookie token
      if (!user && cookieToken && typeof cookieToken === 'string') {
        const cleanCookieToken = cookieToken.trim();
        if (cleanCookieToken && cleanCookieToken !== 'undefined' && cleanCookieToken !== 'null') {
          const cookieUser = db.validateSession(cleanCookieToken);
          if (cookieUser) {
            user = cookieUser;
            token = cleanCookieToken;
          }
        }
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Please log in to continue.',
          code: 'AUTH_REQUIRED'
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Your session has expired. Please log in again to continue.',
          code: 'SESSION_EXPIRED'
        });
      }

      (req as any).user = user;
      (req as any).token = token;
      next();
    } catch (authErr: any) {
      console.error('requireAuth unexpected exception:', authErr);
      return res.status(500).json({
        success: false,
        error: 'Authentication subsystem error. Please try again.',
        code: 'AUTH_SUBSYSTEM_ERROR',
        details: authErr?.message
      });
    }
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Define API Router
  const apiRouter = express.Router();

  // 1. Health Check (Safe Diagnostics for backend, database, environment, session subsystem)
  apiRouter.get('/health', (req, res) => {
    const isHttps = getIsHttps(req);
    const authHeader = req.headers.authorization;
    const hasBearer = !!authHeader && typeof authHeader === 'string' && authHeader.trim().length > 7;
    const hasAuthCookie = !!req.cookies?.auth_token;

    res.json({
      status: 'operational',
      service: "Yuki Emergency & Women's Safety Platform",
      version: '1.0.0-prod',
      timestamp: new Date().toISOString(),
      backend: {
        running: true,
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version
      },
      database: {
        connected: true,
        writable: db.isWritable(),
        storageType: db.getDataDir().startsWith('/tmp') ? 'ephemeral-tmp' : 'persistent-disk',
        usersCount: db.getUsersCount(),
        activeSessionsCount: db.getSessionsCount(),
        contactsCount: db.getContactsCount()
      },
      environment: {
        platform: process.env.VERCEL ? 'vercel-serverless' : 'node-express',
        isProduction: process.env.NODE_ENV === 'production' || !!process.env.VERCEL,
        isHttps
      },
      sessionSubsystem: {
        ready: true,
        storageReady: true,
        activeSessions: db.getSessionsCount()
      },
      clientDiagnostics: {
        ip: req.ip || req.socket.remoteAddress || 'unknown',
        protocol: req.protocol,
        isHttps,
        hasAuthCookie,
        hasAuthHeader: hasBearer,
        userAgentPlatform: req.headers['sec-ch-ua-platform'] || (req.headers['user-agent']?.includes('Android') ? 'Android' : 'Desktop/Other')
      }
    });
  });

  // 2. Authentication Routes
  apiRouter.post('/auth/register', (req, res) => {
    try {
      const { name, email, phone, password, safetyPin, duressPin } = req.body;
      if (!name || !email || !password || !phone) {
        return res.status(400).json({
          success: false,
          error: 'Name, email, phone number, and password are required.',
          code: 'MISSING_FIELDS'
        });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address (e.g. name@domain.com).',
          code: 'INVALID_EMAIL_FORMAT'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long for security.',
          code: 'WEAK_PASSWORD'
        });
      }

      if (db.findUserByEmail(normalizedEmail)) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please sign in or use "Forgot Password".',
          code: 'ACCOUNT_EXISTS'
        });
      }

      const user = db.createUser({
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        password,
        safetyPin: safetyPin || '1234',
        duressPin: duressPin || '9999'
      });

      const token = db.createSession(user.id);
      res.cookie('auth_token', token, getCookieOptions(req));

      db.logAudit(user.id, 'USER_REGISTERED', `Account created for ${user.email}`, req.ip || '127.0.0.1');

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          hasSafetyPin: !!user.safetyPinHash,
          hasDuressPin: !!user.duressPinHash,
          medicalNotes: user.medicalNotes,
          createdAt: user.createdAt
        },
        token
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(503).json({
        success: false,
        error: 'Registration service temporarily unavailable. Please try again.',
        code: 'SERVICE_UNAVAILABLE',
        details: err.message
      });
    }
  });

  apiRouter.post('/auth/login', (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email address and password are required.',
          code: 'MISSING_CREDENTIALS'
        });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      const user = db.findUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Account not found with this email address. Please check spelling or register for a new account.',
          code: 'USER_NOT_FOUND'
        });
      }

      if (db.isAccountLocked(user)) {
        const remainingMs = user.lockedUntil ? new Date(user.lockedUntil).getTime() - Date.now() : 0;
        const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
        db.logAudit(user.id, 'ACCOUNT_LOCKED_ATTEMPT', `Failed login attempt while locked for ${user.email}`, req.ip || '127.0.0.1');
        return res.status(423).json({
          success: false,
          error: `Account is temporarily locked for safety due to multiple failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'} or reset your password.`,
          code: 'ACCOUNT_LOCKED',
          lockoutMinutes: remainingMinutes
        });
      }

      const isValidPassword = db.verifyPassword(password, user.passwordHash, user.salt);
      if (!isValidPassword) {
        const attemptInfo = db.registerFailedLogin(user);
        db.logAudit(user.id, 'LOGIN_FAILED', `Invalid password attempt for ${user.email}`, req.ip || '127.0.0.1');

        if (attemptInfo.locked) {
          return res.status(423).json({
            success: false,
            error: 'Maximum login attempts exceeded. Account is locked for 5 minutes to protect your safety.',
            code: 'ACCOUNT_LOCKED',
            lockoutMinutes: 5
          });
        }

        return res.status(401).json({
          success: false,
          error: `Invalid email or password. Please verify your password (${attemptInfo.remainingAttempts} attempt${attemptInfo.remainingAttempts === 1 ? '' : 's'} remaining) or click "Forgot Password" to reset it.`,
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Successful login
      db.registerSuccessfulLogin(user);
      const token = db.createSession(user.id);
      res.cookie('auth_token', token, getCookieOptions(req));

      db.logAudit(user.id, 'USER_LOGIN', `Successful login for ${user.email}`, req.ip || '127.0.0.1');

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          hasSafetyPin: !!user.safetyPinHash,
          hasDuressPin: !!user.duressPinHash,
          medicalNotes: user.medicalNotes,
          createdAt: user.createdAt
        },
        token
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(503).json({
        success: false,
        error: 'Authentication service or database is temporarily unavailable. Please try again in a moment.',
        code: 'SERVICE_UNAVAILABLE',
        details: err.message
      });
    }
  });

  apiRouter.post('/auth/forgot-password', (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email address is required.', code: 'EMAIL_REQUIRED' });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      const user = db.findUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'No account registered with this email address. Please check your email or create an account.',
          code: 'USER_NOT_FOUND'
        });
      }

      const resetResult = db.requestPasswordReset(normalizedEmail);
      if (!resetResult.success) {
        return res.status(400).json({
          success: false,
          error: resetResult.error || 'Failed to initiate password reset. Please try again.',
          code: 'RESET_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Password reset code has been dispatched.',
        resetCode: resetResult.resetCode,
        expiresInMinutes: 15
      });
    } catch (err: any) {
      console.error('Forgot password error:', err);
      res.status(503).json({
        success: false,
        error: 'Password reset service is temporarily unavailable. Please try again.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  });

  apiRouter.post('/auth/reset-password', (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Email, verification code, and new password are required.',
          code: 'MISSING_FIELDS'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long.',
          code: 'WEAK_PASSWORD'
        });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      const user = db.findUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Account not found.',
          code: 'USER_NOT_FOUND'
        });
      }

      const resetResult = db.resetPasswordWithCode(normalizedEmail, code.trim(), newPassword);
      if (!resetResult.success) {
        db.logAudit(user.id, 'PASSWORD_RESET_FAILED', `Invalid/expired reset code attempt for ${user.email}`, req.ip || '127.0.0.1');
        return res.status(400).json({
          success: false,
          error: resetResult.error || 'Invalid or expired verification code. Please request a fresh reset code.',
          code: 'RESET_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Password has been reset successfully. You may now log in with your new password.'
      });
    } catch (err: any) {
      console.error('Reset password error:', err);
      res.status(503).json({
        success: false,
        error: 'Password reset service is temporarily unavailable. Please try again.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  });

  apiRouter.post('/auth/verify-account', (req, res) => {
    try {
      const { email } = req.body;
      const user = db.findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });
      }
      user.isVerified = true;
      res.json({ success: true, message: 'Account verified successfully.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Verification failed: ' + err.message });
    }
  });

  apiRouter.get('/auth/me', requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        hasSafetyPin: !!user.safetyPinHash,
        hasDuressPin: !!user.duressPinHash,
        medicalNotes: user.medicalNotes,
        createdAt: user.createdAt
      }
    });
  });

  apiRouter.post('/auth/logout', (req, res) => {
    let token: string | undefined = req.cookies?.auth_token;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      token = authHeader.replace(/^[Bb]earer\s+/i, '').trim();
    }
    if (token) {
      db.deleteSession(token);
    }
    res.clearCookie('auth_token', getClearCookieOptions(req));
    res.json({ success: true, message: 'Logged out successfully' });
  });

  apiRouter.post('/auth/pins', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { safetyPin, duressPin, medicalNotes } = req.body;

      if (safetyPin && (safetyPin.length < 4 || !/^\d+$/.test(safetyPin))) {
        return res.status(400).json({ success: false, error: 'Safety PIN must be at least 4 numeric digits.' });
      }
      if (duressPin && (duressPin.length < 4 || !/^\d+$/.test(duressPin))) {
        return res.status(400).json({ success: false, error: 'Duress PIN must be at least 4 numeric digits.' });
      }
      if (safetyPin && duressPin && safetyPin === duressPin) {
        return res.status(400).json({ success: false, error: 'Duress PIN must be different from Safety PIN.' });
      }

      const updated = db.updateUserPins(user.id, safetyPin, duressPin, medicalNotes);
      db.logAudit(user.id, 'SECURITY_PINS_UPDATED', 'Safety/Duress PINs or medical notes updated', req.ip || '127.0.0.1');

      res.json({
        success: true,
        message: 'Security credentials updated safely.',
        medicalNotes: updated?.medicalNotes
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to update PINs' });
    }
  });

  // 3. Trusted Contacts Routes
  apiRouter.get('/contacts', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contacts = db.getContactsForUser(user.id);
      res.json({ success: true, contacts });
    } catch (err: any) {
      console.error('Fetch contacts error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve contacts due to a server error.',
        code: 'SERVER_ERROR',
        details: err?.message
      });
    }
  });

  apiRouter.post('/contacts', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { name, relationship, phone, email, canReceiveSMS, canReceiveWhatsApp, canReceiveEmail, isPrimary } = req.body || {};

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Contact name is required. Please provide a valid name.',
          code: 'INVALID_NAME'
        });
      }

      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Mobile phone number is required.',
          code: 'INVALID_PHONE'
        });
      }

      const cleanPhone = phone.trim();
      const digitsOnly = cleanPhone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid mobile number with country code (e.g. +91 98765 43210 or 10-digit number).',
          code: 'INVALID_PHONE_FORMAT'
        });
      }

      const existingContacts = db.getContactsForUser(user.id);
      const isDuplicate = existingContacts.some(c => c.phone.replace(/\D/g, '') === digitsOnly);
      if (isDuplicate) {
        return res.status(409).json({
          success: false,
          error: 'A contact with this mobile number already exists in your safety circle.',
          code: 'DUPLICATE_CONTACT'
        });
      }

      if (email && email.trim() && !isValidEmail(email.trim().toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address or leave the email field blank.',
          code: 'INVALID_EMAIL_FORMAT'
        });
      }

      const contact = db.addContact(user.id, {
        name: name.trim(),
        relationship: (relationship || 'Family').trim(),
        phone: cleanPhone,
        email: (email || '').trim().toLowerCase(),
        canReceiveSMS: canReceiveSMS !== false,
        canReceiveWhatsApp: canReceiveWhatsApp !== false,
        canReceiveEmail: canReceiveEmail === true,
        isPrimary: isPrimary === true || existingContacts.length === 0
      });

      db.logAudit(user.id, 'TRUSTED_CONTACT_ADDED', `Added trusted contact: ${contact.name}`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.status(201).json({
        success: true,
        contact,
        contacts: updatedContacts,
        message: 'Trusted contact saved successfully.'
      });
    } catch (err: any) {
      console.error('Add contact error:', err);
      res.status(500).json({
        success: false,
        error: 'A server or database error occurred while saving your contact. Please try again.',
        code: 'SERVER_ERROR',
        details: err?.message
      });
    }
  });

  apiRouter.put('/contacts/:id', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contactId = req.params.id;
      const { name, relationship, phone, email, canReceiveSMS, canReceiveWhatsApp, canReceiveEmail, isPrimary } = req.body;

      const existingContacts = db.getContactsForUser(user.id);
      const targetContact = existingContacts.find(c => c.id === contactId);
      if (!targetContact) {
        return res.status(404).json({
          success: false,
          error: 'Contact not found or does not belong to your account.',
          code: 'CONTACT_NOT_FOUND'
        });
      }

      if (name !== undefined && (!name || typeof name !== 'string' || !name.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Contact name cannot be empty.',
          code: 'INVALID_NAME'
        });
      }

      if (phone !== undefined) {
        const digitsOnly = phone.replace(/\D/g, '');
        if (digitsOnly.length < 7 || digitsOnly.length > 15) {
          return res.status(400).json({
            success: false,
            error: 'Please enter a valid mobile number with country code.',
            code: 'INVALID_PHONE_FORMAT'
          });
        }
        const isDuplicate = existingContacts.some(c => c.id !== contactId && c.phone.replace(/\D/g, '') === digitsOnly);
        if (isDuplicate) {
          return res.status(409).json({
            success: false,
            error: 'Another contact in your circle already has this mobile number.',
            code: 'DUPLICATE_CONTACT'
          });
        }
      }

      if (email !== undefined && email.trim() && !isValidEmail(email.trim().toLowerCase())) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid email address.',
          code: 'INVALID_EMAIL_FORMAT'
        });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (relationship !== undefined) updates.relationship = relationship.trim();
      if (phone !== undefined) updates.phone = phone.trim();
      if (email !== undefined) updates.email = email.trim().toLowerCase();
      if (canReceiveSMS !== undefined) updates.canReceiveSMS = !!canReceiveSMS;
      if (canReceiveWhatsApp !== undefined) updates.canReceiveWhatsApp = !!canReceiveWhatsApp;
      if (canReceiveEmail !== undefined) updates.canReceiveEmail = !!canReceiveEmail;
      if (isPrimary !== undefined) updates.isPrimary = !!isPrimary;

      const updated = db.updateContact(user.id, contactId, updates);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Contact not found.', code: 'CONTACT_NOT_FOUND' });
      }

      db.logAudit(user.id, 'TRUSTED_CONTACT_UPDATED', `Updated trusted contact: ${updated.name}`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.json({
        success: true,
        contact: updated,
        contacts: updatedContacts,
        message: 'Trusted contact updated successfully.'
      });
    } catch (err: any) {
      console.error('Update contact error:', err);
      res.status(500).json({
        success: false,
        error: 'A server error occurred while updating the contact.',
        code: 'SERVER_ERROR'
      });
    }
  });

  apiRouter.post('/contacts/:id/primary', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contactId = req.params.id;
      const existingContacts = db.getContactsForUser(user.id);
      const targetContact = existingContacts.find(c => c.id === contactId);
      if (!targetContact) {
        return res.status(404).json({
          success: false,
          error: 'Contact not found or does not belong to your account.',
          code: 'CONTACT_NOT_FOUND'
        });
      }

      db.updateContact(user.id, contactId, { isPrimary: true });
      db.logAudit(user.id, 'PRIMARY_CONTACT_CHANGED', `Designated ${targetContact.name} as primary contact`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.json({
        success: true,
        contacts: updatedContacts,
        message: `${targetContact.name} designated as primary emergency contact.`
      });
    } catch (err: any) {
      console.error('Set primary contact error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to set primary contact due to a server error.',
        code: 'SERVER_ERROR'
      });
    }
  });

  apiRouter.delete('/contacts/:id', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contactId = req.params.id;
      const existingContacts = db.getContactsForUser(user.id);
      const targetContact = existingContacts.find(c => c.id === contactId);
      if (!targetContact) {
        return res.status(404).json({
          success: false,
          error: 'Contact not found or does not belong to your account.',
          code: 'CONTACT_NOT_FOUND'
        });
      }

      const deleted = db.deleteContact(user.id, contactId);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Contact not found.', code: 'CONTACT_NOT_FOUND' });
      }

      db.logAudit(user.id, 'TRUSTED_CONTACT_REMOVED', `Removed contact: ${targetContact.name}`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.json({
        success: true,
        contacts: updatedContacts,
        message: 'Contact removed successfully.'
      });
    } catch (err: any) {
      console.error('Delete contact error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to remove contact due to a server error.',
        code: 'SERVER_ERROR'
      });
    }
  });

  // 4. Emergency SOS Routes
  apiRouter.post(['/emergency/start', '/emergency/sos'], requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { triggerType, latitude, longitude, accuracy, address, batteryLevel } = req.body;

      const session = db.startEmergency(user.id, {
        triggerType: triggerType || 'ONE_TAP_SOS',
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        accuracy: accuracy ? Number(accuracy) : undefined,
        address,
        batteryLevel: batteryLevel ? Number(batteryLevel) : undefined
      });

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const trackingUrl = `${protocol}://${host}/track/${session.trackingToken}`;

      // Build alert dispatch payloads for SMS and WhatsApp
      const contacts = db.getContactsForUser(user.id).filter(c => c.isVerified);
      const emergencyMessage = `🚨 EMERGENCY ALERT: ${user.name} has triggered an urgent SOS alert on Yuki! Location: ${address || (latitude ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Detecting GPS...')}. Follow live real-time tracking here: ${trackingUrl} . If you cannot reach them, immediately dial 112 (Police) or 1091 (Women Helpline).`;

      const dispatchInfo = contacts.map(c => ({
        contactId: c.id,
        name: c.name,
        phone: c.phone,
        smsLink: `sms:${c.phone}?body=${encodeURIComponent(emergencyMessage)}`,
        whatsappLink: `https://api.whatsapp.com/send?phone=${c.phone.replace(/[^0-9]/g, '')}&text=${encodeURIComponent(emergencyMessage)}`
      }));

      res.status(201).json({
        success: true,
        session,
        trackingUrl,
        emergencyMessage,
        dispatches: dispatchInfo,
        breadcrumbs: db.getEmergencyBreadcrumbs(session.id)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to activate emergency SOS' });
    }
  });

  apiRouter.get(['/emergency/active', '/emergency/status'], requireAuth, (req, res) => {
    const user = (req as any).user;
    const session = db.getActiveEmergency(user.id);
    if (!session) {
      return res.json({ success: true, session: null });
    }
    const breadcrumbs = db.getEmergencyBreadcrumbs(session.id);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const trackingUrl = `${protocol}://${host}/track/${session.trackingToken}`;

    res.json({
      success: true,
      session,
      trackingUrl,
      breadcrumbs
    });
  });

  apiRouter.post(['/emergency/update-location', '/emergency/location'], requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      let { sessionId, latitude, longitude, accuracy, speed, heading, batteryLevel, address } = req.body;

      if (!sessionId) {
        const active = db.getActiveEmergency(user.id);
        if (active) {
          sessionId = active.id;
        }
      }

      if (!sessionId || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, error: 'Session ID and coordinates are required.' });
      }

      const ok = db.updateEmergencyLocation(sessionId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: Number(accuracy || 10),
        speed: speed !== undefined ? Number(speed) : null,
        heading: heading !== undefined ? Number(heading) : null,
        batteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : null,
        address
      });

      if (!ok) {
        return res.status(404).json({ success: false, error: 'Active emergency session not found or closed.' });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to record location breadcrumb' });
    }
  });

  apiRouter.post(['/emergency/resolve', '/emergency/cancel'], requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      let { sessionId, pin, note } = req.body;

      if (!sessionId) {
        const active = db.getActiveEmergency(user.id);
        if (active) {
          sessionId = active.id;
        }
      }

      if (!sessionId || !pin) {
        return res.status(400).json({ success: false, error: 'Session ID and Safety PIN are required to cancel emergency status.' });
      }

      const isSafe = db.verifySafetyPin(user.id, pin);
      const isDuress = db.verifyDuressPin(user.id, pin);

      if (!isSafe && !isDuress) {
        db.logAudit(user.id, 'EMERGENCY_DEACTIVATION_FAILED', `Invalid PIN entered while attempting to cancel SOS session ${sessionId}`);
        return res.status(403).json({ success: false, error: 'Invalid PIN. Emergency remains active.' });
      }

      if (isDuress) {
        db.resolveEmergency(user.id, sessionId, 'DURESS', note || 'Duress cancellation code entered');
        db.logAudit(user.id, 'DURESS_PIN_TRIGGERED', `Duress code used on session ${sessionId}. Covert alert retained.`);
        return res.json({
          success: true,
          status: 'RESOLVED',
          covertDuress: true,
          message: 'Emergency state concluded.'
        });
      }

      db.resolveEmergency(user.id, sessionId, 'RESOLVED', note || 'Disarmed safely with verified PIN');
      res.json({
        success: true,
        status: 'RESOLVED',
        message: 'Emergency SOS marked resolved. Your contacts will be informed that you are safe.'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to resolve emergency' });
    }
  });

  // 5. Public Live Tracking Endpoint
  apiRouter.get('/track/:token', (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 16) {
      return res.status(400).json({ success: false, error: 'Invalid tracking token format.' });
    }

    const data = db.getEmergencyByToken(token);
    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Tracking session not found or link has expired.',
        status: 'EXPIRED'
      });
    }

    res.json({
      success: true,
      session: {
        id: data.session.id,
        status: data.session.status,
        triggerType: data.session.triggerType,
        startedAt: data.session.startedAt,
        resolvedAt: data.session.resolvedAt,
        lastLatitude: data.session.lastLatitude,
        lastLongitude: data.session.lastLongitude,
        lastAccuracy: data.session.lastAccuracy,
        lastAddress: data.session.lastAddress,
        batteryLevel: data.session.batteryLevel,
        alertSummary: data.session.alertSummary
      },
      user: data.user,
      breadcrumbs: data.breadcrumbs
    });
  });

  // 6. Walk-With-Me Safety Timer
  apiRouter.post(['/walk/start', '/walk-with-me/start'], requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { destination, durationMinutes, notes } = req.body;

      if (!destination || !durationMinutes || durationMinutes < 1) {
        return res.status(400).json({ success: false, error: 'Destination and valid duration in minutes are required.' });
      }

      const timer = db.createWalkTimer(user.id, destination.trim(), Number(durationMinutes), notes);
      db.logAudit(user.id, 'WALK_TIMER_STARTED', `Walk-With-Me timer set for ${destination} (${durationMinutes} mins)`);
      res.status(201).json({ success: true, timer });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to start walk timer' });
    }
  });

  apiRouter.get(['/walk/active', '/walk-with-me/status', '/walk-with-me/active'], requireAuth, (req, res) => {
    const user = (req as any).user;
    const timer = db.getActiveWalkTimer(user.id);
    res.json({ success: true, timer: timer || null });
  });

  apiRouter.post(['/walk/checkin', '/walk/check-in', '/walk-with-me/check-in'], requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { timerId } = req.body;
      const ok = db.checkInWalkTimer(user.id, timerId);
      if (!ok) {
        return res.status(404).json({ success: false, error: 'Active walk timer not found' });
      }
      db.logAudit(user.id, 'WALK_TIMER_CHECKED_IN', `User checked in safely for walk timer`);
      res.json({ success: true, message: 'Checked in safely! Your trip timer has been cleared.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to check in' });
    }
  });

  apiRouter.post(['/walk/cancel', '/walk-with-me/cancel'], requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { timerId } = req.body;
      const ok = db.cancelWalkTimer(user.id, timerId);
      res.json({ success: true, message: ok ? 'Walk timer cancelled.' : 'No active timer found.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to cancel walk timer' });
    }
  });

  // 7. Incident Reports Vault
  apiRouter.get('/incidents', requireAuth, (req, res) => {
    const user = (req as any).user;
    const incidents = db.getIncidentReports(user.id);
    res.json({ success: true, incidents });
  });

  apiRouter.post('/incidents', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { category, title, incidentDate, location, description, witnesses, evidenceNotes, suspectDetails, isEncrypted } = req.body;

      if (!title || !description || !incidentDate) {
        return res.status(400).json({ success: false, error: 'Title, date, and description are required for incident documentation.' });
      }

      const report = db.createIncidentReport(user.id, {
        category: category || 'HARASSMENT',
        title: title.trim(),
        incidentDate,
        location: (location || 'Not specified').trim(),
        description: description.trim(),
        witnesses: witnesses?.trim(),
        evidenceNotes: evidenceNotes?.trim(),
        suspectDetails: suspectDetails?.trim(),
        isEncrypted: isEncrypted === true,
        status: 'SAVED'
      });

      res.status(201).json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to record incident report' });
    }
  });

  apiRouter.delete('/incidents/:id', requireAuth, (req, res) => {
    const user = (req as any).user;
    const deleted = db.deleteIncidentReport(user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Incident report not found' });
    }
    res.json({ success: true, message: 'Incident report deleted' });
  });

  // 8. Audit Logs
  apiRouter.get('/audit-logs', requireAuth, (req, res) => {
    const user = (req as any).user;
    const logs = db.getAuditLogs(user.id);
    res.json({ success: true, logs });
  });

  // 9. Gemini AI Safety Assistant
  apiRouter.post('/ai/safety-guidance', async (req, res) => {
    try {
      const { prompt, history } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ success: false, error: 'Prompt is required.' });
      }

      const guidance = await generateSafetyGuidance(prompt, history || []);
      res.json(guidance);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to process safety inquiry',
        details: err.message
      });
    }
  });

  // Mount router both at /api (standard path) and at root / (in case of Vercel rewrite variations)
  app.use('/api', apiRouter);
  app.use(apiRouter);

  // Catch-all 404 for any unhandled /api/* request so it NEVER returns HTML
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Yuki API endpoint not found: ${req.method} ${req.originalUrl || req.url}`,
      code: 'API_ENDPOINT_NOT_FOUND'
    });
  });

  // Global error handler for API exceptions
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled API Error:', err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_SERVER_ERROR'
    });
  });

  return app;
}
