import { callChatGPT } from './gpt.js';  

async function processMessage(conversation) {
  try { 
    const response = await callChatGPT(conversation, true);
    return response;
  } catch (error) {
    console.error("Error processing message:", error);
    return {
      chatmessage: "Sorry, I encountered an error processing your request.",
      data: null
    };
  }
}

// Compose the prompt for GPT based on case details and evidence
function composePrompt(caseName, legalContext, evidenceObj = null, extractedText = null) {
    let prompt = ` 

  You are the legal assistant for an attorney. 
  You will help with a case that that we will refer to as the '${caseName}' case: 
  You are having a conversation with the user about the case.

  You return a json object with the following the format below:

  {
        chatmessage: "A chat message for the user."
  }
 
  Here is the following information about the case:

  ${legalContext} 
  `;

    // Add document-specific instructions if we have an evidence object
    if (evidenceObj && extractedText) {
      const rawText = JSON.stringify(extractedText);
      prompt += ` 

  Today you have been tasked specifically with discussing and marking up a pdf document.

  Tesseract.js was used to capture the bounding box and text of each line in the pdf.

  You will use this information to help the user find quotes that are relevant to the case.

  When the users asks you to 'mark up' the pdf or 'mark it up', return a json object with the following format:

  {
        chatmessage: "A chat message for the user.",
        data: [
          { y1: 0, x1: 0, x2: 0, text: "Line one of a sentence that", page: 1 },
          { y1: 0, x1: 0, x2: 0, text: "goes on to two lines.", page: 1 }
        ]
  }
  
  Markup Instructions:

  1. You only return the data attribute if the user has specifically asked you to 'mark it up'. 
  
  2. the data list your return must include the quotes previously approved for mark up.

  3. It is common for quotes to span multiple entries in the json object array. In this case, you should return every entry in the json object array that is part of the quote.

  The documents name is: 
  
  ${evidenceObj.fileName}

  Here are the quotes already approved for mark up:

  ${JSON.stringify(evidenceObj.extractedSelections)}
  
  Here is the full text of the document in a json object array format:

  ${rawText}

  `;
    }

  return prompt;
}

function getPreMadeMessages(markupFilename) {
  return markupFilename
    ? [
        {
          label: "Quotes",
          message: "Give me the best quotes supporting the case.",
        },
        {
          label: "Markup",
          message: `Markup the document for the best supporting quotes.`,
        },
        { label: "Questions", message: "Summarize this document." },
      ]
    : [
        {
          label: "Opinion",
          message: "What are your opinions on the case? Be critical.",
        },
        {
          label: "Explore",
          message: "What questions should I be asking my client?",
        },
        { label: "SWOT", message: "Please perform a SWOT analysis." },
        {
          label: "Research",
          message: "What information would help to know more about?",
        },
        {
          label: "Deep Research",
          message:
            "I want to use [OpenAI](https://chat.openai.com) to perform deep research. Can you help me create a prompt for this task? First perform a SWOT analysis on the existing evidence and then present to me three questions I could benefit asking ChatGPT to perform deep research on.",
        },
      ];
}

// Get legal context from case details
function getLegalContext(cases, pickedCaseName) {
  const pickedCase = cases[pickedCaseName];
  const { basics } = pickedCase || {};
  const {
    caseFacts = "",
    attorney = { name: "", phone: "", email: "" },
    cover = { cover_name: "", cover_location: "" },
    certificate = { certificate_name: "", certificate_location_address: "" },
    respondent = { full_name: "", file_number: "", status: "" },
    judge = { hearing_date: "", hearing_time: "" },
  } = basics || {};
  const basicsText = `
  Legal Case Work:
  Case Facts: ${caseFacts}.
  Attorney: ${attorney?.name} (Phone: ${attorney?.phone}, Email: ${attorney?.email}).
  Cover: ${cover?.cover_name}, ${cover?.cover_location}.
  Certificate = { certificate_name: "", certificate_location_address: "" }, 
  Respondent: ${respondent?.full_name} (File Number: ${respondent?.file_number}, Status: ${respondent?.status}).
  Hearing Date & Time: ${judge?.hearing_date} at ${judge?.hearing_time}.
  `;
  const evidence = pickedCase?.evidence || [];
  // Build a summary for evidence by iterating over all items.
  let evidenceSummary =
    evidence
      ?.map((item) => {
        return `
  Title: ${item.title}
  Type: ${item.type}
  AI Opinion: ${item.aiOpinion}
  Summary: ${item.summary}
  `;
      })
      .join("\n\n") || "";

  const finalPrompt = `        
  ${basicsText}

  Evidence Overview:
  ${evidenceSummary}
  `;
  return finalPrompt;
} 

export { processMessage, composePrompt, getPreMadeMessages, getLegalContext };
