// EvidencePackets.jsx

import React from 'react'; 
import localforage from 'localforage';
import showToast from './../showToast.js'; 
import EvidenceTable from './table.jsx';
import CaseChatBot from './../case/chatbot.jsx';
import sortTableOfContents from './../../utils/gpt/sortTableOfContents.js'; 
import createPacket from '../../utils/createPacket.js';

const EvidencePackets = ({ cases, setCases, pickedCase }) => {
    const [newPacket, setNewPacket] = React.useState({
        startPage: '',
        startLetter: '',
        sortInstructions: '',
        titleInstructions: '',
        packetTitle: ''
    }); 
    const [currentCase, setCurrentCase] = React.useState(cases[pickedCase] || {}); 
    const [activeTab, setActiveTab] = React.useState(null); 
    const [packetData, setPacketData] = React.useState(null);

    React.useEffect(() => { 
        setCurrentCase(cases[pickedCase] || {});
    }, [pickedCase]);

    React.useEffect(() => {
        const savedPacketKey = localStorage.getItem('selectedEvidencePacket');
        if (savedPacketKey && cases[pickedCase] && cases[pickedCase][savedPacketKey]) {
            setActiveTab(savedPacketKey);
            setNewPacket(cases[pickedCase][savedPacketKey]);
        }
        else{
            setActiveTab(null);
        }
    }, [cases, pickedCase]);
    
    React.useEffect(() => {
        // contains packetData.{certificatePdf, evidencePacketPdf}
        const fetchPacketData = async () => {
            if (activeTab && !['new', 'upload'].includes(activeTab)) { 
                const compiledPacketKey = `compiled_case_${pickedCase}_${activeTab}`;
                const data = await localforage.getItem(compiledPacketKey);
                // console.log('~~~~~~ datadatadatadatadata :', data);
                setPacketData(data);
            } else {
                setPacketData(null);
            }
        };
        fetchPacketData();
    }, [activeTab, currentCase]);

    const addnewPacket = () => {
        console.log('addnewPacket:', newPacket);
        const packetNumber = cases[pickedCase] && Object.keys(cases[pickedCase]).filter(key => key.startsWith('evidencePacket_')).length + 1;
        
        const newCases = JSON.parse(JSON.stringify(cases));
        newCases[pickedCase][`evidencePacket_${packetNumber}`] = newPacket;
        setCases(newCases);
        setCurrentCase(newCases[pickedCase]);
        
        setNewPacket({
            startPage: '',
            startLetter: '',
            sortInstructions: '',
            titleInstructions: '',
            packetTitle: ''
        }); 
    };

    const savePacket = (packetKey) => {
        console.log('savePacket:', packetKey);
        
        setCases(prevCases => ({
            ...prevCases,
            [pickedCase]: {
                ...prevCases[pickedCase],
                [packetKey]: newPacket
            }
        }));
        
        showToast('Packet saved');
        const response = {}
    };

    const editPacket = (packetKey) => {
        // if it is the current tab, then unset the editing packet
        if (activeTab === packetKey) {
            setActiveTab(null);
            localStorage.removeItem('selectedEvidencePacket');
            return;
        }
        setNewPacket(cases[pickedCase][packetKey]);
        setActiveTab(packetKey);
        localStorage.setItem('selectedEvidencePacket', packetKey);
    };

    const handleCreateNewPacket = () => {
        if(activeTab === 'new') {
            setActiveTab(null);
            return;
        }
        setNewPacket({
            startPage: '',
            startLetter: '',
            sortInstructions: '',
            titleInstructions: '',
            packetTitle: '' // Reset packetTitle
        }); 
        setActiveTab('new');
    }; 

    const sortEvidencePacket = async (packetKey) => {
        try {
            const sortedEvidence = await sortTableOfContents(currentCase.evidence, currentCase[packetKey].sortInstructions);
            // console.log('sortedEvidence:', sortedEvidence); 
            // Update parent cases state directly with the sorted evidence
            const newCases = JSON.parse(JSON.stringify(cases));
            newCases[pickedCase].evidence = sortedEvidence;
            setCases(newCases);
            showToast('Evidence sorted'); 
        } catch (error) {
            console.error('Error sorting evidence:', error);
        }
    };

    const createPacketHandler = async (packetKey) => {
        console.log('createPacketStateHandler:', packetKey); 

        // packetResult = { certificatePdf: Blob {size: 69041, type: 'application/pdf'}, evidencePacketPdf: Blob }
        const packetResult = await createPacket(cases[pickedCase], pickedCase, packetKey); 
        
        // Save to localForage
        const compiledPacketKey = `compiled_case_${pickedCase}_${packetKey}`;
        console.log('createPacketHandler:', {compiledPacketKey});
        await localforage.setItem(compiledPacketKey, packetResult);
 

        showToast('Packet created'); 
        setActiveTab(null);
        setTimeout(() => setActiveTab(packetKey), 0);
 
    };  

    const deletePacket = (packetKey) => { 
        if (window.confirm(`Are you sure you want to delete ${packetKey}? This action cannot be undone.`)) { 
            let newCases = JSON.parse(JSON.stringify(cases)); 
            delete newCases[pickedCase][packetKey] 
            setCases(newCases)
            setCurrentCase(newCases[pickedCase]);
            setActiveTab(null);
            localStorage.removeItem('selectedEvidencePacket');
            showToast('Packet deleted');
        }
    };
 
    console.log('activeTab:', activeTab);


    return (
        <div> 
            <ul className="nav nav-tabs">
                {Object.keys(currentCase).filter(key => key.startsWith('evidencePacket_')).map((packetKey, index) => (
                    <li className="nav-item" key={index}>
                        <button className={`nav-link ${activeTab === packetKey ? 'active' : ''}`} onClick={() => editPacket(packetKey)}>
                            {packetKey}
                        </button>
                    </li>
                ))}
                <li className="nav-item">
                    <button className={`nav-link ${activeTab === 'new' ? 'active' : ''}`} onClick={handleCreateNewPacket}>
                        Create New Packet
                    </button>
                </li> 
            </ul>
            <div className="tab-content mt-3">
                {Object.keys(currentCase).filter(key => key.startsWith('evidencePacket_')).map((packetKey, index) => (
                    <div key={index} className={`tab-pane fade ${activeTab === packetKey ? 'show active' : ''}`}>
                        <form className="mb-4">
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Packet Title:</label> 
                                <input type="text" className="form-control" name="packetTitle" value={newPacket.packetTitle} onChange={e => setNewPacket({ ...newPacket, packetTitle: e.target.value })} />
                                <button 
                                    type="button" 
                                    className="btn btn-danger ms-2" 
                                    onClick={() => deletePacket(packetKey)}
                                    title="Delete this packet"
                                >
                                    <i className="bi bi-trash"></i> Delete
                                </button>
                            </div>
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Start Page:</label>
                                <input type="text" className="form-control" name="startPage" value={newPacket.startPage} onChange={e => setNewPacket({ ...newPacket, startPage: e.target.value })} />
                            </div>
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Start Letter:</label>
                                <input type="text" className="form-control" name="startLetter" value={newPacket.startLetter} onChange={e => setNewPacket({ ...newPacket, startLetter: e.target.value })} />
                            </div> 
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Title Instructions:</label>
                                <textarea className="form-control" name="titleInstructions" value={newPacket.titleInstructions} onChange={e => setNewPacket({ ...newPacket, titleInstructions: e.target.value })} style={{height : '160px' }} />
                            </div>
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Sort Instructions:</label>
                                <textarea className="form-control" name="sortInstructions" value={newPacket.sortInstructions} onChange={e => setNewPacket({ ...newPacket, sortInstructions: e.target.value })} style={{height : '160px' }} />
                            </div>
                            <button type="button" className="btn btn-secondary" onClick={() => savePacket(packetKey)}>Save Changes</button>
                            <button type="button" className="btn btn-primary ms-2" onClick={() => sortEvidencePacket(packetKey)}>Sort Evidence</button>
                            <button type="button" className="btn btn-success ms-2" onClick={() => createPacketHandler(packetKey)}>Compile</button>
 

                        </form>
                    </div>
                ))} 
                {activeTab === 'new' && (
                    <div className="tab-pane fade show active">
                        <form className="mb-4">
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Packet Title:</label> 
                                <input type="text" className="form-control" name="packetTitle" value={newPacket.packetTitle} onChange={e => setNewPacket({ ...newPacket, packetTitle: e.target.value })} />
                            </div>
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Start Page:</label>
                                <input type="text" className="form-control" name="startPage" value={newPacket.startPage} onChange={e => setNewPacket({ ...newPacket, startPage: e.target.value })} />
                            </div>
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Start Letter:</label>
                                <input type="text" className="form-control" name="startLetter" value={newPacket.startLetter} onChange={e => setNewPacket({ ...newPacket, startLetter: e.target.value })} />
                            </div>
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Title Instructions:</label>
                                <textarea className="form-control" name="titleInstructions" value={newPacket.titleInstructions} onChange={e => setNewPacket({ ...newPacket, titleInstructions: e.target.value })} style={{height : '160px' }} />
                            </div>
                            <div className="mb-3 d-flex align-items-center">
                                <label className="form-label me-2">Sort Instructions:</label>
                                <textarea className="form-control" name="sortInstructions" value={newPacket.sortInstructions} onChange={e => setNewPacket({ ...newPacket, sortInstructions: e.target.value })} style={{height : '160px' }} />
                            </div>
                            <button type="button" className="btn btn-secondary" onClick={addnewPacket}>Add New Packet</button>
                        </form>
                    </div>
                )}
                {activeTab !== 'upload' && activeTab !== 'new' && packetData && (
                    <details className="mt-4">
                        <summary>
                            <h4 style={{display:'inline'}}>Compiled Packet Preview</h4>
                        </summary>
                        <div className="breakout">
                            <div className="breakoutContainer"> 
                                {packetData.evidencePacketPdf &&  
                                    <div className='iframeContainer'>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h5>Final Packet</h5>
                                            <a 
                                                href={URL.createObjectURL(packetData.evidencePacketPdf)} 
                                                download={`${activeTab}_toc.pdf`}
                                                className="btn btn-primary btn-sm"
                                            >
                                                Download
                                            </a>
                                        </div>
                                        <iframe src={URL.createObjectURL(packetData.evidencePacketPdf)}
                                            title={`Final Packet`} />
                                    </div>
                                }
                                {packetData.certificatePdf && (
                                    <div className='iframeContainer'>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <h5>Certificate Page</h5>
                                            <a 
                                                href={URL.createObjectURL(packetData.certificatePdf)} 
                                                download={`${activeTab}_certpage.pdf`}
                                                className="btn btn-primary btn-sm"
                                            >
                                                Download
                                            </a>
                                        </div>
                                        <iframe src={URL.createObjectURL(packetData.certificatePdf)}
                                            title="Certificate Page" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </details>
                )} 
                <div className="tab-pane fade show active"> 
                    <EvidenceTable
                        cases={cases}
                        setCases={setCases}
                        pickedCase={pickedCase} 
                    />
                </div>
            </div> 
            {pickedCase && cases[pickedCase] && (
                <CaseChatBot 
                    pickedCase={cases[pickedCase]}
                    pickedCaseName={pickedCase} 
                />
            )}
            <style>{` 
                .nav-link.active {
                    --bs-nav-tabs-link-active-bg : #cfe2ff;  
                }
                .breakout {
                    width: calc(100vw - 16px); 
                    position: relative;
                    left: 50%;
                    margin-left: -50vw;
                }
                .breakoutContainer{ 
                    width: webkit-fill-available;
                    margin: 0 auto;
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 2rem;

                }
                .iframeContainer {
                    width: 100%;
                    max-width:1100px; 
                }
                .iframeContainer > iframe {
                  width:100%;
                  height: 1200px;
                }
                @media (max-width: 1300px) {
                    .iframeContainer {
                        width: 90%;
                    } 
                }
            `}</style>
        </div>
    );
};

export default EvidencePackets;