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

class DebtInput(BaseModel):
    person: str
    amount: float
    note: str | None = None
    date: str
    type: str = 'lent'

class DebtUpdate(BaseModel):
    amount:float


class ExpenseInput(BaseModel):
    amount: float
    merchant: str
    category: str
    note: str | None = None
    date: str

class NoteUpdate(BaseModel):
    note: str

@app.post("/api/debts")
async def add_debt(input: DebtInput, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO debts (person, amount, original_amount, note, date, type)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
    """, (input.person, input.amount, input.amount, input.note or "", input.date, input.type))
    debt_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return {"id": debt_id, "person": input.person, "amount": input.amount}

@app.get("/api/debts")
async def get_debts(user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM debts ORDER BY status ASC, date DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return list(rows)

@app.patch("/api/debts/{debt_id}")
async def update_debt(debt_id: int, body: DebtUpdate, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    status = 'paid' if body.amount <= 0 else 'unpaid'
    if status == 'paid':
        cur.execute("""
            UPDATE debts SET amount=%s, status=%s, paid_at=NOW() WHERE id=%s
        """, (0, status, debt_id))
    else:
        cur.execute("""
            UPDATE debts SET amount=%s, status=%s, paid_at=NULL WHERE id=%s
        """, (max(0, body.amount), status, debt_id))
    conn.commit()
    cur.close()
    conn.close()
    return {"updated": debt_id, "amount": body.amount, "status": status}

@app.delete("/api/debts/{debt_id}")
async def delete_debt(debt_id: int, user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM debts WHERE id = %s", (debt_id,))
    conn.commit()
    cur.close()
    conn.close()
    return {"deleted": debt_id}

@app.get("/api/stats")
async def get_stats(user_id: int = Depends(get_current_user)):
    conn = get_db()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Daily breakdown this month
    cur.execute("""
        SELECT DATE(date) as day, SUM(amount) as total
        FROM expenses
        WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
        AND status = 'done'
        GROUP BY DATE(date) ORDER BY day ASC
    """)
    daily = cur.fetchall()

    # Weekly average this month
    cur.execute("""
        SELECT AVG(weekly_total) as weekly_avg FROM (
            SELECT DATE_TRUNC('week', date) as week, SUM(amount) as weekly_total
            FROM expenses
            WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
            AND status = 'done'
            GROUP BY week
        ) w
    """)
    weekly_avg = cur.fetchone()

# Last month total
    cur.execute("""
        SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
             AND status = 'done')
            +
            (SELECT COALESCE(SUM(original_amount), 0) FROM debts
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
             AND type = 'owe')
        AS total
    """)
    last_month = cur.fetchone()

    # This month total
    cur.execute("""
        SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
             AND status = 'done')
            +
            (SELECT COALESCE(SUM(original_amount), 0) FROM debts
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
             AND type = 'owe')
        AS total
    """)
    this_month = cur.fetchone()

    cur.close()
    conn.close()
    return {
        "daily": list(daily),
        "weekly_avg": float(weekly_avg["weekly_avg"] or 0),
        "last_month": float(last_month["total"] or 0),
        "this_month": float(this_month["total"] or 0)
    }

@app.get("/dashboard")
async def dashboard(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/dashboard.html")

@app.get("/debts")
async def debts_page(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/debts.html")

@app.get("/calculator")
async def calculator_page(request: Request):
    token = request.cookies.get("session")
    if not token:
        return RedirectResponse("/login")
    return FileResponse("static/calculator.html")

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
        SELECT 
            (SELECT COALESCE(SUM(amount), 0) FROM expenses
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
             AND status = 'done')
            +
            (SELECT COALESCE(SUM(original_amount), 0) FROM debts
             WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
             AND type = 'owe')
        AS total
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

@app.get("/login")
async def login_page():
    return FileResponse("static/login.html")

app.mount("/static", StaticFiles(directory="static"), name="static")
