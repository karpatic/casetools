import test from 'node:test';
import assert from 'node:assert/strict';

import { createCaseMetadataYaml } from '../docs/utils/createTableOfContents.js';

const completeConfig = {
    attorney: {
        attorney_name: 'Atty. Rivera',
        address: '1 Main St',
        city: 'New York, NY',
        phone: '555-1234',
        email: 'rivera@example.com',
        eoir_id: 'EOIR42',
        case_type: 'Removal',
    },
    cover: {
        cover_department: 'Department of Justice',
        cover_division: 'Executive Office',
        cover_location: 'New York',
        cover_name: 'Immigration Court',
    },
    certificate: {
        certificate_department: 'DHS',
        certificate_division: 'ICE',
        certificate_name: 'OPLA',
        certificate_location_address: '26 Federal Plaza',
        certificate_location_linetwo: 'Room 1130',
        certificate_location_statezip: 'New York, NY 10278',
    },
    judge: {
        judge_name: 'Hon. Example',
        hearing_date: 'January 2, 2027',
        hearing_time: '9:00 AM',
    },
    respondents: [
        {
            full_name: 'Modern Respondent',
            file_numbers: ['A001', 'A002'],
            file_number: 'SHOULD-NOT-WIN',
            status: 'Principal',
        },
        {
            full_name: 'Legacy Respondent',
            file_number: 'B001',
            status: 'Derivative',
        },
    ],
};

test('builds metadata YAML for respondent file_numbers arrays and legacy file_number values', () => {
    const yaml = createCaseMetadataYaml(completeConfig, { packetTitle: 'Motion & Evidence' });

    assert.match(
        yaml,
        /full_name: "Modern Respondent"\n    file_number_one: "A001"\n    file_numbers_rest:\n      - "A002"/,
    );
    assert.match(
        yaml,
        /full_name: "Legacy Respondent"\n    file_number_one: "B001"\n    file_numbers_rest:\n\n    count: 1\n    status: "Derivative"/,
    );
    assert.doesNotMatch(yaml, /SHOULD-NOT-WIN/);
});
