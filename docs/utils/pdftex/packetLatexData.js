import { getRespondentFileNumbers } from '../respondentFileNumbers.js';

function createPacketLatexData(config, packetConfig, contents = []) {
    const respondentCount = (config?.respondents || []).reduce((acc, respondent) => {
        const status = respondent.status || '';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    const fields = {
        ...(config?.attorney || {}),
        ...(config?.cover || {}),
        ...(config?.certificate || {}),
        ...(config?.judge || {}),
        ...(packetConfig || {}),
    };

    return {
        attorney: {
            attorney_name: fields.attorney_name || '',
            address: fields.address || '',
            city: fields.city || '',
            phone: fields.phone || '',
            email: fields.email || '',
            eoir_id: fields.eoir_id || '',
            case_type: fields.case_type || '',
        },
        cover: {
            cover_department: fields.cover_department || '',
            cover_division: fields.cover_division || '',
            cover_location: fields.cover_location || '',
            cover_name: fields.cover_name || '',
        },
        certificate: {
            certificate_department: fields.certificate_department || '',
            certificate_division: fields.certificate_division || '',
            certificate_name: fields.certificate_name || '',
            certificate_location_address: fields.certificate_location_address || '',
            certificate_location_linetwo: fields.certificate_location_linetwo || '',
            certificate_location_statezip: fields.certificate_location_statezip || '',
        },
        respondents: (config?.respondents || []).map(respondent => {
            const fileNumbers = getRespondentFileNumbers(respondent);
            return {
                full_name: respondent.full_name || '',
                file_number_one: fileNumbers?.[0] || '',
                file_numbers_rest: fileNumbers?.slice(1) || [],
                count: respondentCount[respondent.status || ''] || 0,
                status: respondent.status || '',
            };
        }),
        judge: {
            judge_name: fields.judge_name || '',
            hearing_date: fields.hearing_date || '',
            hearing_time: fields.hearing_time || '',
        },
        document: {
            title: fields.packetTitle || '',
            multipleRespondents: Object.keys(respondentCount).length > 1,
        },
        contents: contents.map(entry => ({
            letter: entry.letter || '',
            title: entry.title || '',
            pageRange: entry.pageRange || '',
        })),
    };
}

export {
    createPacketLatexData,
};
