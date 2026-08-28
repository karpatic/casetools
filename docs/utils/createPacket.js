import {createTableOfContentsYaml, createCaseMetadataYaml} from './createTableOfContents.js'; 
import pdfMerge from './pdf/merge.js';
import localforage from 'localforage';  
import numberPages from './pdf/numberPages.js';
import fitPdfToLetter from './pdf/fitToLetter.js';
import { preflightEvidenceFiles } from './evidenceStorageKeys.js';
import { createTemplatePdfCompiler } from './pdftex/templatePdfCompiler.js';
import {
    compilePacketFrontMatterPdfs,
    compilePacketTableOfContentsPdf,
} from './pdftex/packetTemplatePdfs.js';


// todo: add filesize as a metadata attribute. 
// todo: modulo an accumulator in the table display and default sort by sortId.

async function createPacket(selectedCase, pickedCase, packetKey) {     
         
    // Step 0. Metadata - Creates Yaml needed for the TOC, Certificate, and Cover Page
    const config = selectedCase.basics;
    const packetConfig = selectedCase?.[packetKey];    
    let text = `---${createCaseMetadataYaml(config, packetConfig)}---`;
    // console.log('CaseMetadataYaml:\n', text) 

    // Step 0A. Evidence preflight - fail before expensive Pandoc calls if a browser-stored PDF is missing.
    const preparedEvidenceFiles = await preflightEvidenceFiles(
        selectedCase,
        pickedCase,
        packetKey,
        key => localforage.getItem(key),
    );

    // Step 1. Create the Certificate, and Cover
    // Step 1A. CERTIFICATE - Creates certificate.pdf      
    const PANDOC_URL = 'https://getfrom.net/pdf/pandoc'
    const templateCompiler = createTemplatePdfCompiler({ pandocUrl: PANDOC_URL });
    const { certificatePdf, coverPdf } = await compilePacketFrontMatterPdfs({
        compiler: templateCompiler,
        config,
        packetConfig,
        metadataPandocText: text,
    });
    const coverPdfBytes = await coverPdf.arrayBuffer();
    

    // Step 2: Prepare all files first 
 
    let currentPage = parseInt(packetConfig.startPage || 1);
    const startLetterIndex = letterToIndex(packetConfig?.startLetter || 'A');  

    // Step 2C. Prepare the files. File Size Check is done here.
    const exhibitList = [];
    let currentChunkSize = 0;
    currentPage = parseInt(packetConfig.startPage || 1);
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
    const tocPdf = await compilePacketTableOfContentsPdf({
        compiler: templateCompiler,
        config,
        packetConfig,
        contents: exhibitList,
        tableOfContentsPandocText: text,
    });
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
