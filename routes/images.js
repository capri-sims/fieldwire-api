const express = require('express');
const router = express.Router();
const fileUpload = require('express-fileupload');
const fs = require('fs'); 
const path = require("path");
const sharp = require('sharp'); 

router.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
})); 

const publicBasePath = '/uploads/';
const internalBasePath = '../public' + publicBasePath; 
const imagePath = 'originals/'; 
const thumbPath = 'thumbnails/'; 

router.param('name', function(req, res, next, name){
  let filePath = path.resolve(__dirname, internalBasePath + imagePath + name); 
  req.filePath = filePath; 
  
  if (fs.existsSync(filePath)) {
    next();
  } else {
    next(createError(404, 'File does not exist.'));
  }
});

/* GET all image names */
router.get('/', function(req, res, next) {
    let allImageNames = [];
    let filePath = path.resolve(__dirname, internalBasePath + imagePath); 

    fs.readdirSync(filePath).forEach(name => {
      allImageNames.push({name: name}); 
    });
    res.send(allImageNames); 

    //TODO - add parameter to allow user to specify max or range number of images
    //TODO - allow user to search??
});

/* GET image path by name */ 
router.get('/:name', function(req, res, next)  {
  let name = req.params.name; 
  res.send([publicBasePath + imagePath + name, publicBasePath + thumbPath + name]);
}); 

/* POST new image */
router.post('/upload', function(req, res, next)  {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).json({message: 'No files were uploaded', status: 400});
  }

  let image = req.files.image; 
  let filePath = path.resolve(__dirname, internalBasePath + imagePath + image.name);

  //Ensure it is an image file type
  let type = image.mimetype; 
  if(!type.includes('image')) return res.status(415).json({message: 'File is not an image.', status: 415});

  //Check for duplicates
  if(fs.existsSync(filePath)) return res.status(400).json({message: 'Image already exists with that name.', status: 400});

  image.mv(filePath, function(err) {
    if(err) return res.status(500).json({message: err, status: 500});

    let newPath = path.resolve(__dirname, internalBasePath + thumbPath + image.name);
    sharp(filePath)
    .resize(100)
    .toFile(newPath, function(err) {
      console.log(err); 
    });

    res.status(201).json({message: "upload successful", status: 201});
  });
}); 

/* PATCH rename image */
router.patch('/:name/rename/:new', async function(req, res, next)  {
  //rename original image
  let newName = req.params.new;
  let newPath = path.resolve(__dirname, internalBasePath + imagePath + newName); 
  await renameImage(req.filePath, newPath).catch((err) => { return res.status(500).json({message: err.message, status: 500}); });

  //rename thumbnail image
  let origPath = path.resolve(__dirname, internalBasePath + thumbPath + req.params.name); 
  newPath = path.resolve(__dirname, internalBasePath + thumbPath + newName); 
  await renameImage(origPath, newPath).catch((err) => { return res.status(500).json({message: err.message, status: 500}); });

  res.json({message: 'rename successful'});
}); 

function renameImage(origPath, newPath) {
  return new Promise((resolve, reject) => {
    fs.rename(origPath, newPath, (err) => {
      if(err) reject(err);
      resolve();
    });
  }); 
}

/* DELETE image by name */
router.delete('/:name/delete', async function(req, res, next)  {
  //delete original image
  await deleteImage(req.filePath).catch((err) => { return res.status(500).json({message: err.message, status: 500}); });

  //delete thumbnail image
  let thumbFilePath = path.resolve(__dirname, internalBasePath + thumbPath + req.params.name); 
  await deleteImage(thumbFilePath).catch((err) => { return res.status(500).json({message: err.message, status: 500}); });

  res.json({message: 'delete successful'});
}); 

function deleteImage(filePath) {
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if(err) reject(err);
      resolve();
    });
  }); 
}


function createError(status, message) {
  var err = new Error(message);
  err.status = status;
  return err;
}

module.exports = router;