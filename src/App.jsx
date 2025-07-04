import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import LoginPage from './pages/LoginPage';
import EContent from './pages/EContent';
import ProtectedRoute from './components/ProtectedRoute';
import LocomotiveScroll from 'locomotive-scroll';

function App() {
    const navigate = useNavigate();
    const location = useLocation();

    // The source of truth for the login state
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('admin_token'));

    // This effect ensures that if we navigate manually, the state is always in sync.
    useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem('admin_token'));
    }, [location]);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setIsLoggedIn(false);
        navigate('/'); // Redirect to homepage
    };
    const locomotiveScroll = new LocomotiveScroll();


    return (
        <div data-scroll data-scroll-section className="bg-gray-100 min-h-screen font-sans">
            <nav className="bg-white shadow-md sticky top-0 z-999">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex-shrink-0">
                            <Link to="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-800">DIET DEHRADUN</Link>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Link to="/" className="text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium">Home</Link>
                            <Link to="/e-content" className="text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium">E-Content</Link>
                            <Link to="https://forms.gle/cpjDKGqiKVaRit4VA" className="text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium">Suggestion</Link>

                            {/* --- CONDITIONAL LOGIC --- */}
                            {isLoggedIn ? (
                                <>
                                    <Link to="/admin" className="text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium">Admin</Link>
                                    <button onClick={handleLogout} className="bg-red-500 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-600">
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <Link to="/login" className="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700">
                                    Admin Login
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
            <main data-scroll data-scroll-section className="w-full">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/e-content" element={<EContent />} />
                    {/* --- THIS IS THE CORRECT WAY TO RENDER LOGIN --- */}
                    <Route
                        path="/login"
                        element={<LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />}
                    />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
                                <Admin />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </main>
        </div>
    );
}

export default App;