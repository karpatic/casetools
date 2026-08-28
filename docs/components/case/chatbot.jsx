// CaseBasics.js
import React from "react";
import { processMessage, suggestMarkupHighlights, composePrompt, getPreMadeMessages, getLegalContext } from "./../../utils/gpt/chatbot.js";
import { markupDocument, extractTextFromEvidence, updateEvidenceMarkupMetadata } from "../../utils/pdf/markup.js";

function normalizeSuggestion(rawSelection, index) {
  if (!rawSelection || typeof rawSelection !== "object") return null;

  const pageNumber = Number(rawSelection.page ?? rawSelection.pageNumber);
  const text = typeof rawSelection.text === "string"
    ? rawSelection.text.replace(/\s+/g, " ").trim()
    : "";

  if (!Number.isInteger(pageNumber) || pageNumber <= 0 || !text) {
    return null;
  }

  const normalized = {
    ...rawSelection,
    page: pageNumber,
    pageNumber,
    text,
    source: rawSelection.source || "ai-highlight",
  };

  if (rawSelection.bbox && typeof rawSelection.bbox === "object") {
    const bbox = {
      x0: Number(rawSelection.bbox.x0),
      y0: Number(rawSelection.bbox.y0),
      x1: Number(rawSelection.bbox.x1),
      y1: Number(rawSelection.bbox.y1),
    };
    if ([bbox.x0, bbox.y0, bbox.x1, bbox.y1].every(Number.isFinite)) {
      normalized.bbox = bbox;
      normalized.x1 = bbox.x0;
      normalized.x2 = bbox.x1;
      normalized.y1 = bbox.y0;
    }
  } else {
    normalized.x1 = Number(rawSelection.x1);
    normalized.x2 = Number(rawSelection.x2);
    normalized.y1 = Number(rawSelection.y1);
  }

  const hasBbox = normalized.bbox &&
    [normalized.bbox.x0, normalized.bbox.y0, normalized.bbox.x1, normalized.bbox.y1].every(Number.isFinite);
  const hasLegacyCoordinates = [normalized.x1, normalized.x2, normalized.y1].every(Number.isFinite);

  if (!hasBbox && !hasLegacyCoordinates) {
    return null;
  }

  const textKey = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return {
    ...normalized,
    reviewId: `suggestion-${index}-${pageNumber}-${textKey}`,
  };
}

function normalizeSuggestions(response) {
  const data = Array.isArray(response?.data) ? response.data : [];
  return data
    .map(normalizeSuggestion)
    .filter(Boolean);
}

const CaseChatBot = ({ pickedCaseName, markupFilename, cases, setCases, setMarkupFilename = () => {} }) => {
  const [conversation, setConversation] = React.useState([]);
  const [inputMsg, setInputMsg] = React.useState("");
  const [showChat, setShowChat] = React.useState(false);
  const [fullScreen, setFullScreen] = React.useState(false);
  const [editMessageIndex, setEditMessageIndex] = React.useState(null);
  const messagesEndRef = React.useRef(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [extractionProgress, setExtractionProgress] = React.useState({ isExtracting: false, progress: 0 });
  const [pageProgress, setPageProgress] = React.useState(null);
  const [suggestions, setSuggestions] = React.useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = React.useState({});
  const [reviewMessage, setReviewMessage] = React.useState("");
  const [reviewStatus, setReviewStatus] = React.useState("");
  const [reviewError, setReviewError] = React.useState("");
  const [isApplying, setIsApplying] = React.useState(false);

  React.useEffect(() => {
    if (messagesEndRef.current)
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
  }, [conversation]);

  const resetReviewState = () => {
    setSuggestions([]);
    setSelectedSuggestions({});
    setReviewMessage("");
    setReviewStatus("");
    setReviewError("");
    setIsLoading(false);
    setIsApplying(false);
    setExtractionProgress({ isExtracting: false, progress: 0 });
    setPageProgress(null);
  };

  React.useEffect(() => {
    if (markupFilename) {
      resetReviewState();
      setShowChat(true);
    }
  }, [markupFilename]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    const baseConversation = editMessageIndex == null ? conversation : conversation.slice(0, editMessageIndex);
    const newConv = [...baseConversation, { role: "user", content: inputMsg }];
    setConversation(newConv);
    setIsLoading(true);
    const response = await processMessage(newConv);
    console.log("CaseChatBot sendMessage response", { tet: response });
    setConversation([
      ...newConv,
      {
        role: "assistant",
        content: response.chatmessage,
        data: response.data,
      },
    ]);

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
    const legalContext = getLegalContext(cases, pickedCaseName);
    const finalPrompt = composePrompt(pickedCaseName, legalContext);
    setConversation([{ role: "system", content: finalPrompt }]);
    setInputMsg("");
    setEditMessageIndex(null);
  };

  React.useEffect(() => {
    if (!markupFilename) {
      resetChat();
    }
  }, [pickedCaseName, markupFilename]);

  const getMarkupEvidence = () => (
    cases[pickedCaseName]?.evidence?.find((item) => item.fileName == markupFilename)
  );

  const generateHighlightSuggestions = async () => {
    const evidenceObj = getMarkupEvidence();
    if (!evidenceObj) {
      setReviewError("Could not find this document in the current case.");
      return;
    }

    setSuggestions([]);
    setSelectedSuggestions({});
    setReviewMessage("");
    setReviewError("");
    setReviewStatus(evidenceObj.extractedText ? "Using saved extracted text..." : "Extracting text from the PDF...");
    setIsLoading(true);

    try {
      const extractedText = await getExtractedText(evidenceObj);
      setReviewStatus("Asking AI for suggested highlights...");
      const legalContext = getLegalContext(cases, pickedCaseName);
      const response = await suggestMarkupHighlights(pickedCaseName, legalContext, evidenceObj, extractedText);
      const rawSuggestionCount = Array.isArray(response?.data) ? response.data.length : 0;
      const nextSuggestions = normalizeSuggestions(response);
      const nextSelected = {};
      nextSuggestions.forEach((suggestion) => {
        nextSelected[suggestion.reviewId] = true;
      });

      setSuggestions(nextSuggestions);
      setSelectedSuggestions(nextSelected);
      setReviewMessage(response?.chatmessage || "");
      setReviewStatus(nextSuggestions.length
        ? `Found ${nextSuggestions.length} suggested highlight${nextSuggestions.length === 1 ? "" : "s"}.`
        : rawSuggestionCount
          ? "AI returned suggestions, but none included usable page and coordinate data."
        : "No suggested highlights were found.");
    } catch (error) {
      console.error("Could not generate highlight suggestions:", error);
      setReviewError(error?.message || "Could not generate suggested highlights.");
      setReviewStatus("");
    } finally {
      setIsLoading(false);
      setExtractionProgress({ isExtracting: false, progress: 0 });
      setPageProgress(null);
    }
  };

  const toggleSuggestion = (reviewId) => {
    setSelectedSuggestions((prev) => ({
      ...prev,
      [reviewId]: !prev[reviewId],
    }));
  };

  const getApprovedSuggestions = () => (
    suggestions
      .filter((suggestion) => selectedSuggestions[suggestion.reviewId])
      .map(({ reviewId, ...selection }) => selection)
  );

  const applyApprovedHighlights = async () => {
    const approvedSuggestions = getApprovedSuggestions();
    if (approvedSuggestions.length === 0) {
      setReviewError("Select at least one suggested highlight before applying.");
      return;
    }

    const evidenceObj = getMarkupEvidence();
    if (!evidenceObj) {
      setReviewError("Could not find this document in the current case.");
      return;
    }

    setReviewError("");
    setReviewStatus("Applying approved highlights...");
    setIsApplying(true);

    try {
      const evidenceWithMarkup = updateEvidenceMarkupMetadata(evidenceObj, approvedSuggestions);
      await markupDocument(evidenceWithMarkup);
      setCases((prevCases) => {
        const pickedCase = prevCases[pickedCaseName];
        return {
          ...prevCases,
          [pickedCaseName]: {
            ...pickedCase,
            evidence: pickedCase.evidence.map((item) =>
              item.fileName === markupFilename
                ? updateEvidenceMarkupMetadata(item, approvedSuggestions)
                : item
            ),
          },
        };
      });
      setSuggestions([]);
      setSelectedSuggestions({});
      setReviewMessage("");
      setReviewStatus(`Applied ${approvedSuggestions.length} approved highlight${approvedSuggestions.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Could not apply approved highlights:", error);
      setReviewError(error?.message || "Could not apply approved highlights.");
      setReviewStatus("");
    } finally {
      setIsApplying(false);
    }
  };

  const closeMarkupPanel = () => {
    resetReviewState();
    setShowChat(false);
    setFullScreen(false);
    setMarkupFilename(null);
  };

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
        flexDirection: "column",
        border: "1px solid #ccc",
        borderRadius: "10px",
        backgroundColor: "#fff",
        zIndex: 1000,
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      };
    }
  };
  const chatWindowStyle = getChatWindowStyle();

  const getReviewWindowStyle = () => {
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
      };
    }

    return {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      width: "min(460px, calc(100vw - 32px))",
      maxHeight: "calc(100vh - 40px)",
      display: "flex",
      flexDirection: "column",
      border: "1px solid #ced4da",
      borderRadius: "8px",
      backgroundColor: "#fff",
      zIndex: 1000,
      boxShadow: "0 2px 10px rgba(0,0,0,0.18)",
    };
  };

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

  const selectedCount = suggestions.filter((suggestion) => selectedSuggestions[suggestion.reviewId]).length;
  const markupEvidence = markupFilename ? getMarkupEvidence() : null;

  if (markupFilename) {
    return (
      <>
        {showChat && (
          <div style={getReviewWindowStyle()} className="ai-highlight-review-panel">
            <div className="d-flex align-items-start justify-content-between border-bottom bg-light p-2">
              <div className="pe-2" style={{ minWidth: 0 }}>
                <div className="small text-muted">AI highlight review</div>
                <div className="fw-semibold text-truncate" title={markupFilename}>
                  {markupFilename}
                </div>
              </div>
              <div className="btn-group btn-group-sm" role="group" aria-label="Review panel controls">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setFullScreen(!fullScreen)}
                >
                  {fullScreen ? "Exit" : "Expand"}
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={closeMarkupPanel}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-3 overflow-auto" style={{ flex: 1 }}>
              {!markupEvidence && (
                <div className="alert alert-warning mb-3" role="alert">
                  This document is no longer available in the current case.
                </div>
              )}

              <p className="small text-muted mb-3">
                Generate suggested supporting highlights, review them, then apply only the ones you approve.
              </p>

              {extractionProgress.isExtracting && (
                <div className="alert alert-info py-2 mb-3" role="status">
                  {pageProgress
                    ? `Extracting text from page ${pageProgress[1]} of ${pageProgress[0]}...`
                    : "Extracting text from the PDF..."}
                </div>
              )}

              {!extractionProgress.isExtracting && reviewStatus && (
                <div className="alert alert-info py-2 mb-3" role="status">
                  {reviewStatus}
                </div>
              )}

              {reviewError && (
                <div className="alert alert-danger py-2 mb-3" role="alert">
                  {reviewError}
                </div>
              )}

              {reviewMessage && (
                <div className="small text-muted mb-3">
                  {reviewMessage}
                </div>
              )}

              {suggestions.length === 0 && !isLoading ? (
                <div className="border rounded p-3 text-muted small">
                  No suggestions are waiting for review.
                </div>
              ) : suggestions.length > 0 ? (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-semibold">Suggested quotes</div>
                    <div className="small text-muted">
                      {selectedCount} selected
                    </div>
                  </div>
                  <div className="list-group">
                    {suggestions.map((suggestion) => (
                      <label
                        key={suggestion.reviewId}
                        htmlFor={suggestion.reviewId}
                        className="list-group-item list-group-item-action d-flex gap-2 align-items-start"
                      >
                        <input
                          id={suggestion.reviewId}
                          className="form-check-input mt-1"
                          type="checkbox"
                          checked={!!selectedSuggestions[suggestion.reviewId]}
                          onChange={() => toggleSuggestion(suggestion.reviewId)}
                          disabled={isApplying}
                        />
                        <span style={{ minWidth: 0 }}>
                          <span className="badge text-bg-secondary me-2">Page {suggestion.page}</span>
                          <span>{suggestion.text}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-top p-2 d-flex flex-wrap gap-2 justify-content-end">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={generateHighlightSuggestions}
                disabled={!markupEvidence || isLoading || isApplying}
              >
                {suggestions.length ? "Regenerate suggestions" : "Generate suggested highlights"}
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={applyApprovedHighlights}
                disabled={!suggestions.length || selectedCount === 0 || isLoading || isApplying}
              >
                {isApplying ? "Applying..." : "Apply approved highlights"}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={closeMarkupPanel}
                disabled={isLoading || isApplying}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

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
