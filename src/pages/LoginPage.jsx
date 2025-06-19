import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

// We now expect onLoginSuccess as a prop
const LoginPage = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await axios.post('/api/auth/login', { username, password });
            const { token } = response.data;
            
            localStorage.setItem('admin_token', token);
            
            // Call the function passed from App.jsx to update the nav bar
            onLoginSuccess();
            
            // Redirect to the admin dashboard
            navigate('/admin');

        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-lg">
                <h1 className="text-3xl font-bold text-center text-gray-800">Admin Login</h1>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-2 border rounded-md"
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 border rounded-md"
                            required
                        />
                    </div>
                     {error && <p className="text-sm text-red-600">{error}</p>}
                    <button type="submit" className="w-full py-2 px-4 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                        Log In
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;