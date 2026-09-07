import os
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from dotenv import load_dotenv
from models import db, bcrypt, User, TrustedContact, EmergencySession, Breadcrumb, IncidentReport

load_dotenv()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'nirbhaya_secure_shield_production_key_2026')
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///nirbhaya.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    CORS(app, supports_credentials=True)
    db.init_app(app)
    bcrypt.init_app(app)

    with app.app_context():
        db.create_all()

    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({
            'status': 'operational',
            'backend': 'Python Flask 3.0',
            'service': 'Nirbhaya Shield API'
        })

    # Auth Endpoints
    @app.route('/api/auth/register', methods=['POST'])
    def register():
        data = request.get_json() or {}
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        password = data.get('password')

        if not name or not email or not password or not phone:
            return jsonify({'error': 'Name, email, phone, and password are required.'}), 400

        if User.query.filter_by(email=email.lower()).first():
            return jsonify({'error': 'Email already registered.'}), 409

        user = User(name=name, email=email.lower(), phone=phone)
        user.set_password(password)
        if data.get('safetyPin'):
            user.set_safety_pin(data['safetyPin'])
        if data.get('duressPin'):
            user.set_duress_pin(data['duressPin'])

        db.session.add(user)
        db.session.commit()
        session['user_id'] = user.id

        return jsonify({'user': user.to_dict()}), 201

    @app.route('/api/auth/login', methods=['POST'])
    def login():
        data = request.get_json() or {}
        email = data.get('email')
        password = data.get('password')

        user = User.query.filter_by(email=(email or '').lower()).first()
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid email or password.'}), 401

        session['user_id'] = user.id
        return jsonify({'user': user.to_dict()})

    @app.route('/api/auth/me', methods=['GET'])
    def get_me():
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'user': user.to_dict()})

    # Gemini AI Safety Guidance
    @app.route('/api/ai/safety-guidance', methods=['POST'])
    def ai_safety():
        data = request.get_json() or {}
        prompt = data.get('prompt', '')
        api_key = os.environ.get('GEMINI_API_KEY')

        if not api_key:
            return jsonify({
                'text': '🚨 Immediate Police Assistance: 112 | Women Helpline: 1091.\n\nSeek immediate public shelter or trigger your SOS alarm if you feel in danger.',
                'isEmergencyAlert': True,
                'suggestedActions': ['Call 112', 'Trigger SOS', 'Seek Crowded Area']
            })

        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model='gemini-3.8-flash',
                contents=prompt,
                config={
                    'system_instruction': 'You are the Nirbhaya Shield AI Safety Advisor. Provide responsible, trauma-informed guidance. Prioritize human emergency services (112, 1091) whenever immediate danger is detected.'
                }
            )
            return jsonify({
                'text': response.text,
                'isEmergencyAlert': 'danger' in prompt.lower() or 'follow' in prompt.lower(),
                'suggestedActions': ['View Emergency Helplines', 'Record in Incident Vault']
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)
