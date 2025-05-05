// EvidencePackets.jsx
 
import React, { useRef } from 'react';
import { sanitizeForKey } from './../../utils/utils.js';
import {getTitle} from './../../utils/gpt/getTitle.js' 
import EvidenceUpload from './upload.jsx';
import localforage from 'localforage';

// evidence, setEvidence 
const EvidenceTable = ({ cases, setCases, pickedCase, setMarkupFilename }) => { 
    const [evidence, setEvidence] = React.useState(cases[pickedCase]?.evidence || []);
    const [packetNumber, setPacketNumber] = React.useState(Math.max(...Object.keys(cases[pickedCase])
    .filter(key => key.startsWith('evidencePacket_'))
    .map(key => parseInt(key.split('_')[1]))));
    const [searchFilter, setSearchFilter] = React.useState("");  
    const [pdfUrl, setPdfUrl] = React.useState(null);  
    const [showUpload, setShowUpload] = React.useState(false); 
    const tableRef = useRef(null); 

    // update evidence when cases[pickedCase].evidence changes
    React.useEffect(() => {
        setEvidence(cases[pickedCase]?.evidence || []);
    }, [cases[pickedCase]?.evidence]);

    const dateEditor = (cell, onRendered, success, cancel) => {
        const cellValue = cell.getValue() ? cell.getValue().split('/').reverse().join('-') : '';
        const input = document.createElement("input");
        input.setAttribute("type", "date");
        input.style.padding = "4px";
        input.style.width = "100%";
        input.style.boxSizing = "border-box";
        input.value = cellValue;

        onRendered(() => {
            input.focus();
            input.style.height = "100%";
        });

        const onChange = () => {
            if (input.value !== cellValue) {
                success(input.value.split('-').reverse().join('/'));
            } else {
                cancel();
            }
        };

        input.addEventListener("blur", onChange);
        input.addEventListener("keydown", (e) => {
            if (e.keyCode === 13) {
                onChange();
            }
            if (e.keyCode === 27) {
                cancel();
            }
        });

        return input;
    };

    const typeEditor = (cell, onRendered, success, cancel) => {
        const input = document.createElement("select");
        const options = ['personal statement', 'general country conditions', 'expert statement', 'official report', 'newspaper reporting', 'supporting document'];
        options.forEach(option => {
            const optionElement = document.createElement("option");
            optionElement.value = option;
            optionElement.text = option;
            input.appendChild(optionElement);
        });
        input.value = cell.getValue() || 'supporting document';
    
        onRendered(() => {
            input.focus();
            input.style.height = "100%";
        });
    
        const onChange = () => {
            success(input.value);
        };
    
        input.addEventListener("blur", onChange);
        input.addEventListener("change", onChange);
        input.addEventListener("keydown", (e) => {
            if (e.keyCode === 13) {
                onChange();
            }
            if (e.keyCode === 27) {
                cancel();
            }
        });
    
        return input;
    };
    const viewPdf = async (fileName) => {
        try {
            let fname = sanitizeForKey(fileName);
            const fileKey = `${pickedCase}_${fname}`;
            const file = await localforage.getItem(fileKey);
            if (file) {
                const url = URL.createObjectURL(file);
                setPdfUrl(url);
            } else {
                alert('File not found in local storage');
            }
        } catch (error) {
            console.error('Error fetching file from local forage:', error);
            alert('Error fetching file');
        }
    };

    const highlightRowAndColumn = (cell) => {
        const tableElement = document.querySelector("#evidence-table");
        if (!tableElement) return;

        // Remove existing highlights
        tableElement.querySelectorAll(".highlighted-row, .highlighted-column").forEach(el => {
            el.classList.remove("highlighted-row", "highlighted-column");
        });

        // Highlight the row
        const rowElement = cell.getRow().getElement();
        rowElement.classList.add("highlighted-row");

        // Highlight the column
        const columnField = cell.getField();
        tableElement.querySelectorAll(`.tabulator-cell[tabulator-field="${columnField}"]`).forEach(el => {
            el.classList.add("highlighted-column");
        });
    };

    let tabulatorInstance = null; // Replace ref with a variable

    React.useEffect(() => {
        //  item.evidencePacket == packetNumber
        let filteredEvidence = evidence.filter(item => (item.fileName.includes(searchFilter) || item.title.includes(searchFilter)));

        // Initialize Tabulator and store the instance in the variable
        if (!tabulatorInstance) {
            tabulatorInstance = new Tabulator("#evidence-table", {
                data: filteredEvidence,
                renderHorizontal: "virtual",
                maxHeight: "820px",
                maxWidth: "90%",
                columns: [
                    { title: "Packet #", field: "evidencePacket", editor: "input", headerFilter: "input" },
                    { title: "Markup", 
                        field: "markup", 
                        formatter:  (cell) => {
                            const button = document.createElement("button");
                            button.innerHTML = "Markup";
                            button.className = "btn btn-secondary btn-sm";
                            button.onclick = async () => {
                                const row = cell.getRow();
                                const fileName = row.getData().fileName;
                                setMarkupFilename(fileName);
                                viewPdf(fileName); 
                            };
                            return button;
                        }, 
                        hozAlign: "center", 
                        headerSort: false 
                    },
                    { title: "Create Title", 
                        field: "createTitle", 
                        formatter: (cell, formatterParams, onRendered) => {
                            const button = document.createElement("button");
                            button.innerHTML = "Create Title";
                            button.className = "btn btn-secondary btn-sm";
                            button.onclick = async () => {
                                const row = cell.getRow();
                                const fileName = row.getData().fileName;
                                try {
                                    const title = await getTitle(cases, pickedCase, fileName);
                                    console.log('Generated Title:', title);
                                    // now update evidence
                                    const updatedEvidence = [...evidence];
                                    const rowIndex = row.getPosition();
                                    updatedEvidence[rowIndex] = { ...updatedEvidence[rowIndex], ...title };
                                    setEvidence(updatedEvidence);
                                } catch (error) {
                                    console.error('Error generating title:', error);
                                }
                            };
                            return button;
                        }, 
                        hozAlign: "center", 
                        headerSort: false 
                    },
                    { title: "sortId", field: "sortId", editor: "input" },
                    { title: "Type", field: "type", editor: typeEditor, width: 200  },
                    { title: "View PDF", 
                        field: "viewPdf", formatter: (cell, formatterParams, onRendered) => {
                        const button = document.createElement("button");
                        button.innerHTML = "View PDF";
                        button.className = "btn btn-info btn-sm";
                        button.onclick = () => {
                            const row = cell.getRow();
                            const fileName = row.getData().fileName;
                            viewPdf(fileName);
                        };
                        return button;
                    }, hozAlign: "center", headerSort: false },
                    { title: "Title", 
                        field: "title", 
                        editor: "input", 
                        width: 600,
                        formatter: "textarea",
                        cellVertAlign: "top"
                    }, 
                    { title: "Pages", field: "pages", editor: "input" },
                    { title: "Translated", field: "translated", editor: "input", width: 100  },
                    { title: "Date", field: "date", editor: dateEditor, width: 100  }, 
                    { title: "Summary", field: "summary", editor: "textarea", width: 300  }, 
                    { title: "Remove", 
                        field: "actions", 
                        formatter: (cell, formatterParams, onRendered) => {
                            const button = document.createElement("button");
                            button.innerHTML = "Remove";
                            button.className = "btn btn-danger btn-sm";
                            button.onclick = () => {
                                const row = cell.getRow();
                                const fileName = row.getData().fileName;
                                const updatedEvidence = evidence.filter(item => item.fileName !== fileName);
                                setEvidence(updatedEvidence);
                                setCases(prevCases => ({
                                    ...prevCases,
                                    [pickedCase]: {
                                        ...prevCases[pickedCase],
                                        evidence: updatedEvidence
                                    }
                                }));
                            };
                            return button;
                        }, 
                        hozAlign: "center", 
                        headerSort: false 
                    },  
                    { title: "Error", field: "error", editor: "input", width: 100  },
                    { title: "Personal Statement Given By", field: "personalStatementGivenBy", editor: "input", width: 100  },
                    { title: "Expert Statement Given By", field: "expertStatementGivenBy", editor: "input", width: 100  },
                    { title: "Certified By", field: "certifiedBy", editor: "input", width: 100  },
                    { title: "Reporting Given By", field: "reportingGivenBy", editor: "input", width: 100  },
                    { title: "General Country Conditions", field: "generalCountryConditions", editor: "input", maxWidth: 100  },  
                    { title: "AI Opinion", field: "aiOpinion", editor: "textarea", width: 300  },
                    { title: "File Name", field: "fileName", editor: "input", width: 400  },
                ],
            });
// tableRef.current.on("cellEdited", (cell) => {
            //         console.log('edited', cell);
            //         const updatedEvidence = [...evidence];
            //         const rowIndex = cell.getRow().getPosition();
            //         updatedEvidence[rowIndex] = { ...updatedEvidence[rowIndex], [cell.getField()]: cell.getValue() };
            //         setEvidence(updatedEvidence);
            //     }
            // );
            
            tabulatorInstance.on("cellClick", (e, cell) => {
                console.log('Cell clicked:', cell);
                highlightRowAndColumn(cell);
            });
        } else {
            tabulatorInstance.setData(filteredEvidence); // Update data if Tabulator is already initialized
        }

        return () => {
            // Cleanup Tabulator instance on unmount
            if (tabulatorInstance) {
                tabulatorInstance.destroy();
                tabulatorInstance = null;
            }
        };
    }, [evidence, packetNumber, searchFilter]);

    const saveEvidence = () => {
        const newCases = JSON.parse(JSON.stringify(cases));
        newCases[pickedCase].evidence = evidence;
        setCases(newCases);
    }; 

    const deleteAllEvidence = () => {
        if (window.confirm('Are you sure you want to delete ALL evidence files? This action cannot be undone.')) {
            const newCases = JSON.parse(JSON.stringify(cases));
            const currentEvidence = newCases[pickedCase].evidence;
            currentEvidence.forEach(e => {
                const fileKey = `${pickedCase}_${sanitizeForKey(e.fileName)}`;
                localforage.removeItem(fileKey);
            });
            const compiledPacketKey = `compiled_case_${currentCase}_packet_${packetKey}`;
            localforage.removeItem(compiledPacketKey);
            newCases[pickedCase].evidence = [];
            setEvidence([]);
            setCases(newCases);
        }
    };

    const closePdfViewer = () => {
        setPdfUrl(null);
    };

    return (
        <div className="mb-5"> 
            <h1 className="my-4">Evidence Manager</h1>
            <div className="mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input 
                    type="text" 
                    placeholder="Search by filename or title" 
                    value={searchFilter} 
                    onChange={(e) => setSearchFilter(e.target.value)} 
                    style={{ marginBottom: "10px", padding: "4px", width: "300px" }}
                /> 
            </div>
            <div className="breakoutTable">
                <div className="breakoutTableContainer">
                    <div id="evidence-table"></div> {/* Removed ref */}
                </div>
            </div>
            <div className="mt-3">
                <button type="button" className="btn btn-primary" onClick={saveEvidence}>Save Evidence</button>
                <button type="button" className="btn btn-danger ms-2" onClick={deleteAllEvidence}>Delete All Evidence</button>
                <button 
                    type="button" 
                    className="btn btn-primary ms-2" 
                    onClick={() => setShowUpload(!showUpload)}
                    aria-expanded={showUpload}
                    aria-controls="uploadSection"
                >
                    Upload Evidence
                </button>
                <div className={`collapse mt-3 ${showUpload ? 'show' : ''}`} id="uploadSection">
                    <div className="card card-body">
                        <EvidenceUpload                                 
                            cases={cases}
                            setCases={setCases}
                            pickedCase={pickedCase} 
                        />
                    </div>
                </div>
            </div>
            { pdfUrl && ( 
                <iframe
                src={pdfUrl}
                title="PDF Viewer"
                style={{ width: "95%", height: "1000px" }}
                >
                </iframe>
            )}

            <style>{`
                .breakoutTable {
                    width: calc(100vw - 16px); 
                    position: relative;
                    left: 50%;
                    margin-left: -50vw; 
                    display: flex;
                    justify-content: center;
                }
                .breakoutTableContainer{ 
                    max-width: 90%;
                    margin: 0 auto; 

                } 
                #evidence-table {  
                    max-width: none;
                    width: "90%";
                    margin: 0 auto; 
                } 
                .highlighted-row {
                    background-color: rgba(245, 245, 220, 0.7) !important;; /* Transparent beige */
                }
                .highlighted-column {
                    background-color: rgba(245, 245, 220, 0.7) !important;; /* Transparent beige */
                }
            `}
            </style>
        </div>
    );
};


export default EvidenceTable;