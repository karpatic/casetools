import { callChatGPT } from './gpt.js';
import ocr from './../pdf/ocr.js';
import localforage from 'localforage';

async function processMessage(conversation) {
  try { 
    const response = await callChatGPT(conversation, true); // Pass true to get JSON response
    return response;
  } catch (error) {
    console.error("Error processing message:", error);
    return {
      chatmessage: "Sorry, I encountered an error processing your request.",
      data: null
    };
  }
}

async function extractTextFromEvidence(evidenceObj, progressCallback = null) {
  // Check if the text is already extracted
  let desiredOutput = evidenceObj?.extractedText;
  
  // Only perform OCR if extractedText doesn't exist
  if (!desiredOutput) {
    const evidenceStorageKey = evidenceObj?.storageKey || "";  
    const evidence = await localforage.getItem(evidenceStorageKey); 
    console.log('Extracting text from evidence', { evidence });
    
    // Perform OCR with progress reporting
    const tesseractOutput = await ocr(evidence, progressCallback);
    
    // Process the OCR output
    desiredOutput = tesseractOutput.map(item => {  
      const sentenceObj = item.lines.map(line => { 
        const { text, bbox } = line;
        return { text, bbox, page: item.page };
      });
      return sentenceObj;
    });
  }
  
  return desiredOutput;
}
 
export { processMessage, extractTextFromEvidence };
