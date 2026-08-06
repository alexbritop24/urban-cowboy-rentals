import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getCurrentStaffAuthorization } from "../../services/authorizationService";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAuthorization = async () => {
      try {
        const authorization = await getCurrentStaffAuthorization();
        if (active) setHasSession(authorization.authorized);
      } catch (error) {
        console.error("STAFF AUTHORIZATION CHECK ERROR:", error);
        if (active) setHasSession(false);
      } finally {
        if (active) setIsCheckingSession(false);
      }
    };

    void checkAuthorization();

    return () => {
      active = false;
    };
  }, []);

  if (isCheckingSession) {
    return null;
  }

  if (!hasSession) {
    return <Navigate to="/admin-login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
