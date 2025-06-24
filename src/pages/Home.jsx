import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSearchParams, Link } from 'react-router-dom';


// ================================================================================= //
// 1. BookCard Component (Styled with Glassmorphism)
// ================================================================================= //

const BookCard = ({ book }) => {
    return (
        // DESIGN: Applied glassmorphism effect. Semi-transparent background, backdrop blur, subtle border, and a softer shadow.
        <div className="bg-[#eeeaeaad] backdrop-blur-lg rounded-xl shadow-lg overflow-hidden transition-transform transform hover:-translate-y-2 h-full flex flex-col justify-between border border-white/20">
            <div className="p-6">
                <h3 className="text-xl font-bold text-black mb-2" title={book.title}>
                    {book.title}
                </h3>
            </div>
            <div className="p-6 pt-0">
                <p className="text-[#000000b3]  mb-4">
                    by {book.author || 'Unknown Author'}
                </p>

                {book.pdfUrl ? (
                    <a href={book.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-block w-full text-center bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg">
                        Pdf Available
                    </a>
                ) : (
                    // DESIGN: Softer "disabled" look to match the theme.
                    <span className="inline-block w-full text-center bg-[#00000024] text-[oklch(0.52 0.05 257.3)] font-bold py-3 px-4 rounded-lg cursor-not-allowed">
                        Pdf Not Available
                    </span>
                )}
            </div>
        </div>
    );
};

// ================================================================================= //
// NEW: Custom Hook to handle complex pagination logic
// ================================================================================= //
const DOTS = '...';

const usePagination = ({ totalPages, currentPage, siblingCount = 1 }) => {
    const paginationRange = React.useMemo(() => {
        // Our core logic will be here
        const totalPageNumbers = siblingCount + 5; // e.g. 1, ... 4, 5, 6, ... 10

        // Case 1: If the number of pages is less than the page numbers we want to show
        if (totalPageNumbers >= totalPages) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
        const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

        const shouldShowLeftDots = leftSiblingIndex > 2;
        const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

        const firstPageIndex = 1;
        const lastPageIndex = totalPages;

        // Case 2: No left dots to show, but right dots to be shown
        if (!shouldShowLeftDots && shouldShowRightDots) {
            let leftItemCount = 3 + 2 * siblingCount;
            let leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
            return [...leftRange, DOTS, totalPages];
        }

        // Case 3: No right dots to show, but left dots to be shown
        if (shouldShowLeftDots && !shouldShowRightDots) {
            let rightItemCount = 3 + 2 * siblingCount;
            let rightRange = Array.from({ length: rightItemCount }, (_, i) => totalPages - rightItemCount + i + 1);
            return [firstPageIndex, DOTS, ...rightRange];
        }

        // Case 4: Both left and right dots to be shown
        if (shouldShowLeftDots && shouldShowRightDots) {
            let middleRange = Array.from({ length: rightSiblingIndex - leftSiblingIndex + 1 }, (_, i) => leftSiblingIndex + i);
            return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
        }
    }, [totalPages, currentPage, siblingCount]);

    return paginationRange;
};


// ================================================================================= //
// 2. Pagination Component (Styled for the new theme)
// ================================================================================= //
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    const [pageInput, setPageInput] = useState(currentPage);

    useEffect(() => {
        setPageInput(currentPage);
    }, [currentPage]);

    const handleGoToPage = (e) => {
        e.preventDefault();
        let pageNum = parseInt(pageInput, 10);
        if (pageNum >= 1 && pageNum <= totalPages) {
            onPageChange(pageNum);
        } else {
            // Reset input to current page if invalid number is entered
            setPageInput(currentPage);
        }
    };

    if (totalPages <= 1) {
        return null;
    }

    return (
        <nav className="flex justify-center items-center my-12 gap-2">
            {/* Prev Button */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center cursor-pointer justify-center px-4 h-10 leading-tight text-slate-600 bg-white/50 backdrop-blur-sm rounded-full shadow-sm border border-white/30 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Prev
            </button>

            {/* Page Input Form */}
            <form onSubmit={handleGoToPage} className="flex items-center text-base text-slate-700">
                <span>Page</span>
                <input
                    type="number"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={handleGoToPage} // Optionally navigate when user clicks away
                    className="w-16 mx-2 text-center h-10 bg-white/50 backdrop-blur-sm rounded-lg shadow-sm border border-white/30 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                    min="1"
                    max={totalPages}
                />
                <span>of {totalPages}</span>
            </form>

            {/* Next Button */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center cursor-pointer justify-center px-4 h-10 leading-tight text-slate-600 bg-white/50 backdrop-blur-sm rounded-full shadow-sm border border-white/30 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
            </button>
        </nav>
    );
};

// ================================================================================= //
// 3. New Carousel Component (Styling updates are inherited from BookCard)
// ================================================================================= //
const BookCarousel = ({ category }) => {
    if (!category || !category.books || category.books.length === 0) {
        return null;
    }
    return (
        <section className="mb-16">
            <div className="flex justify-between items-baseline mb-4">
                <h2 className="text-3xl font-bold text-slate-800">{category.name}</h2>
                <Link to={`/?category=${category.id}`} className="text-sm font-semibold text-indigo-600 hover:underline">View all →</Link>
            </div>
            {/* DESIGN: Added scrollbar styling for a more modern look on compatible browsers */}
            <div className="flex overflow-x-auto space-x-8 pb-6 -mx-4 px-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                {category.books.slice(0, 10).map(book => (
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

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const booksResponse = await axios.get('/api/books', {
                    params: { q: currentSearch || '', categoryId: currentCategory || '', page: currentPage, limit: 12 }
                });
                setFilteredBooks(booksResponse.data.data);
                setPagination(booksResponse.data.pagination);

                if (categories.length === 0) {
                    const [catsRes, allBooksRes] = await Promise.all([
                        axios.get('/api/categories'),
                        axios.get('/api/books', { params: { limit: 100 } })
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
    }, [searchParams]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setSearchParams({ q: searchInput, page: '1' });
    };

    const handleCategorySelect = (categoryId) => {
        setSearchParams({ category: categoryId, page: '1' });
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        const newParams = new URLSearchParams(searchParams);
        newParams.set('page', newPage);
        setSearchParams(newParams);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const booksByCategories = categories.map(category => ({
        ...category,
        books: allBooks.filter(book => book.category_ids?.toString().split(',').includes(String(category.id)))
    }));

    return (
        // DESIGN: Main container with a decorative background gradient and blur "blobs" for visual interest.
        <div className="min-h-screen bg-slate-50 relative overflow-hidden">
            {/* Decorative Blobs */}
            <div className="absolute top-0 -left-48 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
            <div className="absolute top-0 -right-48 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-0 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob animation-delay-4000"></div>

            {/* Content Container */}
            <div className="relative z-10 space-y-8 p-4 md:p-8">
                <h1 className="text-5xl font-extrabold text-slate-900 text-center tracking-tight">Welcome to the Library</h1>

                {/* DESIGN: Search bar with glassmorphism effect. Sticky for better UX. */}
                <div className="p-4 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg sticky top-4 z-20 border border-white/30">
                    <form onSubmit={handleSearchSubmit} className="flex mx-auto">
                        <input
                            type="text"
                            placeholder="Search by title or author"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            // DESIGN: Clean input style. Transparent background and a focus ring.
                            className="flex-grow w-full px-5 py-3 bg-transparent border-none focus:ring-2 focus:ring-indigo-400 rounded-l-lg text-lg text-slate-800 placeholder-slate-500"
                        />
                        <button type="submit" className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-r-lg hover:bg-indigo-700 transition-colors">
                            Search
                        </button>
                    </form>
                </div>

                {/* --- Category/Search/Paginated Results Grid --- */}
                <section className="pt-8">
                    {/* DESIGN: Glassmorphism container for category filters. */}
                    <div className="p-6 bg-white/60 backdrop-blur-lg rounded-2xl shadow-lg mb-8 border border-white/30">
                        <h2 className="text-2xl font-bold mb-4 text-slate-800">
                            {currentCategory ? categories.find(c => c.id == currentCategory)?.name : 'All Books'}
                        </h2>
                        <div className="flex flex-wrap gap-3">
                            {/* DESIGN: Updated button styles for a softer, pill-like design. */}
                            <button onClick={() => setSearchParams({ page: '1' })} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${!currentCategory ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/70 text-slate-700 hover:bg-white'}`}>
                                All Categories
                            </button>
                            {categories.map(cat => (
                                <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${cat.id == currentCategory ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/70 text-slate-700 hover:bg-white'}`}>
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (<div className="text-center p-20 font-semibold text-lg text-slate-600">Loading your books...</div>) : (
                        filteredBooks.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                    {filteredBooks.map(book => <BookCard key={book.id} book={book} />)}
                                </div>
                                <Pagination
                                    currentPage={pagination.page}
                                    totalPages={pagination.totalPages}
                                    onPageChange={handlePageChange}
                                />
                            </>
                        ) : (<p className="text-center p-20 text-lg text-slate-500">No books found matching your criteria.</p>)
                    )}
                </section>
            </div>
        </div>
    );
};

export default Home;