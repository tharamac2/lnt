# Contributing to QR Code Tools Management System

Welcome! This guide will help you set up your development environment and get started with the project.

## 1. Prerequisites
Ensure you have the following installed:
*   **Git**: [Download](https://git-scm.com/downloads)
*   **Node.js (v18+)**: [Download](https://nodejs.org/)
*   **Python (3.10+)**: [Download](https://www.python.org/)
*   **XAMPP** (or MySQL Server): [Download](https://www.apachefriends.org/)

## 2. Cloning the Repository
```bash
git clone https://github.com/tharamac2/tool-management.git
cd tool-management
```

## 3. Backend Setup (FastAPI + MySQL)
1.  **Start XAMPP**: Open XAMPP Control Panel and start **Apache** and **MySQL**.
2.  **Create Database**: Open phpMyAdmin (`http://localhost/phpmyadmin`) and create a new database named `qr_tools_db`.
3.  **Setup Environment**:
    ```bash
    # Create virtual environment (optional but recommended)
    python -m venv venv
    
    # Activate virtual environment
    # Windows:
    .\venv\Scripts\activate
    # Mac/Linux:
    source venv/bin/activate
    ```
4.  **Install Dependencies**:
    ```bash
    pip install -r backend/requirements.txt
    # OR manually:
    pip install fastapi uvicorn sqlmodel pymysql passlib[bcrypt] python-jose[cryptography] python-multipart
    ```
5.  **Run Backend Server**:
    ```bash
    py -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
    ```
    The API will run at `http://localhost:8000`.

## 4. Frontend Setup (React + Vite)
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    The app will run at `http://localhost:5173`.

## 5. Development Workflow
*   **Branching**: Create a new branch for each feature (`git checkout -b feature/my-new-feature`).
*   **Commits**: Write clear, descriptive commit messages.
*   **Pull Requests**:Push your branch and open a PR for review.

## 6. Project Structure
*   `backend/`: Python FastAPI application and database models.
*   `src/`: React frontend source code.
    *   `app/pages/`: Main application pages.
    *   `app/components/`: Reusable UI components.
    *   `app/services/`: API integration services.

Happy Coding!
