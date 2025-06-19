import React, { useState, useEffect } from 'react';
import axios from 'axios';
// API_URL is still the same, /api/books
const API_URL = '/api/books';

const BookCard = ({ book }) => {
    // This component does not need any changes
    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden transition-transform transform hover:-translate-y-1">
            <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2 truncate" title={book.title}>{book.title}</h3>
                <p className="text-gray-600 mb-4">by {book.author || 'Unknown Author'}</p>
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
    // --- NEW: State for the public search query ---
    const [searchQuery, setSearchQuery] = useState('');

    // --- MODIFIED: fetchBooks can now handle search queries ---
    const fetchBooks = async (query = '') => {
        setLoading(true);
        try {
            const response = await axios.get(API_URL, { params: { q: query } });
            setBooks(response.data.data);
        } catch (error) {
            console.error("Error fetching books:", error);
            setBooks([]); // Reset to empty on error
        } finally {
            setLoading(false);
        }
    };

    // Fetch all books on the initial page load
    useEffect(() => {
        fetchBooks();
    }, []);

    // --- NEW: Handlers for the search form ---
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchBooks(searchQuery);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        fetchBooks(''); // Fetch all books again
    };

    return (
        <div className="space-y-8">
            {/* --- NEW: Search Bar Section for Users --- */}
            <div className="mb-8 p-6 bg-white rounded-lg shadow-md text-center">
                <h2 className="text-3xl font-bold mb-4 text-gray-800">Find Your Next Read</h2>
                <p className="text-gray-600 mb-6">Search our collection by title or author.</p>
                <form onSubmit={handleSearchSubmit} className="flex max-w-2xl mx-auto">
                    <input
                        type="text"
                        placeholder="e.g., The Great Gatsby, Harper Lee..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-grow px-4 py-2 border border-r-0 border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-r-md hover:bg-indigo-700 transition-colors">
                        Search
                    </button>
                </form>
                {/* Only show clear button if there's a search active */}
                {searchQuery && (
                    <button onClick={handleClearSearch} className="mt-4 text-sm text-gray-500 hover:text-indigo-600">
                        Clear search results
                    </button>
                )}
            </div>

            {/* --- Book Collection Display --- */}
            <div>
                {loading ? (
                    <div className="text-center p-10">Loading books...</div>
                ) : (
                    books.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {books.map((book) => (
                                <BookCard key={book.id} book={book} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-center p-10 text-gray-500">
                            No books found for your search. Try another keyword or clear the search.
                        </p>
                    )
                )}
            </div>
        </div>
    );
};

export default Home;