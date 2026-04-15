import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Legacy StudentPortal page - redirects to unified /account page
 * This page is kept for backward compatibility with old links
 */
export default function StudentPortal() {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to unified account page
    navigate('/account', { replace: true });
  }, [navigate]);

  return null;
}
