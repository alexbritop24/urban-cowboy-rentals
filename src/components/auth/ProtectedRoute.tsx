import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const hasSupabaseSession = Object.keys(localStorage).some(
    (key) =>
      key.startsWith("sb-") &&
      key.endsWith("-auth-token") &&
      Boolean(localStorage.getItem(key))
  );

  if (!hasSupabaseSession) {
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;