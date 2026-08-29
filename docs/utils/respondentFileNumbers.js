function getRespondentFileNumbers(respondent) {
    if (Array.isArray(respondent?.file_numbers)) {
        return respondent.file_numbers;
    }

    if (Object.prototype.hasOwnProperty.call(respondent || {}, 'file_number')) {
        return [respondent.file_number];
    }

    return respondent?.file_numbers;
}

export {
    getRespondentFileNumbers,
};
