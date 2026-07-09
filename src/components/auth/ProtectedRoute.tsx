import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      setHasSession(Boolean(data.session));
      setIsCheckingSession(false);
    };

    checkSession();
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