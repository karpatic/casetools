// CaseBasics.js
import React from "react";
import { processMessage, composePrompt, getPreMadeMessages, getLegalContext } from "./../../utils/gpt/chatbot.js"; 
import { markupDocument, extractTextFromEvidence} from "../../utils/pdf/markup.js";
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

  // Add useEffect to open chat when markupFilename changes
  React.useEffect(() => {
    // Check if markupFilename exists and changed (not first render)
    if (markupFilename) {
      setShowChat(true);
    }
  }, [markupFilename]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    // If editing, truncate conversation up to the edited message index.
    const baseConversation = editMessageIndex == null ? conversation : conversation.slice(0, editMessageIndex)
    const newConv = [...baseConversation, { role: "user", content: inputMsg }];
    setConversation(newConv);
    setIsLoading(true); 
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

    // Mark up the document if the response contains data
    if (response.data) { 
 
      let updatedCases = { ...cases }; 
      let evidenceIndex = cases[pickedCaseName].evidence.findIndex((item) => item.fileName == markupFilename);
      let evidenceObj = { ...cases[pickedCaseName].evidence[evidenceIndex], extractedSelections: response.data };
      await markupDocument(evidenceObj); 
      updatedCases[pickedCaseName].evidence[evidenceIndex] = evidenceObj; 
      setCases(updatedCases);
    } 
    setInputMsg("");
    setEditMessageIndex(null); 
    setIsLoading(false); 
  };
  
  // Get or extract text from evidence with progress tracking 
  // Update the case state with extracted text
  const getExtractedText = async (evidenceObj) => {
    let extractedText = evidenceObj?.extractedText; 
    if (!extractedText) { 
      setExtractionProgress({ isExtracting: true, progress: 0 });
      setPageProgress(null); 
      extractedText = await extractTextFromEvidence(
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
    const legalContext = getLegalContext(cases, pickedCaseName); 
    let finalPrompt;
    let evidenceObj = null;
    let extractedText = null;
    // Handle document markup case
    if (markupFilename) {
      console.log("CaseChatBot resetChat", pickedCase.evidence);
      evidenceObj = pickedCase.evidence.find( (item) => item.fileName == markupFilename ); 
      extractedText = await getExtractedText(evidenceObj);  
    }  
    finalPrompt = composePrompt(pickedCaseName, legalContext, evidenceObj, extractedText); 
    setConversation([{ role: "system", content: finalPrompt }]);
    setInputMsg("");
    setEditMessageIndex(null);
  };

  React.useEffect(() => {
    resetChat();
  }, [pickedCaseName, markupFilename]);

  // Get pre-made messages from the utility function
  const preMadeMessages = getPreMadeMessages(markupFilename);

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
                      : "Please wait. Extracting text from document at ~8 seconds a page..."}
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
