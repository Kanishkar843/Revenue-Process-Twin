import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

interface AuthContextValue {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string, fullName: string, company: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    error: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Load existing session on mount
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setIsLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signInWithEmail = async (email: string, password: string) => {
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
    };

    const signUpWithEmail = async (
        email: string,
        password: string,
        fullName: string,
        company: string
    ) => {
        setError(null);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName, company },
            },
        });
        if (error) throw new Error(error.message);
    };

    const signInWithGoogle = async () => {
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) throw new Error(error.message);
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider
            value={{ user, session, isLoading, signInWithEmail, signUpWithEmail, signInWithGoogle, signOut, error }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
