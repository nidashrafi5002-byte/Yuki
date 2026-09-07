# Nirbhaya Shield - Python Flask Backend

This directory contains the production-grade Python with Flask backend implementation for **Nirbhaya Shield**.

### Features:
- **Flask 3.0+ & SQLAlchemy**: Relational persistence for users, trusted contacts, emergency sessions, breadcrumbs, and incident logs.
- **Flask-Bcrypt**: Cryptographic password and PIN hashing with salt.
- **Dual-PIN Security**: Safe PIN (disarms SOS) vs Duress PIN (silent covert duress flagging).
- **Gemini API Integration**: Uses `@google/genai` (Python SDK `google-genai`) with Gemini 3.8 Flash for AI safety planning and threat awareness.
- **RESTful Endpoints**: Full parity with the frontend client.

### Quick Start:
```bash
cd backend_flask
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export GEMINI_API_KEY="your-gemini-api-key"
export SECRET_KEY="your-secret-key"
python app.py
```
Server will run on `http://localhost:5000`.
