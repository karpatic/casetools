import fs from 'fs/promises';
// rename the file to have a lowercase extension
async function pdfLowerCase(filePath) {
    // use a regex to replace any combination of .pdf or .PDF with .pdf
    let newFilePath = filePath.replace(/\.[pP][dD][fF]/, '.pdf'); 
    await fs.rename(filePath, newFilePath); 
    return newFilePath;
}

export default pdfLowerCase;