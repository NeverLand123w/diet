import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select'; // We'll use this for the category dropdowns
import { EditBookModal } from './EditBookModal';
import secureApi from '../services/api'; // Use our secure instance for all admin actions
import * as XLSX from 'xlsx';

// ================================================================================= //
// 1. Pagination Component (Integrated for simplicity)
// ================================================================================= //
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <nav className="flex justify-center my-8">
            <ul className="flex items-center -space-x-px h-10 text-base">
                <li>
                    <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center ...">Prev</button>
                </li>
                {pageNumbers.map(number => (
                    <li key={number}><button onClick={() => onPageChange(number)} className={`... ${currentPage === number ? '... bg-indigo-50' : '...'}`}>{number}</button></li>
                ))}
                <li>
                    <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center ...">Next</button>
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
    const [categories, setCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState(null); // Tracks the category being renamed

    const [newBook, setNewBook] = useState({ title: '', author: '', bookNumber: '' });
    const [newBookCategories, setNewBookCategories] = useState([]); // For the 'Add Book' form dropdown
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalBooks: 0 });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0); // For the progress bar
    const [importTotal, setImportTotal] = useState(0); // For the progress bar

    // --- DATA FETCHING ---
    const fetchData = async (query = '', page = 1) => {
        setIsLoading(true);
        console.log(`[ADMIN_FETCH] Fetching with Query: "${query}", Page: ${page}`); // Add this for sanity check
        try {
            const [booksRes, catsRes] = await Promise.all([
                secureApi.get('/books', { params: { q: query, page: page, limit: 10 } }),
                secureApi.get('/categories')
            ]);

            console.log('[ADMIN_FETCH] Received book data:', booksRes.data); // See what the API returns

            setBooks(booksRes.data?.data || []);
            setPagination(booksRes.data?.pagination || { page: 1, totalPages: 1, totalBooks: 0 });
            setCategories(catsRes.data?.data || []);
        } catch (error) {
            console.error("Error fetching admin data:", error);
            // Don't set state on error, leave it as is
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- CATEGORY HANDLERS ---
    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;
        try {
            await secureApi.post('/categories', { name: newCategoryName });
            setNewCategoryName('');
            fetchData(searchQuery, pagination.page); // Refresh data
        } catch (error) { alert(`Failed to add category. It may already exist. (${error.response?.data?.message})`); }
    };

    const handleRenameCategory = async () => {
        if (!editingCategory || !editingCategory.name.trim()) { setEditingCategory(null); return; }
        try {
            await secureApi.put('/categories', { id: editingCategory.id, name: editingCategory.name });
            setEditingCategory(null);
            fetchData(searchQuery, pagination.page); // Refresh data
        } catch (error) { alert(`Failed to rename category. (${error.response?.data?.message})`); }
    };

    const handleDeleteCategory = async (categoryId) => {
        if (window.confirm("Are you sure? This will remove the category from all books.")) {
            try {
                // The `data` property is important for DELETE requests with a body in axios
                await secureApi.delete('/categories', { data: { id: categoryId } });
                fetchData(searchQuery, pagination.page); // Refresh data
            } catch (error) { alert("Failed to delete category."); }
        }
    };

    // --- BOOK HANDLERS ---
    const handleAddBook = async (e) => {
        e.preventDefault();
        if (!newBook.title.trim()) { alert("A title is required."); return; }
        setUploading(true);
        const payload = {
            ...newBook,
            categoryIds: newBookCategories.map(c => c.value),
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
            // Reset form state
            setNewBook({ title: '', author: '', bookNumber: '' });
            setNewBookCategories([]);
            setNewPdfFile(null);
            document.getElementById('new-book-form').reset();
            fetchData('', 1); // Go back to the first page to see the new book
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
                // --- THE FIX ---
                // The URL was incorrect. It should be '/books', not '/categories'.
                await secureApi.delete(`/books?id=${bookId}`);

                // Refresh the current page after a delete.
                fetchData(searchQuery, pagination.page);
            } catch (error) {
                console.error("Error deleting book:", error);
                alert(`Error: ${error.response?.data?.message || "Could not delete book."}`);
            }
        }
    };

    // ... inside the Admin component ...

    const handleExcelImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsImporting(true);
        setImportProgress(0); // Reset progress
        setImportTotal(0);

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                let allBooks = [];
                for (const sheetName of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    const formattedData = jsonData.map(row => ({
                        title: row['Book Name'], author: row['Author'],
                        bookNumber: row['Book number']?.toString(), categoryName: sheetName,
                    })).filter(book => book.title && book.bookNumber);
                    allBooks = [...allBooks, ...formattedData];
                }

                if (allBooks.length === 0) {
                    alert("No valid book data found in the Excel file.");
                    setIsImporting(false);
                    return;
                }

                setImportTotal(allBooks.length);

                // --- BATCHING LOGIC ---
                const batchSize = 100; // Process 100 books per API call
                for (let i = 0; i < allBooks.length; i += batchSize) {
                    const batch = allBooks.slice(i, i + batchSize);
                    console.log(`[BATCH_IMPORT] Sending batch ${i / batchSize + 1}...`);

                    // The backend API is the same, we just send smaller chunks of data
                    await secureApi.post('/books/bulk-import', batch);

                    // Update the progress bar
                    setImportProgress(prev => prev + batch.length);
                }

                alert(`Import complete! ${allBooks.length} books were processed.`);
                fetchData('', 1); // Refresh the entire view

            } catch (err) {
                console.error("Error during batch import:", err);
                alert(`Import failed at record ${importProgress}. Reason: ${err.response?.data?.error || err.message}. Please check your data and try again.`);
            } finally {
                setIsImporting(false);
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = null;
    };

    // All other book handlers are unchanged
    const handleSearchSubmit = (e) => { e.preventDefault(); fetchData(searchQuery, 1); };
    const handleClearSearch = () => { setSearchQuery(''); fetchData('', 1); };
    const handlePageChange = (newPage) => { if (newPage >= 1 && newPage <= pagination.totalPages) fetchData(searchQuery, newPage); };
    const handleEditClick = (book) => { setEditingBook(book); setIsModalOpen(true); };
    const handleModalClose = () => { setIsModalOpen(false); setEditingBook(null); };
    const handleModalSave = () => { handleModalClose(); fetchData(searchQuery, pagination.page); };

    // Prepare options for react-select dropdowns
    const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));

    return (
        <div className="p-4 space-y-8">
            {/* The Edit Modal now receives the full list of categories as a prop */}
            {isModalOpen && <EditBookModal book={editingBook} allCategories={categories} onClose={handleModalClose} onSave={handleModalSave} />}

            <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>

            {/* --- NEW, ENHANCED BULK IMPORT SECTION --- */}
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Bulk Import Books</h2>
                <p className="text-sm text-gray-600 mb-3">
                    Upload an Excel file to add or update books. This will process in batches.
                </p>
                <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelImport}
                    disabled={isImporting}
                    className="block w-full text-sm ... file:bg-teal-50 ..."
                />
                {/* Progress Bar UI */}
                {isImporting && (
                    <div className="mt-4">
                        <p className="text-blue-600 font-semibold text-center mb-2">
                            Importing... Please do not close this window.
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                                className="bg-indigo-600 h-4 rounded-full transition-all duration-300"
                                style={{ width: `${(importProgress / importTotal) * 100}%` }}
                            ></div>
                        </div>
                        <p className="text-sm text-gray-600 text-center mt-1">
                            {importProgress} / {importTotal} books processed
                        </p>
                    </div>
                )}
            </div>

            {/* --- Category Management Section --- */}
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Manage Categories</h2>
                <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                    <input type="text" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="flex-grow w-full px-4 py-2 border rounded-md" />
                    <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700">Add</button>
                </form>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {categories.length > 0 ? categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            {editingCategory?.id === cat.id ? (
                                <input type="text" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} onBlur={handleRenameCategory} onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory()} autoFocus className="w-full px-2 py-1 border rounded-md" />
                            ) : (<span className="flex-grow cursor-pointer" onDoubleClick={() => setEditingCategory(cat)} title="Double-click to edit">{cat.name}</span>)}
                            <div className="flex gap-3 ml-4">
                                <button onClick={() => setEditingCategory(cat)} className="text-sm text-blue-500 hover:underline">Rename</button>
                                <button onClick={() => handleDeleteCategory(cat.id)} className="text-sm text-red-500 hover:underline">Delete</button>
                            </div>
                        </div>
                    )) : <p className="text-sm text-gray-500">No categories found. Add one above.</p>}
                </div>
            </div>

            {/* "Add a New Book" section */}
            <div className="p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Add a New Book</h2>
                <form id="new-book-form" onSubmit={handleAddBook} className="space-y-4">
                    <input type="text" placeholder="Title*" value={newBook.title} onChange={(e) => setNewBook({ ...newBook, title: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                    <input type="text" placeholder="Author" value={newBook.author} onChange={(e) => setNewBook({ ...newBook, author: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                    <input type="text" placeholder="Book Number" value={newBook.bookNumber} onChange={(e) => setNewBook({ ...newBook, bookNumber: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Categories (Optional)</label>
                        <Select isMulti options={categoryOptions} value={newBookCategories} onChange={setNewBookCategories} className="mt-1" classNamePrefix="select" placeholder="Assign one or more categories..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Add PDF (Optional)</label>
                        <input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} className="w-full ... mt-1" />
                    </div>
                    <button type="submit" disabled={uploading} className="bg-blue-600 ...">{uploading ? 'Adding...' : 'Add Book'}</button>
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

            {/* --- Manage Books list (Now displays categories) --- */}
            <div>
                <h2 className="text-2xl font-bold mb-4 text-gray-700">Manage Books ({pagination.totalBooks || 0} total)</h2>
                {isLoading ? (<div className="text-center p-10">Loading...</div>) : (books.length > 0 ? (
                    <>
                        <div className="space-y-3">
                            {books.map((book) => (
                                <div key={book.id} className="flex items-center ... bg-white ...">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold ...">{book.title}</p>
                                        <p className="text-sm text-gray-500">by {book.author || 'N/A'}</p>
                                        {book.bookNumber && <p className="text-xs text-gray-600 ...">{book.bookNumber}</p>}
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {book.category_names?.split(',').map(name => name && <span key={name} className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">{name}</span>)}
                                        </div>
                                        {!book.pdfUrl && <span className="text-xs font-bold ...">NO PDF</span>}
                                    </div>
                                    <div className="flex-shrink-0 flex ...">
                                        <button onClick={() => handleEditClick(book)} className="... bg-yellow-400 ...">Edit</button>
                                        <button onClick={() => handleDeleteBook(book.id)} className="... bg-red-600 ...">Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
                    </>
                ) : <p className="text-center p-10 text-gray-500">No books found.</p>)}
            </div>
        </div>
    );
};

export default Admin;