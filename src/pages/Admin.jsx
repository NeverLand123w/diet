import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { EditBookModal } from './EditBookModal';
import secureApi from '../services/api';


const API_URL = '/api/books';

const secureAxios = axios.create({
    baseURL: '/api',
});

// Use an interceptor to add the auth token to every request from this instance
secureAxios.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

secureAxios.interceptors.response.use(
    (response) => response, // On success, just return the response
    (error) => {
        // If the error is a 401 Unauthorized...
        if (error.response && error.response.status === 401) {
            console.log("Session expired or token invalid. Logging out.");
            // Remove the bad token
            localStorage.removeItem('admin_token');
            // Redirect to the login page
            // Using window.location.href forces a full page reload, which is good here.
            window.location.href = '/login';
        }
        // For all other errors, just pass them along
        return Promise.reject(error);
    }
);

const Admin = () => {
    // State for book data and UI controls
    const [books, setBooks] = useState([]);
    const [newBook, setNewBook] = useState({ title: '', author: '', bookNumber: '' });
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // State for the search feature
    const [searchQuery, setSearchQuery] = useState('');

    // State for the modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState(null);

    // --- DATA FETCHING ---
    const fetchBooks = async (query = '') => {
        setIsLoading(true);
        try {
            // NOTE: The base URL is already part of the instance, so we just use the endpoint path
            const response = await secureApi.get('/books', { params: { q: query } });
            setBooks(response?.data?.data || []);
        } catch (error) { /* error handling */ } finally { setIsLoading(false); }
    };

    useEffect(() => { fetchBooks(); }, []);

    // --- HANDLERS ---

    // This function goes inside your Admin.jsx component

    const handleAddBook = async (e) => {
        e.preventDefault();
        if (!newBook.title) {
            alert("A title is required.");
            return;
        }
        setUploading(true);

        // This is the data payload we will send to our own API
        const payload = {
            title: newBook.title,
            author: newBook.author,
            bookNumber: newBook.bookNumber,
            pdfUrl: null, // Start with no PDF by default
            publicId: null,
        };

        try {
            // --- STEP 1: UPLOAD TO CLOUDINARY (if a file exists) ---
            // This part correctly uses plain 'axios' because it's a third-party service.
            if (newPdfFile) {
                const formData = new FormData();
                formData.append('file', newPdfFile);
                formData.append('upload_preset', 'ml_default');
                formData.append('folder', 'library_pdfs');

                const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`;
                const cloudinaryResponse = await axios.post(CLOUDINARY_UPLOAD_URL, formData);

                // Update our payload with the URLs from Cloudinary
                payload.pdfUrl = cloudinaryResponse.data.secure_url;
                payload.publicId = cloudinaryResponse.data.public_id;
            }

            // --- STEP 2: SAVE TO OUR DATABASE (This is the fix) ---
            // This call to our own backend MUST use the 'secureApi' instance
            // to ensure the authentication token is attached.
            await secureApi.post('/books', payload); // <-- CORRECTED LINE

            alert("Book added successfully!");
            setNewBook({ title: '', author: '', bookNumber: '' });
            setNewPdfFile(null);
            document.getElementById('new-book-form').reset();
            fetchBooks(); // Refresh the list
        } catch (error) {
            console.error('Error adding book:', error);
            const errorMessage = error.response?.data?.message || 'Could not add book. Check console for details.';
            alert(`Error: ${errorMessage}`);
        } finally {
            setUploading(false);
        }
    };

    // This function goes inside your Admin.jsx component

    const handleDeleteBook = async (bookId) => {
        // The confirmation dialog is good practice
        if (window.confirm("Are you sure? This will permanently delete the book record and its PDF from the cloud.")) {
            try {
                // --- THIS IS THE FIX ---
                // We MUST use the 'secureApi' instance to ensure the auth token is sent.
                await secureApi.delete(`/books?id=${bookId}`); // <-- CORRECTED LINE

                alert("Book deleted successfully.");
                // Refresh the list. If there was a search query, re-apply it to stay consistent.
                fetchBooks(searchQuery);
            } catch (error) {
                console.error("Error deleting book:", error);
                const errorMessage = error.response?.data?.message || "Could not delete book.";
                alert(`Error: ${errorMessage}`);
            }
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchBooks(searchQuery);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        fetchBooks(''); // Passing an empty string fetches all books
    };

    const handleEditClick = (book) => {
        setEditingBook(book);
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingBook(null);
    };

    // Callback function passed to the modal. It runs after a successful save.
    const handleModalSave = () => {
        handleModalClose();
        fetchBooks(searchQuery); // Re-fetch data, preserving the current search filter
    };

    return (
        <div className="p-4 space-y-8">
            {/* The Edit Modal, which is rendered conditionally */}
            {isModalOpen && <EditBookModal book={editingBook} onClose={handleModalClose} onSave={handleModalSave} />}

            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>

            {/* "Add a New Book" section */}
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Add a New Book</h2>
                <form id="new-book-form" onSubmit={handleAddBook} className="space-y-4">
                    <input type="text" placeholder="Title*" value={newBook.title} onChange={(e) => setNewBook({ ...newBook, title: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                    <input type="text" placeholder="Author" value={newBook.author} onChange={(e) => setNewBook({ ...newBook, author: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                    <input type="text" placeholder="Book Number (e.g., 123, ABC-456)" value={newBook.bookNumber} onChange={(e) => setNewBook({ ...newBook, bookNumber: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Add PDF (Optional)</label>
                        <input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} className="w-full text-sm text-gray-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    </div>
                    <button type="submit" disabled={uploading} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
                        {uploading ? 'Adding...' : 'Add Book'}
                    </button>
                </form>
            </div>

            {/* "Search Books" section */}
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Search Books</h2>
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search by title, author, or book number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-grow w-full px-4 py-2 border rounded-md"
                    />
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors">
                            Search
                        </button>
                        <button type="button" onClick={handleClearSearch} className="flex-1 bg-gray-500 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-600 transition-colors">
                            Clear
                        </button>
                    </div>
                </form>
            </div>

            {/* "Manage Books" list */}
            <div>
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Manage Books ({books.length} results)</h2>
                {isLoading ? (
                    <div className="text-center p-10">Loading books...</div>
                ) : (
                    <div className="space-y-3">
                        {books.length > 0 ? books.map((book) => (
                            <div key={book.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-lg text-gray-800 truncate" title={book.title}>{book.title}</p>
                                    <p className="text-sm text-gray-500">by {book.author || 'N/A'}</p>
                                    {book.bookNumber && <p className="text-xs text-gray-600 mt-1">Number: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{book.bookNumber}</span></p>}
                                    {!book.pdfUrl && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full mt-1 inline-block">NO PDF</span>}
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                                    <button onClick={() => handleEditClick(book)} className="bg-yellow-400 text-white font-bold py-1 px-3 rounded hover:bg-yellow-500">Edit</button>
                                    <button onClick={() => handleDeleteBook(book.id)} className="bg-red-600 text-white font-bold py-1 px-3 rounded hover:bg-red-700">Delete</button>
                                </div>
                            </div>
                        )) : <p className="text-center p-10 text-gray-500">No books found.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Admin;