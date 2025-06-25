import React, { useState, useEffect } from 'react';
import axios from 'axios';
import secureApi from '../services/api';
import Select from 'react-select';

export const EditBookModal = ({ book, allCategories, onClose, onSave }) => {
    // --- STATE MANAGEMENT ---
    // Holds the values for the simple text input fields
    const [formData, setFormData] = useState({ title: '', author: '', bookNumber: '' });
    // Holds the selected category options in the format required by react-select
    const [selectedCategories, setSelectedCategories] = useState([]);
    // Holds the new PDF file if the user selects one
    const [newPdfFile, setNewPdfFile] = useState(null);
    // Tracks loading state to disable buttons during API calls
    const [isSaving, setIsSaving] = useState(false);

    // This effect runs when the modal is first opened or if the selected book changes.
    // Its job is to populate the form with the existing data of the book being edited.
    useEffect(() => {
        if (book) {
            // Populate simple text fields from the book object
            setFormData({
                title: book.title || '',
                author: book.author || '',
                bookNumber: book.bookNumber || '',
            });
            
            // Populate the multi-select dropdown for categories
            const currentCategoryIds = book.category_ids ? book.category_ids.toString().split(',').map(Number) : [];
            const initialSelected = allCategories
                .filter(c => currentCategoryIds.includes(c.id))
                .map(c => ({ value: c.id, label: c.name }));
            setSelectedCategories(initialSelected);

            // Reset the file input when modal opens for a new book
            setNewPdfFile(null);
        }
    }, [book, allCategories]);

    // If no book is passed, the modal is not visible
    if (!book) return null;

    // A generic handler for all text input fields
    const handleInputChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const customStyles = {
        menuList: (base) => ({
            ...base,
            // Set the max-height of the dropdown menu
            maxHeight: '200px', // or any other value you prefer
        })
    };
    
    // --- HANDLER FOR THE MAIN "SAVE CHANGES" BUTTON ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert("Title cannot be empty.");
            return;
        }
        setIsSaving(true);
        
        let updatedData = { 
            ...formData,
            categoryIds: selectedCategories.map(c => c.value)
        };
        
        try {
            // STEP 1: Handle PDF upload if a new file was chosen by the user
            if (newPdfFile) {
                const cloudinaryFormData = new FormData();
                cloudinaryFormData.append('file', newPdfFile);
                cloudinaryFormData.append('upload_preset', 'ml_default');
                cloudinaryFormData.append('folder', 'library_pdfs');
                
                const uploadUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/raw/upload`;
                const cloudinaryResponse = await axios.post(uploadUrl, cloudinaryFormData);
                
                updatedData.pdfUrl = cloudinaryResponse.data.secure_url;
                updatedData.publicId = cloudinaryResponse.data.public_id;
                // If replacing a file, tell the backend what old file to delete from Cloudinary
                if (book.publicId) {
                    updatedData.oldPublicId = book.publicId;
                }
            }
            
            // STEP 2: Send all the updated data to our own API
            await secureApi.put(`/books?id=${book.id}`, updatedData);
            
            alert("Book updated successfully!");
            onSave();
            onClose();

        } catch (error) {
            console.error("Failed to update book:", error);
            alert(`Error: Could not update book. ${error.response?.data?.message || ''}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    // --- HANDLER FOR THE DEDICATED "REMOVE PDF" BUTTON ---
    const handleRemovePdf = async () => {
        if (!window.confirm("Are you sure you want to permanently delete this book's PDF from the cloud? This cannot be undone.")) {
            return;
        }
        
        setIsSaving(true);
        // We build a special payload to signal a PDF deletion to the backend
        const payload = {
            ...formData,
            categoryIds: selectedCategories.map(c => c.value),
            pdfUrl: null,       // Signal to remove URL
            publicId: null,     // Signal to remove publicId
            oldPublicId: book.publicId, // Tell the backend WHICH file to delete
        };

        try {
            await secureApi.put(`/books?id=${book.id}`, payload);
            alert("PDF successfully removed.");
            onSave();
            onClose();
        } catch (error) {
            console.error("Failed to remove PDF:", error);
            alert(`Error: Could not remove PDF. ${error.response?.data?.message || ''}`);
        } finally {
            setIsSaving(false);
        }
    };


    const categoryOptions = allCategories.map(c => ({ value: c.id, label: c.name }));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[999]" onClick={onClose}>
            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg max-h-[100vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Edit Book</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-800 text-3xl leading-none font-bold">×</button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Title</label>
                        <input type="text" name="title" value={formData.title} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Author</label>
                        <input type="text" name="author" value={formData.author} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Book Number</label>
                        <input type="text" name="bookNumber" value={formData.bookNumber} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
                    </div>

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
                             styles={customStyles}
                        />
                    </div>
                    
                    <div className="p-4 border rounded-md space-y-3 bg-gray-50">
                         <label className="block text-sm font-medium text-gray-700">Manage PDF</label>
                         {book.pdfUrl ? (
                             <div className="flex items-center justify-between">
                                 <a href={book.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline font-medium">
                                     View Current PDF
                                 </a>
                                 <button type="button" onClick={handleRemovePdf} disabled={isSaving} className="text-sm bg-red-100 text-red-700 font-semibold py-1 px-3 rounded-md hover:bg-red-200 disabled:opacity-50">
                                     Remove PDF
                                 </button>
                             </div>
                         ) : (
                             <p className="text-sm text-gray-500">This book currently has no PDF.</p>
                         )}
                         <div className="pt-2">
                             <label className="block text-xs font-medium text-gray-600 mb-1">{book.pdfUrl ? "Upload New PDF to Replace" : "Upload New PDF to Add"}</label>
                             <input type="file" accept=".pdf" onChange={(e) => setNewPdfFile(e.target.files[0])} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0" />
                         </div>
                    </div>
                    
                    <div className="pt-6 flex justify-end space-x-4">
                        <button type="button" onClick={onClose} disabled={isSaving} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50">Cancel</button>
                        <button type="submit" disabled={isSaving} className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};