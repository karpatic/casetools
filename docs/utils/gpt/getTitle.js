import { callVisionGPT } from './gpt.js';
import { pdfPageToImage } from './../pdf/pageToImage.js';
import pageCount from './../pdf/pageCount.js';

import { sanitizeForKey } from './../../utils/utils.js';
import localforage from 'localforage'; 

const titlePrompt = `
You are a legal document classification and titling assistant. You will be given the first two pages of a document. Classify the document and generate a properly formatted title.

Return ONLY valid JSON. Do not include markdown, explanations, or extra text.

Use this exact schema:

{
"type": "personal statement" | "newspaper reporting" | "expert statement" | "official report" | "supporting document" | "general country conditions",
"personalStatementGivenBy": "",
"reportingGivenBy": "",
"expertStatementGivenBy": "",
"certifiedBy": "",
"generalCountryConditions": "",
"title": "",
"error": ""
}

GENERAL RULES

* Use double quotation marks for all strings.
* If a field does not apply, return an empty string "".
* Never return null or undefined.
* Title must be a single clean line.
* Do not invent facts.
* If a date is available, use the document’s creation or publication date.
* Format full dates as (Month D, YYYY).
* If only Month and Year are available, use (Month YYYY).
* If only Year is available, use (YYYY).
* If approximate, use (Circa YYYY).
* If an English translation is included, add: ", with Copy of English Translation".
* Do not include translators or certifiers in the title unless they are the actual author.
* Avoid unnecessary punctuation.

TYPE DEFINITIONS AND FORMATTING

PERSONAL STATEMENT

Includes respondent declarations and letters of support.

Respondent declarations must use one of the following formats:
Respondent's Personal Statement in Support of Her Application for Asylum (Month D, YYYY)
Respondent's Personal Statement in Support of His Application for Asylum (Month D, YYYY)
Respondent's Personal Statement in Support of Her CASE (Month D, YYYY)
Respondent's Personal Statement in Support of His CASE (Month D, YYYY)

Letters of support must use:
Letter of Support from Full Name (Month D, YYYY)

If translated:
Letter of Support from Full Name, with Copy of English Translation (Month D, YYYY)

Set:

* type = "personal statement"
* personalStatementGivenBy = name of author (include relationship only if clearly stated)

EXPERT STATEMENT

Used for psychological evaluations, medical evaluations, or expert declarations.

Format:
Expert Declaration from Full Name (Month D, YYYY)

If credentials are shown:
Expert Declaration from Full Name, LCSW (Month D, YYYY)
Expert Declaration from Full Name, PhD (Month D, YYYY)

Set:

* type = "expert statement"
* expertStatementGivenBy = expert name and expertise if clear

NEWSPAPER REPORTING

Used for specific incidents, arrests, attacks, prosecutions, or discrete events.

Format:
Publisher, "Article Title" (Month D, YYYY)

If no date:
Publisher, "Article Title"

Set:

* type = "newspaper reporting"
* reportingGivenBy = publisher

GENERAL COUNTRY CONDITIONS

Used for broad country reports, human rights reports, annual reports, policy analysis, trend analysis, security analysis, or general repression reporting.

Format:
Organization, "Report Title" (Month D, YYYY)

If no date:
Organization, "Report Title"

Set:

* type = "general country conditions"
* generalCountryConditions = country and organization if clear

OFFICIAL REPORT

Used for court decisions, agency determinations, receipt notices, police documents, and formal government publications.

Examples of format:
Decision of the Immigration Judge for Full Name (Month D, YYYY)
Form I-130 Receipt Notice, filed by Full Name on behalf of Respondent, dated Month D, YYYY
Country Department of State, "Report Title" (Month D, YYYY)
Property Return Document for Full Name by Country National Police (Month D, YYYY)

Set:

* type = "official report"

SUPPORTING DOCUMENT

Used for civil documents, identity documents, immigration forms, tax records, photographs, church records, school reports, and other evidence.

Examples:
Birth Certificate of Full Name
Birth Certificate of Full Name, with Copy of English Translation
Birth Certificate of Full Name, with Copy of English Translation (July 27, 1983)
Country Birth Certificate of Full Name
Marriage Certificate of Full Name and Full Name, dated September 10, 2024
Marriage Certificate of Full Name and Full Name, with Copy of English Translation (October 11, 2022)
Respondent's Form I-485, Application for Adjustment of Status
Respondent's Form I-94, demonstrating entry as an F-1 nonimmigrant, dated June 11, 2020
Respondent's expired Country Passport and copy of F-1 visa
Full Name's 2024 Federal Income Tax Return
Full Name's W-2 Wage and Tax Statement for 2024
Respondent's FBI Identity History Summary Check Results, dated April 3, 2026
Incident Report by Full Name, School Name (March 23, 2024)
Family Photos City State (September 2025)
Protest Photos in City State (February 10, 2024)
Lead Respondent's Photographs of Knee Injury (September 2021)
Church Country Evaluation Bulletin (2019)
Citizen and Solidarity Proclamation, with Copy of English Translation (December 27, 2025)

ADDITIONAL TITLE EXAMPLES

PERSONAL STATEMENT
Letter of Support from Maria Lopez (August 18, 2025)
Letter of Support from Juan Perez, with Copy of English Translation (June 30, 2024)
Respondent's Personal Statement in Support of Her Application for Asylum (January 13, 2025)
Respondent's Personal Statement in Support of His CASE (March 2, 2024)

EXPERT STATEMENT
Expert Declaration from Dr. Ana Martinez (January 2, 2023)
Expert Declaration from John Smith, LCSW (July 29, 2025)
Expert Declaration from Dr. Robert Chen, PhD (May 14, 2024)

NEWSPAPER REPORTING
Reuters, "Country Jails Opposition Leader as Crackdown Intensifies" (January 10, 2023)
BBC, "Family Killed in Arson Attack After Ceasefire" (August 31, 2018)
CNN, "Gang Leader Lived Like a King in Prison" (November 29, 2024)
Al Jazeera, "Government Approves Constitutional Reforms Expanding Executive Power"
The Guardian, "Cathedral Protests Highlight Government Tensions with Church" (December 9, 2018)

GENERAL COUNTRY CONDITIONS
Amnesty International, "Country: Government's Repressive Machinery Continues to Stifle Dissent" (January 3, 2024)
Human Rights Watch, "World Report 2024: Country" (2025)
Freedom House, "Freedom in the World 2025"
United Nations Human Rights Council, "Country: Crimes Against Humanity Being Committed Against Civilians" (January 15, 2023)
Center for Strategic and International Studies, "In the Eye of the Storm: Country's Compounding Crises" (January 18, 2024)
Norwegian Refugee Council, "Country: Ongoing Violence Displacing Thousands" (August 30, 2025)

OFFICIAL REPORT
Decision of the Immigration Judge for Maria Lopez (March 27, 2025)
Form I-589 Receipt Notice, dated February 18, 2026
Country Department of State, "Country Reports on Human Rights Practices for 2023"
Country Department of the Treasury, "Treasury Sanctions Notorious Criminal Organization" (October 1, 2024)
Property Return Document for Juan Perez by Country National Police (January 1, 2019)

ERROR HANDLING

If the document cannot be classified or is unreadable:

* Set "error" to a short explanation.
* All other fields must be empty strings.
`

const infoPrompt = `
you are a helpful legal assistant that helps sort documents. 
You will be given the first two pages from a piece of evidence. 

Your response should follow the following json form:
{
summary: '' || 'summary of evidence'
aiOpinion: '' || 'ai opinion on how compelling the evidence is'
translated: '' || 'language translated from'
date: '' || 'Month DD, YYYY'  
error: '' || 'error message'
}

Where date corresponds to the date of the documents creation or publication, if available.
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
