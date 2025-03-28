import { callVisionGPT } from './gpt.js';
import { pdfPageToImage } from './../pdf/pageToImage.js';
import pageCount from './../pdf/pageCount.js';

import { sanitizeForKey } from './../../utils/utils.js';
import localforage from 'localforage'; 

const titlePrompt = `
you are a helpful legal assistant that helps sort documents. 
You will be given the first two pages from a piece of evidence. 

Your response should follow the following json form:
{
type: 'personal statement' || 'newspaper reporting' || 'expert statement' || 'official report' || 'supporting document' || 'general country conditions'
personalStatementGivenBy: '' || 'name - relationship to person'
reportingGivenBy: '' || 'name - publication'
expertStatementGivenBy: '' || 'name - expertise'
certifiedBy: '' || 'name'
generalCountryConditions: '' || 'Country, prepared by, and topics covered'
title: 'Letter of support from' || 'Publication HEADER - title (Month DD, YYYY)' 
error: '' || 'error message'
}

BE CAREFUL:
You do not care about who certifies statements, you want the expert or person with a relationship to the case.

Ensure the title attribute is formatted correctly:
For publications, if no date is given, you can leave it blank.

- Ensure the Title is formatted correctly and uses Month DD, YYYY for the date if given.

FOR personal statements:

- Statements from the case respondent get their own special title format:
Example: "Respondent's Personal Statement in Support of Her/His CASE"
Example: "Respondent's Personal Statement in Support of Her Application for Asylum"

- Ensure proper capture of the actual person and not the translator or whitness, etc.:
Example: Letter of Support from FirstName LastName 
Example: Letter of Support from FirstName M. LastName, with Copy of English Translation

FOR expert statements:

- Please add the dates for the expert declarations.
- Not to be confused with a personal statement, ensure the EXPERT <PERSON NAME> is the name one being captured.
Example Input: STATEMENT OF certifier REGARDING ATTACHED EXPERT FirstName LastName (Month DD, YYYY)
Example Output: Expert Declaration from FirstName LastName (Month DD, YYYY)

FOR newspaper reportings:

- This needs to pertain to the case specifically and not be a general report about the country or current affairs.
Example: Reporting from Newspaper Name, with Copy of English Translation (Month DD, YYYY)

FOR supporting documents:

Example: Passport of <PERSON NAME>, Biographical Page

FOR official reports:

Example: Respondents psychological preliminary report by <PERSON NAME> (Month DD, YYYY)


FOR general country conditions:

- This should be about the general country conditions and not about a specific person or incident. This captures general news ore current affairs even if a newspaper reporting.
Example:  "Social Distilieries, "Womens Bodies as a Battlefield: Gender Violence in Honduras" (March 15, 2023)",
Example: Organization Name, "Title of Report" (Month DD, YYYY)
Example: Organization Name, "Title of Report" (Month DD, YYYY)
BAD Example: Organization Name - Title of Report, DD/MM/YYY

- Use double quotation marks for reports or documents, and avoid dashes or hyphens in place of them.
- Avoid extraneous punctuation marks unless necessary (like commas or colons for subtitles).
`

const infoPrompt = `
you are a helpful legal assistant that helps sort documents. 
You will be given the first two pages from a piece of evidence. 

Your response should follow the following json form:
{
summary: '' || 'summary of evidence'
aiOpinion: '' || 'ai opinion on how compelling the evidence is'
translated: '' || 'language translated from'
date: '' || 'DD/MM/YYYY'  
error: '' || 'error message'
}
`
 
async function getTitle(cases, pickedCase, fileName, goupto = 1) {
    const selectedCase = cases?.[pickedCase];
    const caseBasics = selectedCase.basics;
    const titleInstructions = caseBasics?.titleInstructions || '';

    const localForageFileLabel = `${pickedCase}_${sanitizeForKey(fileName)}`;
    const pdfFile = await localforage.getItem(localForageFileLabel);
     
    let pdfBytes = await pdfFile.arrayBuffer(); 
    const pages = await pageCount(pdfBytes);  

    let userPrompt = `This is the filename if that helps: ${fileName}`;

    const imgPaths = []; // An Array of canvas.toDataURL('image/png')
    for (let i = 0; i < goupto; i++) {
        const imgDataUrl = await pdfPageToImage(pdfFile, i);
        imgPaths.push(imgDataUrl);
    }

    let gptInfo = await callVisionGPT(imgPaths, infoPrompt, userPrompt, true); 

    userPrompt = `
    This is the basic information about the case and the respondent(s): ${JSON.stringify(caseBasics)}

    This is the filename if that helps: ${fileName}

    ${titleInstructions}

    I also have this information about the document: 

    ${gptInfo}
    `;

    let gptTitle = await callVisionGPT(imgPaths, titlePrompt, userPrompt, true);

    let returnThis = {
        ...JSON.parse(gptInfo),
        ...JSON.parse(gptTitle),
        pages
    }
 
    return returnThis;
}

export { getTitle };
