This is a website for Lawyers to perform dedicated actions with their pdfs for work.

The site is built using a client-side runtime bundler `rsc/transpile.js` which can handle JSX.

The site is served using an index.html page which contains nothing more than

1. An Import Map: ["react", "react-dom", "marked", "tesseract", "pdf-lib", "tabulator-tables", "bootstrap", "localforage"]
2. An App.jsx entry point which can use the import map.

### File Structure

The project file structure is organized as follows:

```
/home/carlos/Documents/GitHub/casetools/
├── docs/
│   ├── components/
│   │   ├── case/
│   │   │   └── basics.jsx
│   │   ├── evidence/
│   │   │   ├── packets.jsx
│   │   │   └── upload.jsx
│   │   │   └── table.jsx
│   │   └── App.jsx
├── notes/
│   └── about.md
├── index.html
└── rsc/
    └── transpile.js
```


### Cases Object Schema

The `cases` object is a collection of case data, where each key is a case name and the value is an object containing the case details. The schema for each case object is as follows:

```json
{
  "caseName": {
    "basics": {
      "caseFacts": "string",
      "attorney": {
        "attorney_name": "string",
        "address": "string",
        "city": "string",
        "phone": "string",
        "email": "string",
        "eoir_id": "string",
        "case_type": "string"
      },
      "cover": {
        "cover_department": "string",
        "cover_division": "string",
        "cover_name": "string",
        "cover_location": "string"
      },
      "certificate": {
        "certificate_department": "string",
        "certificate_division": "string",
        "certificate_name": "string",
        "certificate_location_address": "string",
        "certificate_location_linetwo": "string",
        "certificate_location_statezip": "string"
      },
      "respondents": [
        {
          "full_name": "string",
          "file_number": "string",
          "status": "string"
        }
      ],
      "judge": {
        "judge_name": "string",
        "hearing_date": "string",
        "hearing_time": "string"
      }
    },
    "evidence": [
      {
        "fileName": "string",
        "storageKey": "string",
        "evidencePacket": "number"
      }
    ],
    "evidencePacket_1": {
      "startPage": "string",
      "startLetter": "string",
      "sortInstructions": "string",
      "titleInstructions": "string",
      "packetTitle": "string",
      "compiled": {
        "packets": ["string"],
        "certPath": "string"
      }
    }
  }
}
```

### Evidence File

Uploaded Evidence Files are stored in localForage using their casename_filename as an identifier for retrieval. 
Raw File IndexDb Key = pickedCase + cases[pickedCase][evidence][selectedEvidencesIndex]['fileName']

The cases[pickedCase].evidence is an object array where each object maps to each saved file and its associated metadata.  

The `upload.jsx` component handles the uploading of evidence files. Users can select individual files or entire folders for upload. The selected files are displayed in a list, and users can remove files from this list before uploading. 
 

### Evidence Table

Displays the evidence metadata in a table with buttons to view evidence, and update/ delete evidence.


### Libraries and Dependencies
- React: The primary library for building the user interface.
- localforage: For storing and retrieving data from IndexedDB.
- pdf-lib: For handling PDF operations.
- Tabulator: For rendering and managing tables.
- Bootstrap: For styling and UI components.
- Tesseract: For OCR (Optical Character Recognition) capabilities (used in a sample component).