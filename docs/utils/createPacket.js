import {createTableOfContentsYaml, createCaseMetadataYaml} from './createTableOfContents.js'; 
import pdfMerge from './pdf/merge.js';
import {sanitizeForKey} from './utils.js';
import localforage from 'localforage';  
import numberPages from './pdf/numberPages.js';


// todo: add filesize as a metadata attribute. 
// todo: modulo an accumulator in the table display and default sort by sortId.

async function createPacket(selectedCase, pickedCase, packetKey) {     
         
    // Step 0. Metadata - Creates Yaml needed for the TOC, Certificate, and Cover Page
    const config = selectedCase.basics;
    const packetConfig = selectedCase?.[packetKey];    
    let text = `---${createCaseMetadataYaml(config, packetConfig)}---`;
    // console.log('CaseMetadataYaml:\n', text) 

    // Step 1. Create the Certificate, and Cover
    let getPdfFromResponse = async (response) => {
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error from Pandoc server:', errorText);
            throw new Error(`Pandoc conversion failed: ${response.statusText}`);
        }  
        return response.blob();
    }

    // Step 1A. CERTIFICATE - Creates certificate.pdf      
    const PANDOC_URL = 'https://getfrom.net/pdf/pandoc'
    let latex = await fetch('rsc/latex/certificate.tex').then(res => res.text()); 
    let resp = await fetch(PANDOC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, latex }),
    });  
    const certificatePdf = await getPdfFromResponse(resp);  // Blob {size: 69041, type: 'application/pdf'}    

    // // Step 1B. COVER
    latex = await fetch('rsc/latex/cover.tex').then(res => res.text()); 
    let resptwo = await fetch(PANDOC_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, latex }),
    });
    const coverPdf = await getPdfFromResponse(resptwo);
    const coverPdfBytes = await coverPdf.arrayBuffer();
    

    // Step 2: Prepare all files first 
 
    const evidence = selectedCase.evidence; 
    
    // Step 2A. Filter
    const packetNumber = parseInt(packetKey.split('_')[1]);  
    const filteredEvidence = evidence.filter(e => parseInt(e.evidencePacket) == packetNumber);

    // Step 2B. Sort
    filteredEvidence.sort((a, b) => a.sortId - b.sortId); 

    let currentPage = parseInt(packetConfig.startPage || 1);
    const startLetterIndex = letterToIndex(packetConfig?.startLetter || 'A');  

    // Step 2C. Prepare the files. File Size Check is done here.
    const exhibitList = [];
    let currentChunkSize = 0;
    currentPage = parseInt(packetConfig.startPage || 1);
    for (let i = 0; i < filteredEvidence.length; i++) {
        const evidence = filteredEvidence[i];
        const letter = generateColumnLetter(startLetterIndex + i);
        
        // Get and number the PDF file
        const localForageFileLabel = `${pickedCase}_${sanitizeForKey(evidence.fileName)}`;
        // Check for markup version first
        const markupFileLabel = localForageFileLabel.replace(/\.pdf$/, "_markup.pdf");
        let pdfFile = await localforage.getItem(markupFileLabel);
        
        // If markup doesn't exist, fall back to the original file
        if (!pdfFile) {
            pdfFile = await localforage.getItem(localForageFileLabel);
        }
        
        const pdfBytes = await pdfFile.arrayBuffer();
        const numberedPdfBytes = await numberPages(pdfBytes, currentPage);
        
        // Get and merge with letter file
        const letterFile = await fetch(`./rsc/letters/${letter}.pdf`).then(res => res.blob());
        const letterFileBytes = await new Response(letterFile).arrayBuffer();
        const preparedExhibit = await pdfMerge([letterFileBytes, numberedPdfBytes]);

        // Check if the exhibit is too large
        const size = (await preparedExhibit.save()).length;
        // if (currentChunkSize + size > 26214400) { // 25MB chunk size
        //     const sizeInMB = (currentChunkSize + size) / (1024 * 1024);
        //     alert('Evidence packet is too large. Please reduce the number of exhibits.' + sizeInMB.toFixed(2) + ' MB');
        //     // return { error: 'Evidence packet is too large. Please reduce the number of exhibits.' };
        // }
        currentChunkSize += size;

        const pages = parseInt(evidence.pages || 1);
        const endPage = currentPage + pages - 1;
        const exhibit = {
            exhibit: await preparedExhibit.save(),
            letter,
            title: evidence.title,
            pageRange: currentPage == endPage ? `${currentPage}` : `${currentPage} - ${endPage}`
        };
        
        exhibitList.push(exhibit);
        currentPage += pages;
    }  

    // Step 3. Create the final PDF

    // Step 3A. Create the TOC
    text = createTableOfContentsYaml(config, exhibitList, packetConfig); 
    console.log('TableOfContentsYaml:\n', text)
    latex = await fetch('rsc/latex/toc.tex').then(res => res.text());   
    let response = await fetch(PANDOC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, latex })
    });
    const tocPdf = await getPdfFromResponse(response);
    const tocPdfBytes = await tocPdf.arrayBuffer();


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
    const count = letter.length;
    return 26 * (count - 1) + (letter.charCodeAt(0) - 65);
}

function generateColumnLetter(index) {
    // For index 0-25 -> A-Z, 26-51 -> AA, BB, ... etc.
    const reps = Math.floor(index / 26) + 1;
    const letter = String.fromCharCode(65 + (index % 26));
    return letter.repeat(reps);
}