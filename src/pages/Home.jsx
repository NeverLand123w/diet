import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ================================================================================= //
// 1. BookCard Component (now defined directly inside the Home.jsx file)
// ================================================================================= //
const BookCard = ({ book }) => {
    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden transition-transform transform hover:-translate-y-1 h-full flex flex-col justify-between">
            <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-2" title={book.title}>
                    {book.title}
                </h3>
                <p className="text-gray-600 mb-4">
                    by {book.author || 'Unknown Author'}
                </p>
            </div>
            <div className="p-6 pt-0">
                {book.pdfUrl ? (
                    <a href={book.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-block w-full text-center bg-indigo-500 text-white font-bold py-2 px-4 rounded hover:bg-indigo-600 transition-colors">
                        Read Now
                    </a>
                ) : (
                    <span className="inline-block w-full text-center bg-gray-300 text-gray-600 font-bold py-2 px-4 rounded cursor-not-allowed">
                        Coming Soon
                    </span>
                )}
            </div>
        </div>
    );
};


// ================================================================================= //
// 2. Pagination Component (now defined directly inside the Home.jsx file)
// ================================================================================= //
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    // Don't show pagination if there's only one page or no pages
    if (totalPages <= 1) {
        return null; 
    }

    const pageNumbers = [];
    // This creates the array of page numbers to display, e.g., [1, 2, 3, ...]
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
    }

    return (
        <nav className="flex justify-center my-12">
            <ul className="flex items-center -space-x-px h-10 text-base">
                {/* Previous Button (Optional but good for UX) */}
                <li>
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center justify-center px-4 h-10 ms-0 leading-tight text-gray-500 bg-white border border-e-0 border-gray-300 rounded-s-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Prev
                    </button>
                </li>
                {/* Page Number Buttons */}
                {pageNumbers.map(number => (
                    <li key={number}>
                        <button
                            onClick={() => onPageChange(number)}
                            className={`flex items-center justify-center px-4 h-10 leading-tight border border-gray-300 ${
                                currentPage === number
                                    ? 'z-10 text-indigo-600 border-indigo-500 bg-indigo-50'
                                    : 'text-gray-500 bg-white hover:bg-gray-100 hover:text-gray-700'
                            }`}
                        >
                            {number}
                        </button>
                    </li>
                ))}
                {/* Next Button (Optional but good for UX) */}
                <li>
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="flex items-center justify-center px-4 h-10 leading-tight text-gray-500 bg-white border border-gray-300 rounded-e-lg hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </li>
            </ul>
        </nav>
    );
};


// ================================================================================= //
// 3. Main Home Component Logic
// ================================================================================= //
const Home = () => {
    const [books, setBooks] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    const fetchData = async (query = '', page = 1) => {
        setLoading(true);
        try {
            const response = await axios.get('/api/books', {
                params: {
                    q: query,
                    page: page,
                    limit: 12 // Request 12 books per page
                }
            });
            setBooks(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            console.error("Failed to fetch books:", error);
            setBooks([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch initial data on first load
    useEffect(() => {
        fetchData();
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchData(searchQuery, 1);
    };

    const handlePageChange = (newPage) => {
        // Prevent going to invalid pages
        if (newPage < 1 || newPage > pagination.totalPages) {
            return;
        }
        fetchData(searchQuery, newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        fetchData('', 1);
    };

    return (
        <div className="space-y-8">
            {/* --- Search Bar Section --- */}
            <div className="p-6 bg-white rounded-lg shadow-md text-center">
                <h1 className="text-3xl font-bold mb-4 text-gray-800">Explore Our Library</h1>
                <p className="text-gray-600 mb-6">Search our collection by title or author.</p>
                <form onSubmit={handleSearchSubmit} className="flex max-w-2xl mx-auto">
                    <input
                        type="text"
                        placeholder="e.g., The Great Gatsby..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex-grow w-full px-4 py-2 border border-r-0 border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-r-md hover:bg-indigo-700">
                        Search
                    </button>
                </form>
                {searchQuery && (
                    <button onClick={handleClearSearch} className="mt-4 text-sm text-gray-500 hover:text-indigo-600">
                        Clear search and view all books
                    </button>
                )}
            </div>
            
            {/* --- Library Grid and Pagination --- */}
            <section>
                {loading ? (
                    <div className="text-center p-10 text-gray-500">Loading...</div>
                ) : (
                    books.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {books.map(book => <BookCard key={book.id} book={book} />)}
                            </div>
                            <Pagination
                                currentPage={pagination.page}
                                totalPages={pagination.totalPages}
                                onPageChange={handlePageChange}
                            />
                        </>
                    ) : (
                        <p className="text-center p-10 text-gray-500">
                            No books found for your query. Please try different keywords.
                        </p>
                    )
                )}
            </section>
        </div>
    );
};

export default Home;