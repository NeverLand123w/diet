import React, { useState, useEffect } from 'react';
import axios from 'axios';
import secureApi from '../services/api';

// This is a self-contained component for the popup modal
export const EditBookModal = ({ book, onClose, onSave }) => {
    const [formData, setFormData] = useState({ title: '', author: '', bookNumber: '' });
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // When the 'book' prop changes, populate the form
    useEffect(() => {
        if (book) {
            setFormData({
                title: book.title || '',
                author: book.author || '',
                bookNumber: book.bookNumber || '',
            });
        }
    }, [book]);

    if (!book) return null; // Don't render anything if no book is being edited

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        let updatedData = { ...formData };

        try {
            // If a new PDF was selected, upload it to Cloudinary first
            if (newPdfFile) {
                const cloudinaryFormData = new FormData();
                cloudinaryFormData.append('file', newPdfFile);
                cloudinaryFormData.append('upload_preset', 'ml_default');
                cloudinaryFormData.append('folder', 'library_pdfs');

                const uploadUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`;
                const cloudinaryResponse = await axios.post(uploadUrl, cloudinaryFormData);

                // Add new PDF info to our update payload
                updatedData.pdfUrl = cloudinaryResponse.data.secure_url;
                updatedData.publicId = cloudinaryResponse.data.public_id;

                // Also tell the backend about the old PDF so it can be deleted
                if (book.publicId) {
                    updatedData.oldPublicId = book.publicId;
                }
            }

            // Send the final update request to our backend
            await secureApi.put(`/books?id=${book.id}`, updatedData);

            onSave();  // Refresh the book list on the main page
            onClose(); // Close the modal

        } catch (error) {
            console.error("Failed to update book:", error);
            alert("Error: Could not update the book. Check the console.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-6">Edit Book Details</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Author</label>
                        <input type="text" name="author" value={formData.author} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>

                    {/* --- NEW: Input for Book Number --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Book Number(s)</label>
                        <input
                            type="text"
                            name="bookNumber"
                            placeholder="e.g., 123, 456, ABC-999"
                            value={formData.bookNumber}
                            onChange={handleInputChange}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>

                    <div>
                        {/* PDF Upload section remains the same */}
                        <label className="block text-sm font-medium text-gray-700">
                            {book.pdfUrl ? "Replace PDF" : "Add PDF"}
                        </label>
                        {/* ... */}
                        <input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} className="mt-1 block w-full text-sm" />
                    </div>
                    <div className="mt-8 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isSaving} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                            {/* ... */}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};