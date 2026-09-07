import uuid
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
bcrypt = Bcrypt()

def generate_uuid():
    return str(uuid.uuid4())

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.String(64), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(30), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    safety_pin_hash = db.Column(db.String(256), nullable=True)
    duress_pin_hash = db.Column(db.String(256), nullable=True)
    medical_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    contacts = db.relationship('TrustedContact', backref='user', lazy=True, cascade="all, delete-orphan")
    emergency_sessions = db.relationship('EmergencySession', backref='user', lazy=True, cascade="all, delete-orphan")
    incidents = db.relationship('IncidentReport', backref='user', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password: str):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password: str) -> bool:
        return bcrypt.check_password_hash(self.password_hash, password)

    def set_safety_pin(self, pin: str):
        self.safety_pin_hash = bcrypt.generate_password_hash(pin).decode('utf-8')

    def check_safety_pin(self, pin: str) -> bool:
        if not self.safety_pin_hash:
            return pin == '1234'
        return bcrypt.check_password_hash(self.safety_pin_hash, pin)

    def set_duress_pin(self, pin: str):
        self.duress_pin_hash = bcrypt.generate_password_hash(pin).decode('utf-8')

    def check_duress_pin(self, pin: str) -> bool:
        if not self.duress_pin_hash:
            return pin == '9999'
        return bcrypt.check_password_hash(self.duress_pin_hash, pin)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'hasSafetyPin': bool(self.safety_pin_hash),
            'hasDuressPin': bool(self.duress_pin_hash),
            'medicalNotes': self.medical_notes,
            'createdAt': self.created_at.isoformat()
        }

class TrustedContact(db.Model):
    __tablename__ = 'trusted_contacts'

    id = db.Column(db.String(64), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    relationship = db.Column(db.String(80), default='Friend')
    phone = db.Column(db.String(30), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    is_verified = db.Column(db.Boolean, default=True)
    can_receive_sms = db.Column(db.Boolean, default=True)
    can_receive_whatsapp = db.Column(db.Boolean, default=True)
    can_receive_email = db.Column(db.Boolean, default=False)
    is_primary = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'name': self.name,
            'relationship': self.relationship,
            'phone': self.phone,
            'email': self.email,
            'isVerified': self.is_verified,
            'canReceiveSMS': self.can_receive_sms,
            'canReceiveWhatsApp': self.can_receive_whatsapp,
            'canReceiveEmail': self.can_receive_email,
            'isPrimary': self.is_primary,
            'createdAt': self.created_at.isoformat()
        }

class EmergencySession(db.Model):
    __tablename__ = 'emergency_sessions'

    id = db.Column(db.String(64), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False, index=True)
    tracking_token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    status = db.Column(db.String(20), default='ACTIVE') # ACTIVE, RESOLVED, CANCELLED, DURESS
    trigger_type = db.Column(db.String(40), default='ONE_TAP_SOS')
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolution_note = db.Column(db.Text, nullable=True)
    last_latitude = db.Column(db.Float, nullable=True)
    last_longitude = db.Column(db.Float, nullable=True)
    last_accuracy = db.Column(db.Float, nullable=True)
    last_address = db.Column(db.String(256), nullable=True)
    battery_level = db.Column(db.Float, nullable=True)
    alert_summary = db.Column(db.Text, nullable=False)
    notified_contacts_count = db.Column(db.Integer, default=0)

    breadcrumbs = db.relationship('Breadcrumb', backref='session', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'trackingToken': self.tracking_token,
            'status': self.status,
            'triggerType': self.trigger_type,
            'startedAt': self.started_at.isoformat(),
            'resolvedAt': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolutionNote': self.resolution_note,
            'lastLatitude': self.last_latitude,
            'lastLongitude': self.last_longitude,
            'lastAccuracy': self.last_accuracy,
            'lastAddress': self.last_address,
            'batteryLevel': self.battery_level,
            'alertSummary': self.alert_summary,
            'notifiedContactsCount': self.notified_contacts_count
        }

class Breadcrumb(db.Model):
    __tablename__ = 'breadcrumbs'

    id = db.Column(db.String(64), primary_key=True, default=generate_uuid)
    session_id = db.Column(db.String(64), db.ForeignKey('emergency_sessions.id'), nullable=False, index=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    accuracy = db.Column(db.Float, default=10.0)
    speed = db.Column(db.Float, nullable=True)
    heading = db.Column(db.Float, nullable=True)
    battery_level = db.Column(db.Float, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'sessionId': self.session_id,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'accuracy': self.accuracy,
            'speed': self.speed,
            'heading': self.heading,
            'batteryLevel': self.battery_level,
            'timestamp': self.timestamp.isoformat()
        }

class IncidentReport(db.Model):
    __tablename__ = 'incident_reports'

    id = db.Column(db.String(64), primary_key=True, default=generate_uuid)
    user_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False, index=True)
    category = db.Column(db.String(50), default='HARASSMENT')
    title = db.Column(db.String(256), nullable=False)
    incident_date = db.Column(db.String(30), nullable=False)
    location = db.Column(db.String(256), default='Not specified')
    description = db.Column(db.Text, nullable=False)
    witnesses = db.Column(db.Text, nullable=True)
    evidence_notes = db.Column(db.Text, nullable=True)
    suspect_details = db.Column(db.Text, nullable=True)
    is_encrypted = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(30), default='SAVED')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'category': self.category,
            'title': self.title,
            'incidentDate': self.incident_date,
            'location': self.location,
            'description': self.description,
            'witnesses': self.witnesses,
            'evidenceNotes': self.evidence_notes,
            'suspectDetails': self.suspect_details,
            'isEncrypted': self.is_encrypted,
            'status': self.status,
            'createdAt': self.created_at.isoformat()
        }
