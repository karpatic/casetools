const LATEX_ESCAPES = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '#': '\\#',
    '$': '\\$',
    '%': '\\%',
    '&': '\\&',
    '_': '\\_',
    '^': '\\textasciicircum{}',
    '~': '\\textasciitilde{}',
};

const PATH_RE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const STANDALONE_CONTROL_TYPES = new Set(['if', 'else', 'endif', 'for', 'endfor']);

function assertValidUnicodeString(value) {
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = value.charCodeAt(i + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) {
                throw new Error('Unsupported Unicode input: unpaired high surrogate in LaTeX value.');
            }
            i += 1;
        } else if (code >= 0xdc00 && code <= 0xdfff) {
            throw new Error('Unsupported Unicode input: unpaired low surrogate in LaTeX value.');
        }
    }
}

function escapeLatexValue(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    assertValidUnicodeString(text);
    return Array.from(text, char => LATEX_ESCAPES[char] || char).join('');
}

function resolveTemplatePath(path, data, scopes = []) {
    const parts = path.split('.');
    let value;
    let index = 0;

    if (parts[0] === 'it') {
        value = scopes[0]?.it;
        index = 1;
    } else {
        value = data[parts[0]];
        index = 1;
    }

    return parts.slice(index).reduce((current, part) => {
        if (current === null || current === undefined) return undefined;
        return current[part];
    }, value);
}

function tokenizeTemplate(template) {
    const tokens = [];
    let cursor = 0;

    while (cursor < template.length) {
        const markerStart = template.indexOf('$', cursor);
        if (markerStart === -1) {
            tokens.push({ type: 'literal', value: template.slice(cursor) });
            break;
        }

        const token = readToken(template, markerStart);
        if (!token) {
            tokens.push({ type: 'literal', value: template.slice(cursor, markerStart + 1) });
            cursor = markerStart + 1;
            continue;
        }

        const standaloneLine = findStandaloneControlLine(template, markerStart, token);
        if (markerStart > cursor) {
            const literalEnd = standaloneLine ? standaloneLine.lineStart : markerStart;
            if (literalEnd > cursor) {
                tokens.push({ type: 'literal', value: template.slice(cursor, literalEnd) });
            }
        }
        tokens.push(token);
        cursor = standaloneLine ? standaloneLine.nextCursor : token.end;
    }

    return tokens;
}

function findStandaloneControlLine(template, markerStart, token) {
    if (!STANDALONE_CONTROL_TYPES.has(token.type)) return null;

    const lineStart = findLineStart(template, markerStart);
    const lineEnd = findLineEnd(template, token.end);
    const beforeToken = template.slice(lineStart, markerStart);
    const afterToken = template.slice(token.end, lineEnd.breakStart);

    if (!/^[ \t]*$/.test(beforeToken) || !/^[ \t]*$/.test(afterToken)) return null;
    return { lineStart, nextCursor: lineEnd.nextCursor };
}

function findLineStart(template, index) {
    let cursor = index - 1;
    while (cursor >= 0 && template[cursor] !== '\n' && template[cursor] !== '\r') cursor -= 1;
    return cursor + 1;
}

function findLineEnd(template, index) {
    let cursor = index;
    while (cursor < template.length && template[cursor] !== '\n' && template[cursor] !== '\r') cursor += 1;
    const breakStart = cursor;
    if (template[cursor] === '\r' && template[cursor + 1] === '\n') cursor += 2;
    else if (cursor < template.length) cursor += 1;
    return { breakStart, nextCursor: cursor };
}

function readToken(template, markerStart) {
    if (template.startsWith('$if(', markerStart)) {
        return readPathDirective(template, markerStart, '$if(', 'if');
    }
    if (template.startsWith('$for(', markerStart)) {
        return readPathDirective(template, markerStart, '$for(', 'for');
    }
    if (template.startsWith('$else$', markerStart)) {
        return { type: 'else', end: markerStart + '$else$'.length };
    }
    if (template.startsWith('$endif$', markerStart)) {
        return { type: 'endif', end: markerStart + '$endif$'.length };
    }
    if (template.startsWith('$endfor$', markerStart)) {
        return { type: 'endfor', end: markerStart + '$endfor$'.length };
    }
    if (template.startsWith('${', markerStart)) {
        const close = template.indexOf('}', markerStart + 2);
        if (close === -1) return null;
        const path = template.slice(markerStart + 2, close).trim();
        if (!PATH_RE.test(path)) return null;
        return { type: 'variable', path, end: close + 1 };
    }

    const close = template.indexOf('$', markerStart + 1);
    if (close === -1) return null;
    const path = template.slice(markerStart + 1, close).trim();
    if (!PATH_RE.test(path)) return null;
    return { type: 'variable', path, end: close + 1 };
}

function readPathDirective(template, markerStart, prefix, type) {
    const close = template.indexOf(')$', markerStart + prefix.length);
    if (close === -1) return null;
    const path = template.slice(markerStart + prefix.length, close).trim();
    if (!PATH_RE.test(path)) return null;
    return { type, path, end: close + 2 };
}

function parseTemplate(template) {
    const tokens = tokenizeTemplate(template);
    const parsed = parseNodes(tokens, 0, new Set());
    if (parsed.stopType) {
        throw new Error(`Unexpected Pandoc template marker: ${parsed.stopType}`);
    }
    return parsed.nodes;
}

function parseNodes(tokens, startIndex, stopTypes) {
    const nodes = [];
    let index = startIndex;

    while (index < tokens.length) {
        const token = tokens[index];

        if (stopTypes.has(token.type)) {
            return { nodes, index, stopType: token.type };
        }

        if (token.type === 'literal' || token.type === 'variable') {
            nodes.push(token);
            index += 1;
            continue;
        }

        if (token.type === 'if') {
            const trueBranch = parseNodes(tokens, index + 1, new Set(['else', 'endif']));
            if (!trueBranch.stopType) {
                throw new Error(`Missing $endif$ for Pandoc template conditional: ${token.path}`);
            }

            let falseNodes = [];
            if (trueBranch.stopType === 'else') {
                const falseBranch = parseNodes(tokens, trueBranch.index + 1, new Set(['endif']));
                if (falseBranch.stopType !== 'endif') {
                    throw new Error(`Missing $endif$ for Pandoc template conditional: ${token.path}`);
                }
                falseNodes = falseBranch.nodes;
                index = falseBranch.index + 1;
            } else {
                index = trueBranch.index + 1;
            }

            nodes.push({ type: 'if', path: token.path, trueNodes: trueBranch.nodes, falseNodes });
            continue;
        }

        if (token.type === 'for') {
            const body = parseNodes(tokens, index + 1, new Set(['endfor']));
            if (body.stopType !== 'endfor') {
                throw new Error(`Missing $endfor$ for Pandoc template loop: ${token.path}`);
            }
            nodes.push({ type: 'for', path: token.path, bodyNodes: body.nodes });
            index = body.index + 1;
            continue;
        }

        throw new Error(`Unexpected Pandoc template marker: ${token.type}`);
    }

    return { nodes, index, stopType: null };
}

function renderNodes(nodes, data, scopes) {
    return nodes.map(node => {
        if (node.type === 'literal') return node.value;
        if (node.type === 'variable') return escapeLatexValue(resolveTemplatePath(node.path, data, scopes));
        if (node.type === 'if') {
            const branch = isTruthy(resolveTemplatePath(node.path, data, scopes)) ? node.trueNodes : node.falseNodes;
            return renderNodes(branch, data, scopes);
        }
        if (node.type === 'for') {
            const items = resolveTemplatePath(node.path, data, scopes);
            if (items === null || items === undefined) return '';
            if (!Array.isArray(items)) {
                throw new Error(`Pandoc template loop expected an array at path: ${node.path}`);
            }
            return items.map(item => renderNodes(node.bodyNodes, data, [{ it: item }, ...scopes])).join('');
        }
        throw new Error(`Unsupported Pandoc template node: ${node.type}`);
    }).join('');
}

function isTruthy(value) {
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
}

function renderPandocLatexTemplate(template, data) {
    return renderNodes(parseTemplate(template), data, []);
}

export {
    escapeLatexValue,
    renderPandocLatexTemplate,
    resolveTemplatePath,
};
