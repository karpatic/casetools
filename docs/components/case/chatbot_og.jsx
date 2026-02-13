// CaseBasics.js 
import React from 'react';

const CaseChatBot = ({ config, pickedCase, password, evidence }) => {
    const [conversation, setConversation] = React.useState([]);
    const [inputMsg, setInputMsg] = React.useState("");
    const [resetPrompt, setResetPrompt] = React.useState(""); 
    const [showChat, setShowChat] = React.useState(false);
    const [fullScreen, setFullScreen] = React.useState(false);   
    const [sidePanelVisible, setSidePanelVisible] = React.useState(false);
    const [chatsList, setChatsList] = React.useState([]);
    const [editMessageIndex, setEditMessageIndex] = React.useState(null); // new state for editing
    const floatingButtonStyle = {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        backgroundColor: '#0084ff',
        color: 'white',
        border: 'none',
        cursor: 'pointer',
        zIndex: 1000,
        fontSize: '20px',
    }; 
    const chatWindowStyle = fullScreen ? {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        zIndex: 1000,
        boxShadow: 'none',
        border: 'none',
        borderRadius: '0'
    } : {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '500px', 
        height: '700px',  
        display: 'flex',
        flexDirection: 'column', // ensures header and form remain visible
        border: '1px solid #ccc',
        borderRadius: '10px',
        backgroundColor: '#fff',
        zIndex: 1000,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    };
    const headerStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px',
        borderBottom: '1px solid #ccc',
        backgroundColor: '#f0f0f0'
    };
    const headerButtonStyle = {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '5px'
    };
    const sidePanelStyle = {
        width: '300px',
        overflowY: 'auto',
        borderLeft: '1px solid #ccc',
        padding: '10px',
        backgroundColor: '#fafafa'
    }; 
    const messagesEndRef = React.useRef(null);

    // New: scroll chat container on update.
    React.useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
        }
    }, [conversation]);
    
    const getLegalContext = () => { 
        const { basics } = config || {};
        const { 
            caseFacts = "", 
            attorney = { name: "", phone: "", email: "" }, 
            cover = { cover_name: "", cover_location: "" }, 
            certificate = { certificate_name: "", certificate_location_address: "" }, 
            respondent = { full_name: "", file_numbers: [], status: "" }, 
            judge = { hearing_date: "", hearing_time: "" } 
        } = basics || {};
        const basicsText = `Legal Case Work:
Case Facts: ${caseFacts}.
Attorney: ${attorney?.name} (Phone: ${attorney?.phone}, Email: ${attorney?.email}).
Cover: ${cover?.cover_name}, ${cover?.cover_location}.
Certificate = { certificate_name: "", certificate_location_address: "" }, 
Respondent: ${respondent?.full_name} (File Numbers: ${respondent?.file_numbers.join(", ")}, Status: ${respondent?.status}).
Hearing Date & Time: ${judge?.hearing_date} at ${judge?.hearing_time}.`;

        // Build a summary for evidence by iterating over all items.
        let evidenceSummary = "";
        if (Array.isArray(evidence)) {
            evidenceSummary = evidence.map(item => {
                return `Title: ${item.title}
Type: ${item.type}
AI Opinion: ${item.aiOpinion}
Summary: ${item.summary}`;
            }).join("\n\n");
        }

        return `${resetPrompt}
        
${basicsText}

Evidence Overview:
${evidenceSummary}

Please provide legal analysis and suggestions based on the above information. Note that this chatbot was developed to assist with legal case work.`;
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!inputMsg.trim()) return;
        // If editing, truncate conversation up to the edited message index.
        const baseConversation = editMessageIndex !== null ? conversation.slice(0, editMessageIndex) : conversation;
        const newConv = [...baseConversation, { role: 'user', content: inputMsg }];
        setConversation(newConv);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: pickedCase || 'default', conversation: newConv })
            });
            const data = await response.json();
            const reply = data.reply; 
            setConversation([...newConv, { role: 'assistant', content: reply }]);
            setInputMsg("");
            setEditMessageIndex(null); // clear editing state
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const resetChat = async () => {
        try {
            const res = await fetch('/api/chat/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: pickedCase || 'default' })
            });
            const newSession = await res.json();
            setConversation(newSession.conversation);
            loadChatsList();
            setSidePanelVisible(false); // close side panel after resetting chat
        } catch (error) {
            console.error('Error resetting chat:', error);
        }
    };

    React.useEffect(() => {
        // Prime chat with the legal case context rather than dumping raw JSON.
        setConversation([{ role: 'system', content: getLegalContext() }]);
    }, [config, evidence, resetPrompt]);

    React.useEffect(() => {
        if(pickedCase){
            fetch(`/api/cases/${pickedCase}/chats/latest`)
            .then(res => res.json())
            .then(data => {
                if(data.conversation) setConversation(data.conversation);
            })
            .catch(err => console.error(err));
        }
    }, [pickedCase]);

    const loadChatsList = () => {
        fetch(`/api/cases/${pickedCase}/chats`)
        .then(res => res.json())
        .then(data => setChatsList(data))
        .catch(err => console.error(err));
    };

    const loadChatSession = (fileName) => {
        fetch(`/api/cases/${pickedCase}/chats/${fileName}`)
        .then(res => res.json())
        .then(data => {
            setConversation(data.conversation);
            setSidePanelVisible(false); // close side panel after loading session
        })
        .catch(err => console.error(err));
    };

    const deleteChatSession = (file) => {
        fetch(`/api/cases/${pickedCase}/chats/${file}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => {
            if (res.ok) {
                // Refresh chat list after deletion.
                loadChatsList();
            }
        })
        .catch(err => console.error(err));
    };

    const toggleSidePanel = () => {
        setSidePanelVisible(!sidePanelVisible);
        if (!sidePanelVisible) loadChatsList();
    };

    const preMadeMessages = [
        { label: "Opinion", message: "What are your opinions on the case? Be critical." },
        { label: "Explore", message: "What questions should I be asking my client?" },
        { label: "SWOT", message: "Please perform a SWOT analysis." },
        { label: "Research", message: "What information would help to know more about?" },
        { label: "Deep Research", message: "I want to use [OpenAI](https://chat.openai.com) to perform deep research. Can you help me create a prompt for this task? First perform a SWOT analysis on the exising evidence and then present to me three questions I could benefit ask chatgpt to perform deep research on." }
    ];
    const insertPreMadeMessage = (msg) => {
        setInputMsg(msg);
    }; 

    const handleEdit = (index, content) => { // new helper to start editing a message
        setEditMessageIndex(index);
        setInputMsg(content);
    };

    return (
        <>
            {!showChat && (
                <button style={floatingButtonStyle} onClick={() => setShowChat(true)}>
                    Chat
                </button>
            )}
            {showChat && (
                <div style={chatWindowStyle} className={`chat-window${fullScreen ? '-full-screen' : ''}`}>
                    <div style={headerStyle}>
                        <button style={headerButtonStyle} onClick={() => setShowChat(false)}>
                            Collapse
                        </button>
                        <button 
                            style={headerButtonStyle} 
                            onClick={() => setFullScreen(!fullScreen)}>
                            {fullScreen ? "Exit FS" : "Full Screen"}
                        </button>
                        <button style={headerButtonStyle} onClick={toggleSidePanel}>
                            ...
                        </button>
                    </div>
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>  {/* changed code: added overflow: 'hidden' */}
                        <div 
                          ref={messagesEndRef}
                          style={{ flex: 1, overflowY: 'auto', padding: '10px', backgroundColor: '#e5ddd5' }}>
                            {conversation.map((msg, i) => {
                                if (msg.role === 'system') return null;
                                if (msg.role === 'user') {
                                    return (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', margin: '5px 0' }}>
                                            <button 
                                                onClick={() => handleEdit(i, msg.content)}
                                                style={{ marginRight: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                                                ✎
                                            </button>
                                            <div 
                                                style={{ 
                                                    backgroundColor: '#0084ff', 
                                                    color: 'white', 
                                                    alignSelf: 'flex-end', 
                                                    padding: '10px', 
                                                    borderRadius: '18px', 
                                                    maxWidth: '70%', 
                                                    marginLeft: 'auto' 
                                                }}
                                                dangerouslySetInnerHTML={{ __html: window.marked.marked(msg.content) }}>
                                            </div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div 
                                            key={i} 
                                            style={{ 
                                                backgroundColor: '#f0f0f0', 
                                                color: 'black', 
                                                alignSelf: 'flex-start', 
                                                margin: '5px 0', 
                                                padding: '10px', 
                                                borderRadius: '18px', 
                                                maxWidth: '70%' 
                                            }}
                                            dangerouslySetInnerHTML={{ __html: window.marked.marked(msg.content) }}>
                                        </div>
                                    );
                                }
                            })}
                            {conversation.length === 1 && (
                                <div style={{ padding: '10px', textAlign: 'center', background: '#fffbe6' }}>
                                    {preMadeMessages.map((item, idx) => (
                                        <button 
                                            key={idx} 
                                            onClick={() => insertPreMadeMessage(item.message)}
                                            style={{ margin: '5px', padding: '8px 12px', cursor: 'pointer' }}>
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {sidePanelVisible && (
                            <div style={sidePanelStyle}>
                                <h4>Chat Sessions</h4>
                                <div>
                                    <input
                                        type="text"
                                        value={resetPrompt}
                                        onChange={(e) => setResetPrompt(e.target.value)}
                                        placeholder="New Chat About:"
                                        style={{ width: '100%', padding: '5px', marginBottom: '5px' }}
                                    />
                                    <button
                                        onClick={resetChat}
                                        style={{ width: '100%', padding: '8px', backgroundColor: '#ff5050', color: 'white', border: 'none', cursor: 'pointer' }}
                                    >
                                        Reset Chat
                                    </button>
                                </div>
                                <hr/>
                                <ul style={{ listStyleType: 'none', padding: 0 }}>
                                    {chatsList.map((file, idx) => (
                                        <li key={idx} style={{ marginBottom: '5px', display: 'flex', alignItems: 'center' }}>
                                            <button
                                                onClick={() => loadChatSession(file)}
                                                style={{ flex: 1, padding: '8px', textAlign: 'left', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' }}
                                            >
                                                {file}
                                            </button>
                                            <button
                                                onClick={() => deleteChatSession(file)}
                                                style={{ marginLeft: '5px', padding: '8px', backgroundColor: '#ff5050', color: 'white', border: 'none', cursor: 'pointer' }}
                                            >
                                                Delete
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                    <form onSubmit={sendMessage} style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
                        <input 
                            style={{ flex: 1, border: 'none', padding: '10px', fontSize: '16px' }}
                            type="text" 
                            value={inputMsg} 
                            onChange={(e) => setInputMsg(e.target.value)}
                            placeholder="Type your message..."
                        />
                        <button type="submit" style={{ border: 'none', backgroundColor: '#0084ff', color: 'white', padding: '10px 15px', cursor: 'pointer' }}>
                            Send
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};

export default CaseChatBot;