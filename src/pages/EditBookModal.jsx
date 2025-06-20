import React, { useState, useEffect } from 'react';
import axios from 'axios';
import secureApi from '../services/api';
import Select from 'react-select'; // Ensure you have run 'npm install react-select'

export const EditBookModal = ({ book, allCategories, onClose, onSave }) => {
    // --- STATE ---
    const [formData, setFormData] = useState({ title: '', author: '', bookNumber: '' });
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [newPdfFile, setNewPdfFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // This effect runs once when the modal is opened. It populates all the form fields
    // with the data from the book that was clicked on.
    useEffect(() => {
        if (book) {
            // Populate simple text fields
            setFormData({
                title: book.title || '',
                author: book.author || '',
                bookNumber: book.bookNumber || '',
            });
            
            // Populate the multi-select dropdown.
            // `book.category_ids` comes from the backend as a string like "1,3,5".
            // We need to convert it into an array of numbers.
            const currentCategoryIds = book.category_ids ? book.category_ids.toString().split(',').map(Number) : [];
            
            // We then filter the `allCategories` list to find the full category objects that match
            // these IDs and format them for the 'react-select' component.
            const initialSelected = allCategories
                .filter(c => currentCategoryIds.includes(c.id))
                .map(c => ({ value: c.id, label: c.name }));
            
            setSelectedCategories(initialSelected);
        }
    }, [book, allCategories]);

    if (!book) return null;

    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        
        // --- Assemble the final payload to send to the backend ---
        let updatedData = { 
            ...formData,
            // Convert the 'react-select' format {value, label} back into a simple array of IDs
            categoryIds: selectedCategories.map(c => c.value)
        };
        
        try {
            // STEP 1: Handle PDF upload (if a new file was chosen)
            if (newPdfFile) {
                const cloudinaryFormData = new FormData();
                cloudinaryFormData.append('file', newPdfFile);
                cloudinaryFormData.append('upload_preset', 'ml_default');
                cloudinaryFormData.append('folder', 'library_pdfs');
                
                const uploadUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`;
                // Upload to Cloudinary uses plain 'axios'
                const cloudinaryResponse = await axios.post(uploadUrl, cloudinaryFormData);
                
                updatedData.pdfUrl = cloudinaryResponse.data.secure_url;
                updatedData.publicId = cloudinaryResponse.data.public_id;
                
                // Important: If we are replacing a file, we tell the backend the ID of the old file to delete
                if (book.publicId) {
                    updatedData.oldPublicId = book.publicId;
                }
            }
            
            // STEP 2: Send all updated data to our own backend API
            // This MUST use the secureApi instance to include the auth token.
            await secureApi.put(`/books?id=${book.id}`, updatedData);
            
            onSave();  // Tell the Admin page to refresh its data
            onClose(); // Close this modal

        } catch (error) {
            console.error("Failed to update book:", error);
            alert(`Error: Could not update the book. ${error.response?.data?.message || ''}`);
        } finally {
            setIsSaving(false);
        }
    };

    // Format the full list of categories for the 'react-select' options prop
    const categoryOptions = allCategories.map(c => ({ value: c.id, label: c.name }));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Edit Book</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">×</button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Author</label>
                        <input type="text" name="author" value={formData.author} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Book Number</label>
                        <input type="text" name="bookNumber" value={formData.bookNumber} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" />
                    </div>

                    {/* --- CATEGORY SELECTOR --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Categories</label>
                        <Select
                            isMulti
                            name="categories"
                            options={categoryOptions}
                            value={selectedCategories}
                            onChange={setSelectedCategories}
                            className="mt-1"
                            classNamePrefix="select"
                            placeholder="Select categories..."
                        />
                    </div>
                    
                    {/* --- PDF UPLOAD --- */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{book.pdfUrl ? "Replace PDF" : "Add PDF"}</label>
                         {book.pdfUrl && <p className="text-xs text-gray-500 mb-1">Currently has a PDF file. Upload a new one to replace it.</p>}
                        <input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0" />
                    </div>
                    
                    {/* --- ACTION BUTTONS --- */}
                    <div className="pt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300">Cancel</button>
                        <button type="submit" disabled={isSaving} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};