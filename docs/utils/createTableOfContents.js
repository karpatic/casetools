function createCaseContentsYaml(tableOfContents) {   
    console.log('createCaseContentsYaml - tableOfContents:', tableOfContents); 
    let createRecord = entry =>
        `  - letter: "${entry.letter}"\n    title: "${entry.title.replace(/"/g, '\\"')}"\n    pageRange: "${entry.pageRange}"`;
    let tocYaml = "contents:\n" + tableOfContents.map(createRecord).join("\n");
 
    return tocYaml;
}

function createCaseMetadataYaml(config, packetConfig) {    
    // console.log('createCaseMetadataYaml - config:', config, 'packetConfig:', packetConfig);  
    // Get count of each respondents type
    let respondentCount = config?.respondents?.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
    }, {}); 

    let f = {
        ...config?.attorney||{},
        ...config?.cover||{},
        ...config?.certificate||{},
        ...config?.judge||{},
        ...packetConfig||{}
    }

    let keys = Object.keys(f);  
    let requiredKeys = ['packetTitle', 'attorney_name', 'address', 'city', 'phone', 
        'cover_department', 'email', 'eoir_id', 'case_type', 'cover_name', 'cover_division', 
        'cover_location', 'judge_name', 'hearing_date', 'hearing_time', 'certificate_name',
        'certificate_department', 'certificate_division', 'certificate_location'];
    let missingKeys = requiredKeys.filter(k => !keys.includes(k))
    if (missingKeys.length > 0) {
        console.log('createTableOfContentsYaml - Missing keys:', missingKeys);
        alert('Missing keys: ' + missingKeys.join(', '));
        return false
    }

    if(!respondentCount){   
        console.log('Missing respondentCount');
        alert('Missing respondentCount');
        return false
    } 

    const dataYaml = `
attorney:
    attorney_name: "${f.attorney_name}"
    address: "${f.address}"
    city: "${f.city}"
    phone: "${f.phone}"
    email: "${f.email}"
    eoir_id: "${f.eoir_id}"
    case_type: "${f.case_type}"

cover: 
    cover_department: "${f.cover_department}"
    cover_division: "${f.cover_division}"
    cover_location: "${f.cover_location}"
    cover_name: "${f.cover_name}"

certificate: 
    certificate_department: "${f.certificate_department}"
    certificate_division: "${f.certificate_division}"
    certificate_location: "${f.certificate_location}"
    certificate_name: "${f.certificate_name}"
    
respondents:
${config?.respondents?.map(r => `  - full_name: "${r.full_name}"
    file_number: "${r.file_number}"
    count:  "${ respondentCount[r.status] }"
    status: "${r.status}"`).join('\n')} 

judge:
    judge_name: "${f.judge_name}"
    hearing_date: "${f.hearing_date}"
    hearing_time: "${f.hearing_time}"

document:
    title: "${f.packetTitle}"
    multipleRespondents: "${Object.keys(respondentCount).length > 1 ? 'true' : ''}"
`; 

    return dataYaml;
}

function createTableOfContentsYaml(config, evidence, packetConfig) { 
    const tocYaml = createCaseContentsYaml(evidence)
    const metadataYaml = createCaseMetadataYaml(config, packetConfig)
    const dataYaml = `---${metadataYaml}
${tocYaml}
---`; 

    return dataYaml;
}

export {createTableOfContentsYaml, createCaseMetadataYaml};