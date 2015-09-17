var PSD = require('psd'),
  Promise = require('bluebird'),
  path = require('path'),
  _ = require('lodash'),
  fs = require('fs'),
  writeFile = Promise.promisify(fs.writeFile),
  glob = Promise.promisify(require('glob')),
  mkdirp = Promise.promisify(require('mkdirp')),
  nconf = require('nconf');

function parse(parentState) {
  return function (psdPath) {
    return PSD.open(psdPath).then(function (psd) {
      return _.map(_.filter(psd.tree().children(), function(group) {
        var name = group.get('name');
        return group.isGroup() && ((name.indexOf('.png') !== -1) || (name.indexOf('.jpg') !== -1));
      }), _.partial(parseGroup, psd, psdPath, parentState));
    });
  };
}

function parseGroup(psd, psdPath, parentState, group) {
  console.log(group.get('name'));
  var linkNodes = getLinkNodes(group);
  var hotspots = parseLinks(linkNodes, group);
  var fileName = path.basename(psdPath, '.psd');
  var fileNameSplit = fileName.split('_');
  var breakpointName = fileNameSplit[fileNameSplit.length - 1];
  var stateName = getStateName(group);
  var stateUrl = '/' + group.get('name').replace('.png', '').replace('.jpg', '');

  var state = createState(stateName, stateUrl, parentState);
  var imagePath = path.join(nconf.get('imageOutputDir'), breakpointName, group.get('name'));

  setHotspots(hotspots, breakpointName, state);
  setImageDimensions(group, state, breakpointName);

  return {
    image: nconf.get('exportGroups') ? null : psd.image.toPng(),
    imagePath: imagePath,
    state: state,
    breakpointName: breakpointName
  };
}

function getStateName(group) {
  var name = group.get('name');

  return /([^/]+)(?=\.png|\.jpg$)/g.exec(name)[0];
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

function createState(stateName, url, parentState) {
  var state = {
    state: parentState ? (parentState + '.' + stateName) : stateName,
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
  var maskWidth = group.layer.mask && group.layer.mask.width;
  var maskHeight = group.layer.mask && group.layer.mask.height;
  state.breakpoints[breakpointName].imageWidth = maskWidth || group.layer.header.width;
  state.breakpoints[breakpointName].imageHeight = maskHeight || group.layer.header.height;
}

function parseLink(node, rootNode) {
  var imageWidth = (rootNode.layer.mask && rootNode.layer.mask.width) || rootNode.layer.header.width;
  var imageHeight = (rootNode.layer.mask && rootNode.layer.mask.height) || rootNode.layer.header.height;
  var imageOffsetLeft = (rootNode.layer.mask && rootNode.layer.mask.left) || 0;
  var imageOffsetTop = (rootNode.layer.mask && rootNode.layer.mask.top) || 0;
  return {
    "x": (node.get('left') - imageOffsetLeft) / imageWidth,
    "y": (node.get('top') - imageOffsetTop) / imageHeight,
    "width": node.get('width') / imageWidth,
    "height": node.get('height') / imageHeight,
    "state": node.get('name').replace(nconf.get('linkPrefix'), '')
  };
}

function createAssets(assets) {
  var screenJSON = createConfig(_.flatten(_.flatten(assets)));

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

  if (nconf.get('groups')) {
      return Promise.map(nconf.get('groups'), function(group) {
        return glob(path.join(nconf.get('dir'), group.path, '/**/*.psd'))
          .then(function(files) {
            return Promise.map(files, parse(group.state));
          });
      }).then(createAssets);
  } else {
    return glob(path.join(nconf.get('dir'), '/**/*.psd'))
      .then(function(files) {
        return Promise.map(files, parse());
      })
      .then(createAssets);
  }


};
