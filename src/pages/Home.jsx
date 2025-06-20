import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { useSearchParams, Link } from 'react-router-dom';


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
                            className={`flex items-center justify-center px-4 h-10 leading-tight border border-gray-300 ${currentPage === number
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


// 3. New Carousel Component
// ================================================================================= //
const BookCarousel = ({ category }) => {
    // Only show the carousel if the category has books
    if (!category || !category.books || category.books.length === 0) {
        return null;
    }
    return (
        <section className="mb-12">
            <div className="flex justify-between items-baseline mb-4">
                <h2 className="text-3xl font-bold text-gray-800">{category.name}</h2>
                <Link to={`/?category=${category.id}`} className="text-sm text-indigo-600 hover:underline">View all →</Link>
            </div>
            <div className="flex overflow-x-auto space-x-6 pb-4 -mx-4 px-4">
                {category.books.slice(0, 10).map(book => ( // Show up to 10 books in the carousel
                    <div key={book.id} className="w-72 md:w-80 flex-shrink-0">
                        <BookCard book={book} />
                    </div>
                ))}
            </div>
        </section>
    );
};


// ================================================================================= //
// 4. Main Home Component Logic
// ================================================================================= //
const Home = () => {
    // State for all data
    const [allBooks, setAllBooks] = useState([]);
    const [filteredBooks, setFilteredBooks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);

    let [searchParams, setSearchParams] = useSearchParams();
    const currentPage = parseInt(searchParams.get('page') || '1', 10);
    const currentCategory = searchParams.get('category');
    const currentSearch = searchParams.get('q');

    const [searchInput, setSearchInput] = useState(currentSearch || '');

    // Effect to fetch data whenever URL parameters change
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // For the main filtered grid and pagination
                const booksResponse = await axios.get('/api/books', {
                    params: {
                        q: currentSearch || '',
                        categoryId: currentCategory || '',
                        page: currentPage,
                        limit: 12, // Items per page for the main grid
                    }
                });
                setFilteredBooks(booksResponse.data.data);
                setPagination(booksResponse.data.pagination);

                // For the carousels and category list, only fetch them if not already loaded
                if (categories.length === 0) {
                    const [catsRes, allBooksRes] = await Promise.all([
                        axios.get('/api/categories'),
                        axios.get('/api/books', { params: { limit: 100 } }) // Get up to 100 books for carousels
                    ]);
                    setCategories(catsRes.data.data);
                    setAllBooks(allBooksRes.data.data);
                }
            } catch (error) {
                console.error("Failed to fetch library data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [searchParams]); // Re-run this effect when the URL changes

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        const newParams = { q: searchInput, page: '1' };
        // This will clear any 'category' param and start a new search
        setSearchParams(newParams);
    };

    const handleClearFilters = () => {
        setSearchInput('');
        setSearchParams({ page: '1' });
    };

    const handleCategorySelect = (categoryId) => {
        setSearchParams({ category: categoryId, page: '1' }); // Set category, reset page and clear search
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        const newParams = new URLSearchParams(searchParams);
        newParams.set('page', newPage);
        setSearchParams(newParams);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- Data processing for carousels ---
    const booksByCategories = categories.map(category => ({
        ...category,
        books: allBooks.filter(book => book.category_ids?.toString().split(',').includes(String(category.id)))
    }));

    return (
        <div className="space-y-8">
            <h1 className="text-4xl font-bold text-gray-900 text-center">Welcome to the Library</h1>

            {/* NEW: Combined Search and Filter section */}
            <div className="p-6 bg-white rounded-lg shadow-md sticky top-16 z-10">
                <form onSubmit={handleSearchSubmit} className="flex max-w-3xl mx-auto mb-4">
                    <input
                        type="text"
                        placeholder="Search by title, author, or book number..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="flex-grow w-full px-4 py-2 border border-r-0 border-gray-300 rounded-l-md"
                    />
                    <button type="submit" className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-r-md">
                        Search
                    </button>
                </form>

                <div className="flex flex-wrap justify-center gap-2">
                    <button onClick={handleClearFilters} className={`px-4 py-2 rounded-full text-sm font-medium ${!currentCategory && !currentSearch ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                        All
                    </button>
                    {categories.map(cat => (
                        <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} className={`px-4 py-2 rounded-full text-sm font-medium ${cat.id == currentCategory ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Display category carousels only if no filter is active */}
            {!currentCategory && !currentSearch && (
                <div className="space-y-12">
                    {booksByCategories.map(cat => <BookCarousel key={cat.id} category={cat} />)}
                </div>
            )}

            {/* --- Category/Search/Paginated Results Grid --- */}
            <section className="pt-8">
                <div className="p-6 bg-white rounded-lg shadow-md mb-8">
                    <h2 className="text-2xl font-bold mb-4">
                        {currentCategory ? categories.find(c => c.id == currentCategory)?.name : 'All Books'}
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSearchParams({ page: '1' })} className={`px-4 py-2 rounded-full text-sm font-medium ${!currentCategory ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                            All Categories
                        </button>
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} className={`px-4 py-2 rounded-full text-sm font-medium ${cat.id == currentCategory ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (<div className="text-center p-10">Loading...</div>) : (
                    filteredBooks.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {filteredBooks.map(book => <BookCard key={book.id} book={book} />)}
                            </div>
                            <Pagination
                                currentPage={pagination.page}
                                totalPages={pagination.totalPages}
                                onPageChange={handlePageChange}
                            />
                        </>
                    ) : (<p className="text-center p-10 text-gray-500">No books found in this category.</p>)
                )}
            </section>
        </div>
    );
};

export default Home;