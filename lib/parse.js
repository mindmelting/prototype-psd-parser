var PSD = require('psd'),
  Promise = require('bluebird'),
  path = require('path'),
  _ = require('lodash'),
  writeFile = Promise.promisify(require('fs').writeFile),
  glob = Promise.promisify(require('glob')),
  mkdirp = Promise.promisify(require('mkdirp')),
  nconf = require('nconf');


var ParsePSD = function() {
  
};

ParsePSD.screenJSON = [];

ParsePSD.parse = function(psdPath) {
  return PSD.open(psdPath).then(function (psd) {
    var linkNodes = ParsePSD.getLinkNodes(psd.tree());
    var hotspots = ParsePSD.parseLinks(linkNodes);
    var fileName = path.basename(psdPath, '.psd');
    var stateName = fileName.split('_')[0];
    var url = path.join(path.dirname(psdPath).replace(path.normalize(nconf.get('dir')), ''), stateName);
    var breakpointName = fileName.split('_')[1];
    var state = ParsePSD.getState(stateName, url);
    var dirName = path.join(nconf.get('imageOutputDir'), url);

    ParsePSD.setHotspots(hotspots, breakpointName, state);
    ParsePSD.setImageDimensions(psd, state, breakpointName);

    return mkdirp(dirName)
      .then(function() {
        return psd.image.saveAsPng(path.join(dirName, stateName + '_' + breakpointName + '.png'));
      });
  });
};

ParsePSD.getLinkNodes = function(node) {
  var links = [],
    nodeName = node.get('name');

  if (nodeName && nodeName.indexOf(nconf.get('linkPrefix')) === 0) {
    links.push(node);
  }
  node.children().forEach(function(child) {
    links = links.concat(ParsePSD.getLinkNodes(child));
  });
  
  return links;
};

ParsePSD.parseLinks = function(nodes) {
  var hotspots = [];

  nodes.forEach(function(node) {
    hotspots.push(ParsePSD.parseLink(node));
  });

  return hotspots;
};

ParsePSD.getState = function(stateName, url) {
  var state = _.find(ParsePSD.screenJSON, function(st) {
    return st.state === stateName;
  });

  return state || ParsePSD.createState(stateName, url);
};

ParsePSD.createState = function(stateName, url) {
  var state = {
    state: stateName, 
    url: path.normalize('/' + url),
    breakpoints: {}
  };

  ParsePSD.screenJSON.push(state);
  return state;
};

ParsePSD.setHotspots = function(hotspots, breakpointName, state) {
  state.breakpoints[breakpointName] = {
    hotspots: hotspots
  };
};

ParsePSD.setImageDimensions = function(psd, state, breakpointName) {
  var rootNode = psd.tree();
  state.breakpoints[breakpointName].imageWidth = rootNode.get('width');
  state.breakpoints[breakpointName].imageHeight = rootNode.get('height');
};

ParsePSD.parseLink = function(node) {
  return {
    "x": node.get('left'),
    "y": node.get('top'),
    "width": node.get('width'),
    "height": node.get('height'),
    "state": node.get('name').replace(nconf.get('linkPrefix'), '')
  };
};

ParsePSD.createScreenConfig = function() {
  return mkdirp(nconf.get('configDir'))
    .then(function() {
      return writeFile(path.join(nconf.get('configDir'), 'screens.json'), JSON.stringify(ParsePSD.screenJSON));
    });
};

ParsePSD.init = function(options){
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
    .then(ParsePSD.createScreenConfig);
};

module.exports = ParsePSD;
