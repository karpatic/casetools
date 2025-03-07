import React from 'react';
import { PDFDocument } from 'pdf-lib';

const PdfTools = () => {
    const [files, setFiles] = React.useState([]);
    const [mergedPdfUrl, setMergedPdfUrl] = React.useState(null);

    const handleFileChange = (event) => {
        setFiles([...event.target.files]);
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
                                    <a href={mergedPdfUrl} download="merged.pdf" className="btn btn-success mt-2">Download Merged PDF</a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <br/><br/><br/>
        </div>
    );
};

export default PdfTools;