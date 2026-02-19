# 🚀 Smart Presence

## AI Powered Face Recognition Attendance & Smart Classroom Monitoring System

Smart Presence is an AI-based secure attendance and classroom monitoring system developed using **Flask**, **DeepFace**, and a modular **Single Page Application (SPA)** architecture.

The system allows biometric attendance marking using facial recognition, real-time monitoring, security alerts, and analytics dashboards for administrators, faculty, and students.

---

## 📌 Key Features

### 🔐 Authentication & Security

* Role-based access control (Admin / Faculty / Student)
* Custom CSRF protection for SPA APIs
* Brute-force login protection
* Session timeout monitoring
* Intrusion detection & security logging
* Account lock mechanism after failed attempts

### 🤖 AI-Based Face Recognition

* Secure face registration
* Encrypted biometric data storage
* DeepFace powered identity verification
* Liveness detection
* Biometric violation detection
* Proxy attendance prevention

### 📊 Smart Dashboards

* Admin analytics dashboard
* Faculty attendance session control
* Student attendance tracking
* Real-time charts using Chart.js
* Security alerts monitoring

### 📡 Real-Time System

* Live notifications using Server-Sent Events (SSE)
* Instant attendance updates
* Automatic session closing
* Negative feedback email alerts

---

## 🏗 System Architecture

### Backend

* Flask (Blueprint Architecture)
* SQLAlchemy ORM
* Flask-Login (Session Authentication)
* Flask-Migrate (Database Migrations)
* DeepFace (Face Recognition AI)

### Frontend

* Vanilla JavaScript SPA
* Modular view lifecycle system
* Chart.js analytics dashboard
* Face-api.js client detection
* Responsive UI design

### Database

* SQLite (Development)
* PostgreSQL Ready (Production)

---

## 📂 Project Structure

```
app/
 ├── models/
 ├── routes/
 ├── services/
 ├── utils/

static/
templates/
migrations/
```

### Layer Explanation

* **Models** → Database schema
* **Routes** → API endpoints
* **Services** → Business logic
* **Utils** → Security & helper utilities

---

## 🔒 Security Implementation

* Environment-based secret configuration
* Encrypted biometric storage
* HTTPOnly secure cookies
* SameSite session protection
* Rate limiting
* Custom CSRF protection for SPA
* Security alert logging

---

## ⚙ Installation & Setup

Clone repository:

```
git clone https://github.com/Chandu-0604/Smart-Presence.git
cd Smart-Presence
```

Create virtual environment:

```
python -m venv venv
venv\Scripts\activate
```

Install dependencies:

```
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```
SECRET_KEY=your_secret_key
FACE_ENCRYPTION_KEY=your_face_key
MAIL_USERNAME=your_email
MAIL_PASSWORD=your_app_password
ADMIN_EMAIL=your_email
```

Run the application:

```
python run.py
```

Open in browser:

```
http://127.0.0.1:5000
```

---

## 📈 Future Enhancements

* Progressive Web App (PWA)
* Android mobile application
* Cloud deployment with Gunicorn & Nginx
* PostgreSQL database migration
* DeepFace performance optimization

---

## 👨‍💻 Developer

**Chandan B**
Final Year – Computer Science Engineering
Brindavan College of Engineering (VTU)

GitHub: https://github.com/Chandu-0604
LinkedIn: https://www.linkedin.com/in/chandan-b-2950a626a

---

## 📜 License

This project is developed for academic and research purposes only.
