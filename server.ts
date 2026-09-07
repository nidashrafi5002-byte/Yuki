import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { generateSafetyGuidance } from './server/gemini.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: true, credentials: true }));

  // Auth Middleware
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    let token = req.cookies?.auth_token;
    const authHeader = req.headers.authorization;
    if (!token && authHeader) {
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (authHeader.startsWith("bearer ")) {
        token = authHeader.substring(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    if (!token) {
      return res.status(401).json({
        error: "Please log in to continue.",
        code: "AUTH_REQUIRED"
      });
    }

    const user = db.validateSession(token);
    if (!user) {
      return res.status(401).json({
        error: "Your session has expired. Please log in again to continue.",
        code: "SESSION_EXPIRED"
      });
    }

    (req as any).user = user;
    (req as any).token = token;
    next();
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'operational',
      service: 'Yuki Emergency & Women\'s Safety Platform',
      version: '1.0.0-prod',
      timestamp: new Date().toISOString()
    });
  });

  // 2. Auth Routes
  app.post('/api/auth/register', (req, res) => {
    try {
      const { name, email, phone, password, safetyPin, duressPin } = req.body;
      if (!name || !email || !password || !phone) {
        return res.status(400).json({
          error: 'Name, email, phone number, and password are required.',
          code: 'MISSING_FIELDS'
        });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          error: 'Please enter a valid email address (e.g. name@domain.com).',
          code: 'INVALID_EMAIL_FORMAT'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long for security.',
          code: 'WEAK_PASSWORD'
        });
      }

      if (db.findUserByEmail(normalizedEmail)) {
        return res.status(409).json({
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
      res.cookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      db.logAudit(user.id, 'USER_REGISTERED', `Account created for ${user.email}`, req.ip || '127.0.0.1');

      res.status(201).json({
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
        error: 'Registration failed due to a database service error. Please try again shortly.',
        code: 'SERVICE_UNAVAILABLE',
        details: err.message
      });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          error: 'Please enter both your email address and password.',
          code: 'MISSING_FIELDS'
        });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          error: 'Please provide a valid email format (e.g. name@domain.com).',
          code: 'INVALID_EMAIL_FORMAT'
        });
      }

      const user = db.findUserByEmail(normalizedEmail);
      if (!user) {
        return res.status(404).json({
          error: 'No account found with this email address. Please check your spelling or create a new account.',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      // Check brute force lockout
      if (db.isAccountLocked(user)) {
        const lockTime = user.lockedUntil ? new Date(user.lockedUntil).toLocaleTimeString() : '5 minutes';
        return res.status(423).json({
          error: `This account is temporarily locked due to multiple failed login attempts until ${lockTime}. You can reset your password immediately using "Forgot Password".`,
          code: 'ACCOUNT_LOCKED'
        });
      }

      // Check account verification
      if (user.isVerified === false) {
        return res.status(403).json({
          error: 'Your account is not yet verified. Please verify your account before logging in.',
          code: 'ACCOUNT_NOT_VERIFIED'
        });
      }

      // Password verification
      const isPasswordValid = db.verifyPassword(password, user.passwordHash, user.salt);
      if (!isPasswordValid) {
        const attemptInfo = db.registerFailedLogin(user);
        db.logAudit(user.id, 'LOGIN_FAILED', `Failed password attempt for ${user.email}`, req.ip || '127.0.0.1');

        if (attemptInfo.locked) {
          return res.status(423).json({
            error: 'Too many incorrect attempts. Account is temporarily locked for 5 minutes for security. You can reset your password immediately.',
            code: 'ACCOUNT_LOCKED'
          });
        }

        return res.status(401).json({
          error: `Invalid email or password. Please verify your password (${attemptInfo.remainingAttempts} attempt${attemptInfo.remainingAttempts === 1 ? '' : 's'} remaining) or click "Forgot Password" to reset it.`,
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Successful login
      db.registerSuccessfulLogin(user);
      const token = db.createSession(user.id);
      res.cookie('auth_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      db.logAudit(user.id, 'USER_LOGIN', `Successful login for ${user.email}`, req.ip || '127.0.0.1');

      res.json({
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
        error: 'Authentication service or database is temporarily unavailable. Please try again in a moment.',
        code: 'SERVICE_UNAVAILABLE',
        details: err.message
      });
    }
  });

  // Password Reset / Forgot Password
  app.post('/api/auth/forgot-password', (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email address is required.', code: 'EMAIL_REQUIRED' });
      }

      const normalizedEmail = (email || '').trim().toLowerCase();
      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ error: 'Please enter a valid email address.', code: 'INVALID_EMAIL' });
      }

      const result = db.requestPasswordReset(normalizedEmail);
      if (!result.success) {
        return res.status(404).json({
          error: 'No account found with this email address. Please verify the email or create a new account.',
          code: 'ACCOUNT_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        message: `A secure 6-digit password reset code has been generated for ${normalizedEmail}.`,
        resetCode: result.resetCode,
        expiresAt: result.expiresAt
      });
    } catch (err: any) {
      console.error('Forgot password error:', err);
      res.status(503).json({
        error: 'Password reset service is temporarily unavailable. Please try again.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  });

  app.post('/api/auth/reset-password', (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({
          error: 'Email, verification code, and new password are required.',
          code: 'MISSING_FIELDS'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          error: 'New password must be at least 8 characters long.',
          code: 'WEAK_PASSWORD'
        });
      }

      const result = db.resetPasswordWithCode(email, code, newPassword);
      if (!result.success) {
        return res.status(400).json({
          error: result.error || 'Failed to reset password. Please check your verification code.',
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
        error: 'Password reset service is temporarily unavailable. Please try again.',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  });

  app.post('/api/auth/verify-account', (req, res) => {
    try {
      const { email } = req.body;
      const user = db.findUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: 'Account not found.', code: 'ACCOUNT_NOT_FOUND' });
      }
      user.isVerified = true;
      res.json({ success: true, message: 'Account verified successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: 'Verification failed: ' + err.message });
    }
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const user = (req as any).user;
    res.json({
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

  app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      db.deleteSession(token);
    }
    res.clearCookie('auth_token');
    res.json({ success: true, message: 'Logged out successfully' });
  });

  app.post('/api/auth/pins', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { safetyPin, duressPin, medicalNotes } = req.body;

      if (safetyPin && (safetyPin.length < 4 || !/^\d+$/.test(safetyPin))) {
        return res.status(400).json({ error: 'Safety PIN must be at least 4 numeric digits.' });
      }
      if (duressPin && (duressPin.length < 4 || !/^\d+$/.test(duressPin))) {
        return res.status(400).json({ error: 'Duress PIN must be at least 4 numeric digits.' });
      }
      if (safetyPin && duressPin && safetyPin === duressPin) {
        return res.status(400).json({ error: 'Duress PIN must be different from Safety PIN.' });
      }

      const updated = db.updateUserPins(user.id, safetyPin, duressPin, medicalNotes);
      db.logAudit(user.id, 'SECURITY_PINS_UPDATED', 'Safety/Duress PINs or medical notes updated', req.ip || '127.0.0.1');

      res.json({
        success: true,
        message: 'Security credentials updated safely.',
        medicalNotes: updated?.medicalNotes
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to update PINs' });
    }
  });

  // 3. Trusted Contacts Routes
  app.get("/api/contacts", requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contacts = db.getContactsForUser(user.id);
      res.json({ contacts });
    } catch (err: any) {
      console.error("Fetch contacts error:", err);
      res.status(500).json({
        error: "Failed to retrieve contacts due to a server error.",
        code: "SERVER_ERROR"
      });
    }
  });

  app.post("/api/contacts", requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { name, relationship, phone, email, canReceiveSMS, canReceiveWhatsApp, canReceiveEmail, isPrimary } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          error: "Contact name is required. Please provide a valid name.",
          code: "INVALID_NAME"
        });
      }

      if (!phone || typeof phone !== "string" || !phone.trim()) {
        return res.status(400).json({
          error: "Mobile phone number is required.",
          code: "INVALID_PHONE"
        });
      }

      const cleanPhone = phone.trim();
      const digitsOnly = cleanPhone.replace(/\D/g, "");
      if (digitsOnly.length < 7 || digitsOnly.length > 15) {
        return res.status(400).json({
          error: "Please enter a valid mobile number with country code (e.g. +91 98765 43210 or 10-digit number).",
          code: "INVALID_PHONE_FORMAT"
        });
      }

      const existingContacts = db.getContactsForUser(user.id);
      const isDuplicate = existingContacts.some(c => c.phone.replace(/\D/g, "") === digitsOnly);
      if (isDuplicate) {
        return res.status(409).json({
          error: "A contact with this mobile number already exists in your safety circle.",
          code: "DUPLICATE_CONTACT"
        });
      }

      if (email && email.trim() && !isValidEmail(email.trim().toLowerCase())) {
        return res.status(400).json({
          error: "Please enter a valid email address or leave the email field blank.",
          code: "INVALID_EMAIL_FORMAT"
        });
      }

      const contact = db.addContact(user.id, {
        name: name.trim(),
        relationship: (relationship || "Family").trim(),
        phone: cleanPhone,
        email: (email || "").trim().toLowerCase(),
        canReceiveSMS: canReceiveSMS !== false,
        canReceiveWhatsApp: canReceiveWhatsApp !== false,
        canReceiveEmail: canReceiveEmail === true,
        isPrimary: isPrimary === true || existingContacts.length === 0
      });

      db.logAudit(user.id, "TRUSTED_CONTACT_ADDED", `Added trusted contact: ${contact.name}`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.status(201).json({
        success: true,
        contact,
        contacts: updatedContacts,
        message: "Trusted contact saved successfully."
      });
    } catch (err: any) {
      console.error("Add contact error:", err);
      res.status(500).json({
        error: "A server or database error occurred while saving your contact. Please try again.",
        code: "SERVER_ERROR"
      });
    }
  });

  app.put("/api/contacts/:id", requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contactId = req.params.id;
      const { name, relationship, phone, email, canReceiveSMS, canReceiveWhatsApp, canReceiveEmail, isPrimary } = req.body;

      const existingContacts = db.getContactsForUser(user.id);
      const targetContact = existingContacts.find(c => c.id === contactId);
      if (!targetContact) {
        return res.status(404).json({
          error: "Contact not found or does not belong to your account.",
          code: "CONTACT_NOT_FOUND"
        });
      }

      if (name !== undefined && (!name || typeof name !== "string" || !name.trim())) {
        return res.status(400).json({
          error: "Contact name cannot be empty.",
          code: "INVALID_NAME"
        });
      }

      if (phone !== undefined) {
        const digitsOnly = phone.replace(/\D/g, "");
        if (digitsOnly.length < 7 || digitsOnly.length > 15) {
          return res.status(400).json({
            error: "Please enter a valid mobile number with country code.",
            code: "INVALID_PHONE_FORMAT"
          });
        }
        const isDuplicate = existingContacts.some(c => c.id !== contactId && c.phone.replace(/\D/g, "") === digitsOnly);
        if (isDuplicate) {
          return res.status(409).json({
            error: "Another contact in your circle already has this mobile number.",
            code: "DUPLICATE_CONTACT"
          });
        }
      }

      if (email !== undefined && email.trim() && !isValidEmail(email.trim().toLowerCase())) {
        return res.status(400).json({
          error: "Please enter a valid email address.",
          code: "INVALID_EMAIL_FORMAT"
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
        return res.status(404).json({ error: "Contact not found.", code: "CONTACT_NOT_FOUND" });
      }

      db.logAudit(user.id, "TRUSTED_CONTACT_UPDATED", `Updated trusted contact: ${updated.name}`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.json({
        success: true,
        contact: updated,
        contacts: updatedContacts,
        message: "Trusted contact updated successfully."
      });
    } catch (err: any) {
      console.error("Update contact error:", err);
      res.status(500).json({
        error: "A server error occurred while updating the contact.",
        code: "SERVER_ERROR"
      });
    }
  });

  app.post("/api/contacts/:id/primary", requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contactId = req.params.id;
      const existingContacts = db.getContactsForUser(user.id);
      const targetContact = existingContacts.find(c => c.id === contactId);
      if (!targetContact) {
        return res.status(404).json({
          error: "Contact not found or does not belong to your account.",
          code: "CONTACT_NOT_FOUND"
        });
      }

      db.updateContact(user.id, contactId, { isPrimary: true });
      db.logAudit(user.id, "PRIMARY_CONTACT_CHANGED", `Designated ${targetContact.name} as primary contact`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.json({
        success: true,
        contacts: updatedContacts,
        message: `${targetContact.name} designated as primary emergency contact.`
      });
    } catch (err: any) {
      console.error("Set primary contact error:", err);
      res.status(500).json({
        error: "Failed to set primary contact due to a server error.",
        code: "SERVER_ERROR"
      });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const contactId = req.params.id;
      const existingContacts = db.getContactsForUser(user.id);
      const targetContact = existingContacts.find(c => c.id === contactId);
      if (!targetContact) {
        return res.status(404).json({
          error: "Contact not found or does not belong to your account.",
          code: "CONTACT_NOT_FOUND"
        });
      }

      const deleted = db.deleteContact(user.id, contactId);
      if (!deleted) {
        return res.status(404).json({ error: "Contact not found.", code: "CONTACT_NOT_FOUND" });
      }

      db.logAudit(user.id, "TRUSTED_CONTACT_REMOVED", `Removed contact: ${targetContact.name}`);
      const updatedContacts = db.getContactsForUser(user.id);
      res.json({
        success: true,
        contacts: updatedContacts,
        message: "Contact removed successfully."
      });
    } catch (err: any) {
      console.error("Delete contact error:", err);
      res.status(500).json({
        error: "Failed to remove contact due to a server error.",
        code: "SERVER_ERROR"
      });
    }
  });

  // 4. Emergency SOS Routes
  app.post(['/api/emergency/start', '/api/emergency/sos'], requireAuth, (req, res) => {
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
      const protocol = req.protocol;
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
        session,
        trackingUrl,
        emergencyMessage,
        dispatches: dispatchInfo,
        breadcrumbs: db.getEmergencyBreadcrumbs(session.id)
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to activate emergency SOS' });
    }
  });

  app.get('/api/emergency/active', requireAuth, (req, res) => {
    const user = (req as any).user;
    const session = db.getActiveEmergency(user.id);
    if (!session) {
      return res.json({ session: null });
    }
    const breadcrumbs = db.getEmergencyBreadcrumbs(session.id);
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol;
    const trackingUrl = `${protocol}://${host}/track/${session.trackingToken}`;

    res.json({
      session,
      trackingUrl,
      breadcrumbs
    });
  });

  app.post(['/api/emergency/update-location', '/api/emergency/location'], requireAuth, (req, res) => {
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
        return res.status(400).json({ error: 'Session ID and coordinates are required.' });
      }

      const success = db.updateEmergencyLocation(sessionId, {
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: Number(accuracy || 10),
        speed: speed !== undefined ? Number(speed) : null,
        heading: heading !== undefined ? Number(heading) : null,
        batteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : null,
        address
      });

      if (!success) {
        return res.status(404).json({ error: 'Active emergency session not found or closed.' });
      }

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to record location breadcrumb' });
    }
  });

  app.post('/api/emergency/resolve', requireAuth, (req, res) => {
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
        return res.status(400).json({ error: 'Session ID and Safety PIN are required to cancel emergency status.' });
      }

      const isSafe = db.verifySafetyPin(user.id, pin);
      const isDuress = db.verifyDuressPin(user.id, pin);

      if (!isSafe && !isDuress) {
        db.logAudit(user.id, 'EMERGENCY_DEACTIVATION_FAILED', `Invalid PIN entered while attempting to cancel SOS session ${sessionId}`);
        return res.status(403).json({ error: 'Invalid PIN. Emergency remains active.' });
      }

      if (isDuress) {
        // Coercive duress disarm: mark as DURESS covertly
        db.resolveEmergency(user.id, sessionId, 'DURESS', note || 'Duress cancellation code entered');
        db.logAudit(user.id, 'DURESS_PIN_TRIGGERED', `Duress code used on session ${sessionId}. Covert alert retained.`);
        return res.json({
          success: true,
          status: 'RESOLVED', // Masked to attacker on screen as resolved
          covertDuress: true,
          message: 'Emergency state concluded.'
        });
      }

      // Genuine Safe Disarm
      db.resolveEmergency(user.id, sessionId, 'RESOLVED', note || 'Disarmed safely with verified PIN');
      res.json({
        success: true,
        status: 'RESOLVED',
        message: 'Emergency SOS marked resolved. Your contacts will be informed that you are safe.'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to resolve emergency' });
    }
  });

  // 5. Public Live Tracking Endpoint (for trusted contacts with token)
  app.get('/api/track/:token', (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 16) {
      return res.status(400).json({ error: 'Invalid tracking token format.' });
    }

    const data = db.getEmergencyByToken(token);
    if (!data) {
      return res.status(404).json({
        error: 'Tracking session not found or link has expired.',
        status: 'EXPIRED'
      });
    }

    res.json({
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
  app.post('/api/walk/start', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { destination, durationMinutes } = req.body;

      if (!destination || !durationMinutes || durationMinutes < 1) {
        return res.status(400).json({ error: 'Destination and valid duration in minutes are required.' });
      }

      const timer = db.createWalkTimer(user.id, destination.trim(), Number(durationMinutes));
      db.logAudit(user.id, 'WALK_TIMER_STARTED', `Walk-With-Me timer set for ${destination} (${durationMinutes} mins)`);
      res.status(201).json({ timer });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to start walk timer' });
    }
  });

  app.get('/api/walk/active', requireAuth, (req, res) => {
    const user = (req as any).user;
    const timer = db.getActiveWalkTimer(user.id);
    res.json({ timer: timer || null });
  });

  app.post('/api/walk/checkin', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { timerId } = req.body;
      const success = db.checkInWalkTimer(user.id, timerId);
      if (!success) {
        return res.status(404).json({ error: 'Active walk timer not found' });
      }
      db.logAudit(user.id, 'WALK_TIMER_CHECKED_IN', `User checked in safely for timer ${timerId}`);
      res.json({ success: true, message: 'Checked in safely! Your trip timer has been cleared.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to check in' });
    }
  });

  // 7. Incident Reports Vault
  app.get('/api/incidents', requireAuth, (req, res) => {
    const user = (req as any).user;
    const incidents = db.getIncidentReports(user.id);
    res.json({ incidents });
  });

  app.post('/api/incidents', requireAuth, (req, res) => {
    try {
      const user = (req as any).user;
      const { category, title, incidentDate, location, description, witnesses, evidenceNotes, suspectDetails, isEncrypted } = req.body;

      if (!title || !description || !incidentDate) {
        return res.status(400).json({ error: 'Title, date, and description are required for incident documentation.' });
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

      res.status(201).json({ report });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to record incident report' });
    }
  });

  app.delete('/api/incidents/:id', requireAuth, (req, res) => {
    const user = (req as any).user;
    const deleted = db.deleteIncidentReport(user.id, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Incident report not found' });
    }
    res.json({ success: true, message: 'Incident report deleted' });
  });

  // 8. Audit Logs
  app.get('/api/audit-logs', requireAuth, (req, res) => {
    const user = (req as any).user;
    const logs = db.getAuditLogs(user.id);
    res.json({ logs });
  });

  // 9. Gemini AI Safety Assistant
  app.post('/api/ai/safety-guidance', async (req, res) => {
    try {
      const { prompt, history } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const guidance = await generateSafetyGuidance(prompt, history || []);
      res.json(guidance);
    } catch (err: any) {
      res.status(500).json({
        error: 'Failed to process safety inquiry',
        details: err.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ Yuki server online at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
});
