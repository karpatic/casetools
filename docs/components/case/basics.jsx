// CaseBasics.js 

import React from 'react';
import showToast from './../showToast.js';
import localforage from 'localforage';

console.log('CaseBasics.js loaded');    

const CaseBasics = ({ cases, setCases, pickedCase }) => { 
    const [activeTab, setActiveTab] = React.useState(() => {
        return localStorage.getItem('caseBasicsActiveTab');
    });
    
    const [config, setConfig] = React.useState(cases?.[pickedCase]?.basics || {}); 

    React.useEffect(() => {
        setConfig(cases?.[pickedCase]?.basics || {});
    }, [pickedCase, cases]);
    

    const saveTimeoutIdRef = React.useRef(null);
    const forceNextSaveRef = React.useRef(false);

    const saveConfig = async (configToSave) => {
        try {
            const casesLocal = await localforage.getItem('cases') || {};
            casesLocal[pickedCase] = {
                ...casesLocal[pickedCase],
                basics: configToSave
            };
            await localforage.setItem('cases', casesLocal);

            // Keep parent component state in sync
            setCases(prevCases => ({
                ...prevCases,
                [pickedCase]: {
                    ...prevCases[pickedCase],
                    basics: configToSave
                }
            }));

            showToast('Case configuration saved successfully');
        } catch (error) {
            console.error('Error saving config:', error);
            showToast('Error saving configuration');
        }
    };

    const triggerSave = (newConfig) => {
        if (saveTimeoutIdRef.current) clearTimeout(saveTimeoutIdRef.current);
        
        if (forceNextSaveRef.current) {
            saveConfig(newConfig);
            saveTimeoutIdRef.current = null;
            forceNextSaveRef.current = false;
        } else {
            saveTimeoutIdRef.current = setTimeout(() => {
                saveConfig(newConfig);
                saveTimeoutIdRef.current = null;
            }, 300);
        }
    };

    const handleConfigChange = (e) => {
        const { name, value } = e.target;

        // Special handling for respondent file_numbers array: respondent[0].file_numbers[1]
        const fileNumMatches = name.match(/respondent\[(\d+)\]\.file_numbers\[(\d+)\]/);
        if (fileNumMatches) {
            const respondentIndex = parseInt(fileNumMatches[1]);
            const fileNumIndex = parseInt(fileNumMatches[2]);
            setConfig(prevConfig => {
                const newConfig = { ...prevConfig };
                newConfig.respondents = newConfig.respondents || [];
                while (newConfig.respondents.length <= respondentIndex) newConfig.respondents.push({});

                const respondent = { ...(newConfig.respondents[respondentIndex] || {}) };
                const fileNumbers = [...(respondent.file_numbers || [])];
                while (fileNumbers.length <= fileNumIndex) fileNumbers.push('');
                fileNumbers[fileNumIndex] = value;
                respondent.file_numbers = fileNumbers;
                newConfig.respondents[respondentIndex] = respondent;

                triggerSave(newConfig);
                return newConfig;
            });
            return;
        }

        // Special handling for respondents array
        if (name.startsWith('respondent[')) {
            // Extract index and field name from format respondent[0].full_name
            const matches = name.match(/respondent\[(\d+)\]\.(.+)/);
            if (matches) {
                const index = parseInt(matches[1]);
                const field = matches[2];

                setConfig(prevConfig => {
                    const newConfig = { ...prevConfig };
                    newConfig.respondents = newConfig.respondents || [];

                    // Ensure the array has enough elements
                    while (newConfig.respondents.length <= index) {
                        newConfig.respondents.push({});
                    }

                    // Update the specific field
                    newConfig.respondents[index][field] = value;

                    triggerSave(newConfig);
                    return newConfig;
                });
                return;
            }
        }

        // Handle other fields normally
        const keys = name.split('.');
        setConfig(prevConfig => {
            const newConfig = { ...prevConfig };
            let current = newConfig;
            for (let i = 0; i < keys.length; i++) {
                if (i === keys.length - 1) {
                    current[keys[i]] = value;
                } else {
                    current[keys[i]] = current[keys[i]] || {};
                    current = current[keys[i]];
                }
            }

            triggerSave(newConfig);
            return newConfig;
        });
    };

    const addRespondent = () => {
        setConfig(prevConfig => {
            const newConfig = { ...prevConfig };
            newConfig.respondents = newConfig.respondents || [];
            newConfig.respondents.push({ full_name: '', file_numbers: [''], status: '' });
            return newConfig;
        });
    };

    const addRespondentFileNumber = (respondentIndex) => {
        setConfig(prevConfig => {
            const newConfig = { ...prevConfig };
            newConfig.respondents = newConfig.respondents || [];
            while (newConfig.respondents.length <= respondentIndex) newConfig.respondents.push({});
            const respondent = { ...(newConfig.respondents[respondentIndex] || {}) };
            const fileNumbers = [...(respondent.file_numbers || [])];
            fileNumbers.push('');
            respondent.file_numbers = fileNumbers;
            newConfig.respondents[respondentIndex] = respondent;
            return newConfig;
        });
    };

    const removeRespondentFileNumber = (respondentIndex, fileNumIndex) => {
        setConfig(prevConfig => {
            const newConfig = { ...prevConfig };
            const respondents = [...(newConfig.respondents || [])];
            const respondent = { ...(respondents[respondentIndex] || {}) };
            const fileNumbers = [...(respondent.file_numbers || [])];
            fileNumbers.splice(fileNumIndex, 1);
            respondent.file_numbers = fileNumbers;
            respondents[respondentIndex] = respondent;
            newConfig.respondents = respondents;
            return newConfig;
        });
    };

    const removeRespondent = (index) => {
        setConfig(prevConfig => {
            const newConfig = { ...prevConfig };
            newConfig.respondents = [...(newConfig.respondents || [])];
            newConfig.respondents.splice(index, 1);
            return newConfig;
        });
    };

    React.useEffect(() => {
        localStorage.setItem('caseBasicsActiveTab', activeTab);
    }, [activeTab]);

    const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
            if (saveTimeoutIdRef.current) {
                clearTimeout(saveTimeoutIdRef.current);
                saveTimeoutIdRef.current = null;
                setConfig(prevConfig => {
                    saveConfig(prevConfig);
                    return prevConfig;
                });
            }
        }
    };

    const handlePaste = (e) => {
        forceNextSaveRef.current = true;
    };

    return (
        <div>
            <form className="mb-4" onKeyDown={handleKeyDown} onPaste={handlePaste}>
                <div className="accordion" id="caseBasicsAccordion">
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingCaseFacts">
                            <button 
                                className={"accordion-button " + (activeTab === 'caseFacts' ? "" : "collapsed")}
                                type="button"
                                onClick={() => setActiveTab(activeTab === 'caseFacts' ? '' : 'caseFacts')}
                            >
                                Case Facts
                            </button>
                        </h2>
                        <div id="collapseCaseFacts" className={"accordion-collapse collapse" + (activeTab === 'caseFacts' ? " show" : "")} data-bs-parent="#caseBasicsAccordion">
                            <div className="accordion-body">
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Case Facts:</label>
                                    <textarea className="form-control" name="caseFacts" value={config?.caseFacts || ''} onChange={handleConfigChange} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingAttorney">
                            <button 
                                className={"accordion-button " + (activeTab === 'attorney' ? "" : "collapsed")}
                                type="button"
                                onClick={() => setActiveTab(activeTab === 'attorney' ? '' : 'attorney')}
                            >
                                Attorney
                            </button>
                        </h2>
                        <div id="collapseAttorney" className={"accordion-collapse collapse" + (activeTab === 'attorney' ? " show" : "")} data-bs-parent="#caseBasicsAccordion">
                            <div className="accordion-body">
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Name:</label>
                                    <input type="text" className="form-control" name="attorney.attorney_name" value={config?.attorney?.attorney_name ?? 'Nathalie G Karpati, Esq.'} onChange={handleConfigChange} placeholder="Nathalie G Karpati, Esq." />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Address:</label>
                                    <input type="text" className="form-control" name="attorney.address" value={config?.attorney?.address ?? '53 Nicholson St., NW'} onChange={handleConfigChange} placeholder="53 Nicholson St., NW" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">City:</label>
                                    <input type="text" className="form-control" name="attorney.city" value={config?.attorney?.city ?? 'Washington, DC 20011'} onChange={handleConfigChange} placeholder="Washington, DC 20011" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Phone:</label>
                                    <input type="text" className="form-control" name="attorney.phone" value={config?.attorney?.phone ?? '(703) 828-4374'} onChange={handleConfigChange} placeholder="(703) 828-4374" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Email:</label>
                                    <input type="text" className="form-control" name="attorney.email" value={config?.attorney?.email ?? 'Nathalie.Karpati@gmail.com'} onChange={handleConfigChange} placeholder="Nathalie.Karpati@gmail.com" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">EOIR ID:</label>
                                    <input type="text" className="form-control" name="attorney.eoir_id" value={config?.attorney?.eoir_id ?? 'GG254003'} onChange={handleConfigChange} placeholder="GG254003" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Case Type:</label>
                                    <input type="text" className="form-control" name="attorney.case_type" value={config?.attorney?.case_type ?? 'NON-DETAINED'} onChange={handleConfigChange} placeholder="NON-DETAINED" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingCover">
                            <button 
                                className={"accordion-button " + (activeTab === 'cover' ? "" : "collapsed")}
                                type="button"
                                onClick={() => setActiveTab(activeTab === 'cover' ? '' : 'cover')}
                            >
                                Court Information
                            </button>
                        </h2>
                        <div id="collapseCover" className={"accordion-collapse collapse" + (activeTab === 'cover' ? " show" : "")} data-bs-parent="#caseBasicsAccordion">
                            <div className="accordion-body">
                                <div className="mb-4 text-center">
                                    <img src="./rsc/img/cover_page.png" alt="Cover Page Preview" className="img-fluid border shadow-sm" style={{ maxHeight: '333px' }} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Department:</label>
                                    <input type="text" className="form-control" name="cover.cover_department" value={config?.cover?.cover_department || ''} onChange={handleConfigChange} placeholder="UNITED STATES DEPARTMENT OF JUSTICE" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Division:</label>
                                    <input type="text" className="form-control" name="cover.cover_division" value={config?.cover?.cover_division || ''} onChange={handleConfigChange} placeholder="EXECUTIVE OFFICE OF IMMIGRATION REVIEW" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Cover Name:</label>
                                    <input type="text" className="form-control" name="cover.cover_name" value={config?.cover?.cover_name || ''} onChange={handleConfigChange} placeholder="UNITED STATES IMMIGRATION COURT" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Location:</label>
                                    <input type="text" className="form-control" name="cover.cover_location" value={config?.cover?.cover_location || ''} onChange={handleConfigChange} placeholder="ANNANDALE, VIRGINIA" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingCover">
                            <button 
                                className={"accordion-button " + (activeTab === 'certificate' ? "" : "collapsed")}
                                type="button"
                                onClick={() => setActiveTab(activeTab === 'certificate' ? '' : 'certificate')}
                            >
                                Certificate
                            </button>
                        </h2>
                        <div id="collapseCertificate" className={"accordion-collapse collapse" + (activeTab === 'certificate' ? " show" : "")} data-bs-parent="#caseBasicsAccordion">
                            <div className="accordion-body">
                                <div className="mb-4 text-center">
                                    <img src="./rsc/img/certificate_of_service.png" alt="Certificate of Service Preview" className="img-fluid border shadow-sm" style={{ maxHeight: '333px' }} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Department:</label>
                                    <input type="text" className="form-control" name="certificate.certificate_department" value={config?.certificate?.certificate_department || ''} onChange={handleConfigChange} placeholder="U.S. DEPARTMENT OF HOMELAND SECURITY" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Division:</label>
                                    <input type="text" className="form-control" name="certificate.certificate_division" value={config?.certificate?.certificate_division || ''} onChange={handleConfigChange} placeholder="IMMIGRATION AND CUSTOMS ENFORCEMENT" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Name:</label>
                                    <input type="text" className="form-control" name="certificate.certificate_name" value={config?.certificate?.certificate_name || ''} onChange={handleConfigChange} placeholder="OFFICE OF THE PRINCIPAL LEGAL ADVISOR" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Address:</label>
                                    <input type="text" className="form-control" name="certificate.certificate_location_address" value={config?.certificate?.certificate_location_address || ''} onChange={handleConfigChange} placeholder="7619 Little River Turnpike" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Address Line Two:</label>
                                    <input type="text" className="form-control" name="certificate.certificate_location_linetwo" value={config?.certificate?.certificate_location_linetwo || ''} onChange={handleConfigChange} placeholder="Suite 900" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Address State and Zip:</label>
                                    <input type="text" className="form-control" name="certificate.certificate_location_statezip" value={config?.certificate?.certificate_location_statezip || ''} onChange={handleConfigChange} placeholder="Annandale, VA 22003" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingRespondent">
                            <button 
                                className={"accordion-button " + (activeTab === 'respondent' ? "" : "collapsed")}
                                type="button"
                                onClick={() => setActiveTab(activeTab === 'respondent' ? '' : 'respondent')}
                            >
                                Respondents
                            </button>
                        </h2>
                        <div id="collapseRespondent" className={"accordion-collapse collapse" + (activeTab === 'respondent' ? " show" : "")} data-bs-parent="#caseBasicsAccordion">
                            <div className="accordion-body">
                                {(config?.respondents || []).map((respondent, index) => (
                                    <div key={index} className="mb-4 p-3 border rounded">
                                        <div className="d-flex justify-content-between mb-2">
                                            <h6>Respondent #{index + 1}</h6>
                                            <button 
                                                type="button" 
                                                className="btn btn-sm btn-danger"
                                                onClick={() => removeRespondent(index)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <div className="mb-3 d-flex align-items-center">
                                            <label className="form-label me-2">Full Name:</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                name={`respondent[${index}].full_name`} 
                                                value={respondent.full_name || ''} 
                                                onChange={handleConfigChange} 
                                                placeholder="FULL NAME"
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label">File Number(s):</label>
                                            {(() => {
                                                const fileNums = (respondent.file_numbers && respondent.file_numbers.length)
                                                    ? respondent.file_numbers
                                                    : [''];
                                                return fileNums.map((fileNum, fileNumIndex) => (
                                                    <div key={fileNumIndex} className="input-group mb-2">
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            name={`respondent[${index}].file_numbers[${fileNumIndex}]`}
                                                            value={fileNum || ''}
                                                            onChange={handleConfigChange}
                                                            placeholder="A#012-345-678"
                                                        />
                                                        {fileNums.length > 1 && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-danger"
                                                                onClick={() => removeRespondentFileNumber(index, fileNumIndex)}
                                                            >
                                                                Remove
                                                            </button>
                                                        )}
                                                    </div>
                                                ));
                                            })()}
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success"
                                                onClick={() => addRespondentFileNumber(index)}
                                            >
                                                Add File Number
                                            </button>
                                        </div>
                                        <div className="mb-3 d-flex align-items-center">
                                            <label className="form-label me-2">Status:</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                name={`respondent[${index}].status`} 
                                                value={respondent.status || ''} 
                                                onChange={handleConfigChange} 
                                                placeholder="In Removal Proceedings"
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    type="button" 
                                    className="btn btn-success"
                                    onClick={addRespondent}
                                >
                                    Add Respondent
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingJudge">
                            <button 
                                className={"accordion-button " + (activeTab === 'judge' ? "" : "collapsed")}
                                type="button"
                                onClick={() => setActiveTab(activeTab === 'judge' ? '' : 'judge')}
                            >
                                Judge
                            </button>
                        </h2>
                        <div id="collapseJudge" className={"accordion-collapse collapse" + (activeTab === 'judge' ? " show" : "")} data-bs-parent="#caseBasicsAccordion">
                            <div className="accordion-body">
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Name:</label>
                                    <input type="text" className="form-control" name="judge.judge_name" value={config?.judge?.judge_name || ''} onChange={handleConfigChange} placeholder="JUDGE NAME" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Hearing Date:</label>
                                    <input type="text" className="form-control" name="judge.hearing_date" value={config?.judge?.hearing_date || ''} onChange={handleConfigChange} placeholder="March 31, 2026" />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Hearing Time:</label>
                                    <input type="text" className="form-control" name="judge.hearing_time" value={config?.judge?.hearing_time || ''} onChange={handleConfigChange} placeholder="1:00 PM" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CaseBasics;