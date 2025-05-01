import React from 'react';
import ReactDOM from 'react-dom'; 
import localforage from 'localforage';
import JSZip from 'jszip';
// /* Components */
import CaseBasics from './case/basics.jsx';
import EvidencePackets from './evidence/packets.jsx';
import PdfTools from './PdfTools.jsx'; 
import { sanitizeForKey } from './../utils/utils.js';
// localforage.clear().then(() => {
//     console.log('All data cleared from localforage');
// }).catch((err) => {
//     console.error('Error clearing localforage:', err);
// });
// localStorage.clear()

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
    const fileInputRef = React.useRef();
 
    const getCases = async () => { 
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
            const currentCase = newCases[caseName];
            const currentEvidence = currentCase.evidence;
            currentEvidence?.forEach(e => {
                const fileKey = `${pickedCase}_${sanitizeForKey(e.fileName)}`;
                localforage.removeItem(fileKey);
            });
            // Delete compiled packets
            const packetKeys = Object.keys(currentCase).filter(k => k.startsWith('packet_'));
            packetKeys.forEach(packetKey => {
                const compiledPacketKey = `compiled_case_${pickedCase}_packet_${packetKey}`;
                localforage.removeItem(compiledPacketKey);
            }); 

            delete newCases[caseName];
            setCases(newCases); 

            if (pickedCase === caseName) {
                setPickedCase('');
                localStorage.removeItem('pickedCase');
            }
        }
    };

    const uploadCase = async (event) => {
        const file = event.target.files[0];
        if (!file || !file.name.endsWith('.zip')) {
            alert('Please select a valid case zip file');
            return;
        }

        try {
            const zip = await JSZip.loadAsync(file);
            
            // Find and read the JSON file first
            const jsonFile = Object.keys(zip.files).find(name => name.endsWith('.json'));
            if (!jsonFile) throw new Error('No case configuration found');
            
            const caseName = jsonFile.replace('.json', '').split('/').pop();
            
            // if (cases[caseName]) {
            //     alert(`Case "${caseName}" already exists`);
            //     return;
            // }

            const caseData = JSON.parse(await zip.files[jsonFile].async('text'));

            // console.log('UploadCase', caseData)  
            console.log(zip.files)
            console.log(Object.keys(zip.files))

            // Load evidence files 
            if (caseData.evidence.length > 0) {
                for (const e of caseData.evidence) {
                    // `${file.name.replace('.zip','')}/` + 
                    const filePath = `evidence/${e.fileName}`;
                    if (zip.files[filePath]) { 
                        const sanitizedFilename = sanitizeForKey(e.fileName);
                        const fileKey = `${caseName}_${sanitizedFilename}`;
                        const fileBlob = await zip.files[filePath].async('arraybuffer');
                        const mimeType = e.fileName.toLowerCase().endsWith('.pdf')
                            ? 'application/pdf'
                            : 'application/octet-stream';
                        const formattedBlob = new Blob([fileBlob], { type: mimeType });
                        console.log('Saving:', fileKey);
                        await localforage.setItem(fileKey, formattedBlob);

                        // Update evidence with additional metadata
                        e.storageKey = fileKey;
                        e.fileSize = formattedBlob.size;
                    } else {
                        console.log('File not found in zip:', filePath);
                    }
                }
            }



            // Load packet files
            const packetFolders = Object.keys(zip.files)
                .filter(path => path.startsWith('evidencePacket_') && !path.includes('/'));
            
            for (const packetKey of packetFolders) {
                const certFile = zip.files[`${packetKey}/certificate.pdf`];
                const evidenceFile = zip.files[`${packetKey}/evidence.pdf`];
                
                if (certFile && evidenceFile) {
                    const compiledPacket = {
                        certificatePdf: await certFile.async('blob'),
                        evidencePacketPdf: await evidenceFile.async('blob')
                    };
                    const compiledPacketKey = `compiled_case_${caseName}_${packetKey}`;
                    console.log('Saving compiledPacketKey:', compiledPacketKey);
                    await localforage.setItem(compiledPacketKey, compiledPacket);
                }
            }

            // Update cases state
            setCases(prev => ({
                ...prev,
                [caseName]: caseData
            }));

            // Auto-select if it's the first case
            if (Object.keys(cases).length === 0) {
                setPickedCase(caseName);
                localStorage.setItem('pickedCase', caseName);
            }

            event.target.value = '';
        } catch (error) {
            console.error("Error uploading case:", error);
            alert("Failed to upload zip. Check console for details.");
        }
    };

    const downloadCase = async (casename) => { 
            const caseData = cases[casename];
            if (!caseData) return;

            const zip = new JSZip(); 

            // Save case config as JSON
            zip.file(`${casename}.json`, JSON.stringify(caseData, null, 2)); 

            // Save evidence files
            const evidence = caseData.evidence;
            if (evidence) {
                const evidenceFolder = zip.folder("evidence");
                for (let i = 0; i < evidence.length; i++) {
                    const e = evidence[i];
                    const fileKey = `${casename}_${sanitizeForKey(e.fileName)}`;
                    const file = await localforage.getItem(fileKey);
                    if (file) {
                        const mimeType = e.fileName.toLowerCase().endsWith('.pdf')
                            ? 'application/pdf'
                            : file.type || 'application/octet-stream';
                        const fileBlob = new Blob([await file.arrayBuffer()], { type: mimeType });
                        evidenceFolder.file(e.fileName, fileBlob);
                    }
                }
            }

            // Save compiled packets
            const packetKeys = Object.keys(caseData).filter(k => k.startsWith('evidencePacket_'));
            console.log('packetKeys:', packetKeys);
            for (let i = 0; i < packetKeys.length; i++) {
                const packetKey = packetKeys[i];
                const packetFolder = zip.folder(packetKey);
                const compiledPacketKey = `compiled_case_${casename}_${packetKey}`;
                const compiledPacket = await localforage.getItem(compiledPacketKey);
                if (compiledPacket) {
                    let { certificatePdf, evidencePacketPdf } = compiledPacket;
                    certificatePdf = new Blob([await certificatePdf.arrayBuffer()]);
                    evidencePacketPdf = new Blob([await evidencePacketPdf.arrayBuffer()]);
                    packetFolder.file(`certificate.pdf`, certificatePdf);
                    packetFolder.file(`evidence.pdf`, evidencePacketPdf);
                }
            }

            console.log('zip:', zip);
            // Generate and download zip
            const blob = await zip.generateAsync({type: "blob"});
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${casename}_case.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url); 
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
                    <p>To get started, provide an OpenAi API Key and create a new case! Be aware: Data and Uploaded files live in your browser and only gets sent to OpenAI's ChatGPT to service the app (nowhere else).</p>
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
                        <button 
                            className="btn btn-primary" 
                            onClick={() => fileInputRef.current.click()}
                        >
                            Upload Zip
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".zip"
                            style={{ display: 'none' }}
                            onChange={uploadCase}
                        />
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
                                <>
                                    <button 
                                        className="btn btn-primary ms-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadCase(c);
                                        }}
                                    >
                                        Download
                                    </button>
                                    <button 
                                        className="btn btn-danger ms-2"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteCase(c);
                                        }}
                                    >
                                        Delete
                                    </button>
                                </>
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
