import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import LoginPage from './pages/LoginPage';
import EContent from './pages/EContent'; // Assuming you have this page
import ProtectedRoute from './components/ProtectedRoute';
import LocomotiveScroll from 'locomotive-scroll';

// Import Helmet for SEO
import { Helmet } from 'react-helmet';

function App() {
    const navigate = useNavigate();
    const location = useLocation(); // Keep this one, remove the other
    const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('admin_token'));
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // --- SEO Configuration ---
    // Change this to your final production domain
    const siteDomain = 'https://diet-library.vercel.app';
    const canonicalUrl = `${siteDomain}${location.pathname}`;
    const siteName = "DIET Dehradun Library";
    const ogImageUrl = `${siteDomain}/logo.png`; // Using your logo as the default share image

    // --- Locomotive Scroll Fix ---
    // Use a ref to ensure Locomotive Scroll is initialized only once
    const scrollRef = useRef(null);

    useEffect(() => {
        // Only initialize Locomotive Scroll if the ref is set and it hasn't been done already
        if (scrollRef.current && !scrollRef.current.locomotiveScrollInstance) {
            scrollRef.current.locomotiveScrollInstance = new LocomotiveScroll({
                el: scrollRef.current,
                smooth: true,
                // Add any other locomotive-scroll options here
            });
        }

        // Cleanup function to destroy the instance when the component unmounts
        return () => {
            if (scrollRef.current && scrollRef.current.locomotiveScrollInstance) {
                scrollRef.current.locomotiveScrollInstance.destroy();
                scrollRef.current.locomotiveScrollInstance = null;
            }
        };
    }, []); // Empty dependency array means this runs only once on mount

    // --- Authentication State Sync ---
    useEffect(() => {
        setIsLoggedIn(!!localStorage.getItem('admin_token'));
    }, [location]);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setIsLoggedIn(false);
        setIsMenuOpen(false); // Close menu on logout
        navigate('/');
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        // The ref is attached to the main scrollable element
        <div ref={scrollRef} className="bg-gray-100 min-h-screen font-sans">
            <Helmet>
                {/* General SEO tags that apply to the whole site */}
                <meta name="keywords" content="DIET Dehradun, e-library, online books, educational resources, NCERT, SCERT, digital library" />
                <meta name="author" content={siteName} />

                {/* --- Open Graph / Facebook (for social sharing) --- */}
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content={siteName} />
                <meta property="og:image" content={ogImageUrl} />

                {/* --- Twitter Card (for social sharing) --- */}
                <meta property="twitter:card" content="summary_large_image" />
                <meta property="twitter:image" content={ogImageUrl} />

                {/* --- Canonical Link (tells Google the "official" URL) --- */}
                <link rel="canonical" href={canonicalUrl} />
            </Helmet>

            <nav className="bg-white shadow-md sticky top-0 z-50">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex-shrink-0">
                            <Link to="/" className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-5">
                                <img src='logo.png' alt='Logo' className='w-[6em]' />
                                <span className="text-1xl">DIET <br></br>DEHRADUN</span>
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-4">
                            <Link to="/" className="text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium">Home</Link>
                            <Link to="/e-content" className="text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium">E-Content</Link>
                            <Link to="https://docs.google.com/forms/d/e/1FAIpQLSf1if9ITIeob1MafObMIdOdcXdbaTd2yfvNfs4q1EJs8RmuxQ/viewform?usp=dialog" className="text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium">Suggestion</Link>

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

                        {/* Mobile menu button */}
                        <div className="md:hidden flex items-center">
                            <button
                                onClick={toggleMenu}
                                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-200 focus:outline-none"
                                aria-expanded="false"
                            >
                                <span className="sr-only">Open main menu</span>
                                {!isMenuOpen ? (
                                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                ) : (
                                    <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation */}
                <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'}`}>
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white shadow-lg">
                        <Link
                            to="/"
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-200"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Home
                        </Link>
                        <Link
                            to="/e-content"
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-200"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            E-Content
                        </Link>
                        <Link
                            to="https://forms.gle/cpjDKGqiKVaRit4VA"
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-200"
                            onClick={() => setIsMenuOpen(false)}
                        >
                            Suggestion
                        </Link>

                        {isLoggedIn ? (
                            <>
                                <Link
                                    to="/admin"
                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-200"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    Admin
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-white bg-red-500 hover:bg-red-600"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link
                                to="/login"
                                className="block px-3 py-2 rounded-md text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Admin Login
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            <main data-scroll data-scroll-section className="w-full">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/e-content" element={<EContent />} />
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
