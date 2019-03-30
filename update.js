const process = require('process');
const fs = require('fs');
const zip = require('archiver');
const path = require('path');
const baseDir = path.join(path.dirname(process.execPath), '.')
var originalFile;
const workDir = path.join(baseDir, "workidir");
const unzippedDir = path.join(workDir, "outzip");
var mapFile = path.join(workDir, 'mapping.json');
var worksheetRel = path.join(unzippedDir, 'mathcad', '_rels', 'worksheet.xml.rels');
var worksheet = path.join(unzippedDir, 'mathcad', 'worksheet.xml');
var sizeOf = require('image-size');
const mapping = JSON.parse(fs.readFileSync(mapFile).toString());

const maxWidth = 604.72440944881885;

fs.readdir(baseDir, function (err, files) {
    //handling error
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }
    //listing all files using forEach
    files.forEach(function (file) {
        // Do whatever you want to do with the file
        if (file.indexOf('mcdx') > -1 && file.indexOf('_updated') == -1 && file.indexOf('.exe') == -1) {
            console.log("Original file: ", file);
            updatedZip = path.join(baseDir, file.replace('.mcdx', '_updated_' + new Date().getTime() + '.mcdx'))
            originalFile = path.join(baseDir, file);
            console.log("Original file resolved : ", originalFile);
            doOnFind();
            return;
        }
    });
});

doOnFind = () => {
    console.log("doOnFind", originalFile);
    if (!fs.existsSync(workDir)) {
        fs.mkdirSync(workDir);
    }

    mapping.forEach(mapp => {
        worksheetRelString = fs.readFileSync(worksheetRel).toString();
        worksheetString = fs.readFileSync(worksheet).toString();
        hostFileDim = sizeOf(mapp.from.fullpath);
        displW = mapp.to.display.width;
        displH = mapp.to.display.height;

        scale = displH / hostFileDim.height;

        const newW = Math.round(hostFileDim.width * scale * 100000000000) / 100000000000;
        let newH = null;
        if (newW > mapp.to.display.width) {
            newH = Math.round(hostFileDim.height * scale * 100000000000) / 100000000000;
        }

        const relId = mapp.to.relid;
        const regex = new RegExp(`<region([^<]*)height="([0-9\.]+)"([^<]*)width="([0-9\.]+)"([^<]*)actualWidth="([0-9\.]+)"([^<]*)actualHeight="([0-9\.]+)"([^<]*)<picture><([^<]*)item-idref="${relId}"([^<]*)display-width="([0-9\.]+)"([^<]*)display-height="([0-9\.]+)"([^<]*)><\/picture><\/region>`, 'mu')
        const matched = worksheetString.match(regex);
        if (newH) {
            worksheetStringUpdated = worksheetString.replace(matched[0], matched[0]
                .replace(/(height|actualHeight)="([0-9\.]+)"/gmu, `$1="${newH}"`)
                .replace(/(width|actualWidth)="([0-9\.]+)"/gmu, `$1="${displW}"`)
                .replace(/left="([0-9\.]+)"/gmu, `left="${(maxWidth - displW)/2.0}"`)
            );
        } else {
            worksheetStringUpdated = worksheetString.replace(matched[0], matched[0]
                .replace(/(width|actualWidth)="([0-9\.]+)"/gmu, `$1="${newW}"`)
                .replace(/(height|actualHeight)="([0-9\.]+)"/gmu, `$1="${displH}"`)
                .replace(/left="([0-9\.]+)"/gmu, `left="${(maxWidth - newW)/2.0}"`)
            );
        }
        fs.writeFileSync(worksheet, worksheetStringUpdated);
        fs.copyFileSync(mapp.from.fullpath, mapp.to.fullpath);
    })

    var archive = zip('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });
    var output = fs.createWriteStream(updatedZip);
    output.on('close', function () {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
    });

    archive.pipe(output);
    archive.directory(unzippedDir, false);

    archive.finalize();
}




findRelId = (file, worksheetRelString) => {
    regex = new RegExp(`<Relationship ([^<]*)${file}([^<]*)Id=\"([a-zA-Z0-9]+)\" \/\>`, 'mu')
    console.log(file, worksheetRelString.match(regex)[3])
    return worksheetRelString.match(regex)[3];
}
getDisplaySize = (file, worksheetRelString, worksheetString) => {
    const relId = findRelId(file, worksheetRelString);
    console.log('relId', relId)
    regex = new RegExp(`<picture><([^<]*)item-idref="${relId}"([^<]*)display-width="([0-9\.]+)"([^<]*)display-height="([0-9\.]+)"([^<]*)><\/picture>`, 'mu')
    matched = worksheetString.match(regex);
    return { width: parseFloat(matched[3]), height: parseFloat(matched[5]) }
}