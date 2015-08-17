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
    return _.map(_.filter(psd.tree().children(), function(group) {
      return group.isGroup();
    }), _.partial(parseGroup, psd, psdPath));
  });
}

function parseGroup(psd, psdPath, group) {
  var linkNodes = getLinkNodes(group);
  var hotspots = parseLinks(linkNodes, group);
  var fileName = path.basename(psdPath, '.psd');
  var breakpointName = fileName.split('_')[1];
  var stateName = getStateName(group);
  var stateUrl = '/' + group.get('name').replace('.png', '');
  
  var state = createState(stateName, stateUrl);
  var imagePath = path.join(nconf.get('imageOutputDir'), breakpointName, group.get('name'));

  setHotspots(hotspots, breakpointName, state);
  setImageDimensions(group, state, breakpointName);

  return {
    image: psd.image.toPng(),
    imagePath: imagePath,
    state: state,
    breakpointName: breakpointName
  };
}

function getStateName(group) {
  var name = group.get('name');

  return /([^/]+)(?=\.png$)/g.exec(name)[0];
}

function getLinkNodes(node) {
  var links = [],
    nodeName = node.get('name');

  if (nodeName && nodeName.indexOf(nconf.get('linkPrefix')) === 0) {
    links.push(node);
  }
  node.children().forEach(function(child) {
    links = links.concat(getLinkNodes(child));
  });

  return links;
}

function parseLinks(nodes, rootNode) {
  var hotspots = [];

  nodes.forEach(function(node) {
    hotspots.push(parseLink(node, rootNode));
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

function setImageDimensions(group, state, breakpointName) {
  state.breakpoints[breakpointName].imageWidth = group.get('width');
  state.breakpoints[breakpointName].imageHeight = group.get('height');
}

function parseLink(node, rootNode) {
  var imageWidth = rootNode.get('width');
  var imageHeight = rootNode.get('height');

  return {
    "x": node.get('left') / imageWidth,
    "y": node.get('top') / imageHeight,
    "width": node.get('width') / imageWidth,
    "height": node.get('height') / imageHeight,
    "state": node.get('name').replace(nconf.get('linkPrefix'), '')
  };
}

function createAssets(assets) {
  var screenJSON = createConfig(_.flatten(assets));

  if (nconf.get('exportGroups')) {
    return saveConfig(screenJSON);
  } else {
    return Promise.map(_.flatten(assets), saveImage)
      .then(function() {
        return saveConfig(screenJSON);
      });
  }
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
  return mkdirp(path.dirname(asset.imagePath))
    .then(function() {
      return new Promise(function(resolve) {

        asset.image
          .pack()
          .pipe(fs.createWriteStream(asset.imagePath))
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
      linkPrefix: 'link__',
      exportGroups: false
    });

  return glob(path.join(nconf.get('dir'), '/**/*.psd'))
    .then(function(files) {
      return Promise.map(files, parse);
    })
    .then(createAssets);
};
