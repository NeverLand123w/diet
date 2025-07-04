import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Plyr from "plyr-react";
import "plyr-react/plyr.css"; // Don't forget to import Plyr's CSS

// --- MOCK API URL (replace with your actual API endpoint) ---
const API_URL = '/api/books/index?type=videos';

// --- HELPER FUNCTIONS ---
const getYouTubeID = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};


// --- COMPONENT: VideoModal (The Pop-up Player) ---
const VideoModal = ({ video, onClose }) => {
    if (!video) return null;
    const videoId = getYouTubeID(video.youtube_url);
    
    useEffect(() => {
        const handleKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!videoId) {
        console.error("Cannot play video due to invalid URL:", video.youtube_url);
        onClose();
        return null;
    }

    const plyrSource = { type: 'video', sources: [{ src: videoId, provider: 'youtube' }] };
    const plyrOptions = { autoplay: false };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xl z-999 flex justify-center items-center transition-opacity duration-300 animate-fade-in" onClick={onClose}>
            <div className="relative bg-black/70 backdrop-blur-xl rounded-lg shadow-2xl w-full max-w-4xl transform animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} className="absolute -top-3 -right-3 z-10 w-9 h-9 bg-white rounded-full text-black flex items-center justify-center text-2xl font-bold hover:bg-gray-200 transition-colors" aria-label="Close">×</button>
                <div className="aspect-w-16 aspect-h-9">
                    <Plyr source={plyrSource} options={plyrOptions} />
                </div>
                <div className="p-4 bg-white rounded-b-lg border-t border-gray-200">
                    <h3 className="font-bold text-xl text-gray-900">{video.title}</h3>
                    <span className="text-sm text-gray-600">{video.academic_year}</span>
                </div>
            </div>
        </div>
    );
};


// --- COMPONENT: VideoCard (The Clickable Thumbnail with Fallback) ---
const VideoCard = ({ video, onPlayClick }) => {
    const videoId = getYouTubeID(video.youtube_url);

    const initialThumbnailUrl = videoId
        ? `https://img.youtube.com/vi/${videoId}/sddefault.jpg` // More reliable SD thumbnail
        : 'https://placehold.co/1280x720/e2e8f0/3949ab?text=Invalid+URL';

    const [imageSrc, setImageSrc] = useState(initialThumbnailUrl);

    useEffect(() => {
        // Reset imageSrc when the video prop changes, e.g., when filters are applied.
        setImageSrc(initialThumbnailUrl);
    }, [video.id, initialThumbnailUrl]);

    const handleImageError = () => {
        // Fallback to Medium Quality, which is almost always available
        setImageSrc(`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`);
    };

    if (!videoId) {
        return (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg" role="alert">
                <p className="font-bold">Invalid YouTube URL</p>
                <p className="text-sm">{video.title}</p>
            </div>
        );
    }

    return (
        <div className="group bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer" onClick={() => onPlayClick(video)}>
            <div className="relative aspect-w-16 aspect-h-9 bg-gray-200">
                <img
                    src={imageSrc}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    onError={handleImageError} // Fallback logic
                />
                <div className="absolute inset-0 bg-opacity-20 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white bg-opacity-80 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-8 h-8 text-black ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6V4z"></path></svg>
                    </div>
                </div>
            </div>
            <div className="p-4">
                <h3 className="font-bold text-lg text-gray-800 mb-1 leading-tight">{video.title}</h3>
                <span className="text-sm text-gray-500">{video.academic_year}</span>
            </div>
        </div>
    );
};


// --- MAIN COMPONENT: EContent ---
const EContent = () => {
    const [videosByYear, setVideosByYear] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedYear, setSelectedYear] = useState('all');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [currentVideo, setCurrentVideo] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                setLoading(true);
                const response = await axios.get(API_URL);
                const grouped = response.data.data.reduce((acc, video) => {
                    const year = video.academic_year || 'Uncategorized';
                    if (!acc[year]) acc[year] = [];
                    acc[year].push(video);
                    return acc;
                }, {});
                setVideosByYear(grouped);
                setError(null);
            } catch (err) {
                console.error("Error fetching videos:", err);
                setError("Failed to load videos. Please try again later.");
            } finally {
                setLoading(false);
            }
        };
        fetchVideos();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    
    useEffect(() => {
        document.body.style.overflow = currentVideo ? 'hidden' : 'auto';
        return () => { document.body.style.overflow = 'auto'; };
    }, [currentVideo]);

    const handlePlayClick = (video) => setCurrentVideo(video);
    const handleCloseModal = () => setCurrentVideo(null);
    
    if (loading) return <div className="text-center mt-20 text-gray-500 text-xl">Loading E-Content...</div>;
    if (error) return <div className="text-center mt-20 text-red-500 text-xl">{error}</div>;
    
    const sortedYears = Object.keys(videosByYear).sort((a, b) => b.localeCompare(a));
    const totalVideos = Object.values(videosByYear).reduce((sum, videos) => sum + videos.length, 0);
    const videosForSelectedYear = videosByYear[selectedYear] || [];

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Header & Filter - (Code is unchanged) */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 mb-8 border-b border-gray-200">
                    <div>
                        <h1 className="text-4xl font-extrabold text-gray-800">E-Content Library</h1>
                        <p className="mt-1 text-gray-600">Explore our collection of educational videos.</p>
                    </div>
                    <div ref={dropdownRef} className="relative w-full md:w-64 mt-4 md:mt-0">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full flex justify-between items-center px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <span className="font-medium">{selectedYear === 'all' ? 'All Years' : `Year: ${selectedYear}`}</span>
                            <svg className={`w-5 h-5 ml-2 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        <div className={`absolute z-10 mt-2 w-full bg-white shadow-xl rounded-md py-1 border border-gray-200 transition-all duration-150 ease-out origin-top ${isDropdownOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                            <button onClick={() => { setSelectedYear('all'); setIsDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 ${selectedYear === 'all' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}>All Years ({totalVideos})</button>
                            {sortedYears.map(year => (<button key={year} onClick={() => { setSelectedYear(year); setIsDropdownOpen(false); }} className={`block w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 ${selectedYear === year ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-700'}`}>{year} ({videosByYear[year].length})</button>))}
                        </div>
                    </div>
                </div>

                {/* Video Grid - (Code is unchanged) */}
                {sortedYears.length > 0 ? (
                    <div className="space-y-12">
                        {selectedYear === 'all' ? (
                            sortedYears.map(year => (
                                <section key={year}>
                                    <h2 className="text-2xl font-bold text-gray-800 pb-2 mb-6 border-b-2 border-indigo-100">{year}</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                        {videosByYear[year].map(video => (<VideoCard key={video.id} video={video} onPlayClick={handlePlayClick} />))}
                                    </div>
                                </section>
                            ))
                        ) : ( videosForSelectedYear.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                    {videosForSelectedYear.map(video => (<VideoCard key={video.id} video={video} onPlayClick={handlePlayClick} />))}
                                </div>
                            ) : (<div className="text-center py-16 bg-white rounded-lg shadow-sm"><p className="text-gray-500">No videos found for {selectedYear}.</p></div>)
                        )}
                    </div>
                ) : (<div className="text-center py-20 bg-white rounded-lg shadow-sm"><h3 className="text-xl font-semibold text-gray-700">No Videos Available</h3><p className="mt-2 text-gray-500">There is no e-content to display at the moment. Please check back later!</p></div>
                )}
            </div>

            <VideoModal video={currentVideo} onClose={handleCloseModal} />
        </div>
    );
};

export default EContent;