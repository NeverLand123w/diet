import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
import { EditBookModal } from './EditBookModal';
import secureApi from '../services/api';
import * as XLSX from 'xlsx';

// ================================================================================= //
// 1. INTEGRATED PAGINATION COMPONENT (ROBUST VERSION)
// ================================================================================= //
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
            pageNumbers.push(i);
        }
    } else {
        pageNumbers.push(1);
        if (currentPage > 3) {
            pageNumbers.push('...');
        }
        if (currentPage > 2) {
            pageNumbers.push(currentPage - 1);
        }
        if (currentPage !== 1 && currentPage !== totalPages) {
            pageNumbers.push(currentPage);
        }
        if (currentPage < totalPages - 1) {
            pageNumbers.push(currentPage + 1);
        }
        if (currentPage < totalPages - 2) {
            pageNumbers.push('...');
        }
        pageNumbers.push(totalPages);
    }

    const uniquePageNumbers = [...new Set(pageNumbers)];

    return (
        <nav className="flex justify-center my-12">
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
                {uniquePageNumbers.map((number, index) => (
                    <li key={`${number}-${index}`}>
                        {number === '...' ? (
                            <span className="flex items-center justify-center px-4 h-10 text-gray-500 bg-white border border-gray-300">...</span>
                        ) : (
                            <button
                                onClick={() => onPageChange(number)}
                                className={`flex items-center justify-center px-4 h-10 border border-gray-300 ${currentPage === number ? 'z-10 text-indigo-600 bg-indigo-50 border-indigo-500' : 'text-gray-500 bg-white hover:bg-gray-100'
                                    }`}
                            >
                                {number}
                            </button>
                        )}
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
// MAIN ADMIN COMPONENT
// ================================================================================= //
const Admin = () => {
    // --- STATE MANAGEMENT ---
    const [books, setBooks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalBooks: 0 });
    const [isLoading, setIsLoading] = useState(true);

    // UI states
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState(null);
    const [newBook, setNewBook] = useState({ title: '', author: '', bookNumber: '' });
    const [newBookCategories, setNewBookCategories] = useState([]);
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);

    // --- NEW STATE FOR VIDEOS ---
    const [videos, setVideos] = useState([]);
    const [newVideo, setNewVideo] = useState({ title: '', youtube_url: '', academic_year: '2024-25' });
    const [submittingVideo, setSubmittingVideo] = useState(false);
    const [editingVideo, setEditingVideo] = useState(null);
    const [editingYear, setEditingYear] = useState(null);
    const [uniqueYears, setUniqueYears] = useState([]);

    const fetchVideos = async () => {
        try {
            const response = await axios.get('/api/books?type=videos');
            setVideos(response.data.data);

            // --- NEW: Derive unique years from the video data ---
            const years = [...new Set(response.data.data.map(video => video.academic_year))];
            // Sort them in descending order (e.g., '2024-25' comes before '2023-24')
            years.sort((a, b) => b.localeCompare(a));
            setUniqueYears(years);

            // Set default year for the 'add' form to the latest one, if it exists
            if (years.length > 0) {
                setNewVideo(prev => ({ ...prev, academic_year: years[0] }));
            }

        } catch (error) {
            console.error("Error fetching videos:", error);
        }
    };

    // Fetch both books and videos on component mount
    useEffect(() => {
        fetchVideos();
    }, []);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState(null);

    // --- CORE DATA FETCHING ---
    const fetchData = async (query = '', categoryId = '', page = 1) => {
        setIsLoading(true);
        try {
            const [booksRes, catsRes] = await Promise.all([
                secureApi.get('/books', { params: { q: query, categoryId: categoryId, page: page, limit: 8 } }),
                secureApi.get('/categories')
            ]);
            setBooks(booksRes.data?.data || []);
            setPagination(booksRes.data?.pagination || { page: 1, totalPages: 1, totalBooks: 0 });
            setCategories(catsRes.data?.data || []);
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setIsLoading(false);
        }
    };
    useEffect(() => { fetchData('', '', 1); }, []);

    // --- HANDLERS ---
    const handleAddCategory = async (e) => { e.preventDefault(); if (!newCategoryName.trim()) return; try { await secureApi.post('/categories', { name: newCategoryName }); setNewCategoryName(''); fetchData(searchQuery, selectedCategory, pagination.page); } catch (error) { alert(`Failed to add category: ${error.response?.data?.message || error.message}`); } };
    // ... inside the Admin component

    const handleRenameCategory = async () => {
        // Exit if there's no category being edited or if the new name is just empty spaces.
        if (!editingCategory || !editingCategory.name.trim()) {
            setEditingCategory(null);
            return;
        }

        try {
            // This is the data object the backend is expecting. It MUST have 'id' and 'name'.
            const payload = {
                id: editingCategory.id,
                name: editingCategory.name.trim()
            };

            // This sends a PUT request to `/api/categories` with the payload in the request body.
            await secureApi.put('/categories', payload);

            setEditingCategory(null); // Clear the editing state on success
            // Refresh data (your existing logic is correct)
            fetchData(searchQuery, selectedCategory, pagination.page);
        } catch (error) {
            console.error("Failed to rename category:", error);
            const serverError = error.response?.data?.error || error.response?.data?.details || error.message;
            alert(`Failed to rename category. Reason: ${serverError}`);
        }
    }; 
    
    const handleDeleteCategory = async (categoryId) => { if (window.confirm("Are you sure? This will remove the category from all books.")) { try { await secureApi.delete('/categories', { data: { id: categoryId } }); fetchData(searchQuery, selectedCategory, 1); } catch (error) { alert("Failed to delete category."); } } };
    const handleDeleteBook = async (bookId) => { if (window.confirm("Are you sure?")) { try { await secureApi.delete(`/books?id=${bookId}`); fetchData(searchQuery, selectedCategory, pagination.page); } catch (error) { alert(`Error deleting book: ${error.response?.data?.message || error.message}`); } } };
    const handleAddBook = async (e) => { e.preventDefault(); if (!newBook.title.trim()) return alert("Title is required."); setUploading(true); const payload = { ...newBook, categoryIds: newBookCategories.map(c => c.value) }; try { if (newPdfFile) { const formData = new FormData(); formData.append('file', newPdfFile); formData.append('upload_preset', 'ml_default'); const url = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`; const res = await axios.post(url, formData); payload.pdfUrl = res.data.secure_url; payload.publicId = res.data.public_id; } await secureApi.post('/books', payload); alert("Book added!"); setNewBook({ title: '', author: '', bookNumber: '' }); setNewBookCategories([]); setNewPdfFile(null); document.getElementById('new-book-form')?.reset(); fetchData('', '', 1); } catch (error) { alert(`Error adding book: ${error.response?.data?.message || error.message}`); } finally { setUploading(false); } };
    const handleExcelImport = (e) => { const file = e.target.files[0]; if (!file) return; setIsImporting(true); setImportProgress(0); setImportTotal(0); const reader = new FileReader(); reader.onload = async (event) => { try { const data = new Uint8Array(event.target.result); const workbook = XLSX.read(data, { type: 'array' }); let allBooks = []; for (const sheetName of workbook.SheetNames) { const ws = workbook.Sheets[sheetName]; const jsonData = XLSX.utils.sheet_to_json(ws); const formattedData = jsonData.map(r => ({ title: r['Book Name'], author: r['Author'], bookNumber: r['Book number']?.toString(), categoryName: sheetName })).filter(b => b.title && b.bookNumber); allBooks.push(...formattedData); } if (allBooks.length === 0) { alert("No valid data found in Excel file."); setIsImporting(false); return; } setImportTotal(allBooks.length); const batchSize = 100; for (let i = 0; i < allBooks.length; i += batchSize) { const batch = allBooks.slice(i, i + batchSize); await secureApi.post('/books/bulk-import', batch); setImportProgress(p => p + batch.length); } alert(`Import complete: ${allBooks.length} records processed.`); fetchData('', '', 1); } catch (err) { alert(`Import failed at record ${importProgress}. Error: ${err.response?.data?.error || err.message}`); } finally { setIsImporting(false); } }; reader.readAsArrayBuffer(file); e.target.value = null; };
    const handleSearchSubmit = (e) => { e.preventDefault(); fetchData(searchQuery, selectedCategory, 1); };
    const handleCategoryFilterChange = (e) => { const newCatId = e.target.value; setSelectedCategory(newCatId); fetchData(searchQuery, newCatId, 1); };
    const handleClearFilters = () => { setSearchQuery(''); setSelectedCategory(''); fetchData('', '', 1); };
    const handlePageChange = (newPage) => { if (newPage >= 1 && newPage <= pagination.totalPages) { fetchData(searchQuery, selectedCategory, newPage); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
    const handleEditClick = (book) => { setEditingBook(book); setIsModalOpen(true); };
    const handleModalClose = () => { setIsModalOpen(false); setEditingBook(null); };
    const handleModalSave = () => { handleModalClose(); fetchData(searchQuery, selectedCategory, pagination.page); };
    const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }));


    // --- NEW HANDLERS FOR VIDEOS ---
    const handleAddVideo = async (e) => {
        e.preventDefault();
        setSubmittingVideo(true);
        try {
            await axios.post('/api/books?type=videos', newVideo);
            alert('Video added successfully!');
            setNewVideo({ title: '', youtube_url: '', academic_year: '2024-25' }); // Reset form
            fetchVideos(); // Refresh list
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Could not add video.";
            alert(`Error: ${errorMsg}`);
        } finally {
            setSubmittingVideo(false);
        }
    };

    const handleDeleteVideo = async (videoId) => {
        if (window.confirm("Are you sure you want to delete this video?")) {
            try {
                await axios.delete(`/api/books?type=videos&id=${videoId}`);
                alert('Video deleted successfully.');
                fetchVideos(); // Refresh list
            } catch (error) {
                alert("Could not delete video.");
            }
        }
    };

    const handleUpdateVideo = async (e) => {
        e.preventDefault();
        if (!editingVideo) return;

        try {
            await axios.put(`/api/books?type=videos&id=${editingVideo.id}`, editingVideo);
            alert('Video updated successfully!');
            setEditingVideo(null); // Close the edit form
            fetchVideos(); // Refresh the list
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Could not update video.";
            alert(`Error: ${errorMsg}`);
        }
    };

    const renderVideoEditForm = () => (
        <div className="my-8 p-6 bg-yellow-100 border border-yellow-300 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4">Editing Video: <span className="text-indigo-600">{editingVideo.title}</span></h3>
            <form onSubmit={handleUpdateVideo} className="space-y-4">
                <input
                    type="text"
                    placeholder="Video Title"
                    value={editingVideo.title}
                    onChange={(e) => setEditingVideo({ ...editingVideo, title: e.target.value })}
                    required
                    className="w-full px-4 py-2 border rounded-md"
                />
                <input
                    type="url"
                    placeholder="YouTube URL"
                    value={editingVideo.youtube_url}
                    onChange={(e) => setEditingVideo({ ...editingVideo, youtube_url: e.target.value })}
                    required
                    className="w-full px-4 py-2 border rounded-md"
                />
                {/* --- The 'academic_year' field is now a TEXT INPUT --- */}
                <div>
                    <label htmlFor="edit_academic_year" className="block text-sm font-medium text-gray-700">Academic Year (e.g., 2024-25)</label>
                    <input
                        id="edit_academic_year"
                        type="text"
                        placeholder="e.g., 2024-25"
                        value={editingVideo.academic_year}
                        onChange={(e) => setEditingVideo({ ...editingVideo, academic_year: e.target.value })}
                        required
                        className="w-full px-4 py-2 border rounded-md"
                    />
                </div>
                <div className="flex items-center gap-4">
                    <button type="submit" className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600">Save Changes</button>
                    <button type="button" onClick={() => setEditingVideo(null)} className="bg-gray-500 text-white font-bold py-2 px-4 rounded hover:bg-gray-600">Cancel</button>
                </div>
            </form>
        </div>
    );

    return (
        <div className="">
            {isModalOpen && <EditBookModal book={editingBook} allCategories={categories} onClose={handleModalClose} onSave={handleModalSave} />}
            <div className="p-4 sm:p-6 lg:p-8 space-y-8">
                <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>

                {/* --- NEW VIDEO MANAGEMENT SECTION --- */}
                <section>
                    <h2 className="text-2xl font-bold mb-4">Manage E-Content (Videos)</h2>

                    {editingVideo ? renderVideoEditForm() : (
                        <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
                            <h3 className="text-xl font-bold mb-4">Add a New Video</h3>
                            <form onSubmit={handleAddVideo} className="space-y-4">
                                <div>
                                    <label htmlFor="video_title" className="block text-sm font-medium text-gray-700">Video Title</label>
                                    <input type="text" id="video_title" value={newVideo.title} onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                                </div>
                                <div>
                                    <label htmlFor="video_url" className="block text-sm font-medium text-gray-700">YouTube URL</label>
                                    <input type="url" id="video_url" value={newVideo.youtube_url} onChange={(e) => setNewVideo({ ...newVideo, youtube_url: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                                </div>
                                <div>
                                    <label htmlFor="academic_year" className="block text-sm font-medium text-gray-700">Academic Year (e.g., 2024-25)</label>
                                    <input
                                        id="academic_year"
                                        type="text"
                                        list="year-suggestions"
                                        placeholder="Start typing or select..."
                                        value={newVideo.academic_year}
                                        onChange={(e) => setNewVideo({ ...newVideo, academic_year: e.target.value })}
                                        required
                                        className="w-full px-4 py-2 border rounded-md"
                                    />
                                    <datalist id="year-suggestions">
                                        {uniqueYears.map(year => (
                                            <option key={year} value={year} />
                                        ))}
                                    </datalist>
                                </div>
                                <button type="submit" disabled={submittingVideo} className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 disabled:bg-gray-400">
                                    {submittingVideo ? 'Adding...' : 'Add Video'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* This part (the list) is ALWAYS rendered */}
                    <div>
                        <h3 className="text-xl font-bold mb-4">Existing Videos</h3>
                        <div className="space-y-3">
                            {videos.map((video) => (
                                <div key={video.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
                                    <div>
                                        <p className="font-semibold">{video.title}</p>
                                        <p className="text-sm text-gray-500">{video.academic_year}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                console.log("Edit button clicked for video:", video);
                                                setEditingVideo(video);
                                            }}
                                            className="bg-yellow-400 text-white font-bold py-1 px-3 rounded hover:bg-yellow-500"
                                            disabled={!!editingVideo}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVideo(video.id)}
                                            className="bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600"
                                            disabled={!!editingVideo}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>


                <div className="grid md:grid-cols-2 gap-8">
                    <div className="p-6 bg-white rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold mb-4 text-gray-700">Manage Categories</h2>
                        <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                            <input type="text" placeholder="New category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="flex-grow w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500" />
                            <button type="submit" className="bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition-colors">Add</button>
                        </form>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {categories.length > 0 ? categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                    {editingCategory?.id === cat.id ? (
                                        <input type="text" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} onBlur={handleRenameCategory} onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory()} autoFocus className="w-full px-2 py-1 border rounded-md" />
                                    ) : (
                                        <span className="flex-grow text-gray-800" onDoubleClick={() => setEditingCategory(cat)} title="Double-click to edit">{cat.name}</span>
                                    )}
                                    <div className="flex gap-3 ml-4 flex-shrink-0">
                                        <button onClick={() => setEditingCategory(cat)} className="text-sm text-blue-500 hover:underline">Rename</button>
                                        <button onClick={() => handleDeleteCategory(cat.id)} className="text-sm text-red-500 hover:underline">Delete</button>
                                    </div>
                                </div>
                            )) : <p className="text-sm text-gray-500 text-center py-4">No categories found. Add one above.</p>}
                        </div>
                    </div>

                    <div className="p-6 bg-white rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold mb-4 text-gray-700">Add a New Book</h2>
                        <form id="new-book-form" onSubmit={handleAddBook} className="space-y-4">
                            <input type="text" placeholder="Title*" value={newBook.title} onChange={(e) => setNewBook({ ...newBook, title: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                            <input type="text" placeholder="Author" value={newBook.author} onChange={(e) => setNewBook({ ...newBook, author: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                            <input type="text" placeholder="Book Number" value={newBook.bookNumber} onChange={(e) => setNewBook({ ...newBook, bookNumber: e.target.value })} className="w-full px-4 py-2 border rounded-md" />
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Categories</label><Select isMulti options={categoryOptions} value={newBookCategories} onChange={setNewBookCategories} className="mt-1" classNamePrefix="select" placeholder="Assign categories..." /></div>
                            <div><label className="block text-sm font-medium text-gray-700 mb-1">Add PDF (Optional)</label><input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-gray-50 hover:file:bg-gray-100" /></div>
                            <button type="submit" disabled={uploading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400">{uploading ? 'Adding...' : 'Add Book'}</button>
                        </form>
                    </div>
                </div>

                <div className="p-6 bg-white rounded-lg shadow-md"><h2 className="text-2xl font-bold mb-4">Bulk Import Books</h2><p className="text-sm text-gray-600 mb-3">Upload an Excel file (.xlsx) to add or update books. This will process in batches.</p><input type="file" accept=".xlsx, .xls" onChange={handleExcelImport} disabled={isImporting} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-teal-50 hover:file:bg-teal-100" />{isImporting && (<div className="mt-4"><p className="text-blue-600 font-semibold text-center mb-2">Importing... Please do not close this window.</p><div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-indigo-600 h-4 rounded-full transition-all duration-300" style={{ width: `${(importProgress / importTotal) * 100}%` }}></div></div><p className="text-sm text-gray-600 text-center mt-1">{importProgress} / {importTotal} records processed</p></div>)}</div>

                <div>
                    <div className="manage-top flex flex-col md:flex-row justify-between gap-4 w-full items-center mb-6 p-6 bg-white rounded-lg shadow-md">
                        <h2 className="text-2xl font-bold text-gray-700 w-full md:w-auto flex-shrink-0">Manage Books ({pagination.totalBooks || 0} total)</h2>
                        <div className="w-full md:w-auto md:min-w-[200px]"><select value={selectedCategory} onChange={handleCategoryFilterChange} className="w-full px-4 py-2 border rounded-md bg-white text-base"><option value="">Filter by All Categories</option>{categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}</select></div>
                        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:flex-grow"><input type="text" placeholder="Search title, author, or number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-grow w-full px-4 py-2 border rounded-md" /><button type="button" onClick={handleClearFilters} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-md">Clear</button></form>
                    </div>
                    {isLoading ? (<div className="text-center p-10">Loading books...</div>) : (books.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {books.map((book) => (
                                    <div key={book.id} className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col justify-between">
                                        <div className="p-4 flex-grow">
                                            <h3 className="font-bold text-lg text-gray-900 truncate" title={book.title}>{book.title}</h3>
                                            <p className="text-sm text-gray-600">by {book.author || 'N/A'}</p>
                                            {book.bookNumber && <p className="text-xs text-gray-500 mt-1">Number: {book.bookNumber}</p>}
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {book.category_names?.split(',').map(name => name && <span key={name} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">{name}</span>)}
                                            </div>
                                        </div>
                                        <div className={`p-4 flex items-center justify-between ${!book.pdfUrl ? 'bg-red-50' : 'bg-green-50'}`}>
                                            <span className={`text-sm font-semibold ${!book.pdfUrl ? 'text-red-700' : 'text-green-700'}`}>{!book.pdfUrl ? 'No PDF' : 'Has PDF'}</span>
                                            <div className="flex-shrink-0 flex gap-2">
                                                <button onClick={() => handleEditClick(book)} className="bg-yellow-400 text-white font-bold py-1 px-3 rounded hover:bg-yellow-500">Edit</button>
                                                <button onClick={() => handleDeleteBook(book.id)} className="bg-red-600 text-white font-bold py-1 px-3 rounded hover:bg-red-700">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
                        </>
                    ) : <p className="text-center p-10 text-gray-500">No books found matching your filters.</p>)}
                </div>
            </div>
        </div>
    );
};
export default Admin;