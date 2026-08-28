"""
routes_auth.py — Real Supabase Auth endpoints for signup, login, profile and OAuth.
"""
import os
from fastapi import APIRouter, HTTPException, Depends, Body
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from supabase import create_client, Client

from app.services.auth_service import get_current_user
from app.db.connection import get_connection

router = APIRouter()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


def _admin_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _anon_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


# ── Request models ────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str
    company: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ProfileRequest(BaseModel):
    company_name: str
    business_type: str = "SaaS / B2B Tech"
    company_size: str = "50-250 employees"
    revenue_model: str = "Subscription & Usage"
    currency: str = "INR (₹)"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/api/auth/signup")
def signup(body: SignupRequest):
    """Register a new user via Supabase then create their business_profiles row."""
    sb = _admin_client()
    try:
        result = sb.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": body.full_name,
                "company": body.company,
            },
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = result.user
    if not user:
        raise HTTPException(status_code=400, detail="Signup failed — no user returned.")

    # Seed empty business_profiles row
    with get_connection() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO business_profiles (user_id, email, company_name, created_at)
            VALUES (?, ?, ?, datetime('now'))
        """, (user.id, body.email, body.company))

    # Sign in to get the JWT for immediate use
    anon = _anon_client()
    try:
        session_result = anon.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
        session = session_result.session
        return {
            "access_token": session.access_token,
            "refresh_token": session.refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": body.full_name,
                "company": body.company,
            },
        }
    except Exception:
        return {"message": "Account created. Please sign in.", "user_id": user.id}


@router.post("/api/auth/login")
def login(body: LoginRequest):
    """Authenticate with email/password, return Supabase JWT."""
    sb = _anon_client()
    try:
        result = sb.auth.sign_in_with_password({
            "email": body.email,
            "password": body.password,
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    session = result.session
    user = result.user
    if not session:
        raise HTTPException(status_code=401, detail="Login failed.")

    return {
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.user_metadata.get("full_name", ""),
            "company": user.user_metadata.get("company", ""),
        },
    }


@router.get("/api/auth/me")
def me(current_user: dict = Depends(get_current_user)):
    """Return current user's profile from JWT claims + business_profiles table."""
    user_id = current_user.get("sub")
    email = current_user.get("email", "")

    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM business_profiles WHERE user_id = ?", (user_id,)
        ).fetchone()
        cust_count = conn.execute(
            "SELECT COUNT(*) FROM customers WHERE user_id = ?", (user_id,)
        ).fetchone()[0]

    profile = dict(row) if row else {}
    return {
        "id": user_id,
        "email": email,
        "full_name": current_user.get("user_metadata", {}).get("full_name", ""),
        "company": profile.get("company_name") or current_user.get("user_metadata", {}).get("company", ""),
        "business_type": profile.get("business_type", ""),
        "company_size": profile.get("company_size", ""),
        "revenue_model": profile.get("revenue_model", ""),
        "currency": profile.get("currency", "INR (₹)"),
        "has_data": cust_count > 0,
    }


@router.post("/api/auth/profile")
def save_profile(body: ProfileRequest, current_user: dict = Depends(get_current_user)):
    """Save or update business profile after onboarding."""
    user_id = current_user.get("sub")
    email = current_user.get("email", "")

    with get_connection() as conn:
        conn.execute("""
            INSERT INTO business_profiles
                (user_id, email, company_name, business_type, company_size, revenue_model, currency, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
                company_name = excluded.company_name,
                business_type = excluded.business_type,
                company_size = excluded.company_size,
                revenue_model = excluded.revenue_model,
                currency = excluded.currency
        """, (user_id, email, body.company_name, body.business_type,
              body.company_size, body.revenue_model, body.currency))

    return {"status": "saved", "user_id": user_id}


@router.get("/api/auth/google")
def google_auth():
    """Return Supabase Google OAuth URL for the frontend to redirect to."""
    oauth_url = (
        f"{SUPABASE_URL}/auth/v1/authorize"
        f"?provider=google"
        f"&redirect_to={FRONTEND_URL}/auth/callback"
    )
    return {"auth_url": oauth_url, "provider": "google"}


@router.get("/api/auth/callback")
def auth_callback(code: str = ""):
    """Redirect to frontend after OAuth — Supabase handles token exchange client-side."""
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback")


@router.post("/api/auth/logout")
def logout(current_user: dict = Depends(get_current_user)):
    """Invalidate session — client must clear local token."""
    return {"status": "logged_out", "user_id": current_user.get("sub")}
