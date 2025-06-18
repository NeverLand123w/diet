import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api/books';

// --- V V V ADD THIS NEW COMPONENT INSIDE Admin.jsx V V V ---
const ExcelImporter = () => {
    const [file, setFile] = useState(null);
    const [secretKey, setSecretKey] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    const handleImport = async (e) => {
        e.preventDefault();
        if (!file || !secretKey) {
            alert('Please select a file and provide the secret key.');
            return;
        }

        setIsImporting(true);
        setImportResult(null);
        const formData = new FormData();
        formData.append('excelFile', file);

        try {
            const response = await axios.post('/api/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'x-import-secret': secretKey,
                },
            });
            setImportResult({ success: true, data: response.data });
        } catch (error) {
            setImportResult({ success: false, data: error.response?.data || { error: 'A network error occurred.' } });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="my-10 p-6 bg-red-100 border-2 border-red-400 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-red-800">Danger Zone: Bulk Data Importer</h2>
            <p className="text-red-700 mb-4">This tool is for one-time use to import data from an Excel file. Use with caution.</p>
            <form onSubmit={handleImport} className="space-y-4">
                <div>
                    <label className="block font-medium text-sm text-gray-700">Import Secret Key</label>
                    <input
                        type="password"
                        placeholder="Enter your secret import key"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        className="w-full px-4 py-2 border rounded-md"
                    />
                </div>
                <div>
                    <label className="block font-medium text-sm text-gray-700">Excel File (.xlsx)</label>
                    <input
                        type="file"
                        accept=".xlsx"
                        onChange={(e) => setFile(e.target.files[0])}
                        className="w-full text-sm"
                    />
                </div>
                <button type="submit" disabled={isImporting} className="bg-red-600 text-white font-bold py-2 px-4 rounded hover:bg-red-700 disabled:bg-gray-400">
                    {isImporting ? 'Importing...' : 'Start Import'}
                </button>
            </form>
            {importResult && (
                <div className={`mt-4 p-4 rounded ${importResult.success ? 'bg-green-100 text-green-800' : 'bg-red-200 text-red-800'}`}>
                    <h3 className="font-bold">Import Result:</h3>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(importResult.data, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

const Admin = () => {
    const [books, setBooks] = useState([]);
    const [newBook, setNewBook] = useState({ title: '', author: '' });
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const fetchBooks = async () => {
        try {
            // setLoading(true); // if you have it
            const response = await axios.get(API_URL);
            // Defensive Check: Ensure the response has data and the data property is an array.
            // If not, default to an empty array.
            const booksData = Array.isArray(response?.data?.data) ? response.data.data : [];
            setBooks(booksData);
        } catch (error) {
            console.error("Error fetching books:", error);
            // If the entire API call fails, set books to an empty array to prevent crashes.
            setBooks([]);
        } finally {
            // setLoading(false); // if you have it
        }
    };

    useEffect(() => {
        fetchBooks();
    }, []);

    const handleAddBook = async (e) => {
        e.preventDefault();
        if (!newPdfFile) {
            alert("Please select a PDF file.");
            return;
        }
        setUploading(true);

        const formData = new FormData();
        formData.append('file', newPdfFile);
        formData.append('upload_preset', 'ml_default');
        formData.append('folder', 'library_pdfs');

        // --- V V V THIS IS THE LINE TO CHANGE V V V ---
        // Change `/image/upload` or `/auto/upload` to `/raw/upload`
        const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`;
        // --- ^ ^ ^ END OF CHANGE ^ ^ ^ ---

        try {
            const cloudinaryResponse = await axios.post(CLOUDINARY_UPLOAD_URL, formData);

            const { secure_url, public_id } = cloudinaryResponse.data;

            // The rest of the function remains the same...
            await axios.post(API_URL, {
                title: newBook.title,
                author: newBook.author,
                pdfUrl: secure_url,
                publicId: public_id,
            });

            alert("Book added successfully!");
            setNewBook({ title: '', author: '' });
            setNewPdfFile(null);
            document.getElementById('new-book-form').reset();
            fetchBooks();

        } catch (error) {
            console.error('Error adding book:', error);
            alert('Could not add book. Check console for details.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteBook = async (bookId) => {
        if (window.confirm("Are you sure? This will delete the book record and the PDF from the cloud.")) {
            try {
                await axios.delete(`${API_URL}?id=${bookId}`);
                alert("Book deleted successfully.");
                fetchBooks();
            } catch (error) {
                console.error("Error deleting book:", error);
                alert("Could not delete book.");
            }
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
             <ExcelImporter />
            <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-4">Add a New Book</h2>
                <form id="new-book-form" onSubmit={handleAddBook} className="space-y-4">
                    <input type="text" placeholder="Title" value={newBook.title} onChange={(e) => setNewBook({ ...newBook, title: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                    <input type="text" placeholder="Author" value={newBook.author} onChange={(e) => setNewBook({ ...newBook, author: e.target.value })} required className="w-full px-4 py-2 border rounded-md" />
                    <input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} required className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                    <button type="submit" disabled={uploading} className="bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600 disabled:bg-gray-400">
                        {uploading ? 'Uploading...' : 'Add Book'}
                    </button>
                </form>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-4">Manage Books</h2>
                <div className="space-y-3">
                    {books.map((book) => (
                        <div key={book.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
                            <div>
                                <p className="font-semibold">{book.title}</p>
                                <p className="text-sm text-gray-500">{book.author}</p>
                            </div>
                            <button onClick={() => handleDeleteBook(book.id)} className="bg-red-500 text-white font-bold py-1 px-3 rounded hover:bg-red-600">Delete</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Admin;