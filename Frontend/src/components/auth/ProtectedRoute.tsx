import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading && !user) {
            navigate("/login", { replace: true });
        }
    }, [user, isLoading, navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[var(--color-muted)] font-medium">Verifying your session…</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return <>{children}</>;
}
