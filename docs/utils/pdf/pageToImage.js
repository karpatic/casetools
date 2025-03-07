import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc =
  "https:///mozilla.github.io/pdf.js/build/pdf.worker.mjs"; 

async function pdfPageToImage(file, page = 0) { 
    // create a file reader
    const reader = new FileReader();

    const imgAsync = new Promise((resolve, reject) => {
        reader.onload = (e) => {
            resolve(e.target.result);
        };

        reader.onerror = (error) => {
            reject(error);
        };

        // Read the uploaded file as an ArrayBuffer
        reader.readAsArrayBuffer(file);
    });

    try {
        const arrayBuffer = await imgAsync;
        const uint8Array = new Uint8Array(arrayBuffer); 
        const loadingTask = getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise; 
        const pdfPage = await pdf.getPage(page + 1);

        const viewport = pdfPage.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await pdfPage.render({ canvasContext: context, viewport }).promise;

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error loading PDF document:', error);
        throw new Error(`Failed to convert PDF page to image: ${error.message}`);
    }
}

export { pdfPageToImage };
