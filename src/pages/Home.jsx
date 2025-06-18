import React, { useState, useEffect } from 'react';
import axios from 'axios';

// API_URL will be /api/books which works both locally and on Vercel
const API_URL = '/api/books';

const BookCard = ({ book }) => {
    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden transition-transform transform hover:-translate-y-1">
            <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2 truncate" title={book.title}>{book.title}</h3>
                <p className="text-gray-600 mb-4">by {book.author}</p>
                <a
                    href={book.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-indigo-500 text-white font-bold py-2 px-4 rounded hover:bg-indigo-600 transition-colors"
                >
                    Read Now
                </a>
            </div>
        </div>
    );
};

const Home = () => {
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                setLoading(true);
                const response = await axios.get(API_URL);
                setBooks(response.data.data);
            } catch (error) {
                console.error("Error fetching books:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchBooks();
    }, []);

    if (loading) return <div className="text-center mt-10">Loading books...</div>;

    return (
        <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Our Collection</h1>
            {books.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {books.map((book) => (
                        <BookCard key={book.id} book={book} />
                    ))}
                </div>
            ) : (
                <p>No books available. Add some from the Admin Panel!</p>
            )}
        </div>
    );
};

export default Home;