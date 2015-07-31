var ParsePSD = require('../lib/parse.js');
var expect = require('chai').expect;
var sinon = require('sinon');
var fs = require('fs');

describe('Prototype PSD Parser', function() {

  beforeEach(function() {
    sinon.stub(fs, 'writeFile');
  });

  afterEach(function() {
    fs.writeFile.restore();
  });

  describe('Init', function() {

    it('Should expose a function', function() {
      expect(ParsePSD).to.be.a('function');
    });
    
  });

});
