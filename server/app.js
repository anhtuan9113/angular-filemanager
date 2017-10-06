var http = require('http');
var express = require('express');
var app = express();
var node_env = process.env.node_env || 'development';
var AWS = require('aws-sdk');
var path = require('path');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();
var formidable = require('formidable');
var port = process.env.VCAP_APP_PORT || 3000;
var fs = require('fs');
var Promise = require('promise');
var server = http.createServer(app).listen(port, function () {
    console.log('Express server listening on port %s', port);
});

/*
"credentials": {
    "access_key_id": "00d140d0b842e6bffa6b",
        "bucket_name": "bucket-79008bfd-ae65-4fd0-9411-95731c9ade03",
        "host": "blobstore-azure-usw01.data-services.predix.io:443",
        "secret_access_key": "iLa+Jx/q0zUwWpR/3v5SkfCLbyS/B/y2j3cwnW5X",
        "url": "https://bucket-79008bfd-ae65-4fd0-9411-95731c9ade03.blobstore-azure-usw01.data-services.predix.io:443"
},*/

var initS3 = function (req, res, next) {
    console.log('00d140d0b842e6bffa6b');
    req.s3 = new AWS.S3({
        endpoint: "https://bucket-79008bfd-ae65-4fd0-9411-95731c9ade03.blobstore-azure-usw01.data-services.predix.io",
        accessKeyId: "00d140d0b842e6bffa6b",
        secretAccessKey: "iLa+Jx/q0zUwWpR/3v5SkfCLbyS/B/y2j3cwnW5X"
    });
    next();
};

var crossOrigin = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
    res.header('Access-Control-Request-Method', "*");
    if ('OPTIONS' === req.method) {
        //respond with 200
        res.sendStatus(200);
    } else {
        next();

    }
};

app.use('/', express.static(path.join(__dirname, '../public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));


app.use('/api/list', initS3, crossOrigin, function (req, res) {
    req.s3.listObjects({
        Bucket: ""
    }, function (err, data) {
        res.send({
            "data": data,
            "result": data.Contents.map(function (f) {
                return {
                    "name": f.Key,
                    "rights": "drwxr-xr-x",
                    "size": f.Size,
                    "date": +new Date(f.LastModified),
                    "type": "file"
                }
            })
        })
    })
});


app.use('/api/createFolder', initS3, crossOrigin, function (req, res) {
    var body = req.body;
    console.log(body);
    var params = {Bucket: '', Key: body.newPath, ACL: 'public-read', Body: 'body does not matter'};
    req.s3.upload(params, function (err, data) {
        res.send({"result": {"success": !!!err, "error": err, data: data}})
    });
});

app.use('/api/remove', initS3, crossOrigin, function (req, res) {
    var body = req.body;
    console.log(body);
    var promises = [];
    var errs = [];
    var datas = [];
    body.items && body.items.forEach(function (item) {
        promises.push(new Promise(function (resolve, reject) {
                var params = {Bucket: '', Key: item};
                req.s3.deleteObject(params, function (err, data) {
                    if(err) errs.push(err);
                    datas.push(data);
                    resolve();
                });
            })
        );
    });
    Promise.all(promises).then(function () {
        res.send({"result": {"success": errs.length === 0, "error": errs.length === 0 ? null : errs, data: datas}})
    });
});

app.use('/api/download', initS3, crossOrigin, function (req, res) {
    var fileStream = req.s3.getObject({
        Bucket: '', Key: req.query.path
    }).createReadStream();
    res.attachment(req.query.path);
    fileStream.pipe(res);
});

app.use('/api/createFile', initS3, crossOrigin, function (req, res) {
    // create an incoming form object
    var form = new formidable.IncomingForm();

    // log any errors that occur
    form.on('error', function (err) {
        res.send({"result": {"success": !!!err, "error": err}})
    });
    var errs = [];
    var datas = [];
    var promises = [];
    form.on('file', function (field, file) {
        var promise = new Promise(function (resolve, reject) {
            fs.readFile(file.path, function (err, data) {
                var base64data = new Buffer(data, 'binary');
                // This last line responds to the form submission with a list of the parsed data and files.
                var params = {Bucket: '', Key: file.name, Body: base64data};
                req.s3.putObject(params, function (err, data) {
                    if (err) {
                        errs.push(err);
                    }
                    datas.push(data);
                    resolve();
                    //console.log({"result": {"success": !!!err, "error": err, data: data}})
                });
            });
        });
        promises.push(promise);

    });

    // once all the files have been uploaded, send a response to the client
    form.on('end', function () {
        Promise.all(promises).then(function () {
            res.send({"result": {"success": errs.length === 0, "error": errs.length === 0 ? null : errs, data: datas}})
        });
    });

    // parse the incoming request containing the form data
    form.parse(req, function (err, fields, files) {
        if (err) {
            // Check for and handle any errors here.
            console.error(err.message);
        }
    });

});


