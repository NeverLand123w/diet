import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api/books';

const Admin = () => {
    const [books, setBooks] = useState([]);
    const [newBook, setNewBook] = useState({ title: '', author: '' });
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const fetchBooks = async () => {
        const response = await axios.get(API_URL);
        setBooks(response.data.data);
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

        const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`;

        try {
            const cloudinaryResponse = await axios.post(CLOUDINARY_UPLOAD_URL, formData);
            const { secure_url, public_id } = cloudinaryResponse.data;

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