import React from 'react';
import ReactDOM from 'react-dom'; 
import Tesseract from 'tesseract';
import { PDFDocument } from 'pdf-lib';
import { Tabulator } from 'tabulator-tables';
import 'bootstrap/dist/css/bootstrap.min.css';

const App = () => { 

    // Example usage of Tesseract
    Tesseract.recognize(
        'https://tesseract.projectnaptha.com/img/eng_bw.png',
        'eng',
        {
            logger: m => console.log(m)
        }
    ).then(({ data: { text } }) => {
        console.log(text);
    });

    // Example usage of pdf-lib
    const createPdf = async () => {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 400]);
        page.drawText('Hello, World!');
        const pdfBytes = await pdfDoc.save();
        console.log(pdfBytes);
    };
    createPdf();

    // Example usage of Tabulator
    const tableData = [
        { id: 1, name: "John", age: 29 },
        { id: 2, name: "Jane", age: 32 }
    ];
    const table = new Tabulator("#example-table", {
        data: tableData,
        autoColumns: true
    });

    return (
        <div className="container">
            <h1>Hello, World!</h1> 
            <div id="example-table"></div>
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));
