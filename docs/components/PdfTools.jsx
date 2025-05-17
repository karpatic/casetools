import React from 'react';
import { PDFDocument } from 'pdf-lib';

const PdfTools = () => {
    const [files, setFiles] = React.useState([]);
    const [mergedPdfUrl, setMergedPdfUrl] = React.useState(null);
    const [selectedFile, setSelectedFile] = React.useState(null);
    const [pageImages, setPageImages] = React.useState([]);
    const [selectedPages, setSelectedPages] = React.useState([]);
    const [modifiedPdfUrl, setModifiedPdfUrl] = React.useState(null);
    
    // New state variables for insert between pages feature
    const [mainPdfFile, setMainPdfFile] = React.useState(null);
    const [insertPdfFile, setInsertPdfFile] = React.useState(null);
    const [mainPdfPageImages, setMainPdfPageImages] = React.useState([]);
    const [insertPosition, setInsertPosition] = React.useState(1);
    const [insertedPdfUrl, setInsertedPdfUrl] = React.useState(null);

    const handleFileChange = (event) => {
        setFiles([...event.target.files]);
    };

    const handleSingleFileChange = async (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            setSelectedFile(file);
            await renderPdfPages(file);
            setSelectedPages([]);
            setModifiedPdfUrl(null);
        }
    };

    const renderPdfPages = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const images = [];

        for (let i = 0; i < pageCount; i++) {
            // Use pdf-lib to extract each page into a new document
            const singlePagePdf = await PDFDocument.create();
            const [copiedPage] = await singlePagePdf.copyPages(pdf, [i]);
            singlePagePdf.addPage(copiedPage);
            
            // Convert to blob and create URL
            const pdfBytes = await singlePagePdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            images.push({
                pageNumber: i + 1,
                url: url
            });
        }
        
        setPageImages(images);
    };

    const togglePageSelection = (pageNumber) => {
        if (selectedPages.includes(pageNumber)) {
            setSelectedPages(selectedPages.filter(p => p !== pageNumber));
        } else {
            setSelectedPages([...selectedPages, pageNumber]);
        }
    };

    const removeSelectedPages = async () => {
        if (!selectedFile || selectedPages.length === 0) return;

        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        
        // Get all page indices
        const allPages = pdf.getPageIndices();
        
        // Create a new PDF with only non-selected pages
        const newPdf = await PDFDocument.create();
        for (let i = 0; i < allPages.length; i++) {
            if (!selectedPages.includes(i + 1)) {
                const [copiedPage] = await newPdf.copyPages(pdf, [i]);
                newPdf.addPage(copiedPage);
            }
        }
        
        const modifiedPdfBytes = await newPdf.save();
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setModifiedPdfUrl(url);
    };
    
    const removeNonSelectedPages = async () => {
        if (!selectedFile || selectedPages.length === 0) return;

        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        
        // Create a new PDF with only the selected pages
        const newPdf = await PDFDocument.create();
        for (let i = 0; i < pdf.getPageCount(); i++) {
            if (selectedPages.includes(i + 1)) {
                const [copiedPage] = await newPdf.copyPages(pdf, [i]);
                newPdf.addPage(copiedPage);
            }
        }
        
        const modifiedPdfBytes = await newPdf.save();
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setModifiedPdfUrl(url);
    };
    
    const keepSelectedPagesOnly = async () => {
        if (!selectedFile || selectedPages.length === 0) return;

        const arrayBuffer = await selectedFile.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        
        // Create a new PDF with only the selected pages
        const newPdf = await PDFDocument.create();
        for (let i = 0; i < pdf.getPageCount(); i++) {
            if (selectedPages.includes(i + 1)) {
                const [copiedPage] = await newPdf.copyPages(pdf, [i]);
                newPdf.addPage(copiedPage);
            }
        }
        
        const modifiedPdfBytes = await newPdf.save();
        const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setModifiedPdfUrl(url);
    };

    const mergePdfs = async () => {
        const mergedPdf = await PDFDocument.create();
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setMergedPdfUrl(url);
    };

    const handleMainPdfChange = async (event) => {
        if (event.target.files.length > 0) {
            const file = event.target.files[0];
            setMainPdfFile(file);
            await renderMainPdfPages(file);
            setInsertPosition(1);
            setInsertedPdfUrl(null);
        }
    };

    const handleInsertPdfChange = (event) => {
        if (event.target.files.length > 0) {
            setInsertPdfFile(event.target.files[0]);
            setInsertedPdfUrl(null);
        }
    };

    const renderMainPdfPages = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const pageCount = pdf.getPageCount();
        
        const images = [];
        
        for (let i = 0; i < pageCount; i++) {
            // Use pdf-lib to extract each page into a new document
            const singlePagePdf = await PDFDocument.create();
            const [copiedPage] = await singlePagePdf.copyPages(pdf, [i]);
            singlePagePdf.addPage(copiedPage);
            
            // Convert to blob and create URL
            const pdfBytes = await singlePagePdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            images.push({
                pageNumber: i + 1,
                url: url
            });
        }
        
        setMainPdfPageImages(images);
    };

    const handleInsertPositionChange = (e) => {
        const position = parseInt(e.target.value);
        setInsertPosition(position);
    };

    const insertPdfBetweenPages = async () => {
        if (!mainPdfFile || !insertPdfFile) return;

        const mainPdfArrayBuffer = await mainPdfFile.arrayBuffer();
        const insertPdfArrayBuffer = await insertPdfFile.arrayBuffer();
        
        const mainPdf = await PDFDocument.load(mainPdfArrayBuffer);
        const insertPdf = await PDFDocument.load(insertPdfArrayBuffer);
        
        const newPdf = await PDFDocument.create();
        const mainPageCount = mainPdf.getPageCount();
        const insertPageIndices = insertPdf.getPageIndices();
        
        // Copy pages before insertion point
        if (insertPosition > 0) {
            const beforePages = await newPdf.copyPages(
                mainPdf, 
                Array.from({ length: insertPosition }, (_, i) => i)
            );
            beforePages.forEach(page => newPdf.addPage(page));
        }
        
        // Copy pages from the insert PDF
        const insertedPages = await newPdf.copyPages(insertPdf, insertPageIndices);
        insertedPages.forEach(page => newPdf.addPage(page));
        
        // Copy remaining pages from main PDF
        if (insertPosition < mainPageCount) {
            const afterPages = await newPdf.copyPages(
                mainPdf,
                Array.from({ length: mainPageCount - insertPosition }, (_, i) => i + insertPosition)
            );
            afterPages.forEach(page => newPdf.addPage(page));
        }
        
        const resultPdfBytes = await newPdf.save();
        const blob = new Blob([resultPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setInsertedPdfUrl(url);
    };

    // Format file size to be human readable
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div>
            <h2 className="my-4">PDF Tools</h2>
            <div className="accordion" id="pdfToolsAccordion">
                <div className="accordion-item">
                    <h2 className="accordion-header" id="headingOne">
                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="false" aria-controls="collapseOne">
                            Merge PDFs
                        </button>
                    </h2>
                    <div id="collapseOne" className="accordion-collapse collapse" aria-labelledby="headingOne" data-bs-parent="#pdfToolsAccordion">
                        <div className="accordion-body">
                            <div className="mb-4">
                                <div className="input-group">
                                    <input
                                        type="file"
                                        multiple
                                        accept="application/pdf"
                                        className="form-control"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <button className="btn btn-primary mt-2" onClick={mergePdfs}>Merge PDFs</button>
                                {mergedPdfUrl && (
                                    <a href={mergedPdfUrl} download={`merged_${files[0]?.name?.split('.')[0] || 'merged'}.pdf`} className="btn btn-success mt-2">Download Merged PDF</a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="accordion-item">
                    <h2 className="accordion-header" id="headingTwo">
                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
                            Remove Pages from PDF
                        </button>
                    </h2>
                    <div id="collapseTwo" className="accordion-collapse collapse" aria-labelledby="headingTwo" data-bs-parent="#pdfToolsAccordion">
                        <div className="accordion-body">
                            <div className="mb-4">
                                <div className="input-group">
                                    <input
                                        type="file"
                                        accept="application/pdf"
                                        className="form-control"
                                        onChange={handleSingleFileChange}
                                    />
                                </div>
                                
                                {pageImages.length > 0 && (
                                    <>
                                        <div className="d-flex flex-row overflow-auto my-3 p-2 border rounded" style={{ minHeight: '300px' }}>
                                            {pageImages.map((page, index) => (
                                                <div key={index} className="position-relative mx-2">
                                                    <div 
                                                        className={`position-absolute top-0 end-0 m-1 p-1 rounded-circle ${selectedPages.includes(page.pageNumber) ? 'bg-danger' : 'bg-light'}`}
                                                        style={{ cursor: 'pointer', width: '28px', height: '28px', textAlign: 'center' }}
                                                        onClick={() => togglePageSelection(page.pageNumber)}
                                                    >
                                                        {selectedPages.includes(page.pageNumber) ? '✓' : ''}
                                                    </div>
                                                    <div className="text-center mb-1">Page {page.pageNumber}</div>
                                                    <embed 
                                                        src={page.url} 
                                                        type="application/pdf"
                                                        style={{ width: '520px', height: '500px', border: selectedPages.includes(page.pageNumber) ? '2px solid red' : '1px solid #ddd' }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <div className="mt-2">
                                            <button 
                                                className="btn btn-danger" 
                                                onClick={removeSelectedPages}
                                                disabled={selectedPages.length === 0}
                                            >
                                                Remove Selected Pages ({selectedPages.length})
                                            </button>
                                            
                                            <button 
                                                className="btn btn-primary ms-2" 
                                                onClick={removeNonSelectedPages}
                                                disabled={selectedPages.length === 0}
                                            >
                                                Keep Selected Pages ({selectedPages.length})
                                            </button>
                                            
                                            {modifiedPdfUrl && (
                                                <a 
                                                    href={modifiedPdfUrl} 
                                                    download={`modified_${selectedFile?.name}`} 
                                                    className="btn btn-success ms-2"
                                                >
                                                    Download Modified PDF
                                                </a>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="accordion-item">
                    <h2 className="accordion-header" id="headingThree">
                        <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
                            Insert PDF Between Pages
                        </button>
                    </h2>
                    <div id="collapseThree" className="accordion-collapse collapse" aria-labelledby="headingThree" data-bs-parent="#pdfToolsAccordion">
                        <div className="accordion-body">
                            <div className="mb-3">
                                <label className="form-label">Main PDF</label>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="form-control"
                                    onChange={handleMainPdfChange}
                                />
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label">PDF to Insert</label>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="form-control"
                                    onChange={handleInsertPdfChange}
                                    disabled={!mainPdfFile}
                                />
                            </div>
                            
                            {mainPdfPageImages.length > 0 && (
                                <div className="mb-3">
                                    <label className="form-label">Insert after page:</label>
                                    <select 
                                        className="form-select"
                                        value={insertPosition}
                                        onChange={handleInsertPositionChange}
                                    >
                                        {mainPdfPageImages.map((page) => (
                                            <option key={page.pageNumber} value={page.pageNumber}>
                                                Page {page.pageNumber}
                                            </option>
                                        ))}
                                    </select>
                                    
                                    <div className="d-flex flex-row overflow-auto my-3 p-2 border rounded" style={{ minHeight: '300px' }}>
                                        {mainPdfPageImages.map((page, index) => (
                                            <div key={index} className="position-relative mx-2">
                                                <div className="text-center mb-1">Page {page.pageNumber}</div>
                                                <embed 
                                                    src={page.url} 
                                                    type="application/pdf"
                                                    style={{ 
                                                        width: '200px', 
                                                        height: '280px', 
                                                        border: page.pageNumber === insertPosition ? '2px solid blue' : '1px solid #ddd'
                                                    }}
                                                />
                                                {page.pageNumber === insertPosition && (
                                                    <div className="text-center mt-2 bg-info text-white p-1">
                                                        Insert here ↓
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <button 
                                className="btn btn-primary" 
                                onClick={insertPdfBetweenPages}
                                disabled={!mainPdfFile || !insertPdfFile}
                            >
                                Insert PDF
                            </button>
                            
                            {insertedPdfUrl && (
                                <a 
                                    href={insertedPdfUrl} 
                                    download={`inserted_${mainPdfFile?.name}`} 
                                    className="btn btn-success ms-2"
                                >
                                    Download PDF
                                </a>
                            )}
                        </div>
                    </div>
                </div>
 
            </div>
            <br/><br/><br/>
        </div>
    );
};

export default PdfTools;