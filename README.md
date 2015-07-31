# prototype-psd-parser

[![Circle CI](https://circleci.com/gh/mindmelting/prototype-psd-parser.svg?style=svg)](https://circleci.com/gh/mindmelting/prototype-psd-parser)
[![npm version](https://badge.fury.io/js/prototype-psd-parser.svg)](http://badge.fury.io/js/prototype-psd-parser)
[![Dependency Status](https://david-dm.org/mindmelting/prototype-psd-parser.svg)](https://david-dm.org/mindmelting/prototype-psd-parser)

A node nodule that will create assets and configuration for use with [angular-prototype](https://github.com/mindmelting/angular-prototype)

## Installation

### Local module

```javascript
npm install prototype-psd-parser --save-dev
```

### Global module

```javascript
npm install prototype-psd-parser -g
```

## Usage

### Local module

```javascript
var psdParser = require('prototype-psd-parser');

psdParser({
  dir: './psd',
  configDir: './src/app/config',
  imageOutputDir: './src/assets/screens'
}).then(function() {
  console.log('Complete');
});
```

### Global module

Can be called directly on the command line

```
prototype-parse --dir=./psd --configDir=./src/app/config --imageOutputDir=./src/assets/screens
```

### Gulp

```javascript
var psdParser = require('prototype-psd-parser');

gulp.task('generate-assets', function(cb) {
  psdParser.init({
    dir: './psd',
    configDir: './src/app/config',
    imageOutputDir: './src/assets/screens'
  }).then(cb);
});
```

## Options

* dir - The directory containing the photoshop files
* configDir - The directory where the config file will be created
* imageOutputDir - The directory where the .png files will be created
* linkPrefix - The naming prefix for photoshop layers to generate hotposts. Defaults to `link__`

## PSD Naming Conventions

The PSD's should be titled in this format: `STATE_BREAKPOINT.psd` where state is a unique name.

### Breakpoints

The breakpoints that the images will be assigned are based on the naming of the PSD files  
e.g. `dashboard_desktop.psd` will be given the desktop breakpoint

### URL's

The URL's generated in the configuration for each state is based on the folder path and file name.

e.g. a PSD in this location: `dashboard/test/page_desktop.psd` will be assigned the URL `/dashboard/test/page`

### Creating Hotspots

Hotspots are generated automatically for Photoshop layers which have the name format: `link__STATE` where `STATE` is the name of the state to navigate to. Coordinates are generated automatically.
