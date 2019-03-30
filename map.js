const process = require('process');
const fs = require('fs');
const zip = require('archiver');
// const unzip = require('unzip');
const path = require('path');
const sevenBin = require('7zip-bin')
const node7z = require('node-7z')
const baseDir = __dirname;//path.join(path.dirname(process.execPath), '.')
var originalFile;
// const originalFile = path.join(baseDir, "obliczeniaHali.mcdx");
const workDir = path.join(baseDir, "workidir");
const unzippedDir = path.join(workDir, "outzip");
var extract = require('extract-zip')
const hostImages = path.join(baseDir, 'images');
var mathcadImages = path.join(unzippedDir, 'mathcad', 'media');
var mapFile = path.join(workDir, 'mapping.json');
var worksheetRel = path.join(unzippedDir, 'mathcad', '_rels', 'worksheet.xml.rels');
var worksheet = path.join(unzippedDir, 'mathcad', 'worksheet.xml');
var sizeOf = require('image-size');
var looksSame = require('looks-same');

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

    console.log("workDir", workDir);
    extract(originalFile, { dir: unzippedDir }, function (err) {
        // extraction is complete. make sure to handle the err
        console.error('err while unzip', err);
        mapImages();
    })
    // const pathTo7zip = sevenBin.path7za
    // const seven = node7z.extractFull(originalFile, unzippedDir, {
    //     $bin: pathTo7zip
    // });
}


const mapping = [];
mapImages = () => {
    // const hostFiles = [];
    // const mathcadFiles = [];

    worksheetRelString = fs.readFileSync(worksheetRel).toString('UTF-8');
    worksheetString = fs.readFileSync(worksheet).toString('UTF-8');

    hostFiles = fs.readdirSync(hostImages).map(f => {
        return { filename: f, fullpath: path.join(hostImages, f) }
    });
    mathcadFiles = fs.readdirSync(mathcadImages).map(f => {
        return { filename: f, fullpath: path.join(mathcadImages, f) }
    })
    // , function (err, files) {
    //     //handling error
    //     if (err) {
    //         return console.log('Unable to scan directory: ' + err);
    //     }
    //     //listing all files using forEach
    //     files.forEach(function (file) {
    //         mathcadFiles.push(path.join(mathcadImages, file))
    //     });
    // }
    // console.log('hostFiles', hostFiles);
    // console.log('mathcadFiles', mathcadFiles);
    hostFiles.forEach(hostFile => {
        var mapped = false;
        hostBuff = fs.readFileSync(hostFile.fullpath);
        mathcadFiles.forEach(mathFile => {
            mathcadBuff = fs.readFileSync(mathFile.fullpath);
            if (hostBuff.equals(mathcadBuff)) {
                const dimensions = sizeOf(mathFile.fullpath);
                const reild = findRelId(mathFile.filename, worksheetRelString);
                const display = getDisplaySize(reild, worksheetString);
                proporion = display.width/display.height;
                mapping.push({
                    from: {
                        filename: hostFile.filename,
                        fullpath: hostFile.fullpath,
                    }, to: {
                        filename: mathFile.filename,
                        fullpath: mathFile.fullpath,
                        relid: reild,
                        display: display
                    }
                })
                mapped = true;
            }
        })
        if (!mapped) {
            console.log("Not mapped", hostFile.fullpath)
        } else {
            console.log("Mapped", hostFile.fullpath)
        }
    })

    console.log("Map count:", mapping.length)

    // console.log(mapping);
    fs.writeFileSync(mapFile, JSON.stringify(mapping));
}

findRelId = (file, worksheetRelString) => {
    //test = '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/mathcad/media/Image357.png" Id="Rd02e9119458b48be" />'
    regex = new RegExp(`<Relationship ([^<]*)${file}([^<]*)Id=\"([a-zA-Z0-9]+)\" \/\>`, 'mu')
    // console.log(file, worksheetRelString.match(regex)[3])
    return worksheetRelString.match(regex)[3];
}
getDisplaySize = (relId, worksheetString) => {
    // const relId = findRelId(file, worksheetRelString);
    // console.log('relId', relId)
    const regex = new RegExp(`<picture><([^<]*)item-idref="${relId}"([^<]*)display-width="([0-9\.]+)"([^<]*)display-height="([0-9\.]+)"([^<]*)><\/picture>`, 'mu')
    const matched = worksheetString.match(regex);
    console.log(relId, { width: parseFloat(matched[3]), height: parseFloat(matched[5]) })
    return { width: parseFloat(matched[3]), height: parseFloat(matched[5]) }
}
 // <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="/mathcad/media/Image357.png" Id="Rd02e9119458b48be" />
/* <picture><png item-idref="Rd02e9119458b48be" display-width="471.76576531832" display-height="278.210283637293" /></picture> */
