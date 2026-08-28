"""
auth_service.py — Supabase JWT validation and FastAPI dependency for current user.
"""
import os
import json
import urllib.request
from typing import Optional
import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWKS_URL = os.environ.get(
    "SUPABASE_JWKS_URL",
    f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
)

_security = HTTPBearer(auto_error=False)

# Cache JWKS client (thread-safe singleton)
_jwks_client: Optional[PyJWKClient] = None

def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(SUPABASE_JWKS_URL, cache_keys=True)
    return _jwks_client


def verify_jwt_token(token: str) -> dict:
    """Decode and verify a Supabase-issued JWT. Returns the claims dict."""
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication failed: {e}")


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> dict:
    """
    FastAPI dependency — validates Bearer token from Authorization header.
    Returns JWT claims dict containing at minimum:
      - sub: Supabase user UUID (user_id)
      - email: user's email
      - user_metadata: name, company etc.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_jwt_token(credentials.credentials)


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_security),
) -> Optional[dict]:
    """Like get_current_user but returns None instead of raising on missing/invalid token."""
    if credentials is None:
        return None
    try:
        return verify_jwt_token(credentials.credentials)
    except HTTPException:
        return None
