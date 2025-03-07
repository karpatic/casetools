// Helper function to sanitize filenames for storage keys
const sanitizeForKey = (filename) => {
    return filename.replace(/[^a-z0-9._-]/gi, '_');
};

export { sanitizeForKey };