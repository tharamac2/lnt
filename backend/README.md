# Backend Setup Instructions

## Prerequisites
- Python 3.9+ installed and added to PATH.

## Installation

1. Navigate to the `backend` directory (or root).
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. **Database Setup**:
   - Make sure you have a MySQL server running (e.g., XAMPP, MySQL Workbench, Docker).
   - Create an empty database named `tools_management`.
   - Open `backend/.env` and update `DATABASE_URL` with your credentials:
     ```
     DATABASE_URL=mysql+mysqlconnector://<USER>:<PASSWORD>@<HOST>:<PORT>/tools_management
     ```

## Running the Server

Run the server using `uvicorn`:
```bash
uvicorn backend.main:app --reload
```
The API will be available at `http://localhost:8000`.
Documentation is at `http://localhost:8000/docs`.

## Running Tests

To verify the installation and code:

## Troubleshooting

If `python` is not found, try using the `py` launcher:
```bash
py -m pip install -r backend/requirements.txt
py -m backend.test_api
```
