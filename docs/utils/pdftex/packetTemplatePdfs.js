import { createPacketLatexData } from './packetLatexData.js';

const PACKET_TEMPLATE_PATHS = Object.freeze({
    certificate: 'rsc/latex/certificate.tex',
    cover: 'rsc/latex/cover.tex',
    toc: 'rsc/latex/toc.tex',
});

async function compilePacketTemplatePdf({
    compiler,
    templatePath,
    config,
    packetConfig,
    contents = [],
    pandocText,
}) {
    return compiler.compile({
        templatePath,
        pandocText,
        templateData: createPacketLatexData(config, packetConfig, contents),
    });
}

async function compilePacketFrontMatterPdfs({
    compiler,
    config,
    packetConfig,
    metadataPandocText,
}) {
    const certificatePdf = await compilePacketTemplatePdf({
        compiler,
        templatePath: PACKET_TEMPLATE_PATHS.certificate,
        config,
        packetConfig,
        pandocText: metadataPandocText,
    });
    const coverPdf = await compilePacketTemplatePdf({
        compiler,
        templatePath: PACKET_TEMPLATE_PATHS.cover,
        config,
        packetConfig,
        pandocText: metadataPandocText,
    });

    return { certificatePdf, coverPdf };
}

async function compilePacketTableOfContentsPdf({
    compiler,
    config,
    packetConfig,
    contents,
    tableOfContentsPandocText,
}) {
    return compilePacketTemplatePdf({
        compiler,
        templatePath: PACKET_TEMPLATE_PATHS.toc,
        config,
        packetConfig,
        contents,
        pandocText: tableOfContentsPandocText,
    });
}

export {
    PACKET_TEMPLATE_PATHS,
    compilePacketFrontMatterPdfs,
    compilePacketTableOfContentsPdf,
    compilePacketTemplatePdf,
};
