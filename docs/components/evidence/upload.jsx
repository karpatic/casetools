import React from 'react'; 
import localforage from 'localforage'; 

import { sanitizeForKey } from './../../utils/utils.js'; 
import {getTitle} from './../../utils/gpt/getTitle.js' 
import { isImageFile, imageFileToA4PdfBlob } from './../../utils/pdf/imageToPdf.js';


const EvidenceUpload = ({ pickedCase, cases, setCases }) => { 
    const [files, setFiles] = React.useState([]); 
    const [uploading, setUploading] = React.useState(false); 
    const [currentFileIndex, setCurrentFileIndex] = React.useState(0); 
    const [uploadProgress, setUploadProgress] = React.useState(0); 

    const handleFileChange = (event) => { 
        // Convert FileList object to array for easier manipulation 
        const fileArray = Array.from(event.target.files); 
        setFiles(prevFiles => [...prevFiles, ...fileArray]); 
    }; 

    const handleFolderChange = (event) => { 
        // Convert FileList object to array for easier manipulation 
        const fileArray = Array.from(event.target.files); 
        setFiles(prevFiles => [...prevFiles, ...fileArray]); 
    }; 

    const removeFile = (indexToRemove) => { 
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove)); 
    }; 

    const handleUpload = async () => { 
        console.log('Uploading files:', files); 
        if (files.length === 0) return; 
        const lastPacketNumber = Math.max(...Object.keys(cases[pickedCase]) 
        ?.filter(key => key.startsWith('evidencePacket_')) 
        ?.map(key => parseInt(key.split('_')[1])) || 0) 

        console.log('[lastPacketNumber]', lastPacketNumber); 
        if(lastPacketNumber <= 0){ 
            alert('You must create a packet first'); 
            return false; 
        } 

        let newEvidence = cases[pickedCase]?.evidence || []; 

        setUploading(true); 
        setCurrentFileIndex(0); 
        setUploadProgress(0); 

        // Upload files sequentially to localForage 
        for (let i = 0; i < files.length; i++) { 
            setCurrentFileIndex(i); 
            setUploadProgress(Math.round((i / files.length) * 100)); 

            const file = files[i];
            const shouldConvertImage = isImageFile(file);

            const finalFileName = shouldConvertImage
                ? file.name.replace(/\.(jpe?g|png)$/i, '.pdf')
                : file.name;

            const storageBlob = shouldConvertImage
                ? await imageFileToA4PdfBlob(file)
                : file;

            // Store file in localForage 
            const sanitizedFilename = sanitizeForKey(finalFileName); 
            const storageKey = `${pickedCase}_${sanitizedFilename}`; 
            await localforage.setItem(storageKey, storageBlob); 
            
            // Update evidence list. just one 
            const oldFile = newEvidence.find(evidence => evidence.fileName === finalFileName); 
            if (!oldFile || !oldFile['title']){ 
                newEvidence = newEvidence.filter(evidence => evidence.fileName !== finalFileName);
                const titleObj = await getTitle(cases, pickedCase, finalFileName);
                let finalObj = { 
                    ...titleObj, 
                    fileName: finalFileName,
                    storageKey: storageKey, 
                    evidencePacket: lastPacketNumber, 
                    fileSize: storageBlob.size,
                } 
                newEvidence.push(finalObj); 
            }  
        }
        let newCases = JSON.parse(JSON.stringify(cases));  
        newCases[pickedCase].evidence = newEvidence;
        // console.log('newEvidence', JSON.stringify(newEvidence, null, 2));
        setCases( newCases ); 
        setUploading(false);
        setUploadProgress(100);
        setFiles([]);
    };

    return (
        <div>
            <div className="mb-3">
                <div className="mb-2">
                    <label className="me-3">Select individual files:</label>
                    <input type="file" multiple accept="application/pdf,image/jpeg,image/jpg,image/png" onChange={handleFileChange} className="form-control" />
                </div>
                
                <div>
                    <label className="me-3">Or select a folder:</label>
                    <input 
                        type="file" 
                        webkitdirectory="true" 
                        directory="true" 
                        onChange={handleFolderChange} 
                        className="form-control" 
                    />
                </div>
            </div>

            {files.length > 0 && (
                <div className="mb-3">
                    <h5>Selected Files ({files.length})</h5>
                    <div style={{maxHeight: '300px', overflowY: 'auto'}} className="border rounded p-2">
                        <ul className="list-group">
                            {files.map((file, index) => (
                                <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                                    <div className="text-truncate" style={{maxWidth: '80%'}}>
                                        {file.name} <small className="text-muted">({(file.size / 1024).toFixed(1)} KB)</small>
                                    </div>
                                    <button 
                                        className="btn btn-sm btn-outline-danger" 
                                        onClick={() => removeFile(index)}
                                        disabled={uploading}
                                    >
                                        ✕
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {uploading && (
                <div className="mb-3">
                    <div className="progress mb-2">
                        <div 
                            className="progress-bar" 
                            role="progressbar" 
                            style={{width: `${uploadProgress}%`}} 
                            aria-valuenow={uploadProgress} 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                        >
                            {uploadProgress}%
                        </div>
                    </div>
                    <p>Uploading file {currentFileIndex + 1} of {files.length}: {files[currentFileIndex]?.name}</p>
                </div>
            )}

            <button 
                onClick={handleUpload} 
                disabled={uploading || files.length === 0} 
                className="btn btn-primary"
            >
                {uploading ? 'Uploading...' : `Upload ${files.length} Evidence File${files.length !== 1 ? 's' : ''}`}
            </button>
        </div>
    );
};

export default EvidenceUpload; 