// CaseBasics.js 


import showToast from './../showToast.js';

const CaseBasics = ({ cases, setCases, pickedCase }) => { 
    const [activeTab, setActiveTab] = React.useState(() => {
        return localStorage.getItem('caseBasicsActiveTab');
    });
    
    const [config, setConfig] = React.useState(cases?.[pickedCase]?.basics || {}); 

    React.useEffect(() => {
        setConfig(cases?.[pickedCase]?.basics || {});
    }, [pickedCase, cases]);
    

    const [saveTimeoutId, setSaveTimeoutId] = React.useState(null);

    const saveConfig = async (configToSave) => {
        try {
            const cases = await localforage.getItem('cases') || {};
            cases[pickedCase] = {
                ...cases[pickedCase],
                basics: configToSave
            };
            await localforage.setItem('cases', cases);
            showToast('Case configuration saved successfully');
        } catch (error) {
            console.error('Error saving config:', error);
            showToast('Error saving configuration');
        }
    };

    const handleConfigChange = (e) => {
        const { name, value } = e.target;

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

                    // Clear previous timeout if it exists
                    if (saveTimeoutId) {
                        clearTimeout(saveTimeoutId);
                    }

                    // Set new timeout
                    const timeoutId = setTimeout(() => {
                        saveConfig(newConfig);
                    }, 500); // Save after 500ms of inactivity

                    setSaveTimeoutId(timeoutId);
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

            // Clear previous timeout if it exists
            if (saveTimeoutId) {
                clearTimeout(saveTimeoutId);
            }

            // Set new timeout
            const timeoutId = setTimeout(() => {
                saveConfig(newConfig);
            }, 500); // Save after 500ms of inactivity

            setSaveTimeoutId(timeoutId);
            return newConfig;
        });
    };

    const addRespondent = () => {
        setConfig(prevConfig => {
            const newConfig = { ...prevConfig };
            newConfig.respondents = newConfig.respondents || [];
            newConfig.respondents.push({ full_name: '', file_number: '', status: '' });
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

    return (
        <div>
            <form className="mb-4">
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
                                    <input type="text" className="form-control" name="caseFacts" value={config?.caseFacts || ''} onChange={handleConfigChange} />
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
                                    <input type="text" className="form-control" name="attorney.attorney_name" value={config?.attorney?.attorney_name || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Address:</label>
                                    <input type="text" className="form-control" name="attorney.address" value={config?.attorney?.address || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">City:</label>
                                    <input type="text" className="form-control" name="attorney.city" value={config?.attorney?.city || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Phone:</label>
                                    <input type="text" className="form-control" name="attorney.phone" value={config?.attorney?.phone || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Email:</label>
                                    <input type="text" className="form-control" name="attorney.email" value={config?.attorney?.email || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">EOIR ID:</label>
                                    <input type="text" className="form-control" name="attorney.eoir_id" value={config?.attorney?.eoir_id || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Case Type:</label>
                                    <input type="text" className="form-control" name="attorney.case_type" value={config?.attorney?.case_type || ''} onChange={handleConfigChange} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="accordion-item">
                        <h2 className="accordion-header" id="headingCourt">
                            <button 
                                className={"accordion-button " + (activeTab === 'court' ? "" : "collapsed")}
                                type="button"
                                onClick={() => setActiveTab(activeTab === 'court' ? '' : 'court')}
                            >
                                Court
                            </button>
                        </h2>
                        <div id="collapseCourt" className={"accordion-collapse collapse" + (activeTab === 'court' ? " show" : "")} data-bs-parent="#caseBasicsAccordion">
                            <div className="accordion-body">
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Department:</label>
                                    <input type="text" className="form-control" name="court.department" value={config?.court?.department || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Division:</label>
                                    <input type="text" className="form-control" name="court.division" value={config?.court?.division || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Court Name:</label>
                                    <input type="text" className="form-control" name="court.court_name" value={config?.court?.court_name || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Location:</label>
                                    <input type="text" className="form-control" name="court.location" value={config?.court?.location || ''} onChange={handleConfigChange} />
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
                                            />
                                        </div>
                                        <div className="mb-3 d-flex align-items-center">
                                            <label className="form-label me-2">File Number:</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                name={`respondent[${index}].file_number`} 
                                                value={respondent.file_number || ''} 
                                                onChange={handleConfigChange} 
                                            />
                                        </div>
                                        <div className="mb-3 d-flex align-items-center">
                                            <label className="form-label me-2">Status:</label>
                                            <input 
                                                type="text" 
                                                className="form-control" 
                                                name={`respondent[${index}].status`} 
                                                value={respondent.status || ''} 
                                                onChange={handleConfigChange} 
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
                                    <input type="text" className="form-control" name="judge.judge_name" value={config?.judge?.judge_name || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Hearing Date:</label>
                                    <input type="text" className="form-control" name="judge.hearing_date" value={config?.judge?.hearing_date || ''} onChange={handleConfigChange} />
                                </div>
                                <div className="mb-3 d-flex align-items-center">
                                    <label className="form-label me-2">Hearing Time:</label>
                                    <input type="text" className="form-control" name="judge.hearing_time" value={config?.judge?.hearing_time || ''} onChange={handleConfigChange} />
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