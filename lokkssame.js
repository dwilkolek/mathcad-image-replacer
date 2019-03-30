const process = require('process');
const fs = require('fs');
const path = require('path');
const baseDir = path.join(path.dirname(process.execPath), '.')
var originalFile;
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
const mapping = [];

if (fs.existsSync(mapFile)) {
    tempMapping = JSON.parse(fs.readFileSync(mapFile));
    tempMapping.forEach(tm => {
        mapping.push(tm)
    })
}

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
}




console.log(mapping)

mapImages = () => {
    worksheetRelString = fs.readFileSync(worksheetRel).toString('UTF-8');
    worksheetString = fs.readFileSync(worksheet).toString('UTF-8');

    hostFiles = fs.readdirSync(hostImages).map(f => {
        return { filename: f, fullpath: path.join(hostImages, f) }
    });
    mathcadFiles = fs.readdirSync(mathcadImages).map(f => {
        return { filename: f, fullpath: path.join(mathcadImages, f) }
    })


    console.log('Mathcad images:', mathcadFiles.length)
    console.log('Your images:', hostFiles.length)
    console.log('Pre mapped files:', mapping.length)
    var tim = null;
    mathcadFiles.forEach(mathFile => {
        hostFiles.forEach(hostFile => {
            if (mapping.filter(mapp => {
                return mapp.to.filename == mathFile.filename
            }).length == 0) {
                looksSame(hostFile.fullpath, mathFile.fullpath, { strict: true }, function (error, eq) {
                    if (eq && eq.equal) {
                        const dimensions = sizeOf(mathFile.fullpath);
                        const reild = findRelId(mathFile.filename, worksheetRelString);
                        const display = getDisplaySize(reild, worksheetString);
                        proporion = display.width / display.height;

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
                        });
                        fs.writeFileSync(mapFile, JSON.stringify(mapping));
                        console.log('mapping ', mapping.length, '/', mathcadFiles.length);
                        clearTimeout(tim);
                        tim = setTimeout(() => {
                            var er = '';
                            mathcadFiles.forEach(file => {
                                fM = mapping.filter(mapp => {
                                    return mapp.to.filename == file.filename
                                });
                                if (fM.length !== 1) {
                                    er += file.filename + ' matched ' + fM.length + ' times.\n'
                                }

                            })
                            if (er != '') {
                                console.log(er);
                                console.log("\n\n--READ AND CLOSE");
                                setTimeout(() => {
                                }, 100000)
                            }
                        }, 3000)
                    }
                });
            }
        })
    })

    fs.writeFileSync(mapFile, JSON.stringify(mapping));
}

findRelId = (file, worksheetRelString) => {
    regex = new RegExp(`<Relationship ([^<]*)${file}([^<]*)Id=\"([a-zA-Z0-9]+)\" \/\>`, 'mu')
    return worksheetRelString.match(regex)[3];
}
getDisplaySize = (relId, worksheetString) => {
    const regex = new RegExp(`<picture><([^<]*)item-idref="${relId}"([^<]*)display-width="([0-9\.]+)"([^<]*)display-height="([0-9\.]+)"([^<]*)><\/picture>`, 'mu')
    const matched = worksheetString.match(regex);
    console.log(relId, { width: parseFloat(matched[3]), height: parseFloat(matched[5]) })
    return { width: parseFloat(matched[3]), height: parseFloat(matched[5]) }
}