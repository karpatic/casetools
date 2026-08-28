import pdfMerge from './pdf/merge.js';
import localforage from 'localforage';  
import numberPages from './pdf/numberPages.js';
import fitPdfToLetter from './pdf/fitToLetter.js';
import { preflightEvidenceFiles } from './evidenceStorageKeys.js';
import { createCertificatePdfBytes, createCoverPdfBytes, createTableOfContentsPdfBytes } from './pdf/packetDocuments.js';


// todo: add filesize as a metadata attribute. 
// todo: modulo an accumulator in the table display and default sort by sortId.

async function createPacket(selectedCase, pickedCase, packetKey) {     
         
    const config = selectedCase.basics;
    const packetConfig = selectedCase?.[packetKey] || {};

    // Step 0A. Evidence preflight - fail before expensive PDF work if a browser-stored PDF is missing.
    const preparedEvidenceFiles = await preflightEvidenceFiles(
        selectedCase,
        pickedCase,
        packetKey,
        key => localforage.getItem(key),
    );

    // Step 1. Create the Certificate and Cover in the browser.
    const [certificatePdfBytes, coverPdfBytes] = await Promise.all([
        createCertificatePdfBytes(config, packetConfig),
        createCoverPdfBytes(config, packetConfig),
    ]);
    const certificatePdf = new Blob([certificatePdfBytes], { type: 'application/pdf' });
    

    // Step 2: Prepare all files first 
 
    const startPage = parsePositiveInteger(packetConfig.startPage, 1);
    const startLetterIndex = letterToIndex(packetConfig?.startLetter || 'A');  

    // Step 2C. Prepare the files. File Size Check is done here.
    const exhibitList = [];
    let currentChunkSize = 0;
    let currentPage = startPage;
    for (let i = 0; i < preparedEvidenceFiles.length; i++) {
        const { evidence, pdfFile } = preparedEvidenceFiles[i];
        const letter = generateColumnLetter(startLetterIndex + i);
        
        // Number the preflighted PDF file.
        let pdfBytes = await pdfFile.arrayBuffer();

        // Normalize page size BEFORE any overlays (page numbers, etc.)
        if (packetConfig?.fitToSameDimensions) {
            pdfBytes = await fitPdfToLetter(pdfBytes);
        }

        const numberedPdfBytes = await numberPages(pdfBytes, currentPage);
        
        // Get and merge with letter file
        const letterFile = await fetchPdfBlob(`./rsc/letters/${letter}.pdf`, `exhibit tab ${letter}`);
        const letterFileBytes = await new Response(letterFile).arrayBuffer();
        const preparedExhibit = await pdfMerge([letterFileBytes, numberedPdfBytes]);
        const exhibitPdfBytes = await preparedExhibit.save();

        // Check if the exhibit is too large
        const size = exhibitPdfBytes.length;
        // if (currentChunkSize + size > 26214400) { // 25MB chunk size
        //     const sizeInMB = (currentChunkSize + size) / (1024 * 1024);
        //     alert('Evidence packet is too large. Please reduce the number of exhibits.' + sizeInMB.toFixed(2) + ' MB');
        //     // return { error: 'Evidence packet is too large. Please reduce the number of exhibits.' };
        // }
        currentChunkSize += size;

        const pages = parsePositiveInteger(evidence.pages, 1);
        const endPage = currentPage + pages - 1;
        const exhibit = {
            exhibit: exhibitPdfBytes,
            letter,
            title: evidence.title,
            pageRange: currentPage == endPage ? `${currentPage}` : `${currentPage} - ${endPage}`
        };
        
        exhibitList.push(exhibit);
        currentPage += pages;
    }  

    // Step 3. Create the final PDF

    // Step 3A. Create the TOC in the browser.
    const tocPdfBytes = await createTableOfContentsPdfBytes(config, exhibitList, packetConfig);


    // Step 3B. Merge cover and TOC
    const coverTocPdf = await pdfMerge([coverPdfBytes, tocPdfBytes]);
    let finalPdf = await coverTocPdf.save();

    // Step 3C. Merge exhibits
    for (let exhibit of exhibitList) { 
        finalPdf = await ( await pdfMerge([finalPdf, exhibit.exhibit]) ).save();
    }

    return { certificatePdf, evidencePacketPdf: new Blob([finalPdf], { type: 'application/pdf' }) };
}

export default createPacket;
 
 


function letterToIndex(letter) {
    // console.log('letterToIndex');
    // console.log('letter', letter);
    // For pattern: single letter "A" returns 0, "AA" returns 26, "BB" returns 27, etc.
    const normalized = String(letter || 'A').trim().toUpperCase();
    const match = normalized.match(/[A-Z]+/);
    if (!match) return 0;

    const count = match[0].length;
    return 26 * (count - 1) + (match[0].charCodeAt(0) - 65);
}

function generateColumnLetter(index) {
    // For index 0-25 -> A-Z, 26-51 -> AA, BB, ... etc.
    const reps = Math.floor(index / 26) + 1;
    const letter = String.fromCharCode(65 + (index % 26));
    return letter.repeat(reps);
}

function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fetchPdfBlob(path, label) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Could not load ${label} PDF: ${path}`);
    }
    return response.blob();
}
