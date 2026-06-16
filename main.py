from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel
import psycopg2
import psycopg2.extras
import os
import secrets
from dotenv import load_dotenv
from datetime import date
import bcrypt

load_dotenv()

app = FastAPI()

def get_db():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT")
    )

def get_current_user(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT user_id FROM sessions WHERE token = %s", (token,))
    session = cur.fetchone()
    cur.close()
    conn.close()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    return session["user_id"]

# --- Auth ---

class LoginInput(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(input: LoginInput, response: Response):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM users WHERE username = %s", (input.username,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not bcrypt.checkpw(input.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_hex(32)
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user["id"]))
    conn.commit()
    cur.close()
    conn.close()

    response.set_cookie("session", token, httponly=True, samesite="lax", max_age=60*60*24*30)
    return {"ok": True}

@app.post("/api/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session")
    if token:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE token = %s", (token,))
        conn.commit()
        cur.close()
        conn.close()
    response.delete_cookie("session")
    return {"ok": True}

@app.get("/api/me")
async def me(user_id: int = Depends(get_current_user)):
    return {"user_id": user_id}

# --- Expenses ---

class ExpenseInput(BaseModel):
    amount: float
    merchant: str
    category: str
    note: str | None = None
    date: str

class NoteUpdate(BaseModel):
    note: str

@app.post("/api/expenses")
async def add_expense(input: ExpenseInput, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO expenses (amount, merchant, category, note, date, status)
        VALUES (%s, %s, %s, %s, %s, 'done')
        RETURNING id
    """, (input.amount, input.merchant, input.category, input.note or "", input.date))
    expense_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": expense_id, "amount": input.amount, "merchant": input.merchant,
            "category": input.category, "note": input.note, "date": input.date}

@app.get("/api/expenses")
async def get_expenses(limit: int = 50, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM expenses WHERE status='done' ORDER BY date DESC, created_at DESC LIMIT %s", (limit,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return list(rows)

@app.get("/api/summary")
async def get_summary(user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        SELECT category, SUM(amount) as total
        FROM expenses
        WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
        AND status = 'done'
        GROUP BY category ORDER BY total DESC
    """)
    by_category = cur.fetchall()
    cur.execute("""
        SELECT SUM(amount) as total
        FROM expenses
        WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
        AND status = 'done'
    """)
    monthly_total = cur.fetchone()
    cur.close()
    conn.close()
    return {"by_category": list(by_category), "monthly_total": monthly_total["total"] or 0}

@app.patch("/api/expenses/{expense_id}/note")
async def update_note(expense_id: int, body: NoteUpdate, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE expenses SET note = %s WHERE id = %s", (body.note, expense_id))
    conn.commit()
    cur.close()
    conn.close()
    return {"updated": expense_id, "note": body.note}

@app.delete("/api/expenses/{expense_id}")
async def delete_expense(expense_id: int, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM expenses WHERE id = %s", (expense_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"deleted": expense_id}

# --- Static pages ---
@app.get("/")
async def index(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/index.html")

@app.get("/dashboard")
async def dashboard(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/dashboard.html")

@app.get("/login")
async def login_page():
    return FileResponse("static/login.html")

app.mount("/static", StaticFiles(directory="static"), name="static")
