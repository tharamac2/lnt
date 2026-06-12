# QR Code Tools Management System - Project Documentation

## 1. Project Overview
The **QR Code Tools Management System** is a comprehensive web-based application designed for industrial and construction environments to manage tool inventory, track tool movements, and perform inspections using QR codes.

### Key Objectives:
*   **Inventory Management**: Track tool details, purchase info, and site locations.
*   **Inspections**: Perform regular safety inspections with usability tracking.
*   **QR Integration**: Scan QR codes for instant tool retrieval and status updates.
*   **Safety Alerts**: Real-time critical alerts for damaged or expiring tools.
*   **Split Tool Matching**: Ensure correct pairing of tool components (Part A + Part B).

---

## 2. System Architecture

### Frontend
*   **Framework**: React 18 (Vite)
*   **Language**: TypeScript
*   **UI Library**: Tailwind CSS, Shadcn/UI (Radix Primitives)
*   **Icons**: Lucide React
*   **State Management**: React Hooks (`useState`, `useEffect`)
*   **QR Scanning**: `html5-qrcode`

### Backend
*   **Framework**: FastAPI (Python)
*   **Database**: MySQL (via XAMPP/Localhost)
*   **Authentication**: OAuth2 with JWT Tokens (bcrypt hashing)
*   **ORM**: SQLModel

---

## 3. Key Features

### 3.1 User Roles & Authentication
*   **Admin**: Full access to all modules, including User Management.
*   **Inspector**: Can perform inspections and view tools.
*   **Store/Worker**: Restricted access to view tool status and basic operations.
*   **Login**: Secure login with Role-Based Access Control (RBAC).

### 3.2 Tool Master (Inventory)
*   **Add New Tool**: Detailed form capturing:
    *   General Info (Description, Make, Capacity)
    *   Purchase Info (Vendor, Date)
    *   Site Movement (Current/Next Site)
    *   **Auto-generated QR ID**: Unique alphanumeric ID (e.g., `CHX892`).
*   **Edit Tool**: Update details of existing tools.
*   **QR Code**: Auto-generated on save.
*   **Status Tracking**: `Usable`, `Scrap`, `Under Repair`.

### 3.3 Inspection System
*   **Inspector View**: Dedicated dashboard for inspectors.
*   **QR Scanning**: Scan tool QR or **Search by ID**.
*   **Checklist**:
    *   Visual Damage Check.
    *   **Usability Percentage**: Key metric for safety.
    *   Photo Upload (Mock/Placeholder).
    *   Pass/Fail Status.
*   **Automatic Status Update**: Failing an inspection automatically marks the tool as `Scrap` or `Under Repair`.

### 3.4 Real-time Alerts
The system monitors all activities and usage levels:
*   **Critical Alerts**: Triggered if Tool Usability drops **below 25%** (High Wear > 75%).
*   **Warning Alerts**: Triggered if Tool Usability drops **below 50%** (Wear > 50%).
*   **Info Alerts**: Generated for:
    *   New Tool Creation.
    *   Tool Updates.
    *   Successful Inspections (Safe Usage).
    *   New User Registration.
*   **Overlay Details**: Click "View Details" to see exact timestamp, location, and tool ID.
*   **Timezone**: All alerts use Local System Time.

### 3.5 Split Tool Matching
*   **Concept**: Verifies if two separate tool parts (Part A and Part B) form a valid safe pair.
*   **Strict Matching Conditions**:
    *   Description must match.
    *   Make must match.
    *   Capacity & Safe Working Load (SWL) must match.
    *   **Location (Current Site)** must match.
*   **Outcome**: Returns "Correct Combination" (Green) or "Mismatch" (Red).

---

## 4. Database Schema (Key Models)

### `User`
*   `username`, `email`, `role`, `hashed_password`, `site`

### `Tool`
*   `description`, `make`, `capacity`, `safe_working_load`
*   `current_site`, `next_site`
*   `qr_code` (Unique Index)
*   `status` (`usable`, `scrap`)
*   `usability_percentage`, `last_inspection_date`

### `Inspection`
*   `tool_id`, `inspector_id`
*   `result` (`pass`, `fail`)
*   `usability_percentage`
*   `date` (Local Time)

### `Alert`
*   `type` (`new-tool`, `low-usability`, `tool-deleted`)
*   `severity` (`info`, `warning`, `critical`)
*   `message`, `date` (Local Time)

---

## 5. Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   Python (3.10+)

### Backend Setup
1.  **Database Prerequisite**:
    *   Install **XAMPP** (or MySQL Server).
    *   Start Apache and MySQL from XAMPP Control Panel.
    *   Create a database named `qr_tools_db` in phpMyAdmin (`http://localhost/phpmyadmin`).
2.  Navigate to root directory.
3.  Install dependencies:
    ```bash
    pip install fastapi uvicorn sqlmodel pymysql passlib[bcrypt] python-jose[cryptography] python-multipart
    ```
4.  Run Server:
    ```bash
    py -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
    ```
    *API will run at `http://localhost:8000`*

### Frontend Setup
1.  Navigate to project root.
2.  Install packages:
    ```bash
    npm install
    ```
3.  Run Dev Server:
    ```bash
    npm run dev
    ```
    *App will run at `http://localhost:5173`*

---

## 6. API Endpoints Summary

### Auth
*   `POST /users/token`: Login & Get Token.

### Tools
*   `GET /tools`: List all tools.
*   `POST /tools`: Create new tool.
*   `PATCH /tools/{id}`: Update tool.
*   `GET /tools/qr/{code}`: Get tool by QR code.

### Inspections
*   `POST /inspections`: Submit inspection result.
*   `GET /inspections/tool/{id}`: Get history for a tool.

### Alerts
*   `GET /alerts`: Fetch all system alerts.
