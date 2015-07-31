var PSD = require('psd'),
  Promise = require('bluebird'),
  path = require('path'),
  _ = require('lodash'),
  fs = require('fs'),
  writeFile = Promise.promisify(fs.writeFile),
  glob = Promise.promisify(require('glob')),
  mkdirp = Promise.promisify(require('mkdirp')),
  nconf = require('nconf');

function parse(psdPath) {
  return PSD.open(psdPath).then(function (psd) {
    var linkNodes = ParsePSD.getLinkNodes(psd.tree());
    var hotspots = ParsePSD.parseLinks(linkNodes);
    var fileName = path.basename(psdPath, '.psd');
    var stateName = fileName.split('_')[0];
    var stateUrl = path.join(path.dirname(psdPath).replace(path.normalize(nconf.get('dir')), ''), stateName);
    var breakpointName = fileName.split('_')[1];
    var state = ParsePSD.createState(stateName, stateUrl);
    var dirName = path.join(nconf.get('imageOutputDir'), stateUrl);

    ParsePSD.setHotspots(hotspots, breakpointName, state);
    ParsePSD.setImageDimensions(psd, state, breakpointName);

    return {
      image: psd.image.toPng(),
      imageDir: dirName,
      state: state,
      breakpointName: breakpointName
    };
  });
}

function getLinkNodes(node) {
  var links = [],
    nodeName = node.get('name');

  if (nodeName && nodeName.indexOf(nconf.get('linkPrefix')) === 0) {
    links.push(node);
  }
  node.children().forEach(function(child) {
    links = links.concat(ParsePSD.getLinkNodes(child));
  });
  
  return links;
}

function parseLinks(nodes) {
  var hotspots = [];

  nodes.forEach(function(node) {
    hotspots.push(ParsePSD.parseLink(node));
  });

  return hotspots;
}

function createState(stateName, url) {
  var state = {
    state: stateName, 
    url: path.normalize('/' + url),
    breakpoints: {}
  };

  return state;
}

function setHotspots(hotspots, breakpointName, state) {
  state.breakpoints[breakpointName] = {
    hotspots: hotspots
  };
}

function setImageDimensions(psd, state, breakpointName) {
  var rootNode = psd.tree();
  state.breakpoints[breakpointName].imageWidth = rootNode.get('width');
  state.breakpoints[breakpointName].imageHeight = rootNode.get('height');
}

function parseLink(node) {
  return {
    "x": node.get('left'),
    "y": node.get('top'),
    "width": node.get('width'),
    "height": node.get('height'),
    "state": node.get('name').replace(nconf.get('linkPrefix'), '')
  };
}

function createAssets(assets) {
  var screenJSON = ParsePSD.createConfig(assets);

  return Promise.map(assets, ParsePSD.saveImage)
    .then(function() {
      return ParsePSD.saveConfig(screenJSON);
    });
}

function createConfig(assets) {
  var screenJSON = [];

  assets.forEach(function(asset) {
    var existingState = _.find(screenJSON, function(st) {
      return st.state === asset.state.state;
    });

    if (existingState) {
      _.merge(existingState, asset.state);
    } else {
      screenJSON.push(asset.state);
    }
  });

  return screenJSON;
}

function saveConfig(config) {
  return mkdirp(nconf.get('configDir'))
    .then(function() {
      return writeFile(path.join(nconf.get('configDir'), 'screens.json'), JSON.stringify(config));
    });
}

function saveImage(asset) {
  return mkdirp(asset.imageDir)
    .then(function() {
      return new Promise(function(resolve) {
        var filePath = path.join(asset.imageDir, asset.state.state + '_' + asset.breakpointName + '.png');

        asset.image
          .pack()
          .pipe(fs.createWriteStream(filePath))
          .on('finish', resolve);
      });
    });
}

module.exports = function(options){
  nconf.overrides(options)
    .env()
    .argv()
    .defaults({
      dir: './psd',
      configDir: './config',
      imageOutputDir: './screens/assets',
      linkPrefix: 'link__'
    });

  return glob(path.join(nconf.get('dir'), '/**/*.psd'))
    .then(function(files) {
      return Promise.map(files, ParsePSD.parse);
    })
    .then(ParsePSD.createAssets);
};
