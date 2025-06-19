import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { EditBookModal } from './EditBookModal';
import secureApi from '../services/api'; // We will use this for all secure calls

// ================================================================================= //
// 1. Pagination Component (defined directly inside for simplicity)
// ================================================================================= //
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
    }

    return (
        <nav className="flex justify-center my-8">
            <ul className="flex items-center -space-x-px h-10 text-base">
                <li>
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center justify-center px-4 h-10 ms-0 leading-tight text-gray-500 bg-white border border-e-0 border-gray-300 rounded-s-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                        Prev
                    </button>
                </li>
                {pageNumbers.map(number => (
                    <li key={number}>
                        <button
                            onClick={() => onPageChange(number)}
                            className={`flex items-center justify-center px-4 h-10 leading-tight border border-gray-300 ${
                                currentPage === number ? 'z-10 text-indigo-600 border-indigo-500 bg-indigo-50' : 'text-gray-500 bg-white hover:bg-gray-100'
                            }`}
                        >
                            {number}
                        </button>
                    </li>
                ))}
                <li>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="flex items-center justify-center px-4 h-10 leading-tight text-gray-500 bg-white border border-gray-300 rounded-e-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                        Next
                    </button>
                </li>
            </ul>
        </nav>
    );
};


// ================================================================================= //
// 2. Main Admin Component
// ================================================================================= //
const Admin = () => {
    // --- STATE MANAGEMENT ---
    const [books, setBooks] = useState([]);
    const [newBook, setNewBook] = useState({ title: '', author: '', bookNumber: '' });
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalBooks: 0 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState(null);
    
    // --- DATA FETCHING (Now with pagination) ---
    const fetchBooks = async (query = '', page = 1) => {
        setIsLoading(true);
        try {
            const response = await secureApi.get('/books', {
                params: {
                    q: query,
                    page: page,
                    limit: 10 // Items per page in admin panel
                }
            });
            setBooks(response?.data?.data || []);
            setPagination(response?.data?.pagination || { page: 1, totalPages: 1, totalBooks: 0 });
        } catch (error) {
            console.error("Error fetching books:", error);
            setBooks([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchBooks(); }, []);

    // --- HANDLERS ---
    const handleAddBook = async (e) => {
        e.preventDefault();
        if (!newBook.title) {
             alert("A title is required.");
             return;
        }
        setUploading(true);
        const payload = {
            title: newBook.title,
            author: newBook.author,
            bookNumber: newBook.bookNumber,
        };
        try {
            if (newPdfFile) {
                const formData = new FormData();
                formData.append('file', newPdfFile);
                formData.append('upload_preset', 'ml_default');
                const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`;
                const cloudinaryResponse = await axios.post(CLOUDINARY_UPLOAD_URL, formData);
                payload.pdfUrl = cloudinaryResponse.data.secure_url;
                payload.publicId = cloudinaryResponse.data.public_id;
            }
            await secureApi.post('/books', payload);
            alert("Book added successfully!");
            setNewBook({ title: '', author: '', bookNumber: '' });
            setNewPdfFile(null);
            document.getElementById('new-book-form').reset();
            fetchBooks('', 1);
        } catch (error) {
            console.error('Error adding book:', error);
            alert(`Error: ${error.response?.data?.message || 'Could not add book.'}`);
        } finally {
            setUploading(false);
        }
    };
    
    const handleDeleteBook = async (bookId) => {
        if (window.confirm("Are you sure? This action is permanent.")) {
            try {
                await secureApi.delete(`/books?id=${bookId}`);
                // Refresh the current page after a delete.
                fetchBooks(searchQuery, pagination.page);
            } catch (error) {
                console.error("Error deleting book:", error);
                alert(`Error: ${error.response?.data?.message || "Could not delete book."}`);
            }
        }
    };
    
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchBooks(searchQuery, 1);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        fetchBooks('', 1);
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        fetchBooks(searchQuery, newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEditClick = (book) => { setEditingBook(book); setIsModalOpen(true); };
    const handleModalClose = () => { setIsModalOpen(false); setEditingBook(null); };
    const handleModalSave = () => {
        handleModalClose();
        fetchBooks(searchQuery, pagination.page);
    };

    return (
        <div className="p-4 space-y-8">
            {isModalOpen && <EditBookModal book={editingBook} onClose={handleModalClose} onSave={handleModalSave} />}
            
            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
            
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Add a New Book</h2>
                <form id="new-book-form" onSubmit={handleAddBook} className="space-y-4">
                    {/* ... your Add Book form JSX ... */}
                    <input type="text" placeholder="Title*" value={newBook.title} onChange={(e) => setNewBook({ ...newBook, title: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                    <input type="text" placeholder="Author" value={newBook.author} onChange={(e) => setNewBook({ ...newBook, author: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                    <input type="text" placeholder="Book Number (e.g., 123, ABC-456)" value={newBook.bookNumber} onChange={(e) => setNewBook({ ...newBook, bookNumber: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Add PDF (Optional)</label>
                        <input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} className="w-full text-sm text-gray-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    </div>
                    <button type="submit" disabled={uploading} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                        {uploading ? 'Adding...' : 'Add Book'}
                    </button>
                </form>
            </div>

            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Search Books</h2>
                {/* ... your Search form JSX ... */}
                 <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                        type="text"
                        placeholder="Search by title, author, or book number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-grow w-full px-4 py-2 border rounded-md"
                    />
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button type="submit" className="flex-1 bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700">Search</button>
                        <button type="button" onClick={handleClearSearch} className="flex-1 bg-gray-500 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-600">Clear</button>
                    </div>
                </form>
            </div>
            
            <div>
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Manage Books ({pagination.totalBooks || 0} total)</h2>
                {isLoading ? (
                    <div className="text-center p-10">Loading...</div>
                ) : (
                    books.length > 0 ? (
                        <>
                            <div className="space-y-3">
                                {books.map((book) => (
                                     <div key={book.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm">
                                        {/* ... JSX to display a single book ... */}
                                         <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-lg text-gray-800 truncate">{book.title}</p>
                                            <p className="text-sm text-gray-500">by {book.author || 'N/A'}</p>
                                            {book.bookNumber && <p className="text-xs text-gray-600 mt-1">Number: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{book.bookNumber}</span></p>}
                                            {!book.pdfUrl && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full mt-1 inline-block">NO PDF</span>}
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                                            <button onClick={() => handleEditClick(book)} className="bg-yellow-400 text-white font-bold py-1 px-3 rounded hover:bg-yellow-500">Edit</button>
                                            <button onClick={() => handleDeleteBook(book.id)} className="bg-red-600 text-white font-bold py-1 px-3 rounded hover:bg-red-700">Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Pagination
                                currentPage={pagination.page}
                                totalPages={pagination.totalPages}
                                onPageChange={handlePageChange}
                            />
                        </>
                    ) : <p className="text-center p-10 text-gray-500">No books found.</p>
                )}
            </div>
        </div>
    );
};

export default Admin;