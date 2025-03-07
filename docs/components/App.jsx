import React from 'react';
import ReactDOM from 'react-dom'; 
import localforage from 'localforage';
import CaseBasics from './case/basics.jsx';
import EvidencePackets from './evidence/packets.jsx';
import PdfTools from './PdfTools.jsx';

localforage.config({
    driver: localforage.INDEXEDDB,
    name: 'case-helper',
    version: 1.1,
    storeName: 'cases',
});

const App = () => {
    const [cases, setCases] = React.useState(null);         // { caseName: { config: {}, evidence: [] } }
    const [pickedCase, setPickedCase] = React.useState(() => localStorage.getItem('pickedCase') );  
    const [loading, setLoading] = React.useState(null); 
    const [newCaseName, setNewCaseName] = React.useState('');
    const [apiKey, setApiKey] = React.useState(() => localStorage.getItem('apiKey') || '');

    const getCases = async () => {
        try {
            const storedCases = await localforage.getItem('cases');
            console.log('storedCases:', storedCases);
            if(!storedCases) {
                setCases({});
                setLoading(false);
                await localforage.setItem('cases', {});
                return
            }
            setCases(storedCases);
            // Auto-select if there's only one case
            const caseNames = Object.keys(storedCases);
            if (caseNames.length === 1 && !pickedCase) {
                setPickedCase(caseNames[0]);
                localStorage.setItem('pickedCase', caseNames[0]);
            } else if (!pickedCase || !storedCases[pickedCase]) {
                setPickedCase('');
                localStorage.removeItem('pickedCase');
            }
            setLoading(false);
        } catch (error) {
            console.error("Error retrieving cases from localforage:", error);
        }
    };

    React.useEffect(() => getCases(), []);

    const createCase = () => {
        if (!newCaseName.trim() || cases[newCaseName]) return;  
        setCases(prevCases => {
            const newCases = {
                ...prevCases,
                [newCaseName]: {}
            };
            // Auto-select if it's the first case
            if (Object.keys(prevCases).length === 0) {
                setPickedCase(newCaseName);
                localStorage.setItem('pickedCase', newCaseName);
            }
            return newCases;
        });
        setNewCaseName('');
    };

    // Add effect to save cases to localforage whenever it changes
    React.useEffect(() => {
        if (cases) {
            localforage.setItem('cases', cases);
        }
    }, [cases]);
 
    const deleteCase = (caseName) => {
        if (window.confirm(`Are you sure you want to delete "${caseName}"?`)) {
            const newCases = JSON.parse(JSON.stringify(cases));
            const currentEvidence = newCases[pickedCase].evidence;
            currentEvidence.forEach(e => {
                const fileKey = `${pickedCase}_${sanitizeForKey(e.fileName)}`;
                localforage.removeItem(fileKey);
            });
            const compiledPacketKey = `compiled_case_${currentCase}_packet_${packetKey}`;
            localforage.removeItem(compiledPacketKey);

            delete newCases[caseName];
            setCases(newCases); 

            if (pickedCase === caseName) {
                setPickedCase('');
                localStorage.removeItem('pickedCase');
            }
        }
    };

    const handleCaseClick = (caseName) => {
        setPickedCase(caseName);
        localStorage.setItem('pickedCase', caseName);
    };

    const handleApiKeyChange = (e) => {
        const newApiKey = e.target.value;
        setApiKey(newApiKey);
        localStorage.setItem('apiKey', newApiKey);
    };

    if (!cases || loading) {
        return <div className="container">Loading...</div>;
    }

    return (
        <div className="container">
            <div>
                <h1 className="my-4">Karpati Law - Case Tools</h1>
                <div className="mb-4">  
                    <div className="input-group mt-2">
                        <input
                            type="password"
                            className="form-control"
                            placeholder="API Key"
                            value={apiKey}
                            onChange={handleApiKeyChange}
                        />
                    </div>
                </div> 
                <div className="mb-4"> 
                    <h2 className="my-4">What is this?</h2>
                    <p>"Karpati Law - Case Tools" offers legal workers an AI integrated dashboard to help them with their work.</p>
                    <p><b>Evidence Packet Preparation</b></p>
                    <ul> 
                        <li>Fill a form to autogenerate your <b>Cover Pages and Certificate of Service:</b></li>
                        <li>Automatically/ manually create and sort titles for your <b>Table Of Contents</b>.</li>
                        <li>Automatically <b>numbers each page</b> and inserts '<b>exhibit xyz</b>' pages.</li>
                        <li>Merges all files in sequence to create the final <b>Evidence Packet</b></li>
                    </ul>                    
                    <p><b>Misc</b></p>
                    <ul> 
                        <li><b>PDF Tools:</b> Merge Pdfs Quick.</li>
                        <li><b>ChatBot:</b> Talk to a chatbot that knows about your case</li>
                    </ul>
                    <p>To get started, enter your chatGPT ApiKey below then create a new case! Be aware: Data and Uploaded files live in your browser and only gets sent to OpenAI's ChatGPT to service the app (nowhere else).</p>
                </div>
                <div className="mb-4"> 
                    <div className="input-group">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="New case name"
                            value={newCaseName}
                            onChange={(e) => setNewCaseName(e.target.value)}
                        />
                        <button className="btn btn-success" onClick={createCase}>Create New Case</button>
                    </div> 
                </div> 
                <h1 className="my-4">Select A Case</h1>
                <div className="list-group" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {cases && Object.keys(cases).map(c => (
                        <div key={c} className="d-flex align-items-center mb-2">
                            <button
                                className={`list-group-item list-group-item-action flex-grow-1 ${pickedCase === c ? 'active' : ''}`}
                                style={{
                                    backgroundColor: `${pickedCase === c ? '#cfe2ff' : ''}`,
                                    color: `black`,
                                }}
                                onClick={() => handleCaseClick(c)}
                            >
                                {c}
                            </button>
                            {pickedCase === c && (
                                <button 
                                    className="btn btn-danger ms-2"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteCase(c);
                                    }}
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div> 
            {pickedCase && (
                <div>
                    <h1 className="my-4">Case Information</h1>
                    <div className="mb-4"> 
                            <CaseBasics 
                                cases={cases} 
                                setCases={setCases} 
                                pickedCase={pickedCase}  
                            /> 
                    </div>
                    <h1 className="my-4">Packet Manager</h1>
                    <div className="mb-4"> 
                            <EvidencePackets
                                cases={cases}
                                setCases={setCases}
                                pickedCase={pickedCase}
                            /> 
                    </div>
                </div>
            ) }
            <PdfTools></PdfTools>
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
