@echo off
echo ===================================================
echo Starting News Pulse: Automated Setup and Execution
echo ===================================================

:: 1. Scraper Ingestion
echo [1/3] Setting up Python Scraper...
cd scraper
python -m venv venv
call venv\Scripts\activate.bat
echo Installing scraper dependencies...
pip install -r requirements.txt
echo Running scraper...
python run.py
cd ..

:: 2. Backend API
echo [2/3] Setting up and launching Backend API...
cd backend
call npm install
echo Launching Backend API in a new window...
start "News Pulse Backend API" cmd /c "npm run dev"
cd ..

:: 3. Frontend UI
echo [3/3] Setting up and launching Frontend UI...
cd frontend
call npm install
echo Launching Frontend Next.js UI in a new window...
start "News Pulse Frontend UI" cmd /c "npm run dev"
cd ..

echo ===================================================
echo Setup Complete!
echo - Scraper has populated the database.
echo - Backend API is starting at: http://localhost:4000
echo - Frontend Next.js UI is starting at: http://localhost:3000
echo ===================================================
pause
