# 🚀 Smart Presence  
### AI Powered Face Recognition Attendance & Smart Classroom Monitoring System  

Smart Presence is a secure AI-based attendance and classroom monitoring system built using Flask, DeepFace, and a modular SPA architecture.  

It enables real-time biometric attendance marking, security monitoring, and analytics dashboards for administrators, faculty, and students.

---

## 📌 Key Features

### 🔐 Authentication & Security
- Role-based access control (Admin / Faculty / Student)
- Custom CSRF protection system
- Brute-force login protection
- Session timeout monitoring
- Intrusion detection & security logging
- Account lock mechanism

### 🤖 AI-Based Face Recognition
- Face registration & encrypted storage
- DeepFace powered biometric verification
- Liveness detection
- Biometric violation tracking
- Attendance fraud prevention

### 📊 Smart Dashboards
- Admin analytics dashboard
- Faculty session management
- Student attendance tracking
- Real-time statistics (Chart.js)
- Security alerts monitoring

### 📡 Real-Time Features
- Server Sent Events (SSE) notifications
- Live attendance updates
- Session auto-closing
- Feedback monitoring with email alerts

---

## 🏗 Architecture Overview

Backend:
- Flask (Blueprint Architecture)
- SQLAlchemy ORM
- Flask-Login (Session Management)
- Flask-Migrate (Database Migrations)
- DeepFace (AI Model)

Frontend:
- Vanilla JavaScript SPA
- Modular View System
- Chart.js Analytics
- Face-api.js (Client-side detection)
- Responsive CSS UI

Database:
- SQLite (Development)
- PostgreSQL Ready (Production)

---

## 📂 Project Structure
app/
├── models/
├── routes/
├── services/
├── utils/
static/
templates/
migrations/

The project follows clean separation of concerns:
- Models → Database layer
- Routes → API layer
- Services → Business logic
- Utils → Security & helpers

---

## 🔒 Security Highlights

- Environment-based secret management
- Encrypted biometric data
- Secure cookies (HTTPOnly + SameSite)
- Rate limiting
- Session monitoring
- CSRF protection for SPA

---

## ⚙ Installation

```bash
git clone https://github.com/Chandu-0604/Smart-Presence.git
cd Smart-Presence

python -m venv venv
venv\Scripts\activate   # Windows

pip install -r requirements.txt
Create a .env file:

SECRET_KEY=your_secret_key
FACE_ENCRYPTION_KEY=your_face_key
MAIL_USERNAME=your_email
MAIL_PASSWORD=your_app_password
ADMIN_EMAIL=your_email


Run:

python run.py


Open:

http://127.0.0.1:5000

📈 Future Enhancements

PWA Support

Android App Wrapper

Cloud Deployment (Gunicorn + Nginx)

PostgreSQL Migration

Performance Optimization

👨‍💻 Developer

Chandan B
Final Year Computer Science Engineering Student
Brindavan College of Engineering (VTU)

GitHub: https://github.com/Chandu-0604

LinkedIn: www.linkedin.com/in/chandan-b-2950a626a

📜 License

This project is developed for academic and research purposes.
