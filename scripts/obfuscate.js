import fs from 'fs';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';

const srcPath = path.resolve('./js/aicable.js');
const backupPath = path.resolve('./js/aicable.src.js');

try {
    // 1. Read original JS from source file if available
    let originalCode;
    if (fs.existsSync(backupPath)) {
        originalCode = fs.readFileSync(backupPath, 'utf8');
        console.log('Reading source from backupPath: ' + backupPath);
    } else {
        originalCode = fs.readFileSync(srcPath, 'utf8');
        // 2. Backup if not already backed up
        fs.writeFileSync(backupPath, originalCode, 'utf8');
        console.log('Original source backed up at js/aicable.src.js');
    }

    console.log('Obfuscating js/aicable.js...');

    // 3. Obfuscate using javascript-obfuscator
    const obfuscationResult = JavaScriptObfuscator.obfuscate(originalCode, {
        compact: true,
        controlFlowFlattening: false,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: false,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: false,
        reservedNames: [
            'setPreset',
            'runCalculation',
            'downloadSVG',
            'downloadPNG',
            'downloadCSV',
            'zoomIn',
            'zoomOut',
            'resetZoom'
        ],
        renameGlobals: false,
        rotateStringArray: true,
        selfDefending: false,
        shuffleStringArray: true,
        simplify: true,
        splitStrings: false,
        stringArray: true,
        stringArrayEncoding: [],
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false
    });

    // 4. Write back to js/aicable.js and public/js/aicable.js
    const obfuscatedCode = obfuscationResult.getObfuscatedCode();
    fs.writeFileSync(srcPath, obfuscatedCode, 'utf8');

    const publicDir = path.resolve('./public/js');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(publicDir, 'aicable.js'), obfuscatedCode, 'utf8');

    console.log('Code successfully obfuscated and copied to public/js/aicable.js!');

} catch (err) {
    console.error('Error during obfuscation:', err);
    process.exit(1);
}
