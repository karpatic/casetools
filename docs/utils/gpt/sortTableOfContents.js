import { callChatGPT } from './../gpt/gpt.js';

/*
SAMPLE RECORD: 
  {
    "id": "1wx0xjiz9n",
    "fileName": "VELASQUEZ POSADAS, Lidia Carolina - UNCHR Eligibility Guidelines",
    "pages": 68,
    "summary": "The document provides guidelines issued by the UNHCR to assist decision-makers in assessing the international protection needs of asylum-seekers from Honduras.
     It offers legal interpretations of refugee criteria based on social, economic, security, human rights, and humanitarian conditions. 
    The guidelines aim to promote accurate application of these criteria in line with international laws such as the 1951 Refugee Convention and its 1967 Protocol.",
    "aiOpinion": "This evidence is compelling as it provides authoritative guidelines from UNHCR for assessing asylum cases, highlighting its basis on in-depth research and reliability.",
    "translated": "False",
    "date": "27 July 2016",
    "type": "support",
    "supportGivenByFriendOrFamily": "",
    "natureOfSupport": "expert",
    "supportGivenByExpert": "UNHCR",
    "publicationGivenBy": "",
    "error": "",
    "title": "UNHCR, Eligibility Guidelines for Assessing the International Protection Needs of Asylum-Seekers from Honduras (27 July 2016)"
  },
*/

async function sortTableOfContents(evidence, sortInstructions='') {
  
    // group by packetNumber


    // Prepare messages for ChatGPT
    const messages = [
        {
            role: "system",
            content: `
You are an assistant helping to evaluate legal evidence for a court case. 
Each piece of evidence has an ID and other metadata. 
Your task is to return a JSON list of just the IDs sorted in the order they should be presented.
Most compelling evidence should come first.

like so { fileNames : ['1wx0xjiz9n.pdf', '1wx0xjiz9n.Png', '1wx0xjiz9n.PDF']
`
        }, {}
    ];
    
    let setUserMessage = ( data ) => {
        messages [1] = {
                role: "user",
                content: `Here is the list of support evidence: 
                            ${JSON.stringify(data, null, 2)}. 
                          Please return a JSON list of IDs in the most compelling order.

                          As an example, 
                          
                          Victim > Involved > Witness > Expert > Other > None

                          First Hand Report > Second Hand Report > Third Hand Report > Other > None

                          Police Report > Medical Report > Other > None

                          Direct Evidence > Circumstantial Evidence > Hearsay > Other > None
                          
                          Local > State > Federal > International > None

                          ${sortInstructions}
`
            }
    }

    // for each arr in arrOfarr, call ChatGPT 
    setUserMessage(evidence);   
    let order = await callChatGPT(messages, true);    
    let sortedEvidence = order.fileNames.map(fName => evidence.find(item => item.fileName == fName));
    sortedEvidence.forEach((item, index) => item.sortId = index+1);   
    return sortedEvidence;
}

export default sortTableOfContents;
