import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('admin_token');
    const location = useLocation();

    if (!token) {
        // If no token, redirect to login page, but remember where they came from
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If token exists, render the child component (the Admin page)
    return children;
};

export default ProtectedRoute;