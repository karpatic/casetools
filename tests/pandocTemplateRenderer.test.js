import test from 'node:test';
import assert from 'node:assert/strict';

import {
    escapeLatexValue,
    renderPandocLatexTemplate,
} from '../docs/utils/pdftex/pandocTemplateRenderer.js';

test('escapes LaTeX control characters in dynamic values while preserving Unicode', () => {
    assert.equal(
        escapeLatexValue('\\ { } # $ % & _ ^ ~ café'),
        '\\textbackslash{} \\{ \\} \\# \\$ \\% \\& \\_ \\textasciicircum{} \\textasciitilde{} café',
    );
});

test('renders a nested metadata path through the template renderer', () => {
    const latex = renderPandocLatexTemplate(
        'Attorney: $attorney.attorney_name$',
        { attorney: { attorney_name: 'Rivera & Co. #1' } },
    );

    assert.equal(latex, 'Attorney: Rivera \\& Co. \\#1');
});

test('renders nested conditionals with else branches', () => {
    const template = '$if(document.multipleRespondents)$many $if(document.sealed)$sealed$else$open$endif$$else$one$endif$';

    assert.equal(
        renderPandocLatexTemplate(template, { document: { multipleRespondents: true, sealed: false } }),
        'many open',
    );
    assert.equal(
        renderPandocLatexTemplate(template, { document: { multipleRespondents: false, sealed: true } }),
        'one',
    );
});

test('renders loops with item paths, nested item loops, and braced variables', () => {
    const template = '$for(respondents)$[$it.full_name$: $it.file_number_one$$for(it.file_numbers_rest)$, $it$$endfor$]$endfor$ $for(contents)$${it.letter}:${it.title};$endfor$';
    const data = {
        respondents: [
            {
                full_name: 'Ana & Bea',
                file_number_one: 'A_001',
                file_numbers_rest: ['B#002', 'C$003'],
            },
        ],
        contents: [
            { letter: 'A', title: 'Lease % Copy' },
            { letter: 'B', title: 'Tax {Return}' },
        ],
    };

    assert.equal(
        renderPandocLatexTemplate(template, data),
        '[Ana \\& Bea: A\\_001, B\\#002, C\\$003] A:Lease \\% Copy;B:Tax \\{Return\\};',
    );
});

test('removes standalone loop directive lines without leaving blank lines', () => {
    const template = [
        'start',
        '  $for(items)$',
        '  Item: $it$',
        '  $endfor$',
        'end',
    ].join('\n');

    assert.equal(
        renderPandocLatexTemplate(template, { items: ['A', 'B'] }),
        [
            'start',
            '  Item: A',
            '  Item: B',
            'end',
        ].join('\n'),
    );
});

test('removes standalone conditional directive lines without leaving blank lines', () => {
    const template = [
        'start',
        '  $if(show)$',
        'true branch',
        '  $else$',
        'false branch',
        '  $endif$',
        'end',
    ].join('\n');

    assert.equal(
        renderPandocLatexTemplate(template, { show: true }),
        [
            'start',
            'true branch',
            'end',
        ].join('\n'),
    );
    assert.equal(
        renderPandocLatexTemplate(template, { show: false }),
        [
            'start',
            'false branch',
            'end',
        ].join('\n'),
    );
});

test('preserves inline control directive whitespace', () => {
    const template = 'start $if(show)$ true $else$ false $endif$ end $for(items)$[$it$] $endfor$';

    assert.equal(
        renderPandocLatexTemplate(template, { show: true, items: ['A', 'B'] }),
        'start  true  end [A] [B] ',
    );
});
