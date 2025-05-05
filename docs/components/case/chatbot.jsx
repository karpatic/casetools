// CaseBasics.js
import React from "react";
import {
  processMessage,
  extractTextFromEvidence,
} from "./../../utils/gpt/chatbot.js";
import localforage from "localforage";

const CaseChatBot = ({ pickedCaseName, markupFilename, cases, setCases }) => {
  const [conversation, setConversation] = React.useState([]);
  const [inputMsg, setInputMsg] = React.useState("");
  const [showChat, setShowChat] = React.useState(false);
  const [fullScreen, setFullScreen] = React.useState(false);
  const [editMessageIndex, setEditMessageIndex] = React.useState(null);
  const messagesEndRef = React.useRef(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [extractionProgress, setExtractionProgress] = React.useState({ isExtracting: false, progress: 0 });
  const [pageProgress, setPageProgress] = React.useState(null);
  
  React.useEffect(() => {
    if (messagesEndRef.current)
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
  }, [conversation]);

  // returns parts of the final prompt text.
  const getLegalContext = () => {
    const pickedCase = cases[pickedCaseName];
    // console.log('CaseChatBot getLegalContext', { pickedCase, pickedCaseName });
    const { basics } = pickedCaseName || {};
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
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    // If editing, truncate conversation up to the edited message index.
    const baseConversation =
      editMessageIndex !== null
        ? conversation.slice(0, editMessageIndex)
        : conversation;
    const newConv = [...baseConversation, { role: "user", content: inputMsg }];
    setConversation(newConv);
    setIsLoading(true);
    try {
      const response = await processMessage(newConv);
      console.log("CaseChatBot sendMessage response", { tet: response });
      // Store both the chat message and any structured data in the conversation
      setConversation([
        ...newConv,
        {
          role: "assistant",
          content: response.chatmessage,
          data: response.data,
        },
      ]);

      // Update the cases state with the new evidence if it exists
      if (response.data) {
        const updatedCases = {
          ...cases,
          [pickedCaseName]: {
            ...cases[pickedCaseName],
            evidence: cases[pickedCaseName].evidence.map((item) => {
              if (item.fileName === markupFilename) {
                return { ...item, extractedSelections: response.data };
              }
              return item;
            }),
          },
        };
        setCases(updatedCases);
      }

      setInputMsg("");
      setEditMessageIndex(null);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to extract text with progress tracking
  const extractTextWithProgress = async (evidenceObj) => {
    setExtractionProgress({ isExtracting: true, progress: 0 });
    setPageProgress(null);
    const extractedText = await extractTextFromEvidence(
      evidenceObj,
      (progress, pageInfo) => {
        setExtractionProgress((prev) => ({ isExtracting: true, progress }));
        if (pageInfo && pageInfo.totalPages) {
          setPageProgress([pageInfo.totalPages, pageInfo.currentPage]);
        }
      }
    );
    setExtractionProgress({ isExtracting: false, progress: 0 });
    setPageProgress(null);
    return extractedText;
  };

  // Get or extract text from evidence - updates state if extraction is needed
  const getExtractedText = async (evidenceObj) => {
    let extractedText = evidenceObj.extractedText;
    if (!extractedText) {
      extractedText = await extractTextWithProgress(evidenceObj);
      const updatedEvidence = { ...evidenceObj, extractedText };
      const pickedCase = cases[pickedCaseName];
      const updatedCases = {
        ...cases,
        [pickedCaseName]: {
          ...pickedCase,
          evidence: pickedCase.evidence.map((item) =>
            item.fileName === evidenceObj.fileName ? updatedEvidence : item
          ),
        },
      };
      setCases(updatedCases);
    }
    return extractedText;
  };

  const resetChat = async () => {
    const pickedCase = cases[pickedCaseName];
    console.log("CaseChatBot resetChat: ", { pickedCase, markupFilename });
    let finalPrompt = `
You are the legal assistant for an attorney. 
You will help with a case that that we will referr to as the '${pickedCaseName}' case: 
You are having a conversation with the user about the case.

You return a json object with the following the format below:

{
      chatmessage: "A chat message for the user."
}

Here is the following information about the case:

${getLegalContext()}
`;
    if (markupFilename) {
      console.log("CaseChatBot resetChat", pickedCase.evidence);
      const evidenceObj = pickedCase.evidence.find(
        (item) => item.fileName == markupFilename
      );
      const extractedSelections = evidenceObj?.extractedSelections || "None";

      // Update the evidence object with extracted text.
      const extractedText = await getExtractedText(evidenceObj);
      const rawText = JSON.stringify(extractedText);

      finalPrompt += `

Today you have been tasked specifically with discussing and marking up a document.

The document will be given to you as an array of json objects containing the text and bounding box coordinates of each line of text.

You will talk with the user about potential quotes that could be used in the case.

When the users asks you to perform the 'mark up', or to 'mark it up', you will return a filtered list of the json objects.

Your response will be in the following format:

{
      chatmessage: "A chat message for the user.",
      data: [
        { y1: 0, x1: 0, x2: 0, phrase: "Line one of a sentence that", page: 1 },
        { y1: 0, x1: 0, x2: 0, phrase: "goes on to two lines.", page: 1 }
      ]
}
If a quote spans multiple lines, include all lines.

You will never return the data attribute unless the user has asked you to 'mark it up', which you can remind them to do.

The documents name is: 

${markupFilename}

Here is the text of the document in a json object array format:

${rawText}


`;
    }
    setConversation([{ role: "system", content: finalPrompt }]);
    setInputMsg("");
    setEditMessageIndex(null);
  };

  React.useEffect(() => {
    resetChat();
  }, [pickedCaseName, markupFilename]);

  const preMadeMessages = markupFilename
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
  const insertPreMadeMessage = (msg) => {
    setInputMsg(msg);
  };

  const handleEdit = (index, content) => {
    setEditMessageIndex(index);
    setInputMsg(content);
  };

  const floatingButtonStyle = {
    position: "fixed",
    bottom: "30px",
    right: "30px",
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    backgroundColor: "#0084ff",
    color: "white",
    border: "none",
    cursor: "pointer",
    zIndex: 1000,
    fontSize: "20px",
  };

  const getChatWindowStyle = () => {
    if (fullScreen) {
      return {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#fff",
        zIndex: 1000,
        boxShadow: "none",
        border: "none",
        borderRadius: "0",
      };
    } else {
      return {
        position: "fixed",
        bottom: "30px",
        right: "30px",
        width: "500px",
        height: "700px",
        display: "flex",
        flexDirection: "column", // ensures header and form remain visible
        border: "1px solid #ccc",
        borderRadius: "10px",
        backgroundColor: "#fff",
        zIndex: 1000,
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      };
    }
  };
  const chatWindowStyle = getChatWindowStyle();

  const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px",
    borderBottom: "1px solid #ccc",
    backgroundColor: "#f0f0f0",
  };

  const headerButtonStyle = {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    padding: "5px",
  };

  return (
    <>
      {!showChat && (
        <button style={floatingButtonStyle} onClick={() => setShowChat(true)}>
          Chat
        </button>
      )}
      {showChat && (
        <div
          style={chatWindowStyle}
          className={`chat-window${fullScreen ? "-full-screen" : ""}`}
        >
          <div style={headerStyle}>
            <button
              style={headerButtonStyle}
              onClick={() => setShowChat(false)}
            >
              Collapse
            </button>
            <button
              style={headerButtonStyle}
              onClick={() => setFullScreen(!fullScreen)}
            >
              {fullScreen ? "Exit FS" : "Full Screen"}
            </button>
            <button style={headerButtonStyle} onClick={resetChat}>
              Reset
            </button>
          </div>
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            <div
              ref={messagesEndRef}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px",
                backgroundColor: "#e5ddd5",
              }}
            >
              {conversation.map((msg, i) => {
                if (msg.role === "system") return null;
                if (msg.role === "user") {
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        margin: "5px 0",
                      }}
                    >
                      <button
                        onClick={() => handleEdit(i, msg.content)}
                        style={{
                          marginRight: "10px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "16px",
                        }}
                      >
                        ✎
                      </button>
                      <div
                        style={{
                          backgroundColor: "#0084ff",
                          color: "white",
                          alignSelf: "flex-end",
                          padding: "10px",
                          borderRadius: "18px",
                          maxWidth: "70%",
                          marginLeft: "auto",
                        }}
                        dangerouslySetInnerHTML={{
                          __html: window.marked.marked(msg.content),
                        }}
                      ></div>
                    </div>
                  );
                } else {
                  return (
                    <div
                      key={i}
                      style={{
                        backgroundColor: "#f0f0f0",
                        color: "black",
                        alignSelf: "flex-start",
                        margin: "5px 0",
                        padding: "10px",
                        borderRadius: "18px",
                        maxWidth: "70%",
                      }}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: window.marked.marked(msg.content),
                        }}
                      ></div>
                      {msg.data && (
                        <div
                          style={{
                            marginTop: "5px",
                            padding: "4px 8px",
                            backgroundColor: "#e0f7fa",
                            borderRadius: "4px",
                            fontSize: "12px",
                            display: "inline-block",
                          }}
                        >
                          Contains structured data
                        </div>
                      )}
                    </div>
                  );
                }
              })}
              {conversation.length === 1 && (
                <div
                  style={{
                    padding: "10px",
                    textAlign: "center",
                    background: "#fffbe6",
                  }}
                >
                  {preMadeMessages.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => insertPreMadeMessage(item.message)}
                      style={{
                        margin: "5px",
                        padding: "8px 12px",
                        cursor: "pointer",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Add loading indicator */}
              {isLoading && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "10px",
                    fontStyle: "italic",
                  }}
                >
                  Processing...
                </div>
              )}

              {/* Simplified extraction progress indicator - only shows page information */}
              {extractionProgress.isExtracting && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "10px",
                    backgroundColor: "#f8f9fa",
                    margin: "10px 0",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ fontWeight: "bold" }}>
                    {pageProgress
                      ? `Extracting text from page ${pageProgress[1]} of ${pageProgress[0]}...`
                      : "Extracting text from document..."}
                  </div>
                </div>
              )}
            </div>
          </div>
          <form
            onSubmit={sendMessage}
            style={{ display: "flex", borderTop: "1px solid #ccc" }}
          >
            <input
              style={{
                flex: 1,
                border: "none",
                padding: "10px",
                fontSize: "16px",
              }}
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading || extractionProgress.isExtracting}
            />
            <button
              type="submit"
              style={{
                border: "none",
                backgroundColor: "#0084ff",
                color: "white",
                padding: "10px 15px",
                cursor:
                  isLoading || extractionProgress.isExtracting
                    ? "not-allowed"
                    : "pointer",
                opacity: isLoading || extractionProgress.isExtracting ? 0.7 : 1,
              }}
              disabled={isLoading || extractionProgress.isExtracting}
            >
              {isLoading ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default CaseChatBot;
